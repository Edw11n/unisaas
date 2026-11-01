# PLAN MAESTRO DE IMPLEMENTACION Y ARQUITECTURA - ECOSISTEMA UNISAAS
**Documento Tecnico Operativo y Ruta de Entrega de Software**
**Rol:** Arquitecto Principal, Tech Lead y Responsable de Entrega SaaS
**Proyecto:** UniSaaS (c:\Users\MONCAYO\Desktop\UNISAAS)
**Fecha de Actualizacion:** 18 de octubre de 2026
**Version:** 2.0.0-PROD-PLAN (Incorporacion de Hallazgos Benchmark Comercial y Arquitectura Operativa)
**Estado:** PENDIENTE DE APROBACION FORMAL POR EL PROPIETARIO

---

## 1. CAMBIOS INTRODUCIDOS POR LOS NUEVOS HALLAZGOS (BENCHMARK COMERCIAL)

Esta version 2.0.0 actualiza el plan maestro incorporando el analisis comparativo de capacidades comerciales, operativas y de experiencia de usuario basadas en el benchmark de referencia comercial, manteniendo de forma innegociable la prioridad de seguridad, aislamiento multi-tenant y persistencia real de datos verificada en el repositorio.

### Registro de Modificaciones respecto a la Version 1.0.0
1. **Separacion Formal de Perfiles de Identidad:** Se incorpora en la arquitectura la segregacion estricta entre el **Perfil de Cuenta del Usuario** (persona natural: nombre, apellido, documento personal, movil con prefijo E.164, credenciales) y el **Perfil del Negocio / Tenant** (persona juridica o establecimiento comercial: razon social, nombre comercial, NIT/RUT, categoria comercial, direccion fisica y regimen fiscal).
2. **Flujo de Onboarding Asistido No Bloqueante:** Se disena un asistente de bienvenida de 3 pasos para la creacion del negocio que permite al comerciante realizar su primera venta en menos de 2 minutos sin exigir campos tributarios avanzados ni resoluciones complejas desde el inicio.
3. **Estrategia de Categorias Comerciales (Anti-Fragmentacion):** Se establece la regla arquitectonica de **Cero Creacion de 39 Sistemas Aislados**. Se define un catalogo dinamico de categorias configurables con opcion "Otro" y capacidad de reasignacion sin perdida de datos, respaldado por una matriz de capacidades tecnicas activables (`ProfileCapabilities`).
4. **Modulo de Balance como Centro de Comando Operativo:** Se define la arquitectura del modulo `/admin/balance` para control de flujo de caja diario en tiempo real (Ventas, Gastos, Balance Neto, Cartera activa y tabla unificada de movimientos con filtros rapidos), diferenciandolo explicitamente de los Estados Financieros formales NIIF (Balance General y P&L de Squad 2).
5. **Matriz de Configuraciones por Dominio:** Se desglosan y clasifican todas las configuraciones del sistema (Perfil, Negocio, Planes, Impuestos, Catalogo Digital, Estadisticas, Inventario, Notificaciones/Sonidos e Impresion), especificando su alcance, almacenamiento y nivel de inclusion (MVP vs Fase Posterior).
6. **Sistema de Notificaciones Auditivas y Visuales Accesibles:** Se definen alertas sonoras deterministas via Web Audio API para confirmacion de cobro, escaneo de codigo de barras y advertencias operativas, tratadas como mejoras de usabilidad desacopladas que nunca bloquean la transaccion de venta.
7. **Politica de Planes y Monetizacion del SaaS:** Se estructura el modelo de suscripcion en base de datos (`plans` y `tenant_subscriptions`), pero se establece que para el MVP Operable y el Piloto el motor de cobro se mantendra deshabilitado mediante una directiva global (`BILLING_ENFORCEMENT_ENABLED = false`), evitando bloqueos ficticios o muros de pago prematuros sin decision del propietario.
8. **Mantenimiento Estricto de Prioridades P0:** Se ratifica que las tareas de contencion de seguridad (cierre de BOLA en Squad 7), reparacion del falso exito de checkout en Squad 4, y persistencia de facturas en PostgreSQL en Squad 6 se mantienen en las Fases 0, 1 y 2, antes de cualquier desarrollo de interfaz comercial.
9. **Ratificacion Absoluta de Cero Inteligencia Artificial:** Se excluyen de forma definitiva todos los componentes de IA mencionados en benchmarks o literatura externa (OCR inteligente de facturas, asistentes conversacionales, generacion de imagenes por IA o creadores de sitios por IA). Toda automatizacion se resuelve mediante metodos deterministas (validaciones de esquema, importacion CSV RFC 4180 y reglas de negocio matematicas).

---

## 2. REGISTRO DE SUPUESTOS ANADIDOS Y DESCARTADOS

### Supuestos Confirmados y Anadidos
- **S-01 (Onboarding Progresivo):** Un usuario recien registrado puede omitir la configuracion avanzada de resoluciones DIAN o inventario inicial y comenzar a vender inmediatamente utilizando el modo de Venta Libre Directa (teclado numerico por importe).
- **S-02 (Separacion de Balance Operativo vs Contabilidad NIIF):** El comerciante de mostrador requiere visibilidad inmediata de entradas y salidas de efectivo del dia (`/admin/balance`), mientras que la contabilidad por partida doble (PUC 4135, 2408, 1105) corre de manera transparente e invisible en Squad 2.
- **S-03 (Categorias como Metadatos de Negocio):** La categoria comercial seleccionada clasifica al comercio y precarga valores sugeridos de operacion, pero no bloquea el uso de ninguna herramienta estandar ni presupone la existencia de modulos especializados no construidos.
- **S-04 (Configuraciones de Dispositivo en Cliente):** Preferencias como sonidos de caja, atajos de teclado y ancho de papel de tirilla (58mm/80mm) se almacenan en el navegador local (`LocalStorage`), evitando llamadas innecesarias al backend.

### Supuestos Descartados
- **S-DESC-01 (Descartado: Desarrollo de 39 Modulos Verticales):** Se descarta por inviabilidad arquitectonica y economica construir flujos de trabajo aislados para cada categoria del mercado. Se adopta el modelo de un solo nucleo transaccional universal adaptable.
- **S-DESC-02 (Descartado: Muros de Pago en MVP):** Se descarta bloquear funciones basicas del sistema (como limite de productos o clientes) en el MVP bajo un esquema "Freemium" simulado. Todas las caracteristicas del MVP seran 100% operables durante el piloto.
- **S-DESC-03 (Descartado: Dependencia Critica de Sonidos):** Se descarta condicionar la confirmacion de una transaccion a la reproduccion exitosa de un audio web, previniendo bloqueos en navegadores con politicas restrictivas de autoplay.

---

## 3. DEFINICION DE "OPERABLE"

Para erradicar ambiguedades tecnicas, un modulo o flujo en UniSaaS no se considera "operable" porque su pantalla cargue componentes o muestre un diseno atractivo. "Operable" exige que la logica de negocio procese datos contra servicios de backend activos, persista de manera transaccional en PostgreSQL, sobreviva a reinicios sin perdida de informacion, aplique aislamiento multi-tenant estricto en el servidor y maneje fallos de forma segura sin simular exitos ficticios.

Se establecen tres compuertas progresivas de operabilidad:

### A. Operable en Ambiente Staging (Entorno de Pruebas Integradas)
1. Los 8 escuadrones compilan sin errores de tipado TypeScript (`tsc --noEmit`) y ejecutan en contenedores Docker orquestados.
2. La variable `NEXT_PUBLIC_USE_MOCKS` se encuentra en `false`. Cero consumo de adaptadores sinteticos o colecciones `useState` para datos transaccionales.
3. El frontend Next.js 15 (`squad4`) se comunica con el backend a traves de su BFF resolviendo llamadas reales a los microservicios de Auth (puerto 3001), Contabilidad (puerto 3002), Inventario (puerto 3003), Facturacion (puerto 3006) y Cartera (puerto 3007).
4. El aislamiento multi-tenant se valida con pruebas automatizadas de penetracion: ningun tenant puede leer, modificar ni inferir registros de otro tenant mediante llamadas API directas o manipulacion de cabeceras/cuerpos.
5. El ciclo de venta en mostrador descuenta stock real en Kardex (Squad 3), emite factura con consecutivo unico persistente (Squad 6) y asienta balance contable en partida doble (Squad 2). Si cualquier paso intermedio falla, la transaccion se revierte de forma atomica o compensatoria y el cajero recibe un mensaje de error claro sin perdida del carrito.

### B. Operable para Piloto con Comercios Reales
1. Flujo completo de registro y activacion de comercio sin intervencion manual en base de datos (Onboarding guiado).
2. Catalogo de productos y categorias importable via archivo CSV con validaciones deterministas de formato, unicidad de SKU y codigos de barras, con soporte de Venta Libre Directa sin inventario previo.
3. Control estricto de caja: apertura de turno con efectivo base verificado, registro de ingresos/egresos y arqueo de cierre con reporte de diferencias (sobrantes y faltantes).
4. Persistencia garantizada de facturas y recibos en disco/PostgreSQL; un reinicio de servidores no altera consecutivos ni elimina ventas.
5. Modulo de Balance Operativo en tiempo real con calculo exacto de ventas, gastos, balance neto y libro de cartera por cobrar/pagar.
6. La aplicacion web es instalable como PWA en escritorios y tabletas; la emision de tickets genera salida compatible con impresoras termicas POS (58mm/80mm) y comprobante digital legible para compartir por WhatsApp.
7. Copias de seguridad (backups) automaticas diarias de base de datos probadas mediante restauracion exitosa en un entorno aislado.

