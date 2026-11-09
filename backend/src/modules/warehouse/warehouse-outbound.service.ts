import { query, QueryFn, withTransaction } from '../../config/database.ts';
import { hasGlobalWarehouseAccess } from '../../middleware/auth.middleware.ts';
import { AuditService } from '../audit/audit.service.ts';
import { InventoryEngineService } from './inventory-engine.service.ts';
import {
  badRequest,
  conflict,
  forbidden,
  generateDocRef,
  notFound,
  parseEnumValue,
  parsePositiveInt,
  parsePositiveNumber,
  roundQty,
} from './warehouse.errors.ts';
import { RETURN_CONDITIONS, ReturnCondition, WarehouseActor } from './warehouse.types.ts';

export class WarehouseOutboundService {
  private static assertActorCanAccessRequisition(actor: WarehouseActor, reqRow: any): void {
    const isGlobal =
      actor.roles.includes('Factory Manager') ||
      actor.roles.includes('Production Manager') ||
      actor.roles.includes('System Administrator');
    if (isGlobal) return;

    if (actor.managed_department_ids.includes(reqRow.department_id)) return;
    if (reqRow.production_line_id && actor.supervised_line_ids.includes(reqRow.production_line_id)) return;
    if (
      ['APPROVED', 'PARTIALLY_ISSUED', 'FULFILLED'].includes(reqRow.status) &&
      actor.managed_warehouse_ids.includes(reqRow.warehouse_id)
    ) {
      return;
    }

    throw forbidden(`Requisition #${reqRow.id} is outside your department, line, or warehouse scope`);
  }

  // ============================================================================
  // 5.6 Material Requisitions (DEC-06)
  // ============================================================================
  static async listRequisitions(
    actor: WarehouseActor,
    filter?: { status?: string; warehouse_id?: number; department_id?: number; production_line_id?: number }
  ): Promise<any[]> {
    const params: any[] = [];
    let sql = `
      SELECT r.*, d.dept_code, d.name as department_name,
             pl.line_number, pl.name as line_name,
             w.warehouse_code, w.name as warehouse_name,
             ru.username as requested_by_username, au.username as approved_by_username
      FROM material_requisitions r
      JOIN departments d ON r.department_id = d.id
      LEFT JOIN production_lines pl ON r.production_line_id = pl.id
      JOIN warehouses w ON r.warehouse_id = w.id
      JOIN users ru ON r.requested_by = ru.id
      LEFT JOIN users au ON r.approved_by = au.id
      WHERE 1=1
    `;
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND r.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.department_id) {
      params.push(filter.department_id);
      sql += ` AND r.department_id + 0 = $${params.length}`;
    }
    if (filter?.production_line_id) {
      params.push(filter.production_line_id);
      sql += ` AND r.production_line_id + 0 = $${params.length}`;
    }
    sql += ` ORDER BY r.id DESC`;

    const res = await query<any>(sql, params);
    const isGlobal =
      actor.roles.includes('Factory Manager') ||
      actor.roles.includes('Production Manager') ||
      actor.roles.includes('System Administrator');

