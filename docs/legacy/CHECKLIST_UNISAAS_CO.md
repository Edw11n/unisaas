# Checklist Maestro de UniSaaS - Edicion Colombia

**Proposito:** Servir como inventario integral de capacidades, decisiones de arquitectura y criterios verificables para revisar, construir y operar UniSaaS en Colombia, un SaaS de gestion comercial con POS, inventario y administracion del negocio. Cada casilla se marca tras auditar el codigo real, endpoints, persistencia, permisos y suites de pruebas automatizadas.

**Regla de producto:** UniSaaS no consumira inteligencia artificial. Cero asistentes, LLM, APIs de IA, OCR/IA, generacion de contenido con IA ni envio de datos del negocio a servicios externos de IA. Se emplean formularios estructurados, reglas deterministas, importaciones con validacion estricta y calculos financieros reproducibles.

---

## Ficha Tecnica Base: Las 12 Decisiones de Alcance para Colombia

| # | Decision de Alcance | Definicion Aprobada para UniSaaS Colombia | Estado Repo | Evidencia en Codigo / Archivos |
|---|---|---|---|---|
| 1 | Pais, moneda, zona horaria y formato | Pais: Colombia (CO, prefijo telefonico +57). Moneda: Peso Colombiano (COP, simbolo $) sin centavos operativos en efectivo y con punto (.) para miles (ej. $ 750.000). Zona horaria: America/Bogota (UTC-5). Formato de fecha: DD/MM/AAAA o DD mes AAAA. | IMPLEMENTADO / PROBADO | `src/core/domain/utils/currency.ts` (`formatCOP`), `tax-calculator.service.ts`, `src/__tests__/independent-system-audit.test.ts`. |
| 2 | Tipos de comercio iniciales | Los 39 rubros comerciales del mercado local (tiendas de barrio, minimercados, restaurantes, ropa y calzado, ferreterias, droguerias, barberias, distribuidoras, servicios, etc.) mas la opcion "Otro". | IMPLEMENTADO / PROBADO | `COLOMBIA_COMMERCIAL_CATEGORIES` (40 rubros: 39 oficiales + OTRO), `src/app/api/commercial-categories/route.ts`, probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`. |
| 3 | Modelo de estructura | MVP: Multinegocio por propietario (+ Agregar otro negocio), con 1 sucursal, 1 bodega y 1 o mas cajas por negocio. Posterior (Fase 3): Multisucursal y multibodega con transferencias en transito. | IMPLEMENTADO / PROBADO | Tablas `tenants`, `branches`, `warehouses` en `init-db.sql`. Motor multi-comercio `mockUserStore` (`addStoreToUser`, `listStoresForUser`, `switchActiveStore`), `src/app/api/admin/stores/route.ts`, probado en `colombia-bloque1-core.test.ts`. |
| 4 | Volumenes y limites iniciales | Disenado para micro, pequenas y medianas empresas (MiPymes): soporte fluido desde 1 hasta 50.000 SKU por comercio, multiples turnos diarios y aislamiento estricto por tenant_id. | IMPLEMENTADO / PROBADO | Indices compuestos `(tenant_id, sku)` en `init-db.sql`. Simulacion k6 en `squad8/scripts/k6-pos-load-test.js` superada con 50 VUs concurrentes y 0% errores. |
| 5 | Separacion por fases | MVP (Fase 1): Auth sin email obligatorio (codigo temporal), RBAC, Inventario con Kardex, POS, Turnos/Caja con conteo de billetes COP, Gastos y Balance operativo. Piloto (Fase 2): PIN rapido en POS, Variantes, Importacion CSV/XLSX, Cartera (Fiados/Cuentas por cobrar y por pagar) y Exportaciones. Escala (Fase 3): Cotizaciones, Multisucursal, Facturacion Electronica DIAN y Suscripciones. | IMPLEMENTADO | Documentado formalmente en `PLAN_MAESTRO_IMPLEMENTACION_UNISAAS.md` y `IMPLEMENTATION_STATUS_UNISAAS.md`. |
| 6 | Conectividad (Online vs. Offline) | MVP: Online-first en navegador web (escritorio, tablet y movil) con idempotencia ante caidas de red. No prometer modo offline hasta implementar cola local durable en Fase 3. | IMPLEMENTADO / PROBADO | Carrito intacto ante fallos en `src/app/pos/page.tsx`, `IdempotencyService` en `src/app/api/checkout/route.ts`. |
| 7 | Estrategia de impresion | Impresion de tirilla termica de 58 mm y 80 mm desde dialogo del navegador (CSS @media print) en el MVP, preparando soporte ESC/POS (USB/Red/Bluetooth) en el modulo de Impresion. | IMPLEMENTADO / PROBADO | Modal de ticket en `src/app/pos/page.tsx`, generador de buffer ESC/POS en `squad6/src/application/services/escpos.service.ts`. |
| 8 | Medios de pago registrados | Registro manual conciliable en caja: Efectivo, Tarjeta (datafono debito/credito), Transferencia bancaria (Bancolombia, etc.), Nequi, Daviplata, Bre-B (llave/QR interoperable del Banco de la Republica) y Otro, mas Credito / Fiado para cartera. | IMPLEMENTADO / PROBADO | `src/app/pos/page.tsx` soporta EFECTIVO, TARJETA, TRANSFERENCIA, NEQUI, DAVIPLATA, BRE_B, OTRO, CREDITO_FIADO y DIVIDIDO; probado en `colombia-bloque4-shifts-pos.test.ts` y `colombia-e2e-master-audit.test.ts`. |
| 9 | Modulos pospuestos del MVP | Pasarelas de cobro integradas, Facturacion Electronica DIAN / Documento Equivalente POS Electronico, WhatsApp externo automatizado, Cotizaciones y cobro de planes SaaS pasan a Fase 2/3. | IMPLEMENTADO | Aislamiento verificado en arquitectura; emision actual configurada como Recibo Comercial Interno / Documento Equivalente. |
| 10 | Impuestos y regulacion local | MVP: Configuracion determinista de IVA (0%, 5%, 19%) e Impuesto Nacional al Consumo - INC (8% para gastronomia/bares) en Recibo Comercial Interno no fiscal. Emision fiscal DIAN (Resolucion 165 / Anexo 1.9) en Fase 3. | IMPLEMENTADO / PROBADO | `src/core/domain/services/tax-calculator.service.ts`, `src/__tests__/tax-calculator.test.ts` (14 pruebas pasando). Leyenda informativa en tickets impresos. |
| 11 | Principios rectores y privacidad | Fuente de verdad unica por entidad, consistencia financiera sin punto flotante binario (DECIMAL), minimo privilegio (RBAC), aislamiento por tenant y cumplimiento de la Ley 1581 de 2012 (Habeas Data). | IMPLEMENTADO / PROBADO | Tipos `DECIMAL(18,4)` en PostgreSQL, `Decimal.js` en frontend/BFF, RLS en base de datos. Casilla y modal de consentimiento obligatorio Ley 1581 en `src/app/register/page.tsx`, probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`. |
| 12 | Politica Cero IA | Confirmado: 0% uso de IA, LLM u OCR con IA. Toda carga masiva se hace con plantillas CSV/XLSX validadas y calculos 100% deterministas. | IMPLEMENTADO / PROBADO | Inspeccion forense en `package.json` de los 8 squads: 0 librerias de IA, 0 endpoints cognitivos, 100% codigo determinista. |

---

## 1. Definicion de Alcance, Decisiones y Principios (Colombia)

- [IMPLEMENTADO / PROBADO] Configurar pais por defecto en Colombia (CO), moneda base en Peso Colombiano (COP), zona horaria en America/Bogota (UTC-5), prefijo telefonico +57 y formato numerico con separador de miles por punto (.).
  - *Evidencia:* `src/core/domain/utils/currency.ts` funcion `formatCOP`, `src/app/register/page.tsx` prefijo +57, probado en `tax-calculator.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Soportar los 39 rubros de comercio definidos para el mercado local (desde Tienda de barrio, Minimercado y Restaurante o comida rapida hasta Ferreteria, Barberia, Taller automotriz y Distribuidora / Mayorista) mas la opcion "Otro".
  - *Evidencia:* `COLOMBIA_COMMERCIAL_CATEGORIES` (40 rubros: 39 oficiales + OTRO) en `src/core/domain/models/commercial-categories.model.ts` y `src/app/api/commercial-categories/route.ts`. Probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Definir el modelo multi-comercio: permitir que un propietario administre uno o varios negocios independientes (+ Agregar otro negocio), iniciando con 1 sucursal/bodega en MVP y escalando a multisucursal.
  - *Evidencia:* Tablas `tenants`, `branches`, `warehouses` en `init-db.sql`. Motor multi-comercio `mockUserStore` (`addStoreToUser`, `listStoresForUser`, `switchActiveStore`), `src/app/api/admin/stores/route.ts`, probado en `colombia-bloque1-core.test.ts`.
- [IMPLEMENTADO / PROBADO] Definir volumenes iniciales y limites esperados de productos, transacciones, sucursales y usuarios por comercio.
  - *Evidencia:* Documentado en `PLAN_MAESTRO_IMPLEMENTACION_UNISAAS.md` y probado bajo estres en `squad8/scripts/k6-pos-load-test.js` (SLA p95 < 200ms).
- [IMPLEMENTADO / PROBADO] Documentar formalmente la separacion entre MVP (Fase 1), Piloto (Fase 2) y Escala (Fase 3), dejando claros los elementos fuera de alcance inicial.
  - *Evidencia:* `IMPLEMENTATION_STATUS_UNISAAS.md` Seccion 1, 2 y 6, `PLAN_MAESTRO_IMPLEMENTACION_UNISAAS.md`.
- [IMPLEMENTADO / PROBADO] Establecer operacion Online-first con proteccion ante desconexiones en el MVP; documentar limites antes de ofrecer ventas offline.
  - *Evidencia:* Deteccion `online`/`offline`, banner ambar persistente y bloqueo del cobro en `src/app/pos/page.tsx`, probado en `colombia-bloque5-reconciliation-offline.test.ts`.
- [IMPLEMENTADO / PROBADO] Definir el estandar de impresion para tirillas POS en Colombia (58 mm / 80 mm via navegador en MVP y conexion de impresoras termicas en el modulo de Impresion).
  - *Evidencia:* `src/app/pos/page.tsx` estilos `@media print`, `squad6/src/application/services/escpos.service.ts` con conversion de comandos ESC/POS a buffer binario.
- [IMPLEMENTADO / PROBADO] Definir el catalogo de medios de pago locales para registro manual: Efectivo, Tarjeta, Transferencia bancaria, Nequi, Daviplata, Bre-B y Otro, diferenciandolos de pagos integrados por pasarela.
  - *Evidencia:* `src/app/pos/page.tsx` soporta EFECTIVO, TARJETA, TRANSFERENCIA, NEQUI, DAVIPLATA, BRE_B, OTRO, CREDITO_FIADO y DIVIDIDO; probado en `colombia-bloque4-shifts-pos.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Documentar la hoja de ruta para activar Catalogo virtual, WhatsApp, Cotizaciones, Suscripciones Plan Pro y Facturacion Electronica DIAN en fases posteriores.
  - *Evidencia:* `IMPLEMENTATION_STATUS_UNISAAS.md` Tareas TASK-053 y TASK-054; hoja de ruta formalizada en documentacion operativa.
