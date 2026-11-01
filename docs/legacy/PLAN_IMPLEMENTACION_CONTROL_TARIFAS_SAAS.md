# PLAN DE IMPLEMENTACION: CONTROL DINAMICO DE TARIFAS Y PLANES SAAS
**UniSaaS Platform Administration - Root Maestro**
**Estado:** COMPLETADO Y VERIFICADO AL 100% (MULTI-AGENTE DEEPSEEK + GEMINI 3.8)
**Fecha:** 21 de octubre de 2026
**Nivel de Aislamiento:** Zero-Regression / Anti-Slop / Produccion Enterprise

---

## 1. OBJETIVO Y ALCANCE

Permitir al Superadministrador Global de UniSaaS controlar, editar y activar/desactivar en tiempo real todas las tarifas comerciales de la plataforma desde la interfaz `/platform-admin?tab=planes`, abarcando desde el **Plan Free / Piloto ($0 COP)** hasta los planes comerciales superiores (`BASICO`, `PYME_PRO`, `RESTAURANTE_PRO`, `ENTERPRISE`).

### Principios Rectores
1. **Zero Hallucination / Zero Remiendos:** No se usarán mocks en memoria, archivos temporales volátiles ni hacks locales. La solución se persiste en la base de datos PostgreSQL mediante catálogo relacional formal.
2. **Cero Afectación al Código de OpenCode (Squad 1):** La columna `tenants.plan` sigue almacenando los códigos alfanuméricos inmutables (`FREE`, `BASICO`, `PYME_PRO`, `RESTAURANTE_PRO`, `ENTERPRISE`). Las reglas de negocio, aislamiento RLS y microservicios no sufren alteraciones de esquema destructivas.
3. **Persistencia y Trazabilidad:** Todo cambio de tarifa queda registrado con timestamp, dirección IP y correo del administrador en la bitácora `platform_audit_log`.
4. **Reactividad Total en Frontend:** La actualización de una tarifa recalcula automáticamente el KPI de MRR Estimado y actualiza los selectores de los formularios de alta de empresas sin requerir reinicio del servidor.

---

## 2. ARQUITECTURA DE DATOS Y CONTRATOS

### 2.1 Esquema DDL en PostgreSQL (`platform_plans`)
```sql
CREATE TABLE IF NOT EXISTS platform_plans (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price_cop NUMERIC(12, 2) NOT NULL DEFAULT 0,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  tagline VARCHAR(150),
  badge VARCHAR(40),
  color_accent VARCHAR(20) DEFAULT '#0066FF',
  max_pos_terminals INT NOT NULL DEFAULT 1,
  max_branches INT NOT NULL DEFAULT 1,
  max_invoices_per_month INT NOT NULL DEFAULT -1,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para lectura rapida por orden
CREATE INDEX IF NOT EXISTS idx_platform_plans_order ON platform_plans (display_order ASC);
```

