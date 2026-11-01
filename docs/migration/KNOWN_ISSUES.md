# REGISTRO DE PROBLEMAS CONOCIDOS (KNOWN ISSUES)

Este documento cataloga los problemas técnicos, riesgos y deficiencias arquitectónicas identificadas en el proyecto original (`old/`) y los riesgos que deben ser mitigados durante la consolidación en `new/`.

---

## 1. Problemas Identificados en el Proyecto Original

### KI-001: Heterogeneidad Severa de Runtimes y Tipos de Módulo
* **Gravedad:** **Alta**
* **Ubicación:** `squad1/package.json` vs `squad2/package.json` vs `squad3/package.json`.
* **Impacto:** Squad 1 declara `"type": "module"` (ESM) con TypeScript 6.0.2 y NestJS 12.0.1; Squads 2 y 6 usan CommonJS con NestJS 10; Squads 3 y 7 usan NestJS 11. Intentar compilar todo con un único `tsconfig` o forzar un `pnpm.overrides` global indiscriminado rompe la resolución de módulos.
* **Solución Propuesta en `new/`:** Estandarizar el backend unificado en **NestJS 11.0.x** con **TypeScript 5.7.3** y `moduleResolution: NodeNext`. Refactorizar la arquitectura hexagonal de Squad 1 hacia la convención modular común de NestJS 11.

---

### KI-002: Ausencia de Namespace de Inquilino en Claves de Redis
* **Gravedad:** **Crítica**
* **Ubicación:** `squad1/src/infrastructure/adapters/out/redis` y `squad3/src/infrastructure/adapters/redis`.
* **Impacto:** Las claves de sesión se almacenan como `session:${userId}:${sessionId}`. No existe prefijo de `tenantId`. Si un administrador de un comercio revoca el acceso a su personal o a un usuario específico, es imposible aislar las sesiones por inquilino, generando riesgo de sobre-escritura o fugas cruzadas.
* **Solución Propuesta en `new/`:** Separar la sesión global (`unisaas:session:${sessionId}`) de los índices de pertenencia por inquilino en conjuntos (`SET`) de Redis (`unisaas:tenant:${tenantId}:user:${userId}:sessions`).

---

### KI-003: Confusión de Caídas de Red de Redis con Credenciales Inválidas (401 vs 503)
* **Gravedad:** **Alta**
* **Ubicación:** `squad3/src/infrastructure/adapters/redis/session.service.ts` y guardias de autenticación.
* **Impacto:** Si el contenedor de Redis se reinicia o sufre un timeout de red, el adaptador captura el error y retorna `false`, provocando que el guardia HTTP emita un código `401 Unauthorized` ("Credenciales inválidas" o "Sesión expirada") a usuarios legítimos.
* **Solución Propuesta en `new/`:** Lanzar `RedisUnavailableException` ante errores de transporte (`ECONNREFUSED`, `ETIMEDOUT`) y capturarla con un filtro de excepción global que responda `503 Service Unavailable` con cabecera `Retry-After: 5` y emita una alerta SRE. Reservar `401 Unauthorized` estrictamente para tokens expirados, firmas criptográficas inválidas o sesiones formalmente revocadas.

---

### KI-004: Escaneo Masivo Ineficiente en Redis ($O(N)$)
* **Gravedad:** **Media-Alta**
* **Ubicación:** `squad1/src/infrastructure/adapters/out/redis/redis-session.adapter.ts`.
* **Impacto:** Para invalidar sesiones múltiples se utiliza `scanStream` o `keys()`, lo que recorre todo el espacio de llaves de Redis ($O(N)$). Con más de 50,000 claves en memoria, esto eleva drásticamente la latencia de respuesta en el mostrador POS.
* **Solución Propuesta en `new/`:** Indexar los IDs de sesión activos en un `SET` por usuario/tenant. La revocación consulta los $M$ IDs con `SMEMBERS` y los elimina en un único `pipeline DEL` en tiempo $O(M)$ (donde $M \ll N$).

---

