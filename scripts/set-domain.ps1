# ============================================================================
# UniSaaS - cambio de dominio publico en los .env de los squads
# ============================================================================
# QUE HACE
#   - Actualiza SOLO claves de dominio/URL/cookies en los .env existentes.
#   - No toca secretos (JWT_SECRET, DATABASE_URL, REDIS_URL, passwords).
#   - Crea un respaldo <archivo>.<timestamp>.bak antes de escribir.
#   - Muestra un diff resumido por archivo y clave.
#   - Con -DryRun solo muestra el plan.
#
# CLAVES QUE ACTUALIZA
#   Raiz:        APP_URL, CORS_ORIGINS, COOKIE_SECURE, COOKIE_SAME_SITE,
#                NEXT_PUBLIC_API_GATEWAY_URL, PUBLIC_HOST, PUBLIC_SCHEME,
#                TLS_CERT_PATH/TLS_KEY_PATH (solo si ya existen y Scheme=https).
#   Squads 1/2/3/6/7: APP_URL, CORS_ORIGINS, COOKIE_SECURE, COOKIE_SAME_SITE.
#   Squad 4:     las anteriores + NEXT_PUBLIC_API_GATEWAY_URL y
#                NEXT_PUBLIC_{AUTH,ACCOUNTING,INVENTORY,REPORTS,CREDITS}_SERVICE_URL.
#
# IMPORTANTE
#   - NEXT_PUBLIC_* se HORNEAN en `next build`. Despues de ejecutar este script
#     hay que reconstruir el BFF (scripts/deploy.ps1). El script NO reinicia PM2.
#   - S5 (Flutter) no se modifica: sus URLs usan 10.0.2.2/localhost para el
#     emulador. Ajuste AUTH_SERVICE_URL y demas manualmente para produccion.
#
# USO
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-domain.ps1 -Domain app.example.com -Scheme https
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-domain.ps1 -Domain 192.168.1.10:3100 -Scheme http -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-domain.ps1 -Domain app.example.com -Scheme https -ExtraOrigins https://admin.example.com
# ============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [ValidateSet('http', 'https')][string]$Scheme = 'https',
    [string]$ExtraOrigins = '',
    [switch]$DryRun,
    [switch]$NoBackup
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Get-RepoRoot
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# ---------------------------------------------------------------------------
# Validacion del dominio/origen
# ---------------------------------------------------------------------------
function Assert-PublicHost {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -match '^[A-Za-z][A-Za-z0-9+.-]*://') {
        throw "Use solo host[:puerto], sin esquema: '$Value'."
    }
    if ($Value.Contains('/') -or $Value.Contains(' ') -or $Value.Contains('@')) {
        throw "Dominio invalido: '$Value'. Use host[:puerto] sin ruta, espacios ni credenciales."
    }
    if ($Value -match '\.\.' -or $Value.StartsWith('.') -or $Value.EndsWith('.')) {
        throw "Dominio invalido: '$Value'."
    }
    if ($Value -notmatch '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$') {
        throw "Dominio invalido: '$Value'. Ejemplos validos: app.example.com, 192.168.1.10:3100, localhost:3000."
    }

    $parts = $Value.Split(':')
    if ($parts.Count -gt 2) {
        throw "IPv6 no esta soportado por este script: '$Value'."
    }
    if ($parts.Count -eq 2) {
        $portNumber = 0
        if (-not [int]::TryParse($parts[1], [ref]$portNumber) -or $portNumber -lt 1 -or $portNumber -gt 65535) {
            throw "Puerto invalido en '$Value'."
        }
    }
}

function Assert-PublicOrigin {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -notmatch '^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$') {
        throw "Origen invalido: '$Value'. Use http(s)://host[:puerto], sin barra final."
    }
}

$Domain = $Domain.Trim()
Assert-PublicHost -Value $Domain
$hostOnly = $Domain.Split(':')[0]
$baseUrl = "${Scheme}://${Domain}"

$origins = New-Object System.Collections.Generic.List[string]
$origins.Add($baseUrl) | Out-Null
if ($ExtraOrigins) {
    foreach ($extra in $ExtraOrigins.Split(',')) {
        $candidate = $extra.Trim().TrimEnd('/')
        if ($candidate -eq '') { continue }
        Assert-PublicOrigin -Value $candidate
        if (-not $origins.Contains($candidate)) {
            $origins.Add($candidate) | Out-Null
        }
    }
}
$corsValue = ($origins -join ',')

