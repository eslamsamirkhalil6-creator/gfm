import { query, withTransaction } from '../../config/database.ts';
import { hasGlobalWarehouseAccess } from '../../middleware/auth.middleware.ts';
import { AuditService } from '../audit/audit.service.ts';
import { InventoryEngineService } from './inventory-engine.service.ts';
import {
  badRequest,
  conflict,
  notFound,
  parseEnumValue,
  parseNonNegativeNumber,
  parsePositiveInt,
  roundQty,
} from './warehouse.errors.ts';
import {
  AssignWarehouseStaffDTO,
  CreateCategoryDTO,
  CreateLocationDTO,
  CreateMaterialDTO,
  CreateWarehouseDTO,
  LOCATION_TYPES,
  MATERIAL_CATEGORY_TYPES,
  MATERIAL_UOMS,
  STOCK_STATUSES,
  UpdateMaterialDTO,
  UpdateWarehouseDTO,
  WAREHOUSE_STAFF_ROLES,
  WAREHOUSE_TYPES,
  WarehouseActor,
} from './warehouse.types.ts';

export class WarehouseMasterService {
  // ============================================================================
  // 5.1 Warehouse Management & Locations & Staff & Settings
  // ============================================================================
  static async listWarehouses(
    actor: WarehouseActor,
    filter?: { status?: string; warehouse_type?: string; search?: string }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT w.*, d.dept_code, d.name as department_name,
             u.full_name as manager_name, u.username as manager_username
      FROM warehouses w
      LEFT JOIN departments d ON w.department_id = d.id
      LEFT JOIN users u ON w.manager_id = u.id
      WHERE 1=1
    `;

    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND w.status = $${params.length}`;
    }
    if (filter?.warehouse_type) {
      params.push(filter.warehouse_type);
      sql += ` AND w.warehouse_type = $${params.length}`;
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      sql += ` AND (w.warehouse_code ILIKE $${params.length} OR w.name ILIKE $${params.length})`;
    }
    sql += ` ORDER BY w.id ASC`;

    const [whRes, locCountsRes, staffCountsRes] = await Promise.all([
      query<any>(sql, params),
      query<{ warehouse_id: number; cnt: string }>(
        `SELECT warehouse_id, count(*) as cnt FROM warehouse_locations GROUP BY warehouse_id`
      ),
      query<{ warehouse_id: number; cnt: string }>(
        `SELECT warehouse_id, count(*) as cnt FROM warehouse_staff WHERE status = 'active' GROUP BY warehouse_id`
      ),
    ]);

    const locCountMap = new Map<number, number>();
    for (const r of locCountsRes.rows) locCountMap.set(r.warehouse_id, parseInt(r.cnt || '0', 10));

    const staffCountMap = new Map<number, number>();
    for (const r of staffCountsRes.rows) staffCountMap.set(r.warehouse_id, parseInt(r.cnt || '0', 10));

