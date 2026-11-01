import { z } from 'zod';

export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum CreditTransactionType {
  SALE_CREDIT = 'SALE_CREDIT',
  PAYMENT = 'PAYMENT',
  INTEREST = 'INTEREST',
  ADJUSTMENT = 'ADJUSTMENT',
}

export const createCreditSchema = z.object({
  customerId: z.string().uuid('ID de cliente requerido'),
  branchId: z.string().uuid('ID de sucursal requerido'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto con formato monetario inválido'),
  interestRate: z.number().min(0).max(100).default(0),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  referenceId: z.string().optional(),
});

export type CreateCreditDto = z.infer<typeof createCreditSchema>;

export const creditPaymentSchema = z.object({
  creditId: z.string().uuid('ID de crédito requerido'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto de abono con formato inválido'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  reference: z.string().max(100).optional(),
  idempotencyKey: z.string().min(8),
});

export type CreditPaymentDto = z.infer<typeof creditPaymentSchema>;

export const customerCreditProfileSchema = z.object({
  customerId: z.string().uuid(),
  creditLimit: z.string(),
  currentDebt: z.string(),
  availableCredit: z.string(),
  status: z.nativeEnum(CreditStatus),
});

export type CustomerCreditProfileDto = z.infer<typeof customerCreditProfileSchema>;