# ---------------------------------------------------------------------------
# Edicion de .env preservando comentarios/orden y sin imprimir secretos
# ---------------------------------------------------------------------------
function Update-EnvFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][System.Collections.Specialized.OrderedDictionary]$Updates,
        [string[]]$OnlyIfPresent = @()
    )

    $text = [System.IO.File]::ReadAllText($Path)
    if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
        $text = $text.Substring(1)
    }
    $lineEnding = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $hadTrailingNewline = $text.EndsWith("`n")

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($line in ($text -split "\r?\n")) {
        $lines.Add($line)
    }
    if ($hadTrailingNewline -and $lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') {
        $lines.RemoveAt($lines.Count - 1)
    }

    $changes = New-Object System.Collections.Generic.List[object]

    foreach ($key in $Updates.Keys) {
        $newValue = [string]$Updates[$key]
        $pattern = '^(\s*)' + [regex]::Escape($key) + '\s*=\s*(.*)$'
        $foundIndex = -1
        $oldValue = ''
        $lead = ''
        $comment = ''

        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match $pattern) {
                $foundIndex = $i
                $lead = $Matches[1]
                $rawValue = $Matches[2]
                $commentAt = $rawValue.IndexOf(' #')
                if ($commentAt -ge 0) {
                    $comment = $rawValue.Substring($commentAt)
                    $rawValue = $rawValue.Substring(0, $commentAt).TrimEnd()
                }
                $oldValue = $rawValue.Trim()
                break
            }
        }

        if ($foundIndex -ge 0) {
            $newLine = "$lead$key=$newValue$comment"
            if ($lines[$foundIndex] -ne $newLine) {
                $lines[$foundIndex] = $newLine
                $changes.Add([pscustomobject]@{
                    Action = 'update'
                    Key    = $key
                    Old    = $oldValue
                    New    = $newValue
                }) | Out-Null
            }
            continue
        }

        if ($OnlyIfPresent -contains $key) { continue }

        $lines.Add("$key=$newValue") | Out-Null
        $changes.Add([pscustomobject]@{
            Action = 'add'
            Key    = $key
            Old    = ''
            New    = $newValue
        }) | Out-Null
    }

    if ($changes.Count -eq 0) {
        return @()
    }

    if (-not $DryRun) {
        if (-not $NoBackup) {
            $backupPath = "$Path.$stamp.bak"
            Copy-Item -LiteralPath $Path -Destination $backupPath -Force
        }
        $newText = ($lines -join $lineEnding)
        if ($hadTrailingNewline -or $changes.Count -gt 0) {
            $newText += $lineEnding
        }
        [System.IO.File]::WriteAllText(
            $Path,
            $newText,
            (New-Object System.Text.UTF8Encoding($false))
        )
    }

    return $changes
}