### C. Operable en Produccion General (Disponibilidad Comercial)
1. Monitoreo 24/7 activo con Prometheus y Grafana (con autenticacion segura obligatoria), alertamiento de latencia, tasa de errores HTTP 5xx y saturacion de disco.
2. Rotacion completa de secretos y llaves criptograficas de produccion; cero credenciales por defecto en variables de entorno o repositorios.
3. Planes y limites de uso del SaaS aplicados en tiempo de ejecucion en el backend si el propietario aprueba el modelo comercial.
4. Procedimiento documentado y probado de despliegue sin caida de servicio (Zero-Downtime Deployment) y plan de retorno seguro (Rollback) ante fallas.

---

## 4. ESTADO VERIFICADO DEL REPOSITORIO (LINEA BASE TECNICA)

La reinspeccion exhaustiva del codigo fuente y del entorno local confirma los siguientes hechos tecnicos:

### Hechos Confirmados en Repositorio
1. **Modo Mock Activo en Frontend:** En `squad4_web_desktop_pos_nextjs-main/.env.local` y `.env`, la directiva `NEXT_PUBLIC_USE_MOCKS=true` se encuentra habilitada por defecto. En `src/app/api/auth/login/route.ts:113-178` y `src/app/api/checkout/route.ts:354-361`, el sistema intercepta las peticiones de autenticacion y checkout dirigiendolas hacia `MockPosAdapter` en memoria.
2. **Consolas de Administracion Desconectadas:**
   - `/admin/inventory/page.tsx:213-230`: Productos, categorias y kardex residen en `useState` inicializados con `DEMO_PRODUCTS` y `DEMO_CATEGORIES`.
   - `/admin/clients/page.tsx:53-165`: Directorio de clientes y abonos de deuda modifican unicamente el arreglo en memoria.
   - `/admin/gastos/page.tsx:46-145`: Comprobantes de egreso operan en memoria local.
   - `/admin/invoices/page.tsx:35-104`: Listado de ventas y anulaciones no tienen conexion a API.
   - `/admin/reportes/page.tsx:10-35`: Tablas y graficos de reporte usan datos hardcodeados y el boton de exportacion solo dispara `alert()`.
   - `/platform-admin/page.tsx:73-180`: Tablas de tenants, salud de squads y eventos de auditoria son listas estaticas en React.
3. **Ruptura de Contratos en la Saga de Venta:**
   - En `squad4/src/app/api/checkout/route.ts:418`, el BFF envia `items: [...]` a Squad 3. En `squad3/src/presentation/dto/movements/dispatch-stock.dto.ts`, el endpoint `/inventory/moves/dispatch` exige el campo `lines: [...]` y tiene activo `forbidNonWhitelisted: true`, lo que causa rechazo 400 Bad Request en modo real.
   - En `squad4/src/app/api/checkout/route.ts:458`, el BFF intenta causar en Squad 2 antes de emitir la factura en Squad 6, enviando datos sin `invoiceId` ni `invoiceConsecutive`. En `squad2/src/infrastructure/adapters/in/dtos/sales-pos-causation.dto.ts:6-15`, ambos campos son `@IsNotEmpty()` y validan UUID y string, provocando rechazo 400 Bad Request.
4. **Falso Exito en Interfaz POS:**
   - En `squad4/src/app/pos/page.tsx:710-760`, la llamada a `/api/checkout` no valida `if (!res.ok)`. Si el backend responde 400, 401 o 500, o si ocurre una excepcion de red capturada por `catch`, la interfaz ejecuta `setLastTicket(...)`, muestra el modal de ticket exitoso y vacia el carrito (`setCart([])`).
5. **Persistencia Volatil en Facturacion:**
   - En `squad6_reports_audit_escpos-develop/src/application/services/invoices.service.ts:38-39`, las facturas se guardan en `private readonly inMemoryInvoices = new Map<string, StoredInvoice>()` y el consecutivo es `sequenceCounter = 100001`. No hay conexion a base de datos en `squad6/src/app.module.ts`.
6. **Vulnerabilidad BOLA en Cartera y Compras:**
   - En `squad7/src/infrastructure/adapters/in/credits.controller.ts:43-85` y `purchases.controller.ts:52-95`, no existen decoradores `@UseGuards(JwtAuthGuard)`. Los metodos reciben `tenantId` como parametro de consulta o cuerpo y llaman a `set_config('app.current_tenant_id', tenantId, true)` sin validar el token del emisor.
7. **Aplicacion Movil Flutter Desconectada:**
   - En `squad5/lib/features/pos/presentation/pos_screen.dart:780-791`, la accion de cobro unicamente ejecuta `_cart.clear()` y muestra un `SnackBar`. No interactua con Drift SQLite ni con `SyncQueueWorker`.
8. **Seguridad Operativa y Secretos:**
   - `squad8/docker-compose.yml:102-103` define `GF_AUTH_ANONYMOUS_ENABLED: "true"` con `GF_AUTH_ANONYMOUS_ORG_ROLE: "Admin"`.
   - Secretos compartidos en texto plano (`[SECRETO_ROTADO_2026-10-21]`) en archivos `.env` y de configuracion.

---

## 5. MATRIZ DE CLASIFICACION DE FUNCIONALIDADES (BENCHMARK COMERCIAL VS UNISAAS)

A continuacion se clasifica cada funcionalidad evaluada segun su pertinencia y nivel de prioridad para el ciclo de vida de UniSaaS:

| Funcionalidad / Modulo Evaluado | Clasificacion de Alcance | Estado en Repo UniSaaS | Justificacion Tecnica y de Negocio |
|---|---|---|---|
| **Cierre de Brechas de Seguridad (BOLA, Grafana, Checkout)** | **Bloqueante de MVP (P0)** | Vulnerable / Defectuoso | Condicion sine qua non antes de tocar datos de comercios reales. |
| **Persistencia Relacional de Facturas (Squad 6)** | **Bloqueante de MVP (P0)** | Volatil en Memoria | Evita perdida total de consecutivos y comprobantes fiscales. |
| **Onboarding Asistido (3 Pasos: Usuario, Negocio, Base)** | **Bloqueante de MVP (P1)** | No implementado | Permite al comercio empezar a operar sin intervencion manual en BD. |
| **Separacion Perfil Usuario vs Perfil Negocio** | **Bloqueante de MVP (P1)** | Parcial en Squad 1 | Desacopla la identidad personal de la razon comercial y tributaria. |
| **Venta Libre Directa (Monto sin SKU en POS)** | **Bloqueante de MVP (P1)** | Mockeado en UI | Requisito critico para agilidad de venta sin obligar a cargar catalogo. |
| **Turnos de Caja (Apertura, Arqueo X, Cierre Z)** | **Bloqueante de MVP (P1)** | Backend parcial, UI mock | Control diario del efectivo fisico y prevencion de descuadres. |
| **Modulo de Balance Operativo Diario** | **Deseable para Piloto (P1)** | Mockeado en `/admin` | Centro de comando financiero rapido (Ventas, Gastos, Neto, Fiados). |
| **Catalogo de Categorias Configurables + "Otro"** | **Deseable para Piloto (P1)** | Hardcodeado en modelo | Permite clasificar negocios y precargar configuraciones sin rigidez. |
| **Notificaciones Auditivas y Visuales No Bloqueantes** | **Deseable para Piloto (P2)** | No implementado | Mejora la experiencia y velocidad del cajero en mostrador. |
| **Impresion de Tirilla Termica Web (58mm/80mm)** | **Deseable para Piloto (P1)** | Formateador listo en Sq6 | Entrega de comprobante fisico de venta al cliente. |
| **Compartir Comprobante por WhatsApp** | **Deseable para Piloto (P2)** | No implementado | Enlace URL determinista directo hacia la API `wa.me`. |
| **Gestion de Creditos Fiados y Limites de Cupo** | **Deseable para Piloto (P1)** | Controlador listo en Sq7 | Registro y cobro de cartera a clientes de confianza. |
| **Gastos Menores y Salidas de Caja** | **Deseable para Piloto (P2)** | Mockeado en UI | Deduccion automatica del saldo en caja para el arqueo final. |
| **Catalogo Digital Publico para Clientes** | **Fase Posterior (P2)** | No implementado | Vitrina web de solo lectura para pedidos telefonicos o WhatsApp. |
| **Planes y Facturacion SaaS (Muros de Pago)** | **Sujeto a Decision (P2)** | No implementado | Depende de la politica de monetizacion formal del propietario. |
| **Facturacion Electronica DIAN / Proveedor Tecnologico** | **Sujeto a Decision (P2)** | No implementado | Requiere contratacion de firma digital y resoluciones DIAN por pais. |
| **Variantes Complejas de Producto (Talla/Color)** | **Fase Posterior (P3)** | Entidad base en Sq3 | Requerido unicamente para rubros de moda y calzado. |
| **Recetas y Descarga de Insumos (BOM Gastronomia)** | **Fase Posterior (P3)** | No implementado | Requiere motor de despiece para restaurantes avanzados. |
| **Ordenes de Servicio / Talleres con Placa** | **Fase Posterior (P3)** | No implementado | Flujo especializado para mecanica y reparaciones. |
| **Membresias y Planes de Gimnasio por Vigencia** | **Fase Posterior (P3)** | No implementado | Flujo especializado para control de acceso deportivo. |
| **Asistentes de Inteligencia Artificial / Chatbots** | **Fuera de Alcance Definitivo** | No existe (Prohibido) | Restriccion vinculante del producto: Cero consumo de IA. |
| **Lectura OCR de Facturas con IA** | **Fuera de Alcance Definitivo** | No existe (Prohibido) | Restriccion vinculante del producto: Reemplazado por CSV y formularios. |
| **Generador de Productos o Imagenes con IA** | **Fuera de Alcance Definitivo** | No existe (Prohibido) | Restriccion vinculante del producto: Cero llamadas a servicios de IA. |

