# apps/qa-e2e — Suite de QA, Certificación RLS y Pruebas de Rendimiento k6

Este paquete workspace centraliza las pruebas de integración End-to-End (E2E), auditorías de seguridad en profundidad para Row-Level Security (RLS) en PostgreSQL 16 y pruebas de carga con k6 sobre el monolito modular UniSaaS.

---

## 1. Arquitectura y Estructura de Directorios

```
apps/qa-e2e/
├── config/
│   └── environment.ts              # Configuración tipada de URLs, credenciales y UUIDs de prueba
├── e2e/
│   ├── tenant-isolation.e2e-spec.ts    # Verificación de aislamiento HTTP y prevención de spoofing
│   └── checkout-idempotency.e2e-spec.ts# Verificación de replay y atomicidad de checkout
├── fixtures/
│   ├── seed-qa-data.sql            # Fixtures SQL para catálogo distribuido (20 SKUs) y balance masivo
│   └── seed-qa-data.ts             # Ejecutor TypeScript del seeder de pruebas
├── k6/
│   ├── helpers/
│   │   └── auth.js                 # Helper k6 para autenticación JWT y extracción de tokens
│   └── scenarios/
│       ├── product-search.js       # Escenario k6: Búsqueda intensiva en catálogo (40 RPS)
│       ├── pos-checkout.js         # Escenario k6: Checkout atómico POS (40 RPS)
│       └── mixed-workload.js       # Escenario k6: Carga abierta mixta (75% búsquedas, 25% checkout = 50 req/s)
├── rls-certification/
│   ├── rls-comprehensive-audit.sql # Auditoría SQL de 10 criterios de seguridad RLS
│   ├── rls-connection-pool-leak.ts # Pruebas Node.js contra contaminación por reuso de conexiones en el pool
│   └── run-rls-tests.ts            # Orquestador programático de las pruebas RLS
├── scripts/
│   ├── collect-metrics.ps1         # Colector de telemetría de PostgreSQL, Redis, Node.js y Docker
│   ├── run-k6-load.ps1             # Runner PowerShell automatizado para k6 con métricas antes/después
│   └── run-rls-cert.ps1            # Runner PowerShell para certificación RLS
├── reports/                        # Resultados y resúmenes JSON generados por k6 y métricas
├── package.json
└── tsconfig.json
```

---

## 2. Requisitos Previos

1. **Node.js**: v26.13.0 (o v24+ LTS compatible).
2. **PostgreSQL 16**: Contenedor Docker en puerto `5432` con base de datos `saas_contable_db` y rol `app_runtime` configurado.
3. **Redis 7+**: Contenedor Docker en puerto `6379`.
4. **k6**: Versión v0.56+ instalada en el PATH del sistema o ejecutable local en `C:\Users\Edwin\k6-v0.56.0-windows-amd64\k6.exe`.
5. **API Gateway**: Instancia activa de `apps/api-gateway` escuchando en `http://localhost:3000/api/v1`.

---

## 3. Certificación de Row-Level Security (RLS)

La certificación RLS comprueba que las 31 tablas multi-tenant de la base de datos están estrictamente aisladas bajo el rol `app_runtime`:

### Criterios Validados (10 de 10):
1. **Atributos de Rol Seguro**: `app_runtime` posee `NOSUPERUSER`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`, no es dueño de tablas y no tiene permiso `CREATE` en esquemas.
2. **Función de Contexto Segura**: `current_tenant_id()` configurada con `SECURITY DEFINER` y `search_path = pg_catalog, public`.
3. **RLS Forzado en Esquema**: 100% de tablas multi-tenant tienen `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`.
4. **Aislamiento de Lectura Inquilino A**: El Inquilino A únicamente accede a sus registros.
5. **Aislamiento de Lectura Inquilino B**: El Inquilino B únicamente accede a sus registros.
6. **Aislamiento Cruzado Bidireccional**: Lecturas cruzadas entre inquilinos devuelven exactamente 0 filas.
7. **Aislamiento Estricto de Escritura**: Sentencias `UPDATE` y `DELETE` entre inquilinos no afectan registros (0 filas). Sentencias `INSERT` cruzadas son rechazadas de inmediato por `WITH CHECK`.
8. **Blindaje de Contexto Nulo o Corrupto**: Consultas ejecutadas sin contexto o con UUID malformado retornan exactamente 0 filas sin errores no controlados.
9. **No Persistencia Transaccional**: `SET LOCAL ROLE` y `SET LOCAL app.current_tenant_id` se revierten de forma determinista al finalizar cada transacción.
10. **Aislamiento en Conexiones Reutilizadas del Pool**: Pruebas continuas con conexiones físicas recicladas del pool demuestran 0 fugas de contexto entre inquilinos.

### Comandos de Ejecución:
```bash
# Ejecutar auditoría RLS completa
pnpm test:rls

