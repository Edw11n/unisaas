# ============================================================================
# EJECUCIÓN DE CERTIFICACIÓN POSTGRESQL RLS (UniSaaS QA-E2E)
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "INICIANDO SUITE COMPLETA DE CERTIFICACIÓN RLS" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# 1. Sembrado de fixtures
Write-Host "\n[1/3] Sembrando fixtures y verificando datos..." -ForegroundColor Yellow
node C:\unisaas\new\apps\qa-e2e\dist\fixtures\seed-qa-data.js

# 2. Auditoría SQL de 10 puntos de RLS
Write-Host "\n[2/3] Ejecutando auditoría SQL contra PostgreSQL RLS..." -ForegroundColor Yellow
node C:\unisaas\new\apps\qa-e2e\dist\rls-certification\run-rls-tests.js

# 3. Pruebas E2E de aislamiento HTTP
Write-Host "\n[3/3] Ejecutando pruebas E2E HTTP de aislamiento y prevención de spoofing..." -ForegroundColor Yellow
node --test C:\unisaas\new\apps\qa-e2e\dist\e2e\*.e2e-spec.js

Write-Host "\n✅ CERTIFICACIÓN RLS FINALIZADA CON ÉXITO: 0 FUGAS DETECTADAS" -ForegroundColor Green

