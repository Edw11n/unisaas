export interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  categoryId: string;
  unitOfMeasureId: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate?: number;
  minStockAlert?: number;
  barcode?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  costPrice?: number;
  sellingPrice?: number;
  wholesalePrice?: number;
  taxRate?: number;
  minStockAlert?: number;
  categoryId?: string;
  unitOfMeasureId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export interface SearchProductsQueryDto {
  search?: string;
  categoryId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  page?: number;
  limit?: number;
}

export interface CreateWarehouseDto {
  branchId: string;
  code: string;
  name: string;
  address?: string;
  isDefault?: boolean;
}

export interface StockAdjustmentDto {
  warehouseId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  reason: 'INITIAL_STOCK' | 'STOCK_COUNT' | 'DAMAGE' | 'LOSS' | 'FOUND' | 'CORRECTION' | 'OTHER';
  notes?: string;
}

export interface ReceiveStockLineDto {
  productId: string;
  variantId?: string;
  quantity: number;
  unitCost: number;
}

export interface ReceiveStockDto {
  warehouseId: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  unitCost?: number;
  lines?: ReceiveStockLineDto[];
  notes?: string;
  referenceDocument?: string;
  idempotencyKey?: string;
}

export interface DispatchStockLineDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface DispatchStockDto {
  warehouseId: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  lines?: DispatchStockLineDto[];
  notes?: string;
  referenceDocument?: string;
  referenceType?: 'POS_SALE' | 'POS_VOID' | 'MANUAL_ADJUSTMENT' | 'OTHER';
  idempotencyKey?: string;
}

export interface ReverseMovementDto {
  movementId: string;
  reason: string;
}

export interface TransferStockLineDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface TransferStockDto {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  lines?: TransferStockLineDto[];
  type?: 'DIRECT' | 'TWO_PHASE';
  referenceDocument?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReceiveTransferDto {
  notes?: string;
}

export interface CreateStockCountDto {
  warehouseId: string;
  referenceDocument?: string;
  notes?: string;
}

export interface StockCountItemDto {
  lineId?: string;
  productId: string;
  variantId?: string;
  physicalQuantity: number;
}

export interface ApplyStockCountDto {
  items: StockCountItemDto[];
  notes?: string;
  idempotencyKey?: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}
