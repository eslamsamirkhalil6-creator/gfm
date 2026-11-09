import { query, withTransaction } from '../../config/database.ts';
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
import { ADJUSTMENT_REASON_CODES, STOCK_STATUSES, WarehouseActor } from './warehouse.types.ts';

export class WarehouseControlService {
  // ============================================================================
  // 5.9 Warehouse Transfers (Internal Bin & 2-Step Inter-Warehouse)
  // ============================================================================
  static async listTransfers(actor: WarehouseActor, filter?: { status?: string; transfer_type?: string }): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT t.*,
             sw.warehouse_code as source_warehouse_code, sw.name as source_warehouse_name,
             tw.warehouse_code as target_warehouse_code, tw.name as target_warehouse_name
      FROM warehouse_transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses tw ON t.target_warehouse_id = tw.id
      WHERE 1=1
    `;
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (filter?.transfer_type) {
      params.push(filter.transfer_type);
      sql += ` AND t.transfer_type = $${params.length}`;
    }
    sql += ` ORDER BY t.id DESC`;

    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter(
      (r) => isGlobal || allowedSet.has(r.source_warehouse_id) || allowedSet.has(r.target_warehouse_id)
    );
  }

  static async getTransferById(transferId: number, actor: WarehouseActor): Promise<any> {
    const res = await query<any>(
      `SELECT t.*,
              sw.warehouse_code as source_warehouse_code, tw.warehouse_code as target_warehouse_code
       FROM warehouse_transfers t
       JOIN warehouses sw ON t.source_warehouse_id = sw.id
       JOIN warehouses tw ON t.target_warehouse_id = tw.id
       WHERE t.id = $1`,
      [transferId]
    );
    if (res.rowCount === 0) throw notFound(`Transfer #${transferId} not found`);
    const transfer = res.rows[0];

    if (
      !hasGlobalWarehouseAccess(actor as any) &&
      !actor.managed_warehouse_ids.includes(transfer.source_warehouse_id) &&
      !actor.managed_warehouse_ids.includes(transfer.target_warehouse_id)
    ) {
      throw forbidden(`Transfer #${transferId} is outside your assigned warehouse scope`);
    }

    const itemsRes = await query<any>(
      `SELECT ti.*, m.sku, m.name as material_name, sl.location_code as source_location_code, tl.location_code as target_location_code
       FROM warehouse_transfer_items ti
       JOIN materials m ON ti.material_id = m.id
       JOIN warehouse_locations sl ON ti.source_location_id = sl.id
       JOIN warehouse_locations tl ON ti.target_location_id = tl.id
       WHERE ti.transfer_id + 0 = $1
       ORDER BY ti.id ASC`,
      [transferId]
    );

