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
  parseNonNegativeNumber,
  parsePositiveInt,
  parsePositiveNumber,
  roundQty,
} from './warehouse.errors.ts';
import { WarehouseActor } from './warehouse.types.ts';

export class WarehouseInboundService {
  // ============================================================================
  // 5.4 Goods Receiving (GRN)
  // ============================================================================
  static async listGrns(
    actor: WarehouseActor,
    filter?: { warehouse_id?: number; status?: string; po_reference?: string }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT g.*, w.warehouse_code, w.name as warehouse_name,
             ru.username as received_by_username, pu.username as posted_by_username
      FROM goods_receipts g
      JOIN warehouses w ON g.warehouse_id = w.id
      JOIN users ru ON g.received_by = ru.id
      LEFT JOIN users pu ON g.posted_by = pu.id
      WHERE 1=1
    `;
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND g.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND g.status = $${params.length}`;
    }
    if (filter?.po_reference) {
      params.push(filter.po_reference);
      sql += ` AND g.po_reference = $${params.length}`;
    }
    sql += ` ORDER BY g.id DESC`;

    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async getGrnById(grnId: number, actor: WarehouseActor): Promise<any> {
    const grnRes = await query<any>(
      `SELECT g.*, w.warehouse_code, w.name as warehouse_name,
              ru.username as received_by_username, pu.username as posted_by_username
       FROM goods_receipts g
       JOIN warehouses w ON g.warehouse_id = w.id
       JOIN users ru ON g.received_by = ru.id
       LEFT JOIN users pu ON g.posted_by = pu.id
       WHERE g.id = $1`,
      [grnId]
    );
    if (grnRes.rowCount === 0) throw notFound(`GRN #${grnId} not found`);
    const grn = grnRes.rows[0];

    if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(grn.warehouse_id)) {
      throw forbidden(`GRN #${grnId} is outside your assigned warehouse scope`);
    }

    const itemsRes = await query<any>(
      `SELECT gi.*, m.sku, m.name as material_name, m.base_uom,
              l.location_code, lot.lot_number, lot.roll_number, lot.shade_code
       FROM goods_receipt_items gi
       JOIN materials m ON gi.material_id = m.id
       JOIN warehouse_locations l ON gi.target_location_id = l.id
       LEFT JOIN inventory_lots lot ON gi.lot_id = lot.id
       WHERE gi.grn_id + 0 = $1
       ORDER BY gi.id ASC`,
      [grnId]
    );

