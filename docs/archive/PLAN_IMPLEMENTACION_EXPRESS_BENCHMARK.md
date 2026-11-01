# PLAN DE IMPLEMENTACION: ECOSISTEMA MULTIRUBRO UNIVERSAL (BENCHMARK COMERCIAL)

## 1. VISION Y MODELO DE NEGOCIO MULTIRUBRO

Express alcanzo adopcion masiva en Colombia y America Latina porque no fuerza a los comercios a encajar en una estructura rigida de restaurante ni en un ERP contable complejo. Un tendero, un ferretero, una peluquera, un dueno de restaurante o el administrador de un gimnasio comparten la misma necesidad operativa diaria: **registrar ventas en segundos, saber cuanto dinero hay en caja, controlar a quien le fiaron mercancia y registrar salidas de dinero (gastos)**.

Para lograr un sistema multirubro universal en UNISAAS sin crear 6 aplicaciones aisladas, la arquitectura implementa una **Plataforma de Nucleo Comun (Universal Core)** gobernada por una **Capa de Adaptacion Dinamica por Rubro**.

---

## 2. PILARES ARQUITECTONICOS DEL MODELO EXPRESS EN UNISAAS

```
+-------------------------------------------------------------------------------------------------------+
|                                  ONBOARDING & PERFIL DE NEGOCIO                                       |
|  [Ferreteria]  [Minimarket/Fruver]  [Cafeteria/Comidas]  [Papeleria]  [Barberia/Spa]  [Gimnasio]      |
+-------------------------------------------------------------------------------------------------------+
|                                    NUCLEO COMUN UNIVERSAL                                             |
|  1. Mostrador POS Universal (Venta Libre Directa + Catalogo)                                          |
|  2. Cuadre de Caja (Apertura, Arqueo X y Cierre Z con denominaciones COP)                             |
|  3. Libreta de Clientes y Fiados (Cuentas por Cobrar + Notificacion WhatsApp)                         |
|  4. Modulo de Gastos y Compras (Salidas de Caja + Proveedores)                                        |
|  5. Comprobante Digital (Compartir WhatsApp) y Tirilla Termica ESC/POS (58mm/80mm)                    |
+-------------------------------------------------------------------------------------------------------+
|                                  CAPA DE ADAPTACION DE RUBRO                                          |
|  - Ferreteria: Unidades fraccionadas (metros, kilos) + Validador de cupo de fiado                     |
|  - Supermercado: Lector continuo EAN-13 + Descomposicion de balanza de peso (kg decimal)              |
|  - Cafeteria: Fast-Grid de botones grandes + Impuesto al Consumo (INC 8%) + Propina 10%              |
|  - Papeleria: Botonera de micro-servicios (copias, impresiones) sin restriccion de stock             |
|  - Gimnasio/Servicios: Identificacion obligatoria (CC) + Control de vigencia de planes (dias/meses)  |
+-------------------------------------------------------------------------------------------------------+
|                                  CAPA TRIBUTARIA Y CONTABLE INVISIBLE                                 |
|  - Asentamiento automatico a PUC NIIF en segundo plano (4135, 4140, 4155, 4165, 2408, 2416)          |
|  - Discriminacion automatica de bases DIAN (IVA 19%, IVA 5%, INC 8%, Exentos 0%, Excluidos 0%)       |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. FASES DE IMPLEMENTACION DETALLADAS

### FASE 1: ONBOARDING CONTEXTUAL Y SELECTOR DE RUBRO
**Objetivo:** Permitir que una empresa recien creada empiece a operar en menos de 60 segundos con configuraciones y plantillas precargadas segun su actividad.

1. **Selector de Rubro en Registro y Configuracion:**
   - Campo obligatorio en el registro de empresa (`/registro`) y en Ajustes de Empresa (`/admin/settings`):
     - `HARDWARE_STORE`: Ferreteria, Materiales, Electricos.
     - `SUPERMARKET`: Minimarket, Tienda de Barrio, Fruver.
     - `BAKERY_CAFE`: Panaderia, Cafeteria, Gastrobar, Comidas Rapidas.
     - `STATIONERY`: Papeleria, Miscelanea, Internet y Fotocopiado.
     - `BEAUTY_SALON`: Barberia, Peluqueria, Estetica, Spa.
     - `GYM_FITNESS`: Gimnasio, Centro Deportivo, Crossfit, Clases.
     - `GENERAL_SERVICES`: Talleres, Reparaciones, Servicios Profesionales.
2. **Plantillas de Catalogo Opcionales (Kits de Inicio):**
   - Ofrecer la opcion de sembrar 10 a 15 productos/servicios tipicos del rubro seleccionado para que el usuario pueda probar el mostrador de inmediato sin requerir cargar un archivo Excel.
3. **Persistencia en Base de Datos:**
   - Actualizar tabla `tenants` con `business_vertical`, `is_inc_responsible` y el objeto JSONB `pos_profile_config`.

---

### FASE 2: MOTOR DE VENTA UNIVERSAL (VENTA LIBRE + VENTA POR CATALOGO)
**Objetivo:** Eliminar la barrera de "obligatoriedad de inventario", replicando la agilidad fundamental de Express.

1. **Modo "Venta Libre / Monto Directo" (Keypad Calculadora):**
   - Una pestana o tecla rapida en el POS donde el cajero simplemente digita el valor monetario (ejemplo: `$15.000`), anade una nota opcional (ejemplo: *"Reparacion taladro"* o *"3 Almuerzos corrientes"*) y cobra de inmediato.
   - Genera una linea en el carrito sin SKU asociado, pero con liquidacion fiscal correcta.
2. **Venta por Catalogo Hibrido (Bienes Tangibles vs Servicios Intangibles):**
   - Bienes tangibles (`product_type = 'STOCKABLE'`): Descuentan Kardex en Squad 3 si el inventario estricto esta activo.
   - Servicios e intangibles (`product_type = 'SERVICE'` o `'MEMBERSHIP'`): Permiten venta con stock en cero sin arrojar alertas bloqueantes.
3. **Precision Decimal en Cantidades:**
   - Soporte para unidades fraccionadas en retail (`12.5 METROS`) y balanzas en fruver (`1.455 KG`), configurado segun `quantityDecimals` del perfil activo.

---

### FASE 3: TERMINAL POS ADAPTATIVA UNIFICADA (MOSTRADOR COMPOSABLE)
**Objetivo:** Una sola ruta Next.js (`/pos`) que renderiza los slots visuales adecuados segun el rubro del tenant.

1. **Slot Superior (Cabecera Contextual):**
   - *Ferreteria / Retail:* Barra con autofoco para escaneo de codigo de barras y busqueda predictiva por SKU.
   - *Supermercado / Fruver:* Indicador de lectura de balanza (puerto Serial o decodificador GS1 prefijo 20).
   - *Cafeteria:* Conmutador de pedido (*En Mesa*, *Para Llevar*, *Domicilio*) con numero de mesa opcional.
   - *Gimnasio / Servicios:* Campo obligatorio de busqueda de cliente por Cedula de Ciudadania (`[F4] Afiliado`).
2. **Slot Central (Area de Seleccion):**
   - *Ferreteria / Papeleria:* Matriz de alta densidad de articulos de alta rotacion (ranuras de venta rapida 1 al 8) mas listado tabular rapido.
   - *Cafeteria / Panaderia:* Grilla tactil con categorias visuales (Panes, Bebidas Calientes, Desayunos) y soporte para notas de cocina (*"Sin azucar"*, *"Termino medio"*).
   - *Gimnasio / Servicios:* Catalogo de planes con vigencia (dias/meses) y sesiones disponibles.
3. **Slot de Totales y Despacho:**
   - Panel de cobro optimizado con subpaneles para Efectivo (calculo de vuelto), Datafono (voucher) y Billeteras Digitales (Nequi/Daviplata/QR).
   - Boton de Credito Fiado con validacion inmediata de cupo disponible contra Squad 7.

---

### FASE 4: LIBRETA UNIVERSAL DE FIADOS Y NOTIFICACIONES POR WHATSAPP
**Objetivo:** Dotar a cualquier negocio de una herramienta integral para controlar el dinero en la calle.

1. **Modulo de Clientes y Cartera (`/admin/clientes`):**
   - Listado con balance consolidado: Nombre, Documento, Telefono, Limite de Credito, Deuda Actual y Cupo Disponible.
   - Registro de abonos directos: Permite abonar a una factura especifica o abonar al saldo global con emision de recibo de caja.
2. **Generador de Enlaces de Cobro por WhatsApp:**
   - Boton "Cobrar por WhatsApp" que genera la URL codificada:
     `https://wa.me/573001234567?text=Hola%20Carlos,%20le%20recordamos%20que%20presenta%20un%20saldo%20pendiente%20de%20$45.000%20en%20Ferreteria%20San%20Jorge.%20Comprobante%20No.%20F-102.`

