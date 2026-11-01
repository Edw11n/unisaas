# ============================================================================
# EJECUCIÓN DE PRUEBAS DE CARGA k6 (UniSaaS QA-E2E)
# ============================================================================

param (
  [string]$Scenario = "mixed", # "search", "checkout", "mixed"
  [string]$Duration = "30s",
  [string]$K6Path = "C:\Users\Edwin\k6-v0.56.0-windows-amd64\k6.exe"
)

$ErrorActionPreference = "Stop"

$scenarioFile = switch ($Scenario) {
  "search" { "C:\unisaas\new\apps\qa-e2e\k6\scenarios\product-search.js" }
  "checkout" { "C:\unisaas\new\apps\qa-e2e\k6\scenarios\pos-checkout.js" }
  "mixed" { "C:\unisaas\new\apps\qa-e2e\k6\scenarios\mixed-workload.js" }
  Default { "C:\unisaas\new\apps\qa-e2e\k6\scenarios\mixed-workload.js" }
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "EJECUTANDO PRUEBA DE CARGA k6: $Scenario (Duración: $Duration)" -ForegroundColor Cyan
Write-Host "Script: $scenarioFile" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

$env:TEST_DURATION = $Duration
$env:API_BASE_URL = "http://localhost:3000/api/v1"
$reportsDir = "C:\unisaas\new\apps\qa-e2e\reports"
if (-not (Test-Path $reportsDir)) {
  New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
}
$env:SUMMARY_PATH = "$reportsDir\k6-$Scenario-summary.json"

# 1. Recopilar métricas iniciales
& powershell -NoProfile -ExecutionPolicy Bypass -File "C:\unisaas\new\apps\qa-e2e\scripts\collect-metrics.ps1" -OutputFile "$reportsDir\metrics-before.json"

# 2. Ejecutar k6
$summaryFile = "$reportsDir\k6-$Scenario-summary.json"
& $K6Path run $scenarioFile

# 3. Recopilar métricas posteriores
& powershell -NoProfile -ExecutionPolicy Bypass -File "C:\unisaas\new\apps\qa-e2e\scripts\collect-metrics.ps1" -OutputFile "$reportsDir\metrics-after.json"

Write-Host "✅ Prueba k6 finalizada. Resultados exportados a: $summaryFile" -ForegroundColor Green
