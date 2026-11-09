import { query, QueryFn } from '../../config/database.ts';
import {
  badRequest,
  conflict,
  generateDocRef,
  notFound,
  roundQty,
} from './warehouse.errors.ts';
import { MovementType, StockStatus } from './warehouse.types.ts';

export interface BalanceChangeParams {
  warehouseId: number;
  locationId: number;
  materialId: number;
  lotId?: number | null;
  stockStatus: StockStatus;
  direction: 'IN' | 'OUT';
  movementType: MovementType;
  quantity: number;
  unitCost: number;
  sourceWarehouseId?: number | null;
  sourceLocationId?: number | null;
  destinationWarehouseId?: number | null;
  destinationLocationId?: number | null;
  sourceDocumentType: string;
  sourceDocumentId: number;
  sourceDocumentRef?: string | null;
  linkedMovementId?: number | null;
  reversedMovementId?: number | null;
  actorId: number;
  notes?: string | null;
  consumeReservedQty?: number;
  enforceAvailableOnlyCheck?: boolean;
}

export interface BalanceRow {
  id: number;
  warehouse_id: number;
  location_id: number;
  material_id: number;
  lot_id: number | null;
  lot_key: string;
  stock_status: StockStatus;
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
}

export interface MovementRow {
  id: number;
  movement_ref: string;
  material_id: number;
  lot_id: number | null;
  warehouse_id: number;
  location_id: number;
  stock_status: StockStatus;
  direction: 'IN' | 'OUT';
  movement_type: MovementType;
  quantity: string;
  balance_before: string;
  balance_after: string;
  unit_cost: string;
  total_cost: string;
  source_document_type: string;
  source_document_id: number;
  source_document_ref: string | null;
  linked_movement_id: number | null;
  reversed_movement_id: number | null;
  actor_id: number;
  created_at: string;
}

export function normalizeLotKey(lotId?: number | null): string {
  return lotId !== undefined && lotId !== null ? String(lotId) : 'NONE';
}

export class InventoryEngineService {
  /**
   * Resolve explicit bin or mandatory DEFAULT bin according to warehouse configuration (DEC-01).
   */
  static async resolveLocationForWarehouse(
    txQuery: QueryFn,
    warehouseId: number,
    requestedLocationId?: number | null
  ): Promise<{ warehouse: any; location: any }> {
    const whRes = await txQuery<any>(
      `SELECT id, warehouse_code, name, warehouse_type, require_bin_tracking, status
       FROM warehouses WHERE id = $1`,
      [warehouseId]
    );
    if (whRes.rowCount === 0) {
      throw notFound(`Warehouse #${warehouseId} not found`);
    }
    const warehouse = whRes.rows[0];
    if (warehouse.status !== 'active') {
      throw badRequest(`Warehouse ${warehouse.warehouse_code} is inactive`, 'INACTIVE_WAREHOUSE');
    }

    if (requestedLocationId !== undefined && requestedLocationId !== null) {
      const locRes = await txQuery<any>(
        `SELECT id, warehouse_id, location_code, name, location_type, is_default, status
         FROM warehouse_locations WHERE id = $1 AND warehouse_id = $2`,
        [requestedLocationId, warehouseId]
      );
      if (locRes.rowCount === 0) {
        throw badRequest(
          `Location #${requestedLocationId} does not belong to Warehouse #${warehouseId}`,
          'INVALID_LOCATION'
        );
      }
      if (locRes.rows[0].status !== 'active') {
        throw badRequest(
          `Location ${locRes.rows[0].location_code} is inactive`,
          'INACTIVE_LOCATION'
        );
      }
      return { warehouse, location: locRes.rows[0] };
    }

    if (warehouse.require_bin_tracking) {
      throw badRequest(
        `Warehouse ${warehouse.warehouse_code} requires an explicit bin/location_id`,
        'BIN_REQUIRED'
      );
    }

    const defaultRes = await txQuery<any>(
      `SELECT id, warehouse_id, location_code, name, location_type, is_default, status
       FROM warehouse_locations
       WHERE warehouse_id = $1 AND is_default = TRUE AND status = 'active'
       ORDER BY id ASC LIMIT 1`,
      [warehouseId]
    );
    if (defaultRes.rowCount === 0) {
      throw notFound(`Default location missing for Warehouse #${warehouseId}`);
    }

    return { warehouse, location: defaultRes.rows[0] };
  }