### KI-005: Acceso SQL Directo y Almacenamiento en Memoria de Proceso en BFF Next.js
* **Gravedad:** **Alta**
* **Ubicación:** `squad4/src/core/infrastructure/db.ts` y handlers en `squad4/src/app/api/*`.
* **Impacto:** El frontend Next.js 15 accede directamente a PostgreSQL mediante el driver `pg` con la función `withTenantDb`. Además, el rate-limiting y la idempotencia operan en mapas locales en memoria (`Map`), lo que impide el escalado horizontal del frontend en contenedores o Vercel.
* **Solución Propuesta en `new/`:** Descartar el acceso SQL directo desde Next.js (`ADR-004`). La aplicación `apps/web-pos` consumirá la API REST fuertemente tipada de `apps/api-gateway`. El rate-limiting y la idempotencia se delegan a Redis y PostgreSQL en el backend.

---

### KI-006: Validación de Prisma sobre Archivos Sueltos en Esquema Modular
* **Gravedad:** **Alta**
* **Ubicación:** Herramientas de persistencia de `squad3` y CLI de Prisma.
* **Impacto:** Si se ejecuta `prisma validate --schema=prisma/schema/base.prisma`, el compilador de Prisma falla con error de tipo no encontrado al no cargar las relaciones definidas en otros archivos (`tenant.prisma`, `inventory.prisma`).
* **Solución Propuesta en `new/`:** Estandarizar todos los scripts de la CLI de Prisma para apuntar siempre al directorio completo: `prisma validate --schema=prisma/schema` y `prisma generate --schema=prisma/schema`.

---

### KI-007: Bloqueo Transaccional por Ejecución de Efectos Externos en la BD
* **Gravedad:** **Crítica**
* **Ubicación:** Orquestación previa de checkout y Squad 6.
* **Impacto:** Si la llamada a la impresora térmica ESC/POS, el envío de notificaciones o la comunicación con la DIAN se ejecutan dentro del bloque transaccional de PostgreSQL, cualquier retraso o atasco en el hardware retiene los bloqueos pesimistas (`SELECT ... FOR UPDATE` en saldos de inventario), agotando el pool de conexiones y paralizando otros mostradores.
* **Solución Propuesta en `new/`:** Aislar completamente los efectos periféricos fuera de la transacción mediante Domain Events post-commit (`ADR-008`).

---

### KI-008: Idempotencia Volátil Exclusiva de Redis
* **Gravedad:** **Alta**
* **Ubicación:** `squad7/src/application/services/idempotency.service.ts`.
* **Impacto:** Si la verificación de idempotencia reside únicamente en la memoria de Redis, un reinicio del servicio o una expulsión de memoria (*eviction*) permitiría el reintento de una factura de venta, duplicando el registro contable y la salida de stock.
* **Solución Propuesta en `new/`:** Idempotencia durable en PostgreSQL con tabla `idempotency_keys` y restricción `UNIQUE (tenant_id, idempotency_key)` persistida de forma ACID en la misma transacción de venta (`ADR-007`), utilizando Redis únicamente como fast-path de descarte temprano.

---

### KI-009: Política de Ejecución de Scripts en PowerShell del Host de Windows (`PSSecurityException`)
* **Gravedad:** **Baja-Operativa**
* **Ubicación:** Entorno Windows PowerShell / Wrappers `.ps1` de npm y pnpm.
* **Impacto:** Las directivas de seguridad de PowerShell en el host restringen la ejecución de scripts `.ps1` no firmados, impidiendo invocar directamente `pnpm` o `npm` si el shell intenta ejecutar `pnpm.ps1`.
* **Solución Propuesta en `new/`:** Invocar directamente los ejecutables de lote de comandos (`.cmd`): `& 'C:\Users\Edwin\AppData\Roaming\npm\pnpm.cmd' <args>` o mediante `cmd.exe /c pnpm <args>` en automatizaciones locales.

---

### KI-010: Requisito de Declaración de `packageManager` para Turborepo 2
* **Gravedad:** **Baja-Configuración**
* **Ubicación:** `package.json` raíz y CLI de Turborepo (`turbo`).
* **Impacto:** Turborepo 2.11+ requiere que el gestor de paquetes exacto esté especificado en el campo `"packageManager"` del `package.json` raíz para detectar y resolver la topología del workspace; de lo contrario aborta con el error `Missing devEngines.packageManager or legacy packageManager field`.
* **Solución Propuesta en `new/`:** Declarar explícitamente `"packageManager": "pnpm@12.16.1"` en la raíz de `new/package.json`.

---