---

## 6. DECISIONES PENDIENTES DEL PROPIETARIO (AMPLIADAS)

Las siguientes decisiones tecnicas y comerciales condicionan el alcance y la ejecucion. Se presentan con opciones estructuradas y recomendacion provisional del equipo de arquitectura:

### Decision D-01: Pais Objetivo Inicial y Regimen Tributario
- **Opciones:**
  - A) Lanzamiento exclusivo en **Colombia** (Moneda COP, NIT/CC con digito de verificacion, IVA 19%/5%, Impuesto Nacional al Consumo INC 8%, redondeo legal al peso). [Recomendado]
  - B) Arquitectura **Multinacional Neutra** desde el inicio (Moneda, impuestos y formatos configurables libremente por tenant).
- **Impacto:** La opcion A simplifica radicalmente los calculos contables (PUC 4135, 2408, 2416) y la carga de productos. La opcion B exige motores dinamicos de liquidacion tributaria.
- **Recomendacion Provisional:** Opcion A (Colombia como ancla de diseno para el MVP, con codigos ISO COP/COL en base de datos para no bloquear migracion internacional futura).
- **Trabajo Bloqueado:** Estructuracion final de las pantallas de ajustes fiscales y reglas de redondeo monetario en mostrador. El trabajo de seguridad, persistencia e inventario puede avanzar de inmediato.

### Decision D-02: Alcance de Facturacion Electronica
- **Opciones:**
  - A) **Solo Documento Equivalente / Ticket POS interno** (sin envio a autoridades tributarias). Emision de tirilla digital y fisica con consecutivo controlado por el negocio. [Recomendado]
  - B) **Integracion con Proveedor Tecnologico de Facturacion Electronica** (ej. The Factory HKA, Factus, Siigo API o DIAN directa).
- **Impacto:** La opcion B anade 4 a 6 semanas de desarrollo, generacion de XML UBL 2.1, certificado de firma digital y validacion previa.
- **Recomendacion Provisional:** Opcion A para el MVP Operable. La emision de ticket interno resuelve el 95% de la operacion diaria de tiendas de barrio, papelerias, cafeterias y ferreterias.
- **Trabajo Bloqueado:** Ninguno en Fase 1 y 2. La integracion DIAN queda aislada en Fase 5.

### Decision D-03: Estrategia de Conexion (Online-First vs Offline Estricto)
- **Opciones:**
  - A) **Online-First (Recomendado):** La aplicacion Web Desktop POS opera conectada a internet. Si se interrumpe la red, el sistema bloquea transacciones de forma segura impidiendo desbalances de inventario y caja. La app movil se alinea a este esquema inicialmente.
  - B) **Offline-First Completo en Web y Movil:** Almacenamiento local distribuido en IndexedDB/Drift, resolucion de conflictos de stock concurrente y sincronizacion bidireccional posterior.
- **Impacto:** La opcion B multiplica por 3 el esfuerzo de pruebas y exige algoritmos complejos de deteccion de colisiones de stock.
- **Recomendacion Provisional:** Opcion A para el MVP. Brinda predictibilidad contable y control riguroso de caja.
- **Trabajo Bloqueado:** Arquitectura del `SyncQueueWorker` movil. La web avanza bajo esquema online.

### Decision D-04: Metodo de Impresion de Tickets en Mostrador
- **Opciones:**
  - A) **Impresion Web Estandar:** El navegador abre la ventana de impresion del sistema operativo formateada a ancho de tirilla (80mm/58mm). [Recomendado]
  - B) **Driver Termico ESC/POS Silencioso:** Instalacion de un agente local (o servicio WebSocket/RawBT) que se comunica directamente por puerto serie/USB/Red con la impresora sin abrir dialogos emergentes.
- **Impacto:** La opcion A es universal y no requiere software adicional en el cliente. La opcion B da velocidad de mostrador pero requiere agentes locales por maquina.
- **Recomendacion Provisional:** Opcion A como base garantizada, dejando listo el generador de bytes ESC/POS en Squad 6 para clientes que configuren puente RAW.
- **Trabajo Bloqueado:** Ninguno; ambos metodos comparten la misma logica de formateo de ticket.

### Decision D-05: Nivel de Multi-Sucursal para el MVP
- **Opciones:**
  - A) **Comercio Mono-Tienda (Una sucursal y una bodega por tenant):** Simplifica menus, asignaciones de usuario y liquidacion de stock. [Recomendado]
  - B) **Multi-Sucursal Activa:** Selector de sede en cabecera, transferencias entre bodegas y reportes consolidados/separados.
- **Impacto:** El esquema de base de datos ya soporta multi-sucursal; la diferencia radica en la complejidad de la interfaz de usuario.
- **Recomendacion Provisional:** Opcion A para la interfaz del mostrador (asignando automaticamente la sucursal principal), manteniendo el soporte en backend.
- **Trabajo Bloqueado:** Modulo de traslados de mercancia.

### Decision D-06: Modelo de Planes SaaS (Gratuito vs Pago Pro) y Limites Operativos
- **Opciones:**
  - A) **MVP sin Bloqueos de Pago (Recomendado):** Durante el MVP y la fase piloto, todos los comercios registrados acceden al 100% de las funciones operativas sin limites de productos, clientes ni ventas. La configuracion de facturacion SaaS se mantiene inactiva (`BILLING_ENFORCEMENT_ENABLED = false`).
  - B) **Freemium Estricto desde el Dia 1:** Aplicar limites duros (ej. maximo 50 productos, 1 usuario y 100 ventas/mes en version gratis; suscripcion Pro obligatoria para mas).
- **Impacto:** La opcion B exige construir pasarela de suscripciones (Wompi, Stripe o PSE), pantallas de precios y gestion de cortes de servicio.
- **Recomendacion Provisional:** Opcion A. Prioriza la adopcion y validacion operativa real antes de levantar barreras comerciales.
- **Trabajo Bloqueado:** Pantallas de suscripcion `/admin/billing` y compuertas de autorizacion por cuotas.

### Decision D-07: Catalogo de Categorias Comerciales y Nivel de Especializacion
- **Opciones:**
  - A) **Catalogo Universal Parametrizable con 6 Familias y Opcion "Otro" (Recomendado):** Categorias generales agrupadas (Abarrotes, Gastronomia, Moda, Ferreteria/Construccion, Servicios, Otro) que configuran banderas de interfaz pero no crean 39 sistemas independientes.
  - B) **Arbol Completo de 39 Categorias Especificas con Flujos Dedicados:** Construir interfaces y modelos especializados para cada rubro del mercado.
- **Impacto:** La opcion B generaria una deuda tecnica inmanejable y fragmentaria. La opcion A entrega flexibilidad inmediata.
- **Recomendacion Provisional:** Opcion A. La categoria sirve para clasificar y precargar valores sugeridos, permitiendo cambiar de categoria en cualquier momento sin perder datos.
- **Trabajo Bloqueado:** Pantalla de seleccion de categoria en onboarding.

### Decision D-08: Alcance del Modulo de Balance Operativo
- **Opciones:**
  - A) **Balance Operativo Integrado de Mostrador (Recomendado):** Vista centralizada en `/admin/balance` que consolida en tiempo real Ventas, Gastos, Balance Neto, Cuentas por Cobrar y Turnos de Caja con filtros rapidos de tiempo y boton de nuevo movimiento.
  - B) **Dependencia Exclusiva de Reportes Contables NIIF:** Obligar al usuario a interpretar el Balance General y el Estado de Resultados de Squad 2.
- **Impacto:** La opcion A ofrece la simplicidad que hizo exitoso a Express en el comercio minorista.
- **Recomendacion Provisional:** Opcion A como centro operativo diario, dejando los reportes NIIF para el contador del negocio.
- **Trabajo Bloqueado:** Desarrollo del componente `<OperationalBalanceHub />`.

### Decision D-09: Modelo de Captura en Onboarding (Datos Personales vs Comerciales)
- **Opciones:**
  - A) **Captura Minima No Bloqueante en 3 Pasos (Recomendado):** Paso 1: Datos personales basicos del dueno (Nombre, Celular E.164, Correo, Password). Paso 2: Datos comerciales basicos (Nombre del negocio, Categoria inicial). Paso 3: Moneda y Base de Caja opcional. Los datos fiscales (NIT, regimen, direccion) se completan despues en Ajustes.
  - B) **Captura Exhaustiva Previa:** Exigir RUT, resolucion DIAN, direccion legal y certificado bancario antes de permitir la primera venta.