    return res.rows.filter((r) => {
      if (isGlobal) return true;
      if (actor.managed_department_ids.includes(r.department_id)) return true;
      if (r.production_line_id && actor.supervised_line_ids.includes(r.production_line_id)) return true;
      if (
        ['APPROVED', 'PARTIALLY_ISSUED', 'FULFILLED'].includes(r.status) &&
        actor.managed_warehouse_ids.includes(r.warehouse_id)
      ) {
        return true;
      }
      return false;
    });
  }

  static async getRequisitionById(requisitionId: number, actor: WarehouseActor): Promise<any> {
    const reqRes = await query<any>(
      `SELECT r.*, d.dept_code, d.name as department_name,
              pl.line_number, pl.name as line_name,
              w.warehouse_code, w.name as warehouse_name,
              ru.username as requested_by_username, au.username as approved_by_username
       FROM material_requisitions r
       JOIN departments d ON r.department_id = d.id
       LEFT JOIN production_lines pl ON r.production_line_id = pl.id
       JOIN warehouses w ON r.warehouse_id = w.id
       JOIN users ru ON r.requested_by = ru.id
       LEFT JOIN users au ON r.approved_by = au.id
       WHERE r.id = $1`,
      [requisitionId]
    );
    if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
    const requisition = reqRes.rows[0];
    this.assertActorCanAccessRequisition(actor, requisition);

    const itemsRes = await query<any>(
      `SELECT ri.*, m.sku, m.name as material_name, m.base_uom,
              lot.lot_number, lot.roll_number
       FROM material_requisition_items ri
       JOIN materials m ON ri.material_id = m.id
       LEFT JOIN inventory_lots lot ON ri.preferred_lot_id = lot.id
       WHERE ri.requisition_id + 0 = $1
       ORDER BY ri.id ASC`,
      [requisitionId]
    );

    return { requisition, items: itemsRes.rows };
  }

  static async createRequisition(
    dto: {
      department_id: number;
      production_line_id?: number | null;
      warehouse_id: number;
      reference_type?: string | null;
      reference_code?: string | null;
      required_date?: string | null;
      notes?: string | null;
      items?: any[];
    },
    actor: WarehouseActor
  ): Promise<any> {
    const departmentId = parsePositiveInt(dto.department_id, 'department_id');
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const lineId =
      dto.production_line_id !== undefined && dto.production_line_id !== null
        ? parsePositiveInt(dto.production_line_id, 'production_line_id')
        : null;

    return withTransaction(async (txQuery) => {
      const [deptRes, whRes] = await Promise.all([
        txQuery<any>(`SELECT id, status FROM departments WHERE id = $1`, [departmentId]),
        txQuery<any>(`SELECT id, status FROM warehouses WHERE id = $1`, [warehouseId]),
      ]);
      if (deptRes.rowCount === 0) throw notFound(`Department #${departmentId} not found`);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);
      if (whRes.rows[0].status !== 'active') throw badRequest(`Warehouse #${warehouseId} is inactive`);

      if (lineId !== null) {
        const lineRes = await txQuery<any>(`SELECT id, department_id FROM production_lines WHERE id = $1`, [lineId]);
        if (lineRes.rowCount === 0) throw notFound(`Production line #${lineId} not found`);
        if (lineRes.rows[0].department_id !== null && lineRes.rows[0].department_id !== departmentId) {
          throw badRequest(`Production line #${lineId} does not belong to Department #${departmentId}`);
        }
      }

      const reqNumber = generateDocRef('REQ');
      const ins = await txQuery<any>(
        `INSERT INTO material_requisitions (
           requisition_number, department_id, production_line_id, warehouse_id,
           reference_type, reference_code, required_date, status, requested_by, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'DRAFT', $8, $9)
         RETURNING *`,
        [
          reqNumber,
          departmentId,
          lineId,
          warehouseId,
          dto.reference_type ?? null,
          dto.reference_code ?? null,
          dto.required_date ?? null,
          actor.id,
          dto.notes ?? null,
        ]
      );
      const reqRow = ins.rows[0];
      const addedItems: any[] = [];

      if (Array.isArray(dto.items) && dto.items.length > 0) {
        for (const itemDto of dto.items) {
          addedItems.push(await this.insertRequisitionItemTx(txQuery, reqRow.id, itemDto));
        }
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_CREATE',
          entityType: 'MATERIAL_REQUISITION',
          entityId: reqRow.id,
          details: { requisition_number: reqNumber, department_id: departmentId, warehouse_id: warehouseId },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { requisition: reqRow, items: addedItems };
    });
  }

  static async addRequisitionItem(requisitionId: number, itemDto: any, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];
      this.assertActorCanAccessRequisition(actor, reqRow);

      if (reqRow.status !== 'DRAFT') {
        throw conflict(`Cannot add items when requisition is in status "${reqRow.status}"`);
      }

      const item = await this.insertRequisitionItemTx(txQuery, requisitionId, itemDto);
      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_ITEM_ADD',
          entityType: 'MATERIAL_REQUISITION',
          entityId: requisitionId,
          details: { item_id: item.id, material_id: item.material_id, requested_qty: item.requested_qty },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );
      return item;
    });
  }

  private static async insertRequisitionItemTx(txQuery: QueryFn, requisitionId: number, itemDto: any): Promise<any> {
    const materialId = parsePositiveInt(itemDto.material_id, 'material_id');
    const requestedQty = parsePositiveNumber(itemDto.requested_qty, 'requested_qty');
    const preferredLotId =
      itemDto.preferred_lot_id !== undefined && itemDto.preferred_lot_id !== null
        ? parsePositiveInt(itemDto.preferred_lot_id, 'preferred_lot_id')
        : null;

    const matRes = await txQuery<any>(`SELECT id, status FROM materials WHERE id = $1`, [materialId]);
    if (matRes.rowCount === 0) throw notFound(`Material #${materialId} not found`);
    if (matRes.rows[0].status !== 'active') throw badRequest(`Material #${materialId} is inactive`);

    if (preferredLotId !== null) {
      const lotRes = await txQuery<any>(`SELECT id, material_id FROM inventory_lots WHERE id = $1`, [preferredLotId]);
      if (lotRes.rowCount === 0) throw notFound(`Preferred Lot #${preferredLotId} not found`);
      if (lotRes.rows[0].material_id !== materialId) {
        throw badRequest(`Preferred Lot #${preferredLotId} does not belong to Material #${materialId}`);
      }
    }

    const ins = await txQuery<any>(
      `INSERT INTO material_requisition_items (requisition_id, material_id, preferred_lot_id, requested_qty, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [requisitionId, materialId, preferredLotId, requestedQty, itemDto.notes ?? null]
    );
    return ins.rows[0];
  }

  static async submitRequisition(requisitionId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];
      this.assertActorCanAccessRequisition(actor, reqRow);

      if (reqRow.status !== 'DRAFT') {
        throw conflict(`Requisition must be DRAFT to submit (current: ${reqRow.status})`);
      }

      const itemsRes = await txQuery<{ cnt: string }>(
        `SELECT count(*) as cnt FROM material_requisition_items WHERE requisition_id = $1`,
        [requisitionId]
      );
      if (parseInt(String(itemsRes.rows[0]?.cnt || '0'), 10) === 0) {
        throw badRequest('Cannot submit an empty requisition');
      }

      const upd = await txQuery<any>(
        `UPDATE material_requisitions SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [requisitionId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Production Manager',
        warehouseId: reqRow.warehouse_id,
        notificationType: 'APPROVAL_REQUIRED',
        severity: 'INFO',
        title: `Requisition Approval Needed: ${reqRow.requisition_number}`,
        message: `Material requisition ${reqRow.requisition_number} is submitted and awaiting manager approval.`,
        entityType: 'MATERIAL_REQUISITION',
        entityId: requisitionId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_SUBMIT',
          entityType: 'MATERIAL_REQUISITION',
          entityId: requisitionId,
          details: { requisition_number: reqRow.requisition_number },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  /**
   * Approve Material Requisition (DEC-06): atomically reserves AVAILABLE stock before issuing.
   */
  static async approveRequisition(requisitionId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];

      const isGlobalApprover =
        actor.roles.includes('Factory Manager') || actor.roles.includes('Production Manager');
      if (!isGlobalApprover && !actor.managed_department_ids.includes(reqRow.department_id)) {
        throw forbidden(
          `Department Manager cannot approve requisition for Department #${reqRow.department_id}`
        );
      }

      if (reqRow.status !== 'SUBMITTED') {
        throw conflict(`Requisition must be SUBMITTED for approval (current: ${reqRow.status})`);
      }

      const itemsRes = await txQuery<any>(
        `SELECT * FROM material_requisition_items WHERE requisition_id = $1 ORDER BY id ASC FOR UPDATE`,
        [requisitionId]
      );
      if (itemsRes.rowCount === 0) throw badRequest('Requisition has no items');

      // Reserve AVAILABLE stock per line inside transaction
      for (const item of itemsRes.rows) {
        const qty = roundQty(Number(item.requested_qty));
        await InventoryEngineService.reserveAvailableStock(txQuery, {
          warehouseId: reqRow.warehouse_id,
          materialId: item.material_id,
          qtyToReserve: qty,
          preferredLotId: item.preferred_lot_id,
        });

        await txQuery(
          `UPDATE material_requisition_items SET reserved_qty = $1 WHERE id = $2`,
          [qty, item.id]
        );
      }

      const upd = await txQuery<any>(
        `UPDATE material_requisitions
         SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [actor.id, requisitionId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Warehouse Keeper',
        warehouseId: reqRow.warehouse_id,
        notificationType: 'GENERAL',
        severity: 'INFO',
        title: `Approved Requisition Ready to Pick: ${reqRow.requisition_number}`,
        message: `Requisition ${reqRow.requisition_number} is approved and stock has been reserved for picking.`,
        entityType: 'MATERIAL_REQUISITION',
        entityId: requisitionId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_APPROVE',
          entityType: 'MATERIAL_REQUISITION',
          entityId: requisitionId,
          details: { requisition_number: reqRow.requisition_number, reserved_lines: itemsRes.rowCount },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async rejectRequisition(requisitionId: number, reason: string | undefined, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];

      const isGlobalApprover =
        actor.roles.includes('Factory Manager') || actor.roles.includes('Production Manager');
      if (!isGlobalApprover && !actor.managed_department_ids.includes(reqRow.department_id)) {
        throw forbidden(`Not authorized to reject requisition for Department #${reqRow.department_id}`);
      }

      if (reqRow.status !== 'SUBMITTED') {
        throw conflict(`Only SUBMITTED requisitions can be rejected (current: ${reqRow.status})`);
      }

      const upd = await txQuery<any>(
        `UPDATE material_requisitions
         SET status = 'REJECTED', approved_by = $1, approved_at = NOW(),
             notes = COALESCE(notes || ' | ', '') || $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [actor.id, reason ? `Rejected: ${reason}` : 'Rejected', requisitionId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        recipientUserId: reqRow.requested_by,
        warehouseId: reqRow.warehouse_id,
        notificationType: 'GENERAL',
        severity: 'WARNING',
        title: `Requisition Rejected: ${reqRow.requisition_number}`,
        message: reason || `Requisition ${reqRow.requisition_number} was rejected.`,
        entityType: 'MATERIAL_REQUISITION',
        entityId: requisitionId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_REJECT',
          entityType: 'MATERIAL_REQUISITION',
          entityId: requisitionId,
          details: { requisition_number: reqRow.requisition_number, reason: reason ?? null },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async cancelRequisition(requisitionId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];
      this.assertActorCanAccessRequisition(actor, reqRow);

      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(reqRow.status)) {
        throw conflict(`Cannot cancel requisition in status "${reqRow.status}"`);
      }

      if (reqRow.status === 'APPROVED') {
        const itemsRes = await txQuery<any>(
          `SELECT * FROM material_requisition_items WHERE requisition_id = $1 FOR UPDATE`,
          [requisitionId]
        );
        for (const item of itemsRes.rows) {
          const unissuedReserved = roundQty(Math.max(0, Number(item.reserved_qty) - Number(item.issued_qty)));
          if (unissuedReserved > 0) {
            await InventoryEngineService.releaseReservedStock(txQuery, {
              warehouseId: reqRow.warehouse_id,
              materialId: item.material_id,
              qtyToRelease: unissuedReserved,
            });
            await txQuery(
              `UPDATE material_requisition_items SET reserved_qty = issued_qty WHERE id = $1`,
              [item.id]
            );
          }
        }
      }

      const upd = await txQuery<any>(
        `UPDATE material_requisitions SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [requisitionId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REQUISITION_CANCEL',
          entityType: 'MATERIAL_REQUISITION',
          entityId: requisitionId,
          details: { requisition_number: reqRow.requisition_number },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  // ============================================================================
  // 5.7 Stock Issuing (Advisory FIFO + Mandatory Reason Override)
  // ============================================================================
  static async listIssues(actor: WarehouseActor, warehouseId?: number): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT si.*, r.requisition_number, w.warehouse_code, d.dept_code, u.username as issued_by_username
      FROM stock_issues si
      JOIN material_requisitions r ON si.requisition_id = r.id
      JOIN warehouses w ON si.warehouse_id = w.id
      JOIN departments d ON si.department_id = d.id
      JOIN users u ON si.issued_by = u.id
      WHERE 1=1
    `;
    if (warehouseId) {
      params.push(warehouseId);
      sql += ` AND si.warehouse_id + 0 = $${params.length}`;
    }
    sql += ` ORDER BY si.id DESC`;
    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async getIssueById(issueId: number, actor: WarehouseActor): Promise<any> {
    const issRes = await query<any>(
      `SELECT si.*, r.requisition_number, w.warehouse_code, w.name as warehouse_name,
              d.dept_code, d.name as department_name, u.username as issued_by_username
       FROM stock_issues si
       JOIN material_requisitions r ON si.requisition_id = r.id
       JOIN warehouses w ON si.warehouse_id = w.id
       JOIN departments d ON si.department_id = d.id
       JOIN users u ON si.issued_by = u.id
       WHERE si.id = $1`,
      [issueId]
    );
    if (issRes.rowCount === 0) throw notFound(`Stock Issue #${issueId} not found`);
    const issue = issRes.rows[0];

    const isGlobal =
      hasGlobalWarehouseAccess(actor as any) ||
      actor.managed_department_ids.includes(issue.department_id) ||
      (issue.production_line_id && actor.supervised_line_ids.includes(issue.production_line_id)) ||
      actor.managed_warehouse_ids.includes(issue.warehouse_id);

    if (!isGlobal) {
      throw forbidden(`Stock Issue #${issueId} is outside your assigned scope`);
    }

    const itemsRes = await query<any>(
      `SELECT sii.*, m.sku, m.name as material_name, m.base_uom,
              l.location_code, lot.lot_number, lot.roll_number
       FROM stock_issue_items sii
       JOIN materials m ON sii.material_id = m.id
       JOIN warehouse_locations l ON sii.location_id = l.id
       LEFT JOIN inventory_lots lot ON sii.lot_id = lot.id
       WHERE sii.issue_id + 0 = $1
       ORDER BY sii.id ASC`,
      [issueId]
    );

    return { issue, items: itemsRes.rows };
  }

  static async issueStock(
    dto: {
      requisition_id: number;
      received_by?: number | null;
      notes?: string | null;
      items: Array<{
        requisition_item_id: number;
        location_id?: number | null;
        lot_id?: number | null;
        issued_qty: number;
        fifo_override_reason?: string | null;
      }>;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const requisitionId = parsePositiveInt(dto.requisition_id, 'requisition_id');
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw badRequest('At least one issue line item is required');
    }

    return withTransaction(async (txQuery) => {
      const reqRes = await txQuery<any>(`SELECT * FROM material_requisitions WHERE id = $1 FOR UPDATE`, [requisitionId]);
      if (reqRes.rowCount === 0) throw notFound(`Requisition #${requisitionId} not found`);
      const reqRow = reqRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(reqRow.warehouse_id)) {
        throw forbidden(`Access denied. Warehouse #${reqRow.warehouse_id} is outside your scope`);
      }

      if (reqRow.status !== 'APPROVED' && reqRow.status !== 'PARTIALLY_ISSUED') {
        throw conflict(
          `Cannot issue stock against requisition ${reqRow.requisition_number} in status "${reqRow.status}". Manager approval is required before issuing.`,
          'REQUISITION_NOT_APPROVED'
        );
      }

      const issueNumber = generateDocRef('ISS');
      const issueIns = await txQuery<any>(
        `INSERT INTO stock_issues (
           issue_number, requisition_id, warehouse_id, department_id, production_line_id,
           status, issued_by, received_by, posted_at, notes
         ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, $7, NOW(), $8)
         RETURNING *`,
        [
          issueNumber,
          reqRow.id,
          reqRow.warehouse_id,
          reqRow.department_id,
          reqRow.production_line_id,
          actor.id,
          dto.received_by ?? null,
          dto.notes ?? null,
        ]
      );
      const issueRow = issueIns.rows[0];

      const fifoRequiresReasonSetting = await InventoryEngineService.getSettingValue(txQuery, 'fifo_override_requires_reason');
      const enforceFifoOverrideReason = fifoRequiresReasonSetting !== 'false';

      const postedItems: any[] = [];
      const movements: any[] = [];
      const fifoOverridesLogged: any[] = [];

      for (const itemDto of dto.items) {
        const reqItemId = parsePositiveInt(itemDto.requisition_item_id, 'requisition_item_id');
        const issuedQty = parsePositiveNumber(itemDto.issued_qty, 'issued_qty');

        const reqItemRes = await txQuery<any>(
          `SELECT * FROM material_requisition_items WHERE id = $1 AND requisition_id = $2 FOR UPDATE`,
          [reqItemId, reqRow.id]
        );
        if (reqItemRes.rowCount === 0) {
          throw notFound(`Requisition item #${reqItemId} not found on Requisition #${reqRow.id}`);
        }
        const reqItem = reqItemRes.rows[0];

        const remainingReqQty = roundQty(Number(reqItem.requested_qty) - Number(reqItem.issued_qty));
        if (issuedQty > remainingReqQty) {
          throw conflict(
            `Issue quantity (${issuedQty}) exceeds remaining requisition quantity (${remainingReqQty}) for Material #${reqItem.material_id}`,
            'REQUISITION_QTY_EXCEEDED'
          );
        }

        const { location } = await InventoryEngineService.resolveLocationForWarehouse(
          txQuery,
          reqRow.warehouse_id,
          itemDto.location_id !== undefined && itemDto.location_id !== null
            ? parsePositiveInt(itemDto.location_id, 'location_id')
            : null
        );

        const lotId =
          itemDto.lot_id !== undefined && itemDto.lot_id !== null
            ? parsePositiveInt(itemDto.lot_id, 'lot_id')
            : null;

        const matRes = await txQuery<any>(`SELECT * FROM materials WHERE id = $1`, [reqItem.material_id]);
        const mat = matRes.rows[0];
        if ((mat.is_lot_tracked || mat.is_roll_tracked) && lotId === null) {
          throw badRequest(`Material ${mat.sku} is lot/roll tracked and requires lot_id when issuing`);
        }

        // Advisory FIFO check (DEC-04)
        let fifoOverridden = false;
        const overrideReason = itemDto.fifo_override_reason ? String(itemDto.fifo_override_reason).trim() : '';

        if (lotId !== null) {
          const selLotRes = await txQuery<any>(
            `SELECT id, material_id, received_at FROM inventory_lots WHERE id = $1`,
            [lotId]
          );
          if (selLotRes.rowCount === 0) throw notFound(`Lot #${lotId} not found`);
          const selLot = selLotRes.rows[0];
          if (selLot.material_id !== reqItem.material_id) {
            throw badRequest(`Lot #${lotId} does not belong to Material #${reqItem.material_id}`);
          }

          // Check if any older AVAILABLE lot exists in same warehouse with positive stock
          const availBalRes = await txQuery<{ lot_id: number | null; qty_on_hand: string }>(
            `SELECT lot_id, qty_on_hand
             FROM inventory_balances
             WHERE warehouse_id = $1
               AND material_id = $2
               AND stock_status = 'AVAILABLE'`,
            [reqRow.warehouse_id, reqItem.material_id]
          );

          const candidateLotIds = availBalRes.rows
            .filter((r) => r.lot_id !== null && r.lot_id !== lotId && Number(r.qty_on_hand) > 0)
            .map((r) => r.lot_id as number);

          const selTime = new Date(selLot.received_at).getTime();
          let olderAvailable: Array<{ id: number; lot_number: string; received_at: any }> = [];

          if (candidateLotIds.length > 0) {
            const candidateSet = new Set(candidateLotIds);
            const matLotsRes = await txQuery<{ id: number; lot_number: string; received_at: any }>(
              `SELECT id, lot_number, received_at FROM inventory_lots WHERE material_id = $1`,
              [reqItem.material_id]
            );
            olderAvailable = matLotsRes.rows.filter(
              (l) => candidateSet.has(l.id) && new Date(l.received_at).getTime() < selTime
            );
          }

          if (olderAvailable.length > 0) {
            fifoOverridden = true;
            if (enforceFifoOverrideReason && !overrideReason) {
              throw badRequest(
                `FIFO advisory alert: older lot (${olderAvailable[0].lot_number}) exists in Warehouse #${reqRow.warehouse_id}. Supply fifo_override_reason to override FIFO order (DEC-04).`,
                'FIFO_OVERRIDE_REASON_REQUIRED'
              );
            }
          }
        }

        // Determine reservation consumption vs unreserved allowance cleanly
        const lotKey = lotId !== null ? String(lotId) : 'NONE';
        const targetBalRes = await txQuery<any>(
          `SELECT id, qty_on_hand, qty_reserved, qty_available
           FROM inventory_balances
           WHERE warehouse_id = $1 AND location_id = $2 AND material_id = $3 AND lot_key = $4 AND stock_status = 'AVAILABLE'
           FOR UPDATE`,
          [reqRow.warehouse_id, location.id, reqItem.material_id, lotKey]
        );
        if (targetBalRes.rowCount === 0) {
          throw conflict(
            `No AVAILABLE balance found for Material ${mat.sku} at Location ${location.location_code}${lotId ? ` Lot #${lotId}` : ''}`,
            'INSUFFICIENT_STOCK'
          );
        }

        const targetBal = targetBalRes.rows[0];
        const remainingReservedForItem = roundQty(Math.max(0, Number(reqItem.reserved_qty) - Number(reqItem.issued_qty)));
        const directReservedConsumed = roundQty(
          Math.min(issuedQty, remainingReservedForItem, Number(targetBal.qty_reserved))
        );
        const shiftReservedNeeded = roundQty(Math.max(0, Math.min(issuedQty, remainingReservedForItem) - directReservedConsumed));

        // If reserved stock was allocated on another lot/bin (e.g. FIFO override), ensure target bin has unreserved available qty
        if (shiftReservedNeeded > 0) {
          if (roundQty(Number(targetBal.qty_available)) < shiftReservedNeeded) {
            throw conflict(
              `Target location/lot only has ${targetBal.qty_available} unreserved available; cannot steal another requisition's reservation`,
              'INSUFFICIENT_AVAILABLE_STOCK'
            );
          }
          await InventoryEngineService.releaseReservedStock(txQuery, {
            warehouseId: reqRow.warehouse_id,
            materialId: reqItem.material_id,
            qtyToRelease: shiftReservedNeeded,
            excludeBalanceId: targetBal.id,
          });
        }

        const wacOut = await InventoryEngineService.applyGlobalWacOutbound(txQuery, {
          materialId: reqItem.material_id,
          outgoingQty: issuedQty,
        });

        const balChange = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: reqRow.warehouse_id,
          locationId: location.id,
          materialId: reqItem.material_id,
          lotId,
          stockStatus: 'AVAILABLE',
          direction: 'OUT',
          movementType: 'ISSUE',
          quantity: issuedQty,
          unitCost: wacOut.unit_cost,
          consumeReservedQty: directReservedConsumed,
          enforceAvailableOnlyCheck: true,
          sourceWarehouseId: reqRow.warehouse_id,
          sourceLocationId: location.id,
          sourceDocumentType: 'STOCK_ISSUE',
          sourceDocumentId: issueRow.id,
          sourceDocumentRef: issueNumber,
          actorId: actor.id,
          notes: fifoOverridden ? `Issued with FIFO override: ${overrideReason}` : `Issued against ${reqRow.requisition_number}`,
        });
        movements.push(balChange.movement);

        if (lotId !== null) {
          const lotQtyRes = await txQuery<{ remaining_qty: string }>(
            `SELECT remaining_qty FROM inventory_lots WHERE id = $1 FOR UPDATE`,
            [lotId]
          );
          const nextLotRem = roundQty(Math.max(0, Number(lotQtyRes.rows[0].remaining_qty) - issuedQty));
          await txQuery(`UPDATE inventory_lots SET remaining_qty = $1, updated_at = NOW() WHERE id = $2`, [nextLotRem, lotId]);
        }

        const issueItemIns = await txQuery<any>(
          `INSERT INTO stock_issue_items (
             issue_id, requisition_item_id, warehouse_id, location_id, material_id, lot_id,
             issued_qty, unit_cost, fifo_overridden, fifo_override_reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            issueRow.id,
            reqItem.id,
            reqRow.warehouse_id,
            location.id,
            reqItem.material_id,
            lotId,
            issuedQty,
            wacOut.unit_cost,
            fifoOverridden,
            fifoOverridden ? overrideReason : null,
          ]
        );
        postedItems.push(issueItemIns.rows[0]);

        if (fifoOverridden) {
          fifoOverridesLogged.push({
            material_id: reqItem.material_id,
            lot_id: lotId,
            reason: overrideReason,
          });
        }

        await txQuery(
          `UPDATE material_requisition_items SET issued_qty = issued_qty + $1 WHERE id = $2`,
          [issuedQty, reqItem.id]
        );

        await InventoryEngineService.checkLowStockAndNotify(txQuery, reqRow.warehouse_id, reqItem.material_id);
      }

      // Check whether requisition is now PARTIALLY_ISSUED or FULFILLED
      const updatedReqItems = await txQuery<{ requested_qty: string; issued_qty: string }>(
        `SELECT requested_qty, issued_qty FROM material_requisition_items WHERE requisition_id = $1`,
        [reqRow.id]
      );
      const allFulfilled = updatedReqItems.rows.every(
        (r) => roundQty(Number(r.issued_qty)) >= roundQty(Number(r.requested_qty))
      );
      const nextReqStatus = allFulfilled ? 'FULFILLED' : 'PARTIALLY_ISSUED';

      await txQuery(
        `UPDATE material_requisitions SET status = $1, updated_at = NOW() WHERE id = $2`,
        [nextReqStatus, reqRow.id]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_ISSUE',
          entityType: 'STOCK_ISSUE',
          entityId: issueRow.id,
          details: {
            issue_number: issueNumber,
            requisition_id: reqRow.id,
            requisition_status: nextReqStatus,
            fifo_overrides: fifoOverridesLogged,
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return {
        issue: issueRow,
        items: postedItems,
        movements,
        requisition_status: nextReqStatus,
      };
    });
  }

  // ============================================================================
  // 5.8 Material Returns, Waste & Damage
  // ============================================================================
  static async listReturns(actor: WarehouseActor, warehouseId?: number): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT mr.*, d.dept_code, w.warehouse_code, m.sku, m.name as material_name,
             lot.lot_number, lot.roll_number
      FROM material_returns mr
      JOIN departments d ON mr.department_id = d.id
      JOIN warehouses w ON mr.warehouse_id = w.id
      JOIN materials m ON mr.material_id = m.id
      LEFT JOIN inventory_lots lot ON mr.lot_id = lot.id
      WHERE 1=1
    `;
    if (warehouseId) {
      params.push(warehouseId);
      sql += ` AND mr.warehouse_id + 0 = $${params.length}`;
    }
    sql += ` ORDER BY mr.id DESC`;
    const res = await query<any>(sql, params);
    const whSet = new Set(actor.managed_warehouse_ids);
    const deptSet = new Set(actor.managed_department_ids);
    return res.rows.filter(
      (r) =>
        isGlobal ||
        whSet.has(r.warehouse_id) ||
        deptSet.has(r.department_id) ||
        (r.production_line_id && actor.supervised_line_ids.includes(r.production_line_id))
    );
  }

  static async createAndPostReturn(
    dto: {
      department_id: number;
      production_line_id?: number | null;
      stock_issue_id?: number | null;
      warehouse_id: number;
      target_location_id?: number | null;
      material_id: number;
      lot_id?: number | null;
      returned_qty: number;
      return_condition: ReturnCondition;
      notes?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const departmentId = parsePositiveInt(dto.department_id, 'department_id');
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const materialId = parsePositiveInt(dto.material_id, 'material_id');
    const returnedQty = parsePositiveNumber(dto.returned_qty, 'returned_qty');
    const condition = parseEnumValue(dto.return_condition, RETURN_CONDITIONS, 'return_condition');
    const lineId =
      dto.production_line_id !== undefined && dto.production_line_id !== null
        ? parsePositiveInt(dto.production_line_id, 'production_line_id')
        : null;
    const stockIssueId =
      dto.stock_issue_id !== undefined && dto.stock_issue_id !== null
        ? parsePositiveInt(dto.stock_issue_id, 'stock_issue_id')
        : null;
    const lotId =
      dto.lot_id !== undefined && dto.lot_id !== null ? parsePositiveInt(dto.lot_id, 'lot_id') : null;

    const targetStockStatus =
      condition === 'USABLE_SURPLUS'
        ? 'AVAILABLE'
        : condition === 'DAMAGED'
          ? 'DAMAGED'
          : 'SCRAP';

    return withTransaction(async (txQuery) => {
      const [deptRes, matRes] = await Promise.all([
        txQuery(`SELECT id FROM departments WHERE id = $1`, [departmentId]),
        txQuery<any>(`SELECT * FROM materials WHERE id = $1`, [materialId]),
      ]);
      if (deptRes.rowCount === 0) throw notFound(`Department #${departmentId} not found`);
      if (matRes.rowCount === 0) throw notFound(`Material #${materialId} not found`);

      const { location } = await InventoryEngineService.resolveLocationForWarehouse(
        txQuery,
        warehouseId,
        dto.target_location_id !== undefined && dto.target_location_id !== null
          ? parsePositiveInt(dto.target_location_id, 'target_location_id')
          : null
      );

      let unitCost = await InventoryEngineService.getCurrentGlobalWac(txQuery, materialId);

      // Verify issue traceability if stock_issue_id supplied
      if (stockIssueId !== null) {
        const issRes = await txQuery<any>(`SELECT * FROM stock_issues WHERE id = $1`, [stockIssueId]);
        if (issRes.rowCount === 0) throw notFound(`Stock Issue #${stockIssueId} not found`);

        const issItemsRes = await txQuery<any>(
          `SELECT * FROM stock_issue_items WHERE issue_id = $1 AND material_id = $2`,
          [stockIssueId, materialId]
        );
        if (issItemsRes.rowCount === 0) {
          throw badRequest(`Material #${materialId} was not issued on Stock Issue #${stockIssueId}`);
        }

        const totalIssuedQty = issItemsRes.rows.reduce((s, r) => s + Number(r.issued_qty), 0);
        const prevRetRes = await txQuery<{ sum_ret: string }>(
          `SELECT COALESCE(SUM(returned_qty), 0) as sum_ret
           FROM material_returns
           WHERE stock_issue_id = $1 AND material_id = $2 AND status = 'POSTED'`,
          [stockIssueId, materialId]
        );
        const alreadyReturned = roundQty(Number(prevRetRes.rows[0]?.sum_ret || 0));
        if (roundQty(alreadyReturned + returnedQty) > roundQty(totalIssuedQty)) {
          throw conflict(
            `Cumulative returned qty (${roundQty(alreadyReturned + returnedQty)}) exceeds issued qty (${totalIssuedQty}) for Stock Issue #${stockIssueId}`,
            'RETURN_EXCEEDS_ISSUED'
          );
        }

        unitCost = roundQty(Number(issItemsRes.rows[0].unit_cost));
      }

      const returnNumber = generateDocRef('RET');
      const retIns = await txQuery<any>(
        `INSERT INTO material_returns (
           return_number, department_id, production_line_id, stock_issue_id,
           warehouse_id, target_location_id, material_id, lot_id,
           returned_qty, return_condition, target_stock_status, unit_cost,
           status, returned_by, received_by, posted_at, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'POSTED', $13, $13, NOW(), $14)
         RETURNING *`,
        [
          returnNumber,
          departmentId,
          lineId,
          stockIssueId,
          warehouseId,
          location.id,
          materialId,
          lotId,
          returnedQty,
          condition,
          targetStockStatus,
          unitCost,
          actor.id,
          dto.notes ?? null,
        ]
      );
      const returnRow = retIns.rows[0];

      const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
        warehouseId,
        locationId: location.id,
        materialId,
        lotId,
        stockStatus: targetStockStatus,
        direction: 'IN',
        movementType: 'RETURN',
        quantity: returnedQty,
        unitCost,
        destinationWarehouseId: warehouseId,
        destinationLocationId: location.id,
        sourceDocumentType: 'MATERIAL_RETURN',
        sourceDocumentId: returnRow.id,
        sourceDocumentRef: returnNumber,
        actorId: actor.id,
        notes: `Production return (${condition}) from Department #${departmentId}`,
      });

      if (condition === 'USABLE_SURPLUS') {
        await InventoryEngineService.applyGlobalWacInbound(txQuery, {
          materialId,
          incomingQty: returnedQty,
          incomingUnitCost: unitCost,
        });
        if (lotId !== null) {
          await txQuery(
            `UPDATE inventory_lots SET remaining_qty = remaining_qty + $1, updated_at = NOW() WHERE id = $2`,
            [returnedQty, lotId]
          );
        }
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_RETURN',
          entityType: 'MATERIAL_RETURN',
          entityId: returnRow.id,
          details: {
            return_number: returnNumber,
            return_condition: condition,
            target_stock_status: targetStockStatus,
            returned_qty: returnedQty,
            stock_issue_id: stockIssueId,
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { material_return: returnRow, balance: mv.balance, movement: mv.movement };
    });
  }
}
