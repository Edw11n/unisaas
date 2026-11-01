# ============================================================================
# UniSaaS - importacion/restauracion de base de datos (pg_restore)
# ============================================================================
# QUE HACE
#   - Restaura un dump custom generado por scripts/export-db.ps1.
#   - Verifica checksum (.sha256) si existe.
#   - Crea la base destino si falta.
#   - Si la base ya existe, SOLO continua con -Force (recrea la base).
#   - Verifica tablas y conteos contra el .manifest.json del dump.
#
# SEGURIDAD
#   - Pide escribir RESTAURAR antes de cualquier cambio destructivo.
#   - No imprime secretos: usa la autenticacion del contenedor o PGPASSWORD
#     tomado del entorno (nunca por parametro).
#   - Si el restore falla despues de recrear la base, deja constancia y no
#     oculta el error. El respaldo previo sigue siendo la via de rollback.
#
# USO
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath backups\...\db.dump
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath ... -Force
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-db.ps1 -DumpPath ... -Force -Yes
#
# MODO HOST (-UseHostTools)
#   Requiere pg_restore/psql en el PATH y PGPASSWORD definido en el entorno.
#   Host/puerto se toman de -PgHost/-PgPort (o PGHOST/PGPORT si se omiten).
# ============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DumpPath,
    [string]$Database = 'saas_contable_db',
    [string]$DbContainer = 'postgres-saas',
    [string]$DbUser = 'saas_admin',
    [string]$Owner = '',
    [switch]$Force,
    [switch]$Yes,
    [switch]$DryRun,
    [switch]$SkipChecksum,
    [switch]$NoPrivileges,
    [switch]$AllowCountMismatch,
    [switch]$UseHostTools,
    [string]$PgHost = '',
    [int]$PgPort = 0
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Get-RepoRoot

function Resolve-RepoPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    return (Join-Path $root $Path)
}

function Assert-PgIdentifier {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Label
    )
    if ($Name -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}$') {
        throw "$Label invalido: '$Name'. Use solo letras, numeros, guion, punto o guion bajo."
    }
}

function Invoke-PsqlDb {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$TargetDatabase
    )
    return Invoke-Psql -Sql $Sql -Database $TargetDatabase -User $DbUser -Container $DbContainer
}

function Test-DatabaseExists {
    param([Parameter(Mandatory = $true)][string]$TargetDatabase)
    $escaped = $TargetDatabase.Replace("'", "''")
    $result = Invoke-PsqlDb -Sql "SELECT 1 FROM pg_database WHERE datname = '$escaped';" -TargetDatabase 'postgres'
    if ($result.ExitCode -ne 0) {
        throw "No se pudo consultar pg_database: $($result.Output)"
    }
    return ($result.Output.Trim() -eq '1')
}

function Get-PublicTableList {
    param([Parameter(Mandatory = $true)][string]$TargetDatabase)
    $result = Invoke-PsqlDb -Sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" -TargetDatabase $TargetDatabase
    if ($result.ExitCode -ne 0) {
        throw "No se pudieron listar las tablas de '$TargetDatabase': $($result.Output)"
    }
    return @($result.Output -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

function Get-TableCounts {
    param(
        [Parameter(Mandatory = $true)][string]$TargetDatabase,
        [string[]]$Tables = @()
    )
    $counts = [ordered]@{}
    if ($Tables.Count -eq 0) { return $counts }

    $parts = @()
    foreach ($table in $Tables) {
        $label = $table.Replace("'", "''")
        $quoted = $table.Replace('"', '""')
        $parts += "SELECT '$label' AS tabla, count(*)::bigint AS filas FROM public.""$quoted"""
    }
    $sql = ($parts -join ' UNION ALL ') + ' ORDER BY 1;'
    $result = Invoke-PsqlDb -Sql $sql -TargetDatabase $TargetDatabase
    if ($result.ExitCode -ne 0) {
        throw "No se pudieron contar filas en '$TargetDatabase': $($result.Output)"
    }

    foreach ($table in $Tables) { $counts[$table] = [int64]0 }
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

function Get-HostTableCounts {
    param(
        [Parameter(Mandatory = $true)][string]$TargetDatabase,
        [string[]]$Tables = @(),
        [string]$HostName = '127.0.0.1',
        [int]$Port = 5432
    )
    $counts = [ordered]@{}
    if ($Tables.Count -eq 0) { return $counts }

    $parts = @()
    foreach ($table in $Tables) {
        $label = $table.Replace("'", "''")
        $quoted = $table.Replace('"', '""')
        $parts += "SELECT '$label' AS tabla, count(*)::bigint AS filas FROM public.""$quoted"""
    }
    $sql = ($parts -join ' UNION ALL ') + ' ORDER BY 1;'

    $raw = & psql -h $HostName -p $Port -U $DbUser -d $TargetDatabase -t -A -v ON_ERROR_STOP=1 -c $sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql fallo al contar filas en '$TargetDatabase'."
    }

    foreach ($table in $Tables) { $counts[$table] = [int64]0 }
    foreach ($line in @($raw)) {
        $trimmed = ([string]$line).Trim()
        if ($trimmed -eq '') { continue }
        $pieces = $trimmed.Split('|')
        if ($pieces.Count -ge 2) {
            $counts[$pieces[0]] = [int64]$pieces[1]
        }
    }
    return $counts
}

function Invoke-HostPsql {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$TargetDatabase,
        [string]$HostName = '127.0.0.1',
        [int]$Port = 5432
    )
    $raw = & psql -h $HostName -p $Port -U $DbUser -d $TargetDatabase -t -A -v ON_ERROR_STOP=1 -c $Sql 2>&1
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = (($raw | ForEach-Object { "$_" }) -join "`n").Trim() }
}