- **Impacto:** La opcion B produce una tasa de abandono superior al 70% en el onboarding.
- **Recomendacion Provisional:** Opcion A.
- **Trabajo Bloqueado:** Componente visual `/register/onboarding`.

---

## 7. ARQUITECTURA OBJETIVO Y CONTRATOS TECNICOS

### A. Matriz de Fuentes de Verdad por Dominio (Zero Data Duplication)

| Dominio / Entidad | Escuadron Responsable (Fuente de Verdad) | Almacenamiento Primario | Rol de los Demas Escuadrones |
|---|---|---|---|
| **Empresas (Tenants) y Sucursales** | **Squad 1 (Core)** | PostgreSQL: tablas `tenants`, `branches` | Solo lectura referencial en sesiones y tokens JWT. |
| **Usuarios y Perfil Personal** | **Squad 1 (Core)** | PostgreSQL: tabla `users`, `user_profiles` | Identidad personal del usuario; sesion y autorizacion. |
| **Categorias Comerciales y Capacidades** | **Squad 1 / Squad 4** | PostgreSQL: `commercial_categories` / JSONB en `tenants` | Squad 4 adapta la interfaz POS y de administracion segun flags. |
| **Productos, Catalogo y Precios** | **Squad 3 (Inventario)** | PostgreSQL: tabla `products`, `product_variants` | Squad 4 consume catalogo oficial. Squad 6 y 2 reciben snapshot de producto. |
| **Existencias Fisicas y Kardex** | **Squad 3 (Inventario)** | PostgreSQL: tablas `stock_quants`, `stock_moves` | Squad 3 es el unico autorizado para alterar balances y calcular CPP. |
| **Facturas y Recibos POS** | **Squad 6 (Facturacion)** | PostgreSQL: tablas `invoices`, `invoice_items` | Squad 4 muestra comprobante. Squad 2 referencia el `invoiceId` oficial. |
| **Balance Operativo y Gastos Menores** | **Squad 1 / Squad 7 / Squad 6** | PostgreSQL: tablas `cash_transactions`, `invoices`, `purchases` | Agregador en tiempo real de entradas y salidas de efectivo. |
| **Asientos Contables y Libro Mayor** | **Squad 2 (Contabilidad)** | PostgreSQL: tablas `journal_entries`, `journal_entry_lines` | Registro inmutable de partida doble derivado de ventas y compras. |
| **Clientes, Proveedores y Cartera** | **Squad 7 (Cartera)** | PostgreSQL: tablas `third_parties`, `credit_transactions`, `purchases` | Validacion de cupo de fiado y seguimiento a saldos por cobrar/pagar. |
| **Turnos de Caja y Arqueos** | **Squad 1 / Squad 6** | PostgreSQL: tabla `pos_shifts` | Control del estado operativo del cajero y dinero fisico en custodia. |

### B. Modelo de Dominio: Onboarding, Perfil Personal y Perfil de Negocio

Para erradicar la mezcla de datos personales con la entidad comercial, la base de datos se estructura en dos entidades normalizadas con relacion 1:N (un usuario puede ser propietario de varios negocios):

```
+-------------------------------------------------------------+
|                 TABLA: users (Squad 1 Core)                 |
+-------------------------------------------------------------+
| id: UUID (PK)                                               |
| email: VARCHAR(255) UNIQUE                                  |
| password_hash: VARCHAR(255)                                 |
| first_name: VARCHAR(100)                                    |
| last_name: VARCHAR(100)                                     |
| document_type: ENUM ('CC', 'CE', 'PASAPORTE', 'DNI')        |
| document_number: VARCHAR(50)                                |
| phone_prefix: VARCHAR(5) DEFAULT '+57'                      |
| phone_number: VARCHAR(20)                                   |
| is_active: BOOLEAN DEFAULT true                             |
| created_at: TIMESTAMPTZ                                     |
+-------------------------------------------------------------+
                              |
                              | 1:N (Propietario / Miembro)
                              v
+-------------------------------------------------------------+
|                TABLA: tenants (Squad 1 Core)                |
+-------------------------------------------------------------+
| id: UUID (PK)                                               |
| business_name: VARCHAR(255) (Nombre Comercial)             |
| legal_name: VARCHAR(255) (Razon Social)                     |
| tax_id: VARCHAR(50) (NIT / RUT)                             |
| commercial_category_id: VARCHAR(50) (FK Categoria)          |
| country_code: VARCHAR(3) DEFAULT 'COL'                      |
| currency_code: VARCHAR(3) DEFAULT 'COP'                     |
| address_line: VARCHAR(255)                                  |
| city: VARCHAR(100)                                          |
| tax_scheme: ENUM ('RESPONSABLE_IVA', 'NO_RESPONSABLE_IVA')  |
| capabilities: JSONB (Matriz ProfileCapabilities activa)     |
| status: ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_ONBOARDING')  |
| created_at: TIMESTAMPTZ                                     |
+-------------------------------------------------------------+
```

### C. Diagrama de la Saga Transaccional de Checkout POS

```
                   [ Cajero presiona "Cobrar" en POS ]
                                    |
                                    v
              [ BFF Next.js 15: POST /api/checkout ]
            (Verifica Cookie JWT, Rol y Clave Idempotencia)
                                    |
       +----------------------------+----------------------------+
       |                                                         |
[ Caso Venta a Credito / Fiado ]                         [ Validacion de Precios ]
       |                                                         |
       v                                                         v
Paso 1: Squad 7 (Cartera)                                Consulta Squad 3
Verifica cupo disponible y bloquea por mora.             Sobrescribe precios e
POST /api/v1/credits/validate-and-charge                 impuestos con valores oficiales.
       |                                                         |
       +----------------------------+----------------------------+
                                    |
                                    v
                       Paso 2: Squad 6 (Facturacion)
              Emite la Factura POS con consecutivo atomico.
              POST /api/v1/invoices
              -> Genera: invoiceId (UUID) e invoiceConsecutive (ej. POS-001-100045)
                                    |
                                    v
                       Paso 3: Squad 3 (Inventario)
              Despacha inventario fisico y calcula Costo Promedio (CPP).
              POST /api/v1/inventory/moves/dispatch
              Body: { warehouseId, referenceId: invoiceId, lines: [...] }
              (Si falla por stock insuficiente -> Anula factura en Squad 6 y libera cupo en Squad 7)
                                    |
                                    v
                       Paso 4: Squad 2 (Contabilidad)
              Asienta partida doble formal (Caja/Bancos vs Ventas/IVA/Costo).
              POST /api/v1/accounting/journal-entries/sales-pos
              Body: { invoiceId, invoiceConsecutive, subtotal, taxAmount, total, costOfGoodsSold }
              (Garantia de sumas iguales e idempotencia)
                                    |
                                    v
              [ Retorno Exitoso al Frontend POS ]
              - Reproduce sonido no bloqueante de cobro exitoso
              - Genera vista previa de tirilla ESC/POS y enlace WhatsApp
              - Vacia carrito unicamente tras recibir confirmacion 200 OK del BFF
```

### D. Arquitectura del Módulo de Balance Operativo (`/admin/balance`)

El Balance Operativo resuelve la necesidad fundamental del comerciante de controlar su dinero sin lidiar con tecnicismos contables:

```
+---------------------------------------------------------------------------------------------------+
|                                  PANEL DE BALANCE OPERATIVO DIARIO                                |
+---------------------------------+---------------------------------+-------------------------------+
|       TOTAL VENTAS (HOY)        |       TOTAL GASTOS (HOY)        |       BALANCE NETO CAJA       |
|          $ 1.450.000            |           $ 280.000             |          $ 1.170.000          |
|  - Efectivo: $ 950.000          |  - Compras mercancia: $ 200.000 |  (Efectivo cobrado menos      |
|  - Transferencias: $ 350.000    |  - Servicios/Aseo: $ 50.000     |   gastos pagados en caja)     |
|  - Fiados (Credito): $ 150.000  |  - Transporte/Fletes: $ 30.000  |                               |
+---------------------------------+---------------------------------+-------------------------------+
|                      CARTERA ACTIVA (DINERO EN LA CALLE): $ 850.000 (12 Clientes)                 |
+---------------------------------------------------------------------------------------------------+
|  [Filtros: Hoy | Ayer | Esta Semana | Este Mes | Personalizado]  [+ Registrar Gasto] [+ Venta]    |
+---------------------------------------------------------------------------------------------------+
|                                   MOVIMIENTOS DEL PERIODO                                         |
| Hora     | Tipo      | Concepto                      | Metodo Pago    | Monto       | Estado      |
| 14:32    | Venta     | Ticket POS-001-10045          | Efectivo       | + $ 45.000  | Completado  |
| 13:15    | Gasto     | Pago almuerzos colaboradores  | Efectivo Caja  | - $ 25.000  | Registrado  |
| 11:20    | Abono     | Abono Carlos Perez (Fact. 98) | Nequi QR       | + $ 50.000  | Asentado    |
| 10:05    | Venta     | Venta Libre (Arreglo taladro) | Transferencia  | + $ 30.000  | Completado  |
+---------------------------------------------------------------------------------------------------+
```

### E. Matriz de Configuraciones por Dominio (Alcance y Persistencia)

