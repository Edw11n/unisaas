# PLAN DE IMPLEMENTACION: ESTRATEGIA MULTIRRUBRO UNISAAS (BASE COMUN Y CAPACIDADES ACTIVABLES)

Documento Operativo y Arquitectonico Maestro  
Version: 1.0.0  
Fecha: 2026-10-18  
Estado: En Ejecucion - Fase 1  
Ecosistema: UNISAAS (Squads 1 a 8)  
Reglas: Cero Emojis | Cero Wireframes Genericos | Cero Placeholders | Fidelidad UI Invo Aprobada

---

## 1. RESUMEN EJECUTIVO Y PRINCIPIOS DE DISENO

UNISAAS esta disenado como una plataforma unificada para el comercio colombiano y latinoamericano. El objetivo estrategico es atender multiples rubros comerciales mediante una **base arquitectonica comun y un sistema de capacidades activables por perfil (Feature Flags / Capabilities Matrix)**, evitando la creacion de dashboards, aplicaciones o pantallas de POS duplicadas o fragmentadas.

### Principios Arquitectonicos No Negociables
1. **Nucleo Comun Indivisible**: Todos los rubros comparten la misma identidad multi-tenant, seguridad RLS en base de datos PostgreSQL, plan unico de cuentas contables (PUC Colombia), turnos de caja (pos_shifts), gestion de cartera de clientes (credito fiado), generacion de tickets termicos ESC/POS y trazabilidad de auditoria inmutable.
2. **Capacidades Activables por Perfil**: Cada comercio activa o desactiva capacidades funcionales especificas segun su perfil comercial registrado en su contrato de Tenant. La interfaz de usuario del POS y las pantallas operativas se adaptan dinamicamente sin alterar la estetica visual Invo aprobada (#F8FAFC, tarjetas blancas rounded-3xl, panel derecho de orden, tipografia editorial limpia).
3. **Cero Simulacion Cosmetica**: Queda prohibido simular soporte funcional unicamente con etiquetas de texto o mockups de productos. Cada capacidad activable esta respaldada por reglas de validacion en backend, precision de unidades en el motor de inventario y esquemas de persistencia en web (Next.js) y movil (Flutter Drift SQLite).
4. **Paridad de Contratos Web y Movil**: Los contratos de API, autenticacion JWT, idempotencia, liquidacion de impuestos y sincronizacion offline son identicos para Squad 4 (Next.js) y Squad 5 (Flutter).
5. **Enfoque Gradualista Probado de Punta a Punta**: No se liberan rubros cuyos flujos de datos no esten implementados a nivel de backend. La entrega se estructura en 4 fases progresivas.

---

## 2. INSPECCION FORENSE DEL ESTADO ACTUAL DEL REPOSITORIO

Se realizo una inspeccion integral de los modelos de datos, esquemas SQL y APIs en los 8 squads del repositorio:

### Squad 1 - Core Architecture, RLS & RBAC (`squad1_core_architecture_rls_rbac-main`)
- **Estado Actual**: La entidad `Tenant` (`src/domain/entities/tenant.entity.ts`, lineas 1-30) contiene datos de contacto, identificacion fiscal (NIT/RUT), codigo de pais y moneda. El DTO `CreateTenantDto` (`src/infrastructure/adapters/in/dtos/create-tenant.dto.ts`) valida regimenes tributarios colombianos (`REGIMEN_SIMPLE`, `RESPONSABLE_IVA`, `NO_RESPONSABLE_IVA`).
- **Brecha Detectada**: No cuenta con campos para `businessProfile` (codigo del perfil comercial) ni `capabilities` (objeto JSONB con las banderas de capacidades activas).
- **Accion Fase 1**: Extender `Tenant` y `CreateTenantDto` para almacenar y propagar el perfil y sus capacidades por defecto.

### Squad 3 - Inventory Kardex CPP (`squad3_inventory_kardex_cpp-master`)
- **Estado Actual**:
  - `unit_of_measures` (`database/schema.sql`, lineas 142-156): Cuenta con `decimal_places INTEGER DEFAULT 3` y `conversion_factor NUMERIC(18,6)`. Ya soporta unidades fraccionarias nativamente (kilos, metros, litros, fracciones).
  - `products` (`database/schema.sql`, lineas 241-265): Cuenta con `product_type_enum` (`STOCKABLE`, `SERVICE`), `sale_price NUMERIC(15,2)`, `tax_rate NUMERIC(5,2) DEFAULT 0.19`.
  - `inventory_balances` (`database/schema.sql`, lineas 335-350): Maneja `quantity_on_hand NUMERIC(18,6)`. Admite cantidades con precision fraccionaria hasta 6 decimales.
  - `third_parties` (`database/schema.sql`, lineas 93-110): Soporta `credit_limit` y `current_debt` para cartera y credito fiado.
- **Brechas Detectadas**:
  - Falta tabla de recetas/BOM (Bill of Materials) para descuento de insumos en gastronomia.
  - Falta tabla de atributos matriciales (talla, color, material) para tiendas de ropa.
  - Falta tabla de citas de servicios y ordenes de trabajo para talleres/esteticas.
- **Veredicto**: La base existente soporta plenamente la Fase 1 (Tiendas, Ferreteria/Retail y Venta Libre) y la Fase 2 (Fruver con pesaje decimal y Cafeteria con INC). Las recetas y variantes complejas deben postergarse a Fases 3 y 4.

### Squad 4 - Web Desktop POS Next.js (`squad4_web_desktop_pos_nextjs-main`)
- **Estado Actual**: El POS (`src/app/pos/page.tsx`, 1,711 lineas) posee la arquitectura Invo aprobada, navegacion lateral dock, modal de pagos con 3 metodos (Efectivo con desglose de billetes, Datáfono Debito/Credito con voucher, Billetera Digital Nequi/Daviplata/Bancolombia QR), modal de ticket termico ESC/POS con previsualizacion e impresion real, y calculadora de Venta Libre estilo Express.
- **Brecha Detectada**: La adaptacion de los rubros en `/pos` dependia de un estado local manual de prueba. Debe desacoplarse hacia un modelo formal `ProfileCapabilities` que consuma el perfil del comercio desde la sesion o configuracion del Tenant.
- **Accion Fase 1**: Formalizar `src/core/domain/models/profile-capabilities.model.ts` e inyectarlo dinamicamente en `/pos`.

### Squad 5 - Mobile POS Offline Flutter (`squad5_mobile_pos_offline-main`)
- **Estado Actual**: Base de datos Drift SQLite (`lib/core/database/database.dart`, lineas 1-123) con tablas `LocalProducts`, `SyncQueueItems` y `LocalCustomers`.
- **Brechas Detectadas**: `LocalProducts` carece de campo `productType` y marcadores para soportar venta rapida sin codigo de barras o productos no inventariables.
- **Accion Fase 1**: Actualizar la definicion Drift para sincronizar tipos de producto y permitir calculos acordes al perfil.

---

## 3. CLASIFICACION DE PERFILES EN CUATRO GRUPOS

Los perfiles comerciales de UNISAAS se estructuran en 4 familias operativas:

### Grupo 1: Tiendas y Minimercados
- **Tienda de Barrio**: Negocio tradicional de alta rotacion de efectivo, catalogo mixto (abarrotes, bebidas, golosinas), ventas rapidas de mostrador y credito fiado informal a clientes de confianza.
- **Minimercado / Supermercado de Cercania**: Comercio con autoservicio o mostrador, uso intensivo de lector de codigo de barras USB, control de inventario estricto por SKU, canasta familiar exenta (IVA 0%) y pagos mixtos.

### Grupo 2: Alimentos y Bebidas
- **Cafeteria / Panaderia**: Ventas rapidas en barra, alta velocidad de cobro, consumo inmediato, aplicacion de Impuesto Nacional al Consumo (INC 8% segun Art. 512-1 del Estatuto Tributario) y combos basicos.
- **Restaurante Tradicional / Gastro**: Servicio con atencion en mesa o mostrador, apertura de cuentas temporales, envio de comandas a cocina y bar, y control de recetas con despiece de insumos.

### Grupo 3: Comercio Especializado
- **Ferreteria / Materiales**: Venta de mostrador y obra, unidades fraccionarias (metros de cable, kilos de puntillas, tubos), catalogo extenso, listas de precios mayoristas y credito fiado formal a maestros y contratistas.
- **Fruver (Frutas y Verduras)**: Venta pesada con balanza digital, cantidades decimales en kilos, productos exentos de IVA (canasta familiar Art. 477 E.T.), precios volatiles y merma constante.
- **Papeleria / Tramites**: Mezcla de productos fisicos (cuadernos, resmas, utiles) con servicios inmediatos no inventariables (fotocopias, escaneos, impresiones, laminaciones).
- **Ropa y Accesorios (Moda)**: Gestion de inventario por matriz de atributos bidimensional (Talla / Color / Genero), codigo de barras por variante y politicas de cambios y devoluciones.

### Grupo 4: Servicios
- **Estetica / Salon de Belleza / Peluqueria**: Venta de servicios por tiempo y cita, comision a profesionales o estilistas, venta cruzada de productos cosmeticos de mostrador.
- **Taller Mecanico / Mantenimiento**: Ordenes de trabajo, recepcion de vehiculo con placa y kilometraje, diagnostico, cobro de mano de obra mas repuestos consumidos de bodega.
- **Gimnasio / Centros de Fitness**: Planes y membresias por temporalidad (mensual, tiquetera, anualidad), control de documento de identidad (CC) obligatorio y venta de hidratacion/suplementos.

---

## 4. MATRIZ EXHAUSTIVA POR PERFIL COMERCIAL

A continuacion se presenta la matriz detallada de requerimientos y capacidades tecnicas:

| Perfil Comercial | Flujo de Venta Principal | Tipos de Producto / Servicio | Unidades de Medida Clave | Control de Inventario | Metodos de Pago | Formato de Impresion | Reportes Clave | Capacidades Especificas Requeridas | Estado en Repo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tienda de Barrio** | Mostrador rapido / Teclado directo | Abarrotes, bebidas, golosinas, recargas | UND, PAQUETE, BOTELLA | Opcional / Basico | Efectivo, Nequi, Daviplata, Credito Fiado | Ticket 58mm / 80mm simplificado | Cierre de caja diario, libro de fiados | Cobro libre sin codigo, libreta fiados | Soportado (Fase 1) |
| **Minimercado** | Escaneo continuo de mostrador | Canasta familiar, enlatados, lacteos, aseo | UND, GRAMOS, BOLSA | Estricto con Kardex y alertas | Efectivo, Datafono, Nequi, Daviplata | Ticket fiscal 80mm con desglose IVA | Rotacion stock, productos agotados, fiscal | Scanner continuo USB/HID, lectura EAN13 | Soportado (Fase 1) |
| **Ferreteria** | Cotizacion y mostrador / Credito | Herramientas, insumos, materiales, tuberia | UND, METROS, KILOS, TUBO | Estricto con fracciones y lotes | Efectivo, Datafono, Transferencia, Credito Fiado | Ticket 80mm o Factura Media Carta | Cartera clientes, rotacion, listas precios | Unidades continuas (m, kg), cupos cartera | Soportado (Fase 1) |
| **Venta Libre Express** | Cobro directo por monto e importe | Montos libres, conceptos abiertos | UND, SERVICIO | Sin descuento de stock | Efectivo, Nequi, Daviplata, Datafono | Recibo digital o ticket rapido | Total recaudos, balance diario | Teclado numerico estilo Express | Soportado (Fase 1) |
| **Fruver** | Pesaje directo en mostrador | Frutas, verduras, tuberculos, granos | KILOS (3 decimales), LIBRAS, UND | Merma diaria y balance ponderado | Efectivo, Nequi, Daviplata | Ticket 80mm con peso y precio/kg | Merma diaria, costo de compra vs venta | Calculo balanza, cantidades 0.xxx kg | Fase 2 |
| **Cafeteria / Panaderia** | Venta en barra rapida | Cafes, panes, reposteria, combos | UND, PORCION, TAZA | Basico en mostrador | Efectivo, Datafono, Nequi, QR | Comanda barra y ticket cliente | Ventas por franja horaria, recaudo INC | Impoconsumo INC 8%, modificadores simples | Fase 2 |
| **Papeleria** | Mostrador mixto (items + servicios) | Utiles, resmas, fotocopias, laminaciones | UND, RESMA, PAGINA, TRAMITE | Mixto (stock para utiles, libre servicios) | Efectivo, Nequi, Daviplata | Ticket 58mm / 80mm | Ingresos por servicio vs articulos | Items de servicio no inventariables | Fase 2 |
| **Ropa y Accesorios** | Seleccion por variante en tienda | Prendas, calzado, bolsos, accesorios | UND con atributos (Talla, Color) | Matricial por variante SKU | Efectivo, Datafono, Transferencias | Ticket 80mm con politica cambios | Stock por talla/color, devoluciones | Variantes matriciales, tags de barras | Fase 3 |
| **Restaurante** | Mesas, comandas y mostrador | Platos preparados, bebidas, licores | PLATO, TAZON, BOTELLA | Descarga por receta (BOM) | Efectivo, Datafono, Propinas, Mixto | Comanda cocina/bar + Cuenta final | Ventas por mesa, costo de plato, propinas | Comandas, mesas abiertas, recetas BOM | Fase 3 |
| **Gimnasio** | Afiliacion, renovacion y barra | Membresias, tiqueteras, bebidas, suplementos | MES, TRIMESTRE, TIQUETERA, UND | Control de membresias por vigencia | Efectivo, Datafono, Transferencias | Comprobante de inscripcion | Vencimientos cartera, retencion clientes | CC obligatorio, duracion dias/sesiones | Fase 4 |
| **Estetica / Peluqueria** | Citas y mostrador de servicios | Cortes, tinturas, peinados, cosmeticos | SERVICIO, CITA, UND | Servicios libres + inventario cosmeticos | Efectivo, Nequi, Datafono | Ticket de servicio | Liquidacion comisiones, ocupacion agenda | Agenda citas, comision profesional | Fase 4 |
| **Taller Mecanico** | Orden de servicio y entrega | Mano de obra, repuestos, lubricantes | HORA, SERVICIO, UND, GALON | Estricto en repuestos de bodega | Efectivo, Datafono, Transferencia | Orden de trabajo + Factura detalle | Rentabilidad mano de obra vs repuestos | Placa vehiculo, orden de reparacion | Fase 4 |

---

## 5. SEPARACION FORMAL: BASE COMUN VS. CAPACIDADES ACTIVABLES

### A. Funciones de la Base Comun (Compartidas por el 100% de los Comercios)
1. **Identidad Multi-Tenant y Seguridad RLS**: Aislamiento estricto de base de datos garantizado por PostgreSQL Row Level Security mediante `tenant_id`.
2. **Caja y Turnos de Ventas (`pos_shifts`)**: Apertura de caja con base inicial, registro de movimientos, cierres X y Z, control de sobrantes y faltantes de efectivo.
3. **Gestion de Terceros y Cartera (`third_parties`)**: Registro universal de clientes y proveedores, con validacion de cupo de credito (`credit_limit`) y saldo adeudado (`current_debt`).
4. **Liquidacion Tributaria Centralizada en Servidor**: Desglose seguro de impuestos (Base Gravable, IVA 19%, INC 8%, Exento 0%) en el backend BFF previniendo manipulaciones del cliente.
5. **Modal de Pagos Universal**: Aceptacion homologada de Efectivo (con desglose de denominaciones), Datáfono (Debito/Credito con voucher), Billeteras Digitales (Nequi, Daviplata, QR Bancolombia) y Credito Fiado.
6. **Generacion de Tickets Termicos ESC/POS**: Generacion de bytes ESC/POS estandar (80mm y 58mm) con soporte para impresoras USB, de Red y Bluetooth, y previsualizacion en pantalla.
7. **Trazabilidad y Auditoria Inmutable**: Registro de cada transaccion en `audit_logs` con estampado de tiempo, usuario y direccion IP.

### B. Capacidades Especificas Activables (Feature Flags por Perfil)
Se define la estructura de capacidades que se activa o desactiva por configuracion de Tenant:

```typescript
export interface ProfileCapabilities {
  // Catalogo e Identificacion
  enableBarcodeScanner: boolean;       // Lector de codigo de barras USB/HID continuo
  enableManualKeypad: boolean;         // Teclado rapido de venta libre (estilo Express)
  enableFractionalUnits: boolean;      // Soporte para metros, litros y fracciones
  enableDecimalScale: boolean;         // Entrada de balanza con decimales (kg, g)
  enableProductVariants: boolean;      // Matriz de tallas y colores
  
  // Operacion y Venta
  enableCreditFiado: boolean;          // Venta fiada a credito con afectacion de cartera
  enableOrderTypeMesa: boolean;        // Servicio a mesa y comandas de salon
  enableQuickServiceItems: boolean;    // Items de servicio no inventariables (copias, mano de obra)
  enableCustomerDocRequired: boolean;  // Obligatoriedad de CC/NIT para cerrar la venta
  
  // Produccion y Servicios Avanzados
  enableRecipesBOM: boolean;           // Descarga de inventario por receta de cocina
  enableServiceAppointments: boolean;  // Modulo de citas y profesionales asignados
  enableWorkOrders: boolean;           // Ordenes de reparacion con placa/serial
  enableExpirationTracking: boolean;   // Vigencia en dias para planes y membresias
}
```

---

## 6. DIAGNOSTICO DE BRECHAS Y COMPATIBILIDAD EN EL REPOSITORIO

### Capacidades Totalmente Compatibles Hoy (Listas para Produccion)
1. **Unidades de Medida y Decimales**: `schema.sql` de Squad 3 ya cuenta con `unit_of_measures.decimal_places` y `inventory_balances.quantity_on_hand NUMERIC(18,6)`.
2. **Impuestos Colombianos**: El POS de Squad 4 y el BFF calculan con precision NIIF y Estatuto Tributario el IVA 19%, INC 8% y Exento 0%.
3. **Credito Fiado y Cartera**: Squad 3 (`third_parties`), Squad 7 (`customer_credits`) y Squad 4 ya poseen el flujo transaccional de fiados con validacion de cupo.
4. **Venta Libre Express**: La calculadora interactiva de Squad 4 procesa cobros inmediatos sin requerir codigos previos en catalogo.

### Brechas Detectadas (Requieren Nuevas Fases de Desarrollo)
1. **Recetas BOM (Gastronomia)**: El motor de inventario de Squad 3 no tiene tabla `bill_of_materials` ni trigger que descuente insumos (ej. 200g harina, 150g queso) al vender un producto preparado. *Resolucion: Programar en Fase 3.*
2. **Atributos de Moda (Talla / Color)**: Squad 3 tiene `product_variants`, pero carece de modelo generico de atributos dinamicos (EAV o JSONB de opciones). *Resolucion: Programar en Fase 3.*
3. **Agendamiento y Citas (Estetica / Gimnasio)**: No existen tablas de turnos de profesionales ni reservas horarias en la base de datos actual. *Resolucion: Programar en Fase 4.*
4. **Ordenes de Trabajo (Talleres)**: No existen entidades para registro de placas de vehiculos, estado de recepcion ni hoja de vida de mantenimiento. *Resolucion: Programar en Fase 4.*

---

## 7. PROPUESTA DE FASES DE IMPLEMENTACION

Para garantizar la estabilidad del sistema y evitar introducir deuda tecnica o dependencias innecesarias, la implementacion se ejecuta en 4 fases:

```
[FASE 1: NUCLEO MULTIRRUBRO Y CAPACIDADES ACTIVABLES (EN EJECUCION)]
├── Perfiles: Tienda de Barrio, Minimercado, Ferreteria/Retail, Venta Libre Express
├── Backend: Extension de Tenant (Squad 1) con Profile y Capabilities JSON
├── Frontend: Modelo ProfileCapabilities e inyeccion limpia en POS (Squad 4)
└── Mobile: Paridad Drift SQLite de productos y servicios (Squad 5)

[FASE 2: ALIMENTACION LIGERA Y VENTA PESADA]
├── Perfiles: Fruver (Balanza decimal en tiempo real), Cafeteria/Panaderia (INC 8%)
├── Papeleria: Items de servicio no inventariables (fotocopias, escaneos)
└── Cajas: Atajos tactiles optimizados para alta rotacion en barra

[FASE 3: MODA Y GASTRONOMIA COMPLETA]
├── Perfiles: Tiendas de Ropa/Calzado (Matriz Talla/Color), Restaurantes
├── Inventario: Motor BOM de recetas y descarga atomica de insumos (Squad 3)
└── Operacion: Salones, mesas abiertas y comanda termica para cocina (Squad 6)

[FASE 4: SERVICIOS PROFESIONALES, TALLERES Y FITNESS]
├── Perfiles: Peluquerias/Esteticas, Talleres de Mecanica, Gimnasios
├── Agendamiento: Calendario de citas y comisiones por colaborador
└── Talleres: Modulo de orden de trabajo, recepcion con placa y diagnostico
```

---

## 8. PLAN DE ACCION DETALLADO - FASE 1 (EJECUCION INMEDIATA)

### Tarea 1.1: Extension de Dominio y DTOs en Squad 1
- **Archivo**: `squad1_core_architecture_rls_rbac-main/src/domain/entities/tenant.entity.ts`
  - Agregar campos `businessProfile: string` y `capabilities: Record<string, boolean>`.
- **Archivo**: `squad1_core_architecture_rls_rbac-main/src/infrastructure/adapters/in/dtos/create-tenant.dto.ts`
  - Agregar validaciones para `businessProfile` con valores permitidos: `TIENDA_BARRIO`, `MINIMERCADO`, `FERRETERIA`, `VENTA_LIBRE`, `FRUVER`, `CAFETERIA`, `PAPELERIA`, `ROPA`, `RESTAURANTE`, `GIMNASIO`, `ESTETICA`, `TALLER`.

### Tarea 1.2: Modelo de Capacidades y Configuracion en Squad 4
- **Archivo**: `squad4_web_desktop_pos_nextjs-main/src/core/domain/models/profile-capabilities.model.ts`
  - Crear interfaz `ProfileCapabilities` y presets maestros por perfil comercial para inicializacion automatica de comercios.
- **Archivo**: `squad4_web_desktop_pos_nextjs-main/src/app/pos/page.tsx`
  - Conectar el estado del POS a las capacidades activas del comercio, adaptando dinamicamente:
    * Visibilidad de selector de mesa vs mostrador.
    * Activacion de teclado de venta libre estilo Express.
    * Campos de unidades fraccionarias (metros, tubos, bolsas).
    * Restriccion de busqueda y atajos de teclado sin romper la interfaz Invo blanca.

### Tarea 1.3: Sincronizacion de Esquema Local en Squad 5 (Flutter)
- **Archivo**: `squad5_mobile_pos_offline-main/lib/core/database/database.dart`
  - Actualizar `LocalProducts` para reflejar `productType` (`STOCKABLE`, `SERVICE`) y asegurar compatibilidad de sincronizacion con el backend unificado.

### Tarea 1.4: Verificacion, Pruebas y Actualizacion de Documentacion
- Ejecutar suite de pruebas de Squad 4: `npx tsc --noEmit` y `npm test`.
- Validar consistencia de Drift en Squad 5: `flutter analyze`.
- Actualizar el manual operativo `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` documentando la arquitectura de perfiles y capacidades.

---

## 9. ARCHIVOS AFECTADOS EN LA FASE 1

1. `squad1_core_architecture_rls_rbac-main/src/domain/entities/tenant.entity.ts`
2. `squad1_core_architecture_rls_rbac-main/src/infrastructure/adapters/in/dtos/create-tenant.dto.ts`
3. `squad4_web_desktop_pos_nextjs-main/src/core/domain/models/profile-capabilities.model.ts` (Nuevo)
4. `squad4_web_desktop_pos_nextjs-main/src/app/pos/page.tsx`
5. `squad5_mobile_pos_offline-main/lib/core/database/database.dart`
6. `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`

---

## 10. PROTOCOLO DE CALIDAD Y CRITERIOS DE ACEPTACION
- Compilacion de TypeScript en Squad 4 sin errores (0 errores de tipos).
- Ejecucion exitosa de los 61 tests unitarios existentes en Squad 4.
- Preservacion 100% integra de la estetica visual Invo blanca del POS.
- Ningun uso de emojis en codigo, mensajes, ni documentacion.
- Registro de lecciones tecnicas en memoria cognitiva Engram.
