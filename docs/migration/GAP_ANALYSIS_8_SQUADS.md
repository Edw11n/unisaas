# Análisis Exhaustivo de Brechas (Gap Analysis) — 8 Squads UniSaaS

**Fecha:** 1 de Noviembre de 2026  
**Repositorio Histórico (Solo Lectura):** `C:\unisaas\old`  
**Repositorio Monolítico Modular:** `C:\unisaas\new`  

---

## 1. Resumen Ejecutivo

Durante la fase de auditoría forense entre `C:\unisaas\old` y `C:\unisaas\new`, se identificó que la consolidación previa del monorepo implementó la infraestructura de base y las pruebas de carga, pero omitió múltiples módulos funcionales, reglas de negocio, controladores y casos de uso críticos presentes en los repositorios originales de las squads.

Este documento establece el inventario formal de brechas para cada una de las 8 squads, definiendo los requerimientos necesarios para alcanzar la paridad funcional real.

---

## 2. Mapa de Brechas por Squad

### Squad 1: Arquitectura Base, RLS, RBAC, Onboarding y Plataforma
- **Origen:** `old/squad1_core_architecture_rls_rbac-main`
- **Destino:** `new/modules/identity`, `new/apps/api-gateway`
- **Brechas Identificadas:**
  1. *Registro / Onboarding atómico (`POST /api/v1/auth/register`):* Creación transaccional de Tenant, Sucursal Principal, Bodega Activa y Usuario Propietario (OWNER) con emisión inmediata de tokens JWT.
  2. *Catálogo de Rubros Comerciales Colombianos (`commercial-categories`):* 40 categorías comerciales en 10 familias con presets de capacidades operativas (`kitchenPrint`, `scaleSupport`, `orderNotes`, `lotTracking`, etc.).
  3. *Sistema de Planes y Cuotas SaaS (`plans`):* `PILOT_UNLIMITED`, `COMMUNITY_FREE`, `PRO_GROWTH`, `ENTERPRISE_MULTI`, verificación de límites de uso (`checkUsageLimit`) y modo piloto permisivo.
  4. *Gestión de Sucursales (`branches`):* Endpoints CRUD aislados por tenant (`GET /`, `GET /:identifier`, `POST /`, `PATCH /:identifier`, `DELETE /:identifier`).
  5. *Gestión de Colaboradores y Activación (`users/staff`, `auth/activate`):* Creación en estado inactivo (`PENDING_ACTIVATION`), emisión de código temporal de 6 dígitos (7 días TTL), activación pública protegida con rate limit, actualización de perfiles y restablecimiento de credenciales con revocación de sesiones en Redis.
  6. *Plataforma SuperAdmin y MFA (`platform`):* Login administrativo, validación TOTP RFC 6238, aprobación de comercios y auditoría global.
- **Estado:** ✅ **100% Migrado y Verificado con 25 Pruebas Automatizadas.**

---

### Squad 2: Contabilidad, PUC, Libros e Informes
- **Origen:** `old/squad2_accounting-main`
- **Destino:** `new/modules/accounting`
- **Brechas Identificadas:**
  1. *Generador de Asientos Diarios (`journals`):* Validación de balance debito/crédito, numeración secuencial BigInt, cuentas PUC colombianas.
  2. *Cierre de Períodos Contables:* Bloqueo de fechas fiscales anteriores, verificación de períodos cerrados.
  3. *Libro Mayor, Diario e Informes Financieros:* Generación de Balance de Comprobación, Estado de Resultados y Balance General.
  4. *Integración con Checkout y Ventas:* Contabilización automática de ingresos, IVA y cuentas por cobrar.

---

