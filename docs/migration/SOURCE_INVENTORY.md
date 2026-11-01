# INVENTARIO TÉCNICO DEL PROYECTO ORIGINAL (SOURCE INVENTORY)

> **Ubicación de Referencia (Solo Lectura):** `C:\unisaas\old\`  
> **Fecha de Auditoría:** 31 de octubre de 2026  
> **Estándar Epistemológico:** Clasificación estricta entre `[HECHO VERIFICADO]` e `[HIPÓTESIS]`.

---

## 1. Estructura General de los Ocho Squads

El proyecto original está organizado en 8 carpetas independientes dentro de `C:\unisaas\old`, cada una funcionando como un proyecto autónomo:

```text
C:\unisaas\old\
├── squad1_core_architecture_rls_rbac-main/      # Core, Identidad, RLS, RBAC, Multi-tenancy
├── squad2_accounting_engine_ledger-main/        # Motor Contable, PUC, Libro Mayor, Asientos
├── squad3_inventory_kardex_cpp-master/          # Inventario, Kardex CPP, Prisma 6, Almacenes
├── squad4_web_desktop_pos_nextjs-main/          # Web & Desktop POS Frontend (Next.js 15)
├── squad5_mobile_pos_offline-main/              # Mobile POS Offline (Flutter / Drift)
├── squad6_reports_audit_escpos-develop/         # Reportes, Anulación de Facturas, ESC/POS
├── squad7_credits_purchases_suppliers-main/     # Cartera Fiado, Compras, Proveedores
├── squad8_devops_sre_qa-main/                   # DevOps, SRE, k6, Playwright CDP, Docker
├── scripts/                                     # Scripts de despliegue, respaldo y entorno
├── docs/                                        # Documentación técnica y auditorías previas
└── bridge/                                      # Herramientas de puente de desarrollo
```

---

## 2. Matriz de Tecnologías y Versiones Verificadas

| Squad | Nombre de Paquete | Módulo / Runtime | Node / Dart | TypeScript | Framework Principal | ORM / Persistencia | Driver Redis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Squad 1** | `squad1_core_architecture_rls_rbac` | `"type": "module"` (ESM) | Node `>=20` | `^6.0.2` | NestJS `^12.0.1` | TypeORM `^1.1.1` | `ioredis: ^6.0.0` |
| **Squad 2** | `squad2-accounting-engine-ledger` | `"type": "commonjs"` | Node `>=20` | `^5.4.5` | NestJS `^10.3.8` | TypeORM `^0.3.20` | N/A |
| **Squad 3** | `@saas/api` | `"type": "commonjs"` | Node `>=20` | `^5.5.4` | NestJS `^11.0.0` | Prisma `6.19.3` / `@prisma/client: 6` | `ioredis: ^5.4.1` |
| **Squad 4** | `squad4_web_desktop_pos_nextjs` | `"type": "commonjs"` | Node `>=20` | `^5.7.3` | Next.js `^15.1.7` (React `19.0.0`) | `pg: ^8.13.1` (Direct SQL) | N/A (Local Map) |
| **Squad 5** | `unisaas_mobile_pos` | Dart / Flutter | Dart `>=3.5.0` / Flutter `>=3.24.0` | N/A | Flutter (Riverpod `^2.6.1`) | Drift `^2.24.2` (SQLite nativo) | N/A |
| **Squad 6** | `escuadron-6-reportes-anulacion-perifericos` | `"type": "commonjs"` | Node `>=20` | `^5.7.2` | NestJS `^10.4.15` | `pg: ^8.13.1` | N/A |
| **Squad 7** | `squad7-credits-purchases-suppliers` | `"type": "commonjs"` | Node `>=20` | `^5.7.2` | NestJS `^11.0.0` | TypeORM `^1.1.2` | N/A |
| **Squad 8** | `squad8-devops-sre-qa` | `"type": "commonjs"` | Node `>=20` | `^5.4.5` | Vitest `^1.6.0` / Playwright `1.64.1` | `pg: ^8.13.1` | N/A |

* **[HECHO VERIFICADO]:** Los squads tienen versiones heterogéneas de NestJS (10, 11 y 12) y TypeScript (5.4 a 6.0). Squad 1 corre en ESM nativo mientras que el resto corre en CommonJS.
* **[HALLAZGO]:** La versión estándar de consenso para el backend unificado es **NestJS 11.0.x** con **TypeScript 5.7.3**, permitiendo integrar limpiamente Squad 3 y Squad 7, elevando Squad 2 y Squad 6, y convirtiendo Squad 1 a la convención modular común.

---

## 3. Detalle por Squad: Módulos, Controladores, Servicios y Modelos

### 3.1 Squad 1: Core, RLS, RBAC y Gestión de Tenants
* **Responsabilidad:** Autenticación de usuarios, emisión y validación de tokens JWT con `jti`, control de acceso basado en roles (RBAC), multi-tenancy, planes de suscripción y aislamiento de inquilinos.
* **Controladores (7):**
  * `auth.controller.ts`: Login, registro, verificación de tokens, refresh.
  * `tenants.controller.ts`: CRUD de empresas/inquilinos, estado de activación.
  * `users.controller.ts`: Gestión de usuarios, asignación de roles.
  * `branches.controller.ts`: Gestión de sucursales por inquilino.
  * `commercial-categories.controller.ts`: Categorías comerciales de negocio.
  * `plans.controller.ts`: Planes y tarifas del SaaS.
  * `platform.controller.ts`: Endpoints administrativos de la plataforma.
* **Servicios (8):** `auth.service.ts`, `tenants.service.ts`, `users.service.ts`, `branches.service.ts`, `commercial-categories.service.ts`, `plans.service.ts`, `platform.service.ts`, `database.service.ts`.
* **Entidades TypeORM (6):** `Tenant`, `User`, `Branch`, `CommercialCategory`, `Plan`, `AuditLog`.
* **Pruebas (4 specs):** `auth-register.spec.ts`, `plans.service.spec.ts`, `platform.service.spec.ts`, `team-persistence.spec.ts`.

### 3.2 Squad 2: Motor Contable y Libro Mayor (Ledger)
* **Responsabilidad:** Plan Único de Cuentas (PUC), gestión de cuentas contables, registro de asientos de partida doble (`journal_entries`), balance de comprobación.
* **Controladores (2):**
  * `accounting.controller.ts`: Consulta de saldos, balance de cuentas, PUC.
  * `journal-entries.controller.ts`: Creación y consulta de asientos contables.
* **Servicios (3):** `accounting.service.ts`, `puc.service.ts`, `reports.service.ts`.
* **Entidades TypeORM (3):** `Account`, `JournalEntry`, `JournalEntryLine`.
* **Pruebas (3 specs):** `accounting.service.spec.ts`, `journal-entry.spec.ts`, `auth-adapters.spec.ts`.
* **Regla de Negocio Crítica:** Todo asiento debe cumplir partida doble estricta ($\sum \text{Débitos} = \sum \text{Créditos}$), validado con `decimal.js`.

### 3.3 Squad 3: Inventario, Kardex CPP y Persistencia Prisma 6
* **Responsabilidad:** Catálogo de productos, variantes, códigos de barra, almacenes, movimientos de inventario, traslados, conteos físicos y cálculo de costo promedio ponderado (Kardex CPP).
* **Controladores (7):**
  * `products.controller.ts`: Catálogo de productos, variantes y precios.
  * `kardex.controller.ts`: Consulta de movimientos y saldos CPP.
  * `inventory-movements.controller.ts`: Despacho y recepción de inventario.
  * `warehouses.controller.ts`: Gestión de bodegas/almacenes.
  * `transfers.controller.ts`: Traslados de stock entre almacenes.
  * `stock-counts.controller.ts`: Conteos y ajustes físicos de inventario.
  * `stock-alerts.controller.ts`: Alertas de stock mínimo.
* **Servicios (15):** `dispatch-stock.service.ts`, `receive-stock.service.ts`, `reverse-movement.service.ts`, `get-kardex.service.ts`, `create-product.service.ts`, `update-product.service.ts`, `search-products.service.ts`, `get-product-detail.service.ts`, `transfer-stock.service.ts`, `receive-transfer.service.ts`, `create-stock-count.service.ts`, `apply-stock-count.service.ts`, `get-stock-alerts.service.ts`, `list-warehouses.service.ts`, `prisma.service.ts`.
* **Modelos Prisma (32 modelos y 31 enums en `prisma/schema.prisma`):**
  * *Inquilinos y Sucursales:* `Tenant`, `Branch`, `User`, `TenantSequence`, `AuditLog`.
  * *Terceros y PUC:* `ThirdParty`, `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`.
  * *Catálogo:* `ProductCategory`, `UnitOfMeasure`, `Product`, `ProductVariant`, `ProductBarcode`.
  * *Inventario:* `Warehouse`, `InventoryBalance`, `InventoryMovement`, `InventoryMovementLine`, `InventoryLedgerEntry`, `InventoryTransfer`, `InventoryTransferLine`, `StockCount`, `StockCountLine`.
  * *Ventas y POS:* `PosShift`, `Invoice`, `InvoiceItem`.
  * *Compras y Cartera:* `Purchase`, `PurchaseItem`, `CreditTransaction`.
  * *Auditoría e Idempotencia:* `InventoryIdempotencyKey`, `InventoryOutboxEvent`, `InventoryAuditLog`.
* **Pruebas (30 specs):** 30 suites completas cubriendo algoritmos de Kardex, concurrencia en `InventoryBalance` con bloqueo pesimista, arquitectura hexagonal y mapeadores.

### 3.4 Squad 4: Frontend Web & Desktop POS (Next.js 15)
* **Responsabilidad:** Interfaz de usuario para punto de venta en mostrador, panel administrativo, gestión de inventario, caja, turnos, ventas y facturación.
* **Arquitectura:** Next.js 15.1.7 (App Router), React 19, Tailwind CSS 3.4.17, Zustand 5.0.3, Lucide React.
* **Rutas API BFF (47 rutas en `src/app/api/`):**
  * Autenticación y sesión: `/api/auth/*` (login, logout, me, activate, 2FA TOTP).
  * Liquidación de ventas: `/api/checkout`, `/api/pos/shifts`.
  * Facturación: `/api/invoices`, `/api/invoices/[id]/void`.
  * Inventario: `/api/inventory/products`, `/api/inventory/products/next-sku`, `/api/inventory/categories`, `/api/inventory/moves`.
  * Cartera: `/api/credits/customers`, `/api/credits/suppliers`.
  * Contabilidad: `/api/accounting/balance`, `/api/accounting/expenses`.
  * Administración de plataforma: `/api/platform/*`.
* **Pruebas (27 test files):** Cobertura de invariantes de consolidación, seguridad en checkout, auditoría multi-tenant en Colombia y persistencia de turnos.

### 3.5 Squad 5: Mobile POS Offline (Flutter / Dart)
* **Responsabilidad:** Terminal de punto de venta móvil para dispositivos Android, con operación 100% desconectada (offline-first) y sincronización asíncrona hacia el backend.
* **Arquitectura:** Flutter SDK `>=3.24.0`, Dart `>=3.5.0`, Drift 2.24.2 (SQLite relacional nativo en dispositivo), Riverpod 2.6.1, `flutter_secure_storage`.
* **Componentes Principales:**
  * `lib/core/database/database.dart`: Esquema SQLite con tablas locales `cart_items`, `sales`, `sync_queue`.
  * `lib/core/sync/sync_queue_worker.dart`: Worker transaccional Outbox que lee elementos `PENDING`, los envía con cabecera `X-Idempotency-Key` y reintenta con backoff exponencial.
  * `lib/features/pos/presentation/pos_screen.dart`: Pantalla de mostrador táctil móvil.
* **Pruebas (4 test files):** `backend_contract_test.dart`, `mobile_navigation_audit_test.dart`, `sale_payload_test.dart`, `widget_test.dart`.

### 3.6 Squad 6: Reportes, Auditoría y Periféricos ESC/POS
* **Responsabilidad:** Generación de recibos térmicos para impresoras ESC/POS (58mm/80mm), reportes financieros (Estado de Resultados, Balance General) y anulación de comprobantes.
* **Controladores (2):** `invoices.controller.ts` (anulación de facturas), `health.controller.ts`.
* **Servicios (3):** `escpos.service.ts` (comandos binarios para corte de papel, negrita, código QR), `invoices.service.ts` (lógica de reversión), `database.service.ts`.
* **Entidades (3):** `BalanceSheet`, `IncomeStatement`, `VoidRequest`.
* **Pruebas (3 specs):** `invoices-security.spec.ts`, `invoices-void.spec.ts`, `postgres-invoices-repository.spec.ts`.

### 3.7 Squad 7: Cartera Fiado, Compras y Proveedores
* **Responsabilidad:** Registro de ventas a crédito ("fiado"), límites de crédito por cliente, cobranzas, órdenes de compra y gestión de proveedores.
* **Controladores (3):** `credits.controller.ts`, `purchases.controller.ts`, `health.controller.ts`.
* **Servicios (2):** `idempotency.service.ts`, `tenant-database.service.ts`.
* **Pruebas (5 specs):** `idempotency.service.spec.ts`, `customer-credit.use-case.spec.ts`, `supplier-purchase.use-case.spec.ts`, `credit-limit.rule.spec.ts`, `security-bola.spec.ts`.

### 3.8 Squad 8: DevOps, SRE y Aseguramiento de Calidad
* **Responsabilidad:** Infraestructura como código, observabilidad (Prometheus + Grafana), validación contractual OpenAPI, pruebas de carga con k6 y automatización de pruebas E2E con Playwright sobre Chromium CDP.
* **Componentes:**
  * `monitoring/prometheus.yml`, `monitoring/grafana/*` (Dashboards de latencia, TPS y saturación de base de datos).
  * `tests/k6/pos-checkout-load.js`: Script de carga para checkout POS con 50 cajeros virtuales.
  * `tests/contracts/openapi-validator.spec.ts`: Validador contra esquemas YAML de OpenAPI.
  * `scripts/run-concurrency-stress.js`: Simulador de ventas concurrentes en mostrador.
  * `scripts/test-rls.sql`: Script maestro SQL para certificar aislamiento multi-tenant RLS.

---

## 4. Scripts y Herramientas en la Raíz de `old`

* `scripts/deploy.ps1`: Orquestador de despliegue para Windows Server / PowerShell con soporte para migraciones y verificación de salud.
* `scripts/healthcheck.ps1`: Monitor de endpoints HTTP de cada uno de los servicios.
* `scripts/reset-zero.ps1`: Script de limpieza de base de datos a estado cero.
* `scripts/export-db.ps1` y `scripts/import-db.ps1`: Exportación e importación binaria de PostgreSQL (`pg_dump -Fc`).
* `ecosystem.config.cjs`: Archivo de configuración de procesos PM2 para levantar los squads en puertos 3000, 3001, 3002, 3006 y 3007.

---

## 5. Capacidades y Reglas de Negocio Críticas (Que NO Deben Perderse)

1. **Aislamiento Multi-Tenant Estricto:** Cada consulta contra PostgreSQL debe ejecutar bajo `SET LOCAL app.current_tenant_id` y el rol restringido `app_runtime` (sin privilegios de superusuario ni `BYPASSRLS`).
2. **Checkout POS Atómico:** Factura + Salida de Kardex (con bloqueo pesimista `SELECT ... FOR UPDATE` sobre saldos) + Asiento contable de partida doble deben resolverse en una única transacción de base de datos con rollback total.
3. **Idempotencia Durable:** Prevención de doble cobro y duplicación de movimientos de stock ante fallos de red, garantizada mediante restricción `UNIQUE` en PostgreSQL y fast-path en Redis.
4. **Operación Offline Móvil:** Los cajeros móviles en Flutter deben poder registrar ventas sin internet, almacenarlas en SQLite/Drift y reconciliarlas determinísticamente al recuperar conexión.
5. **Generación de Comprobantes Térmicos ESC/POS:** Emisión de secuencias de comandos para tickets de venta en impresoras estándar de mostrador.
6. **Manejo de Cartera Fiado:** Validación estricta de cupo de crédito disponible por cliente antes de permitir una venta a crédito.

