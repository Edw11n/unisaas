# PLAN DE IMPLEMENTACION Y RUTA MAESTRA INTEGRAL - UNISAAS

Este documento establece la ruta maestra exhaustiva de desarrollo para convertir a UNISAAS en una plataforma SaaS comercial, contable y punto de venta multi-tenant 100% operativa, eliminando cualquier brecha entre el frontend web, la aplicacion movil y los 8 microservicios backend.

---

## 1. DIAGNOSTICO DE SITUACION ACTUAL: QUE TENEMOS Y QUE FALTA

### A. Capa Web Frontend (Squad 4 - Next.js 15)
- **Implementado:**
  - Login operacional (`/login`) autenticado contra Squad 1 con soporte de PIN y credenciales de usuario.
  - Interfaz de punto de venta (`/pos`) con lectura de codigos de barras, atajos de teclado F1-F12, panel de totales y modales de pago.
  - Orquestador transaccional en servidor (`/api/checkout`) con patron Saga compensatorio hacia Squads 7, 3, 2 y 6.
  - Shell administrativo preliminar (`/admin`) con vistas de inventario, cartera y usuarios.
- **Faltante Crítico:**
  - Landing page publica comercial de captacion (`/`) con presentacion del SaaS, planes de suscripcion y propuesta de valor.
  - Flujo de auto-registro y onboarding de nuevos tenants (`/register`, `/onboarding`) para creacion de empresa, NIT, resolucion DIAN y sucursal inicial.
  - Las pantallas administrativas (`/admin/inventory`, `/admin/credits`) todavia consumen datos en memoria (`mock-adapters.ts`) en lugar de consultar las APIs REST reales de Squad 3 y Squad 7.
  - Ausencia de vistas web para Contabilidad NIIF (Squad 2): Plan de cuentas, Libro Diario, Balance General y P&L.
  - Ausencia de vistas web para Compras y Proveedores (Squad 7): Emision de ordenes de compra y recepcion fisica en bodega.
  - Ausencia de vistas web para Reportes y Cierres (Squad 6): Arqueo X, Cierre Z, auditoria de turnos y reimpresion de facturas.

### B. Capa Backend y Microservicios (Squads 1, 2, 3, 6, 7, 8)
- **Implementado:**
  - Aislamiento multi-tenant con PostgreSQL Row Level Security (RLS) y RBAC granular (Squad 1).
  - Reglas contables de partida doble con tolerancia acotada a $1.00 COP (Squad 2).
  - Valuacion de inventario por Costo Promedio Ponderado (CPP NIC 2) y bloqueos pesimistas (Squad 3).
  - Motor de facturacion y formateador de tickets termicos ESC/POS CP850 (Squad 6).
  - Control de cupos de credito con bloqueos `SELECT ... FOR UPDATE` y soporte PostgreSQL real (Squad 7).
  - Docker Compose unificado con observabilidad Prometheus/Grafana (Squad 8).
- **Faltante Crítico:**
  - Conectar los endpoints de consulta de catalogos, compras y estados financieros hacia el frontend web.

### C. Capa Movil (Squad 5 - Flutter Offline-First)
- **Implementado:**
  - Arquitectura limpia con Riverpod, persistencia SQLite local (Drift) y cola transaccional Outbox.
  - Pantalla operativa de venta en ruta (`pos_screen.dart`) con sincronizacion asincrona hacia `/api/checkout`.
- **Faltante Crítico:**
  - Pantalla de recepcion de mercancía en ruta (Bodega Movil) y sincronizacion bidireccional de clientes de cartera.

---

## 2. ARQUITECTURA MAESTRA DE RUTAS WEB (SQUAD 4)

La aplicacion web de UNISAAS debe estructurarse en 4 zonas funcionales bien diferenciadas:

