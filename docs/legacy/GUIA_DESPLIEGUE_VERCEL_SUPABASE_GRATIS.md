# GUIA DE AUDITORIA Y DESPLIEGUE EN VERCEL Y SUPABASE ($0.00 USD/MES)
# PROYECTO: UNISAAS - SISTEMA DE PUNTO DE VENTA Y GESTION MULTI-TENANT

Documento de auditoria de motores, seguridad, conectividad serverless y despliegue en produccion a costo cero.

---

## 1. AUDITORIA ARQUITECTONICA DE MOTORES Y COMPONENTES

### 1.1 Motor Frontend y BFF: Next.js 15 en Vercel Serverless
- **Runtime:** Node.js 18+ en funciones serverless efimeras de Vercel.
- **Rutas compiladas:** 49 paginas y endpoints (Static Prerendered + Dynamic Serverless).
- **Manejo de Ciclo de Vida:** Las conexiones a bases de datos no son persistentes entre lambdas individuales. Por ende, el pool de conexiones en `pos-shifts-db.ts` fue configurado con limite estricto (`DATABASE_MAX_POOL=3`) y tiempo de inactividad de 15 segundos para no agotar los descriptores de sockets.
- **Deteccion SSL Automatica:** El driver `pg.Pool` detecta automaticamente dominios cloud (`*.supabase.co`, `*.pooler.supabase.com`, `*.neon.tech`) e inyecta `{ rejectUnauthorized: false }` para evitar errores de handshake SSL con certificados intermedios de Vercel.

### 1.2 Motor de Persistencia: Supabase (PostgreSQL 16 + Supavisor)
- **Version:** PostgreSQL 16.
- **Pooler:** Supavisor en modo transaccion (puerto 6543). Permite que cientos de ejecuciones concurrentes de Next.js Serverless compartan un numero reducido de conexiones fisicas a la base de datos sin generar errores de tipo `remaining connection slots are reserved for non-replication superuser connections`.
- **Aislamiento Multi-Tenant:** Toda tabla sensible (`products`, `invoices`, `users`, `pos_shifts`, `inventory_movements`, etc.) cuenta con Row Level Security (RLS) forzado a nivel de base de datos (`FORCE ROW LEVEL SECURITY`). Las consultas se aíslan mediante la variable de sesión `app.current_tenant_id` fijada en cada transacción.
- **Aprovisionamiento Atomico:** Se incluye la función con privilegios `SECURITY DEFINER` denominada `platform_provision_tenant`, la cual crea la empresa, sucursal, bodega, usuario OWNER y ejecuta el bootstrap contable del PUC sin requerir daemons externos.

### 1.3 Seguridad y Cero Dependencias Externas (Anti-Lock-in)
- **Autenticacion:** Bcrypt nativo implementado mediante `bcryptjs` en el servidor Next.js. Si el microservicio central de autenticacion (Squad 1 NestJS) no esta desplegado, la API de Next.js en Vercel asume el rol de autenticador directo de forma transparente contra las tablas `platform_admins` y `users`.
- **Tokens de Sesion:** Firma de JSON Web Tokens (JWT) mediante algoritmo HS256 utilizando secreto simetrico `JWT_SECRET`. Se emiten cookies de sesion HTTP-only, SameSite Strict y Secure.
- **Garantia de No Dependencia de Proveedor (Zero Lock-in):** La aplicacion no utiliza SDKs privativos de Supabase (no usa `@supabase/supabase-js` ni `supabase-auth`). Utiliza el protocolo abierto estandar de PostgreSQL (`pg`). Esto garantiza que la base de datos puede migrarse en cualquier momento a Neon, Railway, Docker local, un VPS Linux o AWS RDS simplemente cambiando la variable `DATABASE_URL`, sin modificar una sola linea de codigo.

---

## 2. REQUISITOS PREVIOS

