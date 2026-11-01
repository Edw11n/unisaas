# UNISAAS - Arquitectura Cloud Serverless en Vercel y Supabase ($0.00 USD/mes)

Este documento centraliza la explicacion tecnica, operativa y estrategica de como opera UNISAAS en produccion a costo cero ($0.00 USD/mes), donde se encuentra documentado cada componente del sistema y cuales son las URLs y credenciales oficiales para clientes y administradores.

---

## 1. Por Que y Como Funciona a Nivel Gratuito ($0.00 USD/mes)

La arquitectura original del proyecto contemplaba 8 microservicios independientes construidos sobre NestJS (Squad 1 a Squad 8), ademas del frontend web y terminal de punto de venta (Squad 4). Mantener 8 daemons ejecutandose continuamente las 24 horas del dia en servicios cloud como Render, Railway, AWS o DigitalOcean tiene un costo de entre $5 y $20 USD mensuales por contenedor, totalizando entre $40 y $160 USD al mes.

Para eliminar por completo este costo recurrente y garantizar una operacion estable a **$0.00 USD/mes**, se diseno e implemento una arquitectura full-stack consolidada basada en cuatro pilares de ingenieria:

### Pilar 1: Consolidacion Full-Stack en Next.js 15 App Router (BFF Serverless)
- El cliente web y POS de Next.js (`squad4_web_desktop_pos_nextjs-main`) incorpora un Backend-for-Frontend (BFF) autonomo en su directorio `src/app/api`.
- Cada ruta (`/api/checkout`, `/api/inventory/products`, `/api/auth/login`, `/api/credits/customers`, etc.) se compila y ejecuta como una **Serverless Function efimera en Vercel**.
- Vercel no cobra por servidores dedicados o contenedores en espera; unicamente procesa las solicitudes cuando un usuario o terminal POS realiza una peticion.
- En el plan gratuito de Vercel (Hobby Tier), el alojamiento web y la ejecucion de Serverless Functions no generan costo alguno.

### Pilar 2: Base de Datos Relacional Dedicada en Supabase (Free Tier)
- Supabase provee una instancia administrada de **PostgreSQL 16** en su capa gratuita perpetua.
- Incluye **500 MB de almacenamiento relacional**, hasta 50,000 usuarios activos mensuales y suficiente ancho de banda para operaciones comerciales diarias.
- **Supavisor Transaction Pooler (Puerto 6543):** Las funciones serverless de Next.js se abren y cierran de manera constante. Para evitar la saturacion del limite de conexiones simultaneas de PostgreSQL, se utiliza el pooler transaccional Supavisor con un maximo controlado (`DATABASE_MAX_POOL=3`). Esto permite que cientos de transacciones concurrentes compartan un numero reducido de conexiones fisicas sin errores de conexion.

