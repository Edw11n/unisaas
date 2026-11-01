import { z } from 'zod';

export enum KardexMovementType {
  IN_PURCHASE = 'IN_PURCHASE',
  IN_RETURN = 'IN_RETURN',
  IN_ADJUSTMENT = 'IN_ADJUSTMENT',
  OUT_SALE = 'OUT_SALE',
  OUT_RETURN = 'OUT_RETURN',
  OUT_ADJUSTMENT = 'OUT_ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

export const dispatchStockItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive('La cantidad a despachar debe ser mayor a cero'),
});

export type DispatchStockItemDto = z.infer<typeof dispatchStockItemSchema>;

export const dispatchStockSchema = z.object({
  referenceType: z.enum(['INVOICE', 'MANUAL_OUT', 'ORDER', 'TRANSFER']),
  referenceId: z.string().min(1),
  items: z.array(dispatchStockItemSchema).min(1, 'Debe incluir al menos un ítem a despachar'),
  reason: z.string().max(255).optional(),
});

export type DispatchStockDto = z.infer<typeof dispatchStockSchema>;

export const receiveStockItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive('La cantidad a recibir debe ser mayor a cero'),
  unitCost: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Costo unitario con formato numérico inválido'),
});

export type ReceiveStockItemDto = z.infer<typeof receiveStockItemSchema>;

export const receiveStockSchema = z.object({
  referenceType: z.enum(['PURCHASE', 'MANUAL_IN', 'RETURN', 'TRANSFER']),
  referenceId: z.string().min(1),
  supplierId: z.string().uuid().optional(),
  items: z.array(receiveStockItemSchema).min(1, 'Debe incluir al menos un ítem a recibir'),
  notes: z.string().max(500).optional(),
});

export type ReceiveStockDto = z.infer<typeof receiveStockSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  actualQuantity: z.number().nonnegative('La cantidad física real no puede ser negativa'),
  reason: z.string().min(3, 'Debe especificar el motivo del ajuste'),
  idempotencyKey: z.string().min(8),
});

export type AdjustStockDto = z.infer<typeof adjustStockSchema>;

export const stockLevelSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  currentStock: z.string(),
  averageCost: z.string(),
  reservedStock: z.string().default('0.0000'),
});

export type StockLevelDto = z.infer<typeof stockLevelSchema>;