function Confirm-RestoreAction {
    param([Parameter(Mandatory = $true)][string]$Action)
    if ($Yes) { return }
    Write-Warn "Accion: $Action sobre la base '$Database'."
    $answer = Read-Host "Escriba RESTAURAR para continuar"
    if ($answer -cne 'RESTAURAR') {
        throw 'Confirmacion cancelada por el operador.'
    }
}

function Get-ManifestPath {
    param([Parameter(Mandatory = $true)][string]$DumpFile)
    $candidates = @("$DumpFile.manifest.json")
    $withoutExtension = [System.IO.Path]::ChangeExtension($DumpFile, $null)
    if ($withoutExtension) {
        $candidates += "$withoutExtension.manifest.json"
    }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

# ---------------------------------------------------------------------------
# Validaciones iniciales (sin tocar la base)
# ---------------------------------------------------------------------------
Assert-PgIdentifier -Name $Database -Label 'Nombre de base'
if ($Owner) { Assert-PgIdentifier -Name $Owner -Label 'Owner' }

$dumpFile = Resolve-RepoPath -Path $DumpPath
if (-not (Test-Path -LiteralPath $dumpFile)) {
    throw "No existe el dump: $dumpFile"
}
$dumpInfo = Get-Item -LiteralPath $dumpFile
if (-not $dumpInfo -or $dumpInfo.Length -le 0) {
    throw "El dump esta vacio: $dumpFile"
}

$hostName = if ($PgHost) { $PgHost } elseif ($env:PGHOST) { $env:PGHOST } else { '127.0.0.1' }
$port = if ($PgPort -gt 0) { $PgPort } elseif ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }
$manifestPath = Get-ManifestPath -DumpFile $dumpFile
$manifest = $null
if ($manifestPath) {
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Warn "No se pudo leer el manifiesto '$manifestPath'; se omitira la comparacion de conteos."
        $manifest = $null
    }
}

Write-Title 'Importacion de base de datos'
Write-Info "Dump: $dumpFile"
Write-Info ("Tamano: {0}" -f (Get-HumanSize -Bytes $dumpInfo.Length))
Write-Info "Base destino: $Database"
Write-Info ("Modo: " + $(if ($UseHostTools) { "host ($hostName`:$port)" } else { "contenedor ($DbContainer)" }))

# Checksum
$sidecar = "$dumpFile.sha256"
if (Test-Path -LiteralPath $sidecar) {
    $expected = ([System.IO.File]::ReadAllText($sidecar)).Trim().Split(' ')[0]
    $actual = Get-Sha256 -Path $dumpFile
    if ($expected -and ($actual -ne $expected)) {
        if ($SkipChecksum) {
            Write-Warn 'Checksum no coincide; se continua por -SkipChecksum.'
        }
        else {
            throw "Checksum no coincide. Esperado: $expected; calculado: $actual. Use -SkipChecksum solo si verifico el archivo manualmente."
        }
    }
    elseif ($expected) {
        Write-Ok 'Checksum verificado.'
    }
}
else {
    Write-Warn 'No hay sidecar .sha256; no se puede verificar integridad automaticamente.'
}

if ($manifest -and $manifest.tables) {
    $expectedTables = @($manifest.tables.PSObject.Properties | ForEach-Object { $_.Name })
    Write-Info ("Manifiesto: {0} tablas, {1} filas de origen." -f $expectedTables.Count, (($manifest.tables.PSObject.Properties | Measure-Object -Property Value -Sum).Sum))
}
else {
    $expectedTables = @()
    Write-Warn 'Sin manifiesto de conteos; la verificacion final sera estructural.'
}

