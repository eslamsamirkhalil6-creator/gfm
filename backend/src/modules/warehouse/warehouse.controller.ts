import { Request, Response, NextFunction } from 'express';
import { hasGlobalWarehouseAccess } from '../../middleware/auth.middleware.ts';
import { WarehouseControlService } from './warehouse-control.service.ts';
import { WarehouseInboundService } from './warehouse-inbound.service.ts';
import { WarehouseMasterService } from './warehouse-master.service.ts';
import { WarehouseOutboundService } from './warehouse-outbound.service.ts';
import { badRequest, forbidden, parsePositiveInt } from './warehouse.errors.ts';
import { WarehouseActor } from './warehouse.types.ts';

function toActor(req: Request): WarehouseActor {
  if (!req.user) {
    throw badRequest('Authentication user context missing', 'UNAUTHORIZED');
  }
  return {
    id: req.user.id,
    username: req.user.username,
    roles: req.user.roles,
    permissions: req.user.permissions,
    managed_department_ids: req.user.managed_department_ids,
    managed_warehouse_ids: req.user.managed_warehouse_ids,
    supervised_line_ids: req.user.supervised_line_ids,
    ipAddress: req.ip,
  };
}

function optionalInt(val: any, fieldName: string): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  return parsePositiveInt(val, fieldName);
}

