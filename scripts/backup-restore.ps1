#Requires -Version 5.1
<#
.SYNOPSIS
  Backup, restore y simulacro de recuperacion (DR) REALES sobre PostgreSQL.

.DESCRIPTION
  Este script reemplaza el simulacro anterior que concatenaba DDL y validaba el
  texto con expresiones regulares. Ahora todas las acciones usan las
  herramientas oficiales de PostgreSQL:

    backup  -> pg_dump (formato custom por defecto, plain con -PlainFormat).
               Verifica que el archivo exista, no este vacio y que
               `pg_restore --list` pueda leerlo (solo formato custom).
    restore -> pg_restore (custom) o psql -f (plain) contra una base destino
               EXPLICITA, y verifica las tablas restauradas con psql -c.
    drill   -> backup real + restore real en una base temporal
               `<DatabaseName>_drill_<timestamp>`, mide tiempos reales y escribe
               un reporte JSON solo con datos medidos. Si PostgreSQL o las
               herramientas no estan disponibles, falla con error claro y NO
               genera un PASSED.

.NOTES
  - Requiere pg_dump, pg_restore y psql en PATH (cliente PostgreSQL).
  - Credenciales: use $env:PGPASSWORD o -DbPassword. Nunca se escriben a disco.
  - La base destino de `restore` debe existir y pasarse con -TargetDatabase.
  - `drill` crea y elimina su propia base temporal (salvo -KeepDrillDatabase).
  - No se sobrescribe backups/dr-drill-report.json (reporte historico).
    Los nuevos reportes se escriben como dr-drill-report_<timestamp>.json.

.EXAMPLE
  $env:PGPASSWORD = '<password>'
  .\scripts\backup-restore.ps1 -Action backup -DatabaseName saas_contable_db

.EXAMPLE
  .\scripts\backup-restore.ps1 -Action restore -BackupFile backups\unisaas_backup_20261021_120000.dump -TargetDatabase unisaas_restore_test

.EXAMPLE
  .\scripts\backup-restore.ps1 -Action drill -DatabaseName saas_contable_db -RtoTargetSeconds 600
#>

[CmdletBinding()]
param(
    [ValidateSet('backup', 'restore', 'drill')]
    [string]$Action = 'drill',

    [string]$DatabaseName = 'unisaas_db',
    [string]$HostName = 'localhost',
    [int]$Port = 5432,
    [string]$DbUser = 'saas_admin',
    [string]$DbPassword = '',

    [string]$BackupDir = 'backups',
    [string]$BackupFile = '',

    [string]$TargetDatabase = '',

    [switch]$PlainFormat,
    [switch]$KeepDrillDatabase,

    [int]$RtoTargetSeconds = 600,

    # Tablas minimas que deben existir tras un restore. Si se omite, se exige
    # al menos una tabla y (en drill con dump custom) que no falte ninguna de
    # las tablas presentes en el dump.
    [string[]]$RequiredTables = @()
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

function Stop-WithError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Assert-Tool {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        Stop-WithError "No se encontro '$Name' en PATH. Instale el cliente de PostgreSQL (pg_dump, pg_restore, psql) y vuelva a intentar. No se genero ningun reporte PASSED."
    }
}

function Assert-SafeIdentifier {
    param([string]$Value, [string]$Name)
    if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        Stop-WithError "'$Name' contiene caracteres no permitidos: '$Value'. Use solo letras, numeros y guion bajo."
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [Parameter(Mandatory = $true)][string]$Description,
        [switch]$Stream
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Stream) {
            & $FilePath @ArgumentList
            $exitCode = $LASTEXITCODE
            $text = ''
        }
        else {
            $output = & $FilePath @ArgumentList 2>&1
            $exitCode = $LASTEXITCODE
            $text = (($output | ForEach-Object { "$_" }) -join "`n").Trim()
        }
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($exitCode -ne 0) {
        $detail = if ($text) { "`n$text" } else { '' }
        throw "$Description fallo (exit code $exitCode).$detail"
    }

    return $text
}