| Dominio de Configuracion | Ajustes Incluidos | Nivel de Inclusion | Alcance | Persistencia | Comportamiento por Defecto |
|---|---|---|---|---|---|
| **Perfil de Usuario** | Nombres, Apellidos, Celular E.164, Password, Notificaciones personales | **MVP** | Usuario | PostgreSQL (`users`) | Nombre obligatorio, celular con prefijo +57 |
| **Perfil del Negocio** | Nombre comercial, Razon social, Categoria, Direccion, Ciudad, Logo | **MVP** | Negocio | PostgreSQL (`tenants`) | Nombre comercial obligatorio, logo opcional |
| **Planes y Suscripcion** | Visualizacion de plan activo, dias restantes, fecha de renovacion | **MVP (Informativo)** | Negocio | PostgreSQL (`plans`) | Plan `PILOT_UNLIMITED` activo sin cobro |
| **Impuestos y Fiscal** | Regimen tributario, tasa de IVA por defecto, habilitar INC 8% | **MVP** | Negocio | PostgreSQL (`tenants.tax_config`) | Colombia: No responsable de IVA (0%) por defecto |
| **Inventario y Mostrador** | Permitir venta en negativo (si/no), umbral de stock bajo, lector USB | **MVP** | Negocio | PostgreSQL (`tenants.config`) | Venta negativa bloqueada, umbral minimo: 5 |
| **Impresion de Tickets** | Ancho de papel (58mm vs 80mm), texto pie de pagina, auto-imprimir | **MVP** | Dispositivo | LocalStorage del navegador | Ancho: 80mm, auto-impresion desactivada |
| **Notificaciones Sonoras** | Beep escaneo lector, sonido cobro exitoso, alerta de error | **MVP** | Dispositivo | LocalStorage del navegador | Sonidos activados con volumen al 70% |
| **Catalogo Digital Web** | Slug publico, numero WhatsApp de recepcion, mensaje prefijado | **Fase 5** | Negocio | PostgreSQL (`tenants.catalog`) | Desactivado por defecto hasta configurarlo |
| **Estadisticas Avanzadas** | Proyecciones de venta, ticket promedio, margen bruto de utilidad | **Fase 5** | Negocio | Cache Redis / Postgres | Solo disponible para roles OWNER y ADMIN |

### F. Matriz de Capacidades Especializadas por Rubro (Anti-Fragmentacion)

Para cumplir la regla de **no construir 39 sistemas distintos**, se identifican las capacidades especializadas y sus requisitos obligatorios antes de poder ser declaradas como implementadas:

| Categoria Comercial de Referencia | Capacidades Especializadas Requeridas | Datos y Tablas que Exigiria | Reglas de Negocio / Validaciones | Reportes y Obligaciones | Veredicto en UniSaaS |
|---|---|---|---|---|---|
| **Tiendas, Abarrotes, Minimarkets** | Lector continuo de barras, venta rapida, control de caja | Tablas estandar existentes (`products`, `pos_shifts`) | Validacion de stock opcional o estricta | Arqueo diario, rotacion de stock | **Soportado al 100% en MVP** |
| **Ferreterias y Construccion** | Unidades fraccionadas (metros, kilos), credito fiado | `unit_of_measures.decimal_places`, `third_parties` | Precision decimal en cantidades (hasta 3 decimales) | Cartera vencida, balance de fiados | **Soportado al 100% en MVP** |
| **Venta Libre Express / Servicios** | Teclado numerico directo, cobro rapido sin catalogo | Ninguna tabla extra (lineas directas en factura) | Concepto y monto libre con esquema fiscal | Total recaudos, balance de caja | **Soportado al 100% en MVP** |
| **Fruver (Frutas y Verduras)** | Balanza digital de peso continuo | Protocolo RS232 o decodificacion de prefijo 20 | Multiplicacion de peso (kg) por precio unitario | Reporte de merma diaria de perecederos | **Fase 2 (Balanza manual)** |
| **Cafeterias y Panaderias** | Impuesto al Consumo (INC 8%), combos rapidos | `tax_schemes`, cuentas PUC 2416 | Validacion de exclusion de IVA cuando aplica INC | Discriminacion estricta en tirilla termica | **Fase 2 (Soporte INC 8%)** |
| **Moda, Calzado y Ropa** | Matriz bidimensional de variantes (Talla y Color) | `product_variants`, `variant_attributes` | Unicidad de SKU por variante, stock segregado | Stock por talla y color, devoluciones | **Fase 5 (Variantes)** |
| **Restaurantes y Gastrobar** | Mesas abiertas, comandas a cocina, recetas BOM | `restaurant_tables`, `kitchen_orders`, `bill_of_materials` | Despiece de inventario por insumos, propina voluntaria | Ventas por mesa, costo de receta | **Fase 5 (Avanzado)** |
| **Salud, Belleza y Peluquerias** | Agenda de citas y comisiones por estilista | `service_appointments`, `employee_commissions` | Asignacion de horario y calculo de porcentaje | Liquidacion quincenal de comisiones | **Fase 5 (Servicios)** |
| **Talleres Mecanicos** | Ordenes de trabajo, placa vehicular, repuestos | `work_orders`, `vehicles`, `labor_items` | Trazabilidad por serial/placa, recepcion y entrega | Rentabilidad repuestos vs mano de obra | **Fase 5 (Servicios)** |
| **Gimnasios y Centros Fitness** | Membresias por vigencia (dias/sesiones), control CC | `memberships`, `access_logs` | Verificacion de documento de identidad obligatorio | Vencimiento de planes, retencion | **Fase 5 (Servicios)** |
| **Farmacias y Droguerias** | Trazabilidad de lotes, vencimientos y registro INVIMA | `inventory_batches`, `expiration_dates` | Bloqueo estricto de venta de medicamento vencido | Reporte de farmacovigilancia | **Fuera de Alcance Inicial** |

---

## 8. FASES DE IMPLEMENTACION DETALLADAS (REORDENADAS POR DEPENDENCIA REAL)

Las fases se organizan respetando estrictamente la jerarquia tecnica: **Seguridad y Persistencia -> Integracion Core -> Operacion Real -> Experiencia y Madurez**:

```
[ FASE 0: Decisiones, Linea Base y Entorno Reproducible ]
                           |
                           v
[ FASE 1: Contencion P0 de Seguridad, Multi-tenancy y Proteccion del POS ]
                           |
                           v
[ FASE 2: Integracion Core, Persistencia Real de Facturas y Onboarding ]
                           |
                           v
[ FASE 3: Operacion Comercial Real (Inventario, Balance, Clientes y Caja) ]
                           |
                           v
[ FASE 4: Aplicacion Movil Nativa (Flutter Squad 5 con SQLite Drift) ]
                           |
                           v
[ FASE 5: Madurez Funcional, Catalogo Digital y Extensiones de Negocio ]
                           |
                           v
[ FASE 6: Piloto, Hardening, Pruebas de Carga y Lanzamiento Comercial ]
```

### FASE 0: Decisiones, Linea Base y Entorno Reproducible
**Objetivo:** Establecer una linea base de codigo limpia, resolver variables de entorno y garantizar que la infraestructura local se levante de forma reproducible.
- **[TASK-001] [Secuencial] [Squad 8 - DevOps] [S]**: Inicializacion de repositorio Git local unificado en la raiz `c:\Users\MONCAYO\Desktop\UNISAAS` con `.gitignore` exhaustivo.
- **[TASK-002] [Secuencial] [Squad 8 - DevOps] [M]**: Estandarizacion de plantillas `.env.example` y saneamiento de secretos en los 8 squads.
- **[TASK-003] [Secuencial] [Squad 8 - DevOps] [M]**: Verificacion de arranque de PostgreSQL 16 y Redis en Docker Compose con scripts de esquema auditados.

### FASE 1: Contencion P0 de Seguridad, Multi-tenancy y Proteccion del POS
**Objetivo:** Eliminar vulnerabilidades criticas de acceso cruzado entre comercios y corregir la falsa sensacion de venta exitosa en el punto de venta.
- **[TASK-010] [Paralela] [Squad 7 - Cartera] [M]**: Blindaje de autorizacion y cierre de vulnerabilidad BOLA en controladores de cartera y compras mediante `JwtAuthGuard` y extraccion de `tenantId` unicamente desde el token firmado.
- **[TASK-011] [Paralela] [Squad 8 - DevOps] [S]**: Endurecimiento de seguridad en Grafana desactivando acceso anonimo (`GF_AUTH_ANONYMOUS_ENABLED: "false"`).
- **[TASK-012] [Paralela] [Squad 4 - Web POS] [S]**: Correccion del flujo de confirmacion de venta: validar estrictamente `res.ok`, bloquear apertura del ticket si falla el servidor y preservar el carrito intacto con alerta visible.

