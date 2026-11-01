import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// ============================================================================
// ESCUADRÓN 8: DEVOPS, SRE, OBSERVABILIDAD & QA AUTOMATION
// Suite de Pruebas de Contratos OpenAPI y Gobernanza de Integración
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDirs = [
  path.resolve(__dirname, 'fixtures'),
  path.resolve(__dirname, '../../contracts/fixtures'),
  path.resolve('apps/qa-e2e/contracts/fixtures'),
  'C:/unisaas/new/apps/qa-e2e/contracts/fixtures',
];
const FIXTURES_DIR = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];

// Leer todos los archivos .yaml de la carpeta fixtures/
const fixtureFiles = fs.existsSync(FIXTURES_DIR)
  ? fs.readdirSync(FIXTURES_DIR).filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
  : [];

describe('Suite de Validación de Contratos OpenAPI (Escuadrón 8: DevOps & QA)', () => {
  it('debe existir al menos un archivo de contrato .yaml en la carpeta fixtures/', () => {
    assert.ok(fixtureFiles.length > 0, 'No se encontraron contratos YAML en fixtures/');
  });

  // Iterar por cada archivo de contrato encontrado en fixtures/
  for (const fileName of fixtureFiles) {
    const filePath = path.join(FIXTURES_DIR, fileName);

    describe(`Contrato OpenAPI: ${fileName}`, () => {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const api = YAML.parse(fileContent);

      it('debe ser una especificación OpenAPI 3.0.3 válida', () => {
        assert.ok(api, 'El archivo YAML no pudo ser parseado');
        assert.equal(api.openapi, '3.0.3', `El contrato ${fileName} debe ser OpenAPI 3.0.3`);
        assert.ok(api.info, 'Debe incluir bloque info');
        assert.ok(api.info.title, 'Debe incluir info.title');
        assert.ok(api.info.version, 'Debe incluir info.version');
      });

      it('debe contener explícitamente las rutas de observabilidad /health y /metrics con método GET', () => {
        assert.ok(api.paths, `El contrato ${fileName} debe definir paths`);

        // Validar ruta /health
        assert.ok(api.paths['/health'], `El contrato ${fileName} debe contener la ruta /health`);
        assert.ok(api.paths['/health']?.get, `La ruta /health en ${fileName} debe definir el método GET`);

        // Validar ruta /metrics
        assert.ok(api.paths['/metrics'], `El contrato ${fileName} debe contener la ruta /metrics`);
        assert.ok(api.paths['/metrics']?.get, `La ruta /metrics en ${fileName} debe definir el método GET`);
      });

      it('todas las operaciones POST deben exigir en sus parámetros las cabeceras X-Tenant-Id y X-Idempotency-Key (required: true)', () => {
        assert.ok(api.paths, `El contrato ${fileName} debe definir paths`);

        const paths = api.paths;
        let postCount = 0;

        for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
          if (!pathItem || typeof pathItem !== 'object' || !pathItem.post) {
            continue;
          }

          postCount++;
          const postOp = pathItem.post;
          const opParams: any[] = postOp.parameters ?? [];
          const pathParams: any[] = pathItem.parameters ?? [];
          const allParams = [...pathParams, ...opParams];

          const findHeaderParam = (headerName: string) => {
            return allParams.find(
              (p: any) =>
                p &&
                typeof p === 'object' &&
                p.in === 'header' &&
                typeof p.name === 'string' &&
                p.name.toLowerCase() === headerName.toLowerCase(),
            );
          };

          // Validar cabecera X-Tenant-Id
          const tenantHeader = findHeaderParam('x-tenant-id');
          assert.ok(
            tenantHeader,
            `El endpoint POST ${pathKey} en ${fileName} debe incluir el parámetro 'X-Tenant-Id' en header`,
          );
          assert.equal(
            tenantHeader.required,
            true,
            `El parámetro 'X-Tenant-Id' en POST ${pathKey} en ${fileName} debe ser obligatorio (required: true)`,
          );

          // Validar cabecera X-Idempotency-Key
          const idempotencyHeader = findHeaderParam('x-idempotency-key');
          assert.ok(
            idempotencyHeader,
            `El endpoint POST ${pathKey} en ${fileName} debe incluir el parámetro 'X-Idempotency-Key' en header`,
          );
          assert.equal(
            idempotencyHeader.required,
            true,
            `El parámetro 'X-Idempotency-Key' en POST ${pathKey} en ${fileName} debe ser obligatorio (required: true)`,
          );
        }

        // Asegurar que al menos exista una operación POST evaluada
        assert.ok(
          postCount > 0,
          `El contrato ${fileName} debe definir al menos una operación POST para auditoría`,
        );
      });
    });
  }
});