    return { grn, items: itemsRes.rows };
  }

  static async createGrn(
    dto: {
      warehouse_id: number;
      supplier_name: string;
      delivery_note_no?: string | null;
      po_reference?: string | null;
      notes?: string | null;
      items?: any[];
    },
    actor: WarehouseActor
  ): Promise<any> {
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const supplierName = String(dto.supplier_name || '').trim();
    if (!supplierName) throw badRequest('supplier_name is required');

    return withTransaction(async (txQuery) => {
      const whRes = await txQuery<any>(`SELECT id, status FROM warehouses WHERE id = $1`, [warehouseId]);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);
      if (whRes.rows[0].status !== 'active') throw badRequest('Target warehouse is inactive');

      const grnNumber = generateDocRef('GRN');
      const ins = await txQuery<any>(
        `INSERT INTO goods_receipts (grn_number, warehouse_id, supplier_name, delivery_note_no, po_reference, status, notes, received_by)
         VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
         RETURNING *`,
        [
          grnNumber,
          warehouseId,
          supplierName,
          dto.delivery_note_no ?? null,
          dto.po_reference ?? null,
          dto.notes ?? null,
          actor.id,
        ]
      );
      const grn = ins.rows[0];
      const addedItems: any[] = [];

      if (Array.isArray(dto.items) && dto.items.length > 0) {
        for (const itemDto of dto.items) {
          const added = await this.insertGrnItemTx(txQuery, grn, itemDto);
          addedItems.push(added);
        }
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_GRN_CREATE',
          entityType: 'GOODS_RECEIPT',
          entityId: grn.id,
          details: { grn_number: grnNumber, warehouse_id: warehouseId, po_reference: dto.po_reference ?? null },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { grn, items: addedItems };
    });
  }

  static async addGrnItem(grnId: number, itemDto: any, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const grnRes = await txQuery<any>(`SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE`, [grnId]);
      if (grnRes.rowCount === 0) throw notFound(`GRN #${grnId} not found`);
      const grn = grnRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(grn.warehouse_id)) {
        const err: any = new Error(`Access denied for Warehouse #${grn.warehouse_id}`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (grn.status !== 'DRAFT') {
        throw conflict(`Cannot add items to GRN in status "${grn.status}"`, 'GRN_LOCKED');
      }

      const item = await this.insertGrnItemTx(txQuery, grn, itemDto);

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_GRN_ITEM_ADD',
          entityType: 'GOODS_RECEIPT',
          entityId: grnId,
          details: { grn_item_id: item.id, material_id: item.material_id, received_qty: item.received_qty },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return item;
    });
  }

  private static async insertGrnItemTx(txQuery: QueryFn, grn: any, itemDto: any): Promise<any> {
    const materialId = parsePositiveInt(itemDto.material_id, 'material_id');
    const receivedQty = parsePositiveNumber(itemDto.received_qty, 'received_qty');
    const acceptedQty = parseNonNegativeNumber(itemDto.accepted_qty, 'accepted_qty', 0);
    const rejectedQty = parseNonNegativeNumber(itemDto.rejected_qty, 'rejected_qty', 0);
    const damagedQty = parseNonNegativeNumber(itemDto.damaged_qty, 'damaged_qty', 0);
    const pendingQty = parseNonNegativeNumber(itemDto.pending_inspection_qty, 'pending_inspection_qty', 0);
    const unitCost = parseNonNegativeNumber(itemDto.unit_cost, 'unit_cost', 0);
    const expectedQty =
      itemDto.expected_qty !== undefined && itemDto.expected_qty !== null && itemDto.expected_qty !== ''
        ? parseNonNegativeNumber(itemDto.expected_qty, 'expected_qty')
        : null;

    // Strict physical reconciliation equation
    const breakdownSum = roundQty(acceptedQty + rejectedQty + damagedQty + pendingQty);
    if (breakdownSum !== receivedQty) {
      throw badRequest(
        `GRN reconciliation mismatch: received_qty (${receivedQty}) must equal accepted (${acceptedQty}) + rejected (${rejectedQty}) + damaged (${damagedQty}) + pending_inspection (${pendingQty}) = ${breakdownSum}`,
        'GRN_RECONCILIATION_MISMATCH'
      );
    }

    // Over-delivery tolerance check (PARAM-03 default 0%)
    if (expectedQty !== null) {
      const tolRaw = await InventoryEngineService.getSettingValue(txQuery, 'grn_over_delivery_tolerance_pct');
      const tolPct = tolRaw !== null && !isNaN(Number(tolRaw)) ? Number(tolRaw) : 0;
      const maxAllowed = roundQty(expectedQty * (1 + tolPct / 100));
      if (receivedQty > maxAllowed) {
        throw badRequest(
          `Received quantity (${receivedQty}) exceeds expected quantity (${expectedQty}) + ${tolPct}% tolerance (max allowed: ${maxAllowed})`,
          'OVER_DELIVERY_EXCEEDED'
        );
      }
    }

    const matRes = await txQuery<any>(`SELECT * FROM materials WHERE id = $1`, [materialId]);
    if (matRes.rowCount === 0) throw notFound(`Material #${materialId} not found`);
    const mat = matRes.rows[0];
    if (mat.status !== 'active') throw badRequest(`Material ${mat.sku} is inactive`);

    // DEC-05: QC Quarantine requirement enforcement
    if (mat.requires_qc_on_receipt && acceptedQty > 0) {
      throw badRequest(
        `Material ${mat.sku} requires QC inspection on receipt (DEC-05). Usable quantity must go to pending_inspection_qty instead of accepted_qty.`,
        'QC_REQUIRED_ON_RECEIPT'
      );
    }

    // DEC-01: Bin resolution
    const { location } = await InventoryEngineService.resolveLocationForWarehouse(
      txQuery,
      grn.warehouse_id,
      itemDto.target_location_id !== undefined && itemDto.target_location_id !== null
        ? parsePositiveInt(itemDto.target_location_id, 'target_location_id')
        : null
    );

    // DEC-02: Lot & Fabric Roll creation/linking
    let lotId: number | null = itemDto.lot_id ? parsePositiveInt(itemDto.lot_id, 'lot_id') : null;
    if (lotId !== null) {
      const lotRes = await txQuery<any>(`SELECT id, material_id FROM inventory_lots WHERE id = $1`, [lotId]);
      if (lotRes.rowCount === 0) throw notFound(`Lot #${lotId} not found`);
      if (lotRes.rows[0].material_id !== materialId) {
        throw badRequest(`Lot #${lotId} does not belong to Material #${materialId}`);
      }
    } else if (mat.is_lot_tracked || mat.is_roll_tracked || itemDto.lot_number) {
      const lotNumber = String(itemDto.lot_number || '').trim();
      const rollNumber = String(itemDto.roll_number || '').trim();
      if (!lotNumber) {
        throw badRequest(`Material ${mat.sku} is lot/roll tracked and requires lot_number`, 'LOT_REQUIRED');
      }
      if (mat.is_roll_tracked && !rollNumber) {
        throw badRequest(`Material ${mat.sku} is roll tracked and requires roll_number`, 'ROLL_REQUIRED');
      }

      const existingLot = await txQuery<any>(
        `SELECT id FROM inventory_lots WHERE material_id = $1 AND lot_number = $2 AND roll_number = $3`,
        [materialId, lotNumber, rollNumber]
      );
      if (existingLot.rowCount > 0) {
        throw conflict(
          `Lot/Roll (${lotNumber}${rollNumber ? ' / ' + rollNumber : ''}) already exists for Material ${mat.sku}`,
          'DUPLICATE_LOT_ROLL'
        );
      }

      const initialQcStatus = pendingQty > 0 ? 'PENDING' : acceptedQty > 0 ? 'PASSED' : 'REJECTED';
      const usableLotQty = roundQty(pendingQty + acceptedQty);
      const lotIns = await txQuery<any>(
        `INSERT INTO inventory_lots (
           material_id, lot_number, roll_number, shade_code, supplier_name, supplier_batch_ref,
           initial_qty, remaining_qty, qc_status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          materialId,
          lotNumber,
          rollNumber,
          itemDto.shade_code ?? null,
          grn.supplier_name,
          itemDto.supplier_batch_ref ?? null,
          receivedQty,
          usableLotQty,
          initialQcStatus,
          itemDto.discrepancy_notes ?? null,
        ]
      );
      lotId = lotIns.rows[0].id;
    }

    const lineQcStatus =
      pendingQty > 0
        ? acceptedQty > 0
          ? 'PARTIALLY_PASSED'
          : 'PENDING'
        : acceptedQty > 0
          ? 'PASSED'
          : 'REJECTED';

    const ins = await txQuery<any>(
      `INSERT INTO goods_receipt_items (
         grn_id, warehouse_id, target_location_id, material_id, lot_id,
         expected_qty, received_qty, accepted_qty, rejected_qty, damaged_qty, pending_inspection_qty,
         unit_cost, qc_status, discrepancy_notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        grn.id,
        grn.warehouse_id,
        location.id,
        materialId,
        lotId,
        expectedQty,
        receivedQty,
        acceptedQty,
        rejectedQty,
        damagedQty,
        pendingQty,
        unitCost,
        lineQcStatus,
        itemDto.discrepancy_notes ?? null,
      ]
    );

    return ins.rows[0];
  }

  static async postGrn(grnId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const grnRes = await txQuery<any>(`SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE`, [grnId]);
      if (grnRes.rowCount === 0) throw notFound(`GRN #${grnId} not found`);
      const grn = grnRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(grn.warehouse_id)) {
        const err: any = new Error(`Access denied for Warehouse #${grn.warehouse_id}`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }

      if (grn.status !== 'DRAFT') {
        throw conflict(`GRN ${grn.grn_number} is already "${grn.status}" and cannot be posted again`, 'ALREADY_POSTED');
      }

      const itemsRes = await txQuery<any>(
        `SELECT * FROM goods_receipt_items WHERE grn_id = $1 ORDER BY id ASC FOR UPDATE`,
        [grnId]
      );
      if (itemsRes.rowCount === 0) {
        throw badRequest(`Cannot post empty GRN ${grn.grn_number}; add at least one line item`);
      }

      const postedMovements: any[] = [];
      let pendingQcLines = 0;
      let hasDiscrepancies = false;

      for (const item of itemsRes.rows) {
        const accepted = roundQty(Number(item.accepted_qty));
        const pending = roundQty(Number(item.pending_inspection_qty));
        const damaged = roundQty(Number(item.damaged_qty));
        const rejected = roundQty(Number(item.rejected_qty));
        const unitCost = roundQty(Number(item.unit_cost));

        if (accepted > 0) {
          const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
            warehouseId: item.warehouse_id,
            locationId: item.target_location_id,
            materialId: item.material_id,
            lotId: item.lot_id,
            stockStatus: 'AVAILABLE',
            direction: 'IN',
            movementType: 'RECEIPT',
            quantity: accepted,
            unitCost,
            destinationWarehouseId: item.warehouse_id,
            destinationLocationId: item.target_location_id,
            sourceDocumentType: 'GRN',
            sourceDocumentId: grn.id,
            sourceDocumentRef: grn.grn_number,
            actorId: actor.id,
            notes: `GRN accepted stock from ${grn.supplier_name}`,
          });
          postedMovements.push(mv.movement);

          // Update Global WAC for QC-exempt accepted receipt
          await InventoryEngineService.applyGlobalWacInbound(txQuery, {
            materialId: item.material_id,
            incomingQty: accepted,
            incomingUnitCost: unitCost,
          });
        }

        if (pending > 0) {
          pendingQcLines++;
          const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
            warehouseId: item.warehouse_id,
            locationId: item.target_location_id,
            materialId: item.material_id,
            lotId: item.lot_id,
            stockStatus: 'QUARANTINE',
            direction: 'IN',
            movementType: 'RECEIPT',
            quantity: pending,
            unitCost,
            destinationWarehouseId: item.warehouse_id,
            destinationLocationId: item.target_location_id,
            sourceDocumentType: 'GRN',
            sourceDocumentId: grn.id,
            sourceDocumentRef: grn.grn_number,
            actorId: actor.id,
            notes: `GRN stock placed in QUARANTINE awaiting QC inspection`,
          });
          postedMovements.push(mv.movement);
        }

        if (damaged > 0) {
          hasDiscrepancies = true;
          const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
            warehouseId: item.warehouse_id,
            locationId: item.target_location_id,
            materialId: item.material_id,
            lotId: item.lot_id,
            stockStatus: 'DAMAGED',
            direction: 'IN',
            movementType: 'RECEIPT',
            quantity: damaged,
            unitCost,
            destinationWarehouseId: item.warehouse_id,
            destinationLocationId: item.target_location_id,
            sourceDocumentType: 'GRN',
            sourceDocumentId: grn.id,
            sourceDocumentRef: grn.grn_number,
            actorId: actor.id,
            notes: `GRN damaged goods segregated`,
          });
          postedMovements.push(mv.movement);
        }

        if (rejected > 0 || (item.expected_qty !== null && Number(item.received_qty) !== Number(item.expected_qty))) {
          hasDiscrepancies = true;
        }
      }

      const updRes = await txQuery<any>(
        `UPDATE goods_receipts
         SET status = 'POSTED', posted_by = $1, posted_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [actor.id, grn.id]
      );

      if (pendingQcLines > 0) {
        await InventoryEngineService.createNotification(txQuery, {
          targetRoleName: 'QC Inspector',
          warehouseId: grn.warehouse_id,
          notificationType: 'QC_PENDING',
          severity: 'INFO',
          title: `QC Inspection Required: ${grn.grn_number}`,
          message: `GRN ${grn.grn_number} posted ${pendingQcLines} line(s) into QUARANTINE awaiting QC inspection.`,
          entityType: 'GOODS_RECEIPT',
          entityId: grn.id,
        });
      }

      if (hasDiscrepancies) {
        await InventoryEngineService.createNotification(txQuery, {
          targetRoleName: 'Warehouse Manager',
          warehouseId: grn.warehouse_id,
          notificationType: 'RECEIPT_DISCREPANCY',
          severity: 'WARNING',
          title: `Receiving Discrepancy: ${grn.grn_number}`,
          message: `GRN ${grn.grn_number} recorded quantity variance, damage, or dock rejection.`,
          entityType: 'GOODS_RECEIPT',
          entityId: grn.id,
        });
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_GRN_POST',
          entityType: 'GOODS_RECEIPT',
          entityId: grn.id,
          details: {
            grn_number: grn.grn_number,
            movements_count: postedMovements.length,
            pending_qc_lines: pendingQcLines,
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { grn: updRes.rows[0], movements: postedMovements };
    });
  }

  // ============================================================================
  // 5.5 QC Inspection & Quarantine Release
  // ============================================================================
  static async listPendingQc(warehouseId?: number, actor?: WarehouseActor): Promise<any[]> {
    const params: any[] = [];
    let sql = `
      SELECT gi.*, g.grn_number, g.supplier_name, g.posted_at,
             w.warehouse_code, l.location_code,
             m.sku, m.name as material_name, m.base_uom,
             lot.lot_number, lot.roll_number, lot.shade_code
      FROM goods_receipt_items gi
      JOIN goods_receipts g ON gi.grn_id = g.id
      JOIN warehouses w ON gi.warehouse_id = w.id
      JOIN warehouse_locations l ON gi.target_location_id = l.id
      JOIN materials m ON gi.material_id = m.id
      LEFT JOIN inventory_lots lot ON gi.lot_id = lot.id
      WHERE g.status = 'POSTED' AND gi.pending_inspection_qty > 0
    `;
    if (warehouseId) {
      params.push(warehouseId);
      sql += ` AND gi.warehouse_id + 0 = $${params.length}`;
    }
    sql += ` ORDER BY g.posted_at ASC, gi.id ASC`;
    const res = await query<any>(sql, params);
    if (!actor || hasGlobalWarehouseAccess(actor as any)) return res.rows;
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => allowedSet.has(r.warehouse_id));
  }

  static async listQcHistory(
    filter?: { warehouse_id?: number; material_id?: number; lot_id?: number },
    actor?: WarehouseActor
  ): Promise<any[]> {
    const params: any[] = [];
    let sql = `
      SELECT qi.*, w.warehouse_code, m.sku, m.name as material_name,
             lot.lot_number, lot.roll_number, u.username as inspector_username
      FROM qc_inspections qi
      JOIN warehouses w ON qi.warehouse_id = w.id
      JOIN materials m ON qi.material_id = m.id
      LEFT JOIN inventory_lots lot ON qi.lot_id = lot.id
      JOIN users u ON qi.inspector_id = u.id
      WHERE 1=1
    `;
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND qi.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.material_id) {
      params.push(filter.material_id);
      sql += ` AND qi.material_id + 0 = $${params.length}`;
    }
    if (filter?.lot_id) {
      params.push(filter.lot_id);
      sql += ` AND qi.lot_id + 0 = $${params.length}`;
    }
    sql += ` ORDER BY qi.inspected_at DESC, qi.id DESC`;
    const res = await query<any>(sql, params);
    if (!actor || hasGlobalWarehouseAccess(actor as any)) return res.rows;
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => allowedSet.has(r.warehouse_id));
  }

  static async performQcInspection(
    dto: {
      grn_item_id: number;
      passed_qty: number;
      rejected_qty?: number;
      damaged_qty?: number;
      target_location_id?: number | null;
      reject_stock_status?: 'DAMAGED' | 'SCRAP';
      notes?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const grnItemId = parsePositiveInt(dto.grn_item_id, 'grn_item_id');
    const passedQty = parseNonNegativeNumber(dto.passed_qty, 'passed_qty', 0);
    const rejectedQty = parseNonNegativeNumber(dto.rejected_qty, 'rejected_qty', 0);
    const damagedQty = parseNonNegativeNumber(dto.damaged_qty, 'damaged_qty', 0);
    const inspectedQty = roundQty(passedQty + rejectedQty + damagedQty);
    if (inspectedQty <= 0) {
      throw badRequest('passed_qty + rejected_qty + damaged_qty must be greater than zero');
    }
    const rejectStatus = dto.reject_stock_status
      ? parseEnumValue(dto.reject_stock_status, ['DAMAGED', 'SCRAP'] as const, 'reject_stock_status')
      : 'DAMAGED';

    return withTransaction(async (txQuery) => {
      const itemRes = await txQuery<any>(`SELECT * FROM goods_receipt_items WHERE id = $1 FOR UPDATE`, [grnItemId]);
      if (itemRes.rowCount === 0) throw notFound(`GRN item #${grnItemId} not found`);
      const item = itemRes.rows[0];

      const grnRes = await txQuery<any>(`SELECT * FROM goods_receipts WHERE id = $1`, [item.grn_id]);
      const grn = grnRes.rows[0];
      if (grn.status !== 'POSTED') {
        throw badRequest(`GRN ${grn.grn_number} must be POSTED before QC inspection`);
      }

      const remainingPending = roundQty(Number(item.pending_inspection_qty));
      if (inspectedQty > remainingPending) {
        throw conflict(
          `Cannot inspect ${inspectedQty}: only ${remainingPending} units remain pending inspection on GRN item #${grnItemId}`,
          'QC_QUANTITY_EXCEEDED'
        );
      }

      const targetReleaseLocationId =
        dto.target_location_id !== undefined && dto.target_location_id !== null
          ? (
              await InventoryEngineService.resolveLocationForWarehouse(
                txQuery,
                item.warehouse_id,
                parsePositiveInt(dto.target_location_id, 'target_location_id')
              )
            ).location.id
          : item.target_location_id;

      const inspectionNumber = generateDocRef('QC');
      const newPending = roundQty(remainingPending - inspectedQty);
      const newAccepted = roundQty(Number(item.accepted_qty) + passedQty);
      const newRejected = roundQty(Number(item.rejected_qty) + rejectedQty);
      const newDamaged = roundQty(Number(item.damaged_qty) + damagedQty);

      let lineOutcome: 'PENDING' | 'PASSED' | 'PARTIALLY_PASSED' | 'REJECTED';
      if (newPending > 0) {
        lineOutcome = newAccepted > 0 || newRejected > 0 || newDamaged > 0 ? 'PARTIALLY_PASSED' : 'PENDING';
      } else if (newAccepted > 0 && newRejected === 0 && newDamaged === 0) {
        lineOutcome = 'PASSED';
      } else if (newAccepted === 0) {
        lineOutcome = 'REJECTED';
      } else {
        lineOutcome = 'PARTIALLY_PASSED';
      }

      const inspectOutcome =
        passedQty > 0 && rejectedQty === 0 && damagedQty === 0
          ? 'PASSED'
          : passedQty === 0
            ? 'REJECTED'
            : 'PARTIALLY_PASSED';

      const qcIns = await txQuery<any>(
        `INSERT INTO qc_inspections (
           inspection_number, grn_item_id, lot_id, warehouse_id, location_id, material_id,
           inspected_qty, passed_qty, rejected_qty, damaged_qty, outcome_status, inspector_id, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          inspectionNumber,
          item.id,
          item.lot_id,
          item.warehouse_id,
          item.target_location_id,
          item.material_id,
          inspectedQty,
          passedQty,
          rejectedQty,
          damagedQty,
          inspectOutcome,
          actor.id,
          dto.notes ?? null,
        ]
      );
      const inspectionRecord = qcIns.rows[0];
      const unitCost = roundQty(Number(item.unit_cost));
      const movements: any[] = [];

      // Release PASSED quantity: QUARANTINE -> AVAILABLE + Global WAC update
      if (passedQty > 0) {
        const outQ = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: item.warehouse_id,
          locationId: item.target_location_id,
          materialId: item.material_id,
          lotId: item.lot_id,
          stockStatus: 'QUARANTINE',
          direction: 'OUT',
          movementType: 'QC_RELEASE',
          quantity: passedQty,
          unitCost,
          sourceWarehouseId: item.warehouse_id,
          sourceLocationId: item.target_location_id,
          destinationWarehouseId: item.warehouse_id,
          destinationLocationId: targetReleaseLocationId,
          sourceDocumentType: 'QC_INSPECTION',
          sourceDocumentId: inspectionRecord.id,
          sourceDocumentRef: inspectionNumber,
          actorId: actor.id,
          notes: `QC passed release from QUARANTINE`,
        });

        const inAvail = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: item.warehouse_id,
          locationId: targetReleaseLocationId,
          materialId: item.material_id,
          lotId: item.lot_id,
          stockStatus: 'AVAILABLE',
          direction: 'IN',
          movementType: 'QC_RELEASE',
          quantity: passedQty,
          unitCost,
          sourceWarehouseId: item.warehouse_id,
          sourceLocationId: item.target_location_id,
          destinationWarehouseId: item.warehouse_id,
          destinationLocationId: targetReleaseLocationId,
          sourceDocumentType: 'QC_INSPECTION',
          sourceDocumentId: inspectionRecord.id,
          sourceDocumentRef: inspectionNumber,
          linkedMovementId: outQ.movement.id,
          actorId: actor.id,
          notes: `QC passed release into AVAILABLE`,
        });

        movements.push(outQ.movement, inAvail.movement);

        await InventoryEngineService.applyGlobalWacInbound(txQuery, {
          materialId: item.material_id,
          incomingQty: passedQty,
          incomingUnitCost: unitCost,
        });
      }

      // Segregate REJECTED / DAMAGED quantity: QUARANTINE -> DAMAGED/SCRAP (never AVAILABLE)
      const failQty = roundQty(rejectedQty + damagedQty);
      if (failQty > 0) {
        const outQFail = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: item.warehouse_id,
          locationId: item.target_location_id,
          materialId: item.material_id,
          lotId: item.lot_id,
          stockStatus: 'QUARANTINE',
          direction: 'OUT',
          movementType: 'QC_REJECT',
          quantity: failQty,
          unitCost,
          sourceWarehouseId: item.warehouse_id,
          sourceLocationId: item.target_location_id,
          destinationWarehouseId: item.warehouse_id,
          destinationLocationId: item.target_location_id,
          sourceDocumentType: 'QC_INSPECTION',
          sourceDocumentId: inspectionRecord.id,
          sourceDocumentRef: inspectionNumber,
          actorId: actor.id,
          notes: `QC rejected/damaged exit from QUARANTINE`,
        });

        const inDamaged = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: item.warehouse_id,
          locationId: item.target_location_id,
          materialId: item.material_id,
          lotId: item.lot_id,
          stockStatus: rejectStatus,
          direction: 'IN',
          movementType: 'QC_REJECT',
          quantity: failQty,
          unitCost,
          sourceWarehouseId: item.warehouse_id,
          sourceLocationId: item.target_location_id,
          destinationWarehouseId: item.warehouse_id,
          destinationLocationId: item.target_location_id,
          sourceDocumentType: 'QC_INSPECTION',
          sourceDocumentId: inspectionRecord.id,
          sourceDocumentRef: inspectionNumber,
          linkedMovementId: outQFail.movement.id,
          actorId: actor.id,
          notes: `QC rejected/damaged quarantined goods placed in ${rejectStatus}`,
        });

        movements.push(outQFail.movement, inDamaged.movement);
      }

      await txQuery(
        `UPDATE goods_receipt_items
         SET accepted_qty = $1, rejected_qty = $2, damaged_qty = $3,
             pending_inspection_qty = $4, qc_status = $5
         WHERE id = $6`,
        [newAccepted, newRejected, newDamaged, newPending, lineOutcome, item.id]
      );

      if (item.lot_id) {
        const lotRes = await txQuery<{ remaining_qty: string }>(`SELECT remaining_qty FROM inventory_lots WHERE id = $1 FOR UPDATE`, [item.lot_id]);
        const currentLotRem = roundQty(Number(lotRes.rows[0]?.remaining_qty || 0));
        const nextLotRem = roundQty(Math.max(0, currentLotRem - failQty));
        await txQuery(
          `UPDATE inventory_lots SET qc_status = $1, remaining_qty = $2, updated_at = NOW() WHERE id = $3`,
          [lineOutcome, nextLotRem, item.lot_id]
        );
      }

      if (passedQty > 0) {
        await InventoryEngineService.createNotification(txQuery, {
          targetRoleName: 'Warehouse Keeper',
          warehouseId: item.warehouse_id,
          notificationType: 'GENERAL',
          severity: 'INFO',
          title: `QC Released Stock: ${inspectionNumber}`,
          message: `QC approved ${passedQty} units into AVAILABLE inventory for GRN ${grn.grn_number}.`,
          entityType: 'QC_INSPECTION',
          entityId: inspectionRecord.id,
        });
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_QC_INSPECT',
          entityType: 'QC_INSPECTION',
          entityId: inspectionRecord.id,
          details: {
            inspection_number: inspectionNumber,
            grn_item_id: item.id,
            passed_qty: passedQty,
            rejected_qty: rejectedQty,
            damaged_qty: damagedQty,
            outcome_status: inspectOutcome,
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { inspection: inspectionRecord, movements, remaining_pending_qty: newPending, line_qc_status: lineOutcome };
    });
  }

  // ============================================================================
  // 5.13 Finished Goods Receiving (Packing -> FINISHED_GOODS Warehouse)
  // ============================================================================
  static async receiveFinishedGoods(
    dto: {
      department_id: number;
      production_line_id?: number | null;
      warehouse_id: number;
      target_location_id?: number | null;
      material_id: number;
      quantity: number;
      unit_cost?: number;
      lot_number?: string | null;
      handover_ref?: string | null;
      notes?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const departmentId = parsePositiveInt(dto.department_id, 'department_id');
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const materialId = parsePositiveInt(dto.material_id, 'material_id');
    const qty = parsePositiveNumber(dto.quantity, 'quantity');
    const unitCost = parseNonNegativeNumber(dto.unit_cost, 'unit_cost', 0);
    const lineId =
      dto.production_line_id !== undefined && dto.production_line_id !== null
        ? parsePositiveInt(dto.production_line_id, 'production_line_id')
        : null;

    return withTransaction(async (txQuery) => {
      const [deptRes, whRes, matRes] = await Promise.all([
        txQuery<any>(`SELECT id, dept_code, name FROM departments WHERE id = $1`, [departmentId]),
        txQuery<any>(`SELECT * FROM warehouses WHERE id = $1`, [warehouseId]),
        txQuery<any>(
          `SELECT m.*, mc.category_type FROM materials m
           JOIN material_categories mc ON m.category_id = mc.id
           WHERE m.id = $1`,
          [materialId]
        ),
      ]);

      if (deptRes.rowCount === 0) throw notFound(`Source Department #${departmentId} not found`);
      if (whRes.rowCount === 0) throw notFound(`Target Warehouse #${warehouseId} not found`);
      if (matRes.rowCount === 0) throw notFound(`Finished Good Material #${materialId} not found`);

      const dept = deptRes.rows[0];
      const wh = whRes.rows[0];
      const mat = matRes.rows[0];

      if (wh.status !== 'active') throw badRequest(`Target warehouse ${wh.warehouse_code} is inactive`);
      if (wh.warehouse_type !== 'FINISHED_GOODS' && wh.warehouse_type !== 'GENERAL') {
        throw badRequest(
          `Finished goods must be received into a FINISHED_GOODS or GENERAL warehouse (got ${wh.warehouse_type})`,
          'INVALID_FG_WAREHOUSE'
        );
      }
      if (mat.category_type !== 'FINISHED_GOOD') {
        throw badRequest(
          `Material ${mat.sku} category is ${mat.category_type}, expected FINISHED_GOOD`,
          'INVALID_FG_MATERIAL'
        );
      }

      if (lineId !== null) {
        const lineRes = await txQuery<any>(`SELECT id, department_id FROM production_lines WHERE id = $1`, [lineId]);
        if (lineRes.rowCount === 0) throw notFound(`Production line #${lineId} not found`);
        if (lineRes.rows[0].department_id !== null && lineRes.rows[0].department_id !== departmentId) {
          throw badRequest(`Production line #${lineId} does not belong to Department #${departmentId}`);
        }
      }

      const { location } = await InventoryEngineService.resolveLocationForWarehouse(
        txQuery,
        warehouseId,
        dto.target_location_id !== undefined && dto.target_location_id !== null
          ? parsePositiveInt(dto.target_location_id, 'target_location_id')
          : null
      );

      let lotId: number | null = null;
      if (mat.is_lot_tracked || dto.lot_number) {
        const lotNum = String(dto.lot_number || generateDocRef('FG-LOT')).trim();
        const lotIns = await txQuery<any>(
          `INSERT INTO inventory_lots (material_id, lot_number, roll_number, supplier_name, initial_qty, remaining_qty, qc_status, notes)
           VALUES ($1, $2, '', $3, $4, $4, $5, $6)
           RETURNING id`,
          [
            materialId,
            lotNum,
            `${dept.dept_code} Handover`,
            qty,
            mat.requires_qc_on_receipt ? 'PENDING' : 'PASSED',
            dto.notes ?? null,
          ]
        );
        lotId = lotIns.rows[0].id;
      }

      const grnNumber = generateDocRef('FGR');
      const handoverRef = dto.handover_ref ?? `DEPT:${dept.dept_code}${lineId ? `/LINE:${lineId}` : ''}`;
      const grnRes = await txQuery<any>(
        `INSERT INTO goods_receipts (
           grn_number, warehouse_id, supplier_name, delivery_note_no, po_reference,
           status, notes, received_by, posted_by, posted_at
         ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, $7, $7, NOW())
         RETURNING *`,
        [
          grnNumber,
          warehouseId,
          `Internal Production (${dept.dept_code})`,
          handoverRef,
          lineId ? `LINE-${lineId}` : null,
          dto.notes ?? null,
          actor.id,
        ]
      );
      const grn = grnRes.rows[0];

      const requiresQc = Boolean(mat.requires_qc_on_receipt);
      const acceptedQty = requiresQc ? 0 : qty;
      const pendingQty = requiresQc ? qty : 0;

      const grnItemRes = await txQuery<any>(
        `INSERT INTO goods_receipt_items (
           grn_id, warehouse_id, target_location_id, material_id, lot_id,
           expected_qty, received_qty, accepted_qty, pending_inspection_qty, unit_cost, qc_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          grn.id,
          warehouseId,
          location.id,
          materialId,
          lotId,
          qty,
          acceptedQty,
          pendingQty,
          unitCost,
          requiresQc ? 'PENDING' : 'PASSED',
        ]
      );

      const stockResult = await InventoryEngineService.applyBalanceChange(txQuery, {
        warehouseId,
        locationId: location.id,
        materialId,
        lotId,
        stockStatus: requiresQc ? 'QUARANTINE' : 'AVAILABLE',
        direction: 'IN',
        movementType: 'FG_RECEIPT',
        quantity: qty,
        unitCost,
        destinationWarehouseId: warehouseId,
        destinationLocationId: location.id,
        sourceDocumentType: 'FG_RECEIPT',
        sourceDocumentId: grn.id,
        sourceDocumentRef: grnNumber,
        actorId: actor.id,
        notes: `Finished goods received from ${dept.dept_code}${lineId ? ` line #${lineId}` : ''}`,
      });

      if (!requiresQc && unitCost > 0) {
        await InventoryEngineService.applyGlobalWacInbound(txQuery, {
          materialId,
          incomingQty: qty,
          incomingUnitCost: unitCost,
        });
      }

      if (requiresQc) {
        await InventoryEngineService.createNotification(txQuery, {
          targetRoleName: 'QC Inspector',
          warehouseId,
          notificationType: 'QC_PENDING',
          severity: 'INFO',
          title: `Finished Goods QC Hold: ${grnNumber}`,
          message: `${qty} units of ${mat.sku} from ${dept.dept_code} placed in QUARANTINE for final QC inspection.`,
          entityType: 'FG_RECEIPT',
          entityId: grn.id,
        });
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_FG_RECEIPT',
          entityType: 'FG_RECEIPT',
          entityId: grn.id,
          details: {
            grn_number: grnNumber,
            department_id: departmentId,
            production_line_id: lineId,
            material_id: materialId,
            quantity: qty,
            stock_status: requiresQc ? 'QUARANTINE' : 'AVAILABLE',
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return {
        receipt: grn,
        item: grnItemRes.rows[0],
        balance: stockResult.balance,
        movement: stockResult.movement,
      };
    });
  }
}
