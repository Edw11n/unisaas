import { PrismaClient, withTenantContext } from '@unisaas/database';

export interface CheckoutFixtures {
  tenantId: string;
  branchId: string;
  warehouseId: string;
  userId: string;
  uomId: string;
  categoryId: string;
  productId: string;
  variantId: string;
  balanceId: string;
  customerId: string;
}

export function getFixturesConfig(suiteIndex: 1 | 2 | 3): CheckoutFixtures {
  if (suiteIndex === 1) {
    return {
      tenantId: '11111111-1111-1111-1111-111111111111',
      branchId: 'a1111111-1111-1111-1111-111111111111',
      warehouseId: 'b1111111-1111-1111-1111-111111111111',
      userId: 'c1111111-1111-1111-1111-111111111111',
      uomId: 'd1111111-1111-1111-1111-111111111111',
      categoryId: 'e1111111-1111-1111-1111-111111111111',
      productId: 'f1111111-1111-1111-1111-111111111111',
      variantId: 'f2222222-1111-1111-1111-111111111111',
      balanceId: 'f3333333-1111-1111-1111-111111111111',
      customerId: 'f4444444-1111-1111-1111-111111111111',
    };
  }

  if (suiteIndex === 2) {
    return {
      tenantId: '22222222-2222-2222-2222-222222222222',
      branchId: 'a2222222-2222-2222-2222-222222222222',
      warehouseId: 'b2222222-2222-2222-2222-222222222222',
      userId: 'c2222222-2222-2222-2222-222222222222',
      uomId: 'd2222222-2222-2222-2222-222222222222',
      categoryId: 'e2222222-2222-2222-2222-222222222222',
      productId: 'f2222222-2222-2222-2222-222222222222',
      variantId: 'f2222222-2222-2222-2222-222222222223',
      balanceId: 'f3333333-2222-2222-2222-222222222222',
      customerId: 'f4444444-2222-2222-2222-222222222222',
    };
  }

  return {
    tenantId: '30000000-0000-0000-0000-000000000003',
    branchId: 'a3333333-3333-3333-3333-333333333333',
    warehouseId: 'b3333333-3333-3333-3333-333333333333',
    userId: 'c3333333-3333-3333-3333-333333333333',
    uomId: 'd3333333-3333-3333-3333-333333333333',
    categoryId: 'e3333333-3333-3333-3333-333333333333',
    productId: 'f3333333-3333-3333-3333-333333333333',
    variantId: 'f2222222-3333-3333-3333-333333333333',
    balanceId: 'f3333333-3333-3333-3333-333333333333',
    customerId: 'f4444444-3333-3333-3333-333333333333',
  };
}

export async function setupCheckoutTestFixtures(adminPrisma: PrismaClient, cfg: CheckoutFixtures) {
  // Limpiar datos previos del tenant específico de la prueba
  const cleanStatements = [
    `DELETE FROM invoice_items WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM invoices WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_ledger_entries WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_movement_lines WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_movements WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_balances WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM journal_entry_lines WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM journal_entries WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM credit_transactions WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM third_parties WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_outbox_events WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_audit_logs WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM inventory_idempotency_keys WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM product_variants WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM products WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM product_categories WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM unit_of_measures WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM users WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM warehouses WHERE tenant_id = '${cfg.tenantId}'::uuid`,
    `DELETE FROM branches WHERE tenant_id = '${cfg.tenantId}'::uuid`,
  ];

  for (const stmt of cleanStatements) {
    await adminPrisma.$executeRawUnsafe(stmt);
  }

  // Crear sucursal
  await adminPrisma.branch.create({
    data: {
      id: cfg.branchId,
      tenantId: cfg.tenantId,
      code: `SUC-${cfg.tenantId.slice(0, 4)}`,
      name: 'Sucursal Centro',
      address: 'Calle 10 # 5-20',
      isActive: true,
    },
  });

  // Crear bodega
  await adminPrisma.warehouse.create({
    data: {
      id: cfg.warehouseId,
      tenantId: cfg.tenantId,
      branchId: cfg.branchId,
      code: `BOD-${cfg.tenantId.slice(0, 4)}`,
      name: 'Bodega Principal',
      status: 'ACTIVE',
    },
  });

  // Crear usuario cajero
  await adminPrisma.user.create({
    data: {
      id: cfg.userId,
      tenantId: cfg.tenantId,
      branchId: cfg.branchId,
      documentType: 'CC',
      documentNumber: `1098${cfg.tenantId.slice(0, 6)}`,
      email: `cajero@tenant-${cfg.tenantId.slice(0, 4)}.com`,
      passwordHash: '$2b$10$xyz',
      fullName: 'Carlos Cajero',
      role: 'CASHIER',
      isActive: true,
    },
  });

  // Crear unidad de medida
  await adminPrisma.unitOfMeasure.create({
    data: {
      id: cfg.uomId,
      tenantId: cfg.tenantId,
      code: `UND-${cfg.tenantId.slice(0, 4)}`,
      name: 'Unidad',
      symbol: 'UND',
      unitType: 'UNIT',
      decimalPlaces: 0,
      conversionFactor: 1,
      isActive: true,
    },
  });

  // Crear categoría de producto
  await adminPrisma.productCategory.create({
    data: {
      id: cfg.categoryId,
      tenantId: cfg.tenantId,
      name: `Bebidas-${cfg.tenantId.slice(0, 4)}`,
      isActive: true,
    },
  });

  // Crear producto
  await adminPrisma.product.create({
    data: {
      id: cfg.productId,
      tenantId: cfg.tenantId,
      sku: `COL-500-${cfg.tenantId.slice(0, 4)}`,
      name: 'Gaseosa Cola 500ml',
      categoryId: cfg.categoryId,
      unitOfMeasureId: cfg.uomId,
      costPrice: 1500,
      salePrice: 3000,
      taxRate: 0.19,
      minStockAlert: 5,
      productType: 'STOCKABLE',
      status: 'ACTIVE',
      costMethod: 'WEIGHTED_AVERAGE',
    },
  });

  // Crear variante
  await adminPrisma.productVariant.create({
    data: {
      id: cfg.variantId,
      tenantId: cfg.tenantId,
      productId: cfg.productId,
      sku: `COL-500-ORIG-${cfg.tenantId.slice(0, 4)}`,
      name: 'Gaseosa Cola 500ml Original',
      unitOfMeasureId: cfg.uomId,
      costPrice: 1500,
      salePrice: 3000,
      taxRate: 0.19,
      minStockAlert: 5,
      isDefault: true,
      status: 'ACTIVE',
    },
  });

  // Crear balance inicial: 100 unidades a costo promedio $1500 = $150,000
  await adminPrisma.inventoryBalance.create({
    data: {
      id: cfg.balanceId,
      tenantId: cfg.tenantId,
      productId: cfg.productId,
      variantId: cfg.variantId,
      warehouseId: cfg.warehouseId,
      quantityOnHand: 100,
      averageCost: 1500,
      inventoryValue: 150000,
    },
  });

  // Crear cliente para pruebas de crédito
  await adminPrisma.thirdParty.create({
    data: {
      id: cfg.customerId,
      tenantId: cfg.tenantId,
      documentType: 'CC',
      documentNumber: `9876${cfg.tenantId.slice(0, 6)}`,
      name: 'Juan Perez Cliente',
      partyType: 'CUSTOMER',
      creditLimit: 50000, // Límite de crédito $50,000
      currentDebt: 0,
      isActive: true,
    },
  });
}