### 2.2 Semillas Canónicas (Seed Data)
| Code | Nombre Comercial | Tarifa COP | Cajas | Sedes | Comprobantes / mes | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FREE` | Plan Piloto Comunitario | $ 0 | 1 | 1 | 100 | Activo |
| `BASICO` | Plan Emprendedor | $ 45.000 | 1 | 1 | 500 | Activo |
| `PYME_PRO` | Plan Comercio Mediano | $ 89.000 | 3 | 1 | -1 (Ilimitado) | Activo |
| `RESTAURANTE_PRO` | Plan Parrillas & Cadenas | $ 160.000 | 8 | 3 | -1 (Ilimitado) | Activo |
| `ENTERPRISE` | Plan Corporativo Multisede | $ 320.000 | -1 (A medida) | -1 (A medida) | -1 (Ilimitado) | Activo |

---

## 3. CONTRATO DE APIS Y ENDPOINTS

### 3.1 Backend Core (Squad 1 NestJS) / Upstream
Ruta base: `/api/v1/platform/plans`
- **`GET /api/v1/platform/plans`**
  - Seguridad: `UseGuards(PlatformAdminGuard)`
  - Respuesta: `200 OK` con `{ success: true, total: number, plans: PlatformPlanDto[] }`
- **`PATCH /api/v1/platform/plans/:code`**
  - Seguridad: `UseGuards(PlatformAdminGuard)`
  - Payload: `{ priceCOP?: number, name?: string, tagline?: string, isActive?: boolean, maxPosTerminals?: number, maxBranches?: number, maxInvoicesPerMonth?: number, features?: string[] }`
  - Validaciones: `priceCOP >= 0` (soporte explícito de tarifa cero).
  - Efecto Secundario: Inserción automática en `platform_audit_log` con acción `PLAN_TARIFF_UPDATED`.

### 3.2 BFF Next.js (Squad 4)
- **`GET /api/platform/plans`**: Invoca el upstream de Squad 1 vía `authServiceFetch('/api/v1/platform/plans')` con headers autenticados.
- **`PATCH /api/platform/plans/[code]`**: Valida permisos `PLATFORM_ADMIN`, limpia payload y reenvía a Squad 1 con gestión de errores resiliente.

---

## 4. INTERFAZ DE USUARIO (SQUAD 4 FRONTEND)

### 4.1 Ubicación
- Ruta: `/platform-admin?tab=planes`
- Archivo maestro: `src/app/platform-admin/page.tsx`

### 4.2 Componentes a Implementar
1. **Barra de Herramientas de Planes:**
   - Botón de refresco en tiempo real.
   - Botón "Editar Tarifas" (activa inputs inline en cada card o abre el Drawer/Modal de Edición Rápida).
2. **Cards Reactivas con Soporte de $0:**
   - Formateador COP inteligente: si `price_cop === 0`, renderiza `$ 0` con badge `GRATIS / PILOTO`.
   - Modificador de tarifa con validación numérica (evita caracteres alfabéticos o números negativos).
   - Toggle switch de activación/desactivación de planes para el catálogo público.
3. **Recálculo Dinámico de MRR:**
   - El KPI superior `MRR Estimado` pasa de `PLAN_FEES[t.plan]` a leer dinámicamente el mapa `plansMap[t.plan]?.price_cop || 0`.

---

## 5. ASIGNACION DE ROLES Y DIVISION MULTI-AGENTE

| Agente | Misión Técnica Asignada |
| :--- | :--- |
| **Agente Dev 1 (Database & Backend Core - OpenCode / DeepSeek)** | Crear y aplicar la migración DDL en PostgreSQL (`platform_plans`), poblar los registros iniciales y agregar los métodos en `platform.service.ts` y `platform.controller.ts` de Squad 1. |
| **Agente Dev 2 (BFF & Contracts - Antigravity / Gemini 3.8)** | Construir las rutas API `/api/platform/plans` y `/api/platform/plans/[code]` en Squad 4, asegurando paridad con `PlatformAdminGuard`. |
| **Agente Dev 3 (Frontend UI / UX - Antigravity / Gemini 3.8)** | Refactorizar la pestaña `activeTab === 'planes'` en `page.tsx`, integrando tarjetas editables, modal de ajuste y recálculo reactivo de MRR. |
| **Agente Dev 4 (QA, Auditoría y Sincronización)** | Ejecutar pruebas end-to-end con Chromium / Playwright, verificar que un cambio de precio persista tras recargar, verificar el log en la pestaña de auditoría y actualizar `MANUAL_ARRANQUE_Y_COMANDOS_UNISAAS.md`. |

---

## 6. CRITERIOS DE ACEPTACION (CHECKLIST DE DEFINICION DE TERMINADO)

- [x] La tabla `platform_plans` existe en la base de datos `saas_core` con los 5 planes canonicos (incluyendo Plan Free de $0).
- [x] El Superadministrador puede consultar y modificar las tarifas desde `/platform-admin?tab=planes`.
- [x] Guardar una tarifa de $0 COP es valido y no genera errores de tipo NaN ni bloqueos.
- [x] Cada modificacion de tarifa genera un registro visible en la pestana `Auditoria` de `/platform-admin`.
- [x] El modal de creacion de empresa (`+ Nueva Empresa`) carga dinamicamente las opciones de planes desde la base de datos.
- [x] Se integro 'FREE' en `PLATFORM_PLAN_CODES` de `platform.dto.ts` garantizando que el aprovisionamiento de empresas bajo Plan Piloto funcione al 100%.
- [x] Se corrigio la duplicacion visual de signo pesos (`$ $`) en la interfaz de administracion.
- [x] Se alineo la barra lateral (sidebar) de `/platform-admin` con la de `/admin`: ahora es fija (`fixed top-0 left-0 bottom-0 z-30 h-screen`), colapsable a 80px (`w-20`) y expansible en hover a 256px (`w-64 shadow-xl`) con offset `md:ml-20`.
- [x] Las pruebas de regresion demuestran que el login, el aprovisionamiento de tenants y el aislamiento RLS siguen operando al 100%.

---

## 7. REPORTE FINAL DE VERIFICACION MULTI-AGENTE Y CIERRE OPERATIVO

### 7.1 Resumen de Verificacion
- **Agentes Participantes:** OpenCode (DeepSeek V4.1 Flash) y Antigravity IDE (Gemini 3.8 Flash).
- **Herramienta de Coordinacion:** CLI `.\bridge.bat` y protocolo de sincronizacion operacional continua.
- **Base de Datos:** PostgreSQL `saas_core`, tabla `platform_plans` persistida con indices y constraints.
- **Microservicios Afectados:**
  - Squad 1 (NestJS): `platform.service.ts`, `platform.controller.ts`, `platform.dto.ts`, migración SQL.
  - Squad 4 (Next.js BFF & UI): `/api/platform/plans`, `/api/platform/plans/[code]`, `/platform-admin/page.tsx`, `/platform-admin/layout.tsx`.
- **Suite de Pruebas Automatizadas:** Script E2E ejecutado en Node.js validando login SuperAdmin, lectura dinamica, actualizacion de tarifas en tiempo real, persistencia en BD y registro inmutable en `platform_audit_logs`.
- **Estatus:** COMPLETADO Y OPERATIVO EN PRODUCCION.