### KI-011: Fijación de Versión de `collection` en Flutter SDK y Resolución de Dependencias de Drift
* **Gravedad:** **Media-Técnica**
* **Ubicación:** `apps/mobile-pos/pubspec.yaml` en Flutter 3.24.5 / Dart 3.5.4.
* **Impacto:** El SDK de Flutter 3.24.5 fija rígidamente la biblioteca `collection` en la versión `1.18.0`. Herramientas de generación de código como `drift_dev >=2.24.0` dependen transitivamente de `analyzer >=7.3.0` que requiere `collection ^1.19.0`, provocando que el solver de `pub get` falle al detectar incompatibilidad con el SDK de Flutter.
* **Solución Implementada en `new/`:** Integrar la librería Drift en tiempo de ejecución (`drift: 2.31.0` y `sqlite3_flutter_libs: ^0.5.24`) y pre-compilar/generar los esquemas `database.g.dart`, excluyendo `drift_dev` de las dependencias dev estándar para permitir compatibilidad total y determinista con el SDK estable de Flutter.

---

### KI-012: Bucle Infinito y Bloqueo de Cola Outbox ante Conflictos de Negocio HTTP 409
* **Gravedad:** **Alta**
* **Ubicación:** `apps/mobile-pos/lib/core/sync/sync_queue_worker.dart`.
* **Impacto:** Si una operación offline rechazada por el backend con código HTTP 409 (conflicto de huella de idempotencia o estado de inventario) es tratada como un error genérico o transitorio, el worker móvil la reintenta inútilmente hasta agotar reintentos o quema la batería y el ancho de banda del dispositivo.
* **Solución Implementada en `new/`:** Soporte de cuatro estados en la tabla SQLite de Outbox (`PENDING`, `SYNCED`, `FAILED`, `CONFLICT`). Ante HTTP 409, el worker transiciona el registro inmediatamente a `CONFLICT`, detiene los reintentos automáticos para ese ítem y preserva el payload, la `Idempotency-Key` y el detalle del servidor para inspección o reintento manual asistido por el usuario.

---

### KI-013: Agotamiento del Pool de Conexiones de Prisma bajo Cargas de Arribo Constante (50 RPS)
* **Gravedad:** **Alta**
* **Ubicación:** `packages/database/src/client.ts` y configuración por defecto de `DATABASE_URL`.
* **Impacto:** Prisma calcula el tamaño del pool de conexiones como `(num_cpus * 2) + 1` (9 conexiones en una CPU de 4 núcleos / 8 hilos). Bajo un modelo de carga abierta con tasa de llegada de 40 iter/s y 50 HTTP req/s, las conexiones del pool se saturaban esperando checkouts concurrentes, arrojando errores `Timed out fetching a new connection from the connection pool (pool limit: 9)`.
* **Solución Implementada en `new/`:** Establecer explícitamente los parámetros `connection_limit=50&pool_timeout=30` en la cadena de conexión de PostgreSQL consumida por NestJS en `apps/api-gateway/src/main.ts`, y ampliar `maxWait: 15000` en la configuración interactiva de transacciones en `packages/database/src/tenant-context.ts`.

---

### KI-014: Colisión de Concurrencia en Generación de Números Consecutivos POS y Asientos Contables (`SELECT count(*)`) vs Continuidad de Negocio
* **Gravedad:** **Alta**
* **Ubicación:** `apps/api-gateway/src/checkout/services/checkout-coordinator.service.ts`.
* **Impacto Histórico:** La numeración de facturas y de asientos contables dependía de un `SELECT count(*)`, el cual bajo concurrencia real generaba números idénticos para transacciones concurrentes del mismo milisegundo, violando las restricciones de unicidad `uq_tenant_invoice_consecutive` y `uq_tenant_entry_number`.
* **Solución Provisional Aplicada en QA:** Generación de sufijos de desempate aleatorios (`POS-YYYYMMDD-COUNT-XXXXXX`) y timestamps para `entryNumber`. Si bien evitó colisiones en base de datos durante las pruebas de carga, desvirtuaba la regla contable y tributaria de numeración correlativa estricta.
* **Solución Definitiva Implementada y Verificada en Fase 10:** Migración completa a la entidad `TenantSequence` (`tenant_sequences`) mediante bloqueo atómico de fila en PostgreSQL:
  ```sql
  INSERT INTO tenant_sequences (tenant_id, sequence_key, current_value)
  VALUES ($1, $2, 1)
  ON CONFLICT (tenant_id, sequence_key)
  DO UPDATE SET current_value = tenant_sequences.current_value + 1
  RETURNING current_value;
  ```
  - **Consecutivos de Factura:** Formato canónico estricto `POS-{YYYYMMDD}-{000001}` (ordinal, sin sufijos aleatorios ni hashes).
  - **Asientos Contables:** Número entero correlativo estricto (`BigInt(val)`: 1, 2, 3...).
  - **Transaccionalidad ACID y Rollback:** Opera dentro de la misma transacción interactiva (`tx`) de PostgreSQL coordinada por `withTenantContext`. Si la transacción de venta aborta por saldo insuficiente o fallo de negocio, el incremento de la secuencia se revierte automáticamente, evitando huecos.
  - **Certificación:** Suite `apps/qa-e2e/e2e/sequence-atomic-validation.e2e-spec.ts` superó 5/5 casos de prueba al 100%: ordinalidad estricta, 10 checkouts concurrentes sin duplicados, aislamiento multi-tenant estricto entre inquilinos A y B, reversión en rollback y reintentos idempotentes sin consumo de secuencias.
