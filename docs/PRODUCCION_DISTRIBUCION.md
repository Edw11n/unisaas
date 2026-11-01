# Producción y distribución — UniSaaS

Guía operativa del monorepo UniSaaS: instalación, variables de entorno,
migraciones, procesos supervisados con PM2, despliegue con backup y rollback,
healthchecks, logs y límites reales.

> **Alcance de la promesa “sin caídas”.** Este documento describe un
> procedimiento de despliegue **controlado y reversible**, no cero caídas
> absoluto. Con PM2 en `exec_mode=fork`, `pm2 reload` reinicia cada proceso
> (del orden de segundos por app). El BFF además se compila en el mismo
> directorio que sirve, por lo que `next build` puede provocar errores
> transitorios en rutas no cacheadas. Los supuestos y límites están en la
> sección [Limitaciones y riesgos conocidos](#15-limitaciones-y-riesgos-conocidos).

---

## 1. Resumen ejecutivo

| Pieza | Implementación |
|---|---|
| Gestor de procesos | PM2 7 (`ecosystem.config.cjs`) |
| Infraestructura | Docker Compose de Squad 8 (PostgreSQL 16 + Redis 7) |
| BFF / POS / Admin | Next.js 15 en `next start -p 3100` |
| APIs | NestJS S1 3001, S2 3002, S3 3003, S6 3006, S7 3007 |
| Despliegue | `scripts/deploy.ps1` (preflight → backup → build → migraciones → reload → healthcheck) |
| Salud | `scripts/healthcheck.ps1` (exit code 0/1) |
| Reset de datos | `scripts/reset-zero.ps1` (transaccional, backup previo, confirmación) |
| Migraciones | Runner con ledger `public.unisaas_schema_migrations` |
| Rollback | `backups/<timestamp>/ROLLBACK.txt` + dump `pg_dump` |

Archivos nuevos o reescritos por este entregable:

```
ecosystem.config.cjs                 # PM2 producción (reescrito)
ecosystem.config.dev.cjs             # PM2 desarrollo (preserva el anterior)
ecosystem.config.prod.cjs            # alias de compatibilidad
scripts/_common.ps1                  # helpers compartidos
scripts/healthcheck.ps1              # salud de infra + servicios
scripts/deploy.ps1                   # despliegue con dry-run
scripts/reset-zero.ps1               # reset transaccional
.env.production.example              # contrato de variables (raíz)
squad*/.env.production.example       # plantillas por app
docs/PRODUCCION_DISTRIBUCION.md      # este documento
.github/workflows/ci.yml             # job ops-scripts agregado
squad4.../src/app/api/health/route.ts# liveness sin caché
```

---

## 2. Arquitectura y puertos

| Servicio | Directorio | Puerto | Entrypoint de producción | Health usado |
|---|---|---:|---|---|
| S1 Core/Auth | `squad1_core_architecture_rls_rbac-main` | 3001 | `dist/main.js` | `/api/docs` |
| S2 Contabilidad | `squad2_accounting_engine_ledger-main` | 3002 | `dist/main.js` | `/api/docs` |
| S3 Inventario/Kardex | `squad3_inventory_kardex_cpp-master` | 3003 | `dist/src/main.js` | `/api/docs` |
| S6 Reportes/Auditoría | `squad6_reports_audit_escpos-develop` | 3006 | `dist/main.js` | `/api/v1/health` |
| S7 Cartera/Compras | `squad7_credits_purchases_suppliers-main` | 3007 | `dist/main.js` | `/api/v1/health` |
| BFF S4 Web/POS | `squad4_web_desktop_pos_nextjs-main` | **3100** | `node_modules/next/dist/bin/next start -p 3100` | `/api/health` |
| PostgreSQL | contenedor `postgres-saas` | 5432 | — | `pg_isready` |
| Redis | contenedor `redis-saas` | 6379 | — | `PING` |

Notas:

- S3 compila con `rootDir: "."`, por eso su entrypoint es `dist/src/main.js`.
  No lo cambie a `dist/main.js`.
- El BFF se movió de 3000 (desarrollo) a **3100** en producción. Los clientes
  internos deben apuntar a ese puerto.
- **Conflicto declarado:** `squad8_devops_sre_qa-main/docker-compose.yml`
  publica **Loki en 3100**. Si ese contenedor está arriba, el BFF no podrá
  enlazar. Mueva Loki a 3101 o deténgalo. `deploy.ps1` lo detecta como bloqueo.
- `iniciar-unisaas.ps1 -Modo PM2` usa `ecosystem.config.dev.cjs` (watchers,
  BFF en 3000). No mezcle ambos modos sobre los mismos puertos.

---

## 3. Requisitos

### Windows (10/11 o Server 2019+)

- Node.js **20 o superior** (probado con 24.15.0). npm 10+.
- PM2 global: `npm install -g pm2`
- Docker Desktop con Linux containers (o Docker Engine con WSL2).
- PowerShell 5.1 (incluido) o PowerShell 7.
- Git.
- Opcional para backups en host: cliente PostgreSQL (`pg_dump`/`pg_restore`).
  Si no está, los scripts usan `docker exec postgres-saas pg_dump`.
- Opcional: `pnpm` (S2 y S3 tienen `pnpm-lock.yaml`):
  `corepack enable` o `npm install -g pnpm`.

### Linux (Ubuntu 22.04/24.04, Debian 12)

- Node.js 20+ (NodeSource o nvm), npm, git, Docker Engine + Compose plugin.
- PM2 global.
- `pwsh` (PowerShell 7) para ejecutar los scripts `.ps1`:
  https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux
- Mismos opcionales de `pnpm` y cliente PostgreSQL.

### Recursos sugeridos

- 4 vCPU, 8 GB RAM, 40 GB de disco libre (los builds de Next y los dumps
  consumen espacio; `deploy.ps1` exige mínimo 3 GB libres).
- Puertos públicos: solo 80/443. **No** exponga 5432, 6379 ni 3001-3100 a
  Internet.

---

## 4. Instalación desde cero

### 4.1 Infraestructura

```powershell
cd squad8_devops_sre_qa-main
Copy-Item .env.example .env
# Complete en .env: POSTGRES_PASSWORD, APP_RUNTIME_PASSWORD,
# MIGRATION_OWNER_PASSWORD, JWT_SECRET, GRAFANA_ADMIN_PASSWORD.
docker compose up -d
docker compose ps
```

El `docker-compose.yml` exige contraseñas explícitas (`:?`), por lo que falla
a propósito si quedan vacías. El init monta:

- `scripts/init-db.sql` (tablas base y tenants de ejemplo)
- `scripts/02-security-hardening-runtime-role.sql` (roles `saas_migration_owner`
  y `app_runtime`, `NOBYPASSRLS`, privilegios mínimos)

Verifique el rol de runtime:

```powershell
docker exec postgres-saas psql -U saas_admin -d saas_contable_db `
  -c "SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname='app_runtime';"
# Esperado: app_runtime | f | f
```

### 4.2 Dependencias por squad

```powershell
# Desde la raíz del repo. Use npm o pnpm según el lockfile de cada squad.
cd squad1_core_architecture_rls_rbac-main; npm ci; cd ..
cd squad2_accounting_engine_ledger-main; pnpm install --frozen-lockfile; cd ..
cd squad3_inventory_kardex_cpp-master; pnpm install --frozen-lockfile; pnpm run prisma:generate; cd ..
cd squad4_web_desktop_pos_nextjs-main; npm ci; cd ..
cd squad6_reports_audit_escpos-develop; npm ci; cd ..
cd squad7_credits_purchases_suppliers-main; npm ci; cd ..
```

Alternativa: `scripts/deploy.ps1 -Install` ejecuta la instalación antes del
build (útil en el primer despliegue).

### 4.3 Variables de entorno

```powershell
# La plantilla raiz documenta el contrato completo (Docker + apps).
# PM2 NO lee la raiz: inyecta el .env de cada squad.
# Copie cada plantilla a su .env y reemplace los CAMBIA_*.
Copy-Item squad1_core_architecture_rls_rbac-main\.env.production.example `
          squad1_core_architecture_rls_rbac-main\.env
# Repita para S2, S3, S4, S6 y S7.
```

Cada app lee su propio `.env` (PM2 lo inyecta con `env_file`). Reemplace todos
los `CAMBIA_*`. Genere secretos reales:

```bash
openssl rand -base64 48   # JWT_SECRET (único, compartido por S1/S3/S6/S7/BFF)
openssl rand -base64 32   # contraseñas de roles PostgreSQL
```

El mismo `JWT_SECRET` debe estar en S1, S3, S6, S7 y BFF: S1 firma y los demás
validan. Rotarlo invalida todas las sesiones.

---

## 5. Variables de entorno: reglas que no se pueden saltar

| Variable | Regla | Consecuencia si falla |
|---|---|---|
| `DATABASE_URL` | Rol **`app_runtime`** (sin `BYPASSRLS`) | `deploy.ps1` bloquea; RLS quedaría anulado con `saas_admin` |
| `DB_SSL` (S1) | `false` con el Postgres de Docker (`ssl=off`) | S1 activa TLS en producción y no conecta |
| `NODE_ENV` | `production` (PM2 lo fuerza) | builds y cookies con semántica de desarrollo |
| `JWT_SECRET` | ≥ 32 caracteres, distinto del secreto de desarrollo | S1/S3/BFF pueden abortar o aceptar tokens forjados |
| `USE_MOCK_AUTH` (S2) | `false` | S2 aborta el arranque |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | El BFF aborta (`src/instrumentation.ts`) o el POS opera con mocks |
| `CORS_ORIGINS` | Origen HTTPS del BFF, nunca `*` | Navegador bloquea llamadas cruzadas |
| `NEXT_PUBLIC_*` | Se **hornean en `next build`** | Cambiarlos sin reconstruir no tiene efecto |

### 5.1 `NEXT_PUBLIC_*` y llamadas directas desde el navegador

Los componentes cliente del POS (`src/components/pos/*`, `login/page.tsx`,
`register/page.tsx`) usan `posApiClient`, que llama directamente a
`NEXT_PUBLIC_INVENTORY_SERVICE_URL` y `NEXT_PUBLIC_CREDITS_SERVICE_URL`. En
producción esas URLs deben ser alcanzables **desde el navegador**. La plantilla
usa rutas del mismo dominio (`https://app.example.com/svc/inventory`, etc.)
para que Nginx las proxifique y no haya CORS entre subdominios.

Si publica las APIs en subdominios separados, agregue cada origen a
`CORS_ORIGINS` y use HTTPS en todos.

---

## 6. Base de datos y migraciones

### 6.1 Runner y ledger

`deploy.ps1` aplica migraciones con un ledger idempotente:

```sql
CREATE TABLE IF NOT EXISTS public.unisaas_schema_migrations (
  filename text PRIMARY KEY,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text
);
```

Detección automática (solo dentro de los directorios de squad, nunca en
`backup-pre-bloque1a/` ni `audit-handoff/`):

- `squad*/scripts/migrations/*.sql`
- `squad*/sql/*.sql`
- `squad*/database/migrations/*.sql`

Cada archivo se ejecuta una sola vez (comparando SHA-256). Si el checksum
cambia, se omite con advertencia; no se reaplica solo.

Archivos detectados hoy:

| Archivo | Idempotente por sí mismo |
|---|---|
| `squad1.../scripts/migrations/20261021_team_persistence.sql` | Sí (documentado) |
| `squad7.../database/migrations/001_initial_schema.sql` | Sí (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`) |

> Los dos archivos se probaron dos veces seguidas sobre una base scratch
> aislada (`unisaas_migration_probe`) creada a partir de
> `squad3.../database/schema.sql`: las dos pasadas terminaron con exit 0.

### 6.2 Primer despliegue sobre una base ya existente

La base actual fue creada antes de que existiera el ledger, por lo que la
primera ejecución del runner vería los dos archivos como “pendientes”. Como
ambos son idempotentes (verificado), aplicarlos de nuevo es seguro: recrean
políticas, columnas y funciones sin duplicar datos.

Si prefiere adoptar el ledger **sin** re-ejecutar DDL sobre una base ya
migrada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DryRun
# revise la lista de migraciones detectadas
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -BaselineMigrations
```

`-BaselineMigrations` registra los archivos como aplicados **sin ejecutarlos**.
No lo use en una base nueva: dejaría migraciones sin aplicar de verdad.

Riesgo residual: si una migración futura deja de ser idempotente y no abre su
propia transacción, podría aplicarse parcialmente. Convención obligatoria para
nuevos archivos: `BEGIN; ... COMMIT;` o DDL idempotente.

### 6.3 Esquemas que no gestiona el runner

- `squad3.../database/schema.sql`: esquema consolidado completo. Aplíquelo
  manualmente en bases nuevas o mediante el flujo propio de S3. No se ejecuta
  en cada deploy para evitar efectos laterales.
- `squad8.../scripts/init-db.sql` y `02-security-hardening-runtime-role.sql`:
  bootstrap del contenedor (solo en el primer `docker compose up`).
- `squad2.../scripts/seed-*.sql`: datos iniciales (PUC, setup). Ejecutar a mano
  si la base es nueva.

### 6.4 Migraciones y compatibilidad

El deploy compila antes de migrar. Si una migración falla, los procesos viejos
siguen en memoria con el código anterior, pero el disco ya tiene el build
nuevo. Por eso:

- Las migraciones deben ser **compatibles hacia atrás** (expand/contract).
- No elimine columnas en el mismo release que deja de usarlas.
- Si la migración falla, **no reinicie** PM2 hasta resolverla o hacer rollback.

---

## 7. Arranque con PM2

```powershell
# Desde la raíz del repo, con .env y builds listos:
pm2 start ecosystem.config.cjs
pm2 status
pm2 save
```

Persistencia tras reiniciar el servidor:

- **Linux:** `pm2 startup systemd -u <usuario> --hp /home/<usuario>` y luego
  `pm2 save` (ejecute el comando que PM2 imprime).
- **Windows:** `npm install -g pm2-windows-startup`, luego
  `pm2-startup install` y `pm2 save`. Alternativa: una tarea del Programador
  de tareas que ejecute `pm2 resurrect` al inicio.

Comandos útiles:

```powershell
pm2 logs --lines 100          # logs en vivo (todos)
pm2 logs squad4-web-pos       # una app
pm2 monit                     # CPU/RAM por proceso
pm2 describe squad1-auth-core
pm2 reload ecosystem.config.cjs --update-env
pm2 stop ecosystem.config.cjs
pm2 delete ecosystem.config.cjs
pm2 flush                     # vaciar logs
```

Los logs también se escriben en `logs/<app>-out.log` y `logs/<app>-error.log`
(configurado en el ecosystem). Instale rotación:

```powershell
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
```

### 7.1 Cómo llega el `.env` a cada proceso (PM2 7)

Verificado en este entorno: **PM2 7.0.3 no aplica la clave `env_file`**. El
proceso arranca sin esas variables si solo se declara `env_file`.

Por eso `ecosystem.config.cjs`:

1. Conserva `env_file` (documenta la intención y sirve en versiones futuras).
2. Parsea cada `squad*/.env` al cargar la configuración y lo inyecta en `env`.
3. Fuerza `NODE_ENV=production`, `PORT` y (en el BFF)
   `NEXT_PUBLIC_USE_MOCKS=false` por encima del `.env`.

Implicaciones:

- El `.env` debe ser `CLAVE=VALOR` en una sola línea. No se soportan valores
  multilínea ni expansión de variables.
- `pm2 save` persiste las variables en `~/.pm2/dump.pm2`. Proteja ese archivo
  (permisos 600 en Linux, ACL del usuario del servicio en Windows) y no lo
  copie entre hosts.
- Si prefiere no persistir secretos en el dump de PM2, arranque con systemd o
  el Programador de tareas leyendo el `.env` y no ejecute `pm2 save`.
- Los frameworks también cargan su `.env` desde su `cwd` (NestJS
  `ConfigModule`, Next.js `@next/env`); la inyección de PM2 garantiza el
  resultado incluso si esa carga cambia.

---

## 8. Despliegue y actualización

### 8.1 Dry-run (siempre primero)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DryRun -Strict
```

- `-DryRun` ejecuta solo el preflight (lecturas) y muestra el plan exacto.
  Sale con `0` aunque haya bloqueos, para no confundir “script roto” con
  “entorno no listo”.
- `-DryRun -Strict` sale con `2` si hay bloqueos. Úselo como puerta de CI/CD.

### 8.2 Despliegue real

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
# o por subconjunto, en orden:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Apps squad1-auth-core
```

Pasos que ejecuta:

1. **Preflight**: Node/npm/PM2/Docker, coherencia del ecosystem, `.env` por
   app, secretos, rol `app_runtime`, `ssl` del servidor, puertos ocupados por
   procesos ajenos a PM2, espacio libre y estado de Git.
2. **Backup**: `pg_dump --format=custom --compress=6` a
   `backups/<timestamp>/`. Si falla, aborta (salvo `-SkipBackup`).
3. **Build**: `npm run build` o `pnpm run build` por app, con `NODE_ENV=production`
   y las variables del `.env` cargadas. S3 ejecuta `prisma:generate` primero.
   Los logs quedan en `backups/<timestamp>/build-<app>.log`.
4. **Migraciones**: runner con ledger (sección 6).
5. **PM2**: `pm2 reload ecosystem.config.cjs --update-env` (o `pm2 start` si
   las apps no existían) y `pm2 save`.
6. **Healthcheck**: ejecuta `scripts/healthcheck.ps1`. Si falla, escribe
   `ROLLBACK.txt` y sale con `1`.

Al final deja:

```
backups/<timestamp>/
  saas_contable_db_<timestamp>.dump
  DEPLOY_MANIFEST.json
  ROLLBACK.txt
  build-*.log
```

### 8.3 Qué significa “sin caída” aquí

- El arranque sigue el orden del arreglo (S1 → S2 → S3 → S6 → S7 → BFF).
  En un `reload`, PM2 procesa las apps de la configuración y cada una tiene
  una ventana de segundos sin escuchar; no hay garantía de orden estricto ni
  de continuidad de sesión en curso.
- Next.js se compila **en el mismo directorio** que está sirviendo. Durante
  `next build`, rutas no cacheadas pueden devolver errores transitorios.
- Para reducir impacto: despliegue en horario de baja demanda, mantenga el
  proxy con reintentos, y use `-Apps` para releases parciales.
- Cero caída real requeriría directorios de release + swap atómico (o
  contenedores con rolling update). No está implementado en este repo; se
  documenta como evolución posible.

### 8.4 Flags

| Flag | Efecto |
|---|---|
| `-DryRun` | Solo preflight + plan |
| `-Strict` | Con `-DryRun`, exit 2 si hay bloqueos |
| `-SkipBackup` | No respalda (no recomendado) |
| `-SkipBuild` | Usa `dist`/`.next` existentes |
| `-SkipMigrations` | No aplica migraciones (no recomendado) |
| `-BaselineMigrations` | Registra migraciones sin ejecutarlas (una vez, base existente) |
| `-Install` | `npm ci` / `pnpm install` antes del build |
| `-Apps a,b` | Solo esas apps (nombres PM2) |
| `-AllowPort3100Conflict` | Convierte conflictos de puerto en advertencia |
| `-AllowSslMismatch` | Obsoleto: S1/S2 usan `DB_SSL`; se conserva por compatibilidad |

---

## 9. Healthchecks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -Json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -SkipInfra
```

Verifica:

1. Contenedor `postgres-saas` (`running`/`healthy`), `pg_isready`, `SELECT 1`,
   rol `app_runtime` sin `BYPASSRLS`/`SUPERUSER`, y `SHOW ssl`.
2. Contenedor `redis-saas` y `PING`.
3. Puerto TCP y endpoint HTTP de cada servicio. Descubre `/health`,
   `/api/health`, `/api/v1/health` y cae a un endpoint conocido (`/api/docs` en
   las APIs Nest, `/` en el BFF).
4. Si Docker no está, valida solo los puertos (modo degradado, con `WARN`).

Salida: `0` si todo responde; `1` si algo crítico falla; `0` en `-DryRun`.

Automatización sugerida:

- **Windows:** Programador de tareas cada 2 minutos ejecutando
  `powershell -NoProfile -ExecutionPolicy Bypass -File C:\ruta\scripts\healthcheck.ps1`.
- **Linux:** unidad systemd timer o cron:
  `*/2 * * * * pwsh -NoProfile -File /opt/unisaas/scripts/healthcheck.ps1 || <alerta>`.
- El healthcheck no reinicia nada por sí solo; intégrelo con su sistema de
  alertas o con `pm2 restart <app>` ante fallos persistentes.

---

## 10. Backup y restauración

### 10.1 Backup

`deploy.ps1` y `reset-zero.ps1` respaldan con `pg_dump` formato custom. Si el
host no tiene cliente PostgreSQL, lo ejecutan dentro del contenedor y extraen
el archivo con `docker cp`.

Backup manual:

```powershell
docker exec postgres-saas pg_dump -U saas_admin -d saas_contable_db `
  --format=custom --compress=6 --file /tmp/manual.dump
docker cp postgres-saas:/tmp/manual.dump .\backups\manual.dump
docker exec postgres-saas rm -f /tmp/manual.dump
```

Política mínima sugerida:

- Un dump antes de cada deploy (automático).
- Retención diaria 14 días + semanal 8 semanas.
- Copia fuera del servidor (S3/Backblaze/almacenamiento cifrado).
- Prueba de restauración mensual.

Squad 8 ya tiene `squad8_devops_sre_qa-main/scripts/backup-restore.ps1`, que
hace `pg_dump`, valida el dump con `pg_restore --list` y ejecuta un **drill**
sobre una base temporal. Requiere cliente PostgreSQL en el host. Úselo para
ensayos de recuperación; no duplique esa lógica en otros scripts.

### 10.2 Restauración

Detenga las apps antes de restaurar (evita escrituras concurrentes):

```powershell
pm2 stop ecosystem.config.cjs
docker cp .\backups\<ts>\saas_contable_db_<ts>.dump postgres-saas:/tmp/rollback.dump
docker exec postgres-saas pg_restore -U saas_admin -d saas_contable_db `
  --clean --if-exists --no-owner /tmp/rollback.dump
docker exec postgres-saas rm -f /tmp/rollback.dump
pm2 start ecosystem.config.cjs --update-env
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1
```

`--clean --if-exists` elimina objetos existentes antes de recrearlos. Es una
restauración completa: cualquier dato escrito después del dump se pierde.
RPO = antigüedad del último dump. No hay WAL archiving / PITR configurado.

---

## 11. Reset a cero

```powershell
# 1) Ver qué se borraría (no modifica nada)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -DryRun

# 2) Ejecutar con confirmación explícita
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -ConfirmReset
# o modo interactivo: escriba BORRAR
```

Características:

- Respalda **antes** (obligatorio) en `backups/<timestamp>/`.
- Todo ocurre en **una transacción**: `TRUNCATE ... RESTART IDENTITY` de las
  tablas transaccionales y `COMMIT`. Si psql falla, no se aplica nada.
- Idempotente: repetirlo deja el mismo estado.
- Si hay apps PM2 online, se niega salvo `-AllowOnline` (evita bloqueos
  `ACCESS EXCLUSIVE` y escrituras durante la limpieza).
- `-KeepSequences` conserva la numeración de facturas/turnos
  (`tenant_sequences`). Por defecto se reinicia a 0.
- `-Cascade` añade `CASCADE` al TRUNCATE. Úselo solo si una tabla nueva crea
  una FK hacia las transaccionales.

### 11.1 Se vacía

`invoices`, `invoice_items`, `journal_entries`, `journal_entry_lines`,
`purchases`, `purchase_items`, `credit_transactions`, `pos_shifts`,
`inventory_movements`, `inventory_movement_lines`, `inventory_ledger_entries`,
`inventory_idempotency_keys`, `inventory_outbox_events`,
`inventory_audit_logs`, `inventory_transfers`, `inventory_transfer_lines`,
`stock_counts`, `stock_count_lines`, `inventory_balances`, `audit_logs` y
`idempotency_keys` (si existe).

### 11.2 Se conserva

`tenants`, `users`, `branches`, `warehouses`, `third_parties`, `products`,
`product_variants`, `product_barcodes`, `product_categories`,
`unit_of_measures`, `chart_of_accounts`.

Se preservan además `branches`, `warehouses`, `third_parties`,
`product_variants` y `product_barcodes` por ser datos maestros, aunque no
estaban en la lista mínima. Borrarlos rompería catálogos y cartera sin
necesidad.

### 11.3 Saldos de inventario

`inventory_balances` se vacía: el stock base queda en **0 unidades / 0 costo**,
coherente con un kardex (`inventory_ledger_entries`) también vacío. El POS
reconstruye saldos con los siguientes movimientos. No hay un “stock inicial”
que restaurar porque también se vaciaron las compras y movimientos que lo
originaron.

Reporte: `backups/<timestamp>/RESET_ZERO_<timestamp>.json` con conteos antes y
después.

---

## 12. Rollback

Cada deploy escribe `backups/<timestamp>/ROLLBACK.txt`. Contenido típico:

```text
1) pm2 stop ecosystem.config.cjs
2) docker cp "<dump>" postgres-saas:/tmp/unisaas_rollback.dump
   docker exec postgres-saas pg_restore -U saas_admin -d saas_contable_db \
     --clean --if-exists --no-owner /tmp/unisaas_rollback.dump