```
UNISAAS WEB (Next.js 15 App Router)
|
+-- ZONA 1: PORTAL PUBLICO & SAAS ONBOARDING
|   +-- /                     (Landing Page comercial de conversion)
|   +-- /precios              (Planes: Basico, Pro, Enterprise)
|   +-- /registro             (Alta de empresa: Razon Social, NIT, Subdominio)
|   +-- /onboarding           (Configuracion inicial: Bodegas, Sucursales, Consecutivos)
|   +-- /login                (Acceso unificado: Correo/Password o Codigo Empresa)
|
+-- ZONA 2: MOSTRADOR DE PUNTO DE VENTA (CAJA RAPIDA)
|   +-- /pos                  (Pantalla principal de venta con atajos y scanner)
|   +-- /pos/devoluciones     (Notas de credito y devolucion de articulos)
|   +-- /pos/turnos           (Apertura de caja, arqueo X y cierre Z)
|
+-- ZONA 3: ADMINISTRACION COMERCIAL & OPERATIVA (BACKOFFICE)
|   +-- /admin                (Dashboard general con KPIs de venta, stock y cartera)
|   +-- /admin/inventario
|   |   +-- /                 (Catalogo de articulos, stock multialmacen y precios)
|   |   +-- /nuevo            (Creacion de articulos con SKU, barcode e IVA)
|   |   +-- /kardex           (Historial de movimientos valorizados por CPP)
|   |   +-- /traslados        (Envios y recepciones entre bodegas fijas y moviles)
|   |   +-- /ajustes          (Mermas, danos y sobrantes)
|   +-- /admin/compras
|   |   +-- /proveedores      (Directorio de proveedores y condiciones comerciales)
|   |   +-- /ordenes          (Creacion y seguimiento de ordenes de compra)
|   |   +-- /recepciones      (Entrada fisica de mercancia que alimenta el Kardex)
|   +-- /admin/cartera
|       +-- /clientes         (Fichas de clientes, historial y cupo maximo de fiado)
|       +-- /cobros           (Registro de abonos y emision de recibos de caja)
|       +-- /edades           (Reporte de cartera vencida a 30, 60, 90+ dias)
|
+-- ZONA 4: CONTABILIDAD NIIF, REPORTES & SISTEMA
    +-- /admin/contabilidad
    |   +-- /plan-cuentas     (Catalogo de cuentas PUC segun estandar NIIF)
    |   +-- /libro-diario     (Asientos contables generados por ventas y compras)
    |   +-- /balance-general  (Estado de situacion financiera del tenant)
    |   +-- /pyg              (Estado de resultados: Ingresos, Costos y Utilidad)
    +-- /admin/reportes
    |   +-- /ventas           (Ventas por cajero, medio de pago, fecha y sucursal)
    |   +-- /fiscales         (Informe de IVA generado y retenciones)
    |   +-- /auditoria        (Log inmutable de eventos forenses)
    +-- /admin/configuracion
        +-- /empresa          (Datos fiscales, logo y resolucion de facturacion)
        +-- /sucursales       (Sedes y bodegas asociadas)
        +-- /usuarios         (Gestion de cajeros, administradores y roles RBAC)
```

---

## 3. MATRIZ DE INTEGRACION: RUTAS WEB VS ENDPOINTS BACKEND

