import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Carlos' })
  ownerFirstName!: string;

  @ApiProperty({ example: 'Restrepo' })
  ownerLastName!: string;

  @ApiProperty({ example: 'dueño@mirestaurante.com' })
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  password!: string;

  @ApiProperty({ example: '+573001234567' })
  ownerPhone!: string;

  @ApiPropertyOptional({ example: 'CC', default: 'CC' })
  documentType?: string;

  @ApiPropertyOptional({ example: '1020304050' })
  documentNumber?: string;

  @ApiProperty({ example: 'Restaurante El Paisa S.A.S.' })
  businessName!: string;

  @ApiProperty({ example: 'El Paisa Gourmet' })
  tradeName!: string;

  @ApiPropertyOptional({ example: '900123456-1' })
  nitRut?: string;

  @ApiPropertyOptional({ example: 'RESTAURANTE', default: 'RESTAURANTE' })
  commercialCategory?: string;

  @ApiPropertyOptional({ example: 'Carrera 7 # 32-15' })
  address?: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'COL', default: 'COL' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'COP', default: 'COP' })
  currencyCode?: string;

  @ApiPropertyOptional({ example: 'REGIMEN_SIMPLE', default: 'REGIMEN_SIMPLE' })
  taxRegime?: string;
}

export class ActivateAccountDto {
  @ApiProperty({ example: 'cajero@mirestaurante.com' })
  email!: string;

  @ApiProperty({ example: '123456' })
  activationCode!: string;

  @ApiProperty({ example: 'NuevaClaveSegura2026!' })
  newPassword!: string;

  @ApiPropertyOptional()
  clientIp?: string;
}

export class CreateStaffDto {
  @ApiProperty({ example: 'Andres Gomez' })
  fullName!: string;

  @ApiProperty({ example: 'andresg' })
  username?: string;

  @ApiProperty({ example: 'cajero@mirestaurante.com' })
  email!: string;

  @ApiPropertyOptional({ example: '+573109876543' })
  phone?: string;

  @ApiPropertyOptional({ example: 'ClaveOpcional123!' })
  password?: string;

  @ApiProperty({ example: 'CASHIER', enum: ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER'] })
  role!: 'ADMIN' | 'ACCOUNTANT' | 'WAREHOUSE_MANAGER' | 'CASHIER';

  @ApiPropertyOptional({ example: 'a1111111-1111-1111-1111-111111111111' })
  branchId?: string;

  @ApiPropertyOptional({ example: 'CAJA-01', default: 'CAJA-01' })
  assignedRegister?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Sede Poblado' })
  name?: string;

  @ApiPropertyOptional({ example: 'Calle 10 # 40-20' })
  address?: string;

  @ApiPropertyOptional({ example: '+573004445566' })
  phone?: string;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Carlos Alberto Restrepo' })
  fullName?: string;

  @ApiPropertyOptional({ example: '+573009998877' })
  phone?: string;

  @ApiPropertyOptional({ example: 'CC' })
  documentType?: string;

  @ApiPropertyOptional({ example: '1020304050' })
  documentNumber?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'NuevaClaveAdmin2026!' })
  newPassword!: string;
}

export class UpdateRoleDto {
  @ApiProperty({ example: 'ADMIN', enum: ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER'] })
  role!: 'ADMIN' | 'ACCOUNTANT' | 'WAREHOUSE_MANAGER' | 'CASHIER';
}

export class UpdateStatusDto {
  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class PlatformLoginDto {
  @ApiProperty({ example: 'superadmin@unisaas.com' })
  email!: string;

  @ApiProperty({ example: 'SuperClave2026!' })
  password!: string;
}

export class PlatformMfaVerifyDto {
  @ApiProperty({ example: 'challenge-token-uuid' })
  challengeToken!: string;

  @ApiProperty({ example: '123456' })
  code!: string;
}

export class AssignPlanDto {
  @ApiProperty({ example: 'PRO_GROWTH' })
  planCode!: string;
}
