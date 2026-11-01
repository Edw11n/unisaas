# Plan de Implementacion: Prueba Robusta y Certificacion Integral del Sistema
## UniSaaS Colombia — Auditoria de Ciclo Completo de Empresa, Roles y Facturacion

**Objetivo:** Diseñar y ejecutar una prueba integral, exhaustiva y automatizada que certifique el ciclo de vida completo de UniSaaS Colombia, desde la creación de empresas en dos modalidades (registro web y consola superadmin), el inicio en estado limpio ("en cero"), la creación y confinamiento estricto de 10 roles operativos, la facturación POS con arqueo de denominaciones COP, hasta la extracción y descarga de reportes contables e inventarios.

---

## 1. Fases del Plan de Implementacion

### Fase 1: Creacion de Empresas y Acceso Multi-Modal
1. **Flujo A — Registro Autonomo desde el Login/Web (`/register`):**
   - Simular el registro de un comercio real: *Distribuidora y Almacen El Cafetero S.A.S.* (NIT `901.888.777-3`, rubro `DISTRIBUIDORA_TIENDA`, Pereira, Risaralda).
   - Verificar la creacion atomica de `tenant`, `branch` (Sede Principal), `warehouse` (Bodega Base) y usuario administrador con rol inmutable `OWNER`.
   - Verificar la recepcion y validez del JWT de acceso con claims verificadas.
2. **Flujo B — Creacion mediante Consola Superadmin (`/platform-admin` / `/api/platform/tenants`):**
   - Con sesion de `PLATFORM_ADMIN`, aprovisionar una segunda empresa: *Supermercado Central del Valle S.A.S.* (NIT `900.555.444-1`, rubro `MINIMERCADO`, Cali, Valle).
   - Asignar su administrador gerencial y verificar que la cuenta hereda rol `OWNER` confinado exclusivamente a su nuevo `tenant_id`.
   - Comprobar que cualquier usuario no-superadmin que intente consumir este endpoint es denegado con HTTP `403 Forbidden`.

### Fase 2: Certificacion de Estado Inicial Limpio ("En Cero")
Para cada empresa recien creada, verificar mediante peticiones reales a la API:
1. **Inventario:** `GET /api/inventory/products` retorna `[]` (longitud 0, cero productos o categorias demo).
2. **Finanzas y Balance:** `GET /api/accounting/balance` retorna exactamente `$ 0` COP en ventas, `$ 0` COP en gastos y `$ 0` COP en saldo neto.
3. **Turnos de Caja:** `GET /api/pos/shifts` retorna `[]` (cero turnos abiertos o historicos).
4. **Colaboradores:** `GET /api/admin/team` retorna unicamente al usuario propietario creador (`OWNER`), con cero cajeros o empleados secundarios.

### Fase 3: Creacion y Confinamiento de los 10 Roles Operativos
Iniciar sesion como el Propietario de la nueva empresa y registrar a traves de `POST /api/admin/roles` 10 roles especializados con matrices de permisos granulares:
1. `CAJERO_POS` (Cajero Mostrador POS): `['pos:checkout', 'pos:shift_reconcile']`
2. `SUPERVISOR_CAJA` (Supervisor de Turno): `['pos:checkout', 'pos:discounts', 'pos:shift_reconcile', 'reports:view']`
3. `ENCARGADO_BODEGA` (Encargado de Bodega): `['inventory:view', 'inventory:upload_csv', 'inventory:manage']`
4. `ADMIN_TIENDA` (Administrador Operativo de Tienda): permisos de POS, inventario, clientes, reportes, contabilidad y equipo.
5. `AUDITOR_INVENTARIO` (Auditor de Kardex): `['inventory:view', 'reports:view']`
6. `GESTOR_CARTERA` (Gestor de Cartera y Creditos): `['customers:manage', 'credits:authorize', 'credits:receive_payments', 'reports:view']`
7. `AUXILIAR_CONTABLE` (Auxiliar Contable y Fiscal): `['accounting:view', 'reports:view', 'credits:receive_payments']`
8. `ASISTENTE_COMPRAS` (Asistente de Compras): `['inventory:view', 'inventory:manage', 'reports:view']`
9. `VENDEDOR_MOSTRADOR` (Vendedor de Mostrador): `['pos:checkout', 'customers:manage']`
10. `AUDITOR_SEGURIDAD` (Auditor de Accesos y Equipo): `['team:manage', 'reports:view']`

