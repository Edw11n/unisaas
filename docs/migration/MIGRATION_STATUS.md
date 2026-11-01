# Tablero de Estado de Migración Incremental por Squads — UniSaaS

**Última Actualización:** 1 de Noviembre de 2026  
**Estrategia:** Protocolo Maestro de Migración Incremental (1 squad a la vez)  
**Repositorio Histórico (Solo Lectura):** `C:\unisaas\old`  
**Repositorio Definitivo:** `C:\unisaas\new`  

---

## 1. Estado Consolidado de las 8 Squads

| # | Squad | Módulos en `new` | Estado | Cobertura de Pruebas | Commit |
|---|---|---|---|---|---|
| **1** | **Identity, RLS, RBAC, Onboarding & Platform** | `modules/identity`, `apps/api-gateway` | ✅ **CERRADA** | 25/25 Tests (100%) | Pendiente de commit |
| **2** | **Accounting, PUC & Financial Reports** | `modules/accounting` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **3** | **POS Sales, Billing, Taxes & Shifts** | `modules/sales`, `api-gateway/checkout` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **4** | **Inventory, Kardex, Warehouses & Purchasing** | `modules/inventory` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **5** | **Credits, Receivables & Fiados** | `modules/credits` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **7** | **Public Catalog, WhatsApp & Omnichannel** | `modules/catalog` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **6** | **Offline-First, POS Sync & IndexedDB** | `apps/web-pos` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **8** | **Analytics, BI & Operational Dashboards** | `modules/analytics` | ⏳ PENDIENTE | Pendiente de inicio | - |

---

## 2. Detalle de Squad 1 (Cerrada)
- **Onboarding:** `POST /api/v1/auth/register` (Atómico en PostgreSQL bajo RLS, Tenant + Sede + Bodega + Propietario).
- **Rubros Comerciales:** 40 rubros colombianos con matriz de capacidades operativas.
- **Planes SaaS:** 4 planes con control de límites y modo piloto permisivo.
- **Sucursales:** CRUD completo bajo RLS.
- **Colaboradores:** Creación con código temporal de 6 dígitos, activación pública, rate limit y revocación en Redis.
- **Plataforma:** SuperAdmin login, TOTP RFC 6238, aprobación de empresas y auditoría global.
- **Verificación:** 25 pruebas unitarias passing, regresión de monorepo 22/22 passing.
