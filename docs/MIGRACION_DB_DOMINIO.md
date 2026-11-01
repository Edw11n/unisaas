# Migracion de base de datos y cambio de dominio

Runbook operativo para mover UniSaaS entre servidores, respaldar/restaurar
PostgreSQL y publicar la aplicacion en un dominio nuevo sin filtrar secretos.

> Alcance: infraestructura y configuracion. No modifica la logica de negocio de
> los squads. Los `.env` reales nunca se versionan (ver `.gitignore`).

---

## 1. Contrato de variables

Cada plantilla `.env.production.example` (raiz y squads) documenta las mismas
variables de infraestructura. Los valores reales se copian al `.env` de cada
squad; PM2 carga ese archivo al arrancar (`ecosystem.config.cjs`).

| Variable | Uso | Notas |
| --- | --- | --- |
| `DATABASE_URL` | Conexion PostgreSQL de las apps | Rol de minimo privilegio (`app_runtime`). URL-encode la contrasena si tiene `@ : / ? # % &`. |
| `DB_SSL` | TLS hacia PostgreSQL | `false` con el PostgreSQL local de Docker (`ssl=off`); `true` con un motor gestionado que exija TLS. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Validacion del certificado TLS | `true` por defecto; `false` solo con CA autofirmada controlada. |
| `REDIS_URL` | Cache/sesiones/colas | `redis://127.0.0.1:6379` en el compose local. |
| `JWT_SECRET` | Firma/validacion de tokens | Minimo 32 caracteres. El mismo valor en S1, S3, S6, S7 y el BFF. Rotarlo invalida todas las sesiones. |
| `COOKIE_SECURE` | Atributo `Secure` de cookies del BFF | `true` en HTTPS; `false` para HTTP/LAN. Si se omite: `NODE_ENV=production` => `true`. |
| `COOKIE_SAME_SITE` | Atributo `SameSite` | `lax` (defecto), `strict` o `none`. `none` exige `COOKIE_SECURE=true`. |
| `CORS_ORIGINS` | Origenes permitidos por las APIs | Esquema + host + puerto, sin barra final. No usar `*` en produccion. |
| `APP_URL` | Origen publico canonico | Alias estable para scripts y diagnostico. |
| `NEXT_PUBLIC_API_GATEWAY_URL` | URL publica del BFF | Se hornea en `next build`. |
| `NEXT_PUBLIC_*_SERVICE_URL` | Rutas publicas `/svc/*` por microservicio | Solo S4. Se hornean en `next build`. |
| `AUTH_SERVICE_URL` | Puente server-side del BFF hacia S1 | Loopback/red privada (`http://127.0.0.1:3001`), no el dominio publico. |
| `*_SERVICE_URL` | URLs internas entre microservicios | Loopback/red privada. No exponer en CORS. |
| `PUBLIC_HOST`, `PUBLIC_SCHEME` | Host/esquema publico en la raiz | Usados por TLS/proxy y documentacion. |
| `BACKUP_ROOT` | Destino de backups | Relativo a la raiz (`backups`). |

Reglas:

- No reutilizar secretos de desarrollo.
- Generar secretos con `openssl rand -base64 48` (o equivalente).
- No imprimir `.env` completos en consolas compartidas ni en tickets.
- Los dump contienen PII y datos de negocio: viven fuera de Git.

---

## 2. Requisitos

- Windows PowerShell 5.1+ o PowerShell 7+.
- Docker con el contenedor `postgres-saas` (modo por defecto), o cliente
  PostgreSQL (`pg_dump`, `pg_restore`, `psql`) en el PATH para `-UseHostTools`.
- Espacio libre suficiente para el dump y su restauracion (regla practica:
  al menos 2x el tamano de la base).
- `pg_dump`/`pg_restore` del mismo major o mas nuevos que el servidor. Un
  cliente mas viejo puede rechazar el dump.
- Variables de entorno definidas para el modo host (`PGPASSWORD`), nunca por
  parametro de linea de comandos.

---

## 3. Backup

