# Certificación de Migración — Squad 7: Terceros, Compras y Cartera / Créditos

**Módulo:** `@unisaas/credits`  
**Ubicación Definitiva:** `C:\unisaas\new\modules\credits`  
**Repositorio Histórico:** `C:\unisaas\old\squad7_credits_purchases_suppliers-main`  
**Estado:** ✅ **CERTIFICADA AL 100%**  
**Fecha:** 1 de Noviembre de 2026

---

## 1. Alcance y Arquitectura Migrada

La Squad 7 implementa la gestión de Terceros (Clientes, Proveedores y Mixtos), el registro de Compras de inventario con liquidación de impuestos colombianos (IVA 19%), y el ciclo completo de Cartera y Cuentas por Cobrar/Pagar (Créditos / Fiado):

### 1.1. Gestión de Terceros (`ThirdPartyService`)
- Registro de terceros con tipología de documento legal DIAN (`CC`, `NIT`, `CE`, `TI`, `PP`, `PEP`).
- Clasificación de roles: `CUSTOMER` (Cliente), `SUPPLIER` (Proveedor), `BOTH` (Cliente y Proveedor simultáneo).
- Asignación de cupo de crédito (`creditLimit`) utilizando el Value Object `Money` de alta precisión.
- Control estricto contra duplicación de documentos bajo el mismo inquilino con HTTP 409 `ConflictException`.
- Aislamiento multi-tenant integral con `withTenantContext`.

### 1.2. Ciclo de Compras de Mercancía (`PurchaseService`)
- Validación de que el emisor de la factura sea efectivamente un proveedor (`SUPPLIER` o `BOTH`).
- Prevención de duplicidad de facturas de proveedor (`supplierInvoiceNumber`).
- Cálculo exacto de subtotales, IVA discriminado (tasa general 19% o diferencial) y gran total empleando Value Objects puros `Money`, `Quantity` y `TaxRate`.
- Integración automática con Cartera de Proveedores: si la compra es de tipo `CREDITO`, incrementa la deuda por pagar al proveedor y genera el movimiento auditable en el libro de transacciones de crédito (`SUPPLIER_PURCHASE`).

### 1.3. Cartera y Límites de Crédito (`CreditService`)
- Venta fiada / a crédito (`CHARGE_CREDIT_SALE`): evalúa en tiempo real si la nueva deuda proyectada supera el cupo asignado (`creditLimit`), bloqueando transacciones no autorizadas con HTTP 400 `BadRequestException`.
- Abonos de clientes (`CUSTOMER_PAYMENT`): reduce el saldo adeudado asegurando que el abono no exceda la deuda actual del cliente.
- Pagos a proveedores (`SUPPLIER_PAYMENT`): disminuye las cuentas por pagar al proveedor con validación contra el saldo pendiente.
- Trazabilidad y auditoría: cada transacción registra el saldo previo (`previousBalance`), el saldo resultante (`newBalance`), el medio de pago (`paymentMethod`), número de comprobante/referencia y el usuario responsable.

---

## 2. Cobertura de Pruebas Unitarias

Se ejecutó la suite completa de pruebas en `modules/credits/test/credits.spec.ts`:

```bash
$ node --test dist/test/*.spec.js
▶ Módulo de Terceros, Compras y Cartera / Créditos (@unisaas/credits)
  ✔ ThirdPartyService.createThirdParty rechaza documento duplicado con ConflictException (24.5468ms)
  ✔ ThirdPartyService.getThirdPartyById lanza NotFoundException si no existe el tercero (0.7974ms)
  ✔ CreditService.registerTransaction bloquea montos cero o negativos (0.5946ms)
  ✔ CreditService.registerTransaction lanza NotFoundException si el tercero no existe (1.0402ms)
  ✔ CreditService.registerTransaction bloquea ventas a crédito que excedan el cupo asignado (1.0205ms)
  ✔ CreditService.registerTransaction rechaza abonos que excedan la deuda actual (0.4519ms)
  ✔ CreditService.registerTransaction aplica abonos válidos y reduce la deuda con precisión (5.6389ms)
  ✔ CreditService.registerTransaction soporta SUPPLIER_PAYMENT reduciendo cuentas por pagar (0.6694ms)
  ✔ PurchaseService.createPurchase valida ítems no vacíos y rol de proveedor (0.9892ms)
  ✔ PurchaseService.createPurchase calcula totales e IVA 19% y crea cuenta por pagar en CREDITO (1.477ms)
✔ Módulo de Terceros, Compras y Cartera / Créditos (@unisaas/credits) (39.3487ms)
ℹ tests 10
ℹ suites 1
ℹ pass 10
ℹ fail 0
```

---

## 3. Veredicto
Squad 7 queda cerrada y aprobada formalmente para integración en la plataforma monorepo definitiva.