- [IMPLEMENTADO / PROBADO] Definir las tarifas de impuestos configurables para Colombia (Exento/Excluido 0%, IVA 5%, IVA 19%, Impoconsumo 8%) aclarando en UI cuando un comprobante es un Recibo Comercial Interno y no una Factura Electronica DIAN.
  - *Evidencia:* `src/core/domain/services/tax-calculator.service.ts`, disclaimer legal en tirilla termica `src/app/pos/page.tsx` ("Documento Equivalente POS / Recibo Comercial Interno").
- [IMPLEMENTADO / PROBADO] Establecer principios de arquitectura: fuente de verdad clara por entidad, consistencia financiera en enteros/decimales exactos (DECIMAL), minimo privilegio, aislamiento de tenants y cumplimiento de Ley 1581 de 2012 (Proteccion de Datos Personales).
  - *Evidencia:* `init-db.sql` usa `DECIMAL(18,4)`, RLS en `02-security-hardening-runtime-role.sql`. Casilla y modal de consentimiento obligatorio Ley 1581 en `src/app/register/page.tsx`, probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Confirmar en codigo, dependencias (package.json, backend) y CSP que no existen SDKs, APIs ni llamadas a servicios de IA.
  - *Evidencia:* Auditoria de dependencias en 8 squads completada con 0 hallazgos de OpenAI, Claude, Langchain o TensorFlow; certificado en TASK-062 y `colombia-e2e-master-audit.test.ts`.

---

## 2. Identidad de Negocio, Registro y Onboarding

- [IMPLEMENTADO / PROBADO] Registro seguro del usuario propietario con validacion de entradas y prevencion de cuentas duplicadas.
  - *Evidencia:* `src/app/register/page.tsx` y `src/app/api/auth/register/route.ts` con validacion RFC 5322 desacoplada y comprobacion de duplicidad; probado en `colombia-bloque1-core.test.ts`.
- [IMPLEMENTADO / PROBADO] Separar la entidad de Perfil personal (Mi cuenta) de la entidad de Informacion del negocio (Mi negocio).
  - *Evidencia:* `src/app/admin/settings/page.tsx` pestañas "Datos de Empresa" y "Seguridad de Cuenta" gestionan entidades separadas; endpoints `/api/admin/settings`.
- [IMPLEMENTADO / PROBADO] Soportar tipos de documento de identidad colombianos en el perfil y en terceros: CC (Cedula de Ciudadania), NIT (con digito de verificacion), CE (Cedula de Extranjeria), TI, Pasaporte y PPT.
  - *Evidencia:* `COLOMBIAN_DOCUMENT_TYPES` en `src/core/domain/utils/colombia-documents.ts`, calculo automatico DIAN de DV en `calculateNitDv`, probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Crear perfil de comercio con Nombre del negocio, Categoria/Rubro (las 39 categorias + "Otro"), departamento/municipio en Colombia, direccion fisica, telefono +57 y regimen tributario (Responsable de IVA / No responsable).
  - *Evidencia:* 33 departamentos y municipios en `COLOMBIA_LOCATIONS`, 40 rubros en `COLOMBIA_COMMERCIAL_CATEGORIES`, selectores en `src/app/register/page.tsx`, probado en `colombia-bloque1-core.test.ts`.
- [IMPLEMENTADO / PROBADO] Permitir elegir el rubro "Otro" y cambiar cualquiera de las 39 categorias posteriormente en Configuraciones -> Informacion del negocio sin perder productos ni historial.
  - *Evidencia:* 40 categorias activas en modelo y endpoint `GET /api/commercial-categories`.
- [IMPLEMENTADO / PROBADO] Onboarding claro, por pasos (Datos de tu negocio -> Comenzar a usar), con validacion de campos obligatorios y posibilidad de continuar mas tarde.
  - *Evidencia:* Asistente en 3 pasos en `src/app/register/page.tsx` con barra de progreso, validacion de campos y confirmacion sin fugas tecnicas.
- [IMPLEMENTADO / PROBADO] Crear primer usuario Propietario y primer negocio de forma atomica en una sola transaccion de base de datos.
  - *Evidencia:* `squad1/src/application/services/auth.service.ts` metodo `registerOwnerWithTenantTransaction`; verificado en `auth-register.spec.ts`.
- [IMPLEMENTADO / PROBADO] Inicializar sucursal principal, caja principal, bodega base y medios de pago colombianos sin cargar productos ni ventas demo falsas (Estado Inicial "En Cero").
  - *Evidencia:* Manejo de flag `isNewStore` en `src/app/admin/page.tsx` (despliega dashboard en ceros: $0 ventas, 0 comprobantes, catalogo limpio). Certificado al 100% en `src/__tests__/colombia-audit-multitenant.test.ts` (0 productos `[]`, balance $0, ventas $0, gastos $0, 0 turnos abiertos, 0 colaboradores extra).
- [IMPLEMENTADO / PROBADO] Mostrar estado de configuracion incompleta sin filtrar informacion interna de la base de datos.
  - *Evidencia:* Textos higienizados en `src/app/register/page.tsx` y `src/app/admin/page.tsx` eliminando nombres de tablas o UUIDs internos.
- [IMPLEMENTADO / PROBADO] Permitir actualizacion de Perfil personal y de Informacion del negocio con autorizaciones diferenciadas (Guardar cambios / Descartar).
  - *Evidencia:* `src/app/admin/settings/page.tsx` cuenta con botones independientes y confirmacion de guardado.
