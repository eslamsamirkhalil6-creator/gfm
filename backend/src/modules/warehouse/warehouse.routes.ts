import { Router } from 'express';
import {
  authenticateJWT,
  requireAnyPermission,
  requirePermission,
  requireProductionLineScope,
  requireWarehouseScope,
} from '../../middleware/auth.middleware.ts';
import { validateBody } from '../../middleware/validation.middleware.ts';
import { WarehouseController } from './warehouse.controller.ts';

export const wmsRouter = Router();

// All WMS endpoints require valid authenticated JWT
wmsRouter.use(authenticateJWT);

// ============================================================================
// 5.1 Warehouses, Bins, Staff & Settings
// ============================================================================
wmsRouter.get('/warehouses', requirePermission('warehouse:view'), WarehouseController.listWarehouses);

wmsRouter.post(
  '/warehouses',
  requirePermission('warehouse:manage'),
  validateBody(['warehouse_code', 'name', 'warehouse_type']),
  WarehouseController.createWarehouse
);

wmsRouter.get(
  '/warehouses/:id',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.getWarehouse
);

wmsRouter.put(
  '/warehouses/:id',
  requirePermission('warehouse:manage'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.updateWarehouse
);

wmsRouter.put(
  '/warehouses/:id/status',
  requirePermission('warehouse:manage'),
  validateBody(['status']),
  WarehouseController.toggleWarehouseStatus
);

wmsRouter.get(
  '/warehouses/:id/stock',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.getWarehouseStock
);

wmsRouter.get(
  '/warehouses/:id/locations',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.listLocations
);

wmsRouter.post(
  '/warehouses/:id/locations',
  requirePermission('warehouse:manage'),
  requireWarehouseScope({ paramKey: 'id' }),
  validateBody(['location_code', 'name']),
  WarehouseController.createLocation
);

wmsRouter.put(
  '/warehouses/:id/locations/:locationId/status',
  requirePermission('warehouse:manage'),
  requireWarehouseScope({ paramKey: 'id' }),
  validateBody(['status']),
  WarehouseController.toggleLocationStatus
);

wmsRouter.get(
  '/warehouses/:id/staff',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.listStaff
);

wmsRouter.post(
  '/warehouses/:id/staff',
  requirePermission('warehouse:manage'),
  requireWarehouseScope({ paramKey: 'id' }),
  validateBody(['user_id', 'staff_role']),
  WarehouseController.assignStaff
);

wmsRouter.delete(
  '/warehouses/:id/staff/:userId',
  requirePermission('warehouse:manage'),
  requireWarehouseScope({ paramKey: 'id' }),
  WarehouseController.removeStaff
);

wmsRouter.get('/warehouse/settings', requirePermission('warehouse:view'), WarehouseController.getSettings);

wmsRouter.put(
  '/warehouse/settings/:key',
  requirePermission('warehouse:settings:manage'),
  validateBody(['setting_value']),
  WarehouseController.updateSetting
);

// ============================================================================
// 5.2 Material Categories & Catalog
// ============================================================================
wmsRouter.get('/warehouse/categories', requirePermission('warehouse:view'), WarehouseController.listCategories);
wmsRouter.get('/warehouse/categories/:id', requirePermission('warehouse:view'), WarehouseController.getCategory);
wmsRouter.post(
  '/warehouse/categories',
  requirePermission('warehouse:materials:manage'),
  validateBody(['category_code', 'name', 'category_type']),
  WarehouseController.createCategory
);

wmsRouter.get(
  '/warehouse/materials',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create'),
  WarehouseController.listMaterials
);
wmsRouter.get(
  '/warehouse/materials/:id',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create'),
  WarehouseController.getMaterial
);
wmsRouter.post(
  '/warehouse/materials',
  requirePermission('warehouse:materials:manage'),
  validateBody(['sku', 'name', 'category_id', 'base_uom']),
  WarehouseController.createMaterial
);
wmsRouter.put(
  '/warehouse/materials/:id',
  requirePermission('warehouse:materials:manage'),
  WarehouseController.updateMaterial
);
wmsRouter.put(
  '/warehouse/materials/:id/attributes',
  requirePermission('warehouse:materials:manage'),
  WarehouseController.updateMaterialAttributes
);
wmsRouter.put(
  '/warehouse/materials/:id/reorder',
  requirePermission('warehouse:materials:manage'),
  WarehouseController.updateMaterialReorder
);
wmsRouter.put(
  '/warehouse/materials/:id/qc-config',
  requirePermission('warehouse:materials:manage'),
  WarehouseController.updateMaterialQcConfig
);

// ============================================================================
// 5.3 Inventory Balances, Lots, Movement Ledger, Valuation & Reconciliation
// ============================================================================
wmsRouter.get(
  '/inventory/balances',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getBalances
);
wmsRouter.get(
  '/inventory/available',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getAvailableBalances
);
wmsRouter.get(
  '/inventory/reserved',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getReservedBalances
);
wmsRouter.get(
  '/inventory/lots',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getLots
);
wmsRouter.get(
  '/inventory/movements',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getMovements
);
wmsRouter.get(
  '/inventory/summary',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.getInventorySummary
);
wmsRouter.get('/inventory/valuation', requirePermission('warehouse:reports:valuation'), WarehouseController.getValuation);
wmsRouter.get('/inventory/reconcile', requirePermission('warehouse:reports:valuation'), WarehouseController.reconcileLedger);

// ============================================================================
// 5.4 Goods Receiving (GRN)
// ============================================================================
wmsRouter.get(
  '/warehouse/grns',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listGrns
);
wmsRouter.get('/warehouse/grns/:id', requirePermission('warehouse:view'), WarehouseController.getGrn);
wmsRouter.post(
  '/warehouse/grns',
  requirePermission('inventory:receive'),
  requireWarehouseScope(),
  validateBody(['warehouse_id', 'supplier_name']),
  WarehouseController.createGrn
);
wmsRouter.post(
  '/warehouse/grns/:id/items',
  requirePermission('inventory:receive'),
  validateBody(['material_id', 'received_qty']),
  WarehouseController.addGrnItem
);
wmsRouter.post('/warehouse/grns/:id/post', requirePermission('inventory:receive'), WarehouseController.postGrn);

// ============================================================================
// 5.5 QC Inspection & Release
// ============================================================================
wmsRouter.get(
  '/warehouse/qc/pending',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listPendingQc
);
wmsRouter.get(
  '/warehouse/qc/history',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listQcHistory
);
wmsRouter.post(
  '/warehouse/qc/inspect',
  requirePermission('inventory:qc_inspect'),
  validateBody(['grn_item_id', 'passed_qty']),
  WarehouseController.performQcInspection
);

// ============================================================================
// 5.6 Material Requisitions
// ============================================================================
wmsRouter.get(
  '/warehouse/requisitions',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:requisition:approve'),
  WarehouseController.listRequisitions
);
wmsRouter.get(
  '/warehouse/requisitions/:id',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:requisition:approve'),
  WarehouseController.getRequisition
);
wmsRouter.post(
  '/warehouse/requisitions',
  requirePermission('inventory:requisition:create'),
  validateBody(['department_id', 'warehouse_id']),
  requireProductionLineScope({ requireLineWhenSupervisorOnly: true }),
  WarehouseController.createRequisition
);
wmsRouter.post(
  '/warehouse/requisitions/:id/items',
  requirePermission('inventory:requisition:create'),
  validateBody(['material_id', 'requested_qty']),
  WarehouseController.addRequisitionItem
);
wmsRouter.post(
  '/warehouse/requisitions/:id/submit',
  requirePermission('inventory:requisition:create'),
  WarehouseController.submitRequisition
);
wmsRouter.post(
  '/warehouse/requisitions/:id/approve',
  requirePermission('inventory:requisition:approve'),
  WarehouseController.approveRequisition
);
wmsRouter.post(
  '/warehouse/requisitions/:id/reject',
  requirePermission('inventory:requisition:approve'),
  WarehouseController.rejectRequisition
);
wmsRouter.post(
  '/warehouse/requisitions/:id/cancel',
  requireAnyPermission('inventory:requisition:create', 'inventory:requisition:approve'),
  WarehouseController.cancelRequisition
);

// ============================================================================
// 5.7 Stock Issuing
// ============================================================================
wmsRouter.get(
  '/warehouse/issues',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listIssues
);
wmsRouter.get(
  '/warehouse/issues/:id',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:issue'),
  WarehouseController.getIssue
);
wmsRouter.post(
  '/warehouse/issues',
  requirePermission('inventory:issue'),
  validateBody(['requisition_id', 'items']),
  WarehouseController.issueStock
);

// ============================================================================
// 5.8 Material Returns, Waste & Damage
// ============================================================================
wmsRouter.get(
  '/warehouse/returns',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:return'),
  WarehouseController.listReturns
);
wmsRouter.post(
  '/warehouse/returns',
  requirePermission('inventory:return'),
  requireWarehouseScope(),
  validateBody(['department_id', 'warehouse_id', 'material_id', 'returned_qty', 'return_condition']),
  WarehouseController.createReturn
);

// ============================================================================
// 5.9 Transfers (Internal Bin & 2-Step Inter-Warehouse)
// ============================================================================
wmsRouter.get('/warehouse/transfers', requirePermission('warehouse:view'), WarehouseController.listTransfers);
wmsRouter.get('/warehouse/transfers/:id', requirePermission('warehouse:view'), WarehouseController.getTransfer);
wmsRouter.post(
  '/warehouse/transfers/internal',
  requirePermission('inventory:transfer'),
  requireWarehouseScope(),
  validateBody(['warehouse_id', 'items']),
  WarehouseController.executeInternalBinTransfer
);
wmsRouter.post(
  '/warehouse/transfers/dispatch',
  requirePermission('inventory:transfer'),
  requireWarehouseScope({ bodyKey: 'source_warehouse_id' }),
  validateBody(['source_warehouse_id', 'target_warehouse_id', 'items']),
  WarehouseController.dispatchInterWarehouseTransfer
);
wmsRouter.post(
  '/warehouse/transfers/:id/receive',
  requirePermission('inventory:transfer'),
  validateBody(['items']),
  WarehouseController.receiveInterWarehouseTransfer
);

// ============================================================================
// 5.10 Physical Stock Counts
// ============================================================================
wmsRouter.get(
  '/warehouse/counts',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listStockCounts
);
wmsRouter.post(
  '/warehouse/counts',
  requirePermission('inventory:count'),
  requireWarehouseScope(),
  validateBody(['warehouse_id', 'count_type']),
  WarehouseController.createStockCount
);
wmsRouter.get('/warehouse/counts/:id', requirePermission('warehouse:view'), WarehouseController.getStockCount);
wmsRouter.put(
  '/warehouse/counts/:id/items',
  requirePermission('inventory:count'),
  validateBody(['items']),
  WarehouseController.recordStockCountQuantities
);
wmsRouter.post('/warehouse/counts/:id/submit', requirePermission('inventory:count'), WarehouseController.submitStockCount);
wmsRouter.post(
  '/warehouse/counts/:id/approve',
  requirePermission('inventory:adjust:approve'),
  WarehouseController.approveStockCount
);

// ============================================================================
// 5.11 Stock Adjustments & Write-Offs
// ============================================================================
wmsRouter.get(
  '/warehouse/adjustments',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listAdjustments
);
wmsRouter.post(
  '/warehouse/adjustments',
  requirePermission('inventory:adjust:propose'),
  requireWarehouseScope(),
  validateBody(['warehouse_id', 'material_id', 'direction', 'quantity', 'reason_code']),
  WarehouseController.createAdjustment
);
wmsRouter.post(
  '/warehouse/adjustments/:id/approve',
  requireAnyPermission('inventory:adjust:approve', 'inventory:adjust:approve_high'),
  WarehouseController.approveAdjustment
);
wmsRouter.post(
  '/warehouse/adjustments/:id/reject',
  requireAnyPermission('inventory:adjust:approve', 'inventory:adjust:approve_high'),
  WarehouseController.rejectAdjustment
);

// ============================================================================
// 5.12 Reorder Requests
// ============================================================================
wmsRouter.get(
  '/warehouse/reorders',
  requirePermission('warehouse:view'),
  requireWarehouseScope({ optional: true }),
  WarehouseController.listReorders
);
wmsRouter.post(
  '/warehouse/reorders',
  requirePermission('inventory:reorder:create'),
  requireWarehouseScope(),
  validateBody(['material_id', 'warehouse_id', 'requested_qty']),
  WarehouseController.createReorder
);
wmsRouter.post(
  '/warehouse/reorders/:id/submit',
  requirePermission('inventory:reorder:create'),
  WarehouseController.submitReorder
);
wmsRouter.post(
  '/warehouse/reorders/:id/review',
  requirePermission('inventory:reorder:review'),
  WarehouseController.reviewReorder
);
wmsRouter.post(
  '/warehouse/reorders/:id/approve',
  requirePermission('inventory:reorder:approve'),
  WarehouseController.approveReorder
);
wmsRouter.post(
  '/warehouse/reorders/:id/reject',
  requireAnyPermission('inventory:reorder:create', 'inventory:reorder:review', 'inventory:reorder:approve'),
  WarehouseController.rejectReorder
);

// ============================================================================
// 5.13 Finished Goods Receiving
// ============================================================================
wmsRouter.post(
  '/warehouse/finished-goods/receive',
  requirePermission('inventory:receive'),
  requireWarehouseScope(),
  validateBody(['department_id', 'warehouse_id', 'material_id', 'quantity']),
  WarehouseController.receiveFinishedGoods
);

// ============================================================================
// 5.14 In-App Notifications
// ============================================================================
wmsRouter.get(
  '/warehouse/notifications',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:qc_inspect'),
  WarehouseController.listNotifications
);
wmsRouter.put(
  '/warehouse/notifications/:id/read',
  requireAnyPermission('warehouse:view', 'inventory:requisition:create', 'inventory:qc_inspect'),
  WarehouseController.markNotificationRead
);
wmsRouter.post(
  '/warehouse/notifications/scan-delayed-transfers',
  requirePermission('warehouse:manage'),
  WarehouseController.scanDelayedTransfers
);