  /**
   * Read a warehouse policy setting value from warehouse_settings.
   */
  static async getSettingValue(txQuery: QueryFn, settingKey: string): Promise<string | null> {
    const res = await txQuery<{ setting_value: string }>(
      `SELECT setting_value FROM warehouse_settings WHERE setting_key = $1`,
      [settingKey]
    );
    return res.rowCount > 0 ? res.rows[0].setting_value : null;
  }

  /**
   * Atomically update inventory_balances and append an immutable stock_movements record.
   * Uses SELECT ... FOR UPDATE on existing balance rows.
   * Must always run inside withTransaction(...).
   */
  static async applyBalanceChange(
    txQuery: QueryFn,
    params: BalanceChangeParams
  ): Promise<{ balance: BalanceRow; movement: MovementRow }> {
    const qty = roundQty(params.quantity);
    if (qty <= 0) {
      throw badRequest('Movement quantity must be greater than zero');
    }

    const unitCost = roundQty(Math.max(0, params.unitCost || 0));
    const totalCost = roundQty(qty * unitCost);
    const lotId = params.lotId ?? null;
    const lotKey = normalizeLotKey(lotId);

    const existingRes = await txQuery<BalanceRow>(
      `SELECT id, warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved, qty_available
       FROM inventory_balances
       WHERE warehouse_id = $1 AND location_id = $2 AND material_id = $3 AND lot_key = $4 AND stock_status = $5
       FOR UPDATE`,
      [params.warehouseId, params.locationId, params.materialId, lotKey, params.stockStatus]
    );

    let balanceBefore = 0;
    let currentReserved = 0;
    let existingRowId: number | null = null;

    if (existingRes.rowCount > 0) {
      const row = existingRes.rows[0];
      existingRowId = row.id;
      balanceBefore = roundQty(Number(row.qty_on_hand));
      currentReserved = roundQty(Number(row.qty_reserved));
    }

    let balanceAfter = balanceBefore;
    let newReserved = currentReserved;

    if (params.direction === 'IN') {
      balanceAfter = roundQty(balanceBefore + qty);
    } else {
      if (params.enforceAvailableOnlyCheck && params.stockStatus !== 'AVAILABLE') {
        throw badRequest(
          `Cannot issue non-AVAILABLE stock (current status: ${params.stockStatus})`,
          'NON_AVAILABLE_STOCK'
        );
      }

      if (existingRowId === null || balanceBefore < qty) {
        throw conflict(
          `Insufficient ${params.stockStatus} stock on hand for material #${params.materialId} at location #${params.locationId} (on hand: ${balanceBefore}, requested: ${qty})`,
          'INSUFFICIENT_STOCK'
        );
      }

      const consumeReserved = roundQty(Math.min(params.consumeReservedQty || 0, currentReserved, qty));
      newReserved = roundQty(currentReserved - consumeReserved);
      balanceAfter = roundQty(balanceBefore - qty);

      if (balanceAfter < 0) {
        throw conflict('Negative inventory is strictly prohibited', 'NEGATIVE_STOCK_PREVENTED');
      }
      if (newReserved > balanceAfter) {
        const availableUnreserved = roundQty(balanceBefore - currentReserved);
        throw conflict(
          `Insufficient unreserved stock available (available: ${availableUnreserved}, requested unreserved: ${roundQty(qty - consumeReserved)})`,
          'INSUFFICIENT_AVAILABLE_STOCK'
        );
      }
    }

    let updatedBalance: BalanceRow;
    if (existingRowId === null) {
      const insRes = await txQuery<BalanceRow>(
        `INSERT INTO inventory_balances (warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved, qty_available`,
        [
          params.warehouseId,
          params.locationId,
          params.materialId,
          lotId,
          lotKey,
          params.stockStatus,
          balanceAfter,
          newReserved,
        ]
      );
      updatedBalance = insRes.rows[0];
    } else {
      const updRes = await txQuery<BalanceRow>(
        `UPDATE inventory_balances
         SET qty_on_hand = $1, qty_reserved = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, warehouse_id, location_id, material_id, lot_id, lot_key, stock_status, qty_on_hand, qty_reserved, qty_available`,
        [balanceAfter, newReserved, existingRowId]
      );
      updatedBalance = updRes.rows[0];
    }

    const movementRef = generateDocRef('MOV');
    const movRes = await txQuery<MovementRow>(
      `INSERT INTO stock_movements (
         movement_ref, material_id, lot_id, warehouse_id, location_id, stock_status,
         direction, movement_type, quantity, balance_before, balance_after,
         unit_cost, total_cost,
         source_warehouse_id, source_location_id, destination_warehouse_id, destination_location_id,
         source_document_type, source_document_id, source_document_ref,
         linked_movement_id, reversed_movement_id, is_immutable, actor_id, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20,
         $21, $22, TRUE, $23, $24
       ) RETURNING *`,
      [
        movementRef,
        params.materialId,
        lotId,
        params.warehouseId,
        params.locationId,
        params.stockStatus,
        params.direction,
        params.movementType,
        qty,
        balanceBefore,
        balanceAfter,
        unitCost,
        totalCost,
        params.sourceWarehouseId ?? null,
        params.sourceLocationId ?? null,
        params.destinationWarehouseId ?? null,
        params.destinationLocationId ?? null,
        params.sourceDocumentType,
        params.sourceDocumentId,
        params.sourceDocumentRef ?? null,
        params.linkedMovementId ?? null,
        params.reversedMovementId ?? null,
        params.actorId,
        params.notes ?? null,
      ]
    );

    return {
      balance: updatedBalance,
      movement: movRes.rows[0],
    };
  }