function Format-DiffValue {
    param([AllowEmptyString()][string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return '(vacio)' }
    if ($Value.Length -le 160) { return $Value }
    return $Value.Substring(0, 157) + '...'
}

function New-ManagedUpdates {
    param(
        [Parameter(Mandatory = $true)][string]$Kind,
        [Parameter(Mandatory = $true)][hashtable]$Existing
    )

    $updates = [ordered]@{}
    $updates['APP_URL'] = $baseUrl
    $updates['CORS_ORIGINS'] = $corsValue
    $cookieSecure = if ($Scheme -eq 'https') { 'true' } else { 'false' }
    $updates['COOKIE_SECURE'] = $cookieSecure

    $sameSite = 'lax'
    if ($Existing.ContainsKey('COOKIE_SAME_SITE')) {
        $candidate = ([string]$Existing['COOKIE_SAME_SITE']).Trim().ToLowerInvariant()
        if (@('lax', 'strict', 'none') -contains $candidate) {
            $sameSite = $candidate
        }
    }
    if ($Scheme -eq 'http' -and $sameSite -eq 'none') {
        Write-Warn "COOKIE_SAME_SITE=none no es valido sobre HTTP en $Kind; se usara lax."
        $sameSite = 'lax'
    }
    $updates['COOKIE_SAME_SITE'] = $sameSite

    if ($Kind -eq 'bff' -or $Kind -eq 'root') {
        $updates['NEXT_PUBLIC_API_GATEWAY_URL'] = $baseUrl
    }

    if ($Kind -eq 'bff') {
        $updates['NEXT_PUBLIC_AUTH_SERVICE_URL'] = "$baseUrl/svc/auth"
        $updates['NEXT_PUBLIC_ACCOUNTING_SERVICE_URL'] = "$baseUrl/svc/accounting"
        $updates['NEXT_PUBLIC_INVENTORY_SERVICE_URL'] = "$baseUrl/svc/inventory"
        $updates['NEXT_PUBLIC_REPORTS_SERVICE_URL'] = "$baseUrl/svc/reports"
        $updates['NEXT_PUBLIC_CREDITS_SERVICE_URL'] = "$baseUrl/svc/credits"
    }

    if ($Kind -eq 'root') {
        $updates['PUBLIC_HOST'] = $hostOnly
        $updates['PUBLIC_SCHEME'] = $Scheme
        if ($Scheme -eq 'https') {
            $updates['TLS_CERT_PATH'] = "/etc/letsencrypt/live/$hostOnly/fullchain.pem"
            $updates['TLS_KEY_PATH'] = "/etc/letsencrypt/live/$hostOnly/privkey.pem"
        }
    }

    return $updates
}

# ---------------------------------------------------------------------------
# Objetivos
# ---------------------------------------------------------------------------
$squads = @(
    @{ Label = 'raiz'; Kind = 'root'; Path = (Join-Path $root '.env') },
    @{ Label = 'S1 core/auth'; Kind = 'api'; Path = (Join-Path $root 'squad1_core_architecture_rls_rbac-main\.env') },
    @{ Label = 'S2 accounting'; Kind = 'api'; Path = (Join-Path $root 'squad2_accounting_engine_ledger-main\.env') },
    @{ Label = 'S3 inventory'; Kind = 'api'; Path = (Join-Path $root 'squad3_inventory_kardex_cpp-master\.env') },
    @{ Label = 'S4 BFF/POS'; Kind = 'bff'; Path = (Join-Path $root 'squad4_web_desktop_pos_nextjs-main\.env') },
    @{ Label = 'S6 reports'; Kind = 'api'; Path = (Join-Path $root 'squad6_reports_audit_escpos-develop\.env') },
    @{ Label = 'S7 credits'; Kind = 'api'; Path = (Join-Path $root 'squad7_credits_purchases_suppliers-main\.env') }
)

$onlyIfPresent = @('NEXT_PUBLIC_APP_URL', 'TLS_CERT_PATH', 'TLS_KEY_PATH')
$totalChanges = 0

Write-Title 'Cambio de dominio publico'
Write-Info "Origen base: $baseUrl"
Write-Info "CORS: $corsValue"
Write-Info ("COOKIE_SECURE: {0}; COOKIE_SAME_SITE: se conserva o lax" -f $(if ($Scheme -eq 'https') { 'true' } else { 'false' }))
if ($DryRun) { Write-Info 'DryRun: no se escribira ningun archivo.' }

foreach ($target in $squads) {
    $path = $target.Path
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Info ("{0}: sin .env; se omite ({1})" -f $target.Label, $path)
        continue
    }

    $existing = Get-EnvFile -Path $path
    $updates = New-ManagedUpdates -Kind $target.Kind -Existing $existing

    # NEXT_PUBLIC_APP_URL solo se actualiza si el archivo ya la declara.
    if ($existing.ContainsKey('NEXT_PUBLIC_APP_URL')) {
        $updates['NEXT_PUBLIC_APP_URL'] = $baseUrl
    }

    # En la raiz, TLS_* solo aplica con HTTPS y solo si ya existen.
    if ($target.Kind -eq 'root' -and $Scheme -eq 'http') {
        $updates.Remove('TLS_CERT_PATH')
        $updates.Remove('TLS_KEY_PATH')
    }

    $changes = @(Update-EnvFile -Path $path -Updates $updates -OnlyIfPresent $onlyIfPresent)
    $relative = $path.Substring($root.Length).TrimStart([char[]]@('\', '/'))
    Write-Section ("{0} ({1})" -f $target.Label, $relative)
    if ($changes.Count -eq 0) {
        Write-Info 'sin cambios'
        continue
    }

    foreach ($change in $changes) {
        $totalChanges += 1
        if ($change.Action -eq 'add') {
            Write-Host ("  + {0}={1}" -f $change.Key, (Format-DiffValue -Value $change.New)) -ForegroundColor Green
        }
        else {
            Write-Host ("  ~ {0}: {1} -> {2}" -f $change.Key, (Format-DiffValue -Value $change.Old), (Format-DiffValue -Value $change.New)) -ForegroundColor Yellow
        }
    }
}

Write-Title 'Resumen'
if ($totalChanges -eq 0) {
    Write-Ok 'No habia cambios pendientes.'
}
else {
    $existingFiles = @($squads | Where-Object { Test-Path -LiteralPath $_.Path }).Count
    if ($DryRun) {
        Write-Ok ("{0} cambios planificados en {1} archivos (no escritos)." -f $totalChanges, $existingFiles)
    }
    else {
        Write-Ok ("{0} cambios aplicados en {1} archivos." -f $totalChanges, $existingFiles)
        Write-Warn 'NEXT_PUBLIC_* se hornea en next build: reconstruya S4 antes de reiniciar.'
        Write-Info 'Siguiente paso: scripts/deploy.ps1 (build + migraciones + PM2).'
    }
}

if ($Scheme -eq 'http') {
    Write-Warn 'HTTP/LAN: COOKIE_SECURE=false. No exponga este modo a Internet sin TLS.'
}
Write-Info 'S5 (Flutter) no se modifica: ajuste sus URLs de API manualmente si publica fuera del emulador.'
exit 0