| Ruta Frontend Web | Metodo HTTP Backend | Endpoint Microservicio | Squad Encargado | Descripcion del Contrato |
|---|---|---|---|---|
| `/registro` | `POST` | `/api/v1/tenants/register` | Squad 1 (3001) | Crea tenant en DB, usuario master y esquemas RLS. |
| `/login` | `POST` | `/api/v1/auth/login` | Squad 1 (3001) | Emite JWT access token y refresh token rotativo. |
| `/pos` | `GET` | `/api/v1/inventory/products` | Squad 3 (3003) | Retorna catalogo activo con stock y precios oficiales. |
| `/pos` (Liquidacion) | `POST` | `/api/checkout` (BFF) | Squad 4 (3000) | Orquesta Saga en Squad 7, 3, 2 y 6 de forma atomica. |
| `/pos/turnos` | `POST` | `/api/v1/invoices/shifts/close` | Squad 6 (3006) | Genera ticket de Cierre Z y cuadre de efectivo. |
| `/admin/inventario` | `GET` | `/api/v1/inventory/balances` | Squad 3 (3003) | Consulta existencias por bodega y costo promedio. |
| `/admin/inventario/nuevo` | `POST` | `/api/v1/inventory/products` | Squad 3 (3003) | Registra nuevo SKU con validacion de unicidad. |
| `/admin/inventario/traslados` | `POST` | `/api/v1/inventory/transfers` | Squad 3 (3003) | Traslado atomico con bloqueo ordenado de bodegas. |
| `/admin/compras/recepciones` | `POST` | `/api/v1/purchases/receive` | Squad 7 (3007) | Recepciona mercancia, incrementa stock y asienta CXP. |
| `/admin/cartera/cobros` | `POST` | `/api/v1/credits/payments` | Squad 7 (3007) | Registra abono, libera cupo y genera asiento en Squad 2. |
| `/admin/contabilidad/libro-diario` | `GET` | `/api/v1/accounting/journal-entries` | Squad 2 (3002) | Retorna asientos con balance de comprobacion debito/credito. |
| `/admin/contabilidad/pyg` | `GET` | `/api/v1/accounting/reports/income-statement` | Squad 2 (3002) | Reporte financiero de ingresos versus costos de ventas. |
| `/admin/reportes/ventas` | `GET` | `/api/v1/invoices/reports/sales-summary` | Squad 6 (3006) | Metricas consolidadas de facturacion y medios de pago. |

---

## 4. RUTA MAESTRA DE CONSTRUCCION EN 5 FASES

### FASE 1: Landing Page Comercial & Registro Multi-Tenant (Inmediata)
- Construir la Landing Page principal en `/` orientada a conversion (presentando propuesta de valor para ferreterias, supermercados y distribuidores).
- Implementar el flujo `/registro` que invoque el endpoint de creacion de tenant de Squad 1.
- Desarrollar el asistente de `/onboarding` para definir resolucion de facturacion, consecutivos iniciales y bodegas.

### FASE 2: Eliminacion de Mocks y Enlace Real de Catalogos en POS
- Reemplazar `mock-adapters.ts` en Squad 4 por clientes HTTP tipados que consuman directamente:
  - `GET http://localhost:3003/api/v1/inventory/products` (Catalogo y existencias reales).
  - `GET http://localhost:3007/api/v1/credits/customers` (Clientes con cupo real).
- Implementar cache local en Zustand con re-validacion periodica (SWR/React Query).

### FASE 3: Modulo de Compras, Proveedores y Recepcion Fisica (Squad 7 & 3)
- Construir vistas web de `/admin/compras`:
  - Listado de proveedores y registro de ordenes de compra.
  - Pantalla de recepcion de mercancia: Al ingresar cantidades y costos unitarios, se ejecuta la llamada a Squad 7 que a su vez registra el incremento en Squad 3 (Kardex CPP) y el pasivo en Squad 2 (CXP Proveedores).

### FASE 4: Modulo Contable NIIF y Reportes Fiscales (Squad 2 & 6)
- Construir vistas web de `/admin/contabilidad`:
  - Visualizador del Libro Diario con balance de sumas iguales.
  - Pantalla de Balance General y Estado de Resultados.
- Construir vistas web de `/admin/reportes`:
  - Arqueos de caja y cierres de turno Z.
  - Historial de facturas emitidas con visualizador de ticket termico y boton de reimpresion.

### FASE 5: Sincronizacion Bidireccional Movil (Squad 5)
- Integrar la recepcion de mercancia para camiones distribuidores (Bodega Movil) en la app Flutter.
- Completar la descarga local del catalogo desde Squad 3 al iniciar turno en carretera.
