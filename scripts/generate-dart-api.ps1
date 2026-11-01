# ==============================================================================
# Script: generate-dart-api.ps1
# Propósito: Genera el cliente HTTP y modelos Dart tipados a partir de la
#            especificación OpenAPI v3 de NestJS API Gateway para apps/mobile-pos.
# ==============================================================================

[CmdletBinding()]
param(
    [string]$SpecPath = "",
    [string]$OutputDir = "",
    [switch]$RegenerateSpec,
    [switch]$SkipFormat
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = (Resolve-Path "$ScriptDir/..").Path

if ([string]::IsNullOrWhiteSpace($SpecPath)) {
    $SpecPath = Join-Path $WorkspaceRoot "docs/openapi.json"
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $WorkspaceRoot "apps/mobile-pos/lib/core/api/generated"
}

# 1. Regenerar OpenAPI si se solicita o si no existe
if ($RegenerateSpec -or (-not (Test-Path $SpecPath))) {
    Write-Host "[1/4] Generando especificación OpenAPI desde apps/api-gateway..." -ForegroundColor Yellow
    $ApiGatewayDir = Join-Path $WorkspaceRoot "apps/api-gateway"
    
    # Compilar si dist no existe
    if (-not (Test-Path (Join-Path $ApiGatewayDir "dist/src/main.js"))) {
        Write-Host "  Compilando apps/api-gateway..." -ForegroundColor Gray
        Push-Location $ApiGatewayDir
        try {
            pnpm.cmd build
        } finally {
            Pop-Location
        }
    }
    
    # Ejecutar exportación
    Push-Location $ApiGatewayDir
    try {
        $env:EXPORT_OPENAPI = "true"
        node dist/src/main.js
    } finally {
        $env:EXPORT_OPENAPI = ""
        Pop-Location
    }
}

if (-not (Test-Path $SpecPath)) {
    Write-Error "No se encontró el archivo OpenAPI en $SpecPath"
}

Write-Host "[2/4] Archivo OpenAPI verificado: $SpecPath" -ForegroundColor Green

# 2. Preparar directorio de destino
Write-Host "[3/4] Generando cliente Dart con OpenAPI Generator..." -ForegroundColor Yellow
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$GenerateCmd = @(
    "npx.cmd",
    "@openapitools/openapi-generator-cli",
    "generate",
    "-i", "`"$SpecPath`"",
    "-g", "dart",
    "-o", "`"$OutputDir`"",
    "--additional-properties=pubName=unisaas_mobile_api,nullSafety=true"
)

$cmdString = $GenerateCmd -join " "
Write-Host "  Ejecutando: $cmdString" -ForegroundColor Gray
Invoke-Expression $cmdString

if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la generación OpenAPI Dart con código: $LASTEXITCODE"
}

# Limpiar directorio de pruebas esqueleto generadas dentro de lib/
$GeneratedTestDir = Join-Path $OutputDir "test"
if (Test-Path $GeneratedTestDir) {
    Remove-Item -Path $GeneratedTestDir -Recurse -Force | Out-Null
}

# 3. Formatear código con Dart
if (-not $SkipFormat) {
    Write-Host "[4/4] Formateando código generado con Dart formatter..." -ForegroundColor Yellow
    try {
        dart.cmd format $OutputDir
    } catch {
        Write-Host "  Aviso: No se pudo ejecutar dart.cmd format automáticamente ($($_))." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "[4/4] Formateo omitido por parámetro -SkipFormat" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[OK] Cliente Dart generado exitosamente en: $OutputDir" -ForegroundColor Green
