# Tablero de Estado de Migración Incremental por Squads — UniSaaS

**Última Actualización:** 1 de Noviembre de 2026  
**Estrategia:** Protocolo Maestro de Migración Incremental (1 squad a la vez)  
**Repositorio Histórico (Solo Lectura):** `C:\unisaas\old`  
**Repositorio Definitivo:** `C:\unisaas\new`  

---

## 1. Estado Consolidado de las 8 Squads

| # | Squad | Módulos en `new` | Estado | Cobertura de Pruebas | Commit |
|---|---|---|---|---|---|
| **1** | **Identity, RLS, RBAC, Onboarding & Platform** | `modules/identity`, `apps/api-gateway` | ✅ **CERRADA** | 25/25 Tests (100%) | `83cbdd2` |
| **2** | **Accounting, PUC & Financial Reports** | `modules/accounting` | ✅ **CERRADA** | 15/15 Tests (100%) | Pendiente de commit |
| **3** | **Inventory & Kardex CPP** | `modules/inventory` | ⏳ SIGUIENTE | Pendiente de inicio | - |
| **4** | **Web Desktop POS** | `apps/web-pos` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **5** | **Mobile POS Offline** | `apps/mobile-pos` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **6** | **Reports, Audit & ESCPOS** | `packages/escpos`, `modules/sales` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **7** | **Credits, Purchases & Suppliers** | `modules/credits` | ⏳ PENDIENTE | Pendiente de inicio | - |
| **8** | **DevOps, SRE & QA** | `apps/qa-e2e` | ⏳ PENDIENTE | Pendiente de inicio | - |

---

## 2. Detalle de Squad 1 (Cerrada)
- **Onboarding:** `POST /api/v1/auth/register` (Atómico en PostgreSQL bajo RLS, Tenant + Sede + Bodega + Propietario).
- **Rubros Comerciales:** 40 rubros colombianos con matriz de capacidades operativas.
- **Planes SaaS:** 4 planes con control de límites y modo piloto permisivo.
- **Sucursales:** CRUD completo bajo RLS.
- **Colaboradores:** Creación con código temporal de 6 dígitos, activación pública, rate limit y revocación en Redis.
- **Plataforma:** SuperAdmin login, TOTP RFC 6238, aprobación de empresas y auditoría global.
- **Verificación:** 25 pruebas unitarias passing, regresión de monorepo 22/22 passing.

---

## 3. Detalle de Squad 2 (Cerrada)
- **Plan Único de Cuentas (PUC):** Catálogo jerárquico NIIF, control de cuentas imputables `isSelectable` y activas `isActive`.
- **Constructor de Causación POS:** Causación automática NIIF para comprobantes POS: Efectivo (`110505`), Bancos (`111005`), Fiado (`130505`), Comercio (`413505`), IVA (`240805`), Ajuste al peso legal hasta \$1.00 COP (`429595`/`539595`), Costo de ventas e inventario (`613505`/`143505`).
- **Libro Diario y Reversión:** Doble partida balanceada estricta, número correlativo monotónico BigInt, contra-asiento de reversión exacto e idempotencia de comprobantes.
- **Estados Financieros Oficiales:** Balance de comprobación, Balance general clasificado ($A = P + P$ con P&G dinámico `360505`), Estado de resultados con utilidad bruta/neta, Libro auxiliar con saldo acumulado cronológico.
- **Verificación:** 15 pruebas unitarias passing (100%).

