import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginRequestSchema,
  registerTenantSchema,
  createInvoiceSchema,
  PaymentMethod,
  dispatchStockSchema,
  createJournalEntrySchema,
  JournalEntryType,
  invoiceIssuedIntegrationEventSchema,
} from '../src/index.js';

describe('Contracts & Zod Schemas Validation', () => {
  it('valida solicitudes de login correctamente', () => {
    const valid = {
      email: 'admin@unisaas.com',
      password: 'password123',
    };
    const parsed = loginRequestSchema.parse(valid);
    assert.equal(parsed.email, 'admin@unisaas.com');

    // Email inválido
    assert.throws(() => {
      loginRequestSchema.parse({ email: 'no-email', password: '123' });
    });
  });

  it('valida registro de nuevo inquilino con restricciones mínimas', () => {
    const valid = {
      companyName: 'Supermercado Central SAS',
      nit: '900123456-1',
      adminEmail: 'contacto@supermercado.com',
      adminPassword: 'PasswordSegura2026',
      adminFullName: 'Carlos Perez',
    };
    const parsed = registerTenantSchema.parse(valid);
    assert.equal(parsed.companyName, 'Supermercado Central SAS');
    assert.equal(parsed.planId, 'standard'); // Default
  });

  it('valida contratos de facturación POS garantizando formato monetario e ítems', () => {
    const validInvoice = {
      branchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      warehouseId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      idempotencyKey: 'idem-pos-12345678',
      items: [
        {
          productId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
          productName: 'Arroz Diana 1kg',
          quantity: 2,
          unitPrice: '4500.00',
          taxRate: 19,
          discountRate: 0,
        },
      ],
      payments: [
        {
          method: PaymentMethod.CASH,
          amount: '9000.00',
        },
      ],
    };

    const parsed = createInvoiceSchema.parse(validInvoice);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.payments[0].method, 'CASH');

    // Rechaza facturas sin ítems
    assert.throws(() => {
      createInvoiceSchema.parse({
        ...validInvoice,
        items: [],
      });
    });

    // Rechaza precios con formato no monetario
    assert.throws(() => {
      createInvoiceSchema.parse({
        ...validInvoice,
        items: [
          {
            ...validInvoice.items[0],
            unitPrice: 'cien_pesos',
          },
        ],
      });
    });
  });

  it('valida despacho de inventario y referencias', () => {
    const validDispatch = {
      referenceType: 'INVOICE' as const,
      referenceId: 'INV-2026-0001',
      items: [
        {
          productId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
          warehouseId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          quantity: 5,
        },
      ],
    };

    const parsed = dispatchStockSchema.parse(validDispatch);
    assert.equal(parsed.referenceType, 'INVOICE');
    assert.equal(parsed.items[0].quantity, 5);
  });

  it('valida creación de asientos contables con al menos 2 líneas', () => {
    const validJournal = {
      branchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      entryDate: '2026-10-31',
      entryType: JournalEntryType.SALE,
      description: 'Causación de venta POS #0001',
      lines: [
        { accountCode: '110505', debit: '100000.00', credit: '0.00', concept: 'Caja general' },
        { accountCode: '413505', debit: '0.00', credit: '100000.00', concept: 'Comercio al por mayor' },
      ],
    };

    const parsed = createJournalEntrySchema.parse(validJournal);
    assert.equal(parsed.lines.length, 2);

    // Falla si solo tiene 1 línea
    assert.throws(() => {
      createJournalEntrySchema.parse({
        ...validJournal,
        lines: [validJournal.lines[0]],
      });
    });
  });

  it('valida eventos públicos de integración para Outbox', () => {
    const validEvent = {
      eventId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      tenantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      eventType: 'sales.invoice_issued' as const,
      occurredAt: '2026-10-31T20:00:00.000Z',
      payload: {
        invoiceId: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        branchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        warehouseId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        invoiceNumber: 'FAC-001',
        subtotal: '100000.00',
        taxAmount: '19000.00',
        total: '119000.00',
        items: [
          {
            productId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            quantity: 1,
            unitPrice: '100000.00',
          },
        ],
        payments: [{ method: 'CASH', amount: '119000.00' }],
      },
    };

    const parsed = invoiceIssuedIntegrationEventSchema.parse(validEvent);
    assert.equal(parsed.eventType, 'sales.invoice_issued');
    assert.equal(parsed.payload.total, '119000.00');
  });
});

