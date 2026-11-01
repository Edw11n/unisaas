# iniciar-unisaas.ps1
# Script Maestro de Orquestación y Arranque del Monorepo UniSaaS (2026)

param(
    [ValidateSet("Dev", "Web", "PM2", "Help")]
    [string]$Modo = "Dev",
    [switch]$Mobile,
    [string]$Dispositivo = "emulator-5554",
    [switch]$CleanPorts
)

$ErrorActionPreference = "Continue"
$RootPath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $RootPath) { $RootPath = Get-Location }

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  UNISAAS - ORQUESTADOR MAESTRO DE ARRANQUE (MONOREPO)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Ubicación: $RootPath" -ForegroundColor Gray
Write-Host "Modo:      $Modo" -ForegroundColor Yellow

# 1. Función para limpiar procesos huérfanos por puerto
function Cleanup-Port([int]$Port) {
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -and $pidToKill -gt 4) {
                Write-Host "[DevOps] Liberando puerto $Port (Proceso PID: $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 500
    }
}

# 2. Limpieza preventiva de puertos para evitar colisiones
$portsToClean = @(3000, 3001)
if ($CleanPorts -or ($Modo -in @("Dev", "Web", "PM2"))) {
    Write-Host "[DevOps] Verificando puertos operativos (3000, 3001)..." -ForegroundColor Gray
    foreach ($p in $portsToClean) {
        Cleanup-Port -Port $p
    }
}

if ($CleanPorts) {
    Write-Host "[OK] Puertos liberados satisfactoriamente." -ForegroundColor Green
    return
}

# 3. Ejecución según el modo seleccionado
switch ($Modo) {
    "Dev" {
        Write-Host "[1/2] Iniciando Backend API Gateway (NestJS en puerto 3000)..." -ForegroundColor Green
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath'; cmd.exe /c pnpm --filter @unisaas/api-gateway start:dev"
        
        Start-Sleep -Seconds 3
        Write-Host "[2/2] Iniciando Frontend Web POS (Next.js 15 en puerto 3001)..." -ForegroundColor Green
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath'; cmd.exe /c pnpm --filter @unisaas/web-pos dev"

        Write-Host "API Gateway: http://localhost:3000/api/v1 (Docs: /api/v1/docs)" -ForegroundColor Cyan
        Write-Host "Web POS:     http://localhost:3001" -ForegroundColor Cyan
    }

    "Web" {
        Write-Host "Iniciando únicamente Frontend Web POS (Next.js en puerto 3001)..." -ForegroundColor Green
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath'; cmd.exe /c pnpm --filter @unisaas/web-pos dev"
        Write-Host "Web POS: http://localhost:3001" -ForegroundColor Cyan
    }

    "PM2" {
        Write-Host "[DevOps] Levantando monorepo con PM2 en segundo plano..." -ForegroundColor Green
        Set-Location $RootPath
        pm2 start ecosystem.config.cjs
        pm2 status
    }

    "Help" {
        Write-Host "Uso: powershell -ExecutionPolicy Bypass -File iniciar-unisaas.ps1 [-Modo Dev|Web|PM2] [-Mobile] [-CleanPorts]" -ForegroundColor Gray
    }
}

# 4. Opción móvil Flutter
if ($Mobile) {
    Write-Host "[Móvil] Lanzando Mobile POS Flutter en dispositivo $Dispositivo..." -ForegroundColor Magenta
    $mobilePath = Join-Path $RootPath "apps\mobile-pos"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$mobilePath'; flutter run -d $Dispositivo"
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Operación completada." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
