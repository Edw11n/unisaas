export interface OpenShiftDto {
  branchId: string;
  initialCash: number;
}

export interface CloseShiftDto {
  actualCash: number;
  notes?: string;
}

export interface InvoiceItemDto {
  productId: string;
  variantId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discountRate?: number;
  taxRate?: number;
}

export interface CreateInvoiceDto {
  branchId: string;
  posShiftId?: string;
  customerId?: string;
  customerName?: string;
  customerDocument?: string;
  paymentMethod: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'CREDITO_FIADO' | 'MIXTO';
  cashTendered?: number;
  idempotencyKey?: string;
  items: InvoiceItemDto[];
}

export interface VoidInvoiceDto {
  reason: string;
}

