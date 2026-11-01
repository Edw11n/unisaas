# ============================================================================
# UniSaaS - exportacion de base de datos (pg_dump formato custom)
# ============================================================================
# QUE HACE
#   - Genera un dump custom (pg_restore compatible) en backups/<timestamp>/.
#   - Escribe un sidecar .sha256 y un .manifest.json con conteos por tabla.
#   - No imprime secretos: usa la autenticacion local del contenedor o
#     PGPASSWORD tomado del entorno (nunca por parametro de linea de comandos).
#
# USO
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1 -Tag pre-migracion
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-db.ps1 -UseHostTools
#
# MODO HOST (-UseHostTools)
#   Requiere pg_dump/psql en el PATH y PGPASSWORD definido en el entorno.
#   Host/puerto se toman de -PgHost/-PgPort (o PGHOST/PGPORT si se omiten).
#
# SALIDA
#   backups/<timestamp>/<database>_<timestamp>[_tag].dump
#   backups/<timestamp>/<database>_<timestamp>[_tag].dump.sha256
#   backups/<timestamp>/<database>_<timestamp>[_tag].dump.manifest.json
#
# Los .dump y sus manifiestos estan excluidos de Git (ver .gitignore).
# ============================================================================

[CmdletBinding()]
param(
    [string]$BackupRoot = 'backups',
    [string]$Database = 'saas_contable_db',
    [string]$DbContainer = 'postgres-saas',
    [string]$DbUser = 'saas_admin',
    [string]$Tag = '',
    [switch]$UseHostTools,
    [string]$PgHost = '',
    [int]$PgPort = 0,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Get-RepoRoot

function Resolve-RepoPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    return (Join-Path $root $Path)
}

function Assert-DatabaseName {
    param([Parameter(Mandatory = $true)][string]$Name)
    if ($Name -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}$') {
        throw "Nombre de base invalido: '$Name'. Use solo letras, numeros, guion, punto o guion bajo."
    }
}

function Invoke-PsqlDb {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$TargetDatabase
    )
    return Invoke-Psql -Sql $Sql -Database $TargetDatabase -User $DbUser -Container $DbContainer
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

    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) { return $null }
    if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) { return $null }

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

function New-ContainerDump {
    param(
        [Parameter(Mandatory = $true)][string]$DestinationFile
    )
    $state = Get-DockerContainerState -Name $DbContainer
    if (-not $state -or $state.Status -ne 'running') {
        throw "El contenedor '$DbContainer' no esta corriendo. Use -UseHostTools o inicie PostgreSQL."
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $remote = "/tmp/unisaas_export_$stamp.dump"
    try {
        $dump = Invoke-Docker -Arguments @(
            'exec', $DbContainer, 'pg_dump',
            '-U', $DbUser, '-d', $Database,
            '--format=custom', '--compress=6', '--file', $remote
        )
        if ($dump.ExitCode -ne 0) {
            throw "pg_dump fallo dentro de '$DbContainer' (revise permisos del rol '$DbUser')."
        }
        $copy = Invoke-Docker -Arguments @('cp', ("{0}:{1}" -f $DbContainer, $remote), $DestinationFile)
        if ($copy.ExitCode -ne 0) {
            throw 'docker cp fallo al extraer el dump.'
        }
    }
    finally {
        Invoke-Docker -Arguments @('exec', $DbContainer, 'rm', '-f', $remote) | Out-Null
    }
}

function New-HostDump {
    param(
        [Parameter(Mandatory = $true)][string]$DestinationFile,
        [string]$HostName = '127.0.0.1',
        [int]$Port = 5432
    )
    if (-not (Test-CommandAvailable -Name 'pg_dump')) {
        throw 'pg_dump no esta en PATH. Instale el cliente PostgreSQL o use el modo contenedor.'
    }
    if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
        throw 'PGPASSWORD no esta definido en el entorno; es obligatorio en -UseHostTools.'
    }
    & pg_dump -h $HostName -p $Port -U $DbUser -d $Database --format=custom --compress=6 --file $DestinationFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump del host fallo con codigo $LASTEXITCODE."
    }
}