---

### FASE 5: CUADRE DE CAJA, ARQUEO Y REGISTRO DE GASTOS
**Objetivo:** Control estricto de dinero sin requerir conocimientos contables avanzados.

1. **Control de Turnos de Caja (`/pos/turnos`):**
   - Apertura: Monto de base inicial en efectivo en gaveta.
   - Arqueo Parcial (Corte X): Consulta en tiempo real del dinero que deberia haber segun ventas en efectivo registradas menos gastos pagados en efectivo.
   - Cierre de Turno (Corte Z): Conteo ciego de billetes y monedas por denominacion colombiana ($100k, $50k, $20k, $10k, $5k, $2k, monedas) con calculo de sobrante o faltante.
2. **Registro Rapido de Gastos de Mostrador:**
   - Boton directo en el mostrador POS para registrar egresos menores:
     - Pago de almuerzos o refrigerios.
     - Pago a transportador / flete de mercancia.
     - Compra de insumos de aseo o bolsas.
   - Afecta de forma automatica el efectivo disponible en gaveta para el arqueo final.

---

### FASE 6: CUMPLIMIENTO TRIBUTARIO Y CONTABLE INVISIBLE (DIAN & PUC)
**Objetivo:** Cumplir al 100% las normas fiscales colombianas en segundo plano sin trasladar complejidad al comerciante.