    const allowedSet = new Set(actor.managed_warehouse_ids);
    return whRes.rows
      .filter((w) => isGlobal || allowedSet.has(w.id))
      .map((w) => ({
        ...w,
        location_count: locCountMap.get(w.id) || 0,
        staff_count: staffCountMap.get(w.id) || 0,
      }));
  }

  static async getWarehouseById(warehouseId: number): Promise<any> {
    const whRes = await query<any>(
      `SELECT w.*, d.dept_code, d.name as department_name,
              u.full_name as manager_name, u.username as manager_username
       FROM warehouses w
       LEFT JOIN departments d ON w.department_id = d.id
       LEFT JOIN users u ON w.manager_id = u.id
       WHERE w.id = $1`,
      [warehouseId]
    );
    if (whRes.rowCount === 0) {
      throw notFound(`Warehouse #${warehouseId} not found`);
    }

    const [locationsRes, staffRes] = await Promise.all([
      query<any>(
        `SELECT * FROM warehouse_locations WHERE warehouse_id = $1 ORDER BY is_default DESC, id ASC`,
        [warehouseId]
      ),
      query<any>(
        `SELECT ws.*, u.username, u.full_name, u.is_active as user_active
         FROM warehouse_staff ws
         JOIN users u ON ws.user_id = u.id
         WHERE ws.warehouse_id + 0 = $1
         ORDER BY ws.is_primary DESC, ws.id ASC`,
        [warehouseId]
      ),
    ]);

    return {
      warehouse: whRes.rows[0],
      locations: locationsRes.rows,
      staff: staffRes.rows,
    };
  }

  static async createWarehouse(dto: CreateWarehouseDTO, actor: WarehouseActor): Promise<any> {
    const code = String(dto.warehouse_code || '').trim().toUpperCase();
    const name = String(dto.name || '').trim();
    if (!code || !name) {
      throw badRequest('warehouse_code and name are required');
    }
    const warehouseType = parseEnumValue(dto.warehouse_type, WAREHOUSE_TYPES, 'warehouse_type');
    const requireBinTracking = dto.require_bin_tracking !== undefined ? Boolean(dto.require_bin_tracking) : true;
    const deptId = dto.department_id !== undefined && dto.department_id !== null ? parsePositiveInt(dto.department_id, 'department_id') : null;
    const managerId = dto.manager_id !== undefined && dto.manager_id !== null ? parsePositiveInt(dto.manager_id, 'manager_id') : null;

    return withTransaction(async (txQuery) => {
      const dupRes = await txQuery(`SELECT id FROM warehouses WHERE warehouse_code = $1`, [code]);
      if (dupRes.rowCount > 0) {
        throw conflict(`Warehouse code "${code}" already exists`, 'DUPLICATE_WAREHOUSE_CODE');
      }

      if (deptId !== null) {
        const dRes = await txQuery(`SELECT id FROM departments WHERE id = $1`, [deptId]);
        if (dRes.rowCount === 0) throw notFound(`Department #${deptId} not found`);
      }
      if (managerId !== null) {
        const uRes = await txQuery(`SELECT id, is_active FROM users WHERE id = $1`, [managerId]);
        if (uRes.rowCount === 0) throw notFound(`Manager user #${managerId} not found`);
        if (!uRes.rows[0].is_active) throw badRequest(`Manager user #${managerId} is inactive`);
      }

      const whIns = await txQuery<any>(
        `INSERT INTO warehouses (warehouse_code, name, warehouse_type, department_id, manager_id, require_bin_tracking, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING *`,
        [code, name, warehouseType, deptId, managerId, requireBinTracking, dto.description ?? null]
      );
      const warehouse = whIns.rows[0];

      // DEC-01: Auto-provision mandatory DEFAULT location
      const defLoc = await txQuery<any>(
        `INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, is_default, status)
         VALUES ($1, 'DEFAULT', $2, 'DEFAULT', TRUE, 'active')
         RETURNING *`,
        [warehouse.id, `${warehouse.name} - Default Location`]
      );

      // Keep PARAM-04 warehouse_staff synchronized if manager_id specified
      if (managerId !== null) {
        await txQuery(
          `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, is_primary, assigned_by, notes)
           VALUES ($1, $2, 'WAREHOUSE_MANAGER', TRUE, $3, 'Auto-assigned as warehouse manager')
           ON CONFLICT (warehouse_id, user_id) DO NOTHING`,
          [warehouse.id, managerId, actor.id]
        );
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_WAREHOUSE_CREATE',
          entityType: 'WAREHOUSE',
          entityId: warehouse.id,
          details: { warehouse_code: warehouse.warehouse_code, require_bin_tracking: requireBinTracking },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { warehouse, default_location: defLoc.rows[0] };
    });
  }

  static async updateWarehouse(warehouseId: number, dto: UpdateWarehouseDTO, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const existingRes = await txQuery<any>(`SELECT * FROM warehouses WHERE id = $1 FOR UPDATE`, [warehouseId]);
      if (existingRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);
      const current = existingRes.rows[0];

      const name = dto.name !== undefined ? String(dto.name).trim() : current.name;
      if (!name) throw badRequest('name cannot be empty');

      const warehouseType =
        dto.warehouse_type !== undefined
          ? parseEnumValue(dto.warehouse_type, WAREHOUSE_TYPES, 'warehouse_type')
          : current.warehouse_type;

      const deptId =
        dto.department_id === null
          ? null
          : dto.department_id !== undefined
            ? parsePositiveInt(dto.department_id, 'department_id')
            : current.department_id;
      const managerId =
        dto.manager_id === null
          ? null
          : dto.manager_id !== undefined
            ? parsePositiveInt(dto.manager_id, 'manager_id')
            : current.manager_id;
      const requireBinTracking =
        dto.require_bin_tracking !== undefined ? Boolean(dto.require_bin_tracking) : current.require_bin_tracking;
      const description = dto.description !== undefined ? dto.description : current.description;

      if (deptId !== null) {
        const dRes = await txQuery(`SELECT id FROM departments WHERE id = $1`, [deptId]);
        if (dRes.rowCount === 0) throw notFound(`Department #${deptId} not found`);
      }
      if (managerId !== null) {
        const uRes = await txQuery(`SELECT id FROM users WHERE id = $1`, [managerId]);
        if (uRes.rowCount === 0) throw notFound(`User #${managerId} not found`);
      }

      const updRes = await txQuery<any>(
        `UPDATE warehouses
         SET name = $1, warehouse_type = $2, department_id = $3, manager_id = $4,
             require_bin_tracking = $5, description = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [name, warehouseType, deptId, managerId, requireBinTracking, description, warehouseId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_WAREHOUSE_UPDATE',
          entityType: 'WAREHOUSE',
          entityId: warehouseId,
          details: { name, warehouse_type: warehouseType, require_bin_tracking: requireBinTracking },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return updRes.rows[0];
    });
  }

  static async toggleWarehouseStatus(warehouseId: number, status: 'active' | 'inactive', actor: WarehouseActor): Promise<any> {
    if (status !== 'active' && status !== 'inactive') {
      throw badRequest("status must be 'active' or 'inactive'");
    }
    return withTransaction(async (txQuery) => {
      const existingRes = await txQuery<any>(`SELECT * FROM warehouses WHERE id = $1 FOR UPDATE`, [warehouseId]);
      if (existingRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

      if (status === 'inactive') {
        const activeStock = await txQuery<{ cnt: string }>(
          `SELECT count(*) as cnt FROM inventory_balances WHERE warehouse_id = $1 AND qty_on_hand > 0`,
          [warehouseId]
        );
        if (parseInt(String(activeStock.rows[0]?.cnt || '0'), 10) > 0) {
          throw conflict(
            `Cannot deactivate Warehouse #${warehouseId} while positive stock balances remain`,
            'WAREHOUSE_HAS_STOCK'
          );
        }
      }

      const upd = await txQuery<any>(
        `UPDATE warehouses SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, warehouseId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_WAREHOUSE_STATUS',
          entityType: 'WAREHOUSE',
          entityId: warehouseId,
          details: { status },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async listLocations(warehouseId: number): Promise<any[]> {
    const whRes = await query(`SELECT id FROM warehouses WHERE id = $1`, [warehouseId]);
    if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

    const res = await query(
      `SELECT * FROM warehouse_locations WHERE warehouse_id = $1 ORDER BY is_default DESC, id ASC`,
      [warehouseId]
    );
    return res.rows;
  }

  static async createLocation(warehouseId: number, dto: CreateLocationDTO, actor: WarehouseActor): Promise<any> {
    const locationCode = String(dto.location_code || '').trim().toUpperCase();
    const name = String(dto.name || '').trim();
    if (!locationCode || !name) {
      throw badRequest('location_code and name are required');
    }
    const locationType = dto.location_type
      ? parseEnumValue(dto.location_type, LOCATION_TYPES, 'location_type')
      : 'STORAGE';
    if (locationType === 'DEFAULT') {
      throw badRequest('DEFAULT bin is auto-provisioned; choose STORAGE, RECEIVING, STAGING, QC_HOLD, DISPATCH, or DAMAGED');
    }

    return withTransaction(async (txQuery) => {
      const whRes = await txQuery(`SELECT id FROM warehouses WHERE id = $1`, [warehouseId]);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

      const dup = await txQuery(
        `SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND location_code = $2`,
        [warehouseId, locationCode]
      );
      if (dup.rowCount > 0) {
        throw conflict(`Location code "${locationCode}" already exists in Warehouse #${warehouseId}`, 'DUPLICATE_LOCATION');
      }

      const ins = await txQuery<any>(
        `INSERT INTO warehouse_locations (warehouse_id, location_code, name, location_type, zone, aisle, rack, bin, is_default, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, 'active')
         RETURNING *`,
        [
          warehouseId,
          locationCode,
          name,
          locationType,
          dto.zone ?? null,
          dto.aisle ?? null,
          dto.rack ?? null,
          dto.bin ?? null,
        ]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_LOCATION_CREATE',
          entityType: 'WAREHOUSE_LOCATION',
          entityId: ins.rows[0].id,
          details: { warehouse_id: warehouseId, location_code: locationCode, location_type: locationType },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return ins.rows[0];
    });
  }

  static async toggleLocationStatus(
    warehouseId: number,
    locationId: number,
    status: 'active' | 'inactive',
    actor: WarehouseActor
  ): Promise<any> {
    if (status !== 'active' && status !== 'inactive') {
      throw badRequest("status must be 'active' or 'inactive'");
    }
    return withTransaction(async (txQuery) => {
      const locRes = await txQuery<any>(
        `SELECT * FROM warehouse_locations WHERE id = $1 AND warehouse_id = $2 FOR UPDATE`,
        [locationId, warehouseId]
      );
      if (locRes.rowCount === 0) throw notFound(`Location #${locationId} not found in Warehouse #${warehouseId}`);
      if (locRes.rows[0].is_default && status === 'inactive') {
        throw conflict('Cannot deactivate mandatory DEFAULT warehouse location', 'DEFAULT_LOCATION_LOCKED');
      }

      const upd = await txQuery<any>(
        `UPDATE warehouse_locations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, locationId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_LOCATION_STATUS',
          entityType: 'WAREHOUSE_LOCATION',
          entityId: locationId,
          details: { warehouse_id: warehouseId, status },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async listWarehouseStaff(warehouseId: number): Promise<any[]> {
    const whRes = await query(`SELECT id FROM warehouses WHERE id = $1`, [warehouseId]);
    if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

    const res = await query(
      `SELECT ws.*, u.username, u.full_name, u.is_active as user_active
       FROM warehouse_staff ws
       JOIN users u ON ws.user_id = u.id
       WHERE ws.warehouse_id + 0 = $1
       ORDER BY ws.is_primary DESC, ws.id ASC`,
      [warehouseId]
    );
    return res.rows;
  }

  static async assignWarehouseStaff(
    warehouseId: number,
    dto: AssignWarehouseStaffDTO,
    actor: WarehouseActor
  ): Promise<any> {
    const userId = parsePositiveInt(dto.user_id, 'user_id');
    const staffRole = parseEnumValue(dto.staff_role, WAREHOUSE_STAFF_ROLES, 'staff_role');
    if (dto.effective_from && dto.effective_to && dto.effective_to < dto.effective_from) {
      throw badRequest('effective_to cannot be earlier than effective_from');
    }

    return withTransaction(async (txQuery) => {
      const [whRes, userRes] = await Promise.all([
        txQuery(`SELECT id FROM warehouses WHERE id = $1`, [warehouseId]),
        txQuery(`SELECT id, is_active FROM users WHERE id = $1`, [userId]),
      ]);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);
      if (userRes.rowCount === 0) throw notFound(`User #${userId} not found`);
      if (!userRes.rows[0].is_active) throw badRequest(`Cannot assign inactive User #${userId}`);

      const existing = await txQuery<any>(
        `SELECT id FROM warehouse_staff WHERE warehouse_id = $1 AND user_id = $2`,
        [warehouseId, userId]
      );

      let resultRow: any;
      if (existing.rowCount > 0) {
        const upd = await txQuery<any>(
          `UPDATE warehouse_staff
           SET staff_role = $1, is_primary = $2, status = 'active',
               effective_from = COALESCE($3::date, effective_from),
               effective_to = $4::date,
               assigned_by = $5, notes = $6, updated_at = NOW()
           WHERE id = $7 RETURNING *`,
          [
            staffRole,
            dto.is_primary ?? false,
            dto.effective_from ?? null,
            dto.effective_to ?? null,
            actor.id,
            dto.notes ?? null,
            existing.rows[0].id,
          ]
        );
        resultRow = upd.rows[0];
      } else {
        const ins = await txQuery<any>(
          `INSERT INTO warehouse_staff (warehouse_id, user_id, staff_role, is_primary, effective_from, effective_to, assigned_by, notes)
           VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6::date, $7, $8)
           RETURNING *`,
          [
            warehouseId,
            userId,
            staffRole,
            dto.is_primary ?? false,
            dto.effective_from ?? null,
            dto.effective_to ?? null,
            actor.id,
            dto.notes ?? null,
          ]
        );
        resultRow = ins.rows[0];
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STAFF_ASSIGN',
          entityType: 'WAREHOUSE_STAFF',
          entityId: resultRow.id,
          details: { warehouse_id: warehouseId, assigned_user_id: userId, staff_role: staffRole },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return resultRow;
    });
  }

  static async removeWarehouseStaff(warehouseId: number, userId: number, actor: WarehouseActor): Promise<void> {
    return withTransaction(async (txQuery) => {
      const existing = await txQuery<any>(
        `SELECT id FROM warehouse_staff WHERE warehouse_id = $1 AND user_id = $2`,
        [warehouseId, userId]
      );
      if (existing.rowCount === 0) {
        throw notFound(`Staff assignment not found for User #${userId} in Warehouse #${warehouseId}`);
      }

      await txQuery(`DELETE FROM warehouse_staff WHERE id = $1`, [existing.rows[0].id]);

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STAFF_REMOVE',
          entityType: 'WAREHOUSE_STAFF',
          entityId: existing.rows[0].id,
          details: { warehouse_id: warehouseId, removed_user_id: userId },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );
    });
  }

  static async getSettings(): Promise<any[]> {
    const res = await query(`SELECT * FROM warehouse_settings ORDER BY id ASC`);
    return res.rows;
  }

  static async updateSetting(settingKey: string, settingValue: string, actor: WarehouseActor): Promise<any> {
    const valStr = String(settingValue ?? '').trim();
    if (!valStr) throw badRequest('setting_value is required');

    if (settingKey === 'adjustment_approval_threshold') {
      if (valStr !== 'UNCONFIGURED') {
        const num = Number(valStr);
        if (!Number.isFinite(num) || num < 0) {
          throw badRequest("adjustment_approval_threshold must be 'UNCONFIGURED' or a non-negative numeric string");
        }
      }
    } else if (settingKey === 'grn_over_delivery_tolerance_pct') {
      const num = Number(valStr);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        throw badRequest('grn_over_delivery_tolerance_pct must be between 0 and 100');
      }
    } else if (settingKey === 'write_off_requires_factory_manager') {
      if (valStr !== 'true') {
        throw badRequest('DEC-08 mandates write_off_requires_factory_manager remain true');
      }
    } else if (settingKey === 'fifo_override_requires_reason') {
      if (valStr !== 'true' && valStr !== 'false') {
        throw badRequest("fifo_override_requires_reason must be 'true' or 'false'");
      }
    } else {
      throw notFound(`Unknown warehouse setting key "${settingKey}"`);
    }

    return withTransaction(async (txQuery) => {
      const upd = await txQuery<any>(
        `UPDATE warehouse_settings
         SET setting_value = $1, updated_by = $2, updated_at = NOW()
         WHERE setting_key = $3
         RETURNING *`,
        [valStr, actor.id, settingKey]
      );
      if (upd.rowCount === 0) throw notFound(`Setting "${settingKey}" not found`);

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_SETTING_UPDATE',
          entityType: 'WAREHOUSE_SETTING',
          entityId: settingKey,
          details: { setting_key: settingKey, setting_value: valStr },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  // ============================================================================
  // 5.2 Material Categories & Material Catalog
  // ============================================================================
  static async listCategories(status?: string): Promise<any[]> {
    const params: any[] = [];
    let sql = `SELECT * FROM material_categories WHERE 1=1`;
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ` ORDER BY id ASC`;
    const res = await query(sql, params);
    return res.rows;
  }

  static async getCategoryById(id: number): Promise<any> {
    const res = await query(`SELECT * FROM material_categories WHERE id = $1`, [id]);
    if (res.rowCount === 0) throw notFound(`Material category #${id} not found`);
    return res.rows[0];
  }

  static async createCategory(dto: CreateCategoryDTO, actor: WarehouseActor): Promise<any> {
    const code = String(dto.category_code || '').trim().toUpperCase();
    const name = String(dto.name || '').trim();
    if (!code || !name) throw badRequest('category_code and name are required');
    const categoryType = parseEnumValue(dto.category_type, MATERIAL_CATEGORY_TYPES, 'category_type');

    return withTransaction(async (txQuery) => {
      const dup = await txQuery(
        `SELECT id FROM material_categories WHERE category_code = $1 OR name = $2`,
        [code, name]
      );
      if (dup.rowCount > 0) throw conflict(`Category code or name already exists`, 'DUPLICATE_CATEGORY');

      const ins = await txQuery<any>(
        `INSERT INTO material_categories (category_code, name, category_type, requires_qc_default, is_lot_tracked_default, is_roll_tracked_default, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          code,
          name,
          categoryType,
          dto.requires_qc_default !== undefined ? Boolean(dto.requires_qc_default) : true,
          dto.is_lot_tracked_default !== undefined ? Boolean(dto.is_lot_tracked_default) : false,
          dto.is_roll_tracked_default !== undefined ? Boolean(dto.is_roll_tracked_default) : false,
          dto.description ?? null,
        ]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_CATEGORY_CREATE',
          entityType: 'MATERIAL_CATEGORY',
          entityId: ins.rows[0].id,
          details: { category_code: code, category_type: categoryType },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return ins.rows[0];
    });
  }

  private static serializeAttributesJson(attributes?: Record<string, any>, rawJson?: string): string {
    if (attributes !== undefined) {
      if (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes)) {
        throw badRequest('attributes must be a JSON object');
      }
      return JSON.stringify(attributes);
    }
    if (rawJson !== undefined) {
      try {
        const parsed = JSON.parse(rawJson);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Not a JSON object');
        }
        return JSON.stringify(parsed);
      } catch {
        throw badRequest('attributes_json must be a valid JSON object string');
      }
    }
    return '{}';
  }

  static async listMaterials(filter?: { category_id?: number; status?: string; search?: string }): Promise<any[]> {
    const params: any[] = [];
    let sql = `
      SELECT m.*, mc.category_code, mc.name as category_name, mc.category_type
      FROM materials m
      JOIN material_categories mc ON m.category_id = mc.id
      WHERE 1=1
    `;
    if (filter?.category_id) {
      params.push(filter.category_id);
      sql += ` AND m.category_id + 0 = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND m.status = $${params.length}`;
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      sql += ` AND (m.sku ILIKE $${params.length} OR m.name ILIKE $${params.length} OR COALESCE(m.color, '') ILIKE $${params.length})`;
    }
    sql += ` ORDER BY m.id ASC`;
    const res = await query(sql, params);
    return res.rows;
  }

  static async getMaterialById(id: number): Promise<any> {
    const res = await query<any>(
      `SELECT m.*, mc.category_code, mc.name as category_name, mc.category_type
       FROM materials m
       JOIN material_categories mc ON m.category_id = mc.id
       WHERE m.id = $1`,
      [id]
    );
    if (res.rowCount === 0) throw notFound(`Material #${id} not found`);
    return res.rows[0];
  }

  static async createMaterial(dto: CreateMaterialDTO, actor: WarehouseActor): Promise<any> {
    const sku = String(dto.sku || '').trim().toUpperCase();
    const name = String(dto.name || '').trim();
    if (!sku || !name) throw badRequest('sku and name are required');
    const categoryId = parsePositiveInt(dto.category_id, 'category_id');
    const baseUom = parseEnumValue(dto.base_uom, MATERIAL_UOMS, 'base_uom');
    const minStock = parseNonNegativeNumber(dto.min_stock_level, 'min_stock_level', 0);
    const reorderLevel = parseNonNegativeNumber(dto.reorder_level, 'reorder_level', 0);
    const attributesJson = this.serializeAttributesJson(dto.attributes, dto.attributes_json);

    return withTransaction(async (txQuery) => {
      const [dupSku, catRes] = await Promise.all([
        txQuery(`SELECT id FROM materials WHERE sku = $1`, [sku]),
        txQuery<any>(`SELECT * FROM material_categories WHERE id = $1`, [categoryId]),
      ]);
      if (dupSku.rowCount > 0) throw conflict(`Material SKU "${sku}" already exists`, 'DUPLICATE_SKU');
      if (catRes.rowCount === 0) throw notFound(`Material category #${categoryId} not found`);
      const cat = catRes.rows[0];

      const isLotTracked = dto.is_lot_tracked !== undefined ? Boolean(dto.is_lot_tracked) : Boolean(cat.is_lot_tracked_default);
      const isRollTracked = dto.is_roll_tracked !== undefined ? Boolean(dto.is_roll_tracked) : Boolean(cat.is_roll_tracked_default);
      const requiresQc = dto.requires_qc_on_receipt !== undefined ? Boolean(dto.requires_qc_on_receipt) : Boolean(cat.requires_qc_default);

      const ins = await txQuery<any>(
        `INSERT INTO materials (
           sku, name, category_id, base_uom, color, size, attributes_json,
           is_lot_tracked, is_roll_tracked, requires_qc_on_receipt,
           min_stock_level, reorder_level
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          sku,
          name,
          categoryId,
          baseUom,
          dto.color ?? null,
          dto.size ?? null,
          attributesJson,
          isLotTracked,
          isRollTracked,
          requiresQc,
          minStock,
          reorderLevel,
        ]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_MATERIAL_CREATE',
          entityType: 'MATERIAL',
          entityId: ins.rows[0].id,
          details: { sku, base_uom: baseUom, requires_qc_on_receipt: requiresQc },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return ins.rows[0];
    });
  }

  static async updateMaterial(materialId: number, dto: UpdateMaterialDTO, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const existingRes = await txQuery<any>(`SELECT * FROM materials WHERE id = $1 FOR UPDATE`, [materialId]);
      if (existingRes.rowCount === 0) throw notFound(`Material #${materialId} not found`);
      const cur = existingRes.rows[0];

      const name = dto.name !== undefined ? String(dto.name).trim() : cur.name;
      if (!name) throw badRequest('name cannot be empty');
      const categoryId = dto.category_id !== undefined ? parsePositiveInt(dto.category_id, 'category_id') : cur.category_id;
      const baseUom = dto.base_uom !== undefined ? parseEnumValue(dto.base_uom, MATERIAL_UOMS, 'base_uom') : cur.base_uom;
      const minStock = dto.min_stock_level !== undefined ? parseNonNegativeNumber(dto.min_stock_level, 'min_stock_level') : Number(cur.min_stock_level);
      const reorderLevel = dto.reorder_level !== undefined ? parseNonNegativeNumber(dto.reorder_level, 'reorder_level') : Number(cur.reorder_level);
      const attributesJson =
        dto.attributes !== undefined || dto.attributes_json !== undefined
          ? this.serializeAttributesJson(dto.attributes, dto.attributes_json)
          : cur.attributes_json;
      const status = dto.status !== undefined ? parseEnumValue(dto.status, ['active', 'inactive'] as const, 'status') : cur.status;

      if (dto.category_id !== undefined) {
        const cRes = await txQuery(`SELECT id FROM material_categories WHERE id = $1`, [categoryId]);
        if (cRes.rowCount === 0) throw notFound(`Material category #${categoryId} not found`);
      }

      const upd = await txQuery<any>(
        `UPDATE materials
         SET name = $1, category_id = $2, base_uom = $3, color = $4, size = $5,
             attributes_json = $6, is_lot_tracked = $7, is_roll_tracked = $8,
             requires_qc_on_receipt = $9, min_stock_level = $10, reorder_level = $11,
             status = $12, updated_at = NOW()
         WHERE id = $13 RETURNING *`,
        [
          name,
          categoryId,
          baseUom,
          dto.color !== undefined ? dto.color : cur.color,
          dto.size !== undefined ? dto.size : cur.size,
          attributesJson,
          dto.is_lot_tracked !== undefined ? Boolean(dto.is_lot_tracked) : cur.is_lot_tracked,
          dto.is_roll_tracked !== undefined ? Boolean(dto.is_roll_tracked) : cur.is_roll_tracked,
          dto.requires_qc_on_receipt !== undefined ? Boolean(dto.requires_qc_on_receipt) : cur.requires_qc_on_receipt,
          minStock,
          reorderLevel,
          status,
          materialId,
        ]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_MATERIAL_UPDATE',
          entityType: 'MATERIAL',
          entityId: materialId,
          details: { sku: cur.sku, name, reorder_level: reorderLevel, requires_qc_on_receipt: upd.rows[0].requires_qc_on_receipt },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  // ============================================================================
  // 5.3 Inventory Inquiry & Ledger Reconciliation
  // ============================================================================
  static async queryBalances(
    actor: WarehouseActor,
    filter: {
      warehouse_id?: number;
      location_id?: number;
      material_id?: number;
      lot_id?: number;
      stock_status?: string;
      only_available?: boolean;
      only_reserved?: boolean;
    }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT b.*,
             w.warehouse_code, w.name as warehouse_name,
             l.location_code, l.name as location_name, l.location_type,
             m.sku, m.name as material_name, m.base_uom, m.weighted_avg_cost, m.reorder_level,
             lot.lot_number, lot.roll_number, lot.shade_code, lot.qc_status, lot.received_at
      FROM inventory_balances b
      JOIN warehouses w ON b.warehouse_id = w.id
      JOIN warehouse_locations l ON b.location_id = l.id
      JOIN materials m ON b.material_id = m.id
      LEFT JOIN inventory_lots lot ON b.lot_id = lot.id
      WHERE 1=1
    `;

    if (filter.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND b.warehouse_id + 0 = $${params.length}`;
    }
    if (filter.location_id) {
      params.push(filter.location_id);
      sql += ` AND b.location_id + 0 = $${params.length}`;
    }
    if (filter.material_id) {
      params.push(filter.material_id);
      sql += ` AND b.material_id + 0 = $${params.length}`;
    }
    if (filter.lot_id) {
      params.push(filter.lot_id);
      sql += ` AND b.lot_id + 0 = $${params.length}`;
    }
    if (filter.stock_status) {
      const status = parseEnumValue(filter.stock_status, STOCK_STATUSES, 'stock_status');
      params.push(status);
      sql += ` AND b.stock_status = $${params.length}`;
    }
    if (filter.only_available) {
      sql += ` AND b.stock_status = 'AVAILABLE' AND b.qty_on_hand > b.qty_reserved`;
    }
    if (filter.only_reserved) {
      sql += ` AND b.qty_reserved > 0`;
    }

    sql += ` ORDER BY b.warehouse_id ASC, m.sku ASC, lot.received_at ASC NULLS LAST, b.id ASC`;

    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    const canViewValuation = actor.permissions.includes('warehouse:reports:valuation');
    return res.rows
      .filter((r) => isGlobal || allowedSet.has(r.warehouse_id))
      .map((r) => (canViewValuation ? r : { ...r, weighted_avg_cost: undefined }));
  }

  static async queryLots(
    actor: WarehouseActor,
    filter: { material_id?: number; warehouse_id?: number; qc_status?: string; lot_number?: string }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT l.*, m.sku, m.name as material_name, m.base_uom
      FROM inventory_lots l
      JOIN materials m ON l.material_id = m.id
      WHERE 1=1
    `;
    if (filter.material_id) {
      params.push(filter.material_id);
      sql += ` AND l.material_id + 0 = $${params.length}`;
    }
    if (filter.qc_status) {
      params.push(filter.qc_status);
      sql += ` AND l.qc_status = $${params.length}`;
    }
    if (filter.lot_number) {
      params.push(`%${filter.lot_number}%`);
      sql += ` AND l.lot_number ILIKE $${params.length}`;
    }
    sql += ` ORDER BY l.received_at ASC, l.id ASC`;

    const [lotsRes, balRes] = await Promise.all([
      query<any>(sql, params),
      query<any>(
        `SELECT lot_id, warehouse_id, location_id, stock_status, qty_on_hand, qty_reserved, qty_available
         FROM inventory_balances
         WHERE lot_id IS NOT NULL`
      ),
    ]);

    const allowedSet = new Set(actor.managed_warehouse_ids);
    const balByLot = new Map<number, any[]>();
    for (const b of balRes.rows) {
      if (!isGlobal && !allowedSet.has(b.warehouse_id)) continue;
      if (filter.warehouse_id && b.warehouse_id !== filter.warehouse_id) continue;
      if (!balByLot.has(b.lot_id)) balByLot.set(b.lot_id, []);
      balByLot.get(b.lot_id)!.push(b);
    }

    return lotsRes.rows
      .map((l) => ({
        ...l,
        balances: balByLot.get(l.id) || [],
      }))
      .filter((l) => !filter.warehouse_id || l.balances.length > 0);
  }

  static async queryMovements(
    actor: WarehouseActor,
    filter: {
      warehouse_id?: number;
      material_id?: number;
      lot_id?: number;
      movement_type?: string;
      source_document_type?: string;
      source_document_id?: number;
      limit?: number;
    }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT sm.*,
             w.warehouse_code, w.name as warehouse_name,
             l.location_code,
             m.sku, m.name as material_name, m.base_uom,
             lot.lot_number, lot.roll_number,
             u.username as actor_username, u.full_name as actor_name
      FROM stock_movements sm
      JOIN warehouses w ON sm.warehouse_id = w.id
      JOIN warehouse_locations l ON sm.location_id = l.id
      JOIN materials m ON sm.material_id = m.id
      LEFT JOIN inventory_lots lot ON sm.lot_id = lot.id
      JOIN users u ON sm.actor_id = u.id
      WHERE 1=1
    `;
    if (filter.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND sm.warehouse_id + 0 = $${params.length}`;
    }
    if (filter.material_id) {
      params.push(filter.material_id);
      sql += ` AND sm.material_id + 0 = $${params.length}`;
    }
    if (filter.lot_id) {
      params.push(filter.lot_id);
      sql += ` AND sm.lot_id + 0 = $${params.length}`;
    }
    if (filter.movement_type) {
      params.push(filter.movement_type);
      sql += ` AND sm.movement_type = $${params.length}`;
    }
    if (filter.source_document_type) {
      params.push(filter.source_document_type);
      sql += ` AND sm.source_document_type = $${params.length}`;
    }
    if (filter.source_document_id) {
      params.push(filter.source_document_id);
      sql += ` AND sm.source_document_id = $${params.length}`;
    }

    const limit = Math.min(Math.max(filter.limit || 100, 1), 500);
    params.push(limit);
    sql += ` ORDER BY sm.created_at DESC, sm.id DESC LIMIT $${params.length}`;

    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async getInventorySummary(actor: WarehouseActor, warehouseId?: number): Promise<any> {
    const balances = await this.queryBalances(actor, { warehouse_id: warehouseId });
    const [materialsRes, pendingQcRes, pendingReqsRes, pendingAdjRes, inTransitRes] = await Promise.all([
      query<any>(`SELECT id, sku, name, weighted_avg_cost, total_valued_qty, total_inventory_value, reorder_level, status FROM materials WHERE status = 'active'`),
      query<{ cnt: string }>(`SELECT count(*) as cnt FROM goods_receipt_items WHERE pending_inspection_qty > 0`),
      query<{ cnt: string }>(`SELECT count(*) as cnt FROM material_requisitions WHERE status = 'SUBMITTED'`),
      query<{ cnt: string }>(`SELECT count(*) as cnt FROM stock_adjustments WHERE status = 'PENDING_APPROVAL'`),
      query<{ cnt: string }>(`SELECT count(*) as cnt FROM warehouse_transfers WHERE status IN ('DISPATCHED', 'IN_TRANSIT')`),
    ]);

    let totalAvailableQty = 0;
    let totalReservedQty = 0;
    let totalQuarantineQty = 0;
    let totalDamagedQty = 0;
    let totalInTransitQty = 0;

    const availByMat = new Map<number, number>();
    for (const b of balances) {
      const onHand = Number(b.qty_on_hand);
      const reserved = Number(b.qty_reserved);
      const avail = Number(b.qty_available);

      if (b.stock_status === 'AVAILABLE') {
        totalAvailableQty += avail;
        totalReservedQty += reserved;
        availByMat.set(b.material_id, (availByMat.get(b.material_id) || 0) + avail);
      } else if (b.stock_status === 'QUARANTINE' || b.stock_status === 'HOLD') {
        totalQuarantineQty += onHand;
      } else if (b.stock_status === 'DAMAGED' || b.stock_status === 'SCRAP') {
        totalDamagedQty += onHand;
      } else if (b.stock_status === 'IN_TRANSIT') {
        totalInTransitQty += onHand;
      }
    }

    const totalGlobalValuation = materialsRes.rows.reduce(
      (sum, m) => sum + Number(m.total_inventory_value || 0),
      0
    );

    const lowStockMaterials = materialsRes.rows.filter((m) => {
      const rl = Number(m.reorder_level || 0);
      if (rl <= 0) return false;
      const qty = availByMat.get(m.id) || 0;
      return qty <= rl;
    });

    const canViewValuation = actor.permissions.includes('warehouse:reports:valuation');

    return {
      active_materials_count: materialsRes.rowCount,
      total_available_qty: roundQty(totalAvailableQty),
      total_reserved_qty: roundQty(totalReservedQty),
      total_quarantine_qty: roundQty(totalQuarantineQty),
      total_damaged_qty: roundQty(totalDamagedQty),
      total_in_transit_qty: roundQty(totalInTransitQty),
      total_global_valuation: canViewValuation ? roundQty(totalGlobalValuation) : undefined,
      low_stock_count: lowStockMaterials.length,
      pending_qc_lines_count: parseInt(String(pendingQcRes.rows[0]?.cnt || '0'), 10),
      pending_requisition_approvals: parseInt(String(pendingReqsRes.rows[0]?.cnt || '0'), 10),
      pending_adjustment_approvals: parseInt(String(pendingAdjRes.rows[0]?.cnt || '0'), 10),
      in_transit_transfers_count: parseInt(String(inTransitRes.rows[0]?.cnt || '0'), 10),
    };
  }

  static async getInventoryValuation(): Promise<any> {
    const res = await query<any>(
      `SELECT m.id, m.sku, m.name, m.base_uom, mc.category_code, mc.category_type,
              m.weighted_avg_cost, m.total_valued_qty, m.total_inventory_value, m.last_cost_updated_at
       FROM materials m
       JOIN material_categories mc ON m.category_id = mc.id
       WHERE m.status = 'active'
       ORDER BY m.sku ASC`
    );
    const totalValuation = roundQty(
      res.rows.reduce((sum, r) => sum + Number(r.total_inventory_value || 0), 0)
    );
    return {
      valuation_method: 'GLOBAL_WEIGHTED_AVERAGE_COST',
      total_inventory_value: totalValuation,
      materials: res.rows,
    };
  }

  static async reconcileLedger(warehouseId?: number, materialId?: number) {
    return InventoryEngineService.reconcileBalancesVsMovements({ warehouseId, materialId });
  }

  // ============================================================================
  // 5.14 In-App Notifications
  // ============================================================================
  static async listNotifications(
    actor: WarehouseActor,
    filter?: { unread_only?: boolean; warehouse_id?: number; limit?: number }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `SELECT * FROM warehouse_notifications WHERE 1=1`;

    if (filter?.unread_only) {
      sql += ` AND is_read = FALSE`;
    }
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND warehouse_id = $${params.length}`;
    }

    const limit = Math.min(Math.max(filter?.limit || 100, 1), 300);
    params.push(limit);
    sql += ` ORDER BY is_read ASC, created_at DESC, id DESC LIMIT $${params.length}`;

    const res = await query<any>(sql, params);
    const roleSet = new Set(actor.roles);
    const whSet = new Set(actor.managed_warehouse_ids);

    return res.rows.filter((n) => {
      if (n.recipient_user_id !== null && n.recipient_user_id === actor.id) return true;
      const roleMatch = !n.target_role_name || roleSet.has(n.target_role_name) || actor.roles.includes('Factory Manager') || actor.roles.includes('System Administrator');
      if (!roleMatch) return false;
      if (n.warehouse_id !== null && !isGlobal && !whSet.has(n.warehouse_id)) return false;
      return true;
    });
  }

  static async markNotificationRead(notificationId: number, actor: WarehouseActor): Promise<any> {
    const res = await query<any>(
      `UPDATE warehouse_notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 RETURNING *`,
      [notificationId]
    );
    if (res.rowCount === 0) throw notFound(`Notification #${notificationId} not found`);

    await AuditService.log({
      userId: actor.id,
      action: 'WMS_NOTIFICATION_READ',
      entityType: 'WAREHOUSE_NOTIFICATION',
      entityId: notificationId,
      ipAddress: actor.ipAddress,
    });
    return res.rows[0];
  }

  static async generateDelayedTransferAlerts(maxHoursInTransit: number, actor: WarehouseActor): Promise<any[]> {
    const hours = parseNonNegativeNumber(maxHoursInTransit, 'max_hours_in_transit', 24);
    return withTransaction(async (txQuery) => {
      const delayedRes = await txQuery<any>(
        `SELECT id, transfer_number, source_warehouse_id, target_warehouse_id, dispatched_at
         FROM warehouse_transfers
         WHERE status IN ('DISPATCHED', 'IN_TRANSIT') AND dispatched_at IS NOT NULL`
      );
      const cutoff = Date.now() - hours * 3600 * 1000;
      const createdAlerts: any[] = [];

      for (const trf of delayedRes.rows) {
        const dispatchedMs = new Date(trf.dispatched_at).getTime();
        if (dispatchedMs <= cutoff) {
          const dup = await txQuery<{ cnt: string }>(
            `SELECT count(*) as cnt FROM warehouse_notifications
             WHERE entity_type = 'WAREHOUSE_TRANSFER' AND entity_id = $1
               AND notification_type = 'TRANSFER_DELAYED' AND is_read = FALSE`,
            [String(trf.id)]
          );
          if (parseInt(String(dup.rows[0]?.cnt || '0'), 10) === 0) {
            await InventoryEngineService.createNotification(txQuery, {
              targetRoleName: 'Warehouse Manager',
              warehouseId: trf.target_warehouse_id,
              notificationType: 'TRANSFER_DELAYED',
              severity: 'WARNING',
              title: `Delayed In-Transit Transfer: ${trf.transfer_number}`,
              message: `Transfer ${trf.transfer_number} has been in transit past ${hours}h threshold.`,
              entityType: 'WAREHOUSE_TRANSFER',
              entityId: trf.id,
            });
            createdAlerts.push(trf);
          }
        }
      }

      if (createdAlerts.length > 0) {
        await AuditService.log(
          {
            userId: actor.id,
            action: 'WMS_DELAYED_TRANSFER_SCAN',
            entityType: 'WAREHOUSE_NOTIFICATION',
            details: { alerts_created: createdAlerts.length },
            ipAddress: actor.ipAddress,
          },
          txQuery
        );
      }
      return createdAlerts;
    });
  }
}