### FASE 2: Integracion Core, Persistencia Real de Facturas y Onboarding
**Objetivo:** Conectar el flujo transaccional de venta de extremo a extremo contra PostgreSQL y construir el onboarding guiado de nuevos comercios.
- **[TASK-020] [Secuencial] [Squad 6 - Facturacion] [L]**: Implementacion de persistencia relacional en PostgreSQL para facturas POS y numeracion atomica mediante TypeORM con RLS, retirando el almacenamiento volatil en memoria.
- **[TASK-021] [Secuencial] [Squad 4 - BFF] [L]**: Homologacion de contratos en la Saga de Checkout BFF: mapear `lines: [...]` hacia Squad 3 y ordenar la emision de factura previa a la causacion contable en Squad 2.
- **[TASK-022] [Paralela] [Squad 1 - Core] [M]**: Caso de uso y endpoint de autoregistro de comercios (`POST /api/v1/auth/register`) con creacion transaccional de usuario maestro, tenant, sucursal y bodega.
- **[TASK-023] [Paralela] [Squad 4 - Frontend] [M]**: Construccion del flujo guiado de Onboarding en `/register` (3 pasos: Dueno, Negocio, Configuracion minima) conectando con el backend real.
- **[TASK-024] [Paralela] [Squad 1 / Squad 4] [M]**: Separacion formal de entidades `user_profiles` y `tenants`, con endpoints para consulta y edicion independiente de datos personales y comerciales.
- **[TASK-025] [Paralela] [Squad 1 - Core] [S]**: Creacion de tabla y catalogo semilla de Categorias Comerciales (`commercial_categories`) con banderas de capacidades por defecto y soporte de "Otro".

### FASE 3: Operacion Comercial Real (Inventario, Balance, Clientes y Caja)
**Objetivo:** Desmantelar los mocks locales en frontend y desplegar el centro de comando operativo diario.
- **[TASK-030] [Secuencial] [Squad 4 - Frontend] [XL]**: Conexion de la consola de Inventario (`/admin/inventory`) con Squad 3 PostgreSQL, incluyendo creacion de productos, precios y carga masiva CSV determinista.
- **[TASK-031] [Paralela] [Squad 4 - Frontend] [L]**: Conexion de la libreta de Clientes y Cartera (`/admin/clients`) con Squad 7, permitiendo registro de clientes, limites de credito y abonos con recibo.
- **[TASK-032] [Paralela] [Squad 1 / Squad 4] [L]**: Flujo transaccional de Turnos de Caja (`pos_shifts`): apertura con base, arqueo ciego parcial y Cierre Z con desglose de billetes en COP.
- **[TASK-033] [Paralela] [Squad 4 - Frontend] [M]**: Registro rapido de Gastos de Mostrador y Compras de mercancia en `/admin/gastos` impactando el efectivo en caja y el libro mayor.
- **[TASK-034] [Paralela] [Squad 4 - Frontend] [M]**: Exportacion determinista descargable de reportes en formato CSV/Excel estructurado sin datos mockeados.
- **[TASK-035] [Paralela] [Squad 4 / BFF] [L]**: Construccion del modulo de Balance Operativo Diario (`/admin/balance`) con tarjetas de Ventas, Gastos, Neto, Cartera activa y tabla de transacciones con filtros.
- **[TASK-036] [Paralela] [Squad 4 - Web POS] [S]**: Implementacion del sistema de notificaciones sonoras no bloqueantes (Web Audio API) y alertas visuales en mostrador POS.
- **[TASK-037] [Paralela] [Squad 4 / Squad 6] [M]**: Generador de enlaces deterministas de cobro y envio de comprobante digital a traves de WhatsApp (`wa.me`).

### FASE 4: Aplicacion Movil Nativa (Flutter Squad 5)
**Objetivo:** Alinear la app movil con las APIs unificadas y persistencia local durable en SQLite Drift.
- **[TASK-040] [Secuencial] [Squad 5 - Movil] [L]**: Conexion del POS movil al ciclo de vida de persistencia y red: cobro real contra el backend o guardado duradero en SQLite Drift sin descartar carritos.
- **[TASK-041] [Paralela] [Squad 5 - Movil] [M]**: Sincronizacion de catalogo de productos y terceros desde Squad 3 y 7 hacia SQLite local.

### FASE 5: Madurez Funcional, Catalogo Digital y Extensiones
**Objetivo:** Extender capacidades operativas avanzadas segun decision del propietario.
- **[TASK-050] [Paralela] [Squad 4 - POS] [M]**: Soporte para Pagos Mixtos / Divididos (Efectivo + Transferencia) en mostrador POS.
- **[TASK-051] [Paralela] [Squad 3 / Squad 4] [L]**: Matrices de variantes de producto (Talla/Color) con SKU y stock individual.
- **[TASK-052] [Paralela] [Squad 7 / Squad 4] [M]**: Cuentas por pagar a proveedores y control de vencimientos.
- **[TASK-053] [Paralela] [Squad 4 - Web] [L]**: ~~Catalogo Digital Publico de solo lectura con envio de orden formal a WhatsApp (Sin IA).~~ **RETIRADO:** funcionalidad eliminada del producto.
- **[TASK-054] [Paralela] [Squad 1 - Core] [M]**: Motor de Planes y Limites de Suscripcion (`plans`), mantenido en modo permisivo durante el piloto.

### FASE 6: Piloto, Hardening, Pruebas de Carga y Lanzamiento
**Objetivo:** Certificar la estabilidad, seguridad y rendimiento con comercios reales.
- **[TASK-060] [Secuencial] [Squad 8 - QA/SRE] [M]**: Pruebas de carga con k6 simulando 50 cajeros concurrentes en mostrador POS (p95 < 400ms, 0 bloqueos).
- **[TASK-061] [Secuencial] [Squad 8 - DevOps] [M]**: Simulacro formal de restauracion de base de datos (Disaster Recovery Drill) en menos de 10 minutos.
- **[TASK-062] [Secuencial] [Tech Lead / PO] [S]**: Evaluacion formal de Checklist Go/No-Go y firma de autorizacion para despliegue de comercios piloto.

---

## 9. BACKLOG MAESTRO ACCIONABLE (TAREAS CONSOLIDADAS)