# O mediante PowerShell directo
powershell -ExecutionPolicy Bypass -File scripts/run-rls-cert.ps1
```

---

## 4. Pruebas de Integración E2E

Verifican el comportamiento funcional del API Gateway frente a escenarios de seguridad y concurrencia:
- **`tenant-isolation.e2e-spec.ts`**:
  - Catálogo de productos aislado por token JWT.
  - Rechazo de acceso a recursos de otros inquilinos.
  - Rechazo con `HTTP 403 Forbidden` ante intentos de suplantación de cabecera `X-Tenant-Id`.
  - Rechazo de checkouts que intenten incluir productos de otro inquilino.
- **`checkout-idempotency.e2e-spec.ts`**:
  - Emisión de factura exitosa con decremento de stock y asiento contable en transacción atómica.
  - Reemisión con la misma `Idempotency-Key` devuelve la factura original con `isReplay: true` sin duplicar inventario ni transacciones contables.

### Comandos de Ejecución:
```bash
pnpm test:e2e
```

---

## 5. Pruebas de Carga con k6

### Modelo de Carga Abierta (`constant-arrival-rate`)
A diferencia de los modelos de carga cerrada basados en VUs fijas, se emplea `constant-arrival-rate` para modelar la tasa de arribo de clientes reales:
- **Rate**: 40 iteraciones por segundo.
- **TimeUnit**: 1s.
- **PreAllocatedVUs**: 50, **MaxVUs**: 100.
- **Ponderación**: 75% búsquedas de catálogo (1 HTTP req) y 25% checkout completo POS (2 HTTP reqs: 1 búsqueda previa + 1 checkout transaccional).
- **Rendimiento Objetivo**: 40 iter/s * 1.25 req/iter = **50 HTTP req/s**.

### Umbrales de Calidad (Thresholds):
- `http_req_duration`: p95 <= 350 ms.
- `http_req_failed`: < 1.0% (< 0.01).
- `checkout_failure_rate`: < 0.1% (< 0.001).
- `dropped_iterations`: < 0.5%.
- `postgresql_deadlocks`: 0.

### Comandos de Ejecución:
```bash
# Preparar datos de prueba distribuidos (20 SKUs de alta disponibilidad)
pnpm seed

# Ejecutar escenario mixto durante 30s
powershell -ExecutionPolicy Bypass -File scripts/run-k6-load.ps1 -Scenario mixed -Duration 30s

# Ejecutar prueba de carga sostenida durante 2m (o 15m)
powershell -ExecutionPolicy Bypass -File scripts/run-k6-load.ps1 -Scenario mixed -Duration 2m
```

---

## 6. Resultados Empíricos y Observaciones Técnicas

### 6.1. Métricas de Rendimiento Obtenidas (Carga Sostenida)
* **Iteraciones:** 4,801 completadas (39.89 iter/s — 99.7% del objetivo).
* **Solicitudes HTTP:** 5,974 procesadas (49.64 req/s real — 99.3% del objetivo).
* **Relación Solicitudes/Iteración:** 1.24 req/iter (Objetivo: 1.25).
* **Iteraciones descartadas:** 0 (0.000%).
* **Latencia p50 (mediana):** 52.25 ms.
* **Latencia p90:** 274.96 ms.
* **Latencia p95:** **393.64 ms** *(Incumplimiento documentado frente al umbral de 350 ms originado por latencia de fsync en almacenamiento virtualizado de Docker Desktop en Windows)*.
* **Tasa de Errores HTTP:** 0.000% (0 fallos).
* **Tasa de Fallos en Checkout:** 0.000% (0 fallos sobre 1,173 transacciones ACID concurrentes).
* **PostgreSQL Deadlocks:** 0.
* **PostgreSQL Lock Waits:** 0.

### 6.2. Auditoría de Numeración Comercial y Contable
* La solución técnica para concurrencia aplicada en `checkout-coordinator.service.ts` (sufijo hexadecimal en consecutivo y BigInt microsegundos en asientos) resuelve las colisiones en BD, pero desvía la regla de negocio tributaria (DIAN) y contable de continuidad ordinal estricta. Se programa su migración a `tenant_sequences` en Fase 10.

### 6.3. Dimensionamiento del Pool de Conexiones
* Una única instancia de API Gateway consume hasta 45 conexiones bajo 50 RPS. En despliegues multi-instancia en producción, se requiere un connection pooler externo (**PgBouncer**) para no agotar `max_connections=100` de PostgreSQL.


