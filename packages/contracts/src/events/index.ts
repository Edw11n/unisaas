import { z } from 'zod';

export const baseIntegrationEventSchema = z.object({
  eventId: z.string().uuid(),
  tenantId: z.string().uuid(),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid().optional(),
});

export const invoiceIssuedIntegrationEventSchema = baseIntegrationEventSchema.extend({
  eventType: z.literal('sales.invoice_issued'),
  payload: z.object({
    invoiceId: z.string().uuid(),
    branchId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    invoiceNumber: z.string(),
    customerId: z.string().uuid().optional(),
    subtotal: z.string(),
    taxAmount: z.string(),
    total: z.string(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number(),
        unitPrice: z.string(),
      }),
    ),
    payments: z.array(
      z.object({
        method: z.string(),
        amount: z.string(),
      }),
    ),
  }),
});

export type InvoiceIssuedIntegrationEvent = z.infer<typeof invoiceIssuedIntegrationEventSchema>;

export const stockDispatchedIntegrationEventSchema = baseIntegrationEventSchema.extend({
  eventType: z.literal('inventory.stock_dispatched'),
  payload: z.object({
    dispatchId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    referenceType: z.string(),
    referenceId: z.string(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number(),
      }),
    ),
  }),
});

export type StockDispatchedIntegrationEvent = z.infer<typeof stockDispatchedIntegrationEventSchema>;

export const journalEntryPostedIntegrationEventSchema = baseIntegrationEventSchema.extend({
  eventType: z.literal('accounting.journal_entry_posted'),
  payload: z.object({
    entryId: z.string().uuid(),
    branchId: z.string().uuid(),
    entryNumber: z.string(),
    entryType: z.string(),
    total: z.string(),
  }),
});

export type JournalEntryPostedIntegrationEvent = z.infer<typeof journalEntryPostedIntegrationEventSchema>;

export const customerCreditUpdatedIntegrationEventSchema = baseIntegrationEventSchema.extend({
  eventType: z.literal('credits.customer_credit_updated'),
  payload: z.object({
    customerId: z.string().uuid(),
    debtDelta: z.string(),
    newTotalDebt: z.string(),
    availableCredit: z.string(),
  }),
});

export type CustomerCreditUpdatedIntegrationEvent = z.infer<
  typeof customerCreditUpdatedIntegrationEventSchema
>;

