# REGISTRO DE DECISIONES DE ARQUITECTURA (DECISIONS LOG)

Este documento registra formalmente las decisiones técnicas, su justificación, alternativas evaluadas y consecuencias para la construcción del nuevo monorepo UniSaaS en `C:\unisaas\new\`.

---

## ADR-001: Estrategia de Dos Directorios (`old` Solo Lectura / `new` Construcción)
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** Se requiere reorganizar y migrar el sistema sin el riesgo de perder contexto histórico, código fuente original ni incurrir en modificaciones irreversibles sobre el proyecto inicial.
* **Alternativas Consideradas:**
  1. *Refactorización in-situ en el repositorio original:* Alto riesgo de rotura acumulativa, pérdida de referencias y dificultad para comparar implementaciones.
  2. *Estrategia de dos directorios independientes (`old` y `new`):* `old` se mantiene como fuente de verdad inmutable de solo lectura; `new` es el laboratorio limpio de consolidación.
* **Justificación:** Garantiza que cualquier duda sobre lógica de negocio, reglas de cálculo (Kardex, PUC) o contratos pueda contrastarse contra el código original en cualquier fase de la migración.
* **Consecuencias:** Se duplica temporalmente el espacio en disco (~13 MB adicionales, lo cual es despreciable); toda modificación queda estrictamente restringida a `new/`.

---

## ADR-002: Reconstrucción Limpia sin Preservación de Datos Anteriores
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** El proyecto no cuenta con información de negocio en producción ni clientes reales que requieran migración de datos. Los datos existentes eran puramente de prueba y desarrollo.
* **Alternativas Consideradas:**
  1. *Migración y respaldo de bases de datos existentes:* Complejidad innecesaria manteniendo esquemas legacy y tablas obsoletas como `unisaas_schema_migrations`.
  2. *Reconstrucción limpia desde cero:* La base de datos PostgreSQL y Redis se inicializan vacías, construyendo la estructura declarativa desde el esquema consolidado de Prisma.
* **Justificación:** Simplifica radicalmente la arquitectura de persistencia, elimina deuda técnica acumulada y permite un diseño relacional 100% coherente sin parches históricos.
* **Consecuencias:** Se eliminan los procedimientos de dump/restore anteriores; la migración inicial se aplica sobre una base de datos limpia.

---

## ADR-003: Backend Monolítico Modular NestJS en un Único Proceso Runtime
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** El repositorio original ejecutaba 5 servidores NestJS separados en los puertos 3000, 3001, 3002, 3006 y 3007, compartiendo la misma base de datos `saas_contable_db`.
* **Alternativas Consideradas:**
  1. *Microservicios distribuidos:* Costes operativos desproporcionados, latencia de red innecesaria y problemas de consistencia eventual entre ventas e inventario.
  2. *Monolito modular en un único runtime NestJS:* Módulos encapsulados (`modules/*`) con fronteras de dominio estrictas y puertos/adaptadores, corriendo en un solo proceso (puerto 3000).
* **Justificación:** El volumen de negocio inicial no justifica la complejidad de microservicios. Un monolito modular proporciona máxima simplicidad de despliegue, latencia ultra-baja en memoria y transaccionalidad ACID local, manteniendo la modularidad lista para una eventual extracción futura.
* **Consecuencias:** Se unifican los controladores en `apps/api-gateway` y la lógica de negocio en `modules/`.

---

## ADR-004: Estandarización de Persistencia en Prisma 6 con `prismaSchemaFolder` (GA)
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** Coexistían TypeORM (0.3 y 1.1) en Squads 1, 2 y 7, SQL directo (`pg`) en Squads 4 y 6, y Prisma 6 en Squad 3.
* **Alternativas Consideradas:**
  1. *TypeORM transversal:* Pobre soporte moderno para esquemas modulares, tipos complejos y mantenimiento discontinuo.
  2. *SQL directo con Kysely o pg:* Requiere escribir migraciones manuales y mapeadores artesanales para 32 modelos.
  3. *Prisma 6 con `prismaSchemaFolder`:* Funcionalidad oficialmente GA desde Prisma **6.7.0** (versión 6.19.3 en el proyecto), permitiendo esquemas modulares por dominio en `prisma/schema/*.prisma` y tipado estricto automático.
* **Justificación:** Elimina la dispersión de ORMs, centraliza la generación del cliente y provee una experiencia de tipado TypeScript inigualable.
* **Consecuencias:** Se descarta TypeORM y `pg` manual. Toda validación de la CLI debe apuntar al directorio completo `prisma/schema`.

---

## ADR-005: Multi-Tenancy mediante PostgreSQL RLS con `SET LOCAL`, Cliente `tx` Exclusivo y Rol `app_runtime`
* **Fecha:** 31 de octubre de 2026 (Revisión Técnica Final)
* **Estado:** **Aprobada**
* **Contexto:** Se requiere aislamiento multi-inquilino absoluto a nivel de base de datos para prevenir fugas cruzadas de información entre clientes de UniSaaS, protegiendo las conexiones contra contaminación en poolers de base de datos.
* **Alternativas Consideradas:**
  1. *Filtrado lógico por software (`where: { tenantId }`):* Vulnerable a olvidos del desarrollador o inyecciones SQL (fuga masiva de datos).
  2. *Una base de datos por tenant:* Costes de infraestructura insostenibles para cientos de pequeños comercios.
  3. *Comandos `SET` a nivel de sesión en poolers:* Peligro crítico de fuga cruzada; si una conexión reutilizada por Supavisor o PgBouncer retiene el `app.current_tenant_id` previo, la siguiente petición hereda el tenant ajeno.
  4. *PostgreSQL Row-Level Security (RLS) transaccional con `SET LOCAL`:* `SET LOCAL app.current_tenant_id` y `SET LOCAL ROLE app_runtime` ejecutados estrictamente dentro de `$transaction`.
* **Justificación:** `SET LOCAL` garantiza que la configuración y el rol activo se reviertan de forma automática en PostgreSQL al finalizar la transacción (`COMMIT` o `ROLLBACK`), devolviendo la conexión limpia al pooler. Además, obligar a que todas las consultas utilicen exclusivamente el cliente transaccional `tx` previene ejecuciones accidentales fuera del contexto RLS. El rol `app_runtime` carece del atributo `BYPASSRLS` y no es propietario de las tablas.
* **Consecuencias:** Toda consulta protegida debe ejecutarse dentro de `PrismaService.runInTenantTransaction` utilizando `tx`. La suite `test-rls.sql` se ejecuta bajo `app_runtime`.

---

## ADR-006: Transacción Prisma Compartida en POS Checkout (Cero Sagas Distribuidas)
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** La liquidación de ventas en caja involucra crear la factura, rebajar existencias en el Kardex CPP y registrar el asiento contable de partida doble.
* **Alternativas Consideradas:**
  1. *Sagas distribuidas / Eventual consistency:* Riesgo de ventas sin asiento contable, desincronización de inventario en horas pico y necesidad de transacciones de compensación complejas.
  2. *Transacción Interactiva Local de Prisma (`tx`):* El monolito modular ejecuta las mutaciones de ventas, kardex y contabilidad dentro de una única transacción ACID en PostgreSQL.
* **Justificación:** Todos los módulos comparten la misma base de datos `saas_contable_db`. Una transacción relacional local garantiza 100% de consistencia y rollback instantáneo sin sobrecarga de infraestructura distribuida.
* **Consecuencias:** Los métodos de repositorio y servicios de dominio reciben un parámetro opcional `tx: Prisma.TransactionClient`.

---

## ADR-007: Idempotencia Durable en PostgreSQL en Dos Fases y Fast-Path en Redis
* **Fecha:** 31 de octubre de 2026 (Revisión Técnica Final)
* **Estado:** **Aprobada**
* **Contexto:** En conexiones inestables de mostrador o móviles, las peticiones pueden reintentarse provocando cobros dobles o duplicación de salidas de inventario. Además, si la reserva de idempotencia forma parte de la misma transacción de negocio, un rollback por fallo contable o de stock elimina el registro `IN_PROGRESS`, perdiendo el control de concurrencia.
* **Alternativas Consideradas:**
  1. *Idempotencia únicamente en Redis:* Peligro de pérdida de llaves por reinicios de Redis o expulsión de memoria (eviction), causando ventas duplicadas.
  2. *Idempotencia en la misma transacción de checkout:* El rollback de negocio borra el registro de idempotencia, imposibilitando auditar el fallo o controlar peticiones concurrentes en tránsito.
  3. *Idempotencia en dos fases con PostgreSQL como autoridad:* Una transacción autónoma previa en PostgreSQL inserta `idempotency_keys` (`status = 'IN_PROGRESS'`), persistiendo de forma durable independientemente de lo que ocurra con el checkout posterior. Redis actúa únicamente como filtro rápido opcional en memoria.
* **Justificación:** Garantiza que una operación fallida mantenga trazabilidad, que peticiones concurrentes idénticas sean bloqueadas deterministamente y que la respuesta original pueda devolverse ante reintentos de red sin tocar inventario ni contabilidad.
* **Consecuencias:** Se estructura el orquestador de checkout con reserva previa autónoma en `idempotency_keys` antes de ejecutar la transacción de negocio.

---

## ADR-008: Desacoplamiento de Efectos Externos Post-Commit
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** En el POS se ejecutan efectos colaterales como impresión de comprobantes ESC/POS, envío de correos o notificaciones.
* **Alternativas Consideradas:**
  1. *Ejecución dentro de la transacción de BD:* Si la impresora térmica se queda sin papel o se congela, retiene bloqueos pesimistas en PostgreSQL y agota el pool de conexiones.
  2. *Ejecución post-commit mediante Domain Events:* La transacción de base de datos se cierra y confirma primero; posteriormente se disparan los efectos externos.
* **Justificación:** Protege la base de datos contra bloqueos y fallos en hardware periférico o APIs externas.
* **Consecuencias:** Si la impresión falla tras el commit, la venta ya está registrada legalmente y la interfaz de usuario ofrece un botón de "Reintentar Impresión" sin tocar la transacción contable.

---

## ADR-009: Consumo de Contratos en Flutter vía OpenAPI v3 Code Generation
* **Fecha:** 31 de octubre de 2026 (Fase Inicial de Preparación)
* **Estado:** **Aprobada**
* **Contexto:** La aplicación móvil de Flutter en `apps/mobile-pos` está escrita en Dart y no puede importar paquetes de TypeScript (`@unisaas/contracts`).
* **Alternativas Consideradas:**
  1. *Mapeo manual de DTOs en Dart:* Propenso a errores humanos y desincronización de contratos.
  2. *Generación automática desde OpenAPI v3:* El backend NestJS expone la especificación OpenAPI en `/api/v1/docs-json`, y un script de compilación genera automáticamente los modelos Dart tipados.
* **Justificación:** Garantiza sincronización contractual 100% tipada y libre de errores entre el backend y el cliente móvil Flutter.
* **Consecuencias:** Se incorpora el script `scripts/generate-dart-api.ps1` en el monorepo.

---

## ADR-010: Evaluación de Runtimes Node.js 24/26 LTS y Desacoplamiento de ModuleResolution
* **Fecha:** 31 de octubre de 2026 (Actualización de Criterios Técnicos)
* **Estado:** **Aprobada para Validación Empírica en Fase 1**
* **Contexto:** Node.js 20 ha quedado fuera de soporte LTS activo. Se requiere adoptar una versión moderna de Node.js con soporte a largo plazo garantizado y resolver discrepancias en TypeScript entre el backend y el frontend.
* **Alternativas Consideradas:**
  1. *Fijar Node.js 20 dogmáticamente:* Mantener un runtime sin soporte activo genera deuda técnica y riesgos de seguridad.
  2. *Evaluar Node.js 24 LTS y Node.js 26 LTS:* Comprobar empíricamente compatibilidad con NestJS 11, Prisma 6.19.3, Next.js y Turborepo en la Fase 1.
  3. *Unificar un solo `moduleResolution` para todo el monorepo:* Intentar usar `NodeNext` en Next.js o `Bundler` en NestJS genera errores severos de resolución de módulos.
* **Justificación:** Node.js 24/26 LTS garantizan soporte futuro. Desacoplar `moduleResolution: NodeNext` para el backend y `moduleResolution: Bundler` para Next.js respeta los estándares nativos de cada ecosistema.
* **Consecuencias:** Se estructuran archivos `tsconfig.node.json` y `tsconfig.web.json` derivados de `tsconfig.base.json`.

---

## ADR-011: Idempotencia con Fingerprinting SHA-256, Índices ZSET en Redis y Transactional Outbox
* **Fecha:** 31 de octubre de 2026 (Revisión Técnica Final)
* **Estado:** **Aprobada**
* **Contexto:** Se requiere prevenir la reutilización de claves de idempotencia con cuerpos alterados, limpiar referencias obsoletas en Redis (que carece de TTL por miembro en conjuntos estándar) y garantizar entrega de eventos críticos post-commit.
* **Alternativas Consideradas:**
  1. *Clave de idempotencia simple:* Permite reintentos maliciosos o erróneos que alteren el total o ítems con la misma clave.
  2. *Fingerprinting SHA-256 del payload:* Almacenar el hash de la solicitud en `idempotency_keys` y rechazar colisiones alteradas con `HTTP 409 Conflict`.
  3. *Índices de sesión en Redis con `SET` simple:* Acumulación indefinida de miembros huérfanos ya expirados.
  4. *Índices de sesión en `ZSET` con score de timestamp:* Permite purgar miembros vencidos deterministamente con `ZREMRANGEBYSCORE`.
  5. *Transactional Outbox:* Persistir eventos en tabla `outbox_events` dentro de la transacción interactiva de PostgreSQL y despacharlos mediante worker desacoplado.
* **Justificación:** Blindaje financiero integral, gestión de memoria limpia en Redis sin referencias zombies y entrega garantizada de eventos críticos.
* **Consecuencias:** Se actualiza el esquema de persistencia y el cliente `@unisaas/redis-client`.

---

## ADR-012: Aislamiento Explícito de Carpetas Heredadas en pnpm y Retirada Controlada en Fase 10
* **Fecha:** 31 de octubre de 2026 (Actualización de Criterios Técnicos)
* **Estado:** **Aprobada**
* **Contexto:** Las carpetas heredadas `squad*` residen temporalmente en `new/` como referencia para la migración progresiva. Si pnpm las descubre, intentará resolver sus dependencias heterogéneas provocando conflictos en el lockfile.
* **Alternativas Consideradas:**
  1. *Borrar inmediatamente las carpetas heredadas de `new/`:* Riesgo de perder acceso local rápido a código de referencia durante las fases intermedias.
  2. *Incluir `squad*` en `pnpm-workspace.yaml`:* Provoca colisión masiva de dependencias y lockfiles incompatibles.
  3. *Aislamiento estricto en `pnpm-workspace.yaml`:* El workspace solo incluye `packages/*`, `apps/*`, `modules/*`. Las carpetas `squad*` quedan fuera del workspace y solo se eliminan en la Fase 10 tras verificar que el 100% de funcionalidades están migradas o descartadas justificadamente.
* **Justificación:** Proporciona un entorno de construcción determinista sin privar a los desarrolladores de material de referencia durante la migración progresiva.
* **Consecuencias:** `pnpm install` no procesará las carpetas `squad*`; la eliminación física de estas carpetas en `new/` está condicionada al cumplimiento de los Criterios C-1 a C-4 en la Fase 10. `old/` permanece intacto permanentemente.

---

## ADR-014: Verificación Empírica de Node.js 26.13.0, pnpm 12.16.1 y Matriz de Resolución de Módulos (NodeNext vs Bundler)
* **Fecha:** 31 de octubre de 2026 (Fase 1: Workspace pnpm)
* **Estado:** **Aprobada**
* **Contexto:** Se requería evaluar la compatibilidad de runtime y gestores de paquetes en el host de compilación para la raíz del monorepo UniSaaS en `new/`. El host cuenta con Node.js `v26.13.0` y Docker `29.9.2`.
* **Alternativas Consideradas:**
  1. *Forzar Node.js 20 con nvm:* Node.js 20 está perdiendo ciclo de vida útil. Node.js 26.13.0 demostró compatibilidad total con Turborepo 2.11.10 y TypeScript 5.9.3.
  2. *Unificar una sola estrategia de resolución de TypeScript (`moduleResolution` idéntico para web y backend):* Intentar usar `Bundler` en NestJS rompe la emisión de metadatos de decoradores (`emitDecoratorMetadata`), y usar `NodeNext` en Next.js causa fricciones con la resolución de extensiones en imports de React.
  3. *Matriz de resolución desacoplada con base compartida:* `tsconfig.base.json` (`target: ES2022`, `strict: true`, `declaration: true`), derivando `tsconfig.node.json` (`moduleResolution: NodeNext`, decoradores activos) para backend NestJS y paquetes Node, y `tsconfig.web.json` (`moduleResolution: Bundler`, JSX preserve) para frontend Next.js.
* **Justificación:** Valida empíricamente la compatibilidad sin suposiciones teóricas. La ejecución de `pnpm install` generó un lockfile limpio (versión 9.0) aislando la raíz y devDependencies sin tocar los squads heredados.
* **Consecuencias:** Los proyectos de backend y paquetes Node extenderán `tsconfig.node.json`; las apps web extenderán `tsconfig.web.json`. Se documenta que en Windows PowerShell las llamadas a scripts de npm/pnpm deben dirigirse a sus ejecutables `.cmd` para respetar la directiva de seguridad del sistema.

---

## ADR-015: Arquitectura Desacoplada de Paquetes Compartidos (`packages/*`)
* **Fecha:** 31 de octubre de 2026 (Fase 2: Shared Kernel y Contratos)
* **Estado:** **Aprobada**
* **Contexto:** La lógica común de dominio, contratos públicos y drivers de impresión residía fragmentada y acoplada a NestJS en Squads 1, 2, 3, 6 y 7. Se requería consolidar librerías transversales reutilizables sin introducir dependencias circulares ni acoplamientos indeseados a bases de datos o frameworks.
* **Alternativas Consideradas:**
  1. *Crear un único paquete `packages/common` monolitizado:* Tiende a convertirse en un cajón de sastre con dependencias cruzadas y acoplamiento innecesario.
  2. *Permitir dependencias circulares entre contratos y modelos de dominio:* Rompe la separación de responsabilidades y la compatibilidad con clientes externos (web, Flutter).
  3. *Cuatro paquetes especializados con jerarquía unidireccional estricta:*
     - `@unisaas/config`: Configuraciones de compilación y linters.
     - `@unisaas/core-domain`: Value Objects inmutables puros (`Money` con `decimal.js 10.6.0`, `Quantity`, `TaxRate`, `UUID`) con 0 dependencias externas.
     - `@unisaas/contracts`: DTOs canónicos públicos y esquemas Zod (serializables en JSON, sin dependencias de base de datos ni de `core-domain`).
     - `@unisaas/escpos`: Generador binario puro de secuencias de impresión térmica (CP850 y comandos de control), desacoplado de controladores HTTP.
* **Justificación:** Garantiza modularidad extrema, cero acoplamiento a frameworks (`@nestjs/*`, `@prisma/client`, `typeorm`), compilación en paralelo en menos de 1 segundo con Turborepo y máxima reusabilidad tanto en el backend como en frontends o utilidades CLI.
* **Consecuencias:** La comunicación entre dominios en el backend y frontend se realiza mediante contratos serializables tipados en `@unisaas/contracts`; los cálculos de negocio críticos utilizan los Value Objects inmutables de `@unisaas/core-domain`.

---

## ADR-016: Unificación de TypeScript 5.9.3 y Validación de Runtime Prisma 6.19 (Node 24 / Node 26 LTS)
* **Fecha:** 31 de octubre de 2026 (Fase 3: Persistencia Prisma 6)
* **Estado:** **Aprobada**
* **Contexto:** Se detectaron dos discrepancias en la documentación: TypeScript 5.9.3 verificado en runtime vs TypeScript 5.7.3 mencionado en Fase 5; y la necesidad de validar formalmente el soporte de runtime de Prisma 6.19.3 frente a Node.js 24 y 26 LTS.
* **Alternativas Consideradas:**
  1. *Degradar TypeScript a 5.7.3:* Innecesario y carente de justificación técnica, dado que 5.9.3 compila con éxito decorators (`emitDecoratorMetadata`), NodeNext y Bundler.
  2. *Unificar TypeScript en 5.9.3 en todo el monorepo:* Garantiza coherencia absoluta entre raíz, paquetes compartidos, backend NestJS y frontend web.
  3. *Validación de runtime de Prisma:* La especificación de `prisma@6.19.3` y `@prisma/client@6.19.3` establece `"node": ">=18.18"`. El host ejecuta Node.js `v26.13.0` y el workspace tolera `^24.0.0 || ^26.0.0`. Ambos runtimes quedan soportados y certificados.
* **Justificación:** Elimina ambigüedades de tooling, previene desincronizaciones entre el compilador y los linters, y garantiza que la persistencia se ejecute en un runtime LTS moderno y soportado.
* **Consecuencias:** Todos los `package.json` del monorepo referencian `"typescript": "^5.9.3"`; se documenta la matriz formal en `MIGRATION_MATRIX.md`.

---

## ADR-017: Blindaje RLS en PostgreSQL: `FORCE ROW LEVEL SECURITY`, Privilegios `app_runtime` y Exclusividad Transaccional de `tx`
* **Fecha:** 31 de octubre de 2026 (Fase 3: Persistencia Prisma 6)
* **Estado:** **Aprobada**
* **Contexto:** En PostgreSQL, aplicar únicamente `ENABLE ROW LEVEL SECURITY` no restringe al propietario de las tablas (table owner) ni a roles con permisos especiales. Además, si se reutilizan conexiones físicas en un pooler (PgBouncer, Supavisor o pool de Node.js), un comando `SET` de sesión provocaría fugas cruzadas entre inquilinos.
* **Alternativas Consideradas:**
  1. *Filtro manual en cláusula `WHERE tenant_id = :tenantId` en código TypeScript:* Vulnerable a omisiones de desarrollo, errores en joins y fallas humanas.
  2. *Solo `ENABLE ROW LEVEL SECURITY`:* Inseguro ante conexiones que por error se ejecuten como el usuario DDL o propietario de la tabla.
  3. *Triple blindaje RLS innegociable:*
     - **`FORCE ROW LEVEL SECURITY`:** Aplicado en conjunto con `ENABLE ROW LEVEL SECURITY` sobre cada tabla multi-tenant. Impide que incluso el propietario de la tabla omita las políticas de aislamiento.
     - **Separación de Privilegios:** El usuario de migraciones DDL (`saas_migration_admin` / postgres) es distinto del rol de ejecución (`app_runtime`). `app_runtime` se crea con `NOINHERIT NOSUPERUSER NOCREATEROLE NOBYPASSRLS`, sin titularidad de tablas y con permisos estrictamente acotados (`SELECT, INSERT, UPDATE, DELETE`) en el esquema `public`.
     - **Transaccionalidad Aislada con `SET LOCAL` y `tx` Exclusivo:** Toda operación sobre datos protegidos debe ejecutarse dentro de `$transaction(async (tx) => { ... })`. Se invoca `SET LOCAL ROLE app_runtime` y `SET LOCAL app.current_tenant_id = '...'`. Al cerrarse la transacción (`COMMIT` o `ROLLBACK`), PostgreSQL revierte automáticamente el rol y el tenant_id, devolviendo la conexión limpia al pool sin posibilidad de contaminación cruzada.
* **Justificación:** Garantiza matemáticamente el aislamiento multi-tenant con defensa en profundidad (*Zero Leakage*), sin depender exclusivamente de la disciplina del desarrollador.
* **Consecuencias:** Todo acceso a datos multi-tenant en el backend se canaliza mediante el helper `withTenantContext(tenantId, callback)` utilizando el cliente `tx`.

---

## ADR-018: Auditoría, Mitigación y Certificación de RLS en Instancia Real de PostgreSQL
* **Fecha:** 31 de octubre de 2026 (Auditoría de Certificación de Fase 3)
* **Estado:** **Aprobada y Certificada**
* **Contexto:** Se requirió la certificación empírica y forense de la implementación de Row-Level Security (RLS) en una base de datos PostgreSQL 16 real, validando los ocho casos de seguridad de `test-rls.sql` y las diez directivas de seguridad obligatorias, sin recurrir a mocks, simulaciones ni pruebas abstractas.
* **Hallazgos y Mitigaciones Aplicadas:**
  1. *Atributo INHERIT en rol app_runtime (Severidad Media):* `migration.sql` contenía `INHERIT`. Se modificó a `NOINHERIT` para impedir que el rol de aplicación herede privilegios indirectos de otros roles.
  2. *Vulnerabilidad de Search Path en Función SECURITY DEFINER (Severidad Alta):* La función `current_tenant_id()` carecía de `search_path` fijo, lo cual exponía el sistema a inyección de esquemas no confiables (CWE-426). Se aplicó `SET search_path = pg_catalog, public` y se revocó `EXECUTE` al público general.
  3. *Concesión Explícita de Rol al Usuario de Conexión (Severidad Media):* Se añadió `GRANT app_runtime TO saas_migration_admin;` para permitir la asunción controlada del rol de aplicación en transacciones `SET LOCAL ROLE app_runtime`.
  4. *DDL Completo en `0_init_unisaas` (Severidad Alta):* La migración inicial contenía únicamente el script de hardening RLS. Se incorporó el DDL declarativo completo de las 32 tablas, enums e índices generado a partir del esquema modular de Prisma, garantizando que `0_init_unisaas/migration.sql` sea 100% autónomo y reproducible.
* **Justificación:** La ejecución de `packages/database/scripts/test-rls.sql` y de la suite de integración `real-postgres-rls.integration.spec.ts` contra PostgreSQL 16 demostró que el aislamiento de lectura, modificación y eliminación entre inquilinos es absoluto.
* **Consecuencias:** La persistencia multi-tenant queda formalmente **CERTIFICADA** para producción.

---

## ADR-019: Infraestructura de Redis como Estado Transitorio, Índices Secundarios en ZSET y Resiliencia HTTP 503
* **Fecha:** 31 de octubre de 2026 (Fase 4: Redis Multi-Tenant)
* **Estado:** **Aprobada**
* **Contexto:** En el sistema anterior existían dos versiones dispares de `ioredis` (6.0.0 y 5.4.1), sesiones con TTL rígidos sin índices secundarios que forzaban escaneos lentos (`KEYS *`) para revocación, y riesgo de traducir caídas de red en errores 401 Unauthorized.
* **Alternativas Consideradas:**
  1. *Escanear con `KEYS *` o `SCAN`:* Ineficiente en producción; bloquea el event loop de Redis o genera alta latencia.
  2. *Redis como base de datos primaria de sesiones:* Viola el principio de autoridad de PostgreSQL. Si Redis se reinicia, no debe perderse información crítica de negocio.
  3. *Cliente Unificado `@unisaas/redis-client` sobre `ioredis: ^5.4.1`:*
     - **Jerarquía de Claves Multi-Tenant:** `unisaas:session:{sessionId}`, `unisaas:tenant:{tenantId}:user:{userId}:sessions`, `unisaas:tenant:{tenantId}:idempotency:{key}`.
     - **Índices Secundarios en ZSET con Purga Atómica:** Miembros ordenados por timestamp de expiración Unix (`score = expiresAt`). Se implementa purga atómica `ZREMRANGEBYSCORE -inf (now)` y revocación masiva en $O(M)$ mediante script Lua, sin `KEYS *`.
     - **Protección contra Carreras (Regla 4):** La purga respeta un timestamp estricto de expiración para no eliminar sesiones recién creadas o renovadas.
     - **Mapeo a HTTP 503:** Errores de transporte (`ECONNREFUSED`, `ETIMEDOUT`, `NR_CLOSED`) lanzan de forma determinista `RedisUnavailableException` (`HTTP 503 Service Unavailable`, `Retry-After: 5`). Se prohíbe explícitamente emitir 401 por caídas de infraestructura.
* **Justificación:** Garantiza latencia submilisegundo en operaciones de sesión, previene bloqueos por escaneo y blinda la semántica HTTP ante caídas de la infraestructura transitoria.
* **Consecuencias:** Toda interacción con Redis en el backend modular NestJS se canalizará a través de `@unisaas/redis-client`.

---

## ADR-020: Arquitectura de Monolito Modular NestJS 11 (`apps/api-gateway` y `modules/*`), Inyección Criptográfica de Tenant y Resiliencia Global
* **Fecha:** 31 de octubre de 2026 (Fase 5: Backend Monolítico Modular)
* **Estado:** **Aprobada**
* **Contexto:** La arquitectura previa presentaba controladores dispersos y acoplados entre 8 repositorios, llamadas inseguras que confiaban ciegamente en headers `X-Tenant-Id` no validados por el cliente, falta de transaccionalidad estricta RLS en los servicios y caídas de infraestructura que retornaban errores 401 en lugar de 503.
* **Alternativas Consideradas:**
  1. *Microservicios separados e independientes:* Agrega complejidad operacional inmanejable, latencia de red innecesaria y problemas de consistencia distribuida para el tamaño del equipo.
  2. *Monolito spaghetti no modular:* Provoca acoplamiento de código, dependencias circulares y pérdida de límites de dominio.
  3. *Monolito Modular con API Gateway Unificado:*
     - **Cinco Módulos de Dominio Autónomos en `modules/*`:**
       - `@unisaas/identity`: Autenticación, usuarios, inquilinos, RBAC y gestión de sesiones/blacklist.
       - `@unisaas/inventory`: Catálogo de productos, variantes, bodegas, saldos y Kardex CPP con Value Objects de dominio.
       - `@unisaas/sales`: Turnos de caja POS, facturación, cálculo exacto de IVA/descuentos y anulaciones.
       - `@unisaas/accounting`: Plan Único de Cuentas (PUC), asientos contables con estricto balance de partida doble y balance de comprobación.
       - `@unisaas/credits`: Terceros (clientes y proveedores), compras e imputación a cartera de créditos/fiados con validación de límite de crédito (`creditLimit`).
     - **API Gateway en `apps/api-gateway`:**
       - Punto de entrada unificado bajo prefijo global `/api/v1`.
       - Documentación OpenAPI / Swagger generada automáticamente en `/api/v1/docs`.
       - `JwtAuthGuard`: Valida la firma del token JWT, rechaza tokens revocados o sesiones expiradas en Redis, inyecta `request.tenantId` y `request.user` verificados, y rechaza con `403 Forbidden` cualquier intento de un usuario no autorizado de manipular el header `X-Tenant-Id`.
       - `GlobalHttpExceptionFilter`: Captura centralizada que traduce deterministamente `RedisUnavailableException` a `HTTP 503 Service Unavailable` con header `Retry-After: 5`, `TenantContextException` a `400 Bad Request`, y `DomainException` a `400 Bad Request`.
       - Integración obligatoria con `withTenantContext`: Todos los servicios de dominio acceden a los datos protegidos invocando `withTenantContext(this.prisma, tenantId, async (tx) => ...)`.
* **Justificación:** Combina la simplicidad de despliegue de un solo artefacto con límites arquitectónicos claros, alta cohesión y bajo acoplamiento, blindando la seguridad multi-tenant tanto a nivel de transporte HTTP como en la capa de persistencia en base de datos.
* **Consecuencias:** Todo el backend compila bajo TypeScript 5.9.3 en Turborepo en menos de 5 segundos, cuenta con 97 pruebas automatizadas pasando al 100% y expone un contrato OpenAPI completo para los clientes web y móvil.

---

## ADR-021: Orquestación Atómica de Checkout POS, Idempotencia Durable en Dos Fases y Efectos Post-Commit
* **Fecha:** 31 de octubre de 2026 (Fase 6: Orquestación Atómica de Checkout POS)
* **Estado:** **Aprobada y Certificada**
* **Contexto:** Las operaciones de venta en el POS son críticas para el negocio y conllevan efectos cruzados en múltiples subsistemas: generación de factura, descuento de existencias en inventarios, registro en Kardex bajo Costo Promedio Ponderado (CPP), actualización de saldo en turnos de caja, afectación de cupo y cartera si es fiado/crédito, asiento contable de partida doble, eventos de integración y emisión de recibos térmicos. En la arquitectura previa, estas acciones estaban dispersas entre squads independientes, corriendo el riesgo de inconsistencias graves (e.g. factura emitida sin descontar inventario, o inventario descontado sin comprobante contable balanceado).
* **Decisiones de Diseño Obligatorias:**
  1. **Transacción Interactiva ACID Única en PostgreSQL:**
     - Se rechaza el uso de Sagas o compensaciones para operaciones locales dentro de la misma base de datos.
     - Todas las mutaciones de negocio (factura, balance de stock, movimientos de inventario, Kardex CPP, turno POS, deuda de crédito, asiento contable de partida doble, outbox event y registro de auditoría) se ejecutan dentro de una **única transacción interactiva de PostgreSQL** mediante `withTenantContext` bajo el rol `app_runtime` (NOBYPASSRLS).
     - Se aplica bloqueo pesimista `SELECT ... FOR UPDATE` sobre `inventory_balances` antes de validar el stock para evitar condiciones de carrera y sobreventas concurrentes.
     - Todo se confirma (`COMMIT`) conjuntamente o se revierte (`ROLLBACK`) en su totalidad.
  2. **Protocolo de Idempotencia Durable en Dos Fases:**
     - **PostgreSQL como Autoridad Inquebrantable:** Redis actúa únicamente como acelerador auxiliar transitorio (`IdempotencyLockService`). La autoridad final y duradera reside en la tabla `inventory_idempotency_keys` en PostgreSQL (protegida con RLS y clave única `(tenant_id, key)`).
     - **Fase 1 (Pre-transacción):** Reserva atómica de lease mediante inserción con `ON CONFLICT (tenant_id, key) DO NOTHING` con fingerprint canónico SHA-256 de la carga útil (`request_hash`). Si colisiona:
       - Si el hash es diferente: lanza inmediatamente `409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`.
       - Si está `COMPLETED`: retorna la respuesta almacenada con encabezado `X-Idempotent-Replay: true`.
       - Si está `IN_PROGRESS` con antigüedad `< 30s`: retorna `409 IDEMPOTENCY_IN_PROGRESS` (con `retryAfter: 2`).
       - Si está `IN_PROGRESS` con antigüedad `>= 30s` (caída de worker anterior): recuperación atómica de arrendamiento mediante Compare-And-Swap (CAS) incrementando `recovery_count`.
       - Si está `FAILED`: permite reintento recuperando lease a `IN_PROGRESS` con CAS.
     - **Fase 2 (Transacción de negocio):** Si la transacción es exitosa, se marca `COMPLETED` verificando el fencing token (`recovery_count`); si la transacción revierte por excepción de negocio, en el bloque `catch` se marca la clave como `FAILED` de forma independiente.
  3. **Partida Doble Estricta e Invariante Contable:**
     - Asiento contable en `journal_entries` y `journal_entry_lines` con verificación estricta: $\sum \text{Débitos} \equiv \sum \text{Créditos}$.
     - Imputación a cuentas PUC: Cobro Débito (`110505` Caja / `111005` Bancos / `130505` Clientes), Ingreso Crédito (`4135`), IVA Crédito (`2408`), Costo de Mercancía Débito (`6135`), Inventarios Crédito (`1435`).
  4. **Efectos Post-Commit Fuera de la Transacción:**
     - Los efectos secundarios irreversibles (impresión térmica binaria ESC/POS vía `@unisaas/escpos` y notificaciones/despachos) se ejecutan **estrictamente después del COMMIT**.
     - Se registra el evento en `inventory_outbox_events` con estado `PENDING` dentro de la transacción de base de datos; tras el COMMIT, el procesador post-commit marca el evento como `PROCESSED`. Un worker en segundo plano procesa lotes acumulados para asegurar entrega *at-least-once*.
* **Justificación:** Garantiza matemáticamente la consistencia transaccional y la idempotencia indestructible ante caídas de red, reinicios de procesos o reintentos del cliente POS.
* **Consecuencias:** 117 pruebas automatizadas pasando al 100% en todo el monorepo; cero inconsistencias contables o de stock.

---

## ADR-022: Arquitectura del Frontend Web POS (`apps/web-pos`), Cliente HTTP Fetch Tipado Propio, Seguridad de Sesiones con Cookies httpOnly y Línea Base Playwright E2E
* **Fecha:** 31 de octubre de 2026 (Fase 7: Frontend Web POS)
* **Estado:** **Aprobada**
* **Contexto:** En la arquitectura heredada de Squad 4, el frontend realizaba conexiones directas a PostgreSQL mediante el driver `pg` dentro de los Route Handlers de Next.js, omitiendo los contratos y guardas del backend NestJS; almacenaba tokens JWT en `localStorage` (exponiendo las credenciales a ataques de exfiltración por Cross-Site Scripting XSS); no contaba con un cliente HTTP tipado centralizado; y carecía de pruebas funcionales y de resiliencia automatizadas.
* **Decisiones de Diseño Obligatorias:**
  1. **Aislamiento Estricto Frontend-Backend (Cero Acceso Directo a BD):**
     - Se prohíbe terminantemente la importación o uso de `@unisaas/database`, Prisma Client o paquetes `pg` dentro de `apps/web-pos`.
     - Toda la información de inventario, turnos, clientes y checkout se consume exclusivamente a través de los endpoints REST del backend monolítico modular NestJS (`http://localhost:3000/api/v1`).
  2. **Cliente HTTP Tipado Propio sobre `fetch` Nativo (`api-client.ts`):**
     - Sin librerías externas pesadas (como `axios`).
     - Inyección transparente de cabeceras obligatorias: `Authorization: Bearer <token>`, `X-Tenant-Id: <tenant-id>` e `Idempotency-Key: <uuid>`.
     - Detección determinista de repetición idempotente mediante la lectura del encabezado `X-Idempotent-Replay: true` y del campo de cuerpo `isReplay: true`.
     - Mapeo unificado a jerarquía de excepciones de dominio: `UnauthorizedError` (HTTP 401), `ForbiddenError` (HTTP 403), `NotFoundError` (HTTP 404), `ConflictError` (HTTP 409 con `code` y `retryAfterSeconds`) y `ServiceUnavailableError` (HTTP 503 con `retryAfter`).
     - Mapeo automático de desconexión de red o fallo de transporte a `ServiceUnavailableError`.
  3. **Seguridad de Sesiones con Cookies httpOnly (Prohibición de `localStorage`):**
     - Los tokens de acceso JWT se administran en el servidor mediante Next.js Route Handlers (`/api/auth/login`, `/api/auth/logout`, `/api/auth/session`) y se persisten en cookies HTTP seguras (`httpOnly: true`, `sameSite: 'lax'`, `path: '/'`).
     - Ningún script en el cliente puede acceder directamente a los tokens JWT vía `document.cookie` o `localStorage`, eliminando el vector de robo de sesión por inyección XSS.
  4. **Estado Reactivo del Terminal POS con Zustand (`pos-cart.store.ts`):**
     - Almacenamiento desacoplado de ítems, cantidades, cliente asignado, medio de pago seleccionado y montos recibidos.
     - Cálculo matemático en memoria de subtotales gravados, IVA acumulado, total a pagar y cambio/vueltos en tiempo real.
     - Soporte para botones de efectivo rápido en denominaciones colombianas ($10.000, $20.000, $50.000, $100.000 y Paga Exacto).
  5. **Línea Base Automatizada Playwright E2E (`e2e/`):**
     - 9 pruebas E2E en Chromium headless cubriendo autenticación y logout, checkout en efectivo con cálculo de vueltos, emisión de consecutivo e inyección de cabecera `Idempotency-Key`, visualización del badge de repetición idempotente ante reintentos de red, y resiliencia visual ante errores 401, 409 y 503 sin pérdida del estado de la venta.
* **Justificación:** Garantiza una experiencia de usuario rápida y moderna en el punto de venta, cumplimiento de estándares OWASP de seguridad de sesiones web, total desacoplamiento respecto a la capa de persistencia y verificación continua de la integración con el backend.
* **Consecuencias:** `apps/web-pos` compila en modo producción en 4.5s (`next build`), cuenta con 13 pruebas unitarias y 9 pruebas E2E pasando al 100%, elevando la cobertura total del monorepo a 130 pruebas automatizadas sin ningún error.

---

## ADR-023: Arquitectura Offline-First, Persistencia SQLite con Drift y Patrón Transactional Outbox en Mobile POS (`apps/mobile-pos`)
* **Fecha:** 31 de octubre de 2026 (Fase 8: Flutter Mobile POS)
* **Estado:** **Aprobada**
* **Contexto:** En el punto de venta móvil, la conectividad a internet en terminales y tablets es frecuentemente intermitente o nula. El cliente móvil debe ser capaz de procesar ventas localmente de inmediato, emitir comprobantes preliminares y garantizar que ninguna venta se pierda ni se duplique al restablecerse la red.
* **Decisiones de Diseño Obligatorias:**
  1. **Persistencia Local Relacional con Drift (SQLite):**
     - Base de datos tipada `AppDatabase` con tablas para `LocalProducts`, `LocalSales`, `LocalSaleItems` y `SyncQueueItems`.
     - Sobrevivencia garantizada a reinicios completos de la app o del sistema operativo (certificado en prueba Escenario D).
  2. **Cola de Sincronización Outbox (`SyncQueueWorker`):**
     - Cada checkout local genera atómicamente un registro de venta y un ítem en la cola `sync_queue` con estado `PENDING` y una `Idempotency-Key` UUIDv4 inmutable.
     - Reintentos continuos con retroceso exponencial (`exponential backoff`) ante caídas de red o errores HTTP 5xx (certificado en Escenarios A y B).
     - Procesamiento determinista de respuestas HTTP 409 Conflict: si el servidor reporta un conflicto irrecuperable (por ejemplo, divergencia de huella de payload), el ítem se marca como `CONFLICT`, se detiene el bucle de reintentos y se preserva el payload original para auditoría (certificado en Escenario C).
  3. **Generación Tipada de Contratos desde OpenAPI v3:**
     - Integración con el backend mediante `generate-dart-api.ps1`, eliminando mapeadores manuales propensos a error.
* **Justificación:** Otorga resiliencia total al negocio en operaciones de campo y eventos sin conectividad.
* **Consecuencias:** 19 pruebas de integración y widgets en `flutter test` aprobadas al 100%. `flutter analyze` reporta 0 issues.

---

## ADR-024: Generación Atómica y Concurrente de Consecutivos POS y Asientos Contables vía `TenantSequence`
* **Fecha:** 1 de noviembre de 2026 (Fase 10: Retiro Controlado y Commit Inicial)
* **Estado:** **Aprobada**
* **Contexto:** Durante las pruebas de carga a 50 RPS (Fase 9), se detectó que calcular números de factura y de asiento contable mediante `SELECT count(*)` generaba colisiones de concurrencia bajo transacciones simultáneas del mismo milisegundo (`KI-014`). La solución provisional de QA usaba sufijos aleatorios (`POS-YYYYMMDD-COUNT-XXXXXX`) y timestamps, lo cual impedía cumplir la estricta regulación tributaria y contable de numeración correlativa y continua.
* **Decisiones de Diseño Obligatorias:**
  1. **Uso de la Entidad Relacional `TenantSequence` (`tenant_sequences`):**
     - Se utiliza la clave primaria compuesta `(tenant_id, sequence_key)`.
     - Claves estándar: `pos_invoice` para facturas y `accounting_journal` para asientos del libro diario.
  2. **Operación Atómica `INSERT ... ON CONFLICT DO UPDATE` en PostgreSQL:**
     ```sql
     INSERT INTO tenant_sequences (tenant_id, sequence_key, current_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, sequence_key)
     DO UPDATE SET current_value = tenant_sequences.current_value + 1
     RETURNING current_value;
     ```
     - Esta sentencia toma un bloqueo exclusivo a nivel de fila (`FOR UPDATE`) en PostgreSQL, garantizando serialización estricta por inquilino y tipo de secuencia sin bloquear a otros inquilinos ni a otras secuencias.
  3. **Consecutivo Canónico y Rollback Automático:**
     - Factura: `POS-${datePrefix}-${String(val).padStart(6, '0')}` (e.g. `POS-20261101-000001`).
     - Asiento Contable: `BigInt(val)` (1, 2, 3...).
     - Si la transacción interactiva de checkout falla (ej. dinero en efectivo insuficiente), el rollback de PostgreSQL anula el incremento de la fila de secuencia, evitando huecos numéricos.
* **Justificación:** Cumplimiento total de requisitos legales y tributarios (DIAN / Libro Diario) garantizando cero colisiones y cero duplicados bajo alta concurrencia.
* **Consecuencias:** 5 pruebas de validación atómica en `apps/qa-e2e/e2e/sequence-atomic-validation.e2e-spec.ts` aprobadas al 100%. Problema `KI-014` cerrado definitivamente.

---

## ADR-025: Retiro Controlado de Código Heredado, Limpieza Integral de Artefactos y Establecimiento de Línea Base en Git (`main`)
* **Fecha:** 1 de noviembre de 2026 (Fase 10: Cierre Definitivo de Migración)
* **Estado:** **Aprobada**
* **Contexto:** Finalizada la implementación y certificación de todas las capas del monorepo UniSaaS (Fases 1 a 9), el directorio `C:\unisaas\new` contenía todavía las carpetas de referencia `squad1*` a `squad8*`, scripts de despliegue fragmentados de la arquitectura anterior, scripts de CDP antiguos, artefactos temporales y documentación histórica dispersa.
* **Decisiones de Diseño Obligatorias:**
  1. **Retiro Seguro de Directorios `squad*`:**
     - Eliminación definitiva de `squad1/` a `squad8/` en `new/`. El repositorio original `C:\unisaas\old` permanece 100% intacto como referencia histórica de solo lectura.
  2. **Preservación Archivística de Documentación:**
     - Toda la documentación histórica, planes anteriores y auditorías se consolidan bajo `docs/legacy/` y `docs/archive/`.
  3. **Estandarización de Scripts Operativos en Raíz:**
     - `iniciar-unisaas.ps1` y `detener-unisaas.ps1` con PM2 sobre `ecosystem.config.cjs` (puerto 3000 para `api-gateway` y puerto 3001 para `web-pos`).
     - Docker Compose simplificado para PostgreSQL 16 y Redis 7.
  4. **Configuración Estricta de `.gitignore`:**
     - Exclusión de `node_modules/`, `.next/`, `.turbo/`, `dist/`, `.dart_tool/`, `build/`, `coverage/`, `reports/*.json` y archivos de credenciales (`.env`, `.env.*`), preservando `.env.example` y `.env.production.example`.
  5. **Creación del Repositorio Git Inicial en `main`:**
     - `git init -b main`, adición integral con `git add .` y commit inicial limpio `chore: initialize UniSaaS monorepo`.
     - Prohibición estricta de crear remotos o ejecutar `git push`.
* **Justificación:** Entrega un monorepo limpio, mantenible, moderno y listo para producción sin duplicidades ni código muerto.
* **Consecuencias:** Estructura de repositorio final consolidada, verificada y certificada.










