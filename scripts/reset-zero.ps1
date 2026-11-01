# ============================================================================
# UniSaaS - reset a cero de datos transaccionales
# ============================================================================
# QUE HACE
#   - Respalda la base (pg_dump formato custom) ANTES de tocar datos.
#   - En UNA sola transaccion trunca las tablas transaccionales y reinicia
#     identidades (RESTART IDENTITY).
#   - Deja los saldos de inventario en su valor base: inventory_balances queda
#     vacia (0 unidades / 0 costo), coherente con un kardex tambien vacio.
#   - Reinicia tenant_sequences.current_value a 0 (numeracion de facturas y
#     turnos) salvo que se use -KeepSequences.
#
# QUE CONSERVA (datos maestros)
#   tenants, users, branches, warehouses, third_parties, products,
#   product_variants, product_barcodes, product_categories, unit_of_measures,
#   chart_of_accounts.
#   Tambien conserva tenant_sequences (solo reinicia su contador).
#
# SEGURIDAD
#   - Sin -DryRun exige confirmacion: -ConfirmReset o escribir BORRAR.
#   - Si hay apps PM2 online, se niega a ejecutar salvo -AllowOnline (evita
#     bloqueos por ACCESS EXCLUSIVE y escrituras concurrentes).
#   - Idempotente: puede ejecutarse varias veces; el resultado es el mismo.
#   - Si psql falla, la transaccion se revierte y no se aplica nada.
#
# USO
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -ConfirmReset
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-zero.ps1 -ConfirmReset -KeepSequences
#
# ADVERTENCIA: borra facturas, asientos, movimientos, turnos, creditos,
# compras, auditoria, outbox, idempotencia y saldos. NO ejecutar en produccion
# con datos reales sin autorizacion explicita.
# ============================================================================

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$ConfirmReset,
    [switch]$KeepSequences,
    [switch]$Cascade,
    [switch]$AllowOnline,
    [string]$BackupRoot = 'backups',
    [string]$DbContainer = 'postgres-saas',
    [string]$Database = 'saas_contable_db',
    [string]$DbUser = 'saas_admin'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Get-RepoRoot

# Tablas transaccionales a vaciar. NO agregar aqui datos maestros.
$targetTables = @(
    'invoice_items',
    'invoices',
    'journal_entry_lines',
    'journal_entries',
    'purchase_items',
    'purchases',
    'credit_transactions',
    'pos_shift_void_adjustments',
    'pos_shifts',
    'inventory_movement_lines',
    'inventory_movements',
    'inventory_ledger_entries',
    'inventory_idempotency_keys',
    'inventory_outbox_events',
    'inventory_audit_logs',
    'inventory_transfer_lines',
    'inventory_transfers',
    'stock_count_lines',
    'stock_counts',
    'inventory_balances',
    'audit_logs',
    'idempotency_keys'
)

$masterTables = @(
    'tenants',
    'users',
    'branches',
    'warehouses',
    'third_parties',
    'products',
    'product_variants',
    'product_barcodes',
    'product_categories',
    'unit_of_measures',
    'chart_of_accounts'
)

function Get-PublicTables {
    $result = Invoke-Psql -Sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" -Database $Database -User $DbUser -Container $DbContainer
    if ($result.ExitCode -ne 0) { throw "No se pudo listar las tablas: $($result.Output)" }
    return @($result.Output -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

function Get-TableCounts {
    param([string[]]$Tables, [string[]]$ExistingTables)
    $counts = [ordered]@{}
    $present = @($Tables | Where-Object { $ExistingTables -contains $_ })
    if ($present.Count -eq 0) { return $counts }

    $parts = @()
    foreach ($table in $present) {
        $parts += "SELECT '$table' AS tabla, count(*)::bigint AS filas FROM public.$table"
    }
    $sql = ($parts -join ' UNION ALL ') + ' ORDER BY 1;'
    $result = Invoke-Psql -Sql $sql -Database $Database -User $DbUser -Container $DbContainer
    if ($result.ExitCode -ne 0) { throw "No se pudieron contar filas: $($result.Output)" }

    foreach ($table in $present) { $counts[$table] = 0 }
    foreach ($line in ($result.Output -split "`n")) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '') { continue }
        $pieces = $trimmed.Split('|')
        if ($pieces.Count -ge 2) {
            $counts[$pieces[0]] = [int64]$pieces[1]
        }
    }
    return $counts
}

