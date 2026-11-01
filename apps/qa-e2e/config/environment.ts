export const Environment = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api/v1',
  dbRuntimeUrl:
    process.env.DATABASE_RUNTIME_URL ||
    'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
  dbAdminUrl:
    process.env.DATABASE_ADMIN_URL ||
    'postgresql://saas_migration_admin:postgres@localhost:5432/saas_contable_db?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  tenants: {
    tenantA: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Tenant QA A S.A.S.',
      email: 'cajero@tenant-1111.com',
      password: 'password123',
      branchId: 'a1111111-1111-1111-1111-111111111111',
      warehouseId: 'b1111111-1111-1111-1111-111111111111',
      productId: 'f1111111-1111-1111-1111-111111111111',
      variantId: 'f2222222-1111-1111-1111-111111111111',
    },
    tenantB: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Tenant QA B S.A.S.',
      email: 'cajero@tenant-2222.com',
      password: 'password123',
      branchId: 'a2222222-2222-2222-2222-222222222222',
      warehouseId: 'b2222222-2222-2222-2222-222222222222',
      productId: 'f2222222-2222-2222-2222-222222222222',
      variantId: 'f2222222-2222-2222-2222-222222222223',
    },
  },
  k6: {
    binaryPath: 'C:\\Users\\Edwin\\k6-v0.56.0-windows-amd64\\k6.exe',
    rate: 40,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 100,
  },
};