3) git checkout <sha>
4) reconstruir y pm2 start ecosystem.config.cjs --update-env
5) healthcheck
```

Decisión operativa:

- **Solo código, esquema compatible** → `git checkout <sha>`, rebuild y reload;
  no restaurar la base.
- **Esquema o datos corruptos** → detener apps y restaurar el dump.
- Si el árbol tenía cambios sin commitear, el commit no reproduce el estado;
  el dump y los logs del release son la única referencia fiable.

---

## 13. Logs y observabilidad

| Fuente | Cómo verlo |
|---|---|
| PM2 por app | `pm2 logs <app> --lines 200` |
| Archivos PM2 | `logs/<app>-out.log`, `logs/<app>-error.log` |
| Logs del release | `backups/<ts>/build-<app>.log` |
| PostgreSQL | `docker logs postgres-saas` |
| Redis | `docker logs redis-saas` |
| Stack de Squad 8 | `docker compose -f squad8_devops_sre_qa-main/docker-compose.yml logs -f` |
| Prometheus/Grafana | `http://<host>:9090`, `http://<host>:3005` (si están arriba) |

Recomendaciones:

- Rotación con `pm2-logrotate`.
- Alertas mínimas: healthcheck fallando, `pm2 status` con `errored`, uso de
  disco > 80 %, backup diario ausente.
