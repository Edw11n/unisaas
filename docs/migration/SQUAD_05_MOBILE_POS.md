# Certificación de Migración — Squad 5: Mobile POS Offline-First (Flutter / Drift)

**Fecha de Certificación:** 1 de Noviembre de 2026  
**Squad Origen:** `C:\unisaas\old\squad5_mobile_pos_offline-main`  
**Destino Definitivo:** `C:\unisaas\new\apps\mobile-pos`  
**Estado:** ✅ **COMPLETADA Y VERIFICADA AL 100%**

---

## 1. Resumen Ejecutivo de la Migración

La aplicación móvil nativa `mobile-pos` (desarrollada en Flutter con persistencia local SQLite/Drift y gestión reactiva Riverpod) ha sido completamente integrada y verificada dentro de la arquitectura modular monolítica de UniSaaS.

El sistema garantiza operatividad comercial continua en zonas de conectividad intermitente (como el Putumayo y áreas rurales de Colombia), implementando el patrón transaccional Outbox con sincronización en segundo plano (`SyncQueueWorker`), reintentos con retroceso exponencial (*exponential backoff*), y preservación de idempotencia canónica (`Idempotency-Key`).

---

## 2. Arquitectura y Componentes Móviles

### 2.1. Persistencia Local y Outbox Pattern (`lib/core/database/database.dart`)
- **Motor Drift/SQLite:** Tablas locales indexadas para:
  - `Products`: Caché local de artículos, precios, tarifas de IVA y SKU para búsqueda instantánea fuera de línea.
  - `SyncQueueItems`: Cola de salida (Outbox) transaccional con estados `PENDING`, `SYNCED`, `FAILED`, `CONFLICT`.
  - `PosShifts`: Registro local de aperturas, cierres y turnos de caja móvil.
- **Persistencia Duradera:** Los ítems de la cola Outbox sobreviven a reinicios de la aplicación o del dispositivo, asegurando cero pérdida de comprobantes.

### 2.2. Trabajador de Sincronización Asíncrona (`lib/core/sync/sync_queue_worker.dart`)
- **Idempotencia Estricta:** Las solicitudes de venta se reintentan utilizando exactamente la misma llave `Idempotency-Key` generada en el momento de la venta física, evitando cobros dobles en el backend.
- **Resiliencia ante Fallos de Red y 5xx:** Si el backend responde con error 503 o si la conexión se interrumpe (`SocketException`), el ítem permanece en estado `PENDING` y entra en ventana de enfriamiento con retroceso exponencial.
- **Manejo de Conflictos HTTP 409:** Si el backend detecta un conflicto por divergencia en la huella digital del payload, el ítem se marca como `CONFLICT`, evitando bucles infinitos de saturación y preservando la traza forense.
- **Expiración de Sesión (HTTP 401):** Si el token del cajero caduca, la sincronización se detiene limpiamente hasta que el usuario se reautentica.

### 2.3. Interfaces de Usuario y Flujos Móviles (`lib/features/*`)
- **Login Móvil (`login_screen.dart`):** Autenticación canónica, almacenamiento seguro de sesión (`unisaas_access_token`) y contexto de empresa/sucursal.
- **Dashboard Ejecutivo Móvil (`dashboard_screen.dart`):** Indicadores en tiempo real (Ventas del día, comprobantes emitidos, estado de la sincronización en segundo plano).
- **Mostrador Móvil POS (`pos_screen.dart`):**
  - Catálogo reactivo con barra de búsqueda rápida.
  - Gestión de carrito con cálculo automático de impuestos según normativa colombiana.
  - Modal de cobro con soporte de Efectivo (con cálculo de vueltos), Transferencias y Crédito comercial.

---

## 3. Pruebas y Certificación de Calidad

Ejecución oficial de la suite completa de pruebas Flutter (`flutter test`):
- `test/backend_contract_test.dart`: 7/7 pruebas passing (Contrato BFF, cookies, tokens y control de cola Outbox).
- `test/offline_sync_scenarios_test.dart`: 4/4 pruebas passing (Reintentos idempotentes, backoff exponencial ante 5xx, aislamiento de conflictos 409, y persistencia tras reinicio de BD).
- `test/sale_payload_test.dart`: 4/4 pruebas passing (Cálculo de IVA y total, mapeo de medios de pago, metadata de sucursal y cajero).
- `test/widget_test.dart`: 1/1 prueba passing (Smoke test de arranque de app).
- `test/mobile_navigation_audit_test.dart`: 3/3 pruebas passing (Auditoría visual de navegación Dashboard -> POS -> Login).
- `test/real_backend_integration_test.dart`: 4/4 pruebas passing con sonda de detección de backend.

**Resultado Total:** 23/23 pruebas exitosas (0 fallidas).