if ($DryRun) {
    Write-Info 'DryRun: no se modifica la base.'
    if (-not $UseHostTools) {
        $exists = Test-DatabaseExists -TargetDatabase $Database
        if ($exists) {
            Write-Warn "La base '$Database' ya existe. Se requiere -Force para recrearla."
        }
        else {
            Write-Info "La base '$Database' no existe; se crearia vacia."
        }
    }
    if ($expectedTables.Count -gt 0) {
        Write-Info ("Se verificarian {0} tablas contra el manifiesto." -f $expectedTables.Count)
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Estado de la base destino
# ---------------------------------------------------------------------------
if ($UseHostTools) {
    if (-not (Test-CommandAvailable -Name 'pg_restore')) {
        throw 'pg_restore no esta en PATH. Instale el cliente PostgreSQL o use el modo contenedor.'
    }
    if (-not (Test-CommandAvailable -Name 'psql')) {
        throw 'psql no esta en PATH; es necesario para crear/verificar la base en -UseHostTools.'
    }
    if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
        throw 'PGPASSWORD no esta definido en el entorno; es obligatorio en -UseHostTools.'
    }
    $existsResult = Invoke-HostPsql -Sql "SELECT 1 FROM pg_database WHERE datname = '$($Database.Replace("'", "''"))';" -TargetDatabase 'postgres' -HostName $hostName -Port $port
    if ($existsResult.ExitCode -ne 0) {
        throw "No se pudo consultar pg_database en '$hostName`:$port'."
    }
    $databaseExists = ($existsResult.Output -eq '1')
}
else {
    $state = Get-DockerContainerState -Name $DbContainer
    if (-not $state -or $state.Status -ne 'running') {
        throw "El contenedor '$DbContainer' no esta corriendo. Use -UseHostTools o inicie PostgreSQL."
    }
    $databaseExists = Test-DatabaseExists -TargetDatabase $Database
}

if ($databaseExists -and -not $Force) {
    throw "La base '$Database' ya existe. No se sobreescribe sin -Force."
}

$action = if ($databaseExists) {
    "RECREAR (DROP + CREATE) la base '$Database' y restaurar el dump"
}
else {
    "CREAR la base '$Database' y restaurar el dump"
}
Confirm-RestoreAction -Action $action

# ---------------------------------------------------------------------------
# Crear/recrear base
# ---------------------------------------------------------------------------
$quotedDb = '"' + $Database.Replace('"', '""') + '"'
$quotedOwner = ''
if ($Owner) { $quotedOwner = ' OWNER ' + '"' + $Owner.Replace('"', '""') + '"' }

if ($databaseExists) {
    Write-Warn "Recreando '$Database' (los datos actuales se perderan)."
    if ($UseHostTools) {
        Invoke-HostPsql -Sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$($Database.Replace("'", "''"))' AND pid <> pg_backend_pid();" -TargetDatabase 'postgres' -HostName $hostName -Port $port | Out-Null
        $drop = Invoke-HostPsql -Sql "DROP DATABASE IF EXISTS $quotedDb;" -TargetDatabase 'postgres' -HostName $hostName -Port $port
    }
    else {
        Invoke-PsqlDb -Sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$($Database.Replace("'", "''"))' AND pid <> pg_backend_pid();" -TargetDatabase 'postgres' | Out-Null
        $drop = Invoke-PsqlDb -Sql "DROP DATABASE IF EXISTS $quotedDb;" -TargetDatabase 'postgres'
    }
    if ($drop.ExitCode -ne 0) {
        throw "No se pudo eliminar la base '$Database': $($drop.Output)"
    }
}

$createSql = "CREATE DATABASE $quotedDb$quotedOwner ENCODING 'UTF8';"
if ($UseHostTools) {
    $create = Invoke-HostPsql -Sql $createSql -TargetDatabase 'postgres' -HostName $hostName -Port $port
}
else {
    $create = Invoke-PsqlDb -Sql $createSql -TargetDatabase 'postgres'
}
if ($create.ExitCode -ne 0) {
    throw "No se pudo crear la base '$Database': $($create.Output)"
}
Write-Ok "Base '$Database' lista."

# ---------------------------------------------------------------------------
# Restaurar
# ---------------------------------------------------------------------------
$restoreSucceeded = $false
try {
    if ($UseHostTools) {
        $restoreArgs = @(
            '-h', $hostName, '-p', $port, '-U', $DbUser, '-d', $Database,
            '--exit-on-error', '--no-owner'
        )
        if ($NoPrivileges) { $restoreArgs += '--no-acl' }
        $restoreArgs += $dumpFile
        Write-Info 'Ejecutando pg_restore...'
        & pg_restore @restoreArgs
        if ($LASTEXITCODE -ne 0) {
            throw "pg_restore fallo con codigo $LASTEXITCODE."
        }
    }
    else {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $remote = "/tmp/unisaas_restore_$stamp.dump"
        try {
            $copy = Invoke-Docker -Arguments @('cp', $dumpFile, ("{0}:{1}" -f $DbContainer, $remote))
            if ($copy.ExitCode -ne 0) {
                throw 'docker cp fallo al enviar el dump al contenedor.'
            }
            $restoreArgs = @(
                'exec', $DbContainer, 'pg_restore',
                '-U', $DbUser, '-d', $Database,
                '--exit-on-error', '--no-owner'
            )
            if ($NoPrivileges) { $restoreArgs += '--no-acl' }
            $restoreArgs += $remote
            Write-Info 'Ejecutando pg_restore...'
            $restore = Invoke-Docker -Arguments $restoreArgs
            if ($restore.ExitCode -ne 0) {
                throw "pg_restore fallo dentro de '$DbContainer' (codigo $($restore.ExitCode))."
            }
        }
        finally {
            Invoke-Docker -Arguments @('exec', $DbContainer, 'rm', '-f', $remote) | Out-Null
        }
    }
    $restoreSucceeded = $true
}
catch {
    Write-Fail $_.Exception.Message
    Write-Warn "La base '$Database' puede haber quedado incompleta. Restaure el backup previo si el dump no es confiable."
    exit 1
}

if (-not $restoreSucceeded) {
    throw 'El restore no finalizo correctamente.'
}

# ---------------------------------------------------------------------------
# Verificacion de tablas y conteos
# ---------------------------------------------------------------------------
Write-Section 'Verificacion posterior al restore'
$tables = @()
$targetCounts = [ordered]@{}
if ($UseHostTools) {
    $listRaw = & psql -h $hostName -p $port -U $DbUser -d $Database -t -A -v ON_ERROR_STOP=1 -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudieron listar las tablas restauradas.'
    }
    $tables = @($listRaw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne '' })
    $targetCounts = Get-HostTableCounts -TargetDatabase $Database -Tables $tables -HostName $hostName -Port $port
}
else {
    $tables = Get-PublicTableList -TargetDatabase $Database
    $targetCounts = Get-TableCounts -TargetDatabase $Database -Tables $tables
}

