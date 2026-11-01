import { PrismaClient } from '@unisaas/database';
import { Environment } from '../config/environment.js';

export async function seedQaData(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: Environment.dbAdminUrl,
      },
    },
  });

  try {
    console.log('--- Inicializando Fixtures de QA & k6 ---');

    // 1. Password hashes
    await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET password_hash = '$2a$10$Nv9bv7t23YCzTLvql2V8ROyW3cGcZbh3rz4Er.hyVNKBdu7QWeon6',
          is_active = true
      WHERE email IN ('cajero@tenant-1111.com', 'cajero@tenant-2222.com');
    `);

    // 2. Tenants activos
    await prisma.$executeRawUnsafe(`
      UPDATE tenants 
      SET is_active = true 
      WHERE id IN ('${Environment.tenants.tenantA.id}', '${Environment.tenants.tenantB.id}');
    `);

    // 3. Stock abundante
    await prisma.$executeRawUnsafe(`
      UPDATE inventory_balances
      SET quantity_on_hand = 1000000.000000,
          reserved_quantity = 0.000000
      WHERE variant_id IN (
        '${Environment.tenants.tenantA.variantId}',
        '${Environment.tenants.tenantB.variantId}'
      );
    `);

    console.log('✅ Fixtures aplicados exitosamente:');
    console.log(`   Tenant A: ${Environment.tenants.tenantA.id} (${Environment.tenants.tenantA.email})`);
    console.log(`   Tenant B: ${Environment.tenants.tenantB.id} (${Environment.tenants.tenantB.email})`);
    console.log('   Stock de variantes garantizado en 1,000,000 unidades.');
  } finally {
    await prisma.$disconnect();
  }
}

// Si se ejecuta directamente vía CLI
if (process.argv[1]?.includes('seed-qa-data')) {
  seedQaData().catch((err) => {
    console.error('Error sembrando datos de QA:', err);
    process.exit(1);
  });
}