### 3.1 Backup estandar (contenedor)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1 -Tag pre-migracion
```

Salida:

```text
backups/<timestamp>/<database>_<timestamp>[_tag].dump
backups/<timestamp>/<database>_<timestamp>[_tag].dump.sha256
backups/<timestamp>/<database>_<timestamp>[_tag].dump.manifest.json
```

El manifiesto incluye base, fecha, bytes, SHA256, commit Git y conteos por
tabla. No incluye credenciales.

### 3.2 Backup con cliente del host

```powershell
$env:PGPASSWORD = '<password-del-rol>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1 -UseHostTools -PgHost 127.0.0.1 -PgPort 5432
Remove-Item Env:PGPASSWORD
```

Si no hay `PGPASSWORD`, el script falla a proposito. No pase la contrasena por
parametro.

### 3.3 Verificacion y resguardo

- Confirme que el `.dump` no este vacio y que exista su `.sha256`.
- Copie el directorio completo a almacenamiento externo cifrado.
- Conserve al menos un backup anterior a la migracion y otro posterior.
- No borre los backups hasta validar el restore y el healthcheck.

---

## 4. Restore

### 4.1 Ensayo sin cambios

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath "backups\<timestamp>\<archivo>.dump" -DryRun
```

### 4.2 Base nueva (no existe)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath "backups\<timestamp>\<archivo>.dump"
```

El script crea la base, restaura, y compara tablas/conteos contra el manifiesto.
Pide escribir `RESTAURAR` antes de continuar.

### 4.3 Recrear una base existente (destructivo)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath "backups\<timestamp>\<archivo>.dump" -Force
```

- Sin `-Force` el script se niega a tocar una base existente.
- Con `-Force` recrea la base (DROP + CREATE) y restaura. Los datos actuales se
  pierden; el backup previo es la unica via de rollback.
- `-Yes` omite la confirmacion interactiva; uselo solo en automatizacion
  controlada.

### 4.4 Restore hacia otro servidor

1. Copie el `.dump`, `.sha256` y `.manifest.json` al servidor destino.
2. Verifique el checksum; el script lo hace si el sidecar esta junto al dump.
3. Ejecute `import-db.ps1` con la base destino.
4. Ajuste `DATABASE_URL`, `DB_SSL` y `REDIS_URL` del `.env` de cada squad.
5. Ejecute migraciones pendientes (seccion 5) y valide (seccion 8).

### 4.5 Modo host

```powershell
$env:PGPASSWORD = '<password-del-rol>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath "..." -UseHostTools -Force
Remove-Item Env:PGPASSWORD
```

### 4.6 Opciones utiles

| Parametro | Efecto |
| --- | --- |
| `-SkipChecksum` | Continua aunque el SHA256 no coincida. Solo tras verificacion manual. |
| `-AllowCountMismatch` | No falla por diferencias de conteo (dump tomado con escrituras concurrentes). |
| `-NoPrivileges` | Agrega `--no-acl`; util si el destino no tiene los mismos roles. |
| `-Owner <rol>` | Crea la base con un owner explicito. |

`pg_restore` se ejecuta con `--exit-on-error --no-owner`. Si falla, el script
termina con codigo distinto de cero y advierte que la base puede haber quedado
incompleta.

---

## 5. Migraciones despues del restore

El dump incluye la tabla `public.unisaas_schema_migrations`, el ledger que usa
`scripts/deploy.ps1` para saber que archivos ya se aplicaron.

Flujo recomendado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

`deploy.ps1` detecta archivos en:

- `squad*/scripts/migrations/*.sql`
- `squad*/sql/*.sql`
- `squad*/database/migrations/*.sql`

y aplica solo los pendientes. Opciones utiles:

- `-SkipMigrations`: no toca el esquema (el dump ya lo trae).
- `-BaselineMigrations`: registra los archivos como aplicados **sin ejecutarlos**.
  Solo para una base que ya tiene el esquema; nunca en una base nueva.
- `-SkipBuild`: aplica migraciones sin recompilar el BFF (seguir con el build
  aparte si cambiaron `NEXT_PUBLIC_*`).

Orden de referencia en una base vacia (solo si no usa el ledger):

