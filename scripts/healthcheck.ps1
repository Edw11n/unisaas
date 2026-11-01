# ============================================================================
# UniSaaS - healthcheck de infraestructura y servicios
# ============================================================================
# Verifica, en este orden:
#   1. PostgreSQL (contenedor postgres-saas + pg_isready + SELECT 1 + rol runtime)
#   2. Redis (contenedor redis-saas + PING)
#   3. Puertos TCP de S1, S2, S3, S6, S7 y BFF S4
#   4. Endpoints HTTP: descubre /health, /api/health y usa un endpoint conocido
#      (/api/docs en las APIs Nest o / en el BFF) cuando no existe /health.
#
# Salida:
#   - Exit code 0: todo lo verificado responde.
#   - Exit code 1: al menos un chequeo critico fallo.
#   - -DryRun: imprime el plan de verificacion y termina con 0 (no falla por
#     servicios apagados). Util para CI o para revisar la matriz de endpoints.
#   - -Json: salida legible por maquinas (no imprime la tabla).
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -Json
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1 -SkipInfra
# ============================================================================

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Json,
    [switch]$SkipInfra,
    [int]$TimeoutSec = 5
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_common.ps1')

$services = @(
    @{
        Name       = 'S1 auth-core'
        Port       = 3001
        Candidates = @('/health', '/api/v1/health', '/api/health', '/api/docs')
        Known      = '/api/docs (Swagger)'
    },
    @{
        Name       = 'S2 accounting-ledger'
        Port       = 3002
        Candidates = @('/health', '/api/v1/health', '/api/health', '/api/docs')
        Known      = '/api/docs (Swagger)'
    },
    @{
        Name       = 'S3 inventory-kardex'
        Port       = 3003
        Candidates = @('/health', '/api/v1/health', '/api/health', '/api/docs')
        Known      = '/api/docs (Swagger, prefijo /api/v1 en las rutas de negocio)'
    },
    @{
        Name       = 'S6 reports-escpos'
        Port       = 3006
        Candidates = @('/health', '/api/v1/health', '/api/health', '/docs', '/api/docs')
        Known      = '/api/v1/health (prefijo global)'
    },
    @{
        Name       = 'S7 credits-purchases'
        Port       = 3007
        Candidates = @('/health', '/api/v1/health', '/api/health', '/api/docs')
        Known      = '/api/v1/health o /api/docs'
    },
    @{
        Name       = 'BFF S4 web-pos'
        Port       = 3100
        Candidates = @('/api/health', '/health', '/')
        Known      = '/api/health'
    }
)

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param(
        [string]$Name,
        [ValidateSet('OK', 'WARN', 'FAIL', 'SKIP')][string]$Status,
        [string]$Detail,
        [bool]$Critical = $true
    )
    $results.Add([pscustomobject]@{
            Check    = $Name
            Status   = $Status
            Detail   = $Detail
            Critical = $Critical
        }) | Out-Null
}

function Test-Postgres {
    $state = Get-DockerContainerState -Name (Get-DefaultDbContainer)
    if ($state) {
        if ($state.Status -ne 'running') {
            Add-Result 'PostgreSQL contenedor' 'FAIL' "postgres-saas status=$($state.Status)" $true
            return
        }
        Add-Result 'PostgreSQL contenedor' 'OK' "running / health=$($state.Health)" $true
    } else {
        Add-Result 'PostgreSQL contenedor' 'WARN' 'docker no disponible o contenedor ausente; se valida solo el puerto 5432' $false
        if (Test-TcpPort -Port 5432 -TimeoutMs 2000) {
            Add-Result 'PostgreSQL puerto' 'OK' '127.0.0.1:5432 acepta conexiones (sin validacion SQL)' $true
        } else {
            Add-Result 'PostgreSQL puerto' 'FAIL' '127.0.0.1:5432 no responde' $true
        }
        return
    }

    $ready = Invoke-Docker -Arguments @('exec', (Get-DefaultDbContainer), 'pg_isready', '-U', (Get-DefaultDbUser), '-d', $script:UniSaasDefaults.Database)
    if ($ready.ExitCode -eq 0) {
        Add-Result 'PostgreSQL pg_isready' 'OK' $ready.Output $true
    } else {
        Add-Result 'PostgreSQL pg_isready' 'FAIL' $ready.Output $true
        return
    }

    $select = Invoke-Psql -Sql 'SELECT 1;'
    if ($select.ExitCode -eq 0 -and $select.Output -match '1') {
        Add-Result 'PostgreSQL SELECT 1' 'OK' 'consulta ejecutada' $true
    } else {
        Add-Result 'PostgreSQL SELECT 1' 'FAIL' $select.Output $true
    }

    $runtime = Invoke-Psql -Sql "SELECT rolbypassrls || '|' || rolsuper FROM pg_roles WHERE rolname = 'app_runtime';"
    if ($runtime.ExitCode -eq 0 -and $runtime.Output -match '^(f|false)\|(f|false)$') {
        Add-Result 'Rol app_runtime' 'OK' 'existe, sin BYPASSRLS y sin SUPERUSER' $true
    } elseif ($runtime.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($runtime.Output)) {
        Add-Result 'Rol app_runtime' 'FAIL' "atributos inesperados: $($runtime.Output)" $true
    } else {
        Add-Result 'Rol app_runtime' 'FAIL' 'el rol app_runtime no existe o no se pudo consultar' $true
    }

    $ssl = Invoke-Psql -Sql 'SHOW ssl;'
    if ($ssl.ExitCode -eq 0) {
        Add-Result 'PostgreSQL TLS' 'OK' "ssl=$($ssl.Output) (S1/S2 usan DB_SSL; false con el Postgres local de Docker)" $false
    }
}