  /**
   * Reserve AVAILABLE stock in a warehouse for an approved Material Requisition.
   */
  static async reserveAvailableStock(
    txQuery: QueryFn,
    params: {
      warehouseId: number;
      materialId: number;
      qtyToReserve: number;
      preferredLotId?: number | null;
    }
  ): Promise<void> {
    const qtyNeeded = roundQty(params.qtyToReserve);
    if (qtyNeeded <= 0) return;

    // Lock candidate AVAILABLE balance rows
    const candidatesRes = await txQuery<BalanceRow & { received_at?: string }>(
      `SELECT b.id, b.warehouse_id, b.location_id, b.material_id, b.lot_id, b.lot_key, b.stock_status,
              b.qty_on_hand, b.qty_reserved, b.qty_available, l.received_at
       FROM inventory_balances b
       LEFT JOIN inventory_lots l ON b.lot_id = l.id
       WHERE b.warehouse_id + 0 = $1
         AND b.material_id + 0 = $2
         AND b.stock_status = 'AVAILABLE'
         AND b.qty_on_hand > b.qty_reserved
       FOR UPDATE`,
      [params.warehouseId, params.materialId]
    );

    const rows = [...candidatesRes.rows].sort((a, b) => {
      if (params.preferredLotId) {
        if (a.lot_id === params.preferredLotId && b.lot_id !== params.preferredLotId) return -1;
        if (b.lot_id === params.preferredLotId && a.lot_id !== params.preferredLotId) return 1;
      }
      const ta = a.received_at ? new Date(a.received_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.received_at ? new Date(b.received_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });

    const totalAvailable = rows.reduce((sum, r) => sum + Number(r.qty_available), 0);
    if (roundQty(totalAvailable) < qtyNeeded) {
      throw conflict(
        `Insufficient AVAILABLE stock to reserve for material #${params.materialId} in warehouse #${params.warehouseId} (available: ${roundQty(totalAvailable)}, requested: ${qtyNeeded})`,
        'INSUFFICIENT_STOCK'
      );
    }

    let remaining = qtyNeeded;
    for (const row of rows) {
      if (remaining <= 0) break;
      const avail = roundQty(Number(row.qty_available));
      if (avail <= 0) continue;
      const take = roundQty(Math.min(avail, remaining));
      const nextReserved = roundQty(Number(row.qty_reserved) + take);
      await txQuery(
        `UPDATE inventory_balances SET qty_reserved = $1, updated_at = NOW() WHERE id = $2`,
        [nextReserved, row.id]
      );
      remaining = roundQty(remaining - take);
    }
  }

  /**
   * Release previously reserved stock (e.g., requisition cancellation or FIFO override shift).
   */
  static async releaseReservedStock(
    txQuery: QueryFn,
    params: {
      warehouseId: number;
      materialId: number;
      qtyToRelease: number;
      excludeBalanceId?: number;
    }
  ): Promise<number> {
    const qtyTarget = roundQty(params.qtyToRelease);
    if (qtyTarget <= 0) return 0;

    const reservedRes = await txQuery<BalanceRow>(
      `SELECT id, qty_reserved
       FROM inventory_balances
       WHERE warehouse_id + 0 = $1
         AND material_id + 0 = $2
         AND stock_status = 'AVAILABLE'
         AND qty_reserved > 0
       ORDER BY id ASC
       FOR UPDATE`,
      [params.warehouseId, params.materialId]
    );

    let remaining = qtyTarget;
    for (const row of reservedRes.rows) {
      if (remaining <= 0) break;
      if (params.excludeBalanceId && row.id === params.excludeBalanceId) continue;
      const currentRes = roundQty(Number(row.qty_reserved));
      if (currentRes <= 0) continue;
      const release = roundQty(Math.min(currentRes, remaining));
      await txQuery(
        `UPDATE inventory_balances SET qty_reserved = $1, updated_at = NOW() WHERE id = $2`,
        [roundQty(currentRes - release), row.id]
      );
      remaining = roundQty(remaining - release);
    }

    return roundQty(qtyTarget - remaining);
  }

  /**
   * Global Weighted Average Cost update when valued stock enters AVAILABLE inventory (PARAM-02, DEC-11).
   * Calculation executes exclusively inside application transaction logic (not DB triggers).
   */
  static async applyGlobalWacInbound(
    txQuery: QueryFn,
    params: {
      materialId: number;
      incomingQty: number;
      incomingUnitCost: number;
    }
  ): Promise<{ weighted_avg_cost: number; total_valued_qty: number; total_inventory_value: number }> {
    const qty = roundQty(params.incomingQty);
    const unitCost = roundQty(Math.max(0, params.incomingUnitCost));

    const matRes = await txQuery<{
      id: number;
      weighted_avg_cost: string;
      total_valued_qty: string;
      total_inventory_value: string;
    }>(
      `SELECT id, weighted_avg_cost, total_valued_qty, total_inventory_value
       FROM materials WHERE id = $1 FOR UPDATE`,
      [params.materialId]
    );

    if (matRes.rowCount === 0) {
      throw notFound(`Material #${params.materialId} not found`);
    }

    const mat = matRes.rows[0];
    const oldQty = roundQty(Number(mat.total_valued_qty));
    const oldValue = roundQty(Number(mat.total_inventory_value));
    const oldWac = roundQty(Number(mat.weighted_avg_cost));

    if (qty <= 0) {
      return { weighted_avg_cost: oldWac, total_valued_qty: oldQty, total_inventory_value: oldValue };
    }

    const incomingValue = roundQty(qty * unitCost);
    const newQty = roundQty(oldQty + qty);
    const newValue = roundQty(oldValue + incomingValue);
    const newWac = newQty > 0 ? roundQty(newValue / newQty) : oldWac;

    await txQuery(
      `UPDATE materials
       SET weighted_avg_cost = $1,
           total_valued_qty = $2,
           total_inventory_value = $3,
           last_cost_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [newWac, newQty, newValue, params.materialId]
    );

    return {
      weighted_avg_cost: newWac,
      total_valued_qty: newQty,
      total_inventory_value: newValue,
    };
  }

  /**
   * Global Weighted Average Cost valuation decrement when valued AVAILABLE stock leaves (ISSUE / ADJUSTMENT_OUT / WRITE_OFF).
   * Unit WAC remains constant; total_valued_qty and total_inventory_value decrease deterministically.
   */
  static async applyGlobalWacOutbound(
    txQuery: QueryFn,
    params: {
      materialId: number;
      outgoingQty: number;
    }
  ): Promise<{ unit_cost: number; total_valued_qty: number; total_inventory_value: number }> {
    const qty = roundQty(params.outgoingQty);

    const matRes = await txQuery<{
      id: number;
      weighted_avg_cost: string;
      total_valued_qty: string;
      total_inventory_value: string;
    }>(
      `SELECT id, weighted_avg_cost, total_valued_qty, total_inventory_value
       FROM materials WHERE id = $1 FOR UPDATE`,
      [params.materialId]
    );

    if (matRes.rowCount === 0) {
      throw notFound(`Material #${params.materialId} not found`);
    }

    const mat = matRes.rows[0];
    const currentWac = roundQty(Number(mat.weighted_avg_cost));
    const oldQty = roundQty(Number(mat.total_valued_qty));
    const oldValue = roundQty(Number(mat.total_inventory_value));

    if (qty <= 0) {
      return { unit_cost: currentWac, total_valued_qty: oldQty, total_inventory_value: oldValue };
    }

    const newQty = roundQty(Math.max(0, oldQty - qty));
    const deductedValue = roundQty(qty * currentWac);
    const newValue = newQty === 0 ? 0 : roundQty(Math.max(0, oldValue - deductedValue));

    await txQuery(
      `UPDATE materials
       SET total_valued_qty = $1,
           total_inventory_value = $2,
           last_cost_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [newQty, newValue, params.materialId]
    );

    return {
      unit_cost: currentWac,
      total_valued_qty: newQty,
      total_inventory_value: newValue,
    };
  }

  /**
   * Read current Global WAC for a material without modifying valuation (used by transfers).
   */
  static async getCurrentGlobalWac(txQuery: QueryFn, materialId: number): Promise<number> {
    const res = await txQuery<{ weighted_avg_cost: string }>(
      `SELECT weighted_avg_cost FROM materials WHERE id = $1`,
      [materialId]
    );
    if (res.rowCount === 0) {
      throw notFound(`Material #${materialId} not found`);
    }
    return roundQty(Number(res.rows[0].weighted_avg_cost));
  }

  /**
   * Create an in-app notification record (DEC-12).
   */
  static async createNotification(
    txQuery: QueryFn,
    params: {
      recipientUserId?: number | null;
      targetRoleName?: string | null;
      warehouseId?: number | null;
      notificationType:
        | 'LOW_STOCK'
        | 'QC_PENDING'
        | 'APPROVAL_REQUIRED'
        | 'TRANSFER_DELAYED'
        | 'RECEIPT_DISCREPANCY'
        | 'GENERAL';
      severity?: 'INFO' | 'WARNING' | 'CRITICAL';
      title: string;
      message: string;
      entityType?: string | null;
      entityId?: string | number | null;
    }
  ): Promise<void> {
    await txQuery(
      `INSERT INTO warehouse_notifications (
         recipient_user_id, target_role_name, warehouse_id,
         notification_type, severity, title, message, entity_type, entity_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.recipientUserId ?? null,
        params.targetRoleName ?? null,
        params.warehouseId ?? null,
        params.notificationType,
        params.severity || 'INFO',
        params.title,
        params.message,
        params.entityType ?? null,
        params.entityId !== undefined && params.entityId !== null ? String(params.entityId) : null,
      ]
    );
  }

  /**
   * Check post-transaction AVAILABLE stock against material reorder_level and trigger LOW_STOCK notification.
   */
  static async checkLowStockAndNotify(
    txQuery: QueryFn,
    warehouseId: number,
    materialId: number
  ): Promise<void> {
    const matRes = await txQuery<{ id: number; sku: string; name: string; reorder_level: string }>(
      `SELECT id, sku, name, reorder_level FROM materials WHERE id = $1`,
      [materialId]
    );
    if (matRes.rowCount === 0) return;
    const mat = matRes.rows[0];
    const reorderLevel = roundQty(Number(mat.reorder_level));
    if (reorderLevel <= 0) return;

    const balRes = await txQuery<{ total_avail: string }>(
      `SELECT COALESCE(SUM(qty_available), 0) as total_avail
       FROM inventory_balances
       WHERE warehouse_id + 0 = $1 AND material_id + 0 = $2 AND stock_status = 'AVAILABLE'`,
      [warehouseId, materialId]
    );
    const totalAvail = roundQty(Number(balRes.rows[0]?.total_avail || 0));

    if (totalAvail <= reorderLevel) {
      const existingUnread = await txQuery<{ cnt: string }>(
        `SELECT count(*) as cnt FROM warehouse_notifications
         WHERE warehouse_id + 0 = $1
           AND entity_type = 'MATERIAL'
           AND entity_id = $2
           AND notification_type = 'LOW_STOCK'
           AND is_read = FALSE`,
        [warehouseId, String(materialId)]
      );
      if (parseInt(String(existingUnread.rows[0]?.cnt || '0'), 10) === 0) {
        await this.createNotification(txQuery, {
          targetRoleName: 'Warehouse Manager',
          warehouseId,
          notificationType: 'LOW_STOCK',
          severity: totalAvail === 0 ? 'CRITICAL' : 'WARNING',
          title: `Low Stock Alert: ${mat.sku}`,
          message: `${mat.name} available stock (${totalAvail}) is at or below reorder level (${reorderLevel}) in Warehouse #${warehouseId}.`,
          entityType: 'MATERIAL',
          entityId: materialId,
        });
      }
    }
  }

  /**
   * Reconcile inventory_balances total qty_on_hand vs stock_movements net sum across (warehouse, material).
   */
  static async reconcileBalancesVsMovements(filter?: {
    warehouseId?: number;
    materialId?: number;
  }): Promise<{
    isBalanced: boolean;
    discrepancies: Array<{
      warehouse_id: number;
      material_id: number;
      balance_qty: number;
      ledger_qty: number;
      variance: number;
    }>;
  }> {
    const params: any[] = [];
    const balConds: string[] = [];
    const movConds: string[] = [];

    if (filter?.warehouseId) {
      params.push(filter.warehouseId);
      balConds.push(`warehouse_id = $${params.length}`);
      movConds.push(`warehouse_id = $${params.length}`);
    }
    if (filter?.materialId) {
      params.push(filter.materialId);
      balConds.push(`material_id = $${params.length}`);
      movConds.push(`material_id = $${params.length}`);
    }

    const balWhere = balConds.length ? `WHERE ${balConds.join(' AND ')}` : '';
    const movWhere = movConds.length ? `WHERE ${movConds.join(' AND ')}` : '';

    const [balRes, movRes] = await Promise.all([
      query<{ warehouse_id: number; material_id: number; total_qty: string }>(
        `SELECT warehouse_id, material_id, SUM(qty_on_hand) as total_qty
         FROM inventory_balances ${balWhere}
         GROUP BY warehouse_id, material_id`,
        params
      ),
      query<{ warehouse_id: number; material_id: number; net_qty: string }>(
        `SELECT warehouse_id, material_id,
                SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) as net_qty
         FROM stock_movements ${movWhere}
         GROUP BY warehouse_id, material_id`,
        params
      ),
    ]);

    const keySet = new Set<string>();
    const balMap = new Map<string, number>();
    const movMap = new Map<string, number>();

    for (const r of balRes.rows) {
      const k = `${r.warehouse_id}:${r.material_id}`;
      keySet.add(k);
      balMap.set(k, roundQty(Number(r.total_qty)));
    }
    for (const r of movRes.rows) {
      const k = `${r.warehouse_id}:${r.material_id}`;
      keySet.add(k);
      movMap.set(k, roundQty(Number(r.net_qty)));
    }

    const discrepancies: Array<{
      warehouse_id: number;
      material_id: number;
      balance_qty: number;
      ledger_qty: number;
      variance: number;
    }> = [];

    for (const k of keySet) {
      const [whStr, matStr] = k.split(':');
      const bq = balMap.get(k) || 0;
      const lq = movMap.get(k) || 0;
      const variance = roundQty(bq - lq);
      if (variance !== 0) {
        discrepancies.push({
          warehouse_id: Number(whStr),
          material_id: Number(matStr),
          balance_qty: bq,
          ledger_qty: lq,
          variance,
        });
      }
    }

    return {
      isBalanced: discrepancies.length === 0,
      discrepancies,
    };
  }
}