# ---------------------------------------------------------------------------
# Validaciones y plan
# ---------------------------------------------------------------------------
Assert-DatabaseName -Name $Database
$backupRootPath = Resolve-RepoPath -Path $BackupRoot
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$targetDir = Join-Path $backupRootPath $stamp
$safeTag = ($Tag -replace '[^A-Za-z0-9_-]', '-').Trim('-')
$baseName = if ($safeTag) { "${Database}_${stamp}_$safeTag" } else { "${Database}_$stamp" }
$dumpFile = Join-Path $targetDir "$baseName.dump"
$hostName = if ($PgHost) { $PgHost } elseif ($env:PGHOST) { $env:PGHOST } else { '127.0.0.1' }
$port = if ($PgPort -gt 0) { $PgPort } elseif ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }

Write-Title 'Exportacion de base de datos'
Write-Info "Base: $Database"
Write-Info "Destino: $targetDir"
Write-Info ("Modo: " + $(if ($UseHostTools) { "host ($hostName`:$port)" } else { "contenedor ($DbContainer)" }))

if ($DryRun) {
    Write-Info 'DryRun: no se crea ningun archivo.'
    exit 0
}

if (Test-Path -LiteralPath $targetDir) {
    throw "El directorio '$targetDir' ya existe. Reintente en unos segundos."
}
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

try {
    if ($UseHostTools) {
        New-HostDump -DestinationFile $dumpFile -HostName $hostName -Port $port
    }
    else {
        New-ContainerDump -DestinationFile $dumpFile
    }

    $info = Get-Item -LiteralPath $dumpFile
    if (-not $info -or $info.Length -le 0) {
        throw "El dump generado esta vacio: $dumpFile"
    }

    # Conteos por tabla (mejor esfuerzo; el dump ya es valido sin ellos).
    $tables = @()
    $counts = [ordered]@{}
    if (-not $UseHostTools) {
        $tables = Get-PublicTableList -TargetDatabase $Database
        $counts = Get-TableCounts -TargetDatabase $Database -Tables $tables
    }
    else {
        $psql = Get-Command psql -ErrorAction SilentlyContinue
        if ($psql) {
            $listRaw = & psql -h $hostName -p $port -U $DbUser -d $Database -t -A -v ON_ERROR_STOP=1 -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $tables = @($listRaw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne '' })
                $hostCounts = Get-HostTableCounts -TargetDatabase $Database -Tables $tables -HostName $hostName -Port $port
                if ($hostCounts) { $counts = $hostCounts }
            }
        }
        if ($tables.Count -eq 0) {
            Write-Warn 'No se pudieron leer los conteos por tabla (psql/PGPASSWORD no disponibles).'
        }
    }

    $hash = Get-Sha256 -Path $dumpFile
    $sidecar = "$dumpFile.sha256"
    [System.IO.File]::WriteAllText(
        $sidecar,
        ("{0}  {1}`n" -f $hash, [System.IO.Path]::GetFileName($dumpFile)),
        (New-Object System.Text.UTF8Encoding($false))
    )

    $git = Get-GitInfo -Root $root
    $sourceMode = if ($UseHostTools) { "host:$hostName`:$port" } else { "docker:$DbContainer" }
    $manifest = [ordered]@{
        formatVersion = 1
        createdAt     = (Get-Date).ToString('o')
        database      = $Database
        dumpFile      = [System.IO.Path]::GetFileName($dumpFile)
        bytes         = $info.Length
        sha256        = $hash
        source        = $sourceMode
        gitSha        = $git.Sha
        gitBranch     = $git.Branch
        tables        = $counts
    }
    $manifestPath = "$dumpFile.manifest.json"
    $json = $manifest | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText(
        $manifestPath,
        $json + "`n",
        (New-Object System.Text.UTF8Encoding($false))
    )

    $totalRows = [int64]0
    foreach ($key in $counts.Keys) { $totalRows += [int64]$counts[$key] }

    Write-Ok 'Dump generado.'
    Write-Info ("Archivo: {0} ({1})" -f $info.FullName, (Get-HumanSize -Bytes $info.Length))
    Write-Info "SHA256: $hash"
    Write-Info ("Tablas: {0}; filas contadas: {1}" -f $counts.Count, $totalRows)
    Write-Info "Manifiesto: $manifestPath"
    Write-Info 'Siguiente paso: scripts/import-db.ps1 -DumpPath "<archivo>" en el destino.'
    exit 0
}
catch {
    Write-Fail $_.Exception.Message
    exit 1
}
