# UniSaaS Mobile POS (`apps/mobile-pos`)

Cliente móvil Flutter nativo con arquitectura **Offline-First**, persistencia local SQLite (Drift 2.24/2.31), cola transaccional Outbox, retroceso exponencial (exponential backoff) y cliente HTTP tipado generado desde la especificación OpenAPI v3 del backend NestJS.

---

## 1. Arquitectura y Capas

La aplicación sigue una separación estricta de responsabilidades:

```
apps/mobile-pos/
├── lib/
│   ├── core/
│   │   ├── api/generated/       # Cliente y modelos tipados generados desde OpenAPI v3
│   │   ├── config/              # Variables de entorno y configuración (--dart-define)
│   │   ├── database/            # Drift SQLite (AppDatabase, LocalProducts, SyncQueueItems, LocalCustomers)
│   │   ├── network/             # ApiClient HTTP centralizado con soporte JWT y Headers
│   │   ├── session/             # Gestión de sesión segura (SessionStore en Keystore)
│   │   └── sync/                # SyncQueueWorker: cola Outbox, backoff exponencial y manejo 409
│   ├── features/
│   │   ├── auth/presentation/   # Pantalla de login móvil (MobileLoginScreen)
│   │   ├── dashboard/           # Pantalla de KPIs y estado de sincronización (MobileDashboardScreen)
│   │   └── pos/                 # Flujo de mostrador: carrito, catálogo táctil y cobro (MobilePosScreen)
│   └── main.dart                # Punto de entrada y SessionGate
└── test/
    ├── offline_sync_scenarios_test.dart  # Escenarios A, B, C y D certificados
    ├── backend_contract_test.dart        # Pruebas de contrato ApiClient y Worker
    ├── sale_payload_test.dart            # Cálculo matemático con IVA y tolerancia
    └── mobile_navigation_audit_test.dart # Pruebas de interfaz y navegación
```

---

## 2. Garantías de Sincronización Offline-First (Outbox)

### Escenario A: Idempotencia en reintentos
- Todas las operaciones de venta generan una clave única UUIDv4 (`Idempotency-Key` y `X-Idempotency-Key`).
- La venta se almacena atómicamente en SQLite local con estado `PENDING` antes de enviarse al backend.
- Si ocurre una pérdida de red o timeout, el ítem permanece en `PENDING` y se reintenta utilizando **exactamente la misma clave de idempotencia**.
- El backend NestJS/PostgreSQL valida la huella SHA-256 del payload y retransmite la confirmación sin duplicar registros.

### Escenario B: Retroceso exponencial ante errores 5xx
- Ante códigos HTTP 500, 502, 503, 504 o fallos de socket, el `SyncQueueWorker` incrementa `retryCount`.
- Aplica retroceso exponencial: `delay = min(maxBackoff, baseBackoff * 2^retryCount)`.
- El ítem permanece en estado `PENDING` y no se descarta.
- Cuando el servidor o la red se recuperan, el worker completa la sincronización y marca el ítem como `SYNCED`.

### Escenario C: Tratamiento explícito de conflictos (HTTP 409)
- Si el backend devuelve `HTTP 409 Conflict` (ej. incompatibilidad de versión de datos o conflicto de idempotencia):
  - El ítem se marca inmediatamente como `status: 'CONFLICT'`.
  - El worker **no entra en bucle infinito** de reintentos.
  - El payload original, la clave de idempotencia y el mensaje de error del servidor se preservan en la base de datos local.
  - Se expone mediante `watchConflictCount()` y `getConflictSyncItems()` para inspección y resolución manual.

### Escenario D: Persistencia de la cola entre reinicios
- Las operaciones en cola residen en SQLite físico (`unisaas_mobile_pos.sqlite`).
- Si la aplicación se cierra forzosamente o el dispositivo se reinicia, todos los ítems pendientes, sincronizados y en conflicto conservan su integridad.

---

## 3. Comandos de Desarrollo

### Generación del Cliente Dart desde OpenAPI v3
```powershell
# Desde el directorio raíz del monorepo
powershell -ExecutionPolicy Bypass -File scripts/generate-dart-api.ps1
```

### Obtención de dependencias
```powershell
cd apps/mobile-pos
flutter.cmd pub get
```

### Análisis estático de código (0 advertencias requeridas)
```powershell
cd apps/mobile-pos
flutter.cmd analyze
```

### Ejecución de pruebas automatizadas
```powershell
cd apps/mobile-pos
flutter.cmd test
```

### Compilación con variables de entorno
```powershell
flutter.cmd build apk --release `
  --dart-define=API_BASE_URL=http://api.unisaas.com/api/v1 `
  --dart-define=USE_MOCK_BACKEND=false
```