export class WarehouseController {
  // ============================================================================
  // 5.1 Warehouses, Bins, Staff & Settings
  // ============================================================================
  static async listWarehouses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.listWarehouses(toActor(req), {
        status: req.query.status as string | undefined,
        warehouse_type: req.query.warehouse_type as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.getWarehouseById(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.queryBalances(toActor(req), {
        warehouse_id: id,
        stock_status: req.query.stock_status as string | undefined,
        only_available: req.query.only_available === 'true',
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = toActor(req);
      if (!hasGlobalWarehouseAccess(req.user!)) {
        throw forbidden('Only System Administrator or Factory Manager may create new warehouses');
      }
      const data = await WarehouseMasterService.createWarehouse(req.body, actor);
      res.status(201).json({ success: true, message: 'Warehouse created successfully', data });
    } catch (err) {
      next(err);
    }
  }

  static async updateWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.updateWarehouse(id, req.body, toActor(req));
      res.status(200).json({ success: true, message: 'Warehouse updated successfully', data });
    } catch (err) {
      next(err);
    }
  }

  static async toggleWarehouseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!hasGlobalWarehouseAccess(req.user!)) {
        throw forbidden('Only System Administrator or Factory Manager may change warehouse active status');
      }
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.toggleWarehouseStatus(id, req.body.status, toActor(req));
      res.status(200).json({ success: true, message: `Warehouse status updated to ${data.status}`, data });
    } catch (err) {
      next(err);
    }
  }

  static async listLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.listLocations(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.createLocation(id, req.body, toActor(req));
      res.status(201).json({ success: true, message: 'Warehouse location created', data });
    } catch (err) {
      next(err);
    }
  }

  static async toggleLocationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId = parsePositiveInt(req.params.id, 'warehouse_id');
      const locationId = parsePositiveInt(req.params.locationId, 'location_id');
      const data = await WarehouseMasterService.toggleLocationStatus(warehouseId, locationId, req.body.status, toActor(req));
      res.status(200).json({ success: true, message: `Location status updated to ${data.status}`, data });
    } catch (err) {
      next(err);
    }
  }

  static async listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.listWarehouseStaff(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async assignStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'warehouse_id');
      const data = await WarehouseMasterService.assignWarehouseStaff(id, req.body, toActor(req));
      res.status(200).json({ success: true, message: 'Warehouse staff assignment saved', data });
    } catch (err) {
      next(err);
    }
  }

  static async removeStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId = parsePositiveInt(req.params.id, 'warehouse_id');
      const userId = parsePositiveInt(req.params.userId, 'user_id');
      await WarehouseMasterService.removeWarehouseStaff(warehouseId, userId, toActor(req));
      res.status(200).json({ success: true, message: 'Warehouse staff assignment removed' });
    } catch (err) {
      next(err);
    }
  }

  static async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.getSettings();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = String(req.params.key || '').trim();
      const data = await WarehouseMasterService.updateSetting(key, req.body.setting_value, toActor(req));
      res.status(200).json({ success: true, message: `Setting ${key} updated`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.2 Material Categories & Material Catalog
  // ============================================================================
  static async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.listCategories(req.query.status as string | undefined);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'category_id');
      const data = await WarehouseMasterService.getCategoryById(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.createCategory(req.body, toActor(req));
      res.status(201).json({ success: true, message: 'Material category created', data });
    } catch (err) {
      next(err);
    }
  }

  static async listMaterials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.listMaterials({
        category_id: optionalInt(req.query.category_id, 'category_id'),
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'material_id');
      const data = await WarehouseMasterService.getMaterialById(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.createMaterial(req.body, toActor(req));
      res.status(201).json({ success: true, message: 'Material created successfully', data });
    } catch (err) {
      next(err);
    }
  }

  static async updateMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'material_id');
      const data = await WarehouseMasterService.updateMaterial(id, req.body, toActor(req));
      res.status(200).json({ success: true, message: 'Material updated successfully', data });
    } catch (err) {
      next(err);
    }
  }

  static async updateMaterialAttributes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'material_id');
      const data = await WarehouseMasterService.updateMaterial(
        id,
        { attributes: req.body.attributes, attributes_json: req.body.attributes_json },
        toActor(req)
      );
      res.status(200).json({ success: true, message: 'Material attributes updated', data });
    } catch (err) {
      next(err);
    }
  }

  static async updateMaterialReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'material_id');
      const data = await WarehouseMasterService.updateMaterial(
        id,
        { min_stock_level: req.body.min_stock_level, reorder_level: req.body.reorder_level },
        toActor(req)
      );
      res.status(200).json({ success: true, message: 'Material reorder levels updated', data });
    } catch (err) {
      next(err);
    }
  }

  static async updateMaterialQcConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'material_id');
      const data = await WarehouseMasterService.updateMaterial(
        id,
        {
          requires_qc_on_receipt: req.body.requires_qc_on_receipt,
          is_lot_tracked: req.body.is_lot_tracked,
          is_roll_tracked: req.body.is_roll_tracked,
        },
        toActor(req)
      );
      res.status(200).json({ success: true, message: 'Material QC & tracking configuration updated', data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.3 Inventory Inquiry, Valuation & Ledger Reconciliation
  // ============================================================================
  static async getBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.queryBalances(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        location_id: optionalInt(req.query.location_id, 'location_id'),
        material_id: optionalInt(req.query.material_id, 'material_id'),
        lot_id: optionalInt(req.query.lot_id, 'lot_id'),
        stock_status: req.query.stock_status as string | undefined,
        only_available: req.query.only_available === 'true',
        only_reserved: req.query.only_reserved === 'true',
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailableBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.queryBalances(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        material_id: optionalInt(req.query.material_id, 'material_id'),
        only_available: true,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getReservedBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.queryBalances(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        material_id: optionalInt(req.query.material_id, 'material_id'),
        only_reserved: true,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getLots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.queryLots(toActor(req), {
        material_id: optionalInt(req.query.material_id, 'material_id'),
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        qc_status: req.query.qc_status as string | undefined,
        lot_number: req.query.lot_number as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.queryMovements(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        material_id: optionalInt(req.query.material_id, 'material_id'),
        lot_id: optionalInt(req.query.lot_id, 'lot_id'),
        movement_type: req.query.movement_type as string | undefined,
        source_document_type: req.query.source_document_type as string | undefined,
        source_document_id: optionalInt(req.query.source_document_id, 'source_document_id'),
        limit: optionalInt(req.query.limit, 'limit'),
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getInventorySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.getInventorySummary(
        toActor(req),
        optionalInt(req.query.warehouse_id, 'warehouse_id')
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getValuation(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.getInventoryValuation();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async reconcileLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.reconcileLedger(
        optionalInt(req.query.warehouse_id, 'warehouse_id'),
        optionalInt(req.query.material_id, 'material_id')
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.4 Goods Receiving (GRN)
  // ============================================================================
  static async listGrns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.listGrns(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        status: req.query.status as string | undefined,
        po_reference: req.query.po_reference as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getGrn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'grn_id');
      const data = await WarehouseInboundService.getGrnById(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createGrn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.createGrn(req.body, toActor(req));
      res.status(201).json({ success: true, message: 'GRN draft created', data });
    } catch (err) {
      next(err);
    }
  }

  static async addGrnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const grnId = parsePositiveInt(req.params.id, 'grn_id');
      const data = await WarehouseInboundService.addGrnItem(grnId, req.body, toActor(req));
      res.status(201).json({ success: true, message: 'GRN line item added', data });
    } catch (err) {
      next(err);
    }
  }

  static async postGrn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const grnId = parsePositiveInt(req.params.id, 'grn_id');
      const data = await WarehouseInboundService.postGrn(grnId, toActor(req));
      res.status(200).json({ success: true, message: `GRN ${data.grn.grn_number} posted successfully`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.5 QC Inspection
  // ============================================================================
  static async listPendingQc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.listPendingQc(
        optionalInt(req.query.warehouse_id, 'warehouse_id'),
        toActor(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async listQcHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.listQcHistory(
        {
          warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
          material_id: optionalInt(req.query.material_id, 'material_id'),
          lot_id: optionalInt(req.query.lot_id, 'lot_id'),
        },
        toActor(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async performQcInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.performQcInspection(req.body, toActor(req));
      res.status(200).json({
        success: true,
        message: `QC inspection ${data.inspection.inspection_number} completed`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.6 Material Requisitions
  // ============================================================================
  static async listRequisitions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.listRequisitions(toActor(req), {
        status: req.query.status as string | undefined,
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        department_id: optionalInt(req.query.department_id, 'department_id'),
        production_line_id: optionalInt(req.query.production_line_id, 'production_line_id'),
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.getRequisitionById(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.createRequisition(req.body, toActor(req));
      res.status(201).json({ success: true, message: 'Material requisition draft created', data });
    } catch (err) {
      next(err);
    }
  }

  static async addRequisitionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.addRequisitionItem(id, req.body, toActor(req));
      res.status(201).json({ success: true, message: 'Requisition item added', data });
    } catch (err) {
      next(err);
    }
  }

  static async submitRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.submitRequisition(id, toActor(req));
      res.status(200).json({ success: true, message: `Requisition ${data.requisition_number} submitted`, data });
    } catch (err) {
      next(err);
    }
  }

  static async approveRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.approveRequisition(id, toActor(req));
      res.status(200).json({ success: true, message: `Requisition ${data.requisition_number} approved and stock reserved`, data });
    } catch (err) {
      next(err);
    }
  }

  static async rejectRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.rejectRequisition(id, req.body?.reason, toActor(req));
      res.status(200).json({ success: true, message: `Requisition ${data.requisition_number} rejected`, data });
    } catch (err) {
      next(err);
    }
  }

  static async cancelRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'requisition_id');
      const data = await WarehouseOutboundService.cancelRequisition(id, toActor(req));
      res.status(200).json({ success: true, message: `Requisition ${data.requisition_number} cancelled`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.7 Stock Issuing
  // ============================================================================
  static async listIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.listIssues(
        toActor(req),
        optionalInt(req.query.warehouse_id, 'warehouse_id')
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'issue_id');
      const data = await WarehouseOutboundService.getIssueById(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async issueStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.issueStock(req.body, toActor(req));
      res.status(201).json({ success: true, message: `Stock issue ${data.issue.issue_number} posted`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.8 Material Returns
  // ============================================================================
  static async listReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.listReturns(
        toActor(req),
        optionalInt(req.query.warehouse_id, 'warehouse_id')
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseOutboundService.createAndPostReturn(req.body, toActor(req));
      res.status(201).json({
        success: true,
        message: `Material return ${data.material_return.return_number} posted`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.9 Transfers (Internal & Inter-Warehouse)
  // ============================================================================
  static async listTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.listTransfers(toActor(req), {
        status: req.query.status as string | undefined,
        transfer_type: req.query.transfer_type as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'transfer_id');
      const data = await WarehouseControlService.getTransferById(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async executeInternalBinTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.executeInternalBinTransfer(req.body, toActor(req));
      res.status(201).json({ success: true, message: `Internal bin move ${data.transfer.transfer_number} completed`, data });
    } catch (err) {
      next(err);
    }
  }

  static async dispatchInterWarehouseTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.dispatchInterWarehouseTransfer(req.body, toActor(req));
      res.status(201).json({
        success: true,
        message: `Inter-warehouse transfer ${data.transfer.transfer_number} dispatched (IN_TRANSIT)`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  static async receiveInterWarehouseTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'transfer_id');
      const data = await WarehouseControlService.receiveInterWarehouseTransfer(id, req.body, toActor(req));
      res.status(200).json({
        success: true,
        message: `Transfer ${data.transfer.transfer_number} received (${data.transfer.status})`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.10 Physical Stock Counts
  // ============================================================================
  static async listStockCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.listStockCounts(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        status: req.query.status as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.createStockCount(req.body, toActor(req));
      res.status(201).json({ success: true, message: `Stock count ${data.stock_count.count_number} created`, data });
    } catch (err) {
      next(err);
    }
  }

  static async getStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'count_id');
      const data = await WarehouseControlService.getStockCountById(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async recordStockCountQuantities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'count_id');
      const data = await WarehouseControlService.recordStockCountQuantities(id, req.body, toActor(req));
      res.status(200).json({ success: true, message: 'Physical count quantities recorded', data });
    } catch (err) {
      next(err);
    }
  }

  static async submitStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'count_id');
      const data = await WarehouseControlService.submitStockCount(id, toActor(req));
      res.status(200).json({ success: true, message: `Stock count ${data.count_number} submitted for review`, data });
    } catch (err) {
      next(err);
    }
  }

  static async approveStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'count_id');
      const data = await WarehouseControlService.approveStockCount(id, toActor(req));
      res.status(200).json({ success: true, message: `Stock count ${data.stock_count.count_number} approved and posted`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.11 Stock Adjustments & Write-Offs
  // ============================================================================
  static async listAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.listAdjustments(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        status: req.query.status as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.createAdjustment(req.body, toActor(req));
      res.status(201).json({ success: true, message: `Adjustment ${data.adjustment_number} submitted for approval`, data });
    } catch (err) {
      next(err);
    }
  }

  static async approveAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'adjustment_id');
      const data = await WarehouseControlService.approveAdjustment(id, toActor(req));
      res.status(200).json({ success: true, message: `Adjustment ${data.adjustment.adjustment_number} approved and posted`, data });
    } catch (err) {
      next(err);
    }
  }

  static async rejectAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'adjustment_id');
      const data = await WarehouseControlService.rejectAdjustment(id, req.body?.reason, toActor(req));
      res.status(200).json({ success: true, message: `Adjustment ${data.adjustment_number} rejected`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.12 Reorder Requests
  // ============================================================================
  static async listReorders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.listReorderRequests(toActor(req), {
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        status: req.query.status as string | undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseControlService.createReorderRequest(req.body, toActor(req));
      res.status(201).json({ success: true, message: `Reorder request ${data.request_number} created`, data });
    } catch (err) {
      next(err);
    }
  }

  static async submitReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'reorder_id');
      const data = await WarehouseControlService.submitReorderRequest(id, toActor(req));
      res.status(200).json({ success: true, message: `Reorder request ${data.request_number} submitted for Purchasing review`, data });
    } catch (err) {
      next(err);
    }
  }

  static async reviewReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'reorder_id');
      const data = await WarehouseControlService.reviewReorderRequest(id, req.body || {}, toActor(req));
      res.status(200).json({ success: true, message: `Reorder request ${data.request_number} reviewed by Purchasing`, data });
    } catch (err) {
      next(err);
    }
  }

  static async approveReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'reorder_id');
      const data = await WarehouseControlService.approveReorderRequest(id, toActor(req));
      res.status(200).json({ success: true, message: `Reorder request ${data.request_number} approved`, data });
    } catch (err) {
      next(err);
    }
  }

  static async rejectReorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'reorder_id');
      const data = await WarehouseControlService.rejectReorderRequest(id, req.body?.reason, toActor(req));
      res.status(200).json({ success: true, message: `Reorder request ${data.request_number} rejected`, data });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.13 Finished Goods Receiving
  // ============================================================================
  static async receiveFinishedGoods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseInboundService.receiveFinishedGoods(req.body, toActor(req));
      res.status(201).json({
        success: true,
        message: `Finished goods receipt ${data.receipt.grn_number} posted`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5.14 In-App Notifications
  // ============================================================================
  static async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await WarehouseMasterService.listNotifications(toActor(req), {
        unread_only: req.query.unread_only === 'true',
        warehouse_id: optionalInt(req.query.warehouse_id, 'warehouse_id'),
        limit: optionalInt(req.query.limit, 'limit'),
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parsePositiveInt(req.params.id, 'notification_id');
      const data = await WarehouseMasterService.markNotificationRead(id, toActor(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async scanDelayedTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const maxHours = req.body?.max_hours_in_transit !== undefined ? Number(req.body.max_hours_in_transit) : 24;
      const data = await WarehouseMasterService.generateDelayedTransferAlerts(maxHours, toActor(req));
      res.status(200).json({ success: true, data: { alerts_created: data.length, transfers: data } });
    } catch (err) {
      next(err);
    }
  }
}