**Verificacion de Confinamiento de Funciones (Principio de Menor Privilegio):**
- Asignar usuarios staff a estos roles via `POST /api/admin/team`.
- Probar que el usuario con rol `CAJERO_POS` es bloqueado de ingresar a `/admin` (redireccion automatica a `/pos` por middleware) y no puede acceder a `/platform-admin` ni gestionar usuarios.
- Probar que roles sin permiso de checkout (`ENCARGADO_BODEGA`, `AUXILIAR_CONTABLE`) no pueden liquidar ventas en POS.
- Probar que roles sin permiso financiero no pueden consultar margenes o balances contables.

### Fase 4: Operacion Completa del Sistema (Facturas, Flujo de Caja y Descargas)
1. **Creacion de Productos y Kardex:**
   - Crear 3 productos colombianos con unidades enteras y fraccionarias (ej. Café Especial, Panela Orgánica, Arroz por Kilos).
   - Verificar movimiento automatico de entrada `INICIAL` en el Kardex.
2. **Apertura de Turno de Caja con Denominaciones COP:**
   - Abrir turno en `CAJA-01` con conteo de billetes ($ 50.000, $ 20.000, $ 10.000) por valor base de $ 200.000 COP.
3. **Facturacion y Checkout POS:**
   - Venta 1: En Efectivo con calculo de devuelta (recibe $ 100.000 COP, total $ 50.500 COP, cambio $ 49.500 COP).
   - Venta 2: En Tarjeta / Transferencia digital con codigo de aprobacion.
   - Venta 3: A Credito (Fiado) asociada a un cliente registrado, impactando la cartera en Squad 7.
   - Verificar que cada venta emite un consecutivo `POS-XXXXXX` con desglose de IVA 19% / 5% y ticket termico.
4. **Flujo de Caja y Conciliacion:**
   - Registrar egreso menor por insumos de aseo ($ 25.000 COP) desde la caja abierta.
   - Registrar abono de fiado ($ 30.000 COP) en efectivo ingresando a la caja del turno activo.
5. **Cierre de Turno Z:**
   - Ejecutar arqueo y cierre de turno verificando saldo teorico vs contado y emision de comprobante Z.
6. **Extraccion y Descarga de Informacion:**
   - Descarga de plantilla CSV de productos y categorias.
   - Exportacion CSV del catalogo activo de inventario.
   - Exportacion CSV del historial de facturas y ventas.
   - Exportacion CSV del balance contable y flujo operativo.

### Fase 5: Suite Automatizada de Integracion E2E
- Implementar la suite `src/__tests__/colombia-e2e-system-robust-audit.test.ts`.
- Ejecutar y verificar que pase 100% en verde sin advertencias ni regresiones.

### Fase 6: Validacion Visual en Navegador
- Navegar con Puppeteer interactivo a las rutas clave:
  - `/login` y `/register`
  - `/admin` (dashboard en cero)
  - `/admin/inventory` (catalogo y descargas)
  - `/admin/team` (roles y colaboradores)
  - `/pos` (mostrador y checkout)
  - `/admin/balance` (cierre de caja y balance)
- Capturar capturas de pantalla de verificacion.

### Fase 7: Documentacion y Persistencia
- Actualizar `CHECKLIST_UNISAAS_CO.md` y `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`.
- Persistir la ejecucion en Engram (`mem_save`).