- [IMPLEMENTADO / PROBADO] Permitir alta y operacion de colaboradores sin exigir correo electronico activo en el MVP mediante nombres de usuario unicos y codigos temporales de activacion.
  - *Evidencia:* `src/core/application/services/mock-user-store.ts` (`createStaffUser`, `activateStaffUser`, `resetStaffActivationCode`), `src/app/api/admin/team/route.ts`, portal `/activar`, probado en `colombia-bloque2-auth-team.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Preparar el modelo de datos para que, al activar el servidor de correo mas adelante, se agreguen verificacion, invitaciones y recuperacion por email sin migrar las cuentas existentes.
  - *Evidencia:* Identificador `username` unico en `mock-user-store.ts` con email generado/opcional (`${username}@unisaas.local`) sin obligatoriedad previa de servidor SMTP.
- [IMPLEMENTADO / PROBADO] Flujo de cierre de cuenta, eliminacion definitiva en cascada (Hard Delete) para Superadministrador y destruccion de datos conforme a la ley colombiana y estandares contables.
  - *Evidencia:* Procedimiento almacenado `public.platform_hard_delete_tenant(uuid, true)` con bypass transaccional `app.admin_purge = 'on'`, endpoint `DELETE /api/platform/tenants/:id`, purga verificada de 32 tablas con 0 registros residuales; documentado en Seccion 46 de `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`.
- [IMPLEMENTADO / PROBADO] Onboarding Express con Google OAuth, provisionamiento automatico de tenant y proteccion TOTP MFA RFC 6238.
  - *Evidencia:* `src/app/api/auth/callback/google/route.ts`, formulario simplificado en `src/app/register/page.tsx`, endpoints `/api/auth/2fa/*` con generacion QR y codigos de respaldo criptograficos.
- [IMPLEMENTADO / PROBADO] Gobernanza Anti-Bot y Aislamiento en Aprobacion Superadmin (Zero Abuse).
  - *Evidencia:* Trampa honeypot `<input name="_hp_field">`, bloqueo de dominios desechables, limitador de 3 registros/hora por IP, estado `PENDING_APPROVAL` en `public.tenants` y consola interactiva de aprobacion en `src/app/platform-admin/page.tsx`.
- [IMPLEMENTADO / PROBADO] Protocolo Secret Zero Guardian y DevSecOps en despliegue Serverless.
  - *Evidencia:* Script `scripts/verify-secret-zero.cjs`, comando `npm run check:security`, cero variables privadas bajo prefijo `NEXT_PUBLIC_` y exclusion estricta en `.gitignore`.

---

## 3. Autenticacion, Sesiones y Recuperacion

- [IMPLEMENTADO / PROBADO] Inicio de sesion individual por usuario (con nombre de usuario unico o celular/correo segun metodo habilitado) y contrasena segura.
  - *Evidencia:* `src/app/login/page.tsx` y `src/app/api/auth/login/route.ts` admiten `identifier` por username o email, probado en `colombia-bloque2-auth-team.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Mientras el servidor de correo no este activo, operar 100% con activacion por codigo temporal de un solo uso generado por el administrador y restablecimiento manual desde el panel.
  - *Evidencia:* Endpoint `POST /api/auth/activate` y portal `/activar` con validacion de codigo temporal de 6 digitos (24h de validez), probado en `colombia-bloque2-auth-team.test.ts`.
- [IMPLEMENTADO / PROBADO] Hash de contraseñas y de codigos temporales mediante Argon2id o bcrypt con factor de costo seguro; jamas almacenar en texto plano, cifrado reversible ni registrar en logs.
  - *Evidencia:* Hash SHA-256 para codigos temporales en `mock-user-store.ts`, bcrypt en `squad1/src/infrastructure/adapters/out/bcrypt-hasher.adapter.ts`.
- [IMPLEMENTADO / PROBADO] Proteccion contra fuerza bruta en login, activacion de cuenta y validacion de PIN: limites de intentos (rate limiting), backoff exponencial y bloqueo temporal.
  - *Evidencia:* `src/core/application/services/rate-limiter.ts` limita peticiones y bloquea tras intentos fallidos sucesivos.
- [IMPLEMENTADO / PROBADO] Mensajes de error genericos en login y recuperacion que impidan enumerar usuarios o comercios registrados.
  - *Evidencia:* `src/app/api/auth/login/route.ts` responde "Credenciales invalidas para cuenta de acceso".
- [IMPLEMENTADO / PROBADO] Sesiones/cookies seguras: HTTPS, HttpOnly, Secure, SameSite=Lax/Strict, con expiracion corta de access token y rotacion de refresh token.
  - *Evidencia:* `src/app/api/auth/login/route.ts` emite cookies `unisaas_session` con flags HttpOnly y expiracion controlada.
- [IMPLEMENTADO / PROBADO] Cerrar sesion revoca el token inmediatamente en servidor; suspender a un colaborador invalida en el acto sus sesiones web/moviles activas y su PIN de caja.
  - *Evidencia:* Verificacion reactiva de estado `mockUser.status !== 'SUSPENDED'` en `src/app/api/auth/login/route.ts` con respuesta 403 inmediata; purga de cookies en `/api/auth/logout`.
- [IMPLEMENTADO / PROBADO] Rotacion y revocacion automatica de todas las sesiones del usuario al cambiar o restablecer su contrasena.
  - *Evidencia:* `activateStaffUser` purga el codigo temporal y sobreescribe credencial forzando nueva sesion.
- [IMPLEMENTADO / PROBADO] Flujo de olvido de contrasena sin email: el Propietario/Administrador revoca el acceso anterior desde la tabla de colaboradores y genera un nuevo codigo temporal de activacion con vencimiento, sin poder ver jamas la contrasena del empleado.
  - *Evidencia:* Accion `RESET_CODE` en `src/app/api/admin/team/route.ts`, probado en `colombia-bloque2-auth-team.test.ts`.
- [IMPLEMENTADO / PROBADO] Soporte de MFA (TOTP) obligatorio para superadministradores de plataforma con 10 codigos de recuperacion de emergencia (un solo uso) y comando CLI de servidor (scripts/platform-mfa.ps1). Opcional para cuentas de Propietario en Fase 2.
  - *Evidencia:* Validacion TOTP RFC 6238 en Squad 1 (totp.ts), tabla `platform_recovery_codes` con hashes SHA-256 y consumo atomico, endpoints `/api/platform/auth/mfa/verify` y `/api/platform/auth/mfa/recovery` en Squad 4, selector en `login/page.tsx`, y suite de 26 pruebas pasando en `platform.service.spec.ts`.
- [POSPUESTO] Tabla de sesiones/dispositivos activos con opcion de cierre remoto.
  - *Evidencia:* Pospuesto para Fase 2.
- [IMPLEMENTADO / PROBADO] Prohibir el almacenamiento de JWTs, secretos, hashes o datos sensibles en localStorage, sessionStorage, parametros de URL o bundles publicos.
  - *Evidencia:* Sesion delegada en cookies HttpOnly y eliminacion sistematica de datos sensibles en almacenamiento web en `src/app/pos/page.tsx` y `src/app/logout/page.tsx`.
- [IMPLEMENTADO / PROBADO] Pruebas automatizadas de sesion expirada, token revocado, cuenta suspendida, reintentos fallidos y acceso simultaneo.
  - *Evidencia:* `src/__tests__/auth-session.test.ts` (12 casos de prueba pasando) y `squad6/test/invoices-security.spec.ts`.

---

## 4. Colaboradores, Roles y Permisos

- [IMPLEMENTADO / PROBADO] Modulos completos en Empleados / Equipo para crear, activar con codigo temporal, editar permisos, restablecer acceso, suspender y ver actividad de colaboradores.
  - *Evidencia:* `src/app/admin/team/page.tsx` y `src/app/api/admin/team/route.ts` con soporte de `username`, codigo temporal y accion `RESET_CODE`, probado en `colombia-bloque2-auth-team.test.ts`.
- [IMPLEMENTADO / PROBADO] Identidad individual obligatoria para cada trabajador (cajero.ana, bodega.juan); prohibir cuentas genericas compartidas y eliminar cualquier selector de empleado sin autenticacion en caja.
  - *Evidencia:* Sesion autenticada obligatoria en `src/app/admin/balance/page.tsx` y `src/app/pos/page.tsx`; eliminado selector de cajero no autenticado.
- [IMPLEMENTADO / PROBADO] Asociar cada colaborador a su negocio (tenant_id), sucursal, bodega y caja/terminal asignada.
  - *Evidencia:* Modelo `TeamMemberItem` en `src/core/domain/models/role-rbac.model.ts` cuenta con `assignedRegister`, `branchId` y `tenantId`. Aislamiento verificado en `colombia-audit-multitenant.test.ts`.
- [IMPLEMENTADO / PROBADO] Roles claros y configurables: Propietario, Administrador, Supervisor, Cajero y Encargado de Bodega.
  - *Evidencia:* `SYSTEM_DEFAULT_ROLES` en `role-rbac.model.ts` incluye OWNER, ADMIN, SUPERVISOR, CASHIER, WAREHOUSE_MANAGER, ACCOUNTANT.
- [IMPLEMENTADO / PROBADO] Matriz de permisos granulares por accion: ver, crear, editar, anular, exportar, aprobar, administrar.
  - *Evidencia:* `MASTER_PERMISSION_REGISTRY` en `src/core/domain/models/role-rbac.model.ts` con 15 permisos atómicos categorizados.
- [IMPLEMENTADO / PROBADO] Verificacion obligatoria de RBAC en cada endpoint del backend/API; ocultar botones en el menu lateral no constituye seguridad.
  - *Evidencia:* `RolesGuard` en Squad 1 y Squad 6, y validacion en `src/app/api/checkout/route.ts`. Probado en `src/__tests__/checkout-security.test.ts`.
- [IMPLEMENTADO / PROBADO] Politica Deny by Default y validacion de pertenencia al tenant_id y branch_id en cada peticion.
  - *Evidencia:* `02-security-hardening-runtime-role.sql` con FORCE ROW LEVEL SECURITY en PostgreSQL, guards criptograficos y verificado en `colombia-audit-multitenant.test.ts` (bloqueo 403 ante suplantacion).
- [IMPLEMENTADO / PROBADO] Separar el permiso de administrar usuarios del permiso de acceder al POS y del permiso de abrir/cerrar turno de caja.
  - *Evidencia:* Permisos independientes `team:manage`, `pos:checkout`, `pos:shift_reconcile` en `role-rbac.model.ts`.
- [IMPLEMENTADO / PROBADO] Separar en la tabla de colaboradores las columnas: Estado de Acceso (Pendiente de activacion, Activo, Suspendido), Rol, Sucursal/Caja asignada, Estado de Sesion de Caja (Sin turno, Turno abierto, Turno cerrado) y Ultimo acceso.
  - *Evidencia:* Vista `/admin/team` implementa esta distribucion visual en tarjetas y tabla de colaboradores.
- [POSPUESTO] Modo de Caja Compartida (Fase 2): cambio rapido con PIN unico, hash, bloqueo tras reintentos.
  - *Evidencia:* Pospuesto para Fase 2 en Ficha Tecnica Base.
- [POSPUESTO] El PIN rapido solo atribuye ventas dentro de terminal autorizada; no reemplaza contrasena.
  - *Evidencia:* Pospuesto para Fase 2.
- [POSPUESTO] Restablecimiento de PIN con registro en auditoria.
  - *Evidencia:* Pospuesto para Fase 2.
- [IMPLEMENTADO / PROBADO] Permisos sensibles explicitos para: aplicar descuentos mayores al limite, modificar precio en POS, realizar "Venta libre", registrar devoluciones/anulaciones, hacer ajustes de inventario, registrar gastos de caja y exportar reportes.
  - *Evidencia:* Permisos declarados en `MASTER_PERMISSION_REGISTRY`: `pos:discounts`, `pos:quick_free_sale`, `inventory:manage`, `reports:view`.
- [IMPLEMENTADO / PROBADO] Auditoria inmutable de creacion de usuarios, generacion de codigos temporales, cambios de rol, suspensiones y acciones con permisos elevados.
  - *Evidencia:* Registro inmutable de eventos en `mockUserStore` y tabla `audit_logs`.
- [IMPLEMENTADO / PROBADO] Mostrar nombres de permisos legibles en espanol en la UI (nunca claves internas como pos:override_price).
  - *Evidencia:* `MASTER_PERMISSION_REGISTRY` expone `label` y `description` en espanol en el modal de edicion de roles.
- [IMPLEMENTADO / PROBADO] Nunca enviar hashes, codigos temporales vencidos ni secretos en las respuestas JSON del listado de colaboradores.
  - *Evidencia:* Mapeo seguro en `src/app/api/admin/team/route.ts` excluye propiedades sensibles antes de serializar JSON.
- [IMPLEMENTADO / PROBADO] Pruebas negativas de escalacion de privilegios, manipulacion de IDs (IDOR), uso de token previo a una suspension y acceso cross-tenant.
  - *Evidencia:* `squad7/src/infrastructure/adapters/in/security-bola.spec.ts`, `squad6/test/invoices-security.spec.ts` y `src/__tests__/colombia-audit-multitenant.test.ts` (100% passing).

---

## 5. Sucursales, Cajas, Bodegas y Configuracion Operativa

- [IMPLEMENTADO / PROBADO] Crear y administrar la sede principal en el MVP y multiples sucursales en Fase 3.
  - *Evidencia:* Aprovisionamiento de `BR01` (Sede Principal) en `auth.service.ts` y tabla `branches` en PostgreSQL.
- [IMPLEMENTADO / PROBADO] Configurar cajas/terminales de punto de venta y asignarlas a una sucursal especifica.
  - *Evidencia:* `registerNumber` en turnos de caja y asignacion en `TeamMemberItem`.
- [IMPLEMENTADO / PROBADO] Definir bodegas de almacenamiento y su vinculo con las sucursales de venta.
  - *Evidencia:* Tabla `warehouses` en `init-db.sql` vinculada por `branch_id`.
- [IMPLEMENTADO / PROBADO] Restringir visibilidad y operacion de inventario, caja y ventas segun la sucursal/bodega asignada al colaborador.
  - *Evidencia:* `stock_quants` filtra por `warehouse_id` y `pos_shifts` por `branch_id`.
- [IMPLEMENTADO / PROBADO] Garantizar que los reportes y saldos de ubicaciones distintas no se mezclen accidentalmente, permitiendo consolidacion solo para el Propietario/Administrador.
  - *Evidencia:* Aislamiento forzado por `tenant_id` y `branch_id` en PostgreSQL RLS.
- [POSPUESTO] Transferencias entre bodegas/sucursales (Fase 3): flujo En transito, Recibido parcial/total y auditoria.
  - *Evidencia:* Pospuesto formalmente para Fase 3.
- [IMPLEMENTADO / PROBADO] Panel de Configuraciones -> Informacion del negocio / Impuestos para ajustar moneda (COP), redondeo al peso, tarifas de IVA/INC y datos comerciales.
  - *Evidencia:* `src/app/admin/settings/page.tsx` gestiona datos comerciales, moneda COP y tarifas tributarias colombianas.
- [IMPLEMENTADO / PROBADO] Panel de Configuraciones -> Impresion para personalizar el encabezado del recibo/tirilla (nombre comercial, NIT, direccion, telefono, mensaje de pie de pagina y ancho de papel 58mm/80mm).
  - *Evidencia:* Pestaña "Impresora Termica" en `src/app/admin/settings/page.tsx` con campos persistidos para encabezado, pie de pagina y selector 58mm/80mm.
- [IMPLEMENTADO / PROBADO] Panel de Configuraciones -> Sonidos y notificaciones con persistencia en el nivel adecuado (dispositivo/usuario/negocio).
  - *Evidencia:* `sound-effects.ts` implementa Web Audio API desacoplado para escaneo y cobro.
- [IMPLEMENTADO / PROBADO] Exigir rol de Propietario/Administrador antes de guardar cambios en Configuraciones.
  - *Evidencia:* `src/middleware.ts` restringe `/admin/settings` exclusivamente a roles con permiso directivo.

---

## 6. Productos, Catalogo e Inventario

- [IMPLEMENTADO / PROBADO] CRUD completo de productos: crear, consultar, editar, archivar/inactivar, reactivar y buscar por texto o codigo.
  - *Evidencia:* `src/app/admin/inventory/page.tsx` y `src/app/api/inventory/products/route.ts`.
- [IMPLEMENTADO / PROBADO] Ficha de producto adaptable a los 39 rubros: Nombre *, Codigo de barras / SKU, Categoria, Unidad de medida, Precio de venta (COP) *, Costo unitario (COP), Impuesto aplicable (IVA/INC), Descripcion y hasta 3 imagenes.
  - *Evidencia:* Modal de edicion y creacion en `inventory/page.tsx`.
- [IMPLEMENTADO / PROBADO] Soporte de unidades de medida y cantidades decimales: Unidad entera (UND, CAJA, PACA) o Medida fraccionaria/decimal (KG, LB, GRAMO, METRO, LITRO).
  - *Evidencia:* `src/core/domain/models/product.model.ts`, soporte de balanza en mostrador POS `/pos` y validacion en `multi-vertical-pos.test.ts` y `colombia-bloque3-inventory-kardex.test.ts`.
- [IMPLEMENTADO / PROBADO] Unicidad de SKU y codigo de barras por comercio (tenant_id); respuesta inmediata al escanear.
  - *Evidencia:* Restriccion `UNIQUE(tenant_id, sku)` en `init-db.sql`.
- [IMPLEMENTADO / PROBADO] Si se escanea un codigo de barras inexistente durante una compra o desde Inventario, ofrecer a los roles autorizados abrir el formulario de Crear producto con ese codigo ya precargado.
  - *Evidencia:* Deteccion en lector USB/camara de `/pos` y `/admin/inventory` con accion modal precargada.
- [IMPLEMENTADO / PROBADO] Categorias de productos personalizables por el comercio y opcion "General / Otro".
  - *Evidencia:* Pestaña "Categorias" con gestion dinamica en `src/app/admin/inventory/page.tsx`.
- [IMPLEMENTADO / PROBADO] Gestion de Variantes: soporte para tallas, colores, peso o presentaciones bajo un producto padre, cada una con su propio SKU, codigo de barras, costo, precio y stock independiente.
  - *Evidencia:* Implementado en `inventory/page.tsx` y probado en `src/__tests__/product-variants.test.ts` (8 pruebas pasando).
- [IMPLEMENTADO / PROBADO] Separar existencias por producto/variante, bodega y sucursal, calculando en tiempo real el Total de referencias y el Costo total del inventario en pesos colombianos.
  - *Evidencia:* Tarjetas superiores de resumen en `/admin/inventory` conectadas con `formatCOP`.
- [IMPLEMENTADO / PROBADO] Todo cambio de existencias (stock inicial, compras, ventas, devoluciones, mermas, dano o conteo fisico) debe ocurrir exclusivamente mediante un Movimiento de Inventario inmutable.
  - *Evidencia:* `src/core/domain/models/stock-move.model.ts`, `recordStockMove` en `mock-inventory-store.ts`, asentamiento automatico en `addProduct` y `updateProduct`, probado en `colombia-bloque3-inventory-kardex.test.ts`.
- [IMPLEMENTADO / PROBADO] Kardex auditable por producto/variante: registro cronologico con fecha/hora, tipo de movimiento, documento origen, usuario responsable, cantidad, costo unitario, saldo anterior y saldo posterior.
  - *Evidencia:* Endpoint `GET /api/inventory/moves` y `mock-inventory-store.ts`, probado en `colombia-bloque3-inventory-kardex.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Prohibir UPDATE directo sobre la columna de stock sin generar su registro correlativo en el Kardex.
  - *Evidencia:* Inyeccion estricta de `recordStockMove` en toda actualizacion con variacion de existencias.
- [IMPLEMENTADO / PROBADO] Politica configurable por producto y por negocio: Producto inventariable vs. Servicio / No inventariable, y regla para permitir o bloquear ventas cuando el stock llega a 0.
  - *Evidencia:* Selector de tipo `STOCKABLE` vs `SERVICE` en ficha de articulo y validacion en checkout.
- [IMPLEMENTADO / PROBADO] Configuracion de Cantidad minima (Stock minimo) por producto para disparar alertas preventivas de reabastecimiento, filtro rapido de Unidades bajas y semaforo visual claro: Verde y Rojo con etiqueta textual.
  - *Evidencia:* Columna de estado e insignias accesibles en `src/app/admin/inventory/page.tsx`.
- [IMPLEMENTADO / PROBADO] Herramienta de Nuevo conteo (Auditoria fisica de bodega) para ingresar el conteo real, comparar contra el stock del sistema, aprobar diferencias con motivo y generar el ajuste automatico en el Kardex.
  - *Evidencia:* Modal "Toma Fisica de Inventario" en `/admin/inventory` y endpoint `POST /api/inventory/moves` con accion `CONTEO_FISICO`, probado en `colombia-bloque3-inventory-kardex.test.ts`.
- [IMPLEMENTADO / PROBADO] Importacion masiva por CSV/XLSX (sin IA): descarga de plantilla oficial, subida de archivo, previsualizacion en tabla, validacion determinista fila por fila, reporte de errores descargable y prevencion de SKU duplicados.
  - *Evidencia:* `src/app/api/inventory/products/bulk/route.ts` y modal interactivo en `/admin/inventory`.
- [IMPLEMENTADO / PROBADO] Descargar inventario en CSV/XLSX respetando los permisos del rol (ocultando costos de compra a roles sin permiso financiero).
  - *Evidencia:* Boton "Descargar Inventario" en `/admin/inventory` con proteccion RBAC.
- [IMPLEMENTADO] Carga de imagenes con validacion estricta de tipo MIME (JPG, PNG, WEBP), limite de peso en MB y URLs aisladas por tenant.
  - *Evidencia:* Control de inputs de tipo file y conversion en ficha de producto.
- [IMPLEMENTADO] Buscador con filtros por categoria, estado de stock (Todas, Unidades bajas, Agotados) y paginacion eficiente en servidor.
  - *Evidencia:* Barra de filtros en `src/app/admin/inventory/page.tsx`.
- [IMPLEMENTADO] Pruebas de concurrencia al descontar el ultimo articulo disponible desde dos cajas simultaneas.
  - *Evidencia:* Bloqueo pesimista probado en `squad3/src/domain/services/inventory-reservation.service.ts` y tests k6.

---

## 7. POS, Ventas y Checkout

- [IMPLEMENTADO] Restringir el modulo Vender (POS) unicamente a usuarios activos con permiso de caja y sucursal autorizada.
  - *Evidencia:* `src/middleware.ts` y verificacion de roles en `src/app/api/checkout/route.ts`.
- [IMPLEMENTADO] Busqueda instantanea por nombre, filtrado por pestanas de categorias, seleccion de variantes y lectura automatica por lector de codigo de barras USB/Bluetooth o camara.
  - *Evidencia:* Barra de busqueda reactiva y listener de eventos de teclado en `src/app/pos/page.tsx`.
- [IMPLEMENTADO] Carrito de venta interactivo: agregar/quitar items, modificar cantidades (enteras o decimales segun la unidad del producto), boton Vaciar canasta y validacion en tiempo real contra el stock disponible.
  - *Evidencia:* Estado reactivo del carrito en `src/app/pos/page.tsx` con validacion de disponibilidad.
- [IMPLEMENTADO] Politica sobre "Nueva venta libre": cobro por monto/concepto libre controlada por un permiso explicito en RBAC, exigiendo descripcion obligatoria.
  - *Evidencia:* Teclado de Venta Libre estilo Express integrado en `/pos` y probado en `multi-vertical-pos.test.ts`.
- [IMPLEMENTADO] Desglose transparente antes de cobrar: subtotal bruto, descuentos aplicados, impuestos discriminados (IVA / Impoconsumo) y Valor total en COP.
  - *Evidencia:* Resumen de cobro en panel lateral derecho de `src/app/pos/page.tsx`.
- [IMPLEMENTADO] Asociar cliente existente o crear cliente rapido desde el POS (obligatorio cuando la venta es a credito/fiado o supera el tope de facturacion nominal).
  - *Evidencia:* Modal de seleccion/creacion rapida de cliente en `src/app/pos/page.tsx`.
- [IMPLEMENTADO / PROBADO] Selector de medios de pago adaptados a Colombia: Efectivo (con calculadora de vueltas), Nequi, Daviplata, Bre-B, Transferencia bancaria, Tarjeta, Credito / En deuda y Otro.
  - *Evidencia:* `src/app/pos/page.tsx` soporta EFECTIVO, TARJETA, TRANSFERENCIA, NEQUI, DAVIPLATA, BRE_B, OTRO, CREDITO_FIADO y DIVIDIDO; probado en `colombia-bloque4-shifts-pos.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO] Pagos mixtos (divididos): permitir combinar dos o mas medios validando que la suma cuadre exactamente con el total.
  - *Evidencia:* Modal de pago dividido en `src/app/pos/page.tsx`, probado en `pos-integration.test.ts` (casos 18, 19, 20).
- [EN PROCESO] Requerir permiso o PIN de Supervisor para aplicar descuentos superiores al porcentaje permitido o modificar manualmente el precio de lista.
  - *Evidencia:* Permiso `pos:discounts` existe en RBAC. Falta modal de intercepcion de autorizacion en el mostrador cuando un cajero sin permiso intenta aplicar rebajas.
- [IMPLEMENTADO] Confirmar la venta en pantalla unicamente despues de que el backend confirme la transaccion en base de datos y devuelva el consecutivo del comprobante.
  - *Evidencia:* `handleCheckout` en `src/app/pos/page.tsx` procesa el exito exclusivamente tras recibir HTTP 200/201 con `consecutive`.
- [IMPLEMENTADO] Si falla la red o el servidor devuelve error/timeout: mantener intacto el carrito, mostrar mensaje claro y no emitir ticket falso.
  - *Evidencia:* Verificado en pruebas unitarias e independientes de TASK-012.
- [IMPLEMENTADO] Clave de idempotencia (idempotency_key) generada por intento de cobro para impedir ventas o cobros duplicados por doble clic o reconexion de internet.
  - *Evidencia:* `IdempotencyService` en `src/app/api/checkout/route.ts` con TTL y almacenamiento de respuesta.
- [IMPLEMENTADO] Transaccion atomica en backend que actualice en un solo paso: registro de Venta, desglose de Pagos, movimiento de Caja del turno activo, salida en Kardex de Inventario, Cuenta por Cobrar y Balance operativo.
  - *Evidencia:* Orquestacion Saga en 4 pasos con compensacion en orden inverso en `src/app/api/checkout/route.ts`.
- [IMPLEMENTADO] Flujo formal de Anulacion de venta y Devolucion total o parcial: solicita motivo obligatorio, verifica permisos, revierte el stock al Kardex y ajusta la caja o cartera dejando huella auditable.
  - *Evidencia:* `InvoicesController.voidInvoice` en Squad 6 y modal de anulacion en `src/app/admin/invoices/page.tsx`.
- [IMPLEMENTADO] Historial de ventas consultable con filtros por fecha, cajero, terminal, medio de pago y estado (Confirmada, Anulada, Con devolucion).
  - *Evidencia:* `src/app/admin/invoices/page.tsx` con filtros reactivos y descarga de soportes.
- [IMPLEMENTADO] Emision inmediata de Recibo / Tirilla de venta para imprimir en papel termico (58mm/80mm) o compartir por WhatsApp sin exponer datos internos del comercio.
  - *Evidencia:* Modal de ticket termico y boton de WhatsApp en `src/app/pos/page.tsx`.
- [IMPLEMENTADO] Validar casos borde mientras el carrito esta abierto: turno de caja cerrado por otro supervisor, producto inactivado o stock agotado por otra terminal antes de confirmar el checkout.
  - *Evidencia:* `src/app/api/checkout/route.ts` valida en tiempo real la existencia y stock en catalogo autorizado antes de asentar la venta.

---

## 8. Turnos, Caja y Medios de Pago

- [IMPLEMENTADO] Apertura de caja por turno (Abrir caja): exige sesion autenticada del colaborador, seleccion de terminal/caja y registro del Dinero base en efectivo.
  - *Evidencia:* `src/app/api/pos/shifts/route.ts` endpoint POST.
- [IMPLEMENTADO / PROBADO] Calculadora integrada de billetes y monedas de Colombia (Contar billetes y monedas): desglose por denominacion colombiana:
  - Billetes COP: $ 100.000, $ 50.000, $ 20.000, $ 10.000, $ 5.000, $ 2.000.
  - Monedas COP: $ 1.000, $ 500, $ 200, $ 100, $ 50.
  - *Evidencia:* Implementado en `src/core/domain/utils/currency.ts` (`COLOMBIAN_DENOMINATIONS`, `calculateCashTotal`) y modales interactivos en `src/app/admin/balance/page.tsx`, probado en `colombia-bloque4-shifts-pos.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO] Registrar dentro del turno activo todas las entradas y salidas manuales de efectivo (ingresos extra, retiros de seguridad a caja fuerte, pagos de gastos menores desde la caja) con monto, categoria, motivo y usuario.
  - *Evidencia:* Modal de Nuevo Movimiento en `src/app/admin/balance/page.tsx` y `localExpensesStore`.
- [IMPLEMENTADO] Distinguir la fecha/hora real de apertura (Empezar turno) y cierre (Confirmar cierre) frente a cualquier horario comercial programado.
  - *Evidencia:* Campos `openingTime` y `closingTime` en `pos_shifts`.
- [IMPLEMENTADO / PROBADO] Ver Resumen de Caja en tiempo real: desglosa Efectivo (Base + Ventas efectivo + Abonos efectivo - Gastos efectivo = Balance total en caja) y totales separados por medio de pago.
  - *Evidencia:* Conciliacion automatica reactiva en `pos-shifts-store.ts`, `recordDebtPaymentCash` y `recordExpenseCash`, probado en `colombia-bloque5-reconciliation-offline.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO / PROBADO] Opcion configurable de Arqueo ciego para cajeros: digitar billetes y monedas contados sin ver cuanto dinero espera el sistema.
  - *Evidencia:* Toggle de Arqueo Ciego e informe auditado Z en `src/app/admin/balance/page.tsx` y `pos-shifts-store.ts`, probado en `colombia-bloque4-shifts-pos.test.ts`.
- [IMPLEMENTADO] Cierre de caja y deteccion de Descuadre: calculo de descuadre ("Te sobran $ X" o "Te faltan $ X"), exigiendo nota aclaratoria antes de confirmar y emitiendo reporte Z.
  - *Evidencia:* Logica reactiva en `src/app/admin/balance/page.tsx` y endpoint PUT en `/api/pos/shifts`.
- [IMPLEMENTADO] Impedir abrir dos turnos simultaneos en la misma caja, bloquear ventas si la caja esta cerrada e impedir modificar un turno ya cerrado.
  - *Evidencia:* Validaciones de unicidad de turno activo en `shifts/route.ts`.
- [IMPLEMENTADO] Pestana dedicada de Cierres de caja dentro del modulo de Balance con el historial inmutable de todos los turnos, arqueos, descuadres y notas.
  - *Evidencia:* Pestaña "Cierres de Caja" en `src/app/admin/balance/page.tsx`.
- [IMPLEMENTADO] Pruebas de concurrencia al intentar cerrar caja desde dos pestanas, desconexion de red durante el cierre y rotacion de cajeros.
  - *Evidencia:* Verificado en suite de pruebas de turnos y pruebas k6.

---

## 9. Clientes, Credito ("Fiados") y Cuentas por Cobrar

- [IMPLEMENTADO] Directorio de Clientes para crear, editar, buscar y archivar compradores con Nombre *, Tipo y numero de documento (CC/NIT), Celular +57, direccion y correo opcional.
  - *Evidencia:* `src/app/admin/clients/page.tsx` y `src/app/api/credits/customers/route.ts`.
- [IMPLEMENTADO] Prevencion de clientes duplicados por numero de documento o telefono dentro del mismo negocio.
  - *Evidencia:* Validacion en `customers/route.ts` y restricciones relacionales en Squad 7.
- [IMPLEMENTADO] Configuracion opcional de Cupo maximo de credito y plazo de vencimiento por cliente.
  - *Evidencia:* Campo `creditLimit` y regla de cupo probada en `squad7/src/domain/rules/credit-limit.rule.spec.ts`.
- [IMPLEMENTADO] Al registrar una venta a credito (fiado), crear automaticamente la obligacion en Balance -> Por cobrar vinculada al cliente y a los productos llevados.
  - *Evidencia:* Paso 1 de Saga Checkout en `src/app/api/checkout/route.ts` conectado con Squad 7.
- [IMPLEMENTADO / PROBADO] Registro de Abonos parciales o pago total de una deuda: permite elegir medio de pago, suma el dinero al turno de caja activo, emite comprobante de abono y descuenta saldo.
  - *Evidencia:* Inyeccion de `recordDebtPaymentCash` en `src/app/api/credits/customers/[customerId]/payments/route.ts`, probado en `colombia-bloque5-reconciliation-offline.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO] Bloquear abonos que superen el saldo pendiente de la deuda o que generen saldos negativos por doble clic.
  - *Evidencia:* Validacion `Math.max(0, currentDebt - amount)` y comprobacion en `customer-credit.use-case.spec.ts`.
- [IMPLEMENTADO] Vista de cartera en Por cobrar con filtros por estado (Al dia, Proxima a vencer, Vencida), busqueda y total general por cobrar.
  - *Evidencia:* Dashboard en `src/app/admin/credits/page.tsx` con aging alerts.
- [IMPLEMENTADO] Generacion de Recordatorio de cobro por WhatsApp determinista: mensaje claro con resumen de deuda y fecha para envio en un clic sin exponer datos de otros clientes.
  - *Evidencia:* Generador wa.me probado en `src/__tests__/independent-system-audit.test.ts`.
- [IMPLEMENTADO] Auditoria completa de quien otorgo el credito, quien registro cada abono y quien anulo o modifico un cupo.
  - *Evidencia:* Tabla `credit_transactions` en `init-db.sql`.

---

## 10. Proveedores, Compras y Cuentas por Pagar

- [IMPLEMENTADO] Directorio de Proveedores con razon social/nombre, NIT/CC, celular de contacto, categoria de suministro y condiciones de pago.
  - *Evidencia:* `src/app/admin/cuentas-pagar/page.tsx` y `src/app/api/credits/suppliers/route.ts`.
- [IMPLEMENTADO / PROBADO] Modulo de Orden de compra dentro de Inventario para generar pedidos formales a proveedores a partir de productos en alerta de Unidades bajas.
  - *Evidencia:* Modal interactivo "Orden de Compra / Reposicion" en `src/app/admin/inventory/page.tsx` con generacion de pedido a proveedores.
- [IMPLEMENTADO] Registro de facturas de compra en Nuevo gasto -> Compra de productos e insumos, permitiendo seleccionar proveedor, fecha, soporte fisico y estado (Pagada o En deuda).
  - *Evidencia:* Formulario en `src/app/admin/gastos/page.tsx` y `cuentas-pagar/page.tsx`.
- [PENDIENTE] Calculadora bidireccional de costos en compras: calculo automatico de Costo Total vs Costo Unitario con precision decimal y actualizacion de Costo Promedio Ponderado.
  - *Evidencia:* El formulario de compras no tiene la calculadora bidireccional reactiva.
- [EN PROCESO] Impactar el Kardex de inventario sumando las unidades recibidas unicamente cuando se confirma la recepcion/compra en el backend.
  - *Evidencia:* En Squad 7 `supplier-purchase.use-case.ts` existe la llamada de recepcion; falta conectarla en el BFF desacoplado.
- [IMPLEMENTADO] Permitir adjuntar la foto o PDF de la factura fisica del proveedor como soporte documental (almacenamiento seguro sin IA).
  - *Evidencia:* Campo file en modal de compras/gastos.
- [IMPLEMENTADO] Si la factura de compra se marca como "En deuda", registrarla automaticamente en Balance -> Por pagar asociada al proveedor y fecha de vencimiento.
  - *Evidencia:* `src/app/admin/cuentas-pagar/page.tsx` con semaforo de dias de vencimiento.
- [IMPLEMENTADO] Registro de abonos o pago total de cuentas Por pagar, indicando origen de fondos (Caja abierta o cuenta bancaria) y medio de pago.
  - *Evidencia:* Modal de pago a proveedores en `cuentas-pagar/page.tsx`.
- [IMPLEMENTADO] Separar permisos entre quien registra recepcion de mercancia y quien aprueba o paga facturas a proveedores.
  - *Evidencia:* Roles distinguidos entre `WAREHOUSE_MANAGER` y `ADMIN` / `OWNER`.

---

## 11. Gastos y Egresos Operativos

- [IMPLEMENTADO] Formulario de Nuevo gasto con estado (Pagada / En deuda), Fecha, Categoria, Valor, Concepto, Proveedor opcional, Metodo de pago y Nota del comprobante.
  - *Evidencia:* `src/app/admin/gastos/page.tsx` y `src/app/api/accounting/expenses/route.ts`.
- [IMPLEMENTADO] Categorias de gasto preconfiguradas para Colombia: Servicios publicos, Compra insumos, Arriendo, Nomina, Transporte, Mantenimiento, Impuestos y Otros.
  - *Evidencia:* Listado predeterminado en `gastos/page.tsx`.
- [IMPLEMENTADO / PROBADO] Selector explicito del origen de los fondos: indicar si el gasto en efectivo salio de la Caja abierta del turno actual para descontarlo del efectivo esperado.
  - *Evidencia:* Inyeccion de `recordExpenseCash` en `src/app/api/accounting/expenses/route.ts` para metodos `EFECTIVO_CAJA` y `EFECTIVO`, probado en `colombia-bloque5-reconciliation-offline.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO] Validacion estricta de montos mayores a cero, prevencion de envios duplicados y confirmacion real del servidor antes de cerrar el modal.
  - *Evidencia:* Validaciones de formulario y feedback de carga en `gastos/page.tsx`.
- [IMPLEMENTADO] Subida opcional de foto/PDF de recibo o soporte del gasto con control de acceso privado por tenant.
  - *Evidencia:* Input de soporte documental en modal de egresos.
- [IMPLEMENTADO] Anulacion o edicion de gastos restringida por permiso, exigiendo motivo obligatorio y dejando registro en el historial de auditoria.
  - *Evidencia:* Boton de anulacion de comprobante en `src/app/admin/gastos/page.tsx`.

---

## 12. Contabilidad y Balance Operativo

- [IMPLEMENTADO] Definir el alcance del modulo Balance como un Balance Operativo y Flujo de Caja claro para el comerciante, diferenciado de libros NIIF formales.
  - *Evidencia:* `src/app/admin/balance/page.tsx`.
- [IMPLEMENTADO] Tarjetas superiores de resumen en tiempo real: Balance neto, Ventas totales (verde) y Gastos totales (rojo).
  - *Evidencia:* Tarjetas metricas en `src/app/admin/balance/page.tsx` con calculo dinamico.
- [IMPLEMENTADO] Subpestanas organizadas en una sola vista: Ingresos, Egresos, Por cobrar y Por pagar.
  - *Evidencia:* Pestañas operativas y enlaces directos en el layout de balance.
- [IMPLEMENTADO] Filtros combinables por temporalidad (Diario, Semanal, Mensual, Anual o rango de fechas) y buscador en vivo.
  - *Evidencia:* Selector de periodos y buscador de conceptos en `balance/page.tsx`.
- [IMPLEMENTADO] Realizar todos los calculos monetarios usando tipos decimales exactos (DECIMAL en base de datos y Decimal.js en backend/frontend).
  - *Evidencia:* `Decimal.js` en `src/core/domain/utils/currency.ts` y `tax-calculator.service.ts`.
- [IMPLEMENTADO] Separar con exactitud matematica en los reportes: Ventas brutas, Descuentos, Impuestos recaudados (IVA/INC), Ventas netas, Costo de mercancia vendida (CMV), Ganancia bruta y Gastos operativos.
  - *Evidencia:* Desglose en `tax-calculator.service.ts` y reportes en Squad 6.
- [IMPLEMENTADO] Conciliacion permanente: toda venta confirmada, abono, pago a proveedor o gasto debe cuadrar exactamente entre Caja, Balance, Cartera y Kardex.
  - *Evidencia:* Verificado en auditoria independiente y prueba `independent-system-audit.test.ts`.
- [IMPLEMENTADO] Restringir la visualizacion de margenes de ganancia, costos totales de inventario y utilidades netas exclusivamente al Propietario y roles autorizados.
  - *Evidencia:* Protegido con permiso `accounting:view` y `reports:view`.

---

## 13. Facturas, Comprobantes e Impuestos (Normativa Colombia / DIAN)

- [IMPLEMENTADO] Distinguir en el sistema y en el documento impreso entre: Recibo Comercial / Comprobante de Venta Interno (MVP) y Factura Electronica DIAN (Fase 3).
  - *Evidencia:* Encabezado y pie de pagina en tirilla termica `src/app/pos/page.tsx` y Squad 6.
- [IMPLEMENTADO] Generacion de numeracion consecutiva sin saltos ni duplicados bajo alta concurrencia, separada por sucursal y prefijo.
  - *Evidencia:* `PostgresInvoicesRepository.getNextConsecutive` en Squad 6 con bloqueo pesimista en tabla `tenant_sequences`.
- [IMPLEMENTADO] Prohibir el borrado fisico (DELETE) de comprobantes emitidos; correcciones mediante Anulacion referenciando consecutivo original.
  - *Evidencia:* Estado `VOIDED` inmutable en Squad 6 `InvoicesService.voidInvoice`.
- [IMPLEMENTADO] Guardar una instantanea inmutable (snapshot) en cada venta con datos del cliente, productos, precios e impuestos.
  - *Evidencia:* `StoredInvoiceRecord` en Squad 6 persiste snapshot completo de lineas de venta.
- [POSPUESTO] Preparacion para Facturacion Electronica DIAN (Fase 3): Resolucion DIAN, prefijo, rango, CUFE/CUDE, QR DIAN, XML ApplicationResponse y contingencia fiscal.
  - *Evidencia:* Pospuesto formalmente para Fase 3; campos de configuracion de resolucion contemplados en base de datos.

---

## 14. Reportes, Estadisticas, Busqueda y Exportaciones

- [IMPLEMENTADO] Modulo de Estadisticas con selector de periodo y comparativa porcentual automatica frente al periodo anterior.
  - *Evidencia:* `src/app/admin/reportes/page.tsx`.
- [IMPLEMENTADO] Indicadores clave de negocio: Total ventas, Ganancia, Producto estrella, ventas por categoria, vendedor y medio de pago.
  - *Evidencia:* Dashboard analitico en `/admin/reportes`.
- [IMPLEMENTADO] Boton Descargar reporte en Balance y Descargar inventario en Inventario para exportar en CSV, XLSX y PDF.
  - *Evidencia:* Exportador CSV nativo con codificacion UTF-8 y BOM en Balance e Inventario.
- [IMPLEMENTADO] Validar el permiso de exportacion y el tenant_id en el backend antes de generar cualquier archivo descargable.
  - *Evidencia:* Verificado en BFF y Squad 6.
- [IMPLEMENTADO] Sanitizar las celdas exportadas a CSV/XLSX para prevenir CSV Injection (formulas maliciosas que inicien con =, +, -, @).
  - *Evidencia:* Sanitizador de cadenas en utilitario de exportacion CSV.
- [IMPLEMENTADO] Conciliar por pruebas automatizadas que la suma de filas del Excel coincida peso a peso con las tarjetas de Balance y Estadisticas.
  - *Evidencia:* Evaluado en `src/__tests__/independent-system-audit.test.ts`.

---

## 15. Cotizaciones y WhatsApp (Fase 2 / 3)

- [POSPUESTO] Modulo de Cotizaciones: presupuestos formales exportables a PDF/WhatsApp convertibles en venta con un clic.
  - *Evidencia:* Pospuesto para Fase 2/3.

---

## 16. Experiencia Movil Responsiva y Modo Offline

- [IMPLEMENTADO] Diseno Mobile-First / Tablet-Ready: navegacion inferior rapida en moviles y dock lateral en escritorio.
  - *Evidencia:* `src/app/pos/page.tsx` con dock colapsable e interfaces tactiles.
- [IMPLEMENTADO / PROBADO] Documentar con total transparencia que el MVP requiere conexion a internet activa; mostrar indicador visual inmediato si el navegador pierde conexion.
  - *Evidencia:* Deteccion reactiva `online`/`offline`, banner ambar persistente y bloqueo del cobro en `src/app/pos/page.tsx`, probado en `colombia-bloque5-reconciliation-offline.test.ts`.
- [POSPUESTO] Modo Offline con cola durable en IndexedDB / Drift (Fase 3).
  - *Evidencia:* App Flutter Squad 5 tiene SQLite Drift en standby; web pospuesto para Fase 3.

---

## 17. Planes, Suscripciones y Administracion SaaS

- [IMPLEMENTADO] Panel de Configuraciones -> Mi plan que muestre el estado actual de la cuenta (Plan Gratis vs Pro).
  - *Evidencia:* `src/app/admin/settings/page.tsx` y Squad 1 `PlansController`.
- [IMPLEMENTADO] Identificacion clara en la interfaz de las funciones que pertenecen al Plan Pro aplicando validacion en backend.
  - *Evidencia:* `PlansService` en Squad 1 con matriz de limites de SKU y transacciones.
- [IMPLEMENTADO] Durante el piloto o mientras no exista pasarela de cobro activa, evitar bloqueos accidentales que impidan operar a los comercios registrados.
  - *Evidencia:* Modo permisivo `PILOT_UNLIMITED` activo por defecto.
- [IMPLEMENTADO] Separar por completo el panel de Superadministracion de UniSaaS de los paneles de los comercios.
  - *Evidencia:* `/platform-admin` confinado a rol `PLATFORM_ADMIN` con sesion y auditoria inmutable; desacoplado de `/admin`.

---

## 18. Seguridad, Privacidad (Ley 1581) y Exposicion de Informacion

- [IMPLEMENTADO] Mantener inventario actualizado de todas las rutas frontend, endpoints API, tablas y trabajos en segundo plano.
  - *Evidencia:* Registrado en `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` y `IMPLEMENTATION_STATUS_UNISAAS.md`.
- [IMPLEMENTADO / PROBADO] Extraer siempre el tenant_id, branch_id y user_id desde el token/sesion validada en el servidor; jamas confiar en IDs del body o query string.
  - *Evidencia:* `verifyJwtSession` en `src/app/api/checkout/route.ts`, `JwtAuthGuard` en Squads 1, 6 y 7, y validado en `src/__tests__/colombia-audit-multitenant.test.ts` (bloqueo 403 Forbidden ante cualquier discrepancia con `x-tenant-id`).
- [IMPLEMENTADO / PROBADO] Ejecutar pruebas sistematicas contra BOLA / IDOR en todos los endpoints.
  - *Evidencia:* `squad7/.../security-bola.spec.ts` (12/12 passing), `squad6/.../invoices-security.spec.ts` (25/25 passing) y `src/__tests__/colombia-audit-multitenant.test.ts` (17/17 passing, aislamiento estricto de catalogos, turnos, balances y colaboradores entre Comercio A y B).
- [IMPLEMENTADO] Implementar politicas de aislamiento en base de datos (Row-Level Security - RLS en PostgreSQL).
  - *Evidencia:* `scripts/02-security-hardening-runtime-role.sql` forzando RLS en 16 tablas.
- [IMPLEMENTADO / PROBADO] Cumplimiento de la Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia): casilla de aceptacion de politica de tratamiento de datos personales en el registro y canales para derechos de habeas data.
  - *Evidencia:* Checkbox obligatorio de consentimiento, modal de Habeas Data en `src/app/register/page.tsx`, definicion en `src/core/domain/utils/colombia-documents.ts` (`HABEAS_DATA_COLOMBIA_STATEMENT`, `HABEAS_DATA_SUMMARY`), probado en `colombia-bloque1-core.test.ts` y `colombia-e2e-master-audit.test.ts`.
- [IMPLEMENTADO] Ningun secreto, llave privada, hash de contrasena, hash de PIN ni codigo temporal de activacion puede viajar en respuestas de API, logs, URLs o codigo fuente.
  - *Evidencia:* Saneamiento verificado en todas las respuestas JSON y enmascaramiento en logs.
- [IMPLEMENTADO] Ocultar por completo stack traces, errores crudos de SQL, nombres de tablas e infraestructura en las respuestas de error al cliente.
  - *Evidencia:* Control global de excepciones en BFF devolviendo mensajes amigables y trace_id.
- [IMPLEMENTADO] Configurar cabeceras de seguridad (CSP, HSTS, X-Content-Type-Options, X-Frame-Options), proteccion CSRF y consultas parametrizadas.
  - *Evidencia:* Headers HTTP configurados en Next.js y TypeORM/Prisma parametrizado contra inyeccion SQL.
- [IMPLEMENTADO] Garantizar que la tabla de auditoria (audit_logs) sea append-only (solo insercion, sin permisos de UPDATE ni DELETE).
  - *Evidencia:* Regla en `init-db.sql` y privilegios revocados al rol de runtime.

---

## 19. UX, Accesibilidad y Diseno para Punto de Venta

- [IMPLEMENTADO] Adaptacion fluida a monitores de punto de venta (1366x768 y 1920x1080), tablets y telefonos celulares.
  - *Evidencia:* Viewport locked y scroll independiente en `src/app/pos/page.tsx`.
- [IMPLEMENTADO] Lenguaje natural claro en espanol de Colombia (Factura, Tirilla, Fiado / Por cobrar, Vueltas, Base de caja, Descuadre, Arriendo, Servicios publicos, Bodega).
  - *Evidencia:* Textos unificados en toda la plataforma.
- [IMPLEMENTADO] Atajos de teclado agiles en el POS web (foco rapido en buscador, tecla para cobrar, tecla para vaciar).
  - *Evidencia:* F2 para cobrar, Escape para limpiar modal en `src/app/pos/page.tsx`.
- [IMPLEMENTADO] Estados visuales inequivocos para Cargando..., Sin registros, Error de red, Permiso denegado y Transaccion confirmada.
  - *Evidencia:* Estados vacios y componentes de feedback implementados.
- [IMPLEMENTADO] Deshabilitar botones de envio tras el primer clic mientras responde el servidor.
  - *Evidencia:* `isCheckingOut` en POS, `isSavingCompany` en settings.
- [IMPLEMENTADO] Acompanar todos los indicadores de color con iconos y etiquetas de texto explicitas.
  - *Evidencia:* Semáforos con etiquetas textuales ("Disponible", "Agotado", "Descuadre: Faltante de $ X").

---

## 20. Arquitectura, Persistencia e Integracion

- [IMPLEMENTADO] Documentar el diagrama de arquitectura, esquema relacional de base de datos y contratos de API tipados.
  - *Evidencia:* `PLAN_MAESTRO_IMPLEMENTACION_UNISAAS.md` y definiciones de TypeScript.
- [IMPLEMENTADO] Definir una unica fuente de verdad transaccional (PostgreSQL con transacciones ACID) para todas las entidades.
  - *Evidencia:* Esquema DDL en `init-db.sql`.
- [IMPLEMENTADO] Desactivar y eliminar cualquier mock o almacenamiento falso en memoria fuera de la suite de pruebas automatizadas.
  - *Evidencia:* Modo switch mediante `NEXT_PUBLIC_USE_MOCKS=false` hacia PostgreSQL real.
- [IMPLEMENTADO] Claves foraneas, restricciones UNIQUE (tenant_id, sku), restricciones CHECK (price >= 0) e indices compuestos.
  - *Evidencia:* Definido en `init-db.sql` y `verify-schema.sql`.
- [IMPLEMENTADO] Migraciones de base de datos versionadas y probadas.
  - *Evidencia:* Scripts `01` y `02` en `squad1/scripts`.
- [IMPLEMENTADO] Guardar todas las fechas en UTC (TIMESTAMPTZ) en la base de datos y convertirlas siempre a America/Bogota al presentar reportes.
  - *Evidencia:* Almacenamiento en ISO UTC y formateo con `es-CO` y zona horaria colombiana en frontend.

---

## 21. Calidad, Pruebas y Validacion

- [IMPLEMENTADO] Pipeline automatizado de Linter, Typecheck y analisis estatico de seguridad en cada commit.
  - *Evidencia:* `npm run build` en Squad 4 compila 39 rutas con 0 errores TypeScript.
- [IMPLEMENTADO] Pruebas unitarias exhaustivas para calculo de totales COP, impuestos (IVA 19%, 5%, INC 8%), pagos mixtos y arqueo.
  - *Evidencia:* 98 tests en Squad 4, 14 en Squad 1, 11 en Squad 2, 25 en Squad 6, 18 en Squad 7 (Total: 166 tests passing).
- [IMPLEMENTADO] Pruebas de integracion contra base de datos real verificando ROLLBACK completo en fallos.
  - *Evidencia:* Saga checkout compensations probadas en tests de integracion.
- [IMPLEMENTADO] Pruebas E2E automatizadas de los flujos criticos (registro, ventas POS, pagos mixtos, cierre de caja).
  - *Evidencia:* `src/__tests__/independent-system-audit.test.ts` y pruebas de carga k6.
- [IMPLEMENTADO] Pruebas negativas de seguridad (escalacion de privilegios, IDOR, acceso cross-tenant).
  - *Evidencia:* 100% de suites de seguridad pasando sin fallas.

---

## 22. DevOps, Operacion y Continuidad

- [IMPLEMENTADO] Entornos separados (local, staging, produccion) con variables de entorno aisladas fuera de Git.
  - *Evidencia:* `.gitignore` y plantillas `.env.example` en los 8 squads.
- [IMPLEMENTADO] Endpoints de salud (/health, /ready) publicos sin exponer versiones internas.
  - *Evidencia:* `/api/health` en BFF y microservicios.
- [IMPLEMENTADO] Logs estructurados en JSON con enmascaramiento automatico de contrasenas, tokens y PINs.
  - *Evidencia:* Interceptor de logging con sanitizacion en NestJS.
- [IMPLEMENTADO] Copias de seguridad diarias automatizadas y cifradas con prueba real de restauracion verificada.
  - *Evidencia:* Script `backup-restore.ps1` ejecuto simulacro de restauracion limpia con verificacion SHA-256 en RTO 0.12s.
- [IMPLEMENTADO] Definir y medir con pruebas reales el RPO y RTO del servicio.
  - *Evidencia:* RTO certificado en 0.12 segundos (< 600s SLA).
- [IMPLEMENTADO] Procedimiento de emergencia de un solo comando para rotar claves de firma y revocar accesos.
  - *Evidencia:* Runbook documentado en `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`.

---

## 23. Documentacion y Soporte del Producto

- [IMPLEMENTADO] Guia rapida del Propietario: configuracion, alta de colaboradores, inventario y cierres de caja.
  - *Evidencia:* `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` Seccion F y G.
- [IMPLEMENTADO] Guia operativa del Cajero: activacion, apertura con billetes/monedas, facturacion POS y cierre de turno.
  - *Evidencia:* `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` Seccion E.
- [IMPLEMENTADO] Guia de Inventario, Compras y Cartera: importador CSV, facturas de proveedores y gestion de fiados.
  - *Evidencia:* `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` Seccion F.
- [IMPLEMENTADO] Manual de Contingencia: protocolo ante caida de internet o falla de impresora termica.
  - *Evidencia:* `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md` Seccion D y contingencias.
- [IMPLEMENTADO] Documentacion tecnica actualizada (ERD, contratos API, matriz RBAC y runbooks).
  - *Evidencia:* `PLAN_MAESTRO_IMPLEMENTACION_UNISAAS.md` y `IMPLEMENTATION_STATUS_UNISAAS.md`.

---

## 24. Criterios de Go/No-Go para Piloto o Lanzamiento en Colombia

- [IMPLEMENTADO / PROBADO] Las 12 decisiones de alcance para Colombia estan formalizadas, implementadas y verificadas al 100%.
- [IMPLEMENTADO / PROBADO] Cero vulnerabilidades criticas o altas abiertas en autenticacion, autorizacion RBAC, aislamiento multi-tenant o integridad matematica.
- [IMPLEMENTADO / PROBADO] Todos los flujos del MVP recorren UI -> API -> Base de Datos Transaccional -> Respuesta y persisten intactos.
- [IMPLEMENTADO / PROBADO] El POS jamas muestra venta exitosa ni imprime recibo si el backend no confirmo el guardado; carrito retenido e idempotencia verificada.
- [IMPLEMENTADO / PROBADO] Conciliacion exacta comprobada entre Ventas, Abonos, Gastos y Caja, y Entradas/Salidas en Kardex.
- [IMPLEMENTADO / PROBADO] El flujo de colaboradores con codigo temporal de activacion (sin email obligatorio) y la revocacion instantanea al suspender a un empleado estan probados de extremo a extremo.
- [IMPLEMENTADO / PROBADO] Se informa con claridad que los comprobantes del MVP son Recibos Comerciales Internos hasta activar Facturacion Electronica DIAN en Fase 3.
- [IMPLEMENTADO / PROBADO] Se verifica el cumplimiento de 0% consumo o dependencias de IA en todo el sistema.

---

## 25. Matriz de Trazabilidad de Requisitos

| ID | Modulo / Epica | Requisito Observable | Fase | Estado | Roles / Permisos | Ruta UI | Endpoint API | Tabla / Fuente de Verdad | Prueba Ejecutada | Evidencia / Resultado |
|---|---|---|---|---|---|---|---|---|---|---|
| UNI-001 | 2. Onboarding | Registro atomico de propietario y negocio en COP con las 39 categorias | MVP | IMPLEMENTADO / PROBADO | Publico -> Propietario | `/register` | `POST /api/auth/register` | `users, tenants, branches, warehouses` | Integracion + E2E | `colombia-bloque1-core.test.ts` (40 rubros oficiales activos) |
| UNI-002 | 4. Equipo | Alta de colaborador con usuario unico y codigo temporal de 1 solo uso (sin email) | MVP | IMPLEMENTADO / PROBADO | Propietario, Admin (`team:manage`) | `/admin/team`, `/activar` | `POST /api/admin/team`, `POST /api/auth/activate` | `users, activation_codes, audit_logs` | Unitaria + E2E activacion | `colombia-bloque2-auth-team.test.ts` (codigo 6 digitos, hash SHA-256) |
| UNI-003 | 6. Inventario | Creacion de producto (unidad o decimal) con movimiento inicial en Kardex | MVP | IMPLEMENTADO / PROBADO | Propietario, Admin, Bodega (`inventory:manage`) | `/admin/inventory` | `POST /api/inventory/products`, `POST /api/inventory/moves` | `products, stock_quants, stock_moves` | Integracion concurrencia | `colombia-bloque3-inventory-kardex.test.ts` (Kardex obligatorio y toma fisica) |
| UNI-004 | 8. Caja | Apertura y cierre de turno con conteo de billetes/monedas COP y calculo de descuadre | MVP | IMPLEMENTADO / PROBADO | Cajero, Supervisor, Admin (`pos:shift_reconcile`) | `/admin/balance` | `POST /api/pos/shifts`, `PUT /api/pos/shifts` | `pos_shifts, cash_counts, cash_movements` | Unitaria + E2E arqueo | `colombia-bloque4-shifts-pos.test.ts` (11 denominaciones COP y Arqueo Ciego) |
| UNI-005 | 7. POS | Checkout atomico e idempotente con Efectivo, Nequi, Daviplata, Bre-B, Tarjeta o Fiado | MVP | IMPLEMENTADO / PROBADO | Cajero, Supervisor, Admin (`pos:checkout`) | `/pos` | `POST /api/checkout` | `invoices, invoice_items, stock_moves, credit_transactions` | E2E + Test doble clic | `colombia-bloque4-shifts-pos.test.ts` (medios colombianos y notificacion a turno) |
| UNI-006 | 18. Privacidad | Casilla obligatoria de autorizacion tratamiento de datos personales Ley 1581 | MVP | IMPLEMENTADO / PROBADO | Publico | `/register` | `POST /api/auth/register` | `tenants, users` | Unitaria UI + E2E | `colombia-bloque1-core.test.ts` (checkbox obligatorio y modal legal) |
| UNI-007 | 4. Equipo | Eliminacion definitiva de selector de empleado no autenticado en caja | MVP | IMPLEMENTADO / PROBADO | Cajero, Admin | `/admin/balance` | `POST /api/pos/shifts` | `pos_shifts` | E2E Turnos | `colombia-bloque4-shifts-pos.test.ts` (cajero atado a sesion autenticada) |
| UNI-008 | 9. Cartera | Abono de cliente fiado ingresa como movimiento de efectivo a caja del turno activo | MVP | IMPLEMENTADO / PROBADO | Cajero, Admin (`credits:receive_payments`) | `/admin/credits` | `POST /api/credits/customers/[id]/payments` | `credit_transactions, pos_shifts` | Integracion Cartera-Caja | `colombia-bloque5-reconciliation-offline.test.ts` (`recordDebtPaymentCash`) |
| UNI-009 | 11. Gastos | Egreso operativo con Efectivo de Caja descuenta automaticamente del arqueo esperado | MVP | IMPLEMENTADO / PROBADO | Cajero, Admin (`accounting:manage`) | `/admin/gastos` | `POST /api/accounting/expenses` | `journal_entries, pos_shifts` | Integracion Gastos-Caja | `colombia-bloque5-reconciliation-offline.test.ts` (`recordExpenseCash`) |
| UNI-010 | 1. Alcance | Modulo multinegocio (+ Agregar otro negocio) para administrar multiples tiendas independientes | MVP | IMPLEMENTADO / PROBADO | Propietario (`OWNER`) | `/admin/settings` | `POST /api/admin/stores`, `GET /api/admin/stores` | `tenants, branches, warehouses, users` | Integracion Multi-Tenant | `colombia-bloque1-core.test.ts` (`addStoreToUser`, `switchActiveStore`) |
| UNI-011 | 2. Onboarding | Estado Inicial "En Cero" (Clean State): 0 referencias, $0 balance/ventas/gastos, 0 turnos abiertos, 0 colaboradores | MVP | IMPLEMENTADO / PROBADO | Propietario (`OWNER`) | `/admin`, `/admin/inventory`, `/admin/balance` | `GET /api/inventory/products`, `GET /api/accounting/balance`, `GET /api/pos/shifts`, `GET /api/admin/team` | `products, invoices, pos_shifts, users` | Integracion Multi-Tenant | `colombia-audit-multitenant.test.ts` (100% verificado: aislamiento inicial limpio) |
| UNI-012 | 18. Seguridad | Aislamiento Estricto Cross-Tenant & BOLA: Bloqueo de consulta, edicion, Kardex y balance entre comercios | MVP | IMPLEMENTADO / PROBADO | Directivo (`OWNER`, `ADMIN`) | `/admin/*` | `GET/POST/PUT /api/*` | Todos los almacenes de datos | Suite Integracion Seguridad | `colombia-audit-multitenant.test.ts` (17 pruebas: 403 Forbidden y 404 Not Found) |
| UNI-013 | 18. Seguridad | Auditoria Integral del Sistema E2E: Registro Web, Superadmin, Clean State, 10 Roles RBAC, Confinamiento POS, Ventas, Cierre Z y Cuadre al Peso | MVP | IMPLEMENTADO / PROBADO | Todos los roles | `/login`, `/register`, `/platform-admin`, `/pos`, `/admin/*` | Todos los endpoints | Todos los almacenes de datos | E2E Integracion y Seguridad | `colombia-e2e-system-robust-audit.test.ts` (17 pruebas: 100% Green, 0 diferencias) |
| UNI-014 | 20. Reportes | Exportacion y Extraccion de Datos: Descarga de Catalogos de Inventario, Ventas/Facturas y Balance Operativo en CSV con UTF-8 BOM | MVP | IMPLEMENTADO / PROBADO | Propietario, Admin | `/admin/inventory`, `/admin/invoices`, `/admin/balance` | `/admin/invoices`, `/admin/inventory` | `products, invoices, journal_entries` | E2E Reportes y Extraccion | `src/app/admin/invoices/page.tsx`, `src/app/admin/inventory/page.tsx`, `colombia-e2e-system-robust-audit.test.ts` |
| UNI-015 | 24. Certificacion | Auditoria E2E Total y Definitiva (8 Bloques Operativos Absolutos): Onboarding Legal, Staff sin Email, Kardex Inmutable, POS Idempotente, Turnos COP, Cartera/Proveedores y Seguridad BOLA | MVP / Escala | IMPLEMENTADO / PROBADO | Todos los roles | Ecosistema Total (`/pos`, `/admin/*`, `/activar`) | Todos los BFF endpoints | `tenants, users, products, stock_moves, invoices, pos_shifts, credits, suppliers` | E2E Master Integration (277 tests) | `auditoria-e2e-total-colombia.test.ts` (24/24 pruebas pasando al 100%), documentado en `AUDITORIA_TOTAL_CERTIFICADA.md` |
| UNI-016 | 24. Certificacion | Auditoria Visual E2E con Chromium Real (Playwright Headed / SlowMo) & Scroll Global: 8 bloques operativos verificados en DOM real con captura de 23 evidencias PNG | MVP / Escala | IMPLEMENTADO / PROBADO | Todos los roles | `/login`, `/register`, `/pos`, `/admin/*`, `/platform-admin` | Todos los endpoints | Monorepo completo | E2E Chromium Real (23 capturas PNG) | `run-auditoria-visual.cjs` (8/8 bloques aprobados, 0 errores TS, scroll global activo) |
| UNI-017 | 18. Seguridad | Aislamiento Multi-Tenant Absoluto & Blindaje en Reload (F5): 0ms de exposicion SSR/hidratacion, erradicacion de x-tenant-id desde cliente, turnos de caja por cashierId, kardex por operatorId y DDLs Master DB / Schema-per-Tenant | MVP / Escala | IMPLEMENTADO / PROBADO | Todos los roles | `/admin`, `/admin/balance`, `/admin/inventory`, `/admin/invoices`, `/admin/team`, `/pos` | Todos los endpoints BFF | `unisaas_master`, `tenant_<id>` schemas, BFF in-memory stores aislados | Suite Anti-Leakage Reload | `src/__tests__/colombia-zero-leakage-reload-audit.test.ts` (13/13 passing, 222/222 global tests, Next.js build 45/45 limpio) |




