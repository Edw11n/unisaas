# Certificación de Migración — Squad 3: Inventario, Kardex Multi-Bodega & Costo Promedio Ponderado (CPP)

**Fecha:** 2026-11-01  
**Origen:** `C:\unisaas\old\squad3_inventory_kardex_cpp-master`  
**Destino:** `C:\unisaas\new\modules\inventory`  
**Estado:** ✅ CERTIFICADO Y CERRADO

---

## 1. Resumen Ejecutivo de la Migración

La Squad 3 ha completado la migración e integración integral del motor transaccional de inventarios, valuación bajo Costo Promedio Ponderado (CPP) NIIF/NIC 2 y trazabilidad en el libro mayor Kardex para UniSaaS:

1. **Calculadora Canónica de Costo Promedio Ponderado (`CppCalculator`)**:
   - Algoritmo matemático estricto según NIC 2 / NIIF:
     - Entrada (Recepción / Compras / Traslados entrantes / Ajustes positivos):
       $$valorRecibido = round(cantidad \times costoUnitario, 4)$$
       $$nuevoValor = round(valorExistente + valorRecibido, 4)$$
       $$nuevaCantidad = round(cantidadExistente + cantidad, 4)$$
       $$nuevoCPP = round(nuevoValor / nuevaCantidad, 6)$$
     - Salida (Despacho de ventas POS / Consumos / Ajustes negativos):
       - Validación pesimista de stock suficiente ($disponible \ge requerido$).
       - Costo consumido (CMV) calculado exactamente a valor CPP.
       - CPP permanece inalterado mientras haya existencias remanentes.
       - Agotamiento total resetea stock, valor y CPP a 0.
     - Reversión compensatoria de salidas (devolución de cliente) y entradas (devolución a proveedor).

2. **Recepción y Despacho Físico de Mercancía (`StockService`)**:
   - `receiveStock`: Ingreso por compras a proveedor, actualización de balance de existencias por bodega, creación de `InventoryMovement` (`PURCHASE_RECEIPT`) y auditoría en `InventoryLedgerEntry` (Kardex). Soporta idempotencia.
   - `dispatchStock`: Descarga de inventario para ventas POS con validación de existencias. Retorna `totalCost` (Costo de Mercancía Vendida - CMV) a valor CPP para la causación contable inmediata en Squad 2 (cuentas 6135 Débito contra 1435 Crédito).

3. **Reversión Compensatoria No Destructiva (`reverseMovement`)**:
   - Anulación auditada de movimientos sin eliminación destructiva en base de datos.
   - Emite contra-movimiento (`CUSTOMER_RETURN` o `SUPPLIER_RETURN`) y contra-asiento en Kardex.
   - Bloqueo de doble reversión con `ConflictException`.

4. **Transferencias entre Bodegas (`transferStock` & `receiveTransfer`)**:
   - Validación de bodegas origen y destino diferentes y activas.
   - Modalidad `DIRECT`: traslado inmediato con descarga en origen e ingreso en destino en una sola transacción atómica.
   - Modalidad `TWO_PHASE`: despacho en origen con mercancía en estado `IN_TRANSIT` y recepción posterior en destino (`receiveTransfer`).

5. **Tomas Físicas y Auditorías de Inventario (`StockCount`)**:
   - `createStockCount`: apertura de sesión de conteo físico con captura de snapshot de stock teórico del sistema.
   - `applyStockCount`: comparación de cantidades contadas físicamente contra teóricas, con liquidación y asiento automático de ajustes por sobrantes (`ADJUSTMENT_IN`) o faltantes (`ADJUSTMENT_OUT`).

6. **Alertas de Reabastecimiento (`getStockAlerts`)**:
   - Detección en tiempo real de productos con existencias inferiores o iguales a su `minStockAlert`.
   - Cálculo automático del faltante (`shortage`) para alimentar órdenes de compra en Squad 7.

7. **Catálogo, Código de Barras y Categorías (`ProductService` & `CategoryService`)**:
   - Búsqueda directa por código de barras (`findByBarcode`) para escáneres en terminales POS.
   - Búsqueda con filtros avanzados y paginación (`searchProducts`).
   - CRUD de categorías con estructura jerárquica de árbol (`CategoryService`).

---

## 2. Cobertura de Pruebas

- Módulo: `@unisaas/inventory`
- Total de pruebas unitarias y de integración: 19 / 19 aprobadas (100%).
- Escenarios cubiertos:
  - Validación de tipos monetarios y tasas con Value Objects puros del Core Domain.
  - Detección de bodegas duplicadas.
  - Ajuste de inventario con balance, movimiento y Kardex.
  - Cálculo canónico de CPP en compras sucesivas a costos distintos.
  - Despacho a costo CPP manteniendo el promedio unitario.
  - Agotamiento total de inventario y reseteo a cero.
  - Rechazo de despachos por stock insuficiente.
  - Idempotencia en recepciones y despachos.
  - Reversión compensatoria de salidas restaurando stock físico.
  - Bloqueo de doble reversión de un movimiento ya anulado.
  - Rechazo de transferencias con bodega origen igual a destino.
  - Traslado directo de inventario en transacción atómica.
  - Conteo físico con cálculo automático de sobrantes y faltantes.
  - Alertas de stock bajo y cálculo de desabastecimiento.
  - Búsqueda por código de barras de producto.
  - Validación de nombres únicos en árbol de categorías.
