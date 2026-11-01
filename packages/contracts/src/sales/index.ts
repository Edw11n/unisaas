import { z } from 'zod';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CREDIT = 'CREDIT',
  OTHER = 'OTHER',
}

export const invoiceItemSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  variantId: z.string().uuid().optional(),
  productName: z.string().min(1, 'Nombre del producto requerido'),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio unitario con formato monetario inválido'),
  taxRate: z.number().min(0).max(100).default(19),
  discountRate: z.number().min(0).max(100).default(0),
});

export type InvoiceItemDto = z.infer<typeof invoiceItemSchema>;

export const invoicePaymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto de pago con formato monetario inválido'),
  reference: z.string().max(100).optional(),
});

export type InvoicePaymentDto = z.infer<typeof invoicePaymentSchema>;

export const createInvoiceSchema = z.object({
  branchId: z.string().uuid('ID de sucursal inválido'),
  warehouseId: z.string().uuid('ID de bodega/almacén inválido'),
  customerId: z.string().uuid().optional(),
  items: z.array(invoiceItemSchema).min(1, 'La factura debe tener al menos un ítem'),
  payments: z.array(invoicePaymentSchema).min(1, 'Debe registrar al menos un método de pago'),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8, 'Clave de idempotencia requerida'),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

export const invoiceResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  invoiceNumber: z.string(),
  status: z.nativeEnum(InvoiceStatus),
  subtotal: z.string(),
  taxAmount: z.string(),
  discountAmount: z.string(),
  total: z.string(),
  items: z.array(invoiceItemSchema),
  payments: z.array(invoicePaymentSchema),
  createdAt: z.string(),
});

export type InvoiceResponseDto = z.infer<typeof invoiceResponseSchema>;