1. **Mapeo Automatico a Cuentas PUC NIIF (Squad 2):**
   - Ingreso por bienes tangibles: Crédito a **413505**.
   - Ingreso por comidas y cafeterias: Crédito a **414005**.
   - Ingreso por fotocopias y documentos: Crédito a **415595**.
   - Ingreso por planes deportivos: Crédito a **416505**.
   - Ingreso por servicios personales/barberias: Crédito a **417005**.
2. **Tratamiento del Impuesto Nacional al Consumo (INC 8%):**
   - Si la empresa opera en el rubro gastronomico/cafeteria, el motor tributario aplica el 8% y acredita la cuenta **241605** (INC por Pagar), evitando la violacion de acreditar IVA (240805).
3. **Discriminacion en Tirilla Termica (Squad 6):**
   - Formateo del bloque fiscal en tirillas de 80mm y 58mm:
     - Base Gravada IVA 19% e Impuesto IVA 19%.
     - Base Gravada INC 8% e Impuesto INC 8%.
     - Subtotal Exento (Art. 477 E.T.) y Subtotal Excluido (Art. 424 E.T.).

---

## 4. CRONOGRAMA DE SPRINTS DE EJECUCION

| Sprint | Modulo / Entregable | Alcance Tecnico |
|---|---|---|
| **Sprint 1** | Selector de Rubro & Config | DDL en Postgres, enums en Squad 1 y selector de actividad comercial en `/registro` y `/admin/settings`. |
| **Sprint 2** | Venta Libre & Precision | Keypad de monto rapido en el POS, soporte decimal (kg/m) y coexistencia de articulos tangibles vs servicios. |
| **Sprint 3** | Slots Adaptativos POS | Reemplazo del layout monolitico gastronomico por la arquitectura modular `<PosWorkspace />` con conmutador dinamico. |
| **Sprint 4** | Cartera & WhatsApp | Notificaciones de cobro por WhatsApp, registro de abonos y bloqueo por cupo en mostrador. |
| **Sprint 5** | Arqueo Z & Gastos | Apertura, retiro de gastos menores de mostrador y Cierre Z con desglose por denominacion en COP. |
| **Sprint 6** | Motor DIAN / PUC Invisible | Enrutamiento contable formal para IVA 19% e INC 8% en Squad 2 y discriminacion en tirillas termicas de Squad 6. |

