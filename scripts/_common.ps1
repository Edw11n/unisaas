# ============================================================================
# UniSaaS - Helpers compartidos de operacion (Windows PowerShell 5.1+ / pwsh 7+)
# ============================================================================
# Este archivo se carga con dot-sourcing desde:
#   scripts/healthcheck.ps1
#   scripts/deploy.ps1
#   scripts/reset-zero.ps1
#   scripts/export-db.ps1
#   scripts/import-db.ps1
#   scripts/set-domain.ps1
#
# Convenciones:
#   - Solo ASCII para que Windows PowerShell 5.1 no interprete mal el archivo
#     (PS 5.1 asume ANSI cuando el .ps1 no tiene BOM).
#   - Ninguna funcion imprime secretos. Los valores de .env se leen en memoria
#     y solo se reporta presencia/ausencia o validaciones booleanas.
#   - PostgreSQL se opera por defecto dentro del contenedor `postgres-saas`
#     (no se exige cliente psql en el host).
# ============================================================================

$script:UniSaasRepoRoot = Split-Path -Parent $PSScriptRoot
$script:UniSaasDefaults = @{
    DbContainer = 'postgres-saas'
    RedisContainer = 'redis-saas'
    Database = 'saas_contable_db'
    DbUser = 'saas_admin'
}

function Get-RepoRoot {
    return $script:UniSaasRepoRoot
}

function Get-DefaultDbContainer { return $script:UniSaasDefaults.DbContainer }
function Get-DefaultRedisContainer { return $script:UniSaasDefaults.RedisContainer }
function Get-DefaultDbUser { return $script:UniSaasDefaults.DbUser }
function Get-DefaultDatabase { return $script:UniSaasDefaults.Database }

# ---------------------------------------------------------------------------
# Salida por consola
# ---------------------------------------------------------------------------
function Write-Title {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host ''
    Write-Host ('=' * 74) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 74) -ForegroundColor Cyan
}

function Write-Section {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host ''
    Write-Host "-- $Text" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "  [OK]   $Text" -ForegroundColor Green
}

function Write-Info {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "  [INFO] $Text" -ForegroundColor Gray
}

function Write-Warn {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "  [WARN] $Text" -ForegroundColor Yellow
}

function Write-Fail {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "  [FAIL] $Text" -ForegroundColor Red
}

function Write-Blocker {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "  [BLOCKER] $Text" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# Utilidades de entorno
# ---------------------------------------------------------------------------
function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    return ($null -ne (Get-Command $Name -ErrorAction SilentlyContinue))
}

function Test-DockerAvailable {
    if (-not (Test-CommandAvailable -Name 'docker')) { return $false }
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-DockerContainerState {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Test-DockerAvailable)) { return $null }
    $raw = & docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $Name 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) { return $null }
    $parts = ($raw -join '|').Trim().Split('|')
    $health = 'none'
    if ($parts.Length -gt 1) { $health = $parts[1] }
    return [pscustomobject]@{
        Name   = $Name
        Status = $parts[0]
        Health = $health
    }
}

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & docker @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = (($output | ForEach-Object { "$_" }) -join "`n").Trim()
    return [pscustomobject]@{ ExitCode = $code; Output = $text }
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [string]$Database = $script:UniSaasDefaults.Database,
        [string]$User = $script:UniSaasDefaults.DbUser,
        [string]$Container = $script:UniSaasDefaults.DbContainer
    )
    return Invoke-Docker -Arguments @(
        'exec', $Container, 'psql',
        '-U', $User, '-d', $Database,
        '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', $Sql
    )
}

function Get-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $map }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0) { continue }
        if ($trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $map[$key] = $value
    }
    return $map
}

function Test-TcpPort {
    param(
        [string]$TargetHost = '127.0.0.1',
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 1500
    )
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        try { $client.Close() } catch { }
    }
}

function Get-HttpStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 5
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -Method GET
        return [int]$response.StatusCode
    } catch {
        $webResponse = $null
        try {
            if ($_.Exception -and $_.Exception.PSObject.Properties['Response']) {
                $webResponse = $_.Exception.Response
            }
        } catch { }
        if ($webResponse) {
            try { return [int]$webResponse.StatusCode } catch { return $null }
        }
        return $null
    }
}

