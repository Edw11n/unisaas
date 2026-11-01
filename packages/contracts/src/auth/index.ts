import { z } from 'zod';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  ACCOUNTANT = 'ACCOUNTANT',
  WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  role: UserRole | string;
  jti?: string;
  branchId?: string;
  email?: string;
  [key: string]: unknown;
}

export const loginRequestSchema = z.object({
  email: z.string().email('Formato de correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  tenantId: z.string().uuid('ID de tenant inválido').optional(),
  deviceInfo: z.string().max(255).optional(),
});

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresIn: z.number().positive(),
  tenantId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    role: z.nativeEnum(UserRole),
    branchId: z.string().uuid().optional(),
  }),
});

export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

export const registerTenantSchema = z.object({
  companyName: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres'),
  nit: z.string().min(5, 'El NIT o documento tributario debe tener al menos 5 caracteres'),
  adminEmail: z.string().email('Correo de administrador inválido'),
  adminPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  adminFullName: z.string().min(2, 'El nombre completo debe tener al menos 2 caracteres'),
  planId: z.string().min(1).default('standard'),
});

export type RegisterTenantDto = z.infer<typeof registerTenantSchema>;

export const userSessionSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
  createdAt: z.number(),
  expiresAt: z.number(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type UserSessionDto = z.infer<typeof userSessionSchema>;