1. `squad1_core_architecture_rls_rbac-main/scripts/init-db.sql` (esquema core).
2. `squad1_core_architecture_rls_rbac-main/scripts/02-security-hardening-runtime-role.sql`.
3. `squad1_core_architecture_rls_rbac-main/scripts/migrations/20261021_team_persistence.sql`.
4. `squad3_inventory_kardex_cpp-master/prisma/schema.prisma` con
   `npx prisma db push` (o `database/schema.sql` si el equipo usa el SQL consolidado).
5. `squad7_credits_purchases_suppliers-main/database/migrations/001_initial_schema.sql`.
6. Seeds de S2: `scripts/seed-puc-data.sql` y `scripts/seed-initial-setup.sql`.

No ejecute `squad2.../scripts/create-user-and-db.sql` en produccion: es un
bootstrap local con credenciales de ejemplo. Cree roles y base con el
procedimiento de infraestructura.

Para ejecutar un SQL manualmente en el contenedor:

```powershell
Get-Content -Raw ".\ruta\archivo.sql" | docker exec -i postgres-saas psql -U saas_admin -d saas_contable_db -v ON_ERROR_STOP=1
```

---

## 6. Cambio de dominio

### 6.1 Actualizar `.env`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-domain.ps1 -Domain app.example.com -Scheme https
```

HTTP/LAN:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-domain.ps1 -Domain 192.168.1.10:3100 -Scheme http -DryRun
```

Antes de escribir, el script muestra el diff por archivo y clave. Crea un
respaldo `<archivo>.<timestamp>.bak`. No toca `JWT_SECRET`, `DATABASE_URL`,
`REDIS_URL` ni contrasenas.

Claves actualizadas:

| Archivo | Claves |
| --- | --- |
| Raiz `.env` (si existe) | `APP_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `NEXT_PUBLIC_API_GATEWAY_URL`, `PUBLIC_HOST`, `PUBLIC_SCHEME`, `TLS_*` (si existen) |
| S1, S2, S3, S6, S7 | `APP_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `COOKIE_SAME_SITE` |
| S4 BFF/POS | Las anteriores + `NEXT_PUBLIC_API_GATEWAY_URL` y las cinco `NEXT_PUBLIC_*_SERVICE_URL` (`/svc/auth`, `/svc/accounting`, `/svc/inventory`, `/svc/reports`, `/svc/credits`) |

Notas:

- `COOKIE_SECURE` se deriva del esquema: `true` para HTTPS, `false` para HTTP.
- Si `COOKIE_SAME_SITE=none` y el esquema es HTTP, se degrada a `lax`.
- `-ExtraOrigins https://admin.example.com` agrega origenes adicionales a CORS.
- S5 (Flutter) no se modifica: sus URLs apuntan al emulador (`10.0.2.2`).
  Ajuste `AUTH_SERVICE_URL`, `INVENTORY_SERVICE_URL`, etc. manualmente si
  publica la app movil contra el dominio nuevo.
- `NEXT_PUBLIC_APP_URL` solo se actualiza si el `.env` ya la declara.

### 6.2 Rebuild obligatorio

`NEXT_PUBLIC_*` se hornea en `next build`. Cambiar `.env` y reiniciar PM2 **no**
actualiza el bundle. Despues de `set-domain.ps1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

o, si ya aplico migraciones:

```powershell
cd squad4_web_desktop_pos_nextjs-main
npm run build
```

y luego reinicie el BFF con el procedimiento habitual. `set-domain.ps1` no
reinicia PM2.

### 6.3 TLS y proxy

Checklist minimo:

1. DNS `A`/`AAAA` del dominio apuntando al servidor.
2. Firewall: 80/443 publicos; 3001-3007, 3100, 5432 y 6379 solo loopback o red
   privada.
3. Certificado vigente (Let's Encrypt/Certbot o corporativo).
4. Proxy inverso con `Host`, `X-Real-IP`, `X-Forwarded-For`,
   `X-Forwarded-Proto` y `X-Forwarded-Host`.
5. `CORS_ORIGINS` y `NEXT_PUBLIC_*` con el dominio final **antes** del build.
6. Login real por HTTPS.

Con HTTP/LAN no hay HSTS ni cookies `Secure`. Es un modo para redes internas
controladas, no para Internet.

---

## 7. Redis y sesiones

- Si cambia `JWT_SECRET`, todas las sesiones emitidas dejan de ser validas.
- Si mueve Redis, actualice `REDIS_URL` y reinicie los squads que lo usan.
- El BFF mantiene rate-limit e idempotencia en memoria; con una sola instancia
  no requiere Redis, pero el contrato se documenta para escalar.

---

## 8. Validacion posterior

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -Json
```

