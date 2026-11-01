import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runRlsAudit(): Promise<boolean> {
  console.log('================================================================');
  console.log('INICIANDO AUDITORÍA Y CERTIFICACIÓN COMPLETA DE POSTGRESQL RLS');
  console.log('================================================================');

  const possiblePaths = [
    join(__dirname, 'rls-comprehensive-audit.sql'),
    join(__dirname, '../../rls-certification/rls-comprehensive-audit.sql'),
    'C:/unisaas/new/apps/qa-e2e/rls-certification/rls-comprehensive-audit.sql',
  ];

  let sqlContent = '';
  for (const p of possiblePaths) {
    try {
      sqlContent = readFileSync(p, 'utf-8');
      break;
    } catch (_) {}
  }

  if (!sqlContent) {
    throw new Error('No se pudo localizar rls-comprehensive-audit.sql');
  }

  try {
    console.log('\n[1/2] Ejecutando rls-comprehensive-audit.sql contra PostgreSQL real...');
    const result = execSync(
      'docker exec -i unisaas-postgres-rls-test psql -U saas_migration_admin -d saas_contable_db',
      {
        input: sqlContent,
        encoding: 'utf-8',
      },
    );

    console.log(result);
    console.log('✅ Auditoría SQL completada sin excepciones.');

    console.log('\n[2/2] Ejecutando rls-connection-pool-leak.js (node --test)...');
    const testOutput = execSync(
      'node --test apps/qa-e2e/dist/rls-certification/rls-connection-pool-leak.js',
      {
        cwd: 'C:/unisaas/new',
        encoding: 'utf-8',
      },
    );
    console.log(testOutput);
    console.log('✅ Certificación RLS de Conexiones y Concurrencia completada con éxito.');
    return true;
  } catch (error: any) {
    console.error('❌ Error ejecutando auditoría SQL RLS:', error.stdout || error.message);
    throw error;
  }
}

if (process.argv[1]?.includes('run-rls-tests')) {
  runRlsAudit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
