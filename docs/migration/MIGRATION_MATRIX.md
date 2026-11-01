# MATRIZ DE TRAZABILIDAD Y MIGRACIÓN (MIGRATION MATRIX)

> **Regla de Oro:** Una funcionalidad o componente NO se marca como `Migrado` simplemente por copiar archivos. Debe pasar por las fases de compilación, inyección de dependencias y pruebas correspondientes en `C:\unisaas\new\`.  
> **Estados Válidos:** `Pendiente`, `En análisis`, `En migración`, `Migrado`, `Verificado`, `Descartado con justificación`.

---

## 1. Mapeo General por Squads y Componentes

| ID | Origen (`old/`) | Componente / Funcionalidad | Responsabilidad | Destino Propuesto (`new/`) | Estado Actual | Criterio de Verificación para "Verificado" |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S1-01** | `squad1/src/application/services/auth.service.ts` | Autenticación y Stateful JWT | Login, refresh, emisión de tokens con `jti`, blacklist | `modules/identity/src/services/auth.service.ts` | **Verificado** | Emisión de tokens JWT con `jti`, refresh token seguro y verificación contra Redis. |
| **S1-02** | `squad1/src/infrastructure/adapters/out/redis` | Adaptador Redis de Sesión | Almacén y validación rápida de sesiones activas | `packages/redis-client` | **Verificado** | Revocación en $O(M)$ y manejo determinista de HTTP 503 ante caída (19 tests). |
| **S1-03** | `squad1/src/domain/entities/tenant.entity.ts` | Modelo de Inquilino (Tenant) | Definición y aislamiento de inquilinos | `packages/database/prisma/schema/tenant.prisma` | **Verificado** | Modelo validado con `prisma validate` y RLS forzado en migración inicial. |
| **S1-04** | `squad1/src/application/services/tenants.service.ts` | Gestión de Inquilinos | CRUD de tenants, activación y estado | `modules/identity/src/services/tenant.service.ts` | **Verificado** | Endpoints de tenants operativos en gateway y validados en tests. |
| **S1-05** | `squad1/src/application/services/users.service.ts` | Gestión de Usuarios y RBAC | Roles (ADMIN, CASHIER, etc.), permisos | `modules/identity/src/services/user.service.ts` | **Verificado** | Guardias de roles interceptando correctamente con contexto RLS. |
| **S1-06** | `squad1/src/application/services/plans.service.ts` | Planes y Tarifas SaaS | Planes de suscripción y límites de sucursales | `modules/identity/src/services/plan.service.ts` | **Verificado** | Control de límites y planes SaaS funcional. |
| **S1-07** | `squad1/src/infrastructure/adapters/in/context` | Contexto de Inquilino RLS | Extracción de tenant_id y set en request | `apps/api-gateway/src/common/guards/tenant-context.guard.ts` | **Verificado** | Inyección de tenant_id validada en middleware y `withTenantContext`. |
| **S2-01** | `squad2/src/application/services/puc.service.ts` | Catálogo de Cuentas PUC | Plan Único de Cuentas para Colombia | `modules/accounting/src/services/puc.service.ts` | **Verificado** | Estructura jerárquica de cuentas PUC validada y sembrada. |
| **S2-02** | `squad2/src/application/services/accounting.service.ts` | Asientos Contables (Journal Entries) | Registro de partida doble con `decimal.js` | `modules/accounting/src/services/accounting.service.ts` | **Verificado** | Invariante débito == crédito verificado en transacciones de checkout. |
| **S2-03** | `squad2/src/domain/entities/account.entity.ts` | Modelos Contables | Cuentas, asientos y líneas contables | `packages/database/prisma/schema/accounting.prisma` | **Verificado** | 32 modelos y 31 enums migrados a Prisma 6 modular. |
| **S2-04** | `squad2/src/application/services/reports.service.ts` | Libro Diario y Mayor | Reportes básicos de libro diario | `modules/accounting/src/services/accounting.service.ts` | **Verificado** | Generación de reportes cuadrados con aislamiento RLS. |
| **S3-01** | `squad3/prisma/schema.prisma` | Esquema Canónico de Base de Datos | 32 modelos relacionales consolidados | `packages/database/prisma/schema/*.prisma` | **Verificado** | Validación modular y migración 0_init_unisaas certificada. |
| **S3-02** | `squad3/src/domain/policy/precision-policy.ts` | Políticas de Precisión Financiera | Precisión decimal fija en costos y saldos | `packages/core-domain` (`Money`, `Quantity`) | **Verificado** | 23 tests unitarios completados con `decimal.js 10.6.0`. |
| **S3-03** | `squad3/src/application/services/product/*` | Gestión de Catálogo y Productos | Creación, búsqueda y actualización de ítems | `modules/inventory/src/services/product.service.ts` | **Verificado** | Búsqueda por barcode y SKU operativa con RLS. |
| **S3-04** | `squad3/src/application/services/inventory/dispatch-stock.service.ts` | Despacho de Stock y Kardex CPP | Salida de almacén y cálculo de costo CPP | `modules/inventory/src/services/inventory.service.ts` | **Verificado** | Bloqueo pesimista `FOR UPDATE` comprobado en k6 y checkout atómico. |
| **S3-05** | `squad3/src/application/services/inventory/receive-stock.service.ts` | Recepción de Stock y Recálculo CPP | Entrada de compras y nuevo costo promedio | `modules/inventory/src/services/inventory.service.ts` | **Verificado** | Recálculo matemático verificado con pruebas. |
| **S3-06** | `squad3/src/application/services/transfer/*` | Traslados entre Almacenes | Transferencias de stock origen-destino | `modules/inventory/src/services/inventory.service.ts` | **Verificado** | Salida y entrada atómica entre bodegas. |
| **S3-07** | `squad3/src/application/services/stock-count/*` | Conteos y Ajustes Físicos | Conciliación física de inventario | `modules/inventory/src/services/inventory.service.ts` | **Verificado** | Generación de ajuste y movimiento de cuadre. |
| **S3-08** | `squad3/packages/contracts` | Contratos DTO de Inventario | DTOs tipados y esquemas Zod | `packages/contracts` | **Verificado** | Compilación y exportación de paquetes limpia (6 tests). |
| **S4-01** | `squad4/src/app` | Rutas de Frontend Next.js 15 | Vistas de mostrador POS, admin, login | `apps/web-pos/src/app` | **Verificado** | Renderizado sin errores en React 19 y Next.js 15. |
| **S4-02** | `squad4/src/core/application/stores` | Estado Global de UI (Zustand) | Carrito de compras, sesión, preferencias | `apps/web-pos/src/core/stores` | **Verificado** | Persistencia de carrito local validada (13 tests). |
| **S4-03** | `squad4/src/app/api/*` | Rutas BFF de Next.js | Proxies y adaptadores HTTP | `apps/web-pos/src/app/api/*` y `api-client.ts` | **Verificado** | Conexión tipada hacia `apps/api-gateway` con cookies httpOnly. |
| **S4-04** | `squad4/src/core/infrastructure/db.ts` | Acceso SQL Directo (`pg`) | Conexión directa a base de datos en Next | **Descartado con justificación** | Eliminado: Next.js consume exclusivamente la API REST de NestJS. |
| **S5-01** | `squad5/lib/core/database/database.dart` | Almacén SQLite Local (Drift) | Tablas locales offline de ventas y carrito | `apps/mobile-pos/lib/core/database` | **Verificado** | Drift SQLite con persistencia de reinicios (Escenario D) verificado al 100%. |
| **S5-02** | `squad5/lib/core/sync/sync_queue_worker.dart` | Worker de Sincronización Outbox | Cola de reintentos con `Idempotency-Key`, backoff y 409 | `apps/mobile-pos/lib/core/sync` | **Verificado** | Escenarios A (idempotencia), B (backoff 5xx) y C (conflicto 409) pasando en tests. |
| **S5-03** | `squad5/lib/features/pos/presentation` | Interfaz Móvil de Mostrador | Pantalla táctil de cobro rápido y carrito | `apps/mobile-pos/lib/features/pos` | **Verificado** | Flujo completo verificado en tests de widgets y navegación. |
| **S5-04** | Contratos de API para Flutter | Comunicación tipada con backend | DTOs y llamadas HTTP fuertemente tipadas | `apps/mobile-pos/lib/core/api/generated` | **Verificado** | Generado automáticamente con OpenAPI v3 vía `generate-dart-api.ps1`. |
| **S6-01** | `squad6/src/application/services/escpos.service.ts` | Motor de Impresión Térmica ESC/POS | Generación de comandos binarios de impresión | `packages/escpos` | **Verificado** | Librería pura probada con tickets de 58 y 80mm (5 tests). |
| **S6-02** | `squad6/src/application/services/invoices.service.ts` | Anulación de Comprobantes | Reversión de facturas y anulación formal | `modules/sales/src/services/sales.service.ts` | **Verificado** | Reversión de kardex y contraasiento contable. |
| **S6-03** | `squad6/src/domain/entities/balance-sheet.entity.ts` | Reportes Financieros | Balance General y Estado de Resultados | `modules/accounting/src/services/accounting.service.ts`| **Verificado** | Consulta de balance cuadrado desde BD con RLS. |
| **S7-01** | `squad7/src/application/use-cases/customer-credit.use-case.ts` | Cartera Fiado y Crédito a Clientes | Ventas a crédito, cupos y abonos | `modules/credits/src/services/credits.service.ts` | **Verificado** | Validación de cupo límite por cliente. |
| **S7-02** | `squad7/src/application/use-cases/supplier-purchase.use-case.ts` | Compras y Cuentas por Pagar | Facturas de compra y proveedores | `modules/credits/src/services/purchases.service.ts`| **Verificado** | Ingreso de compra e impacto en kardex. |
| **S7-03** | `squad7/src/domain/rules/credit-limit.rule.ts` | Reglas de Límite de Crédito | Invariantes de cupo máximo de fiado | `modules/credits/src/rules/credit-limit.rule.ts` | **Verificado** | Tests unitarios de reglas passing al 100%. |
| **S8-01** | `squad8/tests/k6/pos-checkout-load.js` | Prueba de Carga k6 | Estrés de checkout en mostrador | `apps/qa-e2e/k6/scenarios/*` | **Verificado** | Carga abierta 40 iter/s y 50 HTTP req/s sostenida con 0% errores y 0 deadlocks. |
| **S8-02** | `squad8/scripts/test-rls.sql` | Suite de Certificación RLS | Validación de 10 casos de aislamiento y pool leak | `apps/qa-e2e/rls-certification/*` | **Verificado** | 10/10 criterios aprobados con rol `app_runtime`, triple blindaje y 0 fugas en pool. |
| **S8-03** | `squad8/monitoring/*` | Dashboards y Observabilidad | Métricas de Postgres, Redis y Node.js | `apps/qa-e2e/scripts/collect-metrics.ps1` | **Verificado** | Telemetría activa: 0 deadlocks, 0 lock waits, Node RSS < 190MB, Redis CPU < 1%. |
| **S8-04** | `squad8/tests/e2e/*.cjs` | Pruebas E2E de Aislamiento e Idempotencia | Validación de seguridad multi-tenant y replay | `apps/qa-e2e/e2e/*` | **Verificado** | 4/4 tests de aislamiento (403 spoofing) y 2/2 tests de idempotencia pasando al 100%. |
| **ROOT-01**| `old/scripts/deploy.ps1` | Script Maestro de Despliegue | Orquestación en Windows Server | `scripts/deploy.ps1` | **Verificado** | Adaptado para ejecutar `pnpm` y Prisma Migrate. |
| **ROOT-02**| `old/ecosystem.config.cjs` | Configuración de PM2 | Gestión de procesos en producción | `ecosystem.config.cjs` | **Verificado** | Simplificado a 2 servicios (`api-gateway` y `web-pos`). |

---

## 2. Matriz de Compatibilidad de Runtimes y Compiladores

| Componente / Herramienta | Versión Estandarizada | Rango Soportado | Justificación Técnica y Evidencia |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v26.13.0` (Host) | `^24.0.0 \|\| ^26.0.0` | Node 24 LTS y Node 26 LTS son las versiones con ciclo de vida activo. Node 20 descartado por obsolescencia. Compatible con Prisma 6.19 y Turborepo 2.11. |
| **pnpm** | `12.16.1` | `>=9.0.0` | Gestor unificado con aislamiento estricto (`node-linker=isolated`, `auto-install-peers=true`). |
| **TypeScript** | `5.9.3` | `^5.9.3` | **Unificado al 100% en todo el monorepo.** Se elimina la inconsistencia histórica con 5.7.3. Compatible con NestJS 11, Next.js 15 y decoradores. |
| **Prisma ORM** | `6.19.3` | `6.19.3` | Declara `"node": ">=18.18"`. `prismaSchemaFolder` es oficialmente GA desde 6.7.0 (no requiere `previewFeatures`). Compatible con Node 24 y 26 LTS. |
| **Turborepo** | `2.11.10` | `^2.3.4` | Requiere `"packageManager": "pnpm@12.16.1"` declarado en el `package.json` raíz. |
| **PostgreSQL** | `16.x` / `17.x` | `>=16.0` | Soporte nativo para `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`. RLS transaccional mediante `SET LOCAL app.current_tenant_id` y `SET LOCAL ROLE app_runtime`. |


