export const WAREHOUSE_TYPES = [
  'RAW_MATERIAL',
  'FABRIC',
  'TRIMS_ACCESSORIES',
  'WIP',
  'FINISHED_GOODS',
  'QUARANTINE',
  'GENERAL',
] as const;

export const LOCATION_TYPES = [
  'DEFAULT',
  'RECEIVING',
  'STORAGE',
  'STAGING',
  'QC_HOLD',
  'DISPATCH',
  'DAMAGED',
] as const;

export const WAREHOUSE_STAFF_ROLES = [
  'WAREHOUSE_MANAGER',
  'WAREHOUSE_KEEPER',
  'QC_INSPECTOR',
  'VIEWER',
] as const;

export const MATERIAL_CATEGORY_TYPES = [
  'FABRIC',
  'TRIM_ACCESSORY',
  'PACKAGING',
  'FINISHED_GOOD',
  'CONSUMABLE',
] as const;

export const MATERIAL_UOMS = [
  'meter',
  'yard',
  'kg',
  'pcs',
  'roll',
  'cone',
  'carton',
  'set',
  'box',
] as const;

export const STOCK_STATUSES = [
  'AVAILABLE',
  'QUARANTINE',
  'HOLD',
  'DAMAGED',
  'SCRAP',
  'IN_TRANSIT',
] as const;

export const MOVEMENT_TYPES = [
  'RECEIPT',
  'QC_RELEASE',
  'QC_REJECT',
  'ISSUE',
  'RETURN',
  'TRANSFER_OUT',
  'TRANSFER_IN_TRANSIT',
  'TRANSFER_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'WRITE_OFF',
  'FG_RECEIPT',
  'REVERSAL',
] as const;

export const ADJUSTMENT_REASON_CODES = [
  'CYCLE_COUNT_GAIN',
  'CYCLE_COUNT_LOSS',
  'DAMAGED',
  'EXPIRED',
  'SHRINKAGE',
  'WRITE_OFF',
  'DATA_CORRECTION',
  'REVERSAL_CORRECTION',
] as const;

export const RETURN_CONDITIONS = [
  'USABLE_SURPLUS',
  'DAMAGED',
  'WASTE_SCRAP',
] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type AdjustmentReasonCode = (typeof ADJUSTMENT_REASON_CODES)[number];
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export interface WarehouseActor {
  id: number;
  username: string;
  roles: string[];
  permissions: string[];
  managed_department_ids: number[];
  managed_warehouse_ids: number[];
  supervised_line_ids: number[];
  ipAddress?: string;
}

export interface CreateWarehouseDTO {
  warehouse_code: string;
  name: string;
  warehouse_type: (typeof WAREHOUSE_TYPES)[number];
  department_id?: number | null;
  manager_id?: number | null;
  require_bin_tracking?: boolean;
  description?: string | null;
}

export interface UpdateWarehouseDTO {
  name?: string;
  warehouse_type?: (typeof WAREHOUSE_TYPES)[number];
  department_id?: number | null;
  manager_id?: number | null;
  require_bin_tracking?: boolean;
  description?: string | null;
}

export interface CreateLocationDTO {
  location_code: string;
  name: string;
  location_type?: (typeof LOCATION_TYPES)[number];
  zone?: string | null;
  aisle?: string | null;
  rack?: string | null;
  bin?: string | null;
}

export interface AssignWarehouseStaffDTO {
  user_id: number;
  staff_role: (typeof WAREHOUSE_STAFF_ROLES)[number];
  is_primary?: boolean;
  effective_from?: string;
  effective_to?: string | null;
  notes?: string | null;
}

export interface CreateCategoryDTO {
  category_code: string;
  name: string;
  category_type: (typeof MATERIAL_CATEGORY_TYPES)[number];
  requires_qc_default?: boolean;
  is_lot_tracked_default?: boolean;
  is_roll_tracked_default?: boolean;
  description?: string | null;
}

export interface CreateMaterialDTO {
  sku: string;
  name: string;
  category_id: number;
  base_uom: (typeof MATERIAL_UOMS)[number];
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, any>;
  attributes_json?: string;
  is_lot_tracked?: boolean;
  is_roll_tracked?: boolean;
  requires_qc_on_receipt?: boolean;
  min_stock_level?: number;
  reorder_level?: number;
}

export interface UpdateMaterialDTO {
  name?: string;
  category_id?: number;
  base_uom?: (typeof MATERIAL_UOMS)[number];
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, any>;
  attributes_json?: string;
  is_lot_tracked?: boolean;
  is_roll_tracked?: boolean;
  requires_qc_on_receipt?: boolean;
  min_stock_level?: number;
  reorder_level?: number;
  status?: 'active' | 'inactive';
}