function Get-PublicTables {
    param([string]$Database)

    $query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    $text = Invoke-Native -FilePath $script:PsqlPath `
        -ArgumentList ($script:ConnectionArgs + @('--dbname', $Database, '--tuples-only', '--no-align', '--command', $query)) `
        -Description "Consulta de tablas en '$Database'"

    return @($text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

function Test-DatabaseExists {
    param([string]$Database)

    $query = "SELECT 1 FROM pg_database WHERE datname = '$Database';"
    $text = Invoke-Native -FilePath $script:PsqlPath `
        -ArgumentList ($script:ConnectionArgs + @('--dbname', 'postgres', '--tuples-only', '--no-align', '--command', $query)) `
        -Description "Verificacion de existencia de la base '$Database'"

    return ($text.Trim() -eq '1')
}

function New-TemporaryDatabase {
    param([string]$Database)

    $query = "CREATE DATABASE `"$Database`" ENCODING 'UTF8' TEMPLATE template0;"
    $null = Invoke-Native -FilePath $script:PsqlPath `
        -ArgumentList ($script:ConnectionArgs + @('--dbname', 'postgres', '--set=ON_ERROR_STOP=1', '--command', $query)) `
        -Description "Creacion de la base temporal '$Database'"
}

function Remove-TemporaryDatabase {
    param([string]$Database)

    $query = "DROP DATABASE IF EXISTS `"$Database`" WITH (FORCE);"
    $null = Invoke-Native -FilePath $script:PsqlPath `
        -ArgumentList ($script:ConnectionArgs + @('--dbname', 'postgres', '--set=ON_ERROR_STOP=1', '--command', $query)) `
        -Description "Eliminacion de la base temporal '$Database'"
}

function New-DatabaseBackup {
    param(
        [string]$Database,
        [string]$FilePath
    )

    $format = if ($PlainFormat) { 'plain' } else { 'custom' }
    $dumpArgs = $script:ConnectionArgs + @(
        '--dbname', $Database,
        '--format', $format,
        '--file', $FilePath
    )

    $null = Invoke-Native -FilePath $script:PgDumpPath -ArgumentList $dumpArgs `
        -Description "pg_dump ($format) de '$Database'"

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "pg_dump termino sin error pero no genero el archivo '$FilePath'."
    }

    $size = (Get-Item -LiteralPath $FilePath).Length
    if ($size -le 0) {
        throw "pg_dump genero un archivo vacio ('$FilePath'). El backup NO es valido."
    }

    if (-not $PlainFormat) {
        $null = Invoke-Native -FilePath $script:PgRestorePath -ArgumentList @('--list', $FilePath) `
            -Description "Validacion del dump con pg_restore --list"
    }

    return $size
}

function Restore-DatabaseBackup {
    param(
        [string]$FilePath,
        [string]$Database
    )

    $extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()

    switch ($extension) {
        '.dump' {
            $restoreArgs = $script:ConnectionArgs + @(
                '--dbname', $Database,
                '--no-owner',
                '--no-privileges',
                '--exit-on-error',
                $FilePath
            )
            $null = Invoke-Native -FilePath $script:PgRestorePath -ArgumentList $restoreArgs `
                -Description "pg_restore hacia '$Database'" -Stream
        }
        '.sql' {
            $restoreArgs = $script:ConnectionArgs + @(
                '--dbname', $Database,
                '--set=ON_ERROR_STOP=1',
                '--file', $FilePath
            )
            $null = Invoke-Native -FilePath $script:PsqlPath -ArgumentList $restoreArgs `
                -Description "psql -f hacia '$Database'" -Stream
        }
        default {
            throw "Extension no soportada: '$extension'. Use .dump (formato custom) o .sql (formato plain)."
        }
    }
}

function Get-DumpTables {
    param([string]$FilePath)

    $text = Invoke-Native -FilePath $script:PgRestorePath -ArgumentList @('--list', $FilePath) `
        -Description "Lectura del indice del dump '$FilePath'"

    $tables = @()
    foreach ($line in ($text -split "`r?`n")) {
        if ($line -match '\sTABLE\s+public\s+(\S+)(\s|$)') {
            $tables += $Matches[1]
        }
    }

    return @($tables | Sort-Object -Unique)
}

function Write-DrillReport {
    param(
        [System.Collections.IDictionary]$Report,
        [string]$ReportPath
    )

    $json = $Report | ConvertTo-Json -Depth 8
    # UTF-8 sin BOM para que sea JSON valido en cualquier parser.
    $utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($ReportPath, $json, $utf8NoBom)
    Write-Host "Reporte de drill: $ReportPath" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# Preparacion comun
# ---------------------------------------------------------------------------

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$projectRoot = Split-Path -Parent $scriptRoot

if ([System.IO.Path]::IsPathRooted($BackupDir)) {
    $backupRoot = [System.IO.Path]::GetFullPath($BackupDir)
}
else {
    $backupRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $BackupDir))
}

if (-not (Test-Path -LiteralPath $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

$script:Timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$script:ConnectionArgs = @(
    '--host', $HostName,
    '--port', "$Port",
    '--username', $DbUser,
    '--no-password'
)

Assert-SafeIdentifier -Value $DatabaseName -Name 'DatabaseName'

$previousPgPassword = $env:PGPASSWORD
if ($DbPassword) {
    $env:PGPASSWORD = $DbPassword
}
$setConnectTimeout = $false
if (-not $env:PGCONNECT_TIMEOUT) {
    $env:PGCONNECT_TIMEOUT = '10'
    $setConnectTimeout = $true
}

if (-not $DbPassword -and -not $env:PGPASSWORD) {
    Write-Host "[AVISO] Sin -DbPassword ni PGPASSWORD. Se usara .pgpass si existe; de lo contrario la conexion fallara." -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SQUAD 8 - BACKUP / RESTORE / DR DRILL (PostgreSQL real)" -ForegroundColor Yellow
Write-Host "  Accion:        $Action"
Write-Host "  Host/Puerto:   $HostName : $Port"
Write-Host "  BD origen:     $DatabaseName"
Write-Host "  Usuario:       $DbUser"
Write-Host "  Backups:       $backupRoot"
Write-Host "  RTO objetivo:  $RtoTargetSeconds segundos"
Write-Host "==========================================================" -ForegroundColor Cyan

try {
    switch ($Action) {
        'backup' {
            Assert-Tool -Name 'pg_dump'
            if (-not $PlainFormat) { Assert-Tool -Name 'pg_restore' }
            $script:PgDumpPath = (Get-Command 'pg_dump').Source
            $script:PgRestorePath = (Get-Command 'pg_restore' -ErrorAction SilentlyContinue).Source

            $extension = if ($PlainFormat) { 'sql' } else { 'dump' }
            if ($BackupFile) {
                $filePath = if ([System.IO.Path]::IsPathRooted($BackupFile)) { $BackupFile } else { Join-Path $projectRoot $BackupFile }
            }
            else {
                $filePath = Join-Path $backupRoot "unisaas_backup_$($script:Timestamp).$extension"
            }

            if (Test-Path -LiteralPath $filePath) {
                Stop-WithError "El archivo '$filePath' ya existe. Elija otro -BackupFile o espere al siguiente timestamp."
            }

            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $size = New-DatabaseBackup -Database $DatabaseName -FilePath $filePath
            $stopwatch.Stop()

            $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()

            Write-Host ""
            Write-Host "[OK] Backup real completado." -ForegroundColor Green
            Write-Host "  Archivo:        $filePath"
            Write-Host "  Formato:        $(if ($PlainFormat) { 'plain' } else { 'custom' })"
            Write-Host "  Tamano:         $size bytes"
            Write-Host "  SHA-256:        $hash"
            Write-Host "  Duracion:       $([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2)) s"
            exit 0
        }

        'restore' {
            Assert-Tool -Name 'psql'
            if (-not $TargetDatabase) {
                Stop-WithError "-Action restore requiere -TargetDatabase explicita. No se restaura sobre una base por defecto."
            }
            Assert-SafeIdentifier -Value $TargetDatabase -Name 'TargetDatabase'

            $script:PsqlPath = (Get-Command 'psql').Source

            if ($BackupFile) {
                $filePath = if ([System.IO.Path]::IsPathRooted($BackupFile)) { $BackupFile } else { Join-Path $projectRoot $BackupFile }
            }
            else {
                $candidates = @(Get-ChildItem -LiteralPath $backupRoot -File |
                    Where-Object { $_.Extension -in @('.dump', '.sql') } |
                    Sort-Object LastWriteTime -Descending)
                if ($candidates.Count -eq 0) {
                    Stop-WithError "No hay archivos .dump/.sql en '$backupRoot'. Indique -BackupFile."
                }
                $filePath = $candidates[0].FullName
                Write-Host "[INFO] Usando el backup mas reciente: $filePath" -ForegroundColor Yellow
            }

            if (-not (Test-Path -LiteralPath $filePath)) {
                Stop-WithError "No existe el archivo de backup '$filePath'."
            }
            if ((Get-Item -LiteralPath $filePath).Length -le 0) {
                Stop-WithError "El archivo de backup '$filePath' esta vacio."
            }

            if ([System.IO.Path]::GetExtension($filePath).ToLowerInvariant() -eq '.dump') {
                Assert-Tool -Name 'pg_restore'
                $script:PgRestorePath = (Get-Command 'pg_restore').Source
            }

            if (-not (Test-DatabaseExists -Database $TargetDatabase)) {
                Stop-WithError "La base destino '$TargetDatabase' no existe. Creela primero (por ejemplo: createdb -h $HostName -p $Port -U $DbUser $TargetDatabase)."
            }

            Write-Host ""
            Write-Host "[FASE 1] Restaurando '$filePath' en '$TargetDatabase'..." -ForegroundColor DarkYellow
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            Restore-DatabaseBackup -FilePath $filePath -Database $TargetDatabase
            $stopwatch.Stop()

            $tables = @(Get-PublicTables -Database $TargetDatabase)
            if ($tables.Count -lt 1) {
                throw "El restore termino pero '$TargetDatabase' no tiene tablas en el esquema public. Restore NO verificado."
            }

            $missingRequired = @($RequiredTables | Where-Object { $_ -notin $tables })
            if ($missingRequired.Count -gt 0) {
                throw "Faltan tablas obligatorias tras el restore en '$TargetDatabase': $($missingRequired -join ', ')."
            }

            if ([System.IO.Path]::GetExtension($filePath).ToLowerInvariant() -eq '.dump') {
                $dumpTables = @(Get-DumpTables -FilePath $filePath)
                $missingFromDump = @($dumpTables | Where-Object { $_ -notin $tables })
                if ($missingFromDump.Count -gt 0) {
                    throw "Tablas presentes en el dump y ausentes en '$TargetDatabase': $($missingFromDump -join ', ')."
                }
            }

            Write-Host ""
            Write-Host "[OK] Restore real verificado." -ForegroundColor Green
            Write-Host "  BD destino:     $TargetDatabase"
            Write-Host "  Tablas:         $($tables.Count)"
            Write-Host "  Duracion:       $([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2)) s"
            Write-Host "  Tablas:         $($tables -join ', ')"
            exit 0
        }

        'drill' {
            Assert-Tool -Name 'pg_dump'
            Assert-Tool -Name 'pg_restore'
            Assert-Tool -Name 'psql'
            $script:PgDumpPath = (Get-Command 'pg_dump').Source
            $script:PgRestorePath = (Get-Command 'pg_restore').Source
            $script:PsqlPath = (Get-Command 'psql').Source

            $drillDatabase = "$($DatabaseName)_drill_$($script:Timestamp)"
            if ($drillDatabase.Length -gt 63) {
                $drillDatabase = $drillDatabase.Substring(0, 63)
            }
            Assert-SafeIdentifier -Value $drillDatabase -Name 'DrillDatabase'

            $backupExtension = if ($PlainFormat) { 'sql' } else { 'dump' }
            $backupPath = Join-Path $backupRoot "unisaas_drill_$($script:Timestamp).$backupExtension"
            $reportPath = Join-Path $backupRoot "dr-drill-report_$($script:Timestamp).json"

            $report = [ordered]@{
                timestamp           = (Get-Date).ToString('o')
                drillStatus         = 'FAILED'
                mode                = 'real-pg_dump-pg_restore'
                environment         = [ordered]@{
                    host            = $HostName
                    port            = $Port
                    sourceDatabase  = $DatabaseName
                    drillDatabase   = $drillDatabase
                    dbUser          = $DbUser
                }
                tools               = [ordered]@{
                    pg_dump         = (Invoke-Native -FilePath $script:PgDumpPath -ArgumentList @('--version') -Description 'pg_dump --version')
                    pg_restore      = (Invoke-Native -FilePath $script:PgRestorePath -ArgumentList @('--version') -Description 'pg_restore --version')
                    psql            = (Invoke-Native -FilePath $script:PsqlPath -ArgumentList @('--version') -Description 'psql --version')
                }
                sla                 = [ordered]@{
                    rtoTargetSeconds    = $RtoTargetSeconds
                    rtoAchievedSeconds  = $null
                    rtoMet              = $false
                }
                backup              = [ordered]@{
                    file                = (Split-Path -Leaf $backupPath)
                    format              = $backupExtension
                    sizeBytes           = $null
                    sha256              = $null
                    durationSeconds     = $null
                }
                restore             = [ordered]@{
                    targetDatabase      = $drillDatabase
                    durationSeconds     = $null
                    tablesCount         = $null
                    tables              = @()
                    missingTables       = @()
                    verified            = $false
                }
                error               = $null
            }

            $drillDatabaseCreated = $false
            $drillPassed = $false
            $totalStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

            try {
                if (Test-DatabaseExists -Database $drillDatabase) {
                    throw "La base temporal '$drillDatabase' ya existe. Reintente en otro segundo o eliminela manualmente."
                }

                New-TemporaryDatabase -Database $drillDatabase
                $drillDatabaseCreated = $true

                Write-Host ""
                Write-Host "[FASE 1] pg_dump real de '$DatabaseName'..." -ForegroundColor DarkYellow
                $backupStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                $size = New-DatabaseBackup -Database $DatabaseName -FilePath $backupPath
                $backupStopwatch.Stop()

                $report.backup.sizeBytes = $size
                $report.backup.sha256 = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
                $report.backup.durationSeconds = [Math]::Round($backupStopwatch.Elapsed.TotalSeconds, 2)
                Write-Host "  OK: $size bytes en $($report.backup.durationSeconds) s" -ForegroundColor Green

                Write-Host ""
                Write-Host "[FASE 2] pg_restore/psql real en '$drillDatabase'..." -ForegroundColor DarkYellow
                $restoreStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                Restore-DatabaseBackup -FilePath $backupPath -Database $drillDatabase
                $restoreStopwatch.Stop()
                $report.restore.durationSeconds = [Math]::Round($restoreStopwatch.Elapsed.TotalSeconds, 2)

                Write-Host ""
                Write-Host "[FASE 3] Verificacion de tablas con psql..." -ForegroundColor DarkYellow
                $tables = @(Get-PublicTables -Database $drillDatabase)
                $report.restore.tables = $tables
                $report.restore.tablesCount = $tables.Count

                if ($tables.Count -lt 1) {
                    throw "La base restaurada '$drillDatabase' no tiene tablas en public."
                }

                $missingRequired = @($RequiredTables | Where-Object { $_ -notin $tables })
                if ($missingRequired.Count -gt 0) {
                    $report.restore.missingTables = $missingRequired
                    throw "Faltan tablas obligatorias: $($missingRequired -join ', ')."
                }

                if ($backupExtension -eq 'dump') {
                    $dumpTables = @(Get-DumpTables -FilePath $backupPath)
                    $missingFromDump = @($dumpTables | Where-Object { $_ -notin $tables })
                    $report.restore.missingTables = $missingFromDump
                    if ($missingFromDump.Count -gt 0) {
                        throw "Tablas del dump ausentes tras el restore: $($missingFromDump -join ', ')."
                    }
                }

                $report.restore.verified = $true
                $totalStopwatch.Stop()

                $rtoAchieved = [Math]::Round($totalStopwatch.Elapsed.TotalSeconds, 2)
                $report.sla.rtoAchievedSeconds = $rtoAchieved
                $report.sla.rtoMet = ($rtoAchieved -lt $RtoTargetSeconds)
                $report.drillStatus = 'PASSED'
                $report.error = $null
                $drillPassed = $true

                Write-Host ""
                Write-Host "[OK] DRILL REAL COMPLETADO." -ForegroundColor Green
                Write-Host "  RTO medido:   $rtoAchieved s (objetivo < $RtoTargetSeconds s)"
                Write-Host "  Tablas:       $($tables.Count)"
                Write-Host "  Backup:       $backupPath"
                Write-Host ""
            }
            catch {
                if ($totalStopwatch.IsRunning) { $totalStopwatch.Stop() }
                $report.drillStatus = 'FAILED'
                $report.error = $_.Exception.Message
                $report.sla.rtoAchievedSeconds = [Math]::Round($totalStopwatch.Elapsed.TotalSeconds, 2)
                $report.sla.rtoMet = $false

                Write-Host ""
                Write-Host "[FALLO] El drill NO se completo. No se reporta PASSED." -ForegroundColor Red
                Write-Host "  Motivo: $($_.Exception.Message)" -ForegroundColor Red
                if ($drillDatabaseCreated) {
                    Write-Host "  La base temporal '$drillDatabase' se conserva para diagnostico." -ForegroundColor Yellow
                }
            }
            finally {
                if ($drillDatabaseCreated -and $drillPassed -and -not $KeepDrillDatabase) {
                    try {
                        Remove-TemporaryDatabase -Database $drillDatabase
                    }
                    catch {
                        Write-Host "[AVISO] No se pudo eliminar la base temporal '$drillDatabase': $($_.Exception.Message)" -ForegroundColor Yellow
                    }
                }
            }

            Write-DrillReport -Report $report -ReportPath $reportPath

            if ($drillPassed) { exit 0 }
            exit 1
        }
    }
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($DbPassword) {
        if ($null -eq $previousPgPassword) {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
        else {
            $env:PGPASSWORD = $previousPgPassword
        }
    }
    if ($setConnectTimeout) {
        Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    }
}