1. Cuenta gratuita en [Supabase](https://supabase.com).
2. Cuenta gratuita en [Vercel](https://vercel.com) conectada a la cuenta de GitHub `AndersonMoncayo`.
3. Repositorio en GitHub: `https://github.com/AndersonMoncayo/unisaas.git`.

---

## 3. PASO A PASO: PROVISIONAMIENTO EN SUPABASE ($0.00 USD)

### Paso 3.1: Crear el Proyecto en Supabase
1. Iniciar sesion en [supabase.com](https://supabase.com) y hacer clic en **New Project**.
2. Seleccionar la organizacion deseada.
3. Ingresar los datos basicos:
   - **Name:** `unisaas-db`
   - **Database Password:** Crear una contrasena segura y guardarla en un bloc de notas seguro (ej. `UniSaas2026_SecureDb!`).
   - **Region:** Seleccionar la region mas cercana a los usuarios (ej. `East US (North Virginia) - us-east-1` o `South America (Sao Paulo) - sa-east-1`).
   - **Pricing Plan:** Free ($0.00/month).
4. Hacer clic en **Create new project** y esperar 2 minutos hasta que el aprovisionamiento finalice.

### Paso 3.2: Ejecutar el Dump Inicial en el SQL Editor
1. En el panel lateral izquierdo de Supabase, hacer clic en el icono **SQL Editor** (icono con forma de terminal/codigo).
2. Hacer clic en **New query**.
3. Abrir en un editor de texto el archivo del repositorio:
   `squad8_devops_sre_qa-main/scripts/unisaas_supabase_init.sql`
4. Seleccionar todo su contenido (`Ctrl + A`) y copiarlo (`Ctrl + C`).
5. Pegar el script completo dentro del SQL Editor de Supabase.
6. Hacer clic en el boton verde **Run** (o presionar `Ctrl + Enter`).
7. El editor ejecutara la creacion de esquemas, tablas, indices, politicas RLS, planes iniciales y funciones de aprovisionamiento.
8. Verificar que el resultado sea `Success. No rows returned`.

---

## 4. PASO A PASO: OBTENER CADENA DE CONEXION SUPAVISOR (PUERTO 6543)

Para entornos serverless en la nube, es mandatorio utilizar el pooler de transacciones:

1. En el panel de Supabase, ir a **Project Settings** (icono de engranaje abajo a la izquierda).
2. Seleccionar la seccion **Database**.
3. Desplazarse hacia abajo hasta la tarjeta **Connection string**.
4. Seleccionar la pestana **URI**.
5. En el menu desplegable **Mode**, seleccionar estrictamente: **Transaction** (Puerto 6543).
6. Copiar la URI generada, la cual tiene la siguiente estructura:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
   ```
7. Reemplazar `[YOUR-PASSWORD]` por la contrasena maestra creada en el Paso 3.1.
8. Guardar esta cadena para el siguiente paso.

---

## 5. PASO A PASO: DESPLIEGUE EN VERCEL ($0.00 USD)

### Paso 5.1: Importar el Proyecto en Vercel
1. Iniciar sesion en [vercel.com](https://vercel.com).
2. En el Dashboard, hacer clic en el boton **Add New...** y luego en **Project**.
3. En la lista de repositorios de GitHub, buscar `unisaas` y hacer clic en **Import**.

### Paso 5.2: Configurar Root Directory
UniSaaS esta estructurado en arquitectura monorepo modular. El cliente web y servidor BFF se encuentran en el squad 4:
1. En la seccion **Root Directory**, hacer clic en el boton **Edit**.
2. Seleccionar la carpeta:
   ```text
   squad4_web_desktop_pos_nextjs-main
   ```
3. Hacer clic en **Continue**.

### Paso 5.3: Configurar Variables de Entorno (Environment Variables)
Desplegar la seccion **Environment Variables** y agregar las siguientes claves:

| Variable | Valor Recomendado | Descripcion |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require` | Cadena Supavisor Transaction Pooler puerto 6543 |
| `DATABASE_MAX_POOL` | `3` | Limite de conexiones concurrentes por funcion serverless |
| `JWT_SECRET` | `unisaas_prod_jwt_super_secret_key_2026_enterprise_xyz` | Clave simetrica para firma de tokens de sesion (minimo 32 caracteres) |
| `NODE_ENV` | `production` | Modo de produccion optimizado |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | Desactiva mocks para operar contra PostgreSQL real |
| `TRUST_PROXY` | `true` | Habilita lectura de IPs reales detras de proxies Vercel |

### Paso 5.4: Desplegar
1. Hacer clic en **Deploy**.
2. Vercel ejecutara la instalacion de dependencias (`npm install`), validacion de TypeScript (`tsc`) y compilacion de produccion (`next build`).
3. Al finalizar, Vercel proporcionara una URL publica del estilo:
   `https://squad4-web-desktop-pos-nextjs-main.vercel.app` (o su dominio personalizado).

---

## 6. VERIFICACION OPERATIVA DEL SISTEMA

### 6.1 Acceso de Superadministrador Global
1. Abrir la URL publica generada por Vercel.
2. Ingresar a `/login`.
3. Credenciales de plataforma master:
   - **Correo:** `superadmin@unisaas.com`
   - **Contrasena:** `SuperAdmin2026*!`
4. El sistema autenticara directamente contra la tabla `platform_admins` en Supabase y abrira el panel `/platform-admin`, permitiendo gestionar tenants, planes y auditorias.

### 6.2 Registro de un Nuevo Comercio (Multi-Tenant)
1. Abrir `/register` en el navegador.
2. Diligenciar los datos de la empresa (Razon Social, NIT, Categoria comercial, Ciudad) y los datos del propietario (Nombre, Correo, Contrasena).
3. Aceptar la autorizacion de Habeas Data (Ley 1581 de 2012).
4. Hacer clic en **Crear Cuenta y Comenzar**.
5. El sistema invocara `platform_provision_tenant` en Supabase:
   - Creara el registro de empresa en `tenants`.
   - Creara la sede principal en `branches`.
   - Creara la bodega principal en `warehouses`.
   - Creara el usuario OWNER en `users`.
   - Inicializara el Plan de Cuentas Contables (PUC) y las Unidades de Medida canonicas.
   - Iniciara sesion automaticamente y redirigira a `/admin`.

### 6.3 Punto de Venta de Mostrador (POS)
1. Ingresar a `/pos`.
2. Abrir turno de caja con base inicial (ej. $50,000 COP).
3. Realizar ventas, agregar productos, emitir recibos y cerrar turno con cuadre de caja automatico en `pos_shifts`.

---

## 7. AUTOMATIZACION ANTI-PAUSA DE SUPABASE (TIER GRATUITO)

El tier gratuito de Supabase pausa las bases de datos que no registran actividad durante 7 dias consecutivos. Para evitar que la base de datos se duerma sin costo alguno, el proyecto incluye un flujo automatizado de GitHub Actions.

### 7.1 Activar el Flujo en GitHub
1. Ir al repositorio en GitHub: `https://github.com/AndersonMoncayo/unisaas`.
2. Entrar a **Settings** -> **Secrets and variables** -> **Actions**.
3. Hacer clic en **New repository secret**.
4. Configurar el secreto:
   - **Name:** `UNISAAS_VERCEL_URL`
   - **Secret:** La URL publica asignada por Vercel (ej. `https://unisaas-pos.vercel.app`).
5. El flujo `.github/workflows/keep-supabase-alive.yml` se ejecutara automaticamente tres veces por semana (lunes, miercoles y viernes a las 04:00 UTC).
6. Cada ejecucion realiza una peticion HTTP a `/api/health`, la cual ejecuta un `SELECT 1 AS alive` contra Supabase, manteniendo la base de datos activa permanentemente sin intervencion manual.

---

## 8. MATRIZ DE PORTABILIDAD Y RETORNO (CERO BLOQUEO)

Si en el futuro se desea regresar a ejecucion local o migrar a otro proveedor:

| Escenario | Accion Requerida | Tiempo Estimado |
| :--- | :--- | :--- |
| **Retorno a Docker local** | Ejecutar `.\iniciar-unisaas.ps1` en la consola local | 30 segundos |
| **Migracion a VPS propio** | Levantar Docker con `docker-compose.yml` y restaurar el dump SQL | 5 minutos |
| **Migracion a Neon** | Crear base de datos en Neon, correr el SQL dump y cambiar `DATABASE_URL` | 3 minutos |
| **Migracion a Railway** | Crear servicio PostgreSQL en Railway y actualizar `DATABASE_URL` en Vercel | 3 minutos |
| **Migracion a AWS RDS** | Crear instancia PostgreSQL RDS, correr el SQL dump y enlazar `DATABASE_URL` | 10 minutos |

Zero lineas de codigo deben reescribirse.