| ID | Prioridad | Epica / Descripcion de la Tarea | Responsable | Tamano | Dependencias | Rutas / Componentes Confirmados | Criterio de Aceptacion Verificable |
|---|---|---|---|---|---|---|---|
| **TASK-001** | P0 | Inicializacion de repositorio Git y trazabilidad | DevOps / SRE | S | Ninguna | Raiz `c:\Users\MONCAYO\Desktop\UNISAAS` | `git status` y control de ramas activo con `.gitignore` exhaustivo. |
| **TASK-002** | P0 | Saneamiento de secretos y `.env.example` en squads | DevOps / SRE | M | TASK-001 | Todos los escuadrones (`squad1` a `squad8`) | Cero contrasenas en codigo; variables homologadas en plantillas. |
| **TASK-003** | P0 | Despliegue y verificacion de Docker PostgreSQL/Redis | DevOps / SRE | M | TASK-002 | `squad8/docker-compose.yml`, `init-db.sql` | Contenedores en estado `healthy`; DDL v3 y RLS provisionados. |
| **TASK-010** | P0 | Blindaje de seguridad y cierre de BOLA en Squad 7 | Backend Lead | M | TASK-003 | `squad7/src/infrastructure/adapters/in/*.controller.ts` | Extraccion de tenant obligatoria de JWT; 401 en peticiones sin firma. |
| **TASK-011** | P0 | Desactivacion de acceso anonimo en Grafana | DevOps / SRE | S | TASK-003 | `squad8/docker-compose.yml:102` | Login obligatorio para acceder a metricas en puerto 3005. |
| **TASK-012** | P0 | Prevencion de falso ticket y bloqueo de exito en POS | Frontend Lead | S | Ninguna | `squad4/src/app/pos/page.tsx:710-760` | Error de servidor impide abrir ticket y preserva carrito de compra. |
| **TASK-020** | P0 | Persistencia relacional de facturas en Squad 6 | Backend Lead | L | TASK-003 | `squad6/src/application/services/invoices.service.ts` | Facturas se insertan en PostgreSQL; consecutivos atomicos persistentes. |
| **TASK-021** | P0 | Homologacion de contratos en Saga de Checkout BFF | Fullstack Lead | L | TASK-010, TASK-020 | `squad4/src/app/api/checkout/route.ts` | Checkout real completa exitosamente los 4 pasos sin usar mocks. |
| **TASK-022** | P1 | Caso de uso y API de autoregistro de comercios | Backend Lead | M | TASK-003 | `squad1/src/infrastructure/adapters/in/auth.controller.ts` | `POST /api/v1/auth/register` crea tenant, user, branch y warehouse en una tx. |
| **TASK-023** | P1 | Flujo de Onboarding guiado en frontend (3 Pasos) | Frontend Lead | M | TASK-022 | `squad4/src/app/register/page.tsx` | Asistente de registro crea dueno y negocio, dejando el POS listo para operar. |
| **TASK-024** | P1 | Separacion de Perfil Personal vs Comercial | Fullstack Lead | M | TASK-022 | `squad1/user.entity.ts`, `squad4/admin/settings/profile/` | Edicion independiente de datos personales del dueno y datos del negocio. |
| **TASK-025** | P1 | Catalogo semilla de Categorias Comerciales y "Otro" | Backend Lead | S | TASK-003 | `squad1/scripts/seed-categories.sql`, `tenants.entity.ts` | Categoria almacena codigo y preset de capabilities; admite edicion posterior. |
| **TASK-030** | P1 | Persistencia real de Inventario y Catalogo en UI | Frontend Lead | XL | TASK-021 | `squad4/src/app/admin/inventory/page.tsx` | CRUD de articulos y carga masiva CSV persisten en Squad 3 PostgreSQL. |
| **TASK-031** | P1 | Persistencia real de Clientes y Abonos en UI | Frontend Lead | L | TASK-010 | `squad4/src/app/admin/clients/page.tsx` | Clientes y pagos se leen y asientan en Squad 7 PostgreSQL. |
| **TASK-032** | P1 | Flujo de Apertura, Arqueo y Cierre de Turno de Caja | Fullstack Lead | L | TASK-003 | `squad1/src/infrastructure/adapters/in/`, `squad4/shift-modal.tsx` | Arqueo ciego y estado de turno auditado persistente en tabla `pos_shifts`. |
| **TASK-033** | P2 | Registro de Gastos y Compras en UI y Contabilidad | Frontend Lead | M | TASK-021 | `squad4/src/app/admin/gastos/page.tsx` | Comprobantes de egreso reducen caja de turno y asientan partida doble. |
| **TASK-034** | P2 | Reportes reales y exportacion descargable CSV/Excel | Frontend Lead | M | TASK-020 | `squad4/src/app/admin/reportes/page.tsx` | Descarga de archivo `.csv` / `.xlsx` estructurado con datos reales de ventas. |
| **TASK-035** | P1 | Modulo de Balance Operativo Diario en Backoffice | Fullstack Lead | L | TASK-020, TASK-033 | `squad4/src/app/admin/balance/page.tsx`, nuevo endpoint BFF | Resumen en vivo de Ventas, Gastos, Neto y tabla de transacciones filtrable. |
| **TASK-036** | P2 | Sistema de Notificaciones Auditivas y Visuales POS | Frontend Lead | S | TASK-012 | `squad4/src/core/utils/sound-effects.ts`, `page.tsx` | Alertas sonoras Web Audio API configurables que no bloquean transacciones. |
| **TASK-037** | P2 | Generador de Enlaces de Cobro y Ticket WhatsApp | Frontend Lead | S | TASK-020 | `squad4/src/components/pos/ticket-modal.tsx` | Boton "Compartir WhatsApp" genera URL codificada determinista a `wa.me`. |
| **TASK-040** | P2 | Conexion operativa de venta en aplicacion Flutter | Movil Lead | L | TASK-021 | `squad5/lib/features/pos/presentation/pos_screen.dart` | Cobro en Android guarda en SQLite local o impacta backend real. |
| **TASK-041** | P2 | Sincronizacion de catalogo en aplicacion Flutter | Movil Lead | M | TASK-030 | `squad5/lib/features/pos/providers/pos_providers.dart` | Catalogo de la tienda se visualiza actualizado en el dispositivo movil. |
| **TASK-050** | P2 | Pagos divididos (Split Payments) en mostrador POS | Fullstack Lead | M | TASK-021 | `squad4/src/components/pos/payment-modal.tsx` | Admite pago combinado (efectivo + transferencia) en la misma factura. |
| **TASK-051** | P3 | Gestion de Variantes de producto en UI y Backend | Fullstack Lead | L | TASK-030 | `squad3/variant.entity.ts`, `squad4/admin/inventory/page.tsx` | Matrices de talla/color operan con SKU y stock independiente. |
| **TASK-052** | P3 | Cuentas por pagar a proveedores y vencimientos | Backend Lead | M | TASK-033 | `squad7/purchases.controller.ts`, `/admin/cuentas-pagar` | Control y abono de deudas comerciales con proveedores. |
| **TASK-053** | P3 | ~~Catalogo web publico y despacho a WhatsApp~~ | Frontend Lead | L | TASK-030 | — | **RETIRADO:** funcionalidad eliminada del producto. |
| **TASK-054** | P2 | Modelo de Planes SaaS y Cuotas en Backend | Backend Lead | M | TASK-022 | `squad1/src/domain/entities/plan.entity.ts` | Entidad de planes con verificacion inactiva durante fase piloto. |
| **TASK-060** | P1 | Pruebas de carga con k6 (50 cajeros concurrentes) | QA Lead | M | TASK-021 | `squad8/scripts/run-k6-stress.ps1` | p95 < 400ms, cero bloqueos de base de datos y cero facturas duplicadas. |
| **TASK-061** | P1 | Simulacro de restauracion de base de datos (DR) | DevOps / SRE | M | TASK-003 | `squad8/scripts/backup-restore.ps1` | Base de datos recuperada integramente en menos de 10 minutos. |
| **TASK-062** | P0 | Auditoria de Salida y Checklist Go/No-Go | Tech Lead / PO | S | Todas | Matriz de evaluacion formal | Aprobacion unanime de los 10 criterios de lanzamiento. |

---

## 10. PLAN DE PRUEBAS DETALLADO POR FASE

### Suite 1: Pruebas de Seguridad y Multi-Tenant (Fase 1 y Fase 2)
- **CP-SEC-01 (Inyeccion de Tenant en Cartera):**
  - *Ambiente:* Staging con backend levantado.
  - *Procedimiento:* Autenticarse como usuario de `Tenant-A`. Enviar peticion HTTP manual `GET /api/v1/credits/customers?tenantId={UUID_TENANT_B}` y `POST /api/v1/credits/validate-and-charge` con `tenantId` de `Tenant-B`.
  - *Resultado Esperado:* Respuesta HTTP 403 Forbidden o el sistema fuerza el contexto al `Tenant-A` del token sin mostrar datos de B. Registro en log de auditoria.
- **CP-SEC-02 (Llamadas sin Token de Sesion):**
  - *Procedimiento:* Enviar peticiones GET y POST a todos los endpoints de Squad 1, 2, 3, 6 y 7 sin la cabecera `Authorization`.
  - *Resultado Esperado:* Respuesta uniforme HTTP 401 Unauthorized en el 100% de las rutas privadas.

### Suite 2: Pruebas Transaccionales y de Resiliencia en Venta (Fase 2)
- **CP-POS-01 (Manejo de Errores y Preservacion de Carrito):**
  - *Procedimiento:* Detener intencionalmente el microservicio de inventario (puerto 3003) o enviar un saldo de efectivo insuficiente. En `/pos`, pulsar "Completar Venta / Cobrar".
  - *Resultado Esperado:*
    1. El modal del ticket de venta NO se abre.
    2. Se despliega una alerta visible indicando el motivo exacto del fallo.
    3. Los articulos y cantidades seleccionados permanecen intactos en el carrito de compra.
- **CP-POS-02 (Idempotencia ante Doble Clic del Cajero):**
  - *Procedimiento:* Disparar mediante script dos solicitudes concurrentes `POST /api/checkout` con identificador identico en `X-Idempotency-Key` en un lapso menor a 100ms.
  - *Resultado Esperado:* La primera solicitud se procesa normalmente (HTTP 200). La segunda peticion detecta la clave en proceso o completada, retorna el resultado previo con cabecera `X-Cache-Lookup: HIT`, y no duplica el descuento en Kardex ni crea doble asiento contable.
- **CP-POS-03 (Bloqueo Estricto de Stock Negativo):**
  - *Procedimiento:* Crear un articulo con existencia actual de 2 unidades. Intentar liquidar una venta en mostrador por 3 unidades cuando la configuracion `allowNegativeStock = false`.
  - *Resultado Esperado:* Squad 3 rechaza la transaccion con HTTP 400 Bad Request ("Stock insuficiente"). La factura no se emite y el cajero recibe advertencia en pantalla.

### Suite 3: Pruebas de Persistencia y Reinicio de Infraestructura (Fase 2 y 3)
- **CP-DAT-01 (Supervivencia de Catalogo e Inventario tras Reinicio):**
  - *Procedimiento:* Crear un producto nuevo mediante el formulario `/admin/inventory`. Verificar su presencia en base de datos. Reiniciar los contenedores Docker. Recargar el navegador.
  - *Resultado Esperado:* El producto se visualiza en la tabla de inventario con su costo, precio y stock identicos, y aparece en las busquedas del mostrador `/pos`.
- **CP-DAT-02 (Consecutivos de Factura tras Reinicio de Facturacion):**
  - *Procedimiento:* Emitir la factura `POS-001-100010`. Detener y volver a levantar el contenedor de Squad 6. Emitir una nueva venta inmediatamente.
  - *Resultado Esperado:* La nueva factura adquiere de manera estricta el consecutivo `POS-001-100011`. No se presentan colisiones ni reinicios de secuencia.

### Suite 4: Pruebas de Balance Operativo y Onboarding (Fase 2 y 3)
- **CP-BAL-01 (Cuadre Exacto del Balance Operativo Diario):**
  - *Procedimiento:* Registrar una venta en efectivo por $100.000, una venta por transferencia por $50.000, una venta a credito por $40.000 y un gasto en efectivo por $20.000. Consultar `/admin/balance`.
  - *Resultado Esperado:* Total Ventas muestra $190.000; Total Gastos muestra $20.000; Balance Neto de Caja muestra exactamente $80.000 ($100.000 efectivo cobrado - $20.000 gasto en efectivo). Los $40.000 de credito aumentan la cartera activa sin alterar el saldo de caja.
- **CP-ONB-01 (Onboarding Guiado de Principio a Fin):**
  - *Procedimiento:* Completar el formulario `/register` con datos ficticios. Seleccionar categoria "Tienda de Barrio".
  - *Resultado Esperado:* Redireccion exitosa al mostrador `/pos` en menos de 10 segundos, con turno de caja listo para apertura, sin articulos precargados ajenos y con aislamiento de tenant certificado.

---

## 11. MIGRACION, DATOS Y ESTRATEGIA DE RECUPERACION

