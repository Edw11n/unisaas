export interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  categoryId: string;
  unitOfMeasureId: string;
  costPrice: number;
  sellingPrice: number;
  taxRate?: number;
  barcode?: string;
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