---

## 5. CRITERIOS DE EXITO Y VALIDACION
1. **Tiempo de Creacion de Cuenta:** Un usuario puede registrar su negocio, elegir su rubro y realizar su primera venta en menos de 2 minutos.
2. **Independencia de Catalogo:** Se pueden procesar transacciones tanto con productos pre-cargados como con venta libre por valor directo.
3. **Fidelidad Fiscal:** Ni un solo peso de INC 8% se confunde contablemente con IVA 19%.
4. **Resiliencia Operativa:** La interfaz de mostrador responde a atajos de teclado fisicos, lectores de codigo de barras USB y pantallas tactiles en tablets y moviles.

---

## 6. REGISTRO DE IMPLEMENTACION Y VERIFICACION (COMPLETO)
- **Fecha:** Octubre 18, 2026.
- **Modulos Creados y Desplegados:**
  1. `src/core/domain/models/business-vertical.model.ts`: Modelo formal de 6 rubros comerciales y 5 esquemas fiscales.
  2. `src/core/domain/constants/vertical-configs.ts`: Matriz de parametros de venta, impuestos y modos operativos.
  3. `src/core/domain/utils/tax-calculator.ts`: Motor de calculo con desagregacion NIIF, cubos fiscales independientes y propina voluntaria Ley 1935.
  4. `src/components/pos/fast-amount-keypad.tsx`: Teclado numerico para Venta Libre Directa estilo Express ($ COP, billetes rapidos, conceptos y selector tributario).
  5. `src/components/pos/vertical-catalog-grid.tsx`: Grilla de catalogo dinamico filtrada por rubro, soporte de pesaje decimal en balanza (kg) y vigencias.
  6. `src/components/pos/rubro-switcher-bar.tsx`: Conmutador interactivo superior para alternar live entre los 6 modos.
  7. `src/components/pos/pos-header.tsx`: Cabecera adaptativa con razon social dinamica por rubro, turno de caja y RLS.
  8. `src/components/pos/transaction-ledger.tsx`: Tabla de transacciones con badges de Venta Libre, Balanza, notas y discriminacion de tasa impositiva.
  9. `src/components/pos/order-totals-panel.tsx`: Liquidacion financiera con desglose NIIF/DIAN multirubro y selector de propina voluntaria para gastronomia.
  10. `src/app/pos/page.tsx`: Workspace universal consolidado con docking lateral unificado con /admin, atajos F-keys globales y modales.
- **Verificacion de Compilacion:** `npx tsc --noEmit` completado con 0 errores de tipo.
- **Verificacion de Pruebas Automatizadas:** `npm test` ejecutado con 11 suites pasadas, 98 pruebas unitarias e integrales exitosas (0 fallos).

---

## 7. AUDITORIA COMPARATIVA Y MODELO OPERATIVO: EXPRESS VS UNISAAS

