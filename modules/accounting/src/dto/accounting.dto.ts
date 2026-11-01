export interface CreateAccountDto {
  code: string;
  name: string;
  accountType: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO';
  nature: 'D' | 'C';
  parentId?: string;
  isSelectable?: boolean;
}

export interface JournalLineDto {
  accountId: string;
  debit: number;
  credit: number;
  thirdPartyId?: string;
  description?: string;
  nature?: 'D' | 'C';
}

export interface CreateJournalEntryDto {
  branchId: string;
  concept: string;
  sourceDocumentType:
    | 'SALE_POS'
    | 'PURCHASE'
    | 'CUSTOMER_PAYMENT'
    | 'SUPPLIER_PAYMENT'
    | 'REVERSAL'
    | 'SHRINKAGE'
    | 'MANUAL_ADJUSTMENT'
    | 'OPENING_BALANCE'
    | 'INVENTORY_MOVEMENT';
  sourceDocumentId?: string;
  entryDate?: string;
  lines: JournalLineDto[];
}

