import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('RLS DDL Migration & Security Hardening (0_init_unisaas)', () => {
  const migrationPath = join(
    process.cwd(),
    'prisma',
    'migrations',
    '0_init_unisaas',
    'migration.sql',
  );

  it('verifica que el archivo de migración DDL existe en la ruta canónica', () => {
    assert.equal(existsSync(migrationPath), true);
  });

  it('verifica la creación del rol app_runtime con NOBYPASSRLS y sin privilegios de superusuario', () => {
    const content = readFileSync(migrationPath, 'utf8');

    assert.ok(content.includes("rolname = 'app_runtime'"));
    assert.ok(content.includes('CREATE ROLE app_runtime'));
    assert.ok(content.includes('NOSUPERUSER'));
    assert.ok(content.includes('NOCREATEROLE'));
    assert.ok(content.includes('NOINHERIT'));
    assert.ok(content.includes('NOBYPASSRLS'));
    assert.ok(content.includes('GRANT app_runtime TO saas_migration_admin'));
  });

  it('verifica que current_tenant_id() implementa search_path seguro y privilegios acotados', () => {
    const content = readFileSync(migrationPath, 'utf8');

    assert.ok(content.includes('CREATE OR REPLACE FUNCTION current_tenant_id()'));
    assert.ok(content.includes('SET search_path = pg_catalog, public'));
    assert.ok(content.includes('SECURITY DEFINER'));
    assert.ok(content.includes('REVOKE ALL ON FUNCTION current_tenant_id() FROM PUBLIC'));
    assert.ok(content.includes('GRANT EXECUTE ON FUNCTION current_tenant_id() TO app_runtime'));
  });

  it('garantiza la aplicación estricta de ENABLE RLS y FORCE RLS', () => {
    const content = readFileSync(migrationPath, 'utf8');

    // Ambos comandos deben estar presentes en el procedimiento de activación
    assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'));
    assert.ok(content.includes('FORCE ROW LEVEL SECURITY'));

    // Debe existir política tenant_isolation_policy
    assert.ok(content.includes('CREATE POLICY tenant_isolation_policy'));
    assert.ok(content.includes('tenant_id = current_tenant_id()'));
  });

  it('verifica que todas las tablas de dominio multi-tenant están listadas para blindaje', () => {
    const content = readFileSync(migrationPath, 'utf8');

    const expectedTables = [
      'branches',
      'third_parties',
      'chart_of_accounts',
      'product_categories',
      'unit_of_measures',
      'products',
      'product_variants',
      'product_barcodes',
      'users',
      'warehouses',
      'inventory_balances',
      'inventory_transfers',
      'inventory_transfer_lines',
      'stock_counts',
      'stock_count_lines',
      'inventory_movements',
      'inventory_movement_lines',
      'inventory_ledger_entries',
      'journal_entries',
      'journal_entry_lines',
      'pos_shifts',
      'invoices',
      'invoice_items',
      'purchases',
      'purchase_items',
      'credit_transactions',
      'tenant_sequences',
      'audit_logs',
      'inventory_idempotency_keys',
      'inventory_outbox_events',
      'inventory_audit_logs',
    ];

    for (const table of expectedTables) {
      assert.ok(
        content.includes(`'${table}'`),
        `La tabla multi-tenant "${table}" no está incluida en el array de blindaje RLS`,
      );
    }
  });

  it('verifica que se conceden mínimos privilegios DML sobre el esquema public para app_runtime', () => {
    const content = readFileSync(migrationPath, 'utf8');

    assert.ok(content.includes('GRANT USAGE ON SCHEMA public TO app_runtime'));
    assert.ok(content.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime'));
  });
});