### 7.1. Tabla Comparativa de Arquitectura Operativa

| Dimension Operativa | Como opera el modelo Express | Enfoque Original UniSaaS | Solucion Implementada (Modelo Hibrido UniSaaS) |
|---|---|---|---|
| **Identificador del Usuario** | Exige estrictamente Nombre, Celular (+57) y Correo electronico real en Perfil. No existe usuario personalizado. | Exigia nombres de usuario manuales y correos locales. | **Vinculacion directa con correo real (Gmail/institucional) y Celular.** Soporte para sugerir correos con el nombre de la empresa (ej. `caja1.tienda@gmail.com`). |
| **Activacion de Colaboradores** | El vendedor descarga la app o entra a la web con su correo/telefono registrado desde su propio dispositivo. | Codigo temporal manual de un solo uso entregado por el dueno. | **Activacion dual:** El dueno registra al empleado con correo y clave/PIN directo, o permite que el empleado cree su acceso. |
| **Mostrador Compartido y Turnos** | Selector desplegable directo de **"Empleado encargado"** al abrir/cerrar caja y cobrar, sin pedir PIN ni cerrar sesion de Windows/Navegador. | Exigia cerrar sesion individual o login estricto de usuario por cajero. | **Selector directo de Empleado Encargado en la cabecera del POS.** En una sola terminal compartida, cualquier vendedor selecciona su nombre de la lista desplegable en 1 clic; todas las ventas y tickets se firman con su nombre sin pedir PIN ni reiniciar la app. |
| **Identificacion de Negocio** | Esquina superior izquierda con nombre del comercio, rol debajo (ej. *Propietario*) y boton *+ Agregar otro negocio*. | Barra lateral generica con nombre estatico. | **Esquina superior izquierda alineada al estandar Express:** Muestra el nombre comercial de la tienda activa, el rol del usuario debajo (*Dueño / Propietario*) y el boton selector de negocio. |
| **Historial de Cierres y Descuadres** | Indicador *Caja abierta*, resumen de caja y pestana *Cierres de caja* en Balance con nota aclaratoria obligatoria si hay descuadre. | Pantalla de balance financiera sin desglose por arqueos de turno. | **Pestaña doble en `/admin/balance`:** 1. *Flujo de Caja y Balance General* vs. 2. *Cierres de Caja (Historial de Turnos)*. Modal de arqueo con calculo en tiempo real de faltante/sobrante y obligatoriedad de nota aclaratoria si existe descuadre. |
| **Salida Segura de Sesion (Logout)** | Cierre de sesion disponible en perfil sin quedar atrapado en bucles. | Dificultad para salir al login por tokens residuales o botones ocultos en el pie de pagina. | **Boton "Cerrar Sesion" visible en la cabecera superior y barra lateral de todas las vistas** (`/admin`, `/pos`, `/platform-admin`, `/admin/settings`), purgando cookies con rutas raiz y limpiando el almacenamiento local. |

### 7.2. Detalle de la Solucion de Turnos en Mostrador (Caja Compartida)
1. **Velocidad sin friccion:** En las tiendas fisicas, supermercados y ferreterias, cambiar de turno o que un companero cubra a otro 15 minutos no puede requerir cerrar sesion en la computadora ni digitar credenciales complejas.
2. **Firma automatica de transacciones:** Al cambiar el "Empleado Encargado" en el selector superior del POS, el estado persiste en `localStorage` (`unisaas_active_cashier`). Cada ticket emitido, comanda o comprobante asocia inmediatamente el nombre del empleado activo.
3. **Control en Arqueo:** Al momento del Cierre de Caja en `/admin/balance`, se selecciona el empleado que entrega el turno, se digita el efectivo contado y el sistema calcula la diferencia (Cuadre Exacto, Faltante o Sobrante). Si hay descuadre, el campo de observaciones es de diligenciamiento forzoso para asegurar la auditoria.
