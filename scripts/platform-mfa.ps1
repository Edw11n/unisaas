# ============================================================================
# UniSaaS - Administracion del MFA del superadministrador global
# ============================================================================
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/platform-mfa.ps1 -Action Status
#   powershell -ExecutionPolicy Bypass -File scripts/platform-mfa.ps1 -Action Reset -Confirm
#   powershell -ExecutionPolicy Bypass -File scripts/platform-mfa.ps1 -Action Disable -Confirm
#   powershell -ExecutionPolicy Bypass -File scripts/platform-mfa.ps1 -Action Enable
#
# Reset genera un secreto TOTP nuevo y 10 codigos de recuperacion nuevos.
# Guarde la salida en un lugar seguro: la clave y los codigos NO se vuelven a mostrar.
# ============================================================================

[CmdletBinding()]
param(
    [ValidateSet('Status', 'Reset', 'Disable', 'Enable')]
    [string]$Action = 'Status',
    [string]$Email = 'superadmin@unisaas.com',
    [switch]$Confirm,
    [string]$DbContainer = 'postgres-saas',
    [string]$Database = 'saas_contable_db',
    [string]$DbUser = 'saas_admin'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$generator = Join-Path $root 'scripts\platform-mfa-generate.js'

function Invoke-Psql {
    param([string]$Sql)
    return ($Sql | docker exec -i $DbContainer psql -U $DbUser -d $Database -v ON_ERROR_STOP=1 2>&1)
}

if ($Action -eq 'Status') {
    Invoke-Psql "SELECT email, mfa_enabled, (mfa_secret IS NOT NULL) AS has_secret, (SELECT count(*) FROM platform_recovery_codes c WHERE c.admin_id = a.id AND c.used_at IS NULL) AS recovery_remaining FROM platform_admins a WHERE lower(email) = lower('$Email');"
    exit 0
}

if (($Action -eq 'Reset' -or $Action -eq 'Disable') -and -not $Confirm) {
    Write-Host 'Debe ejecutar con -Confirm para modificar el MFA.' -ForegroundColor Yellow
    exit 1
}

$json = node $generator $Action.ToLower() $Email | ConvertFrom-Json
if (-not $json.sql) { throw 'No se pudo generar el SQL de MFA.' }

$result = Invoke-Psql $json.sql
Write-Host $result

if ($Action -eq 'Reset') {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $dir = Join-Path $root "backups\platform-mfa_$stamp"
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $file = Join-Path $dir 'CREDENCIALES_MFA.txt'
    @(
        'UNISAAS - Credenciales MFA del superadministrador',
        "Generado: $(Get-Date -Format o)",
        "Email: $($json.email)",
        "TOTP secret: $($json.secret)",
        "OTPAUTH URI: $($json.uri)",
        '',
        'Codigos de recuperacion (un solo uso):'
    ) + ($json.codes | ForEach-Object { "- $_" }) | Set-Content -Path $file -Encoding utf8
    Write-Host ''
    Write-Host '=== MFA REGENERADO ===' -ForegroundColor Green
    Write-Host "Email: $($json.email)"
    Write-Host "TOTP secret: $($json.secret)"
    Write-Host "OTPAUTH: $($json.uri)"
    Write-Host 'Codigos de recuperacion:'
    $json.codes | ForEach-Object { Write-Host "- $_" }
    Write-Host "Guardado en: $file" -ForegroundColor Yellow
} else {
    Write-Host $json.message -ForegroundColor Green
}
