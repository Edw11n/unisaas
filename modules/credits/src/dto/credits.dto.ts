export interface CreateThirdPartyDto {
  documentType: 'CC' | 'NIT' | 'CE' | 'TI' | 'PP' | 'PEP';
  documentNumber: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  partyType: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  creditLimit?: number;
}

export interface PurchaseItemDto {
  productId: string;
  variantId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  taxRate?: number;
}

export interface CreatePurchaseDto {
  branchId: string;
  warehouseId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  paymentType: 'CONTADO' | 'CREDITO';
  dueDate?: string;
  items: PurchaseItemDto[];
}

export interface CreditTransactionDto {
  thirdPartyId: string;
  type: 'CHARGE_CREDIT_SALE' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PURCHASE' | 'SUPPLIER_PAYMENT';
  amount: number;
  paymentMethod?: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'TRANSFERENCIA';
  referenceNumber?: string;
}