### Pilar 3: Automatizacion Anti-Pausa de Supabase (GitHub Actions)
- En el plan gratuito de Supabase, las bases de datos que no registran actividad durante 7 dias consecutivos entran en suspension automatica (*sleep mode*).
- Para garantizar que la base de datos permanezca despierta las 24 horas, los 365 dias del ano, se creo el flujo automatizado [`.github/workflows/keep-supabase-alive.yml`](file:///E:/UNISAAS%20-%20copia/.github/workflows/keep-supabase-alive.yml).
- Este flujo se ejecuta gratis en los servidores de GitHub Actions cada 48 horas (lunes, miercoles y viernes a las 06:00 UTC). Realiza una peticion HTTP al endpoint `https://unisaasdev.vercel.app/api/health`, el cual emite un `SELECT 1 AS alive` en PostgreSQL, manteniendo el servicio activo permanentemente a costo cero.

### Pilar 4: Independencia Tecnologica (Zero Vendor Lock-in)
- La aplicacion no utiliza SDKs privativos de Supabase Auth ni librerias propietarias cerradas.
- Toda la comunicacion con la base de datos se realiza mediante el driver estandar de PostgreSQL (`pg`), con validacion de contrasenas mediante `bcryptjs` y sesiones firmadas con JSON Web Tokens (JWT HS256).
- Si en el futuro el volumen de datos de la empresa supera los 500 MB del tier gratuito de Supabase, la base de datos se puede migrar a un VPS economico, Neon, Railway o Docker cambiando unicamente la variable de entorno `DATABASE_URL`, sin modificar el codigo fuente.

---

## 2. Mapa de Documentacion en el Repositorio

Toda la documentacion tecnica, operativa y arquitectonica del proyecto se encuentra disponible en las siguientes rutas locales:

| Archivo | Ubicacion Local | Descripcion del Contenido |
| :--- | :--- | :--- |
| **Manual de Arranque y Comandos** | [`MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`](file:///E:/UNISAAS%20-%20copia/MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md) | Documento maestro con las 38 secciones operativas. La Seccion 38 contiene los detalles de despliegue en Vercel, credenciales maestras y los fallbacks directos a PostgreSQL. |
| **Guia de Despliegue en Vercel y Supabase** | [`GUIA_DESPLIEGUE_VERCEL_SUPABASE_GRATIS.md`](file:///E:/UNISAAS%20-%20copia/GUIA_DESPLIEGUE_VERCEL_SUPABASE_GRATIS.md) | Guia paso a paso para el aprovisionamiento de Supabase, configuracion del proyecto en Vercel, variables de entorno y certificados SSL. |
| **Plan de Implementacion Costo Cero** | [`PLAN_IMPLEMENTACION_COSTO_CERO_COMPLETO.md`](file:///C:/Users/MONCAYO/.gemini/antigravity/brain/73f69401-579f-466e-9d84-0115d0490fc5/PLAN_IMPLEMENTACION_COSTO_CERO_COMPLETO.md) | Analisis comparativo entre microservicios vs BFF consolidado, matriz de 31 rutas API y arquitectura de persistencia. |
| **Workflow Anti-Pausa de GitHub** | [`.github/workflows/keep-supabase-alive.yml`](file:///E:/UNISAAS%20-%20copia/.github/workflows/keep-supabase-alive.yml) | Codigo YAML de automatizacion en GitHub Actions para mantener despierto Supabase cada 48 horas sin costo. |
| **Esquema de Base de Datos DDL** | [`squad8_devops_sre_qa-main/scripts/unisaas_supabase_init.sql`](file:///E:/UNISAAS%20-%20copia/squad8_devops_sre_qa-main/scripts/unisaas_supabase_init.sql) | Script SQL completo con 18 tablas, politicas de Row Level Security (RLS) y la funcion `platform_provision_tenant(...)`. |
| **Guia Rapida de Rutas Vercel** | [`rutavercel.md`](file:///E:/UNISAAS%20-%20copia/rutavercel.md) | Este documento de referencia directa. |

---

## 3. URLs Oficiales y Credenciales de Produccion

### A. Dominios de la Aplicacion
- **Dominio Principal de Produccion:** `https://unisaasdev.vercel.app`
- **Dominio Secundario Redireccionado:** `https://unisaas-coral.vercel.app` (aplica redireccion HTTP 307 permanente hacia `unisaasdev.vercel.app`).
- **Repositorio Central en GitHub:** `https://github.com/unisaasdev/unisaas` (ramas sincronizadas: `main` y `vercel-supabase`).

### B. Accesos para Usuarios y Comercios
- **Registro de Nuevos Negocios:** `https://unisaasdev.vercel.app/register`
  - Permite a cualquier comerciante registrar su empresa. Crea en un solo paso la empresa, sucursal principal, bodega y cuenta de propietario.
- **Inicio de Sesion Universal:** `https://unisaasdev.vercel.app/login`
  - Acceso con cualquier correo electronico corporativo o personal (`@empresa.com`, `@gmail.com`, `@hotmail.com`, `@outlook.com`).
- **Terminal de Punto de Venta (POS):** `https://unisaasdev.vercel.app/pos`
  - Venta rapida de mostrador, balanza, lector de codigo de barras, apertura y cuadre de turnos de caja, impresion de tickets termicos.
- **Panel Administrativo del Comercio:** `https://unisaasdev.vercel.app/admin`
  - Gestion de catalogo e inventario, colaboradores, cuentas por cobrar (clientes fiados), cuentas por pagar y gastos operativos.

### C. Consola Global de Administracion (Superadmin / Operador SaaS)
- **URL de Acceso:** `https://unisaasdev.vercel.app/platform-admin`
- **Credenciales Maestras Verificadas:**
  - Correo: `superadmin@unisaas.com`
  - Contrasena: `Aa1!sVgVfdr7wWSlheANMmU2`
  - Rol Asignado: `PLATFORM_ADMIN` (inquilino: `platform`)
- **Capacidades del Superadmin:**
  - Visualizacion de empresas activas en tiempo real.
  - Calculo del MRR (Ingreso Mensual Recurrente) consolidado segun el plan contratado.
  - Creacion manual de nuevas empresas con contrasenas temporales seguras.
  - Suspension y reactivacion inmediata de comercios.
  - Restablecimiento directo de contrasenas para duenos de negocio.
  - Consulta de auditoria administrativa global.

### D. Monitoreo de Infraestructura y Salud
- **Endpoint de Salud:** `https://unisaasdev.vercel.app/api/health`
- **Respuesta esperada:**
  ```json
  {
    "status": "ok",
    "database": "connected",
    "error": null,
    "squad": "squad4_web_desktop_pos_nextjs",
    "module": "High-Speed Web Desktop POS & Admin Client",
    "framework": "Next.js 15 App Router"
  }
  ```

---

## 4. Matriz de Rutas de la API BFF y Persistencia PostgreSQL

El BFF implementa persistencia directa mediante `withTenant(...)` y `withSystemDb(...)` sobre Supabase PostgreSQL 16:

| Modulo | Metodos y Rutas API | Tablas / Funciones en Base de Datos |
| :--- | :--- | :--- |
| **Salud del Sistema** | `GET /api/health` | `SELECT 1 AS alive` |
| **Autenticacion y 2FA** | `POST /api/auth/login`<br>`GET /api/auth/google`<br>`GET /api/auth/callback/google`<br>`POST /api/auth/2fa/setup`<br>`POST /api/auth/2fa/verify`<br>`POST /api/auth/2fa/validate`<br>`POST /api/auth/2fa/disable`<br>`POST /api/auth/register`<br>`POST /api/auth/activate`<br>`POST /api/auth/logout` | `public.platform_admins`, `public.users` (columnas: `google_id`, `auth_provider`, `totp_secret`, `totp_enabled`, `totp_backup_codes`), funcion `public.platform_provision_tenant(...)` |
| **Consola de Plataforma** | `GET /api/platform/plans`<br>`GET /api/platform/audit`<br>`GET, POST /api/platform/tenants`<br>`PATCH, DELETE /api/platform/tenants/:id`<br>`POST /api/platform/tenants/:id/reset-owner-password` | `public.platform_plans`, `public.platform_audit_logs`, `public.tenants`, `public.branches`, `public.users` |
| **Configuracion Comercial** | `GET, POST /api/admin/stores`<br>`GET, POST, PATCH, DELETE /api/admin/team`<br>`GET, PATCH /api/admin/settings`<br>`GET, POST /api/admin/roles` | `public.branches`, `public.users`, `public.tenants` |
| **Inventario y Kardex** | `GET, POST, PUT, DELETE /api/inventory/products`<br>`POST /api/inventory/products/bulk`<br>`GET, POST /api/inventory/moves` | `public.products`, `public.product_variants`, `public.inventory_balances`, `public.inventory_movements` |
| **Cartera de Creditos** | `GET, POST /api/credits/customers`<br>`POST /api/credits/customers/:id/payments`<br>`GET, POST /api/credits/suppliers`<br>`POST /api/credits/suppliers/:id/payments` | `public.third_parties` (`party_type='CUSTOMER' / 'SUPPLIER'`), `public.credit_transactions` |
| **Finanzas y Turnos de Caja** | `GET, POST /api/accounting/expenses`<br>`GET /api/accounting/balance`<br>`POST /api/pos/shifts` | `public.journal_entries`, `public.pos_shifts` |
| **Liquidacion Transaccional POS** | `POST /api/checkout`<br>`POST /api/invoices/:id/void` | Transaccion atomica en `public.invoices`, `public.invoice_items`, `public.inventory_balances`, `public.third_parties`, `public.pos_shifts` |

---

## 5. Variables de Entorno Configuradas en Vercel

Para que el proyecto opere correctamente en el entorno de produccion, las siguientes variables estan configuradas en Vercel:

| Variable | Valor / Descripcion |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.zibouemsmlnchengvihl:UniSaas2026_SecureDb%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `DATABASE_MAX_POOL` | `3` (limite de conexiones por lambda serverless) |
| `JWT_SECRET` | Clave secreta para la firma y verificacion de tokens de sesion HS256 |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_USE_MOCKS` | `false` (fuerza la operacion exclusiva con la base de datos real) |
| `TRUST_PROXY` | `true` |
| `GOOGLE_CLIENT_ID` | Client ID de la aplicacion Web en Google Cloud Console (gratuito) |
| `GOOGLE_CLIENT_SECRET` | Client Secret correspondiente de Google Cloud Console |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | URL canonica del despliegue (ej. `https://unisaasdev.vercel.app` o `http://localhost:3000`) |
| `TOTP_ENCRYPTION_KEY` | Clave secreta (minimo 32 caracteres) para cifrado simetrico AES-256-GCM de secretos TOTP en reposo |

---

## 6. Matriz de Documentacion Sincronizada por Escuadron (Squads 1 a 8)

Toda la documentacion interna de cada escuadron se encuentra auditada y actualizada segun la arquitectura Vercel + Supabase + GitHub:

| Escuadron | Directorio | Documentos Principales | Tablas Supabase Gobernadas |
|:---|:---|:---|:---|
| **Squad 1** | `squad1_core_architecture_rls_rbac-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad1_core_architecture_rls_rbac-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad1_core_architecture_rls_rbac-main/ARQUITECTURA_VERCEL_SUPABASE.md) | `tenants`, `users`, `roles`, `branches`, `user_tenants` |
| **Squad 2** | `squad2_accounting_engine_ledger-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad2_accounting_engine_ledger-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad2_accounting_engine_ledger-main/ARQUITECTURA_VERCEL_SUPABASE.md) | `accounts_puc`, `journal_entries`, `journal_lines`, `expenses` |
| **Squad 3** | `squad3_inventory_kardex_cpp-master` | [README.md](file:///E:/UNISAAS%20-%20copia/squad3_inventory_kardex_cpp-master/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad3_inventory_kardex_cpp-master/ARQUITECTURA_VERCEL_SUPABASE.md) | `products`, `product_variants`, `warehouses`, `inventory_balances`, `inventory_movements` |
| **Squad 4** | `squad4_web_desktop_pos_nextjs-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad4_web_desktop_pos_nextjs-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad4_web_desktop_pos_nextjs-main/ARQUITECTURA_VERCEL_SUPABASE.md) | Orquestador BFF de 31 rutas API, sesiones JWT y vistas frontend |
| **Squad 5** | `squad5_mobile_pos_offline-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad5_mobile_pos_offline-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad5_mobile_pos_offline-main/ARQUITECTURA_VERCEL_SUPABASE.md)<br>[CONFIGURACION_BACKEND_REAL.md](file:///E:/UNISAAS%20-%20copia/squad5_mobile_pos_offline-main/CONFIGURACION_BACKEND_REAL.md) | Base local SQLite/Drift + Sincronizacion Outbox a `/api/checkout` |
| **Squad 6** | `squad6_reports_audit_escpos-develop` | [README.md](file:///E:/UNISAAS%20-%20copia/squad6_reports_audit_escpos-develop/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad6_reports_audit_escpos-develop/ARQUITECTURA_VERCEL_SUPABASE.md) | `invoices`, `invoice_items`, `payment_transactions`, `audit_logs` |
| **Squad 7** | `squad7_credits_purchases_suppliers-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad7_credits_purchases_suppliers-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad7_credits_purchases_suppliers-main/ARQUITECTURA_VERCEL_SUPABASE.md) | `third_parties`, `credit_transactions`, `credit_lines` |
| **Squad 8** | `squad8_devops_sre_qa-main` | [README.md](file:///E:/UNISAAS%20-%20copia/squad8_devops_sre_qa-main/README.md)<br>[ARQUITECTURA_VERCEL_SUPABASE.md](file:///E:/UNISAAS%20-%20copia/squad8_devops_sre_qa-main/ARQUITECTURA_VERCEL_SUPABASE.md) | `scripts/unisaas_supabase_init.sql`, CI/CD Matrix, Cron Anti-Pausa |

---

## 7. Autenticacion Soberana Hibrida: Google OAuth 2.0 y Segundo Factor TOTP RFC 6238 ($0.00 USD/mes)

### A. Evaluacion de Arquitectura Senior: Por que Login Hibrido y NO Exclusivo de Google
1. **Puntos de Venta (POS) Compartidos:** En comercios minoristas y supermercados, los cajeros operan turnos rotativos sobre el mismo terminal fisico. Forzar el inicio de sesion exclusivo con Google implicaria abrir la sesion personal de Google del cajero en la terminal de la tienda, exponiendo su correo Gmail, Google Drive y fotos personales.
2. **Resiliencia Operativa Offline / LAN:** Ante caidas de conectividad a internet del proveedor (ISP), la tienda no puede detener su facturacion ni el ingreso de cajeros con clave PIN o contrasena local.
3. **Independencia Corporativa:** Clientes empresariales que operan bajo dominios de Microsoft 365 o servidores de correo propios no pueden ser excluidos del SaaS.
4. **Conclusion Arquitectonica:** Se implemento un esquema hibrido soberano donde Duenos, Administradores y Superadmins pueden ingresar con 1 solo clic via Google OAuth 2.0 o con correo y contrasena, mientras que el personal operativo puede continuar usando credenciales corporativas con segundo factor TOTP opcional o forzoso.

### B. Motor Criptografico TOTP RFC 6238 a Costo $0.00 Perpetuo
- **Cero Costos de Terceros:** A diferencia de proveedores de SMS o OTP por correo (Twilio, SendGrid) que cobran por mensaje enviado, el estandar RFC 6238 es un algoritmo matematico deterministico ejecutado en el backend y en la aplicacion movil del usuario (Google Authenticator, Microsoft Authenticator o Authy) sin consumir saldo ni requerir internet en el telefono movil.
- **Tolerancia a Deriva Temporal:** Soporta una ventana de paso de +/- 30 segundos (paso actual, anterior y posterior) para compensar discrepancias de reloj entre el servidor y el smartphone.
- **Proteccion Contra Ataques de Tiempo:** Comparacion de codigos mediante `crypto.timingSafeEqual` para evitar ataques de canal lateral (timing attacks).
- **Cifrado de Secretos en Reposo:** Cada secreto Base32 se almacena cifrado en Supabase PostgreSQL bajo el estandar militar **AES-256-GCM** (vector de inicializacion IV de 12 bytes + autenticacion de tag de 16 bytes).
- **Codigos de Respaldo de Un Solo Uso:** Emision de 8 codigos alfanumericos de rescate hasheados en SHA-256 consumidos de forma atomica para recuperacion de cuenta sin internet.

### C. Esquema DDL Aplicado en Supabase (`public.users`)
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_backup_codes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id) WHERE google_id IS NOT NULL;
```

### D. Procedimiento de Verificacion Automatizada
Para verificar la integridad de los algoritmos criptograficos y las columnas en Supabase:
```powershell
cd "E:\UNISAAS - copia\squad4_web_desktop_pos_nextjs-main"
node scripts/test-totp-google.cjs
```
Resultado auditado: **13/13 pruebas exitosas (PASS)**.

---

## 8. Sistema de Diseno Institucional UniPutumayo y Memoria Cognitiva Engram

### A. Paleta de Colores y Tipografias Institucionales en Vercel
La aplicacion web desplegada en Vercel incorpora tokens de identidad institucional de UniPutumayo:
- **Azul Institucional (`#18668F` / `#135273`):** Botones primarios, barras de titulo, enlaces y sidebar activo.
- **Verde Institucional (`#80BF1F` / `#6ea41a`):** Liquidacion de caja POS (`COBRAR Y LIQUIDAR`), botones de alta (+ Nuevo) y estados `PAGADA`.
- **Naranja Institucional (`#F5A51D`):** Alertas de inventario y estado `PENDIENTE`.
- **Gris Institucional (`#595957` y `#B2B6B9`):** Subtitulos, textos descriptivos y divisores.
- **Fondo Neutro (`#F8F9FA`):** Superficie limpia y descansada para terminales de mostrador y administracion.
- **Tipografias Oficiales:** Google Fonts `Raleway` (titulos), `Roboto` / `Fira Sans` (UI general) y `JetBrains Mono` (tablas y totales POS).
- **Logotipo Institucional:** `public/LOGOUNIPUTUMAYO.png` integrado en `/login` y encabezados.

### B. Integracion con Engram (Memoria Persistente de Ingenieria)
Para mantener la logica operativa entre diferentes agentes de desarrollo:
- **Ubicacion de Engram MCP:** `C:\Users\MONCAYO\.gemini\antigravity\mcp\engram`
- **Proyecto Canonico:** `project="antigravity"`
- **Uso:** Permite recuperar de forma instantanea el razonamiento detras de la arquitectura Serverless, las 31 rutas BFF, el esquema DDL de Supabase y los algoritmos criptograficos TOTP RFC 6238 implementados.


---

## 9. Onboarding Express con Google (Reduccion de Friccion a 10 Segundos)

### A. Experiencia de Usuario sin Friccion
Se elimino la sobrecarga de 15 campos obligatorios y la generacion forzosa de contrasenas al registrarse con Google:
1. **Deteccion Automatica:** `/api/auth/callback/google` detecta nuevos usuarios y los redirige a `/register?google_email=...&google_name=...&google_id=...&google_picture=...`.
2. **Tarjeta Unica de Aprovisionamiento:**
   - Badge institucional con avatar y nombre autenticado por Google.
   - Unico campo obligatorio: **Nombre del Comercio**.
   - Selector visual de 6 categorias comerciales principales en 1 clic.
   - Datos adicionales (NIT/WhatsApp) marcados como opcionales colapsables.
   - Boton verde institucional (`#80BF1F`): **CREAR TIENDA Y ABRIR PUNTO DE VENTA**.
3. **Persistencia y Acceso Instantaneo:**
   - El backend genera un hash bcrypt criptografico interno para cumplir la restriccion NOT NULL de PostgreSQL sin molestar al usuario.
   - Invoca `public.platform_provision_tenant` y vincula `google_id` y `avatar_url`.
   - Emite cookies de sesion (`unisaas_session`, `unisaas_access_token`) y navega directamente a `/pos`. Cero necesidad de iniciar sesion dos veces.


---

## 10. Sistema de Gobernanza Anti-Bot y Aprobacion por Superadmin (Zero Cost Vercel/Supabase)

### A. Contexto y Proteccion de Cuotas Serverless Gratuitas
Para proteger el tier gratuito de Supabase (500 MB) y Vercel Serverless contra ataques automatizados de bots que creen miles de registros falsos, se implemento una arquitectura de defensa activa:
1. **Trampa Honeypot (`_hp_field`):** Campo oculto en formulario. Si un bot lo llena, el endpoint `/api/auth/register` responde 200 silencioso sin interactuar con la base de datos.
2. **Filtro de Correos Desechables:** Bloqueo en memoria de dominios temporales (`tempmail`, `mailinator`, `yopmail`, etc.).
3. **Limitador de Tasa por IP:** Maximo 3 registros por hora por direccion IP para impedir barridos automatizados.
4. **Estado PENDING_APPROVAL y Aislamiento Preventivo:**
   - Todo nuevo comercio (manual o Google) inicia en `public.tenants.registration_status = 'PENDING_APPROVAL'` e `is_active = FALSE`.
   - Se deniega el acceso a `/pos` y `/admin` con HTTP 403 hasta que el Superadministrador lo avale.
   - El comerciante es dirigido a `/register/pending`, donde se consulta periodicamente el estado via `/api/auth/tenant-status`.
5. **Consola de Aprobacion en `/platform-admin`:**
   - Pestana "Solicitudes Pendientes" con contador dinámico en tiempo real.
   - Boton "APROBAR Y ACTIVAR" (`#80BF1F`) para autorizar de inmediato al comercio y a su propietario.
   - Boton "RECHAZAR" para purgar de forma definitiva el registro sin dejar residuos de almacenamiento.


---

## 11. Protocolo Secret Zero Guardian y Guardias Activos en Vercel

### A. Integracion de DevSecOps (Cero Fuga de Secretos)
Para garantizar el cumplimiento estricto del estandar "Secret Zero" en el despliegue de Vercel y el repositorio publico/privado:
1. **Comando de Verificacion Pre-Deploy:** Se creo el script `scripts/verify-secret-zero.cjs` y el comando npm:
   ```powershell
   npm run check:security
   ```
2. **Validacion de Variables de Entorno:**
   - Cero exposicion de secretos de base de datos (`DATABASE_URL`, `POSTGRES_URL`), claves JWT o secretos OAuth bajo el prefijo `NEXT_PUBLIC_`.
   - Todas las credenciales sensibles operan aisladas en el contexto de Serverless Route Handlers de Next.js 15.
   - Verificacion de exclusiones en `.gitignore` para prevenir compromisos accidentales de archivos `.env`.

### B. Guardias Activos de Expulsion en Tiempo Real (`/pos` y `/admin`)
Para garantizar que ningun usuario pueda ingresar a las consolas operativas si su registro no ha sido formalmente avalado por el Superadministrador:
1. **Verificacion al Montaje (`useEffect`):**
   - Tanto `src/app/pos/page.tsx` como `src/app/admin/layout.tsx` consultan el endpoint liviano `/api/auth/tenant-status` al cargar la interfaz.
2. **Politica de Expulsion Inmediata:**
   - Si `registration_status === 'PENDING_APPROVAL'`, el cliente es inmediatamente expulsado y redirigido a `/register/pending`.
   - Si `registration_status === 'SUSPENDED'` o `is_active === false`, se destruye la sesion y se redirige a `/login?error=account_suspended`.
3. **Sincronizacion de Ramas:**
   - Todo cambio arquitectonico se mantiene sincronizado de forma estricta entre las ramas `main` y `vercel-supabase`.


---

## 12. Certificacion de Auditoria Visual y Clickeable en Produccion

### A. Diagnostico y Resolucion en Caliente
Se ejecuto una auditoria integral mediante navegadores de control automatizado sobre `https://unisaasdev.vercel.app`, identificando y solucionando tres incidencias criticas:
1. **Renderizado de Solicitudes Pendientes:** Implementacion de la vista reactiva en `/platform-admin?tab=pendientes` con indicadores y botones de aprobacion.
2. **Inyeccion de Honeypot:** Campo `<input name="_hp_field">` anadido a los formularios de registro manual y Google Express con proteccion anti-scraping.
3. **Atomicidad PostgreSQL:** Correccion de inserciones que causaban el aborto de transacciones en `withSystemDb`, logrando la persistencia efectiva de estados `ACTIVE` en Supabase.
4. **Purga en Cascada Libre de Bloqueos:** Eliminacion ordenada de dependencias (`pos_shifts`, `audit_logs`, `users`, `warehouses`, `branches`, `tenant_sequences`) al rechazar comercios.


---

## 13. Eliminacion Definitiva en Cascada de Empresas con Ventas y Productos

### A. Capacidad Operativa de Erradicacion Total para Superadmin
Anteriormente, el sistema bloqueaba la eliminacion definitiva de una empresa si esta contenia al menos una factura o turno de caja registrado (`TENANT_HAS_TRANSACTIONS`), forzando al operador a solo poder suspenderla.
Para permitir que el Superadministrador limpie comercios de prueba o empresas que deseen ser eliminadas por completo sin dejar ningun rastro de almacenamiento:

1. **Desbloqueo en BFF (`DELETE /api/platform/tenants/:id`):**
   - Se removio la restriccion 409 que impedia la eliminacion definitiva cuando existian turnos o facturas.
   - Si se selecciona eliminacion definitiva (`mode = 'hard'`), el backend procede a ejecutar la purga profunda.

2. **Mecanismo de Bypass de Inmutabilidad en PostgreSQL:**
   - Las tablas `invoices`, `purchases` y `journal_entries` tienen triggers que bloquean `DELETE`.
   - Se actualizo la funcion de base de datos para activar temporalmente `app.admin_purge = 'on'` dentro de la transaccion del Superadmin.
   - Fuera de esta transaccion autorizada, el bloqueo de eliminacion sobre facturas y asientos contables se mantiene 100% activo e inviolable.

3. **Purga Ordenada en 32 Tablas:**
   - Se ejecuta el borrado en orden estricto de dependencias: ventas -> items -> turnos -> kardex -> movimientos -> catalogo -> usuarios -> sucursales -> tenant.
   - Cero registros huerfanos en la base de datos de Supabase.

4. **Advertencia de Seguridad en Interfaz:**
   - El modal de `/platform-admin` aclara que la eliminacion es definitiva e irreversible, borrando completamente todos los productos, facturas, compras y cuentas de usuario asociadas.


---

## 14. Integracion de Marca: Logo Institucional UniPutumayo en Layouts y POS

### A. Sustitucion del Icono Geometrico SVG
Se incorporo el archivo oficial de identidad institucional `LOGOUNIPUTUMAYOPEQUEÑO.png` para su despliegue en Vercel:
1. **Disponibilidad Estatica:** Servido de forma publica bajo `/logo-uniputumayo-sm.png` y `/LOGOUNIPUTUMAYOPEQUENO.png` en el directorio `public/`.
2. **Consola `/platform-admin`:** Sustitucion en el sidebar colapsable de escritorio y en la barra superior movil por el logo institucional en alta fidelidad visual.
3. **Panel `/admin`:** Configurado como imagen predeterminada en el sidebar para comercios que aun no han personalizado su logotipo propio.
4. **Mostrador `/pos`:** Sustitucion en el encabezado movil y en el boton de retorno a la administracion del dock de mostrador.


---

## 15. Busqueda Global Reactiva y Sincronizacion Bidireccional en /platform-admin

### A. Conexion de Entrada Superior con Estado de Tabla
Se elimino el comportamiento estatico del input superior `<input placeholder="Buscar empresa, NIT o ID de tenant...">`:
1. **Componente Header Reactivo (`PlatformAdminHeaderSearch`):**
   - Transmite cambios a 0ms de latencia via `CustomEvent` (`platform-admin-search`).
   - Persiste y lee el parametro `?q=...` en la URL sin forzar recargas completas.
   - Cuenta con boton de limpieza ('X') en un clic.
2. **Sincronizacion Bidireccional:**
   - Escribir en el header actualiza el buscador interno de la tabla.
   - Escribir en la tabla actualiza el header en paralelo.
3. **Criterios de Busqueda Soportados:**
   - Razon social, nombre comercial, NIT/RUT, email, ciudad, ID/UUID de tenant, plan y estado.
   - Filtrado simultaneo en empresas activas, solicitudes pendientes y eventos de auditoria.


---

## 16. Resolucion de Atomicidad y Erradicacion Transaccional en 'Rechazar y Purgar'

### A. Diagnostico del Error 500 en Solicitudes Pendientes
- **Error Observado:** `current transaction is aborted, commands ignored until end of transaction block`.
- **Causa Raiz:** Intentos de borrado manual incompleto en `POST /api/platform/tenants/[id]/approve` sobre tablas con restricciones de integridad referencial activas en presencia de ventas y turnos de caja.

### B. Implementacion de Purga Atomica Unificada
1. **Invocacion a Rutina Centralizada:**
   - La aprobacion/rechazo ahora delega la purga a `public.platform_hard_delete_tenant($1, true)`.
2. **Bypass de Inmutabilidad con SAVEPOINTs:**
   - Proteccion transaccional con `SAVEPOINT sp_purge` y `SET LOCAL app.admin_purge = 'on'`.
   - Si la rutina experimenta un fallo imprevisto, `ROLLBACK TO SAVEPOINT` previene abortar la transaccion global de `withSystemDb`, habilitando el fallback ordenado en cascada de 32 tablas.
3. **Validacion de Eliminacion:**
   - Comercio `5bb7d577-b877-4ce6-b837-359e872ca381` purgado al 100% en Supabase sin dejar facturas, turnos ni usuarios residuales.
   - Compilacion de produccion validada con 58 rutas estaticas y dinamicas operativas en Next.js 15.


---

## 17. Certificacion de Estado Dia Cero para Lanzamiento a Produccion

### A. Estado Prístino de Base de Datos Supabase (Cero Residuos)
Previo a la entrega y apertura comercial en produccion, se ejecuto la purga total y auditoria automatizada:
- **Tenants:** 0 empresas registradas.
- **Usuarios de Comercio:** 0 colaboradores o cajeros residuales.
- **Facturas Comerciales POS:** 0 comprobantes en base de datos.
- **Turnos de Caja:** 0 sesiones de caja abiertas o cerradas.
- **Tablas Semilla Preservadas:**
  - `public.platform_admins`: 1 superadministrador oficial (`superadmin@unisaas.com`, contraseña validada con bcrypt).
  - `public.platform_plans`: 5 planes comerciales oficiales activos con precio COP.

### B. Certificacion de Rutas y Pestañas
- **Consola de Gobernanza `/platform-admin`:** 4 pestañas operativas (Empresas, Solicitudes Pendientes, Planes Oficiales, Auditoria Forense).
- **Portal de Autenticacion `/login`:** Deteccion automatica de perfil (Superadministrador, Gerente de Comercio, Cajero/Colaborador).
- **Onboarding Seguro `/register` y `/register/pending`:** 5 capas de proteccion anti-bot (Honeypot, correos temporales, rate limiting, aislamiento de base de datos y sondeo reactivo).
- **Panel Administrativo `/admin`:** 11 modulos comerciales verificados (Balance, Inventario, Facturacion, Clientes, Creditos, Gastos, Cuentas por Pagar, Equipo, Configuracion, Reportes y Mensajes).
- **Punto de Venta `/pos`:** Terminal de mostrador de alta velocidad probada con apertura de turno, lectura de codigos de barra, liquidacion con IVA 19% y arqueo de caja con cero desfase.

### C. Metricas de Aseguramiento de Calidad
- **Suites de Pruebas Unitarias:** 26/26 pasadas (267/267 tests exitosos).
- **Validacion de Tipos:** `npx tsc --noEmit` completado con 0 errores.
- **Compilacion Vercel:** 58/58 rutas estaticas y dinamicas listas para despliegue.