Validacion manual minima:

1. `GET /` del BFF responde 200 por el dominio nuevo.
2. Login con un usuario real responde 200.
3. La cookie de sesion aparece en el navegador con `HttpOnly` y el `Secure`
   esperado (`true` en HTTPS, ausente/false en HTTP/LAN).
4. Una lectura autenticada (por ejemplo, listado de productos) responde 200.
5. Una operacion de escritura controlada (venta de prueba o ajuste) responde
   correctamente y queda en el ledger/auditoria.
6. Logs sin errores de CORS, `401` masivos ni fallos de conexion a PostgreSQL.

Consultas utiles (sin credenciales en el comando):

```powershell
docker exec postgres-saas psql -U saas_admin -d saas_contable_db -c "SELECT count(*) FROM public.tenants;"
docker exec postgres-saas psql -U saas_admin -d saas_contable_db -c "SELECT filename, applied_at FROM public.unisaas_schema_migrations ORDER BY applied_at DESC LIMIT 10;"
```

---

## 9. Rollback

### 9.1 Rollback de dominio/configuracion

1. Restaure los `.env` desde los respaldos generados por `set-domain.ps1`
   (`<archivo>.<timestamp>.bak`).
2. Reconstruya el BFF (obligatorio si cambiaron `NEXT_PUBLIC_*`).
3. Reinicie los procesos con el procedimiento habitual.
4. Valide healthcheck y login.

### 9.2 Rollback de base de datos

1. Detenga escrituras (POS/API) o ponga el sistema en mantenimiento.
2. Restaure el ultimo backup valido:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath "backups\<timestamp>\<archivo>.dump" -Force
   ```

3. Si el rollback es por una migracion, revise el ledger
   `public.unisaas_schema_migrations` y aplique el SQL de reversa del squad
   correspondiente (si existe). No edite el ledger a mano sin respaldo.
4. Reconstruya/reinicie y valide.

### 9.3 Rollback de TLS

- Restaure el certificado y la configuracion anterior del proxy.
- Mantenga el dominio anterior resolviendo mientras propaga DNS.
- Verifique que `CORS_ORIGINS` y `NEXT_PUBLIC_*` correspondan al dominio activo.

---

## 10. Limitaciones y advertencias

- `import-db.ps1` recrea la base con `-Force`; no hace backup automatico antes
  del DROP. Ejecute `export-db.ps1` primero.
- El dump custom no es portable entre majors muy distintos de PostgreSQL sin
  usar el cliente adecuado. Use `pg_restore` del mismo major o superior.
- `--no-owner` deja los objetos a nombre del rol que restaura. Si el destino no
  tiene los roles `app_runtime`/`saas_admin`, use `-NoPrivileges` y revise las
  politicas RLS/grants antes de abrir trafico.
- Los conteos del manifiesto son una foto del momento del dump. Si hay
  escrituras concurrentes, use `-AllowCountMismatch` tras verificar el caso.
- S2 lee `DB_SSL` y `DB_SSL_REJECT_UNAUTHORIZED` (no `NODE_ENV`). Con el
  PostgreSQL local de Docker use `DB_SSL=false`; con un motor gestionado use
  `DB_SSL=true` y validacion de certificado segun el proveedor.
- S5 (Flutter) requiere ajuste manual de URLs para produccion.
- El script `squad2.../scripts/create-user-and-db.sql` contiene credenciales de
  ejemplo; no usarlo en produccion.
- `set-domain.ps1` no reinicia PM2 ni reconstruye el BFF; esas acciones son
  deliberadamente manuales.