function Format-Counts {
    param($Counts)
    $rows = @()
    foreach ($key in $Counts.Keys) {
        $rows += [pscustomobject]@{ Tabla = $key; Filas = $Counts[$key] }
    }
    return $rows
}

# ---------------------------------------------------------------------------
# Inicio
# ---------------------------------------------------------------------------
Write-Title 'UniSaaS - reset a cero (datos transaccionales)'

if (-not (Test-DockerAvailable)) {
    Write-Fail 'Docker no esta disponible; se requiere el contenedor postgres-saas.'
    exit 1
}
$state = Get-DockerContainerState -Name $DbContainer
if (-not $state -or $state.Status -ne 'running') {
    Write-Fail "El contenedor '$DbContainer' no esta corriendo."
    exit 1
}
Write-Ok "Contenedor $DbContainer running/health=$($state.Health)"

$existingTables = Get-PublicTables
$presentTargets = @($targetTables | Where-Object { $existingTables -contains $_ })
$missingTargets = @($targetTables | Where-Object { $existingTables -notcontains $_ })

Write-Info "Base: $Database (usuario $DbUser)"
Write-Info "Tablas a vaciar presentes: $($presentTargets.Count) de $($targetTables.Count)"
if ($missingTargets.Count -gt 0) {
    Write-Info "No existen en esta base (se omiten): $($missingTargets -join ', ')"
}

Write-Section 'Conteo actual (tablas transaccionales)'
$beforeCounts = Get-TableCounts -Tables $presentTargets -ExistingTables $existingTables
$beforeRows = @(Format-Counts -Counts $beforeCounts)
if ($beforeRows.Count -gt 0) {
    $beforeRows | Sort-Object -Property Filas -Descending | Format-Table -AutoSize | Out-String | Write-Host
} else {
    Write-Info 'No hay tablas transaccionales presentes.'
}

Write-Section 'Conteo actual (datos maestros que se conservan)'
$masterCounts = Get-TableCounts -Tables $masterTables -ExistingTables $existingTables
$masterRows = @(Format-Counts -Counts $masterCounts)
if ($masterRows.Count -gt 0) {
    $masterRows | Sort-Object -Property Tabla | Format-Table -AutoSize | Out-String | Write-Host
}

# Vista previa del SQL
$truncateList = ($presentTargets | ForEach-Object { "public.$_" }) -join ', '
$sqlLines = @(
    "SET lock_timeout = '15s';",
    "SET statement_timeout = '300s';",
    'BEGIN;'
)
if ($truncateList) {
    $cascadeKeyword = ''
    if ($Cascade) { $cascadeKeyword = ' CASCADE' }
    $sqlLines += "TRUNCATE TABLE $truncateList RESTART IDENTITY$cascadeKeyword;"
}
if (-not $KeepSequences -and ($existingTables -contains 'tenant_sequences')) {
    $sqlLines += 'UPDATE public.tenant_sequences SET current_value = 0;'
}
$sqlLines += 'COMMIT;'
$sqlPreview = ($sqlLines -join [Environment]::NewLine)

Write-Section 'SQL a ejecutar (una transaccion)'
Write-Host $sqlPreview -ForegroundColor DarkGray

if ($DryRun) {
    Write-Host ''
    Write-Info 'MODO -DryRun: no se hizo backup ni se modifico ningun dato.'
    Write-Info 'Para ejecutar: scripts/reset-zero.ps1 -ConfirmReset (o escriba BORRAR en modo interactivo).'
    exit 0
}

# ---------------------------------------------------------------------------
# Salvaguardas
# ---------------------------------------------------------------------------
$pm2Online = @()
if (Test-CommandAvailable -Name 'pm2') {
    try {
        $raw = & pm2 jlist 2>$null
        $text = ($raw -join "`n").Trim()
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($text)) {
            # PM2 puede imprimir mensajes del daemon antes del JSON.
            $start = $text.IndexOf('[')
            $end = $text.LastIndexOf(']')
            if ($start -ge 0 -and $end -gt $start) {
                $parsed = ($text.Substring($start, $end - $start + 1)) | ConvertFrom-Json
                $pm2Online = @($parsed | Where-Object { $_.pm2_env.status -eq 'online' } | ForEach-Object { $_.name })
            }
        }
    } catch { }
}
if ($pm2Online.Count -gt 0 -and -not $AllowOnline) {
    Write-Fail "Hay apps PM2 online: $($pm2Online -join ', ')."
    Write-Info 'Detengalas (pm2 stop ecosystem.config.cjs) o use -AllowOnline bajo su responsabilidad.'
    exit 2
}