### Squad 3: Facturación, Ventas, Checkout POS e Impuestos
- **Origen:** `old/squad3_pos_sales_billing-main`
- **Destino:** `new/modules/sales`, `new/apps/api-gateway/src/checkout`
- **Brechas Identificadas:**
  1. *Resoluciones DIAN y Consecutivos:* Gestión de prefijos de facturación, rangos autorizados y fechas de vigencia.
  2. *Cálculo de Impuestos Múltiples:* IVA (0%, 5%, 19%), Impoconsumo (8%), retenciones fiscales (ReteFuente, ReteIVA, ReteICA).
  3. *Arqueo y Cierre de Caja (`shifts`):* Apertura con base inicial, registro de entradas/salidas de efectivo, arqueo ciego y reporte de diferencias.
  4. *Generación de Comprobantes Térmicos:* Tickets POS de 58mm y 80mm con compatibilidad ESC/POS pura.

---

### Squad 4: Inventario, Kardex, Proveedores y Compras
- **Origen:** `old/squad4_inventory_kardex_warehouse-main`
- **Destino:** `new/modules/inventory`
- **Brechas Identificadas:**
  1. *Kardex CPP Estricto:* Costo promedio ponderado en tiempo real sin desfases por concurrencia.
  2. *Gestión de Lotes y Vencimientos:* Trazabilidad de lotes para droguerías, alimentos y químicos con alertas de caducidad.
  3. *Módulo de Compras y Proveedores:* Órdenes de compra, recepción de mercancía y actualización de costo promedio.
  4. *Transferencias entre Bodegas:* Movimientos multi-sede con confirmación de recepción.

---

### Squad 5: Cartera, Créditos, Fiados y Cobranzas
- **Origen:** `old/squad5_credits_receivables-main`
- **Destino:** `new/modules/credits`
- **Brechas Identificadas:**
  1. *Límites de Crédito y Fiado:* Cupos máximos por cliente, bloqueo automático por mora.
  2. *Planes de Pago y Amortización:* Cuotas periódicas, cálculo de intereses de mora y abonos parciales.
  3. *Recibos de Caja y Abonos:* Asignación de pagos a facturas vencidas específicas con impacto contable inmediato.
  4. *Estado de Cuenta del Cliente:* Reporte consolidado de deuda, antigüedad de saldos e historial de abonos.

---

### Squad 7: Catálogo Público, WhatsApp y Omnicanalidad
- **Origen:** `old/squad7_public_catalog_ecommerce-main`
- **Destino:** `new/modules/catalog` (o subcarpeta de ventas/catálogo)
- **Brechas Identificadas:**
  1. *Catálogo Web Público:* Acceso sin autenticación por slug/subdominio de comercio.
  2. *Generación de Pedidos por WhatsApp:* Construcción del mensaje preformateado con detalle de ítems y total.
  3. *Sincronización de Disponibilidad:* Ocultar o marcar productos sin stock en tiempo real.

---

### Squad 6: Offline, Sincronización y Resiliencia POS
- **Origen:** `old/squad6_offline_first_sync-main`
- **Destino:** `new/apps/web-pos`, `new/packages/contracts`
- **Brechas Identificadas:**
  1. *Almacenamiento Local IndexedDB:* Cola de facturas pendientes de envío sin conexión.
  2. *Protocolo de Resolución de Conflictos:* Detección de colisiones de stock y números de factura al reconectar.
  3. *Caché Local de Catálogo y Clientes:* Capacidad de venta continua en cortes de internet.

---

### Squad 8: Analítica, BI y Tableros Operativos
- **Origen:** `old/squad8_analytics_reporting_dashboards-main`
- **Destino:** `new/modules/analytics` (o reportes de negocio)
- **Brechas Identificadas:**
  1. *KPIs de Ventas y Rentabilidad:* Métricas en tiempo real por hora, día, mes, producto y cajero.
  2. *Reporte de Productos Más Vendidos y Rotación:* Detección de productos de baja rotación y quiebres de stock.
  3. *Márgenes Brutos y Utilidad:* Análisis de utilidad neta cruzando ventas contra costo promedio ponderado de kardex.

---

## 3. Estado de Ejecución
- **Squad 1 (Identity & Base):** CERRADA Y CERTIFICADA (100%).
- **Squads 2 a 8:** En espera de autorización secuencial.
