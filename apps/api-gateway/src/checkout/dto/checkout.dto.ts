export interface CheckoutItemDto {
  productId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountRate?: number;
}

export interface CheckoutPaymentDto {
  method: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'CREDITO_FIADO' | 'MIXTO';
  cashTendered?: number;
  customerDocument?: string;
  customerName?: string;
  customerId?: string;
}

export interface CheckoutDto {
  branchId: string;
  posShiftId?: string;
  items: CheckoutItemDto[];
  payment: CheckoutPaymentDto;
  notes?: string;
  printTicket?: boolean;
  ticketWidth?: 58 | 80;
}

export interface CheckoutResponseDto {
  success: boolean;
  invoiceId: string;
  consecutive: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  cashTendered: number | null;
  changeGiven: number | null;
  journalEntryId: string;
  outboxEventId: string;
  ticketBase64?: string;
  isReplay?: boolean;
  createdAt: string;
}