function Test-Redis {
    $state = Get-DockerContainerState -Name (Get-DefaultRedisContainer)
    if ($state) {
        if ($state.Status -ne 'running') {
            Add-Result 'Redis contenedor' 'FAIL' "redis-saas status=$($state.Status)" $true
            return
        }
        Add-Result 'Redis contenedor' 'OK' "running / health=$($state.Health)" $true
        $ping = Invoke-Docker -Arguments @('exec', (Get-DefaultRedisContainer), 'redis-cli', 'ping')
        if ($ping.ExitCode -eq 0 -and $ping.Output -match 'PONG') {
            Add-Result 'Redis PING' 'OK' 'PONG' $true
        } else {
            Add-Result 'Redis PING' 'FAIL' $ping.Output $true
        }
        return
    }

    Add-Result 'Redis contenedor' 'WARN' 'docker no disponible o contenedor ausente; se valida solo el puerto 6379' $false
    if (Test-TcpPort -Port 6379 -TimeoutMs 2000) {
        Add-Result 'Redis puerto' 'OK' '127.0.0.1:6379 acepta conexiones (sin PING)' $true
    } else {
        Add-Result 'Redis puerto' 'FAIL' '127.0.0.1:6379 no responde' $true
    }
}

function Test-Service {
    param([hashtable]$Service)

    $portOpen = Test-TcpPort -Port $Service.Port -TimeoutMs 2000
    if (-not $portOpen) {
        Add-Result "$($Service.Name) puerto $($Service.Port)" 'FAIL' 'puerto cerrado (proceso no escuchando)' $true
        return
    }
    Add-Result "$($Service.Name) puerto $($Service.Port)" 'OK' 'TCP acepta conexiones' $true

    $lastStatus = $null
    foreach ($candidate in $Service.Candidates) {
        $url = "http://127.0.0.1:$($Service.Port)$candidate"
        $status = Get-HttpStatus -Url $url -TimeoutSec $TimeoutSec
        if ($null -eq $status) { continue }
        $lastStatus = "$candidate -> $status"
        if ($status -ge 200 -and $status -lt 400) {
            Add-Result "$($Service.Name) HTTP" 'OK' "GET $candidate -> $status" $true
            return
        }
        if ($status -ge 500) {
            Add-Result "$($Service.Name) HTTP" 'FAIL' "GET $candidate -> $status (proceso vivo pero respondiendo error)" $true
            return
        }
    }

    if ($null -eq $lastStatus) {
        Add-Result "$($Service.Name) HTTP" 'FAIL' "sin respuesta HTTP; endpoint conocido: $($Service.Known)" $true
    } else {
        Add-Result "$($Service.Name) HTTP" 'FAIL' "ningun endpoint aceptable. Ultimo: $lastStatus. Endpoint conocido: $($Service.Known)" $true
    }
}

if (-not $Json) { Write-Title 'UniSaaS - healthcheck' }

if ($DryRun) {
    Write-Info 'Modo -DryRun: no se ejecutan verificaciones, solo se muestra el plan.'
    if (-not $SkipInfra) {
        Write-Info "Infraestructura: contenedor $(Get-DefaultDbContainer) (PostgreSQL) + $(Get-DefaultRedisContainer) (Redis)"
    }
    foreach ($service in $services) {
        Write-Info ("{0}: puerto {1}; endpoints {2}" -f $service.Name, $service.Port, ($service.Candidates -join ', '))
    }
    Write-Host ''
    Write-Info 'Exit code esperado en ejecucion real: 0 si todo responde, 1 si algo falla.'
    exit 0
}

if (-not $SkipInfra) {
    if (-not $Json) { Write-Section 'Infraestructura' }
    Test-Postgres
    Test-Redis
}

if (-not $Json) { Write-Section 'Servicios' }
foreach ($service in $services) {
    Test-Service -Service $service
}

$failed = @($results | Where-Object { $_.Status -eq 'FAIL' -and $_.Critical })
$warned = @($results | Where-Object { $_.Status -eq 'WARN' })

if ($Json) {
    $payload = [pscustomobject]@{
        timestamp = (Get-Date).ToString('o')
        host      = $env:COMPUTERNAME
        results   = $results
        summary   = [pscustomobject]@{
            ok      = @($results | Where-Object { $_.Status -eq 'OK' }).Count
            warnings = $warned.Count
            failed  = $failed.Count
        }
    }
    $payload | ConvertTo-Json -Depth 5
} else {
    Write-Host ''
    Write-Host ('{0,-38} {1,-7} {2}' -f 'CHEQUEO', 'ESTADO', 'DETALLE') -ForegroundColor Cyan
    Write-Host ('-' * 100) -ForegroundColor DarkGray
    foreach ($result in $results) {
        $color = 'Gray'
        if ($result.Status -eq 'OK') { $color = 'Green' }
        if ($result.Status -eq 'WARN') { $color = 'Yellow' }
        if ($result.Status -eq 'FAIL') { $color = 'Red' }
        Write-Host ('{0,-38} {1,-7} {2}' -f $result.Check, $result.Status, $result.Detail) -ForegroundColor $color
    }
    Write-Host ''
    $summary = "OK: {0} | WARN: {1} | FAIL: {2}" -f @($results | Where-Object { $_.Status -eq 'OK' }).Count, $warned.Count, $failed.Count
    if ($failed.Count -eq 0) {
        Write-Ok $summary
    } else {
        Write-Fail $summary
    }
}

if ($failed.Count -gt 0) { exit 1 }
exit 0