### A. Segregacion Estricta de Datos Demo vs Datos Reales
1. **Identificadores de Datos Sinteticos:** Todo dato sembrado para desarrollo (ej. NIT `900.000.000-1`, emails terminados en `@demo.com`) debe identificarse mediante el flag `is_demo = true` o pertenecer a tenants de prueba reservados (`tenant-demo-*`).
2. **Aprovisionamiento Limpio de Nuevos Comercios (Zero-State Provisioning):** Todo comercio nuevo que se registre a traves de `/register` iniciara con sus tablas de productos, existencias, clientes, compras y facturas completamente vacias (0 filas), impidiendo que vea productos de ferreteria o restaurantes precargados.

### B. Politica de Migraciones de Base de Datos
1. Las modificaciones a las tablas se realizaran exclusivamente mediante scripts SQL numerados, incrementales e idempotentes (`migrations/00X_descripcion.sql`).
2. **Regla de Compatibilidad hacia Atras:** Queda prohibido eliminar columnas o renombrarlas en caliente. Todo cambio estructural debe seguir el patron:
   - *Paso 1:* Anadir nueva columna nullable o con valor por defecto.
   - *Paso 2:* Desplegar codigo que escribe en ambas columnas o en la nueva.
   - *Paso 3:* Migrar datos historicos en segundo plano.
   - *Paso 4:* Retirar la columna obsoleta en una version posterior.

### C. Estrategia de Respaldo y Recuperacion ante Desastres (Disaster Recovery)
1. **Frecuencia:** Volcado automatico diario mediante `pg_dump` con retencion de 30 dias en almacenamiento cifrado externo.
2. **Archivado WAL:** Activacion de Write-Ahead Logging para recuperacion puntual en el tiempo (Point-in-Time Recovery - PITR) ante corrupcion de datos.
3. **Procedimiento de Restauracion Documentado:**
   ```powershell
   # 1. Detener servicios de aplicacion para evitar escrituras concurrentes
   docker-compose stop squad1-auth squad2-accounting squad3-inventory squad6-reports squad7-cartera
   # 2. Restaurar esquema y datos limpios
   cat backup_unisaas_20261018.sql | docker exec -i postgres-saas psql -U saas_admin -d saas_contable_db
   # 3. Ejecutar verificacion de politicas RLS
   docker exec -i postgres-saas psql -U saas_admin -d saas_contable_db -f /scripts/verify-runtime-rls.sql
   # 4. Reanudar servicios
   docker-compose start
   ```

---

## 12. PLAN DE DESPLIEGUE, ENTORNOS Y OPERACION

### A. Compuertas de Calidad entre Ambientes (Deployment Gates)

```
[ Entorno Local ]
       |
       | Gate 1: Linter limpio, TypeScript compila sin errores, pruebas unitarias pasan.
       v
[ Pipeline CI (GitHub Actions) ]
       |
       | Gate 2: Docker build exitoso de todos los escuadrones, auditoria de secretos superada,
       |         pruebas de integracion SQL contra Postgres efimero aprobadas.
       v
[ Ambiente Staging ]
       |
       | Gate 3: NEXT_PUBLIC_USE_MOCKS=false. Pruebas E2E de checkout completas.
       |         Auditoria RLS ejecutada: 0 tablas con bypass.
       v
[ Piloto Controlado ]
       |
       | Gate 4: Aprobacion de Checklist Go/No-Go por Tech Lead y Product Owner.
       v
[ Produccion General ]
```

### B. Gestion Segura de Variables de Entorno y Configuracion
1. Prohibicion absoluta de almacenar archivos `.env` o credenciales reales en el repositorio Git.
2. En produccion, las variables sensibles (`JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`) se inyectaran a traves del gestor de secretos de la infraestructura (Docker Secrets, Kubernetes Secrets o AWS Secrets Manager).
3. **Configuracion de Mocks Forzada en Produccion:**
   - En el archivo de arranque de produccion de Next.js, se forzara la validacion:
     ```typescript
     if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
       throw new Error('FATAL: NEXT_PUBLIC_USE_MOCKS no puede ser true en entorno de produccion.');
     }
     ```

### C. Estrategia de Rollback y Despliegue sin Caida
1. Los servicios stateless (BFF Next.js y APIs NestJS) se desplegaran mediante balanceo de contenedores (Blue-Green o Rolling Updates), verificando la ruta `/health` antes de conmutar el trafico de red.
2. En caso de detectarse incremento de errores 5xx superior al 1% tras un despliegue, el orquestador revertira automaticamente los contenedores a la imagen de version previa estable en menos de 60 segundos.

---

## 13. CRITERIOS GO / NO-GO Y CHECKLIST DE SALIDA

Para autorizar el lanzamiento a comercios reales, se deben cumplir obligatoriamente todas las condiciones binarias de la siguiente lista de verificacion:

- [ ] **1. Cero Datos Mock en Flujos Transaccionales:** La variable `NEXT_PUBLIC_USE_MOCKS=false` esta activa y verificada; la creacion de productos, clientes, facturas y salidas de stock interactua exclusivamente con PostgreSQL.
- [ ] **2. Aislamiento Multi-Tenant Certificado:** El microservicio Squad 7 cuenta con `JwtAuthGuard` y extrae el tenant unicamente del token verificado. La prueba automatizada `CP-SEC-01` confirma que ningun tenant puede leer o alterar datos de otro comercio.
- [ ] **3. Cero Confirmaciones Falsas en Mostrador POS:** El componente `/pos/page.tsx` bloquea la emision de tickets y mantiene el carrito si la llamada al backend no devuelve HTTP 200 OK.
- [ ] **4. Facturacion Persistente y Secuencia Atomica:** Squad 6 guarda facturas en PostgreSQL; un reinicio del contenedor mantiene el historico y continua la numeracion oficial sin saltos ni duplicados.
- [ ] **5. Consistencia en la Saga Transaccional:** La venta en mostrador asienta simultaneamente el comprobante POS, la deduccion de stock en Kardex (con calculo de CPP) y la partida doble contable NIIF, o se revierte completamente en caso de fallo.
- [ ] **6. Autoregistro y Onboarding Guiado Operativo:** La ruta `/register` permite a un comercio nuevo registrarse e iniciar sesion de forma autonoma en menos de 2 minutos, aprovisionandose en estado cero sin articulos ajenos.
- [ ] **7. Balance Operativo Diario Verificado:** La consola `/admin/balance` refleja con exactitud aritmetica el flujo de dinero de ventas, abonos y gastos de mostrador.
- [ ] **8. Seguridad en Observabilidad y Secretos:** El acceso anonimo a Grafana esta deshabilitado; todas las contrasenas y llaves secretas por defecto han sido rotadas por valores seguros de alta entropia.
- [ ] **9. Simulacro de Desastre y Respaldo Verificado:** Se ha ejecutado con exito la restauracion completa de un backup de base de datos en un ambiente limpio, validando integridad de datos.
- [ ] **10. Declaracion Legal y Tributaria Explicita:** Se cuenta con definicion formal de que el sistema emite tirilla/ticket interno POS, o se tiene contratado y configurado el proveedor tecnologico oficial para facturacion electronica.

---

## 14. RIESGOS RESIDUALES Y FUERA DE ALCANCE DEFINITIVO

### A. Riesgos Residuales Aceptados Temporalmente
1. **Dependencia de Conectividad en la Web:** Al operar bajo esquema Online-First, una caida del proveedor de internet local en la tienda fisica impedira temporalmente registrar ventas en el mostrador web hasta el restablecimiento del servicio.
2. **Latencia Distribuida entre Microservicios:** La ejecucion de la Saga de checkout a traves de 4 llamadas HTTP secuenciales entre contenedores introduce una latencia esperada de 150ms a 350ms por transaccion, mitigable a futuro mediante consolidacion de servicios o mensajeria asincrona.
3. **Ausencia Inicial de Pasarela de Pagos SaaS:** Al no incluir cobros automaticos por tarjeta de credito o debito para la suscripcion a UniSaaS en el MVP, la gestion de clientes activos requerira seguimiento manual o acuerdo piloto directo.

### B. Fuera de Alcance Definitivo (Sin Inteligencia Artificial)
En cumplimiento estricto y vinculante con la politica del producto:
1. **Cero Modelos de Lenguaje (LLM):** Queda prohibida la integracion de APIs de OpenAI, Anthropic, Google Gemini o modelos locales (Llama, Mistral) dentro de cualquier funcionalidad del software.
2. **Cero OCR basado en IA:** No se implementara lectura o escaneo de facturas de proveedores mediante modelos de vision artificial. Las compras se ingresan mediante formularios estructurados o importacion CSV RFC 4180.
3. **Cero Asistentes Conversacionales o Chatbots:** La atencion al usuario y navegacion se resuelve mediante manuales de usuario, diseno UX intuitivo y modulos de ayuda deterministas.
4. **Cero Creadores o Editores de Imagenes/Sitios con IA:** Las imagenes de productos se gestionan mediante carga directa de archivos por el comerciante y el catalogo web sigue plantillas HTML/CSS predefinidas y controladas.
5. **Privacidad Total de Datos:** Ningun dato transaccional, financiero, contable o personal de los comercios sera compartido ni procesado por plataformas de entrenamiento o inferencia de inteligencia artificial.

---
*Fin del Plan Maestro de Implementacion UniSaaS Version 2.0.0.*
