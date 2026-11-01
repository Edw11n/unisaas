import { z } from 'zod';

export enum JournalEntryType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  PAYMENT = 'PAYMENT',
  MANUAL = 'MANUAL',
  REVERSAL = 'REVERSAL',
}

export enum AccountNature {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export const journalLineSchema = z.object({
  accountCode: z.string().min(1, 'Código de cuenta requerido'),
  concept: z.string().max(255).optional(),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Débito con formato inválido').default('0.00'),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Crédito con formato inválido').default('0.00'),
  thirdPartyId: z.string().uuid().optional(),
});

export type JournalLineDto = z.infer<typeof journalLineSchema>;

export const createJournalEntrySchema = z.object({
  branchId: z.string().uuid('ID de sucursal requerido'),
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  entryType: z.nativeEnum(JournalEntryType),
  description: z.string().min(3, 'Descripción de asiento contable requerida'),
  referenceId: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'Un asiento contable requiere al menos dos líneas'),
});

export type CreateJournalEntryDto = z.infer<typeof createJournalEntrySchema>;

export const journalEntryResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  entryNumber: z.string(),
  entryDate: z.string(),
  entryType: z.nativeEnum(JournalEntryType),
  description: z.string(),
  totalDebit: z.string(),
  totalCredit: z.string(),
  lines: z.array(journalLineSchema),
  createdAt: z.string(),
});

export type JournalEntryResponseDto = z.infer<typeof journalEntryResponseSchema>;

export const pucAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nature: z.nativeEnum(AccountNature),
  isSelectable: z.boolean(),
  level: z.number().int().min(1).max(5),
});

export type PucAccountDto = z.infer<typeof pucAccountSchema>;