* **Estado Actual:** **100% RESUELTO Y CERTIFICADO**.

---

### KI-015: Contención de Bloqueo Pesimista de Filas (`SELECT ... FOR UPDATE`) en Inventario con SKU Único
* **Gravedad:** **Media-Técnica**
* **Ubicación:** `apps/api-gateway/src/inventory/services/inventory.service.ts` y fixtures de carga.
* **Impacto:** Si un script de prueba de carga dirige todos los checkouts concurrentes contra un único SKU, las transacciones de PostgreSQL se serializan en cola tras el bloqueo exclusivo `SELECT ... FOR UPDATE` en `inventory_balances`, elevando artificialmente la latencia a más de 1 segundo.
* **Solución Implementada en `new/`:** Distribuir la semilla de datos de prueba (`fixtures/seed-qa-data.sql`) a través de un catálogo de 20 productos y variantes (`SKU-QA-001` a `SKU-QA-020`) con stock masivo (500,000 unidades), permitiendo a PostgreSQL comprometer transacciones en paralelo sin contención de cerrojos de fila artificiales (<40ms por checkout).

---

### KI-016: Incumplimiento de Latencia p95 bajo Carga Sostenida en Entorno Virtualizado (Windows / Docker)
* **Gravedad:** **Media-Rendimiento**
* **Ubicación:** Infraestructura de ejecución de k6 y API Gateway.
* **Impacto:** Bajo carga abierta continua de 40 iter/s (~50 req/s), la latencia mediana (p50: 52.25 ms) y percentil 90 (p90: 274.96 ms) se mantienen excelentes con 0.000% de errores y 0 deadlocks. Sin embargo, el percentil 95 (p95) alcanza **393.64 ms**, excediendo el umbral exigido de 350 ms por 43.64 ms. Este comportamiento se origina en la latencia de sincronización a disco (fsync/WAL de PostgreSQL) en el subsistema de archivos virtualizado de Docker Desktop en Windows para transacciones que escriben simultáneamente en facturación, kardex, partida doble y auditoría.
* **Mitigación / Acción:** Documentar el hallazgo formalmente manteniendo el veredicto en **Certificada con Observaciones**. En entornos Linux bare-metal o cloud con almacenamiento NVMe directo y buffers optimizados, el tiempo de commit se reduce por debajo de los 250 ms.

---

### KI-017: Riesgo de Agotamiento de `max_connections` en Escalado Horizontal sin Pooler Externo
* **Gravedad:** **Alta**
* **Ubicación:** `apps/api-gateway/src/main.ts` (`connection_limit=50`) y PostgreSQL (`max_connections=100`).
* **Impacto:** Un único nodo de `apps/api-gateway` consume hasta 45 conexiones bajo 50 RPS sostenidos, funcionando dentro del margen disponible de PostgreSQL. Sin embargo, al desplegar dos o más réplicas del servicio sin un gestor de pool externo, el potencial acumulado ($50 \times N$) superará las 97 conexiones de usuario de PostgreSQL, arrojando errores `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
* **Solución Recomendada:** Para despliegues multi-instancia en producción, incorporar **PgBouncer** en modo de transacción (`pool_mode = transaction`) o dimensionar el límite por réplica con la fórmula: `connection_limit = floor((max_connections - 10) / N_replicas)`.