function Get-FreeSpaceGB {
    param([Parameter(Mandatory = $true)][string]$Path)
    try {
        $root = [System.IO.Path]::GetPathRoot((Resolve-Path -LiteralPath $Path).Path)
        $drive = New-Object System.IO.DriveInfo($root)
        return [math]::Round($drive.AvailableFreeSpace / 1GB, 2)
    } catch {
        return $null
    }
}

function Get-GitInfo {
    param([string]$Root = $script:UniSaasRepoRoot)
    $sha = 'unknown'
    $branch = 'unknown'
    $dirty = $null
    if (Test-CommandAvailable -Name 'git') {
        $shaRaw = & git -C $Root rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $shaRaw) { $sha = ($shaRaw | Select-Object -First 1).Trim() }
        $branchRaw = & git -C $Root rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $branchRaw) { $branch = ($branchRaw | Select-Object -First 1).Trim() }
        $statusRaw = & git -C $Root status --porcelain 2>$null
        if ($LASTEXITCODE -eq 0) { $dirty = (($statusRaw | Measure-Object).Count -gt 0) }
    }
    return [pscustomobject]@{ Sha = $sha; Branch = $branch; Dirty = $dirty }
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

# ---------------------------------------------------------------------------
# Backup de PostgreSQL
# ---------------------------------------------------------------------------
# Estrategia:
#   1. Si hay docker disponible y el contenedor esta corriendo, se ejecuta
#      pg_dump DENTRO del contenedor (no requiere cliente psql en el host).
#   2. Si no hay docker, se usa pg_dump del host + PGPASSWORD.
# El resultado es un dump formato custom (pg_restore compatible) + checksum.
# ---------------------------------------------------------------------------
function New-DatabaseBackup {
    param(
        [Parameter(Mandatory = $true)][string]$DestinationRoot,
        [string]$Database = $script:UniSaasDefaults.Database,
        [string]$User = $script:UniSaasDefaults.DbUser,
        [string]$Container = $script:UniSaasDefaults.DbContainer
    )

    if (-not (Test-Path -LiteralPath $DestinationRoot)) {
        New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $targetDir = Join-Path $DestinationRoot $stamp
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    $file = Join-Path $targetDir ("{0}_{1}.dump" -f $Database, $stamp)

    if (Test-DockerAvailable) {
        $state = Get-DockerContainerState -Name $Container
        if (-not $state -or $state.Status -ne 'running') {
            throw "El contenedor '$Container' no esta corriendo; no se puede respaldar la base '$Database'."
        }
        $remote = "/tmp/unisaas_$stamp.dump"
        $dump = Invoke-Docker -Arguments @(
            'exec', $Container, 'pg_dump',
            '-U', $User, '-d', $Database,
            '--format=custom', '--compress=6', '--file', $remote
        )
        if ($dump.ExitCode -ne 0) {
            throw "pg_dump fallo dentro de '$Container': $($dump.Output)"
        }
        try {
            $copy = Invoke-Docker -Arguments @('cp', ("{0}:{1}" -f $Container, $remote), $file)
            if ($copy.ExitCode -ne 0) {
                throw "docker cp fallo al extraer el dump: $($copy.Output)"
            }
        } finally {
            Invoke-Docker -Arguments @('exec', $Container, 'rm', '-f', $remote) | Out-Null
        }
    }
    elseif (Test-CommandAvailable -Name 'pg_dump') {
        if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
            throw 'No hay docker disponible y PGPASSWORD no esta definido; no se puede respaldar con pg_dump del host.'
        }
        & pg_dump -h 127.0.0.1 -p 5432 -U $User -d $Database --format=custom --compress=6 --file $file 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump del host fallo con codigo $LASTEXITCODE."
        }
    }
    else {
        throw 'No hay docker ni pg_dump disponibles; no es posible respaldar la base de datos.'
    }

    $info = Get-Item -LiteralPath $file
    if ($info.Length -le 0) {
        throw "El backup generado esta vacio: $file"
    }

    return [pscustomobject]@{
        Path      = $info.FullName
        Directory = $targetDir
        Bytes     = $info.Length
        Sha256    = (Get-Sha256 -Path $info.FullName)
        Database  = $Database
        CreatedAt = (Get-Date).ToString('o')
    }
}

function Get-HumanSize {
    param([Parameter(Mandatory = $true)][long]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}