- No registre tokens, contraseñas ni bodies con datos personales.

---

## 14. Dominio y TLS

### 14.1 Checklist de dominio

1. Registro DNS `A` (o `AAAA`) de `app.example.com` apuntando al servidor.
2. Firewall: 80/443 públicos; 3001-3007, 3100, 5432 y 6379 solo loopback o
   red privada.
3. Certificado TLS (Let's Encrypt/Certbot o el corporativo).
4. Proxy inverso con `X-Forwarded-Proto` y `X-Forwarded-Host`.
5. `CORS_ORIGINS` y `NEXT_PUBLIC_*` con el dominio final, **antes de construir**.
6. Verificar login real por HTTPS (ver 14.3).

> El `docker-compose.yml` publica PostgreSQL y Redis en `0.0.0.0`
> (`5432:5432`, `6379:6379`). En un servidor con IP pública, cámbielo a
> `127.0.0.1:5432:5432` / `127.0.0.1:6379:6379` o bloquéelos en el firewall.

### 14.2 Nginx de referencia

```nginx
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    client_max_body_size 10m;

    # BFF (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 300s;
    }

    # APIs internas expuestas solo por este proxy, bajo /svc/*
    location /svc/auth/       { proxy_pass http://127.0.0.1:3001/; include /etc/nginx/proxy_params; }
    location /svc/accounting/ { proxy_pass http://127.0.0.1:3002/; include /etc/nginx/proxy_params; }
    location /svc/inventory/  { proxy_pass http://127.0.0.1:3003/; include /etc/nginx/proxy_params; }
    location /svc/reports/    { proxy_pass http://127.0.0.1:3006/; include /etc/nginx/proxy_params; }
    location /svc/credits/    { proxy_pass http://127.0.0.1:3007/; include /etc/nginx/proxy_params; }
}
```

`proxy_params` debe incluir `X-Forwarded-Proto`, `X-Forwarded-Host` y
`X-Real-IP` para que el BFF reconstruya correctamente el origen publico.

### 14.3 Cookies y HTTPS

Las rutas `src/app/api/auth/login/route.ts`, `register` y `logout` usan el
helper `src/core/application/services/cookie-options.ts`, que lee
`COOKIE_SECURE` y `COOKIE_SAME_SITE`:

```ts
res.cookies.set('unisaas_session', token, buildSessionCookieOptions({ maxAge: 28800 }));
```

- `COOKIE_SECURE=true` (recomendado en produccion publica): el navegador no
  envia la cookie por HTTP. Publique siempre por `https://`.
- `COOKIE_SECURE=false`: permite operar por HTTP en una LAN
  (`http://192.168.1.10:3100`). No use este modo en una red no confiable.
- Si `COOKIE_SECURE` no esta definido, el helper usa `NODE_ENV`:
  `production` => `true`, cualquier otro => `false`.
- `COOKIE_SAME_SITE` acepta `lax` (por defecto), `strict` o `none`.
  `none` exige `COOKIE_SECURE=true`; sobre HTTP se degrada a `lax`.

`next.config.ts` ya envia HSTS, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy` y CSP. Con HTTP/LAN, HSTS no aplica.

---

## 15. Limitaciones y riesgos conocidos

Estos puntos son reales en el código actual. No se corrigieron para no invadir
la lógica de los squads en curso.

1. **TLS de PostgreSQL se controla con `DB_SSL` (resuelto).**
   S1 y S2 ya no fuerzan TLS por `NODE_ENV`. Con el PostgreSQL local de Docker
   (`ssl=off`) use `DB_SSL=false`; en un PostgreSQL gestionado con TLS use
   `DB_SSL=true` y `DB_SSL_REJECT_UNAUTHORIZED=true`.

2. **BFF de una sola instancia.** El rate-limit
   (`src/core/application/services/rate-limiter.ts`) y la idempotencia
   (`idempotency-store.ts`) viven en memoria. Con 2+ instancias, dos requests
   con la misma `Idempotency-Key` podrían duplicar una venta. Para escalar:
   mover ambos stores a Redis + sticky sessions. Por eso el ecosystem fija
   `instances: 1` y `exec_mode: fork`.

3. **Reinicio, no cero caídas.** PM2 en fork hace stop+start. `pm2 reload`
   reduce el gap pero no lo elimina. El BFF compila en el mismo directorio que
   sirve: `next build` puede dar 500 transitorios en rutas no cacheadas.
   Solución futura: releases en directorios versionados + symlink atómico.

4. **Puerto 3100 compartido con Loki.** `docker-compose.yml` publica Loki en
   3100. Deténgalo o muévalo antes de arrancar el BFF.

5. **`NEXT_PUBLIC_*` se hornea en build.** Cambiar `.env` y reiniciar no
   actualiza el bundle. Hay que reconstruir (`deploy.ps1` lo hace).

6. **Llamadas directas del navegador a S3/S7.** `posApiClient` usa
   `NEXT_PUBLIC_*_SERVICE_URL` desde componentes cliente. Esas rutas deben ser
   públicas (proxy `/svc/*`) o el POS pierde búsqueda de productos/clientes.
   Esto también implica que las APIs quedan expuestas (protegidas por JWT, pero
   expuestas).

7. **Base de datos única, sin PITR.** Un solo PostgreSQL; el RPO depende del
   último `pg_dump`. No hay replicación ni WAL archiving. Un fallo de disco
   entre backups implica pérdida de datos.

8. **Migraciones no atómicas si el archivo no trae transacción.** El runner no
   envuelve cada archivo en `-1` porque varios ya incluyen `BEGIN/COMMIT`.
   Convención: toda migración debe abrir y cerrar su propia transacción.

9. **Cobertura del runner de migraciones.** Solo detecta
   `squad*/scripts/migrations`, `squad*/sql` y `squad*/database/migrations`.
   `squad3/database/schema.sql`, los seeds de S2 y el bootstrap de S8 se
   aplican manualmente; una base nueva no queda completa solo con
   `deploy.ps1`.

10. **Windows y PM2 al reiniciar.** PM2 no se registra solo como servicio.
    Requiere `pm2-windows-startup` o una tarea programada con `pm2 resurrect`.

11. **Docker publica 5432/6379 en todas las interfaces.** En un host con IP
    pública es un riesgo. Restrinja a loopback o firewallee.

12. **Dependencias nativas.** `bcrypt` se instala desde binarios precompilados;
    en arquitecturas sin binario disponible requiere toolchain de compilación.

---

## 16. Runbook rápido

```powershell
# Estado
pm2 status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1

# Antes de desplegar
git status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DryRun -Strict

# Desplegar
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Si falla el healthcheck
Get-Content (Get-ChildItem backups\*\ROLLBACK.txt | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
pm2 logs squad4-web-pos --lines 200

# Ver último backup
Get-ChildItem backups -Directory | Sort-Object Name -Descending | Select-Object -First 3

# Reset de demo
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -ConfirmReset

# Rotar JWT (invalida sesiones): actualizar en S1/S3/S6/S7/BFF y
pm2 reload ecosystem.config.cjs --update-env
```

---

## 17. Verificación realizada en este entorno

Fecha: 2026-10-21. Host Windows, Node 24.15.0, PM2 7.0.3, Docker 29.8.2.

| Verificación | Resultado |
|---|---|
| Parser PowerShell (`_common`, `healthcheck`, `deploy`, `reset-zero`) | 0 errores |
| `node --check ecosystem.config.cjs` | OK |
| Carga del ecosystem (6 apps, fork, NODE_ENV=production, BFF 3100, S3 `dist/src/main.js`) | OK |
| `scripts/healthcheck.ps1` real | 19 checks OK, 0 FAIL, exit 0 |
| `scripts/healthcheck.ps1 -DryRun` | OK, exit 0 |
| `scripts/deploy.ps1 -DryRun` | Funciona; reporta 13 bloqueos reales del entorno de desarrollo |
| `scripts/reset-zero.ps1 -DryRun` | Funciona; muestra conteos y SQL, sin modificar datos |
| YAML de `.github/workflows/ci.yml` | Válido (4 jobs) |
| `docker compose config` (Squad 8, secretos dummy en memoria) | Válido; confirma Loki en 3100 y PostgreSQL/Redis publicados |
| Migraciones sobre base scratch aislada (aplicar + reaplicar) | S1, S3-schema y S4: exit 0 dos veces; S7: exit 0 dos veces. Base scratch eliminada al finalizar |
| Ledger `unisaas_schema_migrations` (INSERT + ON CONFLICT) | Una sola fila tras dos inserts |

Bloqueos que el dry-run reportó y que son **esperados** en este checkout de
desarrollo (no fallos del script):

- `.env` de cada squad en modo desarrollo (`NODE_ENV=development`).
- `JWT_SECRET` de desarrollo conocido en S1/S3/S6/S7/BFF.
- `NEXT_PUBLIC_USE_MOCKS=true` en el BFF.
- S2 + PostgreSQL con `ssl=off` (bloqueante real, ver limitación 1).
- Puertos 3001-3007 y 3100 ocupados por procesos Node **ajenos a PM2**
  (servidores de desarrollo ya iniciados). Deténgalos antes del deploy real.

No se ejecutó ningún deploy real, reset, build ni restauración. La validación
fue de sintaxis, carga de configuración, healthcheck de solo lectura y dry-runs.