    return { transfer, items: itemsRes.rows };
  }

  /**
   * Execute single-step atomic internal bin-to-bin move within one warehouse.
   */
  static async executeInternalBinTransfer(
    dto: {
      warehouse_id: number;
      notes?: string | null;
      items: Array<{
        source_location_id: number;
        target_location_id: number;
        material_id: number;
        lot_id?: number | null;
        quantity: number;
      }>;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw badRequest('At least one transfer item is required');
    }

    return withTransaction(async (txQuery) => {
      const transferNumber = generateDocRef('BIN');
      const trfIns = await txQuery<any>(
        `INSERT INTO warehouse_transfers (
           transfer_number, transfer_type, source_warehouse_id, target_warehouse_id,
           status, dispatched_by, dispatched_at, received_by, received_at, notes, created_by
         ) VALUES ($1, 'INTERNAL_BIN', $2, $2, 'RECEIVED', $3, NOW(), $3, NOW(), $4, $3)
         RETURNING *`,
        [transferNumber, warehouseId, actor.id, dto.notes ?? null]
      );
      const transfer = trfIns.rows[0];
      const movements: any[] = [];
      const createdItems: any[] = [];

      for (const itemDto of dto.items) {
        const srcLocId = parsePositiveInt(itemDto.source_location_id, 'source_location_id');
        const tgtLocId = parsePositiveInt(itemDto.target_location_id, 'target_location_id');
        if (srcLocId === tgtLocId) {
          throw badRequest('Source and target location cannot be identical');
        }
        const materialId = parsePositiveInt(itemDto.material_id, 'material_id');
        const qty = parsePositiveNumber(itemDto.quantity, 'quantity');
        const lotId = itemDto.lot_id ? parsePositiveInt(itemDto.lot_id, 'lot_id') : null;

        await InventoryEngineService.resolveLocationForWarehouse(txQuery, warehouseId, srcLocId);
        await InventoryEngineService.resolveLocationForWarehouse(txQuery, warehouseId, tgtLocId);
        const currentWac = await InventoryEngineService.getCurrentGlobalWac(txQuery, materialId);

        const outRes = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId,
          locationId: srcLocId,
          materialId,
          lotId,
          stockStatus: 'AVAILABLE',
          direction: 'OUT',
          movementType: 'TRANSFER_OUT',
          quantity: qty,
          unitCost: currentWac,
          enforceAvailableOnlyCheck: true,
          sourceWarehouseId: warehouseId,
          sourceLocationId: srcLocId,
          destinationWarehouseId: warehouseId,
          destinationLocationId: tgtLocId,
          sourceDocumentType: 'TRANSFER',
          sourceDocumentId: transfer.id,
          sourceDocumentRef: transferNumber,
          actorId: actor.id,
          notes: `Internal bin move OUT`,
        });

        const inRes = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId,
          locationId: tgtLocId,
          materialId,
          lotId,
          stockStatus: 'AVAILABLE',
          direction: 'IN',
          movementType: 'TRANSFER_IN',
          quantity: qty,
          unitCost: currentWac,
          sourceWarehouseId: warehouseId,
          sourceLocationId: srcLocId,
          destinationWarehouseId: warehouseId,
          destinationLocationId: tgtLocId,
          sourceDocumentType: 'TRANSFER',
          sourceDocumentId: transfer.id,
          sourceDocumentRef: transferNumber,
          linkedMovementId: outRes.movement.id,
          actorId: actor.id,
          notes: `Internal bin move IN`,
        });
        movements.push(outRes.movement, inRes.movement);

        const tiIns = await txQuery<any>(
          `INSERT INTO warehouse_transfer_items (
             transfer_id, source_warehouse_id, source_location_id, target_warehouse_id, target_location_id,
             material_id, lot_id, dispatched_qty, received_qty, unit_cost
           ) VALUES ($1, $2, $3, $2, $4, $5, $6, $7, $7, $8) RETURNING *`,
          [transfer.id, warehouseId, srcLocId, tgtLocId, materialId, lotId, qty, currentWac]
        );
        createdItems.push(tiIns.rows[0]);
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_INTERNAL_BIN_TRANSFER',
          entityType: 'WAREHOUSE_TRANSFER',
          entityId: transfer.id,
          details: { transfer_number: transferNumber, warehouse_id: warehouseId, lines: createdItems.length },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { transfer, items: createdItems, movements };
    });
  }

  /**
   * Step 1 of Inter-Warehouse Transfer (DEC-07): Dispatch source AVAILABLE -> IN_TRANSIT.
   */
  static async dispatchInterWarehouseTransfer(
    dto: {
      source_warehouse_id: number;
      target_warehouse_id: number;
      notes?: string | null;
      items: Array<{
        source_location_id?: number | null;
        target_location_id?: number | null;
        material_id: number;
        lot_id?: number | null;
        dispatched_qty: number;
      }>;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const srcWhId = parsePositiveInt(dto.source_warehouse_id, 'source_warehouse_id');
    const tgtWhId = parsePositiveInt(dto.target_warehouse_id, 'target_warehouse_id');
    if (srcWhId === tgtWhId) {
      throw badRequest('Inter-warehouse transfer requires distinct source and target warehouses');
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw badRequest('At least one transfer item is required');
    }

    return withTransaction(async (txQuery) => {
      const transferNumber = generateDocRef('TRF');
      const trfIns = await txQuery<any>(
        `INSERT INTO warehouse_transfers (
           transfer_number, transfer_type, source_warehouse_id, target_warehouse_id,
           status, dispatched_by, dispatched_at, notes, created_by
         ) VALUES ($1, 'INTER_WAREHOUSE', $2, $3, 'IN_TRANSIT', $4, NOW(), $5, $4)
         RETURNING *`,
        [transferNumber, srcWhId, tgtWhId, actor.id, dto.notes ?? null]
      );
      const transfer = trfIns.rows[0];
      const movements: any[] = [];
      const createdItems: any[] = [];

      for (const itemDto of dto.items) {
        const materialId = parsePositiveInt(itemDto.material_id, 'material_id');
        const qty = parsePositiveNumber(itemDto.dispatched_qty ?? (itemDto as any).quantity, 'dispatched_qty');
        const lotId = itemDto.lot_id ? parsePositiveInt(itemDto.lot_id, 'lot_id') : null;

        const srcResolved = await InventoryEngineService.resolveLocationForWarehouse(
          txQuery,
          srcWhId,
          itemDto.source_location_id !== undefined && itemDto.source_location_id !== null
            ? parsePositiveInt(itemDto.source_location_id, 'source_location_id')
            : null
        );
        const tgtResolved = await InventoryEngineService.resolveLocationForWarehouse(
          txQuery,
          tgtWhId,
          itemDto.target_location_id !== undefined && itemDto.target_location_id !== null
            ? parsePositiveInt(itemDto.target_location_id, 'target_location_id')
            : null
        );

        // Transfers preserve Global WAC without recalculating materials.weighted_avg_cost
        const currentWac = await InventoryEngineService.getCurrentGlobalWac(txQuery, materialId);

        const outRes = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: srcWhId,
          locationId: srcResolved.location.id,
          materialId,
          lotId,
          stockStatus: 'AVAILABLE',
          direction: 'OUT',
          movementType: 'TRANSFER_OUT',
          quantity: qty,
          unitCost: currentWac,
          enforceAvailableOnlyCheck: true,
          sourceWarehouseId: srcWhId,
          sourceLocationId: srcResolved.location.id,
          destinationWarehouseId: tgtWhId,
          destinationLocationId: tgtResolved.location.id,
          sourceDocumentType: 'TRANSFER',
          sourceDocumentId: transfer.id,
          sourceDocumentRef: transferNumber,
          actorId: actor.id,
          notes: `Inter-warehouse dispatch OUT to Warehouse #${tgtWhId}`,
        });

        const inTransitRes = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: tgtWhId,
          locationId: tgtResolved.location.id,
          materialId,
          lotId,
          stockStatus: 'IN_TRANSIT',
          direction: 'IN',
          movementType: 'TRANSFER_IN_TRANSIT',
          quantity: qty,
          unitCost: currentWac,
          sourceWarehouseId: srcWhId,
          sourceLocationId: srcResolved.location.id,
          destinationWarehouseId: tgtWhId,
          destinationLocationId: tgtResolved.location.id,
          sourceDocumentType: 'TRANSFER',
          sourceDocumentId: transfer.id,
          sourceDocumentRef: transferNumber,
          linkedMovementId: outRes.movement.id,
          actorId: actor.id,
          notes: `In-transit custody awaiting confirmation at Warehouse #${tgtWhId}`,
        });
        movements.push(outRes.movement, inTransitRes.movement);

        const tiIns = await txQuery<any>(
          `INSERT INTO warehouse_transfer_items (
             transfer_id, source_warehouse_id, source_location_id, target_warehouse_id, target_location_id,
             material_id, lot_id, dispatched_qty, unit_cost
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [transfer.id, srcWhId, srcResolved.location.id, tgtWhId, tgtResolved.location.id, materialId, lotId, qty, currentWac]
        );
        createdItems.push(tiIns.rows[0]);
      }

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Warehouse Keeper',
        warehouseId: tgtWhId,
        notificationType: 'GENERAL',
        severity: 'INFO',
        title: `Inbound Transfer Dispatched: ${transferNumber}`,
        message: `Transfer ${transferNumber} is IN_TRANSIT from Warehouse #${srcWhId}.`,
        entityType: 'WAREHOUSE_TRANSFER',
        entityId: transfer.id,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_TRANSFER_DISPATCH',
          entityType: 'WAREHOUSE_TRANSFER',
          entityId: transfer.id,
          details: { transfer_number: transferNumber, source_warehouse_id: srcWhId, target_warehouse_id: tgtWhId },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { transfer, items: createdItems, movements };
    });
  }

  /**
   * Step 2 of Inter-Warehouse Transfer (DEC-07): Destination receive with discrepancy handling.
   */
  static async receiveInterWarehouseTransfer(
    transferId: number,
    dto: {
      items: Array<{
        transfer_item_id: number;
        received_qty: number;
        damaged_qty?: number;
        discrepancy_qty?: number;
        notes?: string | null;
      }>;
      notes?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw badRequest('At least one received transfer item is required');
    }

    return withTransaction(async (txQuery) => {
      const trfRes = await txQuery<any>(`SELECT * FROM warehouse_transfers WHERE id = $1 FOR UPDATE`, [transferId]);
      if (trfRes.rowCount === 0) throw notFound(`Transfer #${transferId} not found`);
      const transfer = trfRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(transfer.target_warehouse_id)) {
        throw forbidden(`Target Warehouse #${transfer.target_warehouse_id} is outside your assigned scope`);
      }

      if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'DISPATCHED') {
        throw conflict(`Transfer ${transfer.transfer_number} is already "${transfer.status}"`, 'ALREADY_RECEIVED');
      }

      const dbItemsRes = await txQuery<any>(
        `SELECT * FROM warehouse_transfer_items WHERE transfer_id = $1 FOR UPDATE`,
        [transferId]
      );
      const dbItemMap = new Map<number, any>(dbItemsRes.rows.map((r) => [r.id, r]));
      if (dto.items.length !== dbItemsRes.rowCount) {
        throw badRequest('All transfer lines must be accounted for on receipt');
      }

      const movements: any[] = [];
      let hasDiscrepancy = false;

      for (const itemDto of dto.items) {
        const tiId = parsePositiveInt(itemDto.transfer_item_id, 'transfer_item_id');
        const dbItem = dbItemMap.get(tiId);
        if (!dbItem) throw notFound(`Transfer item #${tiId} not found on Transfer #${transferId}`);

        const receivedQty = parseNonNegativeNumber(itemDto.received_qty, 'received_qty', 0);
        const damagedQty = parseNonNegativeNumber(itemDto.damaged_qty, 'damaged_qty', 0);
        const discrepancyQty = parseNonNegativeNumber(itemDto.discrepancy_qty, 'discrepancy_qty', 0);
        const dispatchedQty = roundQty(Number(dbItem.dispatched_qty));

        if (roundQty(receivedQty + damagedQty + discrepancyQty) !== dispatchedQty) {
          throw badRequest(
            `Transfer receipt reconciliation mismatch on item #${tiId}: received (${receivedQty}) + damaged (${damagedQty}) + discrepancy (${discrepancyQty}) must equal dispatched (${dispatchedQty})`
          );
        }

        if (damagedQty > 0 || discrepancyQty > 0) {
          hasDiscrepancy = true;
        }

        const unitCost = roundQty(Number(dbItem.unit_cost));
        const clearTransitQty = roundQty(receivedQty + damagedQty);

        if (clearTransitQty > 0) {
          const outTransit = await InventoryEngineService.applyBalanceChange(txQuery, {
            warehouseId: dbItem.target_warehouse_id,
            locationId: dbItem.target_location_id,
            materialId: dbItem.material_id,
            lotId: dbItem.lot_id,
            stockStatus: 'IN_TRANSIT',
            direction: 'OUT',
            movementType: 'TRANSFER_IN',
            quantity: clearTransitQty,
            unitCost,
            sourceWarehouseId: dbItem.source_warehouse_id,
            sourceLocationId: dbItem.source_location_id,
            destinationWarehouseId: dbItem.target_warehouse_id,
            destinationLocationId: dbItem.target_location_id,
            sourceDocumentType: 'TRANSFER',
            sourceDocumentId: transfer.id,
            sourceDocumentRef: transfer.transfer_number,
            actorId: actor.id,
            notes: `Clear IN_TRANSIT custody on destination receipt`,
          });
          movements.push(outTransit.movement);

          if (receivedQty > 0) {
            const inAvail = await InventoryEngineService.applyBalanceChange(txQuery, {
              warehouseId: dbItem.target_warehouse_id,
              locationId: dbItem.target_location_id,
              materialId: dbItem.material_id,
              lotId: dbItem.lot_id,
              stockStatus: 'AVAILABLE',
              direction: 'IN',
              movementType: 'TRANSFER_IN',
              quantity: receivedQty,
              unitCost,
              sourceWarehouseId: dbItem.source_warehouse_id,
              sourceLocationId: dbItem.source_location_id,
              destinationWarehouseId: dbItem.target_warehouse_id,
              destinationLocationId: dbItem.target_location_id,
              sourceDocumentType: 'TRANSFER',
              sourceDocumentId: transfer.id,
              sourceDocumentRef: transfer.transfer_number,
              linkedMovementId: outTransit.movement.id,
              actorId: actor.id,
              notes: `Transfer received into AVAILABLE`,
            });
            movements.push(inAvail.movement);
          }

          if (damagedQty > 0) {
            const inDmg = await InventoryEngineService.applyBalanceChange(txQuery, {
              warehouseId: dbItem.target_warehouse_id,
              locationId: dbItem.target_location_id,
              materialId: dbItem.material_id,
              lotId: dbItem.lot_id,
              stockStatus: 'DAMAGED',
              direction: 'IN',
              movementType: 'TRANSFER_IN',
              quantity: damagedQty,
              unitCost,
              sourceWarehouseId: dbItem.source_warehouse_id,
              sourceLocationId: dbItem.source_location_id,
              destinationWarehouseId: dbItem.target_warehouse_id,
              destinationLocationId: dbItem.target_location_id,
              sourceDocumentType: 'TRANSFER',
              sourceDocumentId: transfer.id,
              sourceDocumentRef: transfer.transfer_number,
              linkedMovementId: outTransit.movement.id,
              actorId: actor.id,
              notes: `Transfer damaged in transit`,
            });
            movements.push(inDmg.movement);
          }
        }

        await txQuery(
          `UPDATE warehouse_transfer_items
           SET received_qty = $1, damaged_qty = $2, discrepancy_qty = $3, notes = COALESCE($4, notes)
           WHERE id = $5`,
          [receivedQty, damagedQty, discrepancyQty, itemDto.notes ?? null, tiId]
        );
      }

      const finalStatus = hasDiscrepancy ? 'RECEIVED_WITH_DISCREPANCY' : 'RECEIVED';
      const updRes = await txQuery<any>(
        `UPDATE warehouse_transfers
         SET status = $1, received_by = $2, received_at = NOW(),
             notes = COALESCE($3, notes), updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [finalStatus, actor.id, dto.notes ?? null, transferId]
      );

      if (hasDiscrepancy) {
        await InventoryEngineService.createNotification(txQuery, {
          targetRoleName: 'Warehouse Manager',
          warehouseId: transfer.target_warehouse_id,
          notificationType: 'RECEIPT_DISCREPANCY',
          severity: 'WARNING',
          title: `Transfer Discrepancy: ${transfer.transfer_number}`,
          message: `Inter-warehouse transfer ${transfer.transfer_number} completed with transit damage or shortage requiring manager adjustment review.`,
          entityType: 'WAREHOUSE_TRANSFER',
          entityId: transfer.id,
        });
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_TRANSFER_RECEIVE',
          entityType: 'WAREHOUSE_TRANSFER',
          entityId: transfer.id,
          details: { transfer_number: transfer.transfer_number, status: finalStatus },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { transfer: updRes.rows[0], movements };
    });
  }

  // ============================================================================
  // 5.10 Physical Stock Counts
  // ============================================================================
  static async listStockCounts(
    actor: WarehouseActor,
    filter?: { warehouse_id?: number; status?: string }
  ): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT sc.*, w.warehouse_code, w.name as warehouse_name,
             cu.username as created_by_username, au.username as approved_by_username
      FROM stock_counts sc
      JOIN warehouses w ON sc.warehouse_id = w.id
      JOIN users cu ON sc.created_by = cu.id
      LEFT JOIN users au ON sc.approved_by = au.id
      WHERE 1=1
    `;
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND sc.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND sc.status = $${params.length}`;
    }
    sql += ` ORDER BY sc.id DESC`;
    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async createStockCount(
    dto: { warehouse_id: number; count_type: 'CYCLE' | 'FULL'; notes?: string | null; material_id?: number; location_id?: number },
    actor: WarehouseActor
  ): Promise<any> {
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const countType = parseEnumValue(dto.count_type, ['CYCLE', 'FULL'] as const, 'count_type');

    return withTransaction(async (txQuery) => {
      const whRes = await txQuery<any>(`SELECT id FROM warehouses WHERE id = $1`, [warehouseId]);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

      const countNumber = generateDocRef('CNT');
      const cntIns = await txQuery<any>(
        `INSERT INTO stock_counts (count_number, warehouse_id, count_type, status, created_by, notes)
         VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $5) RETURNING *`,
        [countNumber, warehouseId, countType, actor.id, dto.notes ?? null]
      );
      const stockCount = cntIns.rows[0];

      const params: any[] = [warehouseId];
      let balSql = `
        SELECT warehouse_id, location_id, material_id, lot_id, stock_status, qty_on_hand
        FROM inventory_balances
        WHERE warehouse_id + 0 = $1
          AND stock_status IN ('AVAILABLE', 'QUARANTINE', 'HOLD', 'DAMAGED', 'SCRAP')
      `;
      if (dto.material_id) {
        params.push(parsePositiveInt(dto.material_id, 'material_id'));
        balSql += ` AND material_id + 0 = $${params.length}`;
      }
      if (dto.location_id) {
        params.push(parsePositiveInt(dto.location_id, 'location_id'));
        balSql += ` AND location_id + 0 = $${params.length}`;
      }
      balSql += ` ORDER BY id ASC`;

      const balRes = await txQuery<any>(balSql, params);
      const countItems: any[] = [];
      for (const b of balRes.rows) {
        const ciIns = await txQuery<any>(
          `INSERT INTO stock_count_items (
             count_id, warehouse_id, location_id, material_id, lot_id, stock_status, system_qty
           ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [stockCount.id, b.warehouse_id, b.location_id, b.material_id, b.lot_id, b.stock_status, b.qty_on_hand]
        );
        countItems.push(ciIns.rows[0]);
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_COUNT_CREATE',
          entityType: 'STOCK_COUNT',
          entityId: stockCount.id,
          details: { count_number: countNumber, count_type: countType, snapshot_lines: countItems.length },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { stock_count: stockCount, items: countItems };
    });
  }

  static async getStockCountById(countId: number, actor: WarehouseActor): Promise<any> {
    const cntRes = await query<any>(`SELECT * FROM stock_counts WHERE id = $1`, [countId]);
    if (cntRes.rowCount === 0) throw notFound(`Stock count #${countId} not found`);
    const sc = cntRes.rows[0];
    if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(sc.warehouse_id)) {
      throw forbidden(`Stock Count #${countId} is outside your assigned warehouse scope`);
    }
    const itemsRes = await query<any>(
      `SELECT sci.*, m.sku, m.name as material_name, l.location_code
       FROM stock_count_items sci
       JOIN materials m ON sci.material_id = m.id
       JOIN warehouse_locations l ON sci.location_id = l.id
       WHERE sci.count_id + 0 = $1 ORDER BY sci.id ASC`,
      [countId]
    );
    return { stock_count: sc, items: itemsRes.rows };
  }

  static async recordStockCountQuantities(
    countId: number,
    dto: { items: Array<{ stock_count_item_id: number; counted_qty: number; notes?: string | null }> },
    actor: WarehouseActor
  ): Promise<any> {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw badRequest('At least one counted item is required');
    }

    return withTransaction(async (txQuery) => {
      const cntRes = await txQuery<any>(`SELECT * FROM stock_counts WHERE id = $1 FOR UPDATE`, [countId]);
      if (cntRes.rowCount === 0) throw notFound(`Stock count #${countId} not found`);
      const sc = cntRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(sc.warehouse_id)) {
        throw forbidden(`Warehouse #${sc.warehouse_id} is outside your scope`);
      }
      if (!['PLANNED', 'IN_PROGRESS'].includes(sc.status)) {
        throw conflict(`Cannot record counts when status is "${sc.status}"`);
      }

      const updated: any[] = [];
      for (const itemDto of dto.items) {
        const itemId = parsePositiveInt(itemDto.stock_count_item_id, 'stock_count_item_id');
        const countedQty = parseNonNegativeNumber(itemDto.counted_qty, 'counted_qty');

        const rowRes = await txQuery<any>(
          `SELECT * FROM stock_count_items WHERE id = $1 AND count_id = $2 FOR UPDATE`,
          [itemId, countId]
        );
        if (rowRes.rowCount === 0) throw notFound(`Stock count item #${itemId} not found`);

        const sysQty = roundQty(Number(rowRes.rows[0].system_qty));
        const varianceQty = roundQty(countedQty - sysQty);

        const upd = await txQuery<any>(
          `UPDATE stock_count_items
           SET counted_qty = $1, variance_qty = $2, counted_by = $3, notes = COALESCE($4, notes)
           WHERE id = $5 RETURNING *`,
          [countedQty, varianceQty, actor.id, itemDto.notes ?? null, itemId]
        );
        updated.push(upd.rows[0]);
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_COUNT_RECORD',
          entityType: 'STOCK_COUNT',
          entityId: countId,
          details: { recorded_items: updated.length },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return updated;
    });
  }

  static async submitStockCount(countId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const cntRes = await txQuery<any>(`SELECT * FROM stock_counts WHERE id = $1 FOR UPDATE`, [countId]);
      if (cntRes.rowCount === 0) throw notFound(`Stock count #${countId} not found`);
      const sc = cntRes.rows[0];
      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(sc.warehouse_id)) {
        throw forbidden(`Warehouse #${sc.warehouse_id} is outside your scope`);
      }
      if (sc.status !== 'IN_PROGRESS') {
        throw conflict(`Stock count must be IN_PROGRESS to submit (current: ${sc.status})`);
      }

      const uncounted = await txQuery<{ cnt: string }>(
        `SELECT count(*) as cnt FROM stock_count_items WHERE count_id = $1 AND counted_qty IS NULL`,
        [countId]
      );
      if (parseInt(String(uncounted.rows[0]?.cnt || '0'), 10) > 0) {
        throw badRequest('All count lines must have a recorded counted_qty before submitting');
      }

      const upd = await txQuery<any>(
        `UPDATE stock_counts SET status = 'SUBMITTED_FOR_REVIEW', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [countId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Warehouse Manager',
        warehouseId: sc.warehouse_id,
        notificationType: 'APPROVAL_REQUIRED',
        severity: 'INFO',
        title: `Stock Count Review Required: ${sc.count_number}`,
        message: `Stock count ${sc.count_number} is submitted for variance review.`,
        entityType: 'STOCK_COUNT',
        entityId: countId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_COUNT_SUBMIT',
          entityType: 'STOCK_COUNT',
          entityId: countId,
          details: { count_number: sc.count_number },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  /**
   * Approve a physical stock count and post variance movements cleanly through stock_adjustments + stock_movements.
   */
  static async approveStockCount(countId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const cntRes = await txQuery<any>(`SELECT * FROM stock_counts WHERE id = $1 FOR UPDATE`, [countId]);
      if (cntRes.rowCount === 0) throw notFound(`Stock count #${countId} not found`);
      const sc = cntRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(sc.warehouse_id)) {
        throw forbidden(`Warehouse #${sc.warehouse_id} is outside your scope`);
      }
      if (sc.status !== 'SUBMITTED_FOR_REVIEW') {
        throw conflict(`Stock count must be SUBMITTED_FOR_REVIEW (current: ${sc.status})`);
      }

      const itemsRes = await txQuery<any>(
        `SELECT * FROM stock_count_items WHERE count_id = $1 ORDER BY id ASC FOR UPDATE`,
        [countId]
      );

      const thresholdRaw = await InventoryEngineService.getSettingValue(txQuery, 'adjustment_approval_threshold');
      const isThresholdConfigured = thresholdRaw !== null && thresholdRaw !== 'UNCONFIGURED' && !isNaN(Number(thresholdRaw));
      const thresholdValue = isThresholdConfigured ? Number(thresholdRaw) : null;
      const canApproveHigh = actor.permissions.includes('inventory:adjust:approve_high');

      const generatedAdjustments: any[] = [];
      const movements: any[] = [];

      for (const item of itemsRes.rows) {
        const variance = roundQty(Number(item.variance_qty || 0));
        if (variance === 0) continue;

        const makerId = item.counted_by || sc.created_by;
        if (makerId === actor.id) {
          throw forbidden('Maker-checker violation: counter/creator cannot approve own stock count variance', 'MAKER_CHECKER_VIOLATION');
        }

        const direction: 'IN' | 'OUT' = variance > 0 ? 'IN' : 'OUT';
        const absQty = roundQty(Math.abs(variance));
        const unitCost = await InventoryEngineService.getCurrentGlobalWac(txQuery, item.material_id);
        const adjValue = roundQty(absQty * unitCost);
        const requiresFactoryManager = !isThresholdConfigured || adjValue > (thresholdValue as number);

        if (requiresFactoryManager && !canApproveHigh) {
          throw forbidden(
            `Variance adjustment value (${adjValue}) requires Factory Manager approval (threshold: ${thresholdRaw ?? 'UNCONFIGURED'})`,
            'FACTORY_MANAGER_APPROVAL_REQUIRED'
          );
        }

        const reasonCode = direction === 'IN' ? 'CYCLE_COUNT_GAIN' : 'CYCLE_COUNT_LOSS';
        const adjNumber = generateDocRef('ADJ');
        const adjIns = await txQuery<any>(
          `INSERT INTO stock_adjustments (
             adjustment_number, warehouse_id, location_id, material_id, lot_id, stock_status,
             stock_count_id, direction, quantity, unit_cost, reason_code, requires_factory_manager,
             status, submitted_by, approved_by, approved_at, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'APPROVED_AND_POSTED', $13, $14, NOW(), $15)
           RETURNING *`,
          [
            adjNumber,
            item.warehouse_id,
            item.location_id,
            item.material_id,
            item.lot_id,
            item.stock_status,
            sc.id,
            direction,
            absQty,
            unitCost,
            reasonCode,
            requiresFactoryManager,
            makerId,
            actor.id,
            `Generated from stock count ${sc.count_number}`,
          ]
        );
        const adj = adjIns.rows[0];
        generatedAdjustments.push(adj);

        if (direction === 'IN' && item.stock_status === 'AVAILABLE') {
          await InventoryEngineService.applyGlobalWacInbound(txQuery, {
            materialId: item.material_id,
            incomingQty: absQty,
            incomingUnitCost: unitCost,
          });
        } else if (direction === 'OUT' && item.stock_status === 'AVAILABLE') {
          await InventoryEngineService.applyGlobalWacOutbound(txQuery, {
            materialId: item.material_id,
            outgoingQty: absQty,
          });
        }

        const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
          warehouseId: item.warehouse_id,
          locationId: item.location_id,
          materialId: item.material_id,
          lotId: item.lot_id,
          stockStatus: item.stock_status,
          direction,
          movementType: direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: absQty,
          unitCost,
          sourceDocumentType: 'STOCK_ADJUSTMENT',
          sourceDocumentId: adj.id,
          sourceDocumentRef: adjNumber,
          actorId: actor.id,
          notes: `Cycle count variance adjustment (${sc.count_number})`,
        });
        movements.push(mv.movement);
      }

      const upd = await txQuery<any>(
        `UPDATE stock_counts
         SET status = 'APPROVED_AND_POSTED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [actor.id, countId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_STOCK_COUNT_APPROVE',
          entityType: 'STOCK_COUNT',
          entityId: countId,
          details: { count_number: sc.count_number, adjustments_posted: generatedAdjustments.length },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { stock_count: upd.rows[0], adjustments: generatedAdjustments, movements };
    });
  }

  // ============================================================================
  // 5.11 Stock Adjustments & Write-Offs (DEC-08 & PARAM-01)
  // ============================================================================
  static async listAdjustments(actor: WarehouseActor, filter?: { warehouse_id?: number; status?: string }): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT sa.*, w.warehouse_code, l.location_code, m.sku, m.name as material_name,
             su.username as submitted_by_username, au.username as approved_by_username
      FROM stock_adjustments sa
      JOIN warehouses w ON sa.warehouse_id = w.id
      JOIN warehouse_locations l ON sa.location_id = l.id
      JOIN materials m ON sa.material_id = m.id
      JOIN users su ON sa.submitted_by = su.id
      LEFT JOIN users au ON sa.approved_by = au.id
      WHERE 1=1
    `;
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND sa.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND sa.status = $${params.length}`;
    }
    sql += ` ORDER BY sa.id DESC`;
    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async createAdjustment(
    dto: {
      warehouse_id: number;
      location_id?: number | null;
      material_id: number;
      lot_id?: number | null;
      stock_status?: string;
      direction: 'IN' | 'OUT';
      quantity: number;
      unit_cost?: number;
      reason_code: string;
      notes?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const materialId = parsePositiveInt(dto.material_id, 'material_id');
    const direction = parseEnumValue(dto.direction, ['IN', 'OUT'] as const, 'direction');
    const quantity = parsePositiveNumber(dto.quantity, 'quantity');
    const reasonCode = parseEnumValue(dto.reason_code, ADJUSTMENT_REASON_CODES, 'reason_code');
    const stockStatus = dto.stock_status
      ? parseEnumValue(dto.stock_status, STOCK_STATUSES.filter((s) => s !== 'IN_TRANSIT') as any, 'stock_status')
      : 'AVAILABLE';
    const lotId = dto.lot_id ? parsePositiveInt(dto.lot_id, 'lot_id') : null;

    if (reasonCode === 'WRITE_OFF' && direction !== 'OUT') {
      throw badRequest('WRITE_OFF adjustment direction must be OUT');
    }

    return withTransaction(async (txQuery) => {
      const { location } = await InventoryEngineService.resolveLocationForWarehouse(
        txQuery,
        warehouseId,
        dto.location_id !== undefined && dto.location_id !== null
          ? parsePositiveInt(dto.location_id, 'location_id')
          : null
      );

      const currentWac = await InventoryEngineService.getCurrentGlobalWac(txQuery, materialId);
      const unitCost =
        dto.unit_cost !== undefined && dto.unit_cost !== null
          ? parseNonNegativeNumber(dto.unit_cost, 'unit_cost')
          : currentWac;

      const thresholdRaw = await InventoryEngineService.getSettingValue(txQuery, 'adjustment_approval_threshold');
      const isThresholdConfigured =
        thresholdRaw !== null && thresholdRaw !== 'UNCONFIGURED' && !isNaN(Number(thresholdRaw));
      const adjValue = roundQty(quantity * unitCost);

      // DEC-08 + PARAM-01: WRITE_OFF or unconfigured threshold or value > threshold => requires Factory Manager
      const requiresFactoryManager =
        reasonCode === 'WRITE_OFF' ||
        !isThresholdConfigured ||
        adjValue > Number(thresholdRaw);

      const adjNumber = generateDocRef('ADJ');
      const ins = await txQuery<any>(
        `INSERT INTO stock_adjustments (
           adjustment_number, warehouse_id, location_id, material_id, lot_id, stock_status,
           direction, quantity, unit_cost, reason_code, requires_factory_manager,
           status, submitted_by, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING_APPROVAL', $12, $13)
         RETURNING *`,
        [
          adjNumber,
          warehouseId,
          location.id,
          materialId,
          lotId,
          stockStatus,
          direction,
          quantity,
          unitCost,
          reasonCode,
          requiresFactoryManager,
          actor.id,
          dto.notes ?? null,
        ]
      );
      const adj = ins.rows[0];

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: requiresFactoryManager ? 'Factory Manager' : 'Warehouse Manager',
        warehouseId,
        notificationType: 'APPROVAL_REQUIRED',
        severity: reasonCode === 'WRITE_OFF' ? 'CRITICAL' : 'WARNING',
        title: `Adjustment Approval Needed: ${adjNumber}`,
        message: `${reasonCode} (${direction} ${quantity}) requires ${requiresFactoryManager ? 'Factory Manager' : 'Warehouse Manager'} approval.`,
        entityType: 'STOCK_ADJUSTMENT',
        entityId: adj.id,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_ADJUSTMENT_SUBMIT',
          entityType: 'STOCK_ADJUSTMENT',
          entityId: adj.id,
          details: {
            adjustment_number: adjNumber,
            reason_code: reasonCode,
            direction,
            quantity,
            requires_factory_manager: requiresFactoryManager,
          },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return adj;
    });
  }

  static async approveAdjustment(adjustmentId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const adjRes = await txQuery<any>(`SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`, [adjustmentId]);
      if (adjRes.rowCount === 0) throw notFound(`Stock adjustment #${adjustmentId} not found`);
      const adj = adjRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(adj.warehouse_id)) {
        throw forbidden(`Adjustment #${adjustmentId} is outside your assigned warehouse scope`);
      }

      if (adj.status !== 'PENDING_APPROVAL' && adj.status !== 'DRAFT') {
        throw conflict(`Adjustment ${adj.adjustment_number} is already "${adj.status}"`);
      }

      // Mandatory Maker-Checker
      if (adj.submitted_by === actor.id) {
        throw forbidden(
          'Maker-checker violation: you cannot approve your own submitted stock adjustment',
          'MAKER_CHECKER_VIOLATION'
        );
      }

      // DEC-08 + PARAM-01 Factory Manager escalation rule
      if (adj.reason_code === 'WRITE_OFF' || adj.requires_factory_manager) {
        if (!actor.permissions.includes('inventory:adjust:approve_high')) {
          throw forbidden(
            adj.reason_code === 'WRITE_OFF'
              ? 'All WRITE_OFF adjustments unconditionally require Factory Manager approval (inventory:adjust:approve_high)'
              : 'High-value or unconfigured-threshold adjustment requires Factory Manager approval (inventory:adjust:approve_high)',
            'FACTORY_MANAGER_APPROVAL_REQUIRED'
          );
        }
      }

      const qty = roundQty(Number(adj.quantity));
      let unitCost = roundQty(Number(adj.unit_cost));

      if (adj.stock_status === 'AVAILABLE') {
        if (adj.direction === 'IN') {
          await InventoryEngineService.applyGlobalWacInbound(txQuery, {
            materialId: adj.material_id,
            incomingQty: qty,
            incomingUnitCost: unitCost,
          });
        } else {
          const outWac = await InventoryEngineService.applyGlobalWacOutbound(txQuery, {
            materialId: adj.material_id,
            outgoingQty: qty,
          });
          unitCost = outWac.unit_cost;
        }
      }

      const movementType =
        adj.reason_code === 'WRITE_OFF'
          ? 'WRITE_OFF'
          : adj.direction === 'IN'
            ? 'ADJUSTMENT_IN'
            : 'ADJUSTMENT_OUT';

      const mv = await InventoryEngineService.applyBalanceChange(txQuery, {
        warehouseId: adj.warehouse_id,
        locationId: adj.location_id,
        materialId: adj.material_id,
        lotId: adj.lot_id,
        stockStatus: adj.stock_status,
        direction: adj.direction,
        movementType,
        quantity: qty,
        unitCost,
        enforceAvailableOnlyCheck: adj.stock_status === 'AVAILABLE' && adj.direction === 'OUT',
        sourceDocumentType: 'STOCK_ADJUSTMENT',
        sourceDocumentId: adj.id,
        sourceDocumentRef: adj.adjustment_number,
        actorId: actor.id,
        notes: `Approved ${adj.reason_code}: ${adj.notes || ''}`.trim(),
      });

      const updRes = await txQuery<any>(
        `UPDATE stock_adjustments
         SET status = 'APPROVED_AND_POSTED', unit_cost = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [unitCost, actor.id, adj.id]
      );

      if (adj.direction === 'OUT' && adj.stock_status === 'AVAILABLE') {
        await InventoryEngineService.checkLowStockAndNotify(txQuery, adj.warehouse_id, adj.material_id);
      }

      await AuditService.log(
        {
          userId: actor.id,
          action: adj.reason_code === 'WRITE_OFF' ? 'WMS_WRITE_OFF_APPROVE' : 'WMS_ADJUSTMENT_APPROVE',
          entityType: 'STOCK_ADJUSTMENT',
          entityId: adj.id,
          details: { adjustment_number: adj.adjustment_number, reason_code: adj.reason_code, quantity: qty },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return { adjustment: updRes.rows[0], balance: mv.balance, movement: mv.movement };
    });
  }

  static async rejectAdjustment(adjustmentId: number, reason: string | undefined, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const adjRes = await txQuery<any>(`SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`, [adjustmentId]);
      if (adjRes.rowCount === 0) throw notFound(`Stock adjustment #${adjustmentId} not found`);
      const adj = adjRes.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(adj.warehouse_id)) {
        throw forbidden(`Adjustment #${adjustmentId} is outside your assigned warehouse scope`);
      }
      if (adj.status !== 'PENDING_APPROVAL' && adj.status !== 'DRAFT') {
        throw conflict(`Adjustment ${adj.adjustment_number} is already "${adj.status}"`);
      }
      if (adj.submitted_by === actor.id) {
        throw forbidden('Maker-checker violation: cannot reject/decide own adjustment', 'MAKER_CHECKER_VIOLATION');
      }

      const upd = await txQuery<any>(
        `UPDATE stock_adjustments
         SET status = 'REJECTED', approved_by = $1, approved_at = NOW(),
             notes = COALESCE(notes || ' | ', '') || $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [actor.id, reason ? `Rejected: ${reason}` : 'Rejected', adjustmentId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_ADJUSTMENT_REJECT',
          entityType: 'STOCK_ADJUSTMENT',
          entityId: adjustmentId,
          details: { adjustment_number: adj.adjustment_number, reason: reason ?? null },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  // ============================================================================
  // 5.12 Reorder Requests (DEC-10: Warehouse Manager -> Purchasing Manager -> Factory Manager)
  // ============================================================================
  static async listReorderRequests(actor: WarehouseActor, filter?: { warehouse_id?: number; status?: string }): Promise<any[]> {
    const isGlobal = hasGlobalWarehouseAccess(actor as any);
    const params: any[] = [];
    let sql = `
      SELECT rr.*, w.warehouse_code, m.sku, m.name as material_name, m.base_uom
      FROM reorder_requests rr
      JOIN warehouses w ON rr.warehouse_id = w.id
      JOIN materials m ON rr.material_id = m.id
      WHERE 1=1
    `;
    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id);
      sql += ` AND rr.warehouse_id + 0 = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND rr.status = $${params.length}`;
    }
    sql += ` ORDER BY rr.id DESC`;
    const res = await query<any>(sql, params);
    const allowedSet = new Set(actor.managed_warehouse_ids);
    return res.rows.filter((r) => isGlobal || allowedSet.has(r.warehouse_id));
  }

  static async createReorderRequest(
    dto: {
      material_id: number;
      warehouse_id: number;
      requested_qty: number;
      priority?: 'NORMAL' | 'URGENT';
      required_date?: string | null;
      justification?: string | null;
    },
    actor: WarehouseActor
  ): Promise<any> {
    const materialId = parsePositiveInt(dto.material_id, 'material_id');
    const warehouseId = parsePositiveInt(dto.warehouse_id, 'warehouse_id');
    const requestedQty = parsePositiveNumber(dto.requested_qty, 'requested_qty');
    const priority = dto.priority ? parseEnumValue(dto.priority, ['NORMAL', 'URGENT'] as const, 'priority') : 'NORMAL';

    return withTransaction(async (txQuery) => {
      const [matRes, whRes, availRes] = await Promise.all([
        txQuery<any>(`SELECT id, sku, reorder_level, status FROM materials WHERE id = $1`, [materialId]),
        txQuery<any>(`SELECT id, status FROM warehouses WHERE id = $1`, [warehouseId]),
        txQuery<{ total_avail: string }>(
          `SELECT COALESCE(SUM(qty_available), 0) as total_avail
           FROM inventory_balances WHERE warehouse_id = $1 AND material_id = $2 AND stock_status = 'AVAILABLE'`,
          [warehouseId, materialId]
        ),
      ]);
      if (matRes.rowCount === 0) throw notFound(`Material #${materialId} not found`);
      if (whRes.rowCount === 0) throw notFound(`Warehouse #${warehouseId} not found`);

      const reqNumber = generateDocRef('REO');
      const ins = await txQuery<any>(
        `INSERT INTO reorder_requests (
           request_number, material_id, warehouse_id, available_qty_at_request,
           reorder_level_snapshot, requested_qty, priority, required_date,
           status, requested_by, justification
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, 'OPEN', $9, $10)
         RETURNING *`,
        [
          reqNumber,
          materialId,
          warehouseId,
          roundQty(Number(availRes.rows[0]?.total_avail || 0)),
          roundQty(Number(matRes.rows[0].reorder_level || 0)),
          requestedQty,
          priority,
          dto.required_date ?? null,
          actor.id,
          dto.justification ?? null,
        ]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REORDER_CREATE',
          entityType: 'REORDER_REQUEST',
          entityId: ins.rows[0].id,
          details: { request_number: reqNumber, material_id: materialId, requested_qty: requestedQty },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return ins.rows[0];
    });
  }

  static async submitReorderRequest(reorderId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const res = await txQuery<any>(`SELECT * FROM reorder_requests WHERE id = $1 FOR UPDATE`, [reorderId]);
      if (res.rowCount === 0) throw notFound(`Reorder request #${reorderId} not found`);
      const rr = res.rows[0];

      if (!hasGlobalWarehouseAccess(actor as any) && !actor.managed_warehouse_ids.includes(rr.warehouse_id)) {
        throw forbidden(`Reorder #${reorderId} is outside your assigned warehouse scope`);
      }
      if (rr.status !== 'OPEN') {
        throw conflict(`Reorder request must be OPEN to submit (current: ${rr.status})`);
      }

      const upd = await txQuery<any>(
        `UPDATE reorder_requests SET status = 'SUBMITTED', submitted_by = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [actor.id, reorderId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Purchasing Manager',
        warehouseId: rr.warehouse_id,
        notificationType: 'APPROVAL_REQUIRED',
        severity: rr.priority === 'URGENT' ? 'WARNING' : 'INFO',
        title: `Reorder Purchasing Review: ${rr.request_number}`,
        message: `Reorder request ${rr.request_number} submitted by Warehouse Manager for sourcing review.`,
        entityType: 'REORDER_REQUEST',
        entityId: reorderId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REORDER_SUBMIT',
          entityType: 'REORDER_REQUEST',
          entityId: reorderId,
          details: { request_number: rr.request_number },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async reviewReorderRequest(
    reorderId: number,
    dto: { supplier_note?: string | null; po_reference?: string | null },
    actor: WarehouseActor
  ): Promise<any> {
    return withTransaction(async (txQuery) => {
      const res = await txQuery<any>(`SELECT * FROM reorder_requests WHERE id = $1 FOR UPDATE`, [reorderId]);
      if (res.rowCount === 0) throw notFound(`Reorder request #${reorderId} not found`);
      const rr = res.rows[0];

      if (rr.status !== 'SUBMITTED') {
        throw conflict(
          `Reorder request must be SUBMITTED by Warehouse Manager before Purchasing review (current: ${rr.status})`,
          'INVALID_REORDER_STAGE'
        );
      }

      const upd = await txQuery<any>(
        `UPDATE reorder_requests
         SET status = 'PURCHASING_REVIEWED',
             purchasing_reviewed_by = $1,
             purchasing_reviewed_at = NOW(),
             supplier_note = COALESCE($2, supplier_note),
             po_reference = COALESCE($3, po_reference),
             updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [actor.id, dto.supplier_note ?? null, dto.po_reference ?? null, reorderId]
      );

      await InventoryEngineService.createNotification(txQuery, {
        targetRoleName: 'Factory Manager',
        warehouseId: rr.warehouse_id,
        notificationType: 'APPROVAL_REQUIRED',
        severity: rr.priority === 'URGENT' ? 'WARNING' : 'INFO',
        title: `Reorder Final Approval Needed: ${rr.request_number}`,
        message: `Purchasing reviewed ${rr.request_number}; awaiting Factory Manager approval.`,
        entityType: 'REORDER_REQUEST',
        entityId: reorderId,
      });

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REORDER_REVIEW',
          entityType: 'REORDER_REQUEST',
          entityId: reorderId,
          details: { request_number: rr.request_number, po_reference: dto.po_reference ?? null },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async approveReorderRequest(reorderId: number, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const res = await txQuery<any>(`SELECT * FROM reorder_requests WHERE id = $1 FOR UPDATE`, [reorderId]);
      if (res.rowCount === 0) throw notFound(`Reorder request #${reorderId} not found`);
      const rr = res.rows[0];

      if (rr.status !== 'PURCHASING_REVIEWED') {
        throw conflict(
          `Reorder request must complete PURCHASING_REVIEWED before Factory Manager approval (current: ${rr.status})`,
          'INVALID_REORDER_STAGE'
        );
      }

      const upd = await txQuery<any>(
        `UPDATE reorder_requests
         SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [actor.id, reorderId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REORDER_APPROVE',
          entityType: 'REORDER_REQUEST',
          entityId: reorderId,
          details: { request_number: rr.request_number },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }

  static async rejectReorderRequest(reorderId: number, reason: string | undefined, actor: WarehouseActor): Promise<any> {
    return withTransaction(async (txQuery) => {
      const res = await txQuery<any>(`SELECT * FROM reorder_requests WHERE id = $1 FOR UPDATE`, [reorderId]);
      if (res.rowCount === 0) throw notFound(`Reorder request #${reorderId} not found`);
      const rr = res.rows[0];

      if (!['OPEN', 'SUBMITTED', 'PURCHASING_REVIEWED'].includes(rr.status)) {
        throw conflict(`Cannot reject reorder request in status "${rr.status}"`);
      }

      const upd = await txQuery<any>(
        `UPDATE reorder_requests
         SET status = 'REJECTED', justification = COALESCE(justification || ' | ', '') || $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason ? `Rejected: ${reason}` : 'Rejected', reorderId]
      );

      await AuditService.log(
        {
          userId: actor.id,
          action: 'WMS_REORDER_REJECT',
          entityType: 'REORDER_REQUEST',
          entityId: reorderId,
          details: { request_number: rr.request_number, reason: reason ?? null },
          ipAddress: actor.ipAddress,
        },
        txQuery
      );

      return upd.rows[0];
    });
  }
}
