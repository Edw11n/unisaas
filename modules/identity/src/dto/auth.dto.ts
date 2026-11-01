export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface CreateTenantDto {
  nitRut: string;
  businessName: string;
  tradeName: string;
  address: string;
  phone: string;
  email: string;
  countryCode?: string;
  currencyCode?: string;
  taxRegime?: 'REGIMEN_SIMPLE' | 'RESPONSABLE_IVA' | 'NO_RESPONSABLE_IVA' | 'GRAN_CONTRIBUYENTE' | 'REGIMEN_ESPECIAL';
}

export interface CreateBranchDto {
  code: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  fullName: string;
  documentNumber: string;
  documentType?: 'CC' | 'CE' | 'TI' | 'NIT' | 'PP' | 'PEP';
  phone?: string;
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'WAREHOUSE_MANAGER' | 'CASHIER';
  branchId?: string;
}