if ($tables.Count -eq 0) {
    throw "El restore no creo tablas en el esquema public de '$Database'."
}
Write-Ok ("Tablas en public: {0}" -f $tables.Count)

$missing = New-Object System.Collections.Generic.List[string]
$mismatched = New-Object System.Collections.Generic.List[string]
if ($expectedTables.Count -gt 0) {
    foreach ($table in $expectedTables) {
        if (-not ($tables -contains $table)) {
            $missing.Add($table) | Out-Null
            continue
        }
        $expectedValue = [int64]$manifest.tables.PSObject.Properties[$table].Value
        $actualValue = [int64]$targetCounts[$table]
        if ($expectedValue -ne $actualValue) {
            $mismatched.Add(("{0}: esperado {1}, restaurado {2}" -f $table, $expectedValue, $actualValue)) | Out-Null
        }
    }
}

if ($missing.Count -gt 0) {
    Write-Fail ("Tablas faltantes ({0}): {1}" -f $missing.Count, ($missing -join ', '))
}
if ($mismatched.Count -gt 0) {
    Write-Warn ("Tablas con conteo distinto ({0}):" -f $mismatched.Count)
    foreach ($item in $mismatched) { Write-Warn "  $item" }
}

if (($missing.Count -gt 0 -or $mismatched.Count -gt 0) -and -not $AllowCountMismatch) {
    throw 'La verificacion encontro diferencias. Use -AllowCountMismatch solo si el dump se tomo con escrituras concurrentes y lo verifico manualmente.'
}

if ($expectedTables.Count -eq 0) {
    if (-not ($tables -contains 'tenants')) {
        Write-Warn "No se encontro la tabla 'tenants'; confirme que el dump corresponde a UniSaaS."
    }
    else {
        $tenants = [int64]$targetCounts['tenants']
        if ($tenants -le 0) {
            Write-Warn 'La tabla tenants quedo vacia. Verifique que el dump incluyera datos.'
        }
        else {
            Write-Ok ("tenants: {0} filas" -f $tenants)
        }
    }
}
else {
    Write-Ok 'Tablas y conteos coinciden con el manifiesto.'
}

$totalRows = [int64]0
foreach ($key in $targetCounts.Keys) { $totalRows += [int64]$targetCounts[$key] }
Write-Ok ("Restore completado: {0} tablas, {1} filas contadas." -f $tables.Count, $totalRows)
Write-Info 'Siguiente paso: validar /health, login y una operacion de lectura antes de abrir trafico.'
exit 0