if (-not $ConfirmReset) {
    Write-Host ''
    Write-Warn 'Esta operacion BORRA datos transaccionales de forma irreversible (salvo restore del backup).'
    Write-Host "  Base: $Database | Tablas: $($presentTargets.Count) | Apps online: $($pm2Online.Count)" -ForegroundColor Yellow
    $answer = Read-Host "Escriba BORRAR (mayusculas) para continuar"
    if ($answer -cne 'BORRAR') {
        Write-Info 'Cancelado por el operador. No se realizo ningun cambio.'
        exit 0
    }
}

# ---------------------------------------------------------------------------
# Backup obligatorio
# ---------------------------------------------------------------------------
Write-Section 'Backup previo obligatorio'
$backup = New-DatabaseBackup -DestinationRoot (Join-Path $root $BackupRoot) -Database $Database -User $DbUser -Container $DbContainer
Write-Ok "Backup: $($backup.Path) ($(Get-HumanSize -Bytes $backup.Bytes))"
Write-Ok "SHA256: $($backup.Sha256)"

# ---------------------------------------------------------------------------
# Ejecucion transaccional
# ---------------------------------------------------------------------------
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("unisaas_reset_zero_{0}.sql" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempFile, $sqlPreview, $utf8NoBom)

$remote = '/tmp/unisaas_reset_zero.sql'
try {
    Write-Section 'Ejecutando reset'
    $copy = Invoke-Docker -Arguments @('cp', $tempFile, ("{0}:{1}" -f $DbContainer, $remote))
    if ($copy.ExitCode -ne 0) { throw "docker cp fallo: $($copy.Output)" }

    $apply = Invoke-Docker -Arguments @(
        'exec', $DbContainer, 'psql',
        '-U', $DbUser, '-d', $Database,
        '-v', 'ON_ERROR_STOP=1',
        '-f', $remote
    )
    if ($apply.ExitCode -ne 0) {
        throw "psql fallo y la transaccion fue revertida: $($apply.Output)"
    }
    Write-Ok 'Transaccion aplicada (COMMIT).'
} catch {
    Write-Fail $_.Exception.Message
    Write-Info 'La transaccion no se aplico; los datos quedaron como estaban.'
    Write-Info "Backup disponible: $($backup.Path)"
    exit 1
} finally {
    Invoke-Docker -Arguments @('exec', $DbContainer, 'rm', '-f', $remote) | Out-Null
    if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------------------
# Verificacion
# ---------------------------------------------------------------------------
Write-Section 'Verificacion posterior'
$afterCounts = Get-TableCounts -Tables $presentTargets -ExistingTables $existingTables
$afterRows = @(Format-Counts -Counts $afterCounts)
$nonZero = @($afterRows | Where-Object { $_.Filas -ne 0 })
if ($afterRows.Count -gt 0) {
    $afterRows | Sort-Object -Property Tabla | Format-Table -AutoSize | Out-String | Write-Host
}

$masterCountsAfter = Get-TableCounts -Tables $masterTables -ExistingTables $existingTables
$masterRowsAfter = @(Format-Counts -Counts $masterCountsAfter)
if ($masterRowsAfter.Count -gt 0) {
    $masterRowsAfter | Sort-Object -Property Tabla | Format-Table -AutoSize | Out-String | Write-Host
}

$report = [pscustomobject]@{
    executedAt  = (Get-Date).ToString('o')
    database    = $Database
    host        = $env:COMPUTERNAME
    operator    = $env:USERNAME
    backup      = $backup
    truncated   = $presentTargets
    omitted     = $missingTargets
    keptMaster  = $masterTables
    sequencesReset = (-not $KeepSequences)
    before      = $beforeCounts
    after       = $afterCounts
    masterAfter = $masterCountsAfter
}
$reportPath = Join-Path $backup.Directory ("RESET_ZERO_{0}.json" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding UTF8

if ($nonZero.Count -gt 0) {
    Write-Fail "Tablas que aun tienen filas: $(($nonZero | ForEach-Object { $_.Tabla }) -join ', ')"
    exit 1
}

Write-Host ''
Write-Ok 'Reset a cero completado: tablas transaccionales vacias y datos maestros intactos.'
Write-Info "Reporte: $reportPath"
Write-Info "Backup: $($backup.Path)"
exit 0
