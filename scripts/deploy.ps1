# ============================================================================
# UniSaaS - deploy de produccion (PM2 + PostgreSQL/Redis en Docker)
# ============================================================================
# Flujo:
#   1. Preflight  : entorno, .env por squad, secretos, rol app_runtime, DB,
#                   puertos, espacio en disco y coherencia del ecosystem.
#   2. Backup     : pg_dump formato custom a backups/<timestamp>/ (obligatorio
#                   salvo -SkipBackup).
#   3. Build      : npm/pnpm run build por squad (S3 incluye prisma generate).
#   4. Migraciones: runner idempotente con ledger
#                   public.unisaas_schema_migrations. Detecta
#                   squad*/scripts/migrations/*.sql, squad*/sql/*.sql y
#                   squad*/database/migrations/*.sql.
#   5. Reload     : pm2 start/reload ecosystem.config.cjs --update-env + save.
#   6. Healthcheck: scripts/healthcheck.ps1. Si falla, imprime y escribe
#                   ROLLBACK.txt con el snapshot y los comandos exactos.
#
# IMPORTANTE - alcance de "sin caidas":
#   `pm2 reload` en exec_mode=fork reinicia el proceso (unos segundos por app).
#   Este script reduce el impacto (backup previo, arranque ordenado, healthcheck
#   posterior y rollback documentado), pero NO garantiza cero caidas absoluto.
#   Supuestos y limites: docs/PRODUCCION_DISTRIBUCION.md.
#
# Uso habitual:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Apps squad1-auth-core,squad4-web-pos
#
# Primer despliegue sobre una base ya migrada (opcional): -BaselineMigrations
# registra los archivos actuales como aplicados sin re-ejecutarlos. Los tres
# archivos detectados hoy son idempotentes, por lo que ejecutarlos de nuevo
# tambien es seguro.
#
# NO usar -BaselineMigrations en una base nueva: dejaria migraciones sin
# aplicar realmente.
# ============================================================================

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Strict,
    [switch]$SkipBackup,
    [switch]$SkipBuild,
    [switch]$SkipMigrations,
    [switch]$BaselineMigrations,
    [switch]$Install,
    [string[]]$Apps = @(),
    [string]$BackupRoot = 'backups',
    [string]$EnvFileName = '.env',
    [string]$DbContainer = 'postgres-saas',
    [string]$Database = 'saas_contable_db',
    [string]$DbUser = 'saas_admin',
    [switch]$AllowPort3100Conflict,
    [switch]$AllowSslMismatch
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Get-RepoRoot
$ecosystemPath = Join-Path $root 'ecosystem.config.cjs'
$bffPort = 3100

$AppCatalog = @(
    @{
        Name           = 'squad1-auth-core'
        Dir            = 'squad1_core_architecture_rls_rbac-main'
        Port           = 3001
        Entry          = 'dist/main.js'
        RequiredEnv    = @('DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'CORS_ORIGINS')
        UsesDatabase   = $true
        RequiresJwt    = $true
    },
    @{
        Name           = 'squad2-accounting-ledger'
        Dir            = 'squad2_accounting_engine_ledger-main'
        Port           = 3002
        Entry          = 'dist/main.js'
        RequiredEnv    = @('DATABASE_URL', 'AUTH_SERVICE_URL', 'CORS_ORIGINS')
        UsesDatabase   = $true
        RequiresJwt    = $false
    },
    @{
        Name           = 'squad3-inventory-kardex'
        Dir            = 'squad3_inventory_kardex_cpp-master'
        Port           = 3003
        Entry          = 'dist/src/main.js'
        RequiredEnv    = @('DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'CORS_ORIGINS')
        UsesDatabase   = $true
        RequiresJwt    = $true
    },
    @{
        Name           = 'squad6-reports-escpos'
        Dir            = 'squad6_reports_audit_escpos-develop'
        Port           = 3006
        Entry          = 'dist/main.js'
        RequiredEnv    = @('DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS')
        UsesDatabase   = $true
        RequiresJwt    = $true
    },
    @{
        Name           = 'squad7-cartera-creditos'
        Dir            = 'squad7_credits_purchases_suppliers-main'
        Port           = 3007
        Entry          = 'dist/main.js'
        RequiredEnv    = @('DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS')
        UsesDatabase   = $true
        RequiresJwt    = $true
    },
    @{
        Name           = 'squad4-web-pos'
        Dir            = 'squad4_web_desktop_pos_nextjs-main'
        Port           = $bffPort
        Entry          = $null  # Next.js: node_modules/next/dist/bin/next
        RequiredEnv    = @('DATABASE_URL', 'JWT_SECRET', 'NEXT_PUBLIC_USE_MOCKS')
        UsesDatabase   = $true
        RequiresJwt    = $true
    }
)

$script:Issues = New-Object System.Collections.Generic.List[object]

function Add-Issue {
    param(
        [ValidateSet('BLOCKER', 'WARN', 'INFO')][string]$Level,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $script:Issues.Add([pscustomobject]@{ Level = $Level; Message = $Message }) | Out-Null
}

function Get-IssuesByLevel {
    param([string]$Level)
    return @($script:Issues | Where-Object { $_.Level -eq $Level })
}

function Resolve-TargetApps {
    if ($Apps.Count -eq 0) { return $AppCatalog }
    $resolved = @()
    foreach ($requested in $Apps) {
        $match = $AppCatalog | Where-Object { $_.Name -eq $requested -or $_.Dir -eq $requested }
        if (-not $match) {
            throw "App desconocida: '$requested'. Valores validos: $((($AppCatalog | ForEach-Object { $_.Name }) -join ', '))"
        }
        $resolved += $match
    }
    return $resolved
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
function Test-Prerequisites {
    Write-Section 'Preflight: herramientas'

    if (Test-CommandAvailable -Name 'node') {
        $nodeVersion = (& node --version).Trim()
        $major = 0
        if ($nodeVersion -match '^v(\d+)') { $major = [int]$Matches[1] }
        if ($major -ge 20) { Write-Ok "Node $nodeVersion" } else { Add-Issue 'BLOCKER' "Node $nodeVersion es demasiado antiguo (se requiere >= 20)." }
    } else {
        Add-Issue 'BLOCKER' 'node no esta en PATH.'
    }

    if (Test-CommandAvailable -Name 'npm') { Write-Ok 'npm disponible' } else { Add-Issue 'BLOCKER' 'npm no esta en PATH.' }

    if (Test-CommandAvailable -Name 'pm2') {
        $pm2Version = ''
        try { $pm2Version = (& pm2 --version 2>$null | Select-Object -First 1).Trim() } catch { }
        if ($pm2Version) { Write-Ok "PM2 $pm2Version" } else { Add-Issue 'BLOCKER' 'PM2 no responde a --version.' }
    } else {
        Add-Issue 'BLOCKER' 'PM2 no esta instalado. Ejecute: npm install -g pm2'
    }

    if (Test-DockerAvailable) { Write-Ok 'Docker disponible' } else { Add-Issue 'BLOCKER' 'Docker no esta disponible o el daemon no responde.' }

    foreach ($app in $AppCatalog) {
        $dir = Join-Path $root $app.Dir
        if (-not (Test-Path -LiteralPath $dir)) {
            Add-Issue 'BLOCKER' "Falta el directorio $($app.Dir)."
            continue
        }
        if (-not (Test-Path -LiteralPath (Join-Path $dir 'package.json'))) {
            Add-Issue 'BLOCKER' "Falta $($app.Dir)/package.json."
        }
        if (-not $Install -and -not (Test-Path -LiteralPath (Join-Path $dir 'node_modules'))) {
            Add-Issue 'BLOCKER' "$($app.Dir) no tiene node_modules. Ejecute el deploy con -Install o instale dependencias manualmente."
        }
    }
}

function Test-EcosystemConfig {
    Write-Section 'Preflight: ecosystem.config.cjs'

    if (-not (Test-Path -LiteralPath $ecosystemPath)) {
        Add-Issue 'BLOCKER' 'No existe ecosystem.config.cjs en la raiz.'
        return
    }

    # El probe se escribe a un archivo temporal: pasar codigo JS con comillas
    # dobles por `node -e` desde PowerShell 5.1 corrompe los argumentos.
    $probePath = Join-Path ([System.IO.Path]::GetTempPath()) 'unisaas_ecosystem_probe.cjs'
    $probeCode = @'
const target = process.argv[2];
const p = require(target);
const apps = p.apps.map((a) => ({
  name: a.name,
  script: a.script || "",
  args: a.args || "",
  cwd: a.cwd || "",
  env_file: a.env_file || "",
  exec_mode: a.exec_mode || "",
  instances: a.instances || 1,
  env: a.env || {},
}));
process.stdout.write(JSON.stringify(apps));
'@
    try {
        [System.IO.File]::WriteAllText($probePath, $probeCode, (New-Object System.Text.UTF8Encoding($false)))
        $raw = & node $probePath $ecosystemPath 2>&1
        if ($LASTEXITCODE -ne 0) { throw ($raw -join "`n") }
        $parsed = ($raw -join "`n") | ConvertFrom-Json
    } catch {
        Add-Issue 'BLOCKER' "ecosystem.config.cjs no se puede cargar: $($_.Exception.Message)"
        return
    } finally {
        if (Test-Path -LiteralPath $probePath) { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue }
    }

    if (-not $parsed -or @($parsed).Count -ne $AppCatalog.Count) {
        Add-Issue 'BLOCKER' "ecosystem.config.cjs define $(@($parsed).Count) apps; se esperan $($AppCatalog.Count)."
    }

    foreach ($app in $AppCatalog) {
        $defined = $parsed | Where-Object { $_.name -eq $app.Name }
        if (-not $defined) {
            Add-Issue 'BLOCKER' "ecosystem.config.cjs no define la app '$($app.Name)'."
            continue
        }
        if ($defined.instances -ne 1 -or $defined.exec_mode -ne 'fork') {
            Add-Issue 'BLOCKER' "$($app.Name) debe usar instances=1 y exec_mode=fork (estado actual: instances=$($defined.instances), mode=$($defined.exec_mode))."
        }
        if ($defined.env.NODE_ENV -ne 'production') {
            Add-Issue 'BLOCKER' "$($app.Name) no fija NODE_ENV=production en ecosystem.config.cjs."
        }
        if ([string]$defined.env.PORT -ne [string]$app.Port) {
            Add-Issue 'BLOCKER' "$($app.Name) fija PORT=$($defined.env.PORT); se esperaba $($app.Port)."
        }
        if (-not $defined.env_file) {
            Add-Issue 'WARN' "$($app.Name) no define env_file; dependera del .env cargado por la app."
        } elseif (-not (Test-Path -LiteralPath $defined.env_file)) {
            Add-Issue 'BLOCKER' "$($app.Name) apunta env_file a '$($defined.env_file)', que no existe. Copie el .env.production.example correspondiente."
        }

        if ($app.Entry) {
            $normalized = ([string]$defined.script).Replace('\', '/')
            if (-not $normalized.EndsWith($app.Entry)) {
                Add-Issue 'BLOCKER' "$($app.Name) debe ejecutar '$($app.Entry)'; ecosystem apunta a '$($defined.script)'."
            }
        } else {
            if ($defined.args -notmatch '\bstart\b' -or $defined.args -notmatch [string]$bffPort -or $defined.args -match '\bdev\b') {
                Add-Issue 'BLOCKER' "El BFF debe ejecutar 'next start -p $bffPort'; ecosystem usa args='$($defined.args)'."
            }
        }
    }

    if ((Get-IssuesByLevel -Level 'BLOCKER').Count -eq 0) {
        Write-Ok "ecosystem.config.cjs coherente ($($AppCatalog.Count) apps, fork, NODE_ENV=production)."
    }
}

function Test-AppEnvironments {
    param([array]$TargetApps)
    Write-Section 'Preflight: variables de entorno'

    $knownDevSecretSha256 = @(
        # SHA-256 del JWT_SECRET de desarrollo que circula en los .env locales.
        # Se compara por hash para no versionar el secreto en claro.
        'd08e0a2cfa2d2633d83903de7b7953908b488039066ab1a0bc7b7677c13ea290'
    )

    foreach ($app in $TargetApps) {
        $dir = Join-Path $root $app.Dir
        $envPath = Join-Path $dir $EnvFileName
        if (-not (Test-Path -LiteralPath $envPath)) {
            Add-Issue 'BLOCKER' "$($app.Name): falta $($app.Dir)/$EnvFileName (copie .env.production.example)."
            continue
        }

        $envMap = Get-EnvFile -Path $envPath

        foreach ($key in $app.RequiredEnv) {
            if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
                Add-Issue 'BLOCKER' "$($app.Name): variable requerida vacia o ausente: $key."
            }
        }

        if ($envMap.ContainsKey('NODE_ENV') -and $envMap['NODE_ENV'] -ne 'production') {
            Add-Issue 'WARN' "$($app.Name): .env define NODE_ENV=$($envMap['NODE_ENV']); PM2 lo fuerza a production, pero conviene corregir el archivo."
        }

        if ($app.UsesDatabase -and $envMap.ContainsKey('DATABASE_URL')) {
            $dbUrl = $envMap['DATABASE_URL']
            if ($dbUrl -notmatch '^postgres(ql)?://') {
                Add-Issue 'BLOCKER' "$($app.Name): DATABASE_URL no es una URL postgresql:// valida."
            } else {
                $urlUser = ''
                if ($dbUrl -match '^postgres(?:ql)?://([^:/@]+)') { $urlUser = $Matches[1] }
                if ($urlUser -ne 'app_runtime') {
                    Add-Issue 'BLOCKER' "$($app.Name): DATABASE_URL debe usar el rol app_runtime (sin BYPASSRLS); usa '$urlUser'."
                }
                if ($dbUrl -match 'CAMBIA|CHANGEME|PASSWORD') {
                    Add-Issue 'BLOCKER' "$($app.Name): DATABASE_URL contiene un placeholder sin reemplazar."
                }
            }
        }

        if ($app.RequiresJwt -and $envMap.ContainsKey('JWT_SECRET')) {
            $jwt = $envMap['JWT_SECRET']
            if ($jwt.Length -lt 32) {
                Add-Issue 'BLOCKER' "$($app.Name): JWT_SECRET debe tener al menos 32 caracteres."
            }
            if ($knownDevSecretSha256 -contains (Get-StringSha256 -Text $jwt)) {
                Add-Issue 'BLOCKER' "$($app.Name): JWT_SECRET es el secreto de desarrollo conocido. Genere uno nuevo (openssl rand -base64 48)."
            }
            if ($jwt -match '(?i)^(change_me|changeme|secret|password|example|ci-test)') {
                Add-Issue 'BLOCKER' "$($app.Name): JWT_SECRET parece un placeholder."
            }
        }

        if ($app.Name -eq 'squad2-accounting-ledger') {
            if ($envMap.ContainsKey('USE_MOCK_AUTH') -and $envMap['USE_MOCK_AUTH'] -ne 'false') {
                Add-Issue 'BLOCKER' 'S2: USE_MOCK_AUTH debe ser false en produccion (el arranque falla si es true).'
            }
        }

        if ($app.Name -eq 'squad4-web-pos') {
            $hasAuthUrl = ($envMap.ContainsKey('AUTH_SERVICE_URL') -and -not [string]::IsNullOrWhiteSpace($envMap['AUTH_SERVICE_URL'])) -or
                          ($envMap.ContainsKey('NEXT_PUBLIC_AUTH_SERVICE_URL') -and -not [string]::IsNullOrWhiteSpace($envMap['NEXT_PUBLIC_AUTH_SERVICE_URL']))
            if (-not $hasAuthUrl) {
                Add-Issue 'BLOCKER' 'BFF: defina AUTH_SERVICE_URL (server-side) o NEXT_PUBLIC_AUTH_SERVICE_URL.'
            }
            if (-not $envMap.ContainsKey('NEXT_PUBLIC_USE_MOCKS') -or $envMap['NEXT_PUBLIC_USE_MOCKS'] -ne 'false') {
                Add-Issue 'BLOCKER' 'BFF: NEXT_PUBLIC_USE_MOCKS debe ser false en produccion (de lo contrario el POS opera con mocks).'
            }
            if (-not $envMap.ContainsKey('NEXT_PUBLIC_API_GATEWAY_URL') -or [string]::IsNullOrWhiteSpace($envMap['NEXT_PUBLIC_API_GATEWAY_URL'])) {
                Add-Issue 'WARN' 'BFF: NEXT_PUBLIC_API_GATEWAY_URL no esta definido; se hornea en el build y debe ser la URL publica (https).'
            }
        }

        if ($envMap.ContainsKey('CORS_ORIGINS') -and $envMap['CORS_ORIGINS'].Trim() -eq '*') {
            Add-Issue 'WARN' "$($app.Name): CORS_ORIGINS='*' no deberia usarse en produccion."
        }
    }
}

function Test-DatabaseReadiness {
    Write-Section 'Preflight: base de datos'

    $state = Get-DockerContainerState -Name $DbContainer
    if (-not $state -or $state.Status -ne 'running') {
        Add-Issue 'BLOCKER' "El contenedor '$DbContainer' no esta corriendo."
        return
    }
    Write-Ok "Contenedor $DbContainer running/health=$($state.Health)"

    $ready = Invoke-Docker -Arguments @('exec', $DbContainer, 'pg_isready', '-U', $DbUser, '-d', $Database)
    if ($ready.ExitCode -ne 0) {
        Add-Issue 'BLOCKER' "pg_isready fallo: $($ready.Output)"
        return
    }

    $select = Invoke-Psql -Sql 'SELECT 1;' -Database $Database -User $DbUser -Container $DbContainer
    if ($select.ExitCode -ne 0) {
        Add-Issue 'BLOCKER' "No se pudo consultar la base '$Database': $($select.Output)"
        return
    }

    $runtime = Invoke-Psql -Sql "SELECT rolbypassrls || '|' || rolsuper FROM pg_roles WHERE rolname = 'app_runtime';" -Database $Database -User $DbUser -Container $DbContainer
    if ($runtime.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($runtime.Output)) {
        Add-Issue 'BLOCKER' 'El rol app_runtime no existe. Aplique squad8/scripts/02-security-hardening-runtime-role.sql.'
    } elseif ($runtime.Output -notmatch '^(f|false)\|(f|false)$') {
        Add-Issue 'BLOCKER' "app_runtime tiene atributos inseguros (bypassrls|superuser = $($runtime.Output)); debe ser false|false."
    } else {
        Write-Ok 'Rol app_runtime sin BYPASSRLS ni SUPERUSER'
    }

    $ssl = Invoke-Psql -Sql 'SHOW ssl;' -Database $Database -User $DbUser -Container $DbContainer
    $sslValue = ''
    if ($ssl.ExitCode -eq 0) { $sslValue = $ssl.Output.Trim() }
    Write-Info "PostgreSQL ssl=$sslValue"

    # S1: si DB_SSL no es false, TypeORM intenta TLS en produccion (ver
    # database.module.ts). Con ssl=off la conexion falla.
    if ($sslValue -eq 'off') {
        $s1 = $AppCatalog | Where-Object { $_.Name -eq 'squad1-auth-core' }
        $s1Env = Get-EnvFile -Path (Join-Path (Join-Path $root $s1.Dir) $EnvFileName)
        if ($s1Env.ContainsKey('DB_SSL') -and $s1Env['DB_SSL'] -ne 'false') {
            Add-Issue 'BLOCKER' "S1: DB_SSL=$($s1Env['DB_SSL']) pero PostgreSQL tiene ssl=off. Use DB_SSL=false para el Postgres local en Docker."
        } elseif (-not $s1Env.ContainsKey('DB_SSL')) {
            Add-Issue 'BLOCKER' 'S1: falta DB_SSL=false. En produccion S1 activa TLS por defecto y el Postgres local no ofrece SSL.'
        }

        # S2: desde 2026-10-21 lee DB_SSL igual que S1; ya no fuerza TLS por
        # NODE_ENV. Con el Postgres local (ssl=off) debe estar DB_SSL=false.
        $s2 = $AppCatalog | Where-Object { $_.Name -eq 'squad2-accounting-ledger' }
        $s2Env = Get-EnvFile -Path (Join-Path (Join-Path $root $s2.Dir) $EnvFileName)
        if ($s2Env.ContainsKey('DB_SSL') -and $s2Env['DB_SSL'] -ne 'false') {
            Add-Issue 'BLOCKER' "S2: DB_SSL=$($s2Env['DB_SSL']) pero PostgreSQL tiene ssl=off. Use DB_SSL=false para el Postgres local en Docker."
        } elseif (-not $s2Env.ContainsKey('DB_SSL')) {
            Add-Issue 'BLOCKER' 'S2: falta DB_SSL=false. El Postgres local no ofrece SSL y S2 no debe intentar TLS.'
        }
    }
}

function Get-Pm2Processes {
    $processes = @()
    if (-not (Test-CommandAvailable -Name 'pm2')) { return $processes }
    try {
        $raw = & pm2 jlist 2>$null
        if ($LASTEXITCODE -ne 0) { return $processes }
        $text = ($raw -join "`n").Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { return $processes }
        # PM2 puede imprimir mensajes del daemon antes del JSON.
        $start = $text.IndexOf('[')
        $end = $text.LastIndexOf(']')
        if ($start -lt 0 -or $end -le $start) { return $processes }
        $json = $text.Substring($start, $end - $start + 1)
        # ConvertFrom-Json es case-insensitive y falla con claves como
        # username/USERNAME que PM2 incluye en pm2_env. Node parsea el JSON
        # original (case-sensitive) y devuelve solo name/pid/status.
        $nodeParser = @'
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  const apps = JSON.parse(raw);
  console.log(JSON.stringify(apps.map((a) => ({
    name: a.name,
    pid: a.pid,
    status: a.pm2_env ? a.pm2_env.status : null,
  }))));
});
'@
        $compact = $json | & node -e $nodeParser
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($compact)) { return $processes }
        $parsed = $compact | ConvertFrom-Json
        foreach ($item in @($parsed)) {
            $processes += [pscustomobject]@{
                Name   = [string]$item.name
                Pid    = [int]$item.pid
                Status = [string]$item.status
            }
        }
    } catch { }
    return $processes
}

function Test-PortAvailability {
    param([array]$TargetApps)
    Write-Section 'Preflight: puertos'

    $pm2Processes = @(Get-Pm2Processes)
    $pm2Pids = @($pm2Processes | Where-Object { $_.Status -eq 'online' } | ForEach-Object { $_.Pid })
    $canInspectSockets = ($null -ne (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue))

    foreach ($app in $TargetApps) {
        if (-not $canInspectSockets) {
            # Linux/pwsh no trae Get-NetTCPConnection: solo podemos saber si el
            # puerto esta ocupado, no que proceso lo tiene.
            $pm2App = $pm2Processes | Where-Object { $_.Name -eq $app.Name -and $_.Status -eq 'online' }
            if ($pm2App) {
                Write-Info "Puerto $($app.Port) en uso por $($app.Name) (PM2 PID $($pm2App.Pid))."
            } elseif (Test-TcpPort -Port $app.Port -TimeoutMs 1000) {
                if ($AllowPort3100Conflict) {
                    Add-Issue 'WARN' "Puerto $($app.Port) ocupado y no se pudo identificar el proceso (sin Get-NetTCPConnection). Se continua por -AllowPort3100Conflict."
                } else {
                    Add-Issue 'BLOCKER' "Puerto $($app.Port) ocupado y no se pudo identificar el proceso (Get-NetTCPConnection no disponible en este SO)."
                }
            } else {
                Write-Ok "Puerto $($app.Port) libre ($($app.Name))."
            }
            continue
        }

        try {
            $listeners = @(Get-NetTCPConnection -LocalPort $app.Port -State Listen -ErrorAction SilentlyContinue)
        } catch {
            $listeners = @()
        }

        if ($listeners.Count -eq 0) {
            Write-Ok "Puerto $($app.Port) libre ($($app.Name))."
            continue
        }

        foreach ($listener in $listeners) {
            $ownerPid = [int]$listener.OwningProcess
            $ownerName = 'desconocido'
            try { $ownerName = (Get-Process -Id $ownerPid -ErrorAction Stop).ProcessName } catch { }

            if ($pm2Pids -contains $ownerPid) {
                Write-Info "Puerto $($app.Port) en uso por $($app.Name) (PM2 PID $ownerPid)."
                continue
            }

            if ($app.Port -eq $bffPort -and $ownerName -match 'docker|vpnkit|com\.docker') {
                if ($AllowPort3100Conflict) {
                    Add-Issue 'WARN' "Puerto $bffPort ocupado por Docker ($ownerName, PID $ownerPid). Se continua por -AllowPort3100Conflict; el BFF no podra escuchar."
                } else {
                    Add-Issue 'BLOCKER' "Puerto $bffPort ocupado por Docker ($ownerName, PID $ownerPid). En squad8/docker-compose.yml Loki publica 3100; muevalo (p. ej. 3101) o detengalo antes del deploy."
                }
                continue
            }

            if ($AllowPort3100Conflict) {
                Add-Issue 'WARN' "Puerto $($app.Port) ocupado por '$ownerName' (PID $ownerPid), ajeno a PM2. Se continua por -AllowPort3100Conflict."
            } else {
                Add-Issue 'BLOCKER' "Puerto $($app.Port) ocupado por '$ownerName' (PID $ownerPid), ajeno a PM2. Detengalo o PM2 no podra arrancar $($app.Name)."
            }
        }
    }
}

function Test-DiskAndGit {
    Write-Section 'Preflight: disco y repositorio'

    $free = Get-FreeSpaceGB -Path $root
    if ($null -eq $free) {
        Add-Issue 'WARN' 'No se pudo determinar el espacio libre en disco.'
    } elseif ($free -lt 3) {
        Add-Issue 'BLOCKER' "Espacio libre insuficiente: $free GB (minimo 3 GB para dump + builds)."
    } elseif ($free -lt 10) {
        Add-Issue 'WARN' "Espacio libre bajo: $free GB. Los builds de Next.js y los dumps consumen espacio."
    } else {
        Write-Ok "Espacio libre: $free GB"
    }

    $git = Get-GitInfo -Root $root
    Write-Info "Git: $($git.Branch) @ $($git.Sha)"
    if ($git.Dirty) {
        Add-Issue 'WARN' 'El arbol de trabajo tiene cambios sin commitear. El rollback por commit no reproducira exactamente este estado; conserve el snapshot de backups.'
    }
}

function Invoke-Preflight {
    param([array]$TargetApps)
    Test-Prerequisites
    Test-EcosystemConfig
    Test-AppEnvironments -TargetApps $TargetApps
    Test-DatabaseReadiness
    Test-PortAvailability -TargetApps $TargetApps
    Test-DiskAndGit

    Write-Section 'Resultado del preflight'
    $blockers = Get-IssuesByLevel -Level 'BLOCKER'
    $warnings = Get-IssuesByLevel -Level 'WARN'
    foreach ($warning in $warnings) { Write-Warn $warning.Message }
    foreach ($blocker in $blockers) { Write-Blocker $blocker.Message }
    if ($blockers.Count -eq 0) { Write-Ok 'Sin bloqueos.' }
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
function Get-PackageManager {
    param([string]$Directory)
    if (Test-Path -LiteralPath (Join-Path $Directory 'package-lock.json')) { return 'npm' }
    if (Test-Path -LiteralPath (Join-Path $Directory 'pnpm-lock.yaml')) { return 'pnpm' }
    return 'npm'
}

function Invoke-AppBuild {
    param(
        [hashtable]$App,
        [string]$ReleaseDir
    )

    $dir = Join-Path $root $App.Dir
    $pm = Get-PackageManager -Directory $dir
    $logPath = Join-Path $ReleaseDir ("build-{0}.log" -f $App.Name)

    if ($pm -eq 'pnpm' -and -not (Test-CommandAvailable -Name 'pnpm')) {
        throw "Se requiere pnpm para $($App.Dir) y no esta en PATH."
    }

    # Variables de build: se cargan del .env del squad y se fuerza produccion.
    # NEXT_PUBLIC_* queda horneado en el bundle de Next.js en este paso.
    $envPath = Join-Path $dir $EnvFileName
    $envMap = Get-EnvFile -Path $envPath
    $previous = @{}
    $keysToSet = @($envMap.Keys) + @('NODE_ENV', 'NEXT_TELEMETRY_DISABLED')
    foreach ($key in $keysToSet) {
        $previous[$key] = [System.Environment]::GetEnvironmentVariable($key, 'Process')
    }

    Push-Location -LiteralPath $dir
    try {
        foreach ($key in $envMap.Keys) {
            [System.Environment]::SetEnvironmentVariable($key, [string]$envMap[$key], 'Process')
        }
        [System.Environment]::SetEnvironmentVariable('NODE_ENV', 'production', 'Process')
        [System.Environment]::SetEnvironmentVariable('NEXT_TELEMETRY_DISABLED', '1', 'Process')
        if ($App.Name -eq 'squad4-web-pos') {
            # Defensa en profundidad: nunca hornear mocks en un build de prod.
            [System.Environment]::SetEnvironmentVariable('NEXT_PUBLIC_USE_MOCKS', 'false', 'Process')
        }

        if ($Install) {
            Write-Info "$($App.Name): instalando dependencias con $pm..."
            if ($pm -eq 'npm') {
                $installOutput = & npm ci --no-audit --no-fund 2>&1
            } else {
                $installOutput = & pnpm install --frozen-lockfile 2>&1
            }
            if ($LASTEXITCODE -ne 0) {
                ($installOutput | Out-String) | Set-Content -Path (Join-Path $ReleaseDir ("install-{0}.log" -f $App.Name)) -Encoding UTF8
                throw "Fallo la instalacion de dependencias de $($App.Name)."
            }
        }

        if ($App.Name -eq 'squad3-inventory-kardex') {
            Write-Info "$($App.Name): prisma generate..."
            $prismaOutput = & $pm run prisma:generate 2>&1
            if ($LASTEXITCODE -ne 0) {
                ($prismaOutput | Out-String) | Set-Content -Path $logPath -Encoding UTF8
                throw "Fallo prisma:generate de $($App.Name)."
            }
        }

        Write-Info "$($App.Name): $pm run build"
        $buildOutput = & $pm run build 2>&1
        $buildCode = $LASTEXITCODE
        ($buildOutput | Out-String) | Set-Content -Path $logPath -Encoding UTF8
        if ($buildCode -ne 0) {
            Write-Fail "Build de $($App.Name) fallo (log: $logPath)"
            $buildOutput | Select-Object -Last 40 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
            throw "Build fallido: $($App.Name)."
        }
        Write-Ok "$($App.Name) compilado (log: $logPath)"
    } finally {
        foreach ($key in $previous.Keys) {
            [System.Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
        }
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Migraciones
# ---------------------------------------------------------------------------
function Get-MigrationFiles {
    # Enumeracion explicita por squad: evita copias historicas en
    # backup-pre-bloque1a/ o audit-handoff/ y evita el wildcard en el
    # componente de directorio, que no expande de forma fiable en PS 5.1.
    $relativePatterns = @(
        'scripts\migrations',
        'sql',
        'database\migrations'
    )
    $files = @()
    $squadDirs = @(Get-ChildItem -Path (Join-Path $root 'squad*') -Directory -ErrorAction SilentlyContinue)
    foreach ($squadDir in $squadDirs) {
        foreach ($relative in $relativePatterns) {
            $candidate = Join-Path $squadDir.FullName $relative
            if (Test-Path -LiteralPath $candidate) {
                $files += @(Get-ChildItem -LiteralPath $candidate -Filter '*.sql' -File -ErrorAction SilentlyContinue)
            }
        }
    }
    return @($files | Sort-Object -Property FullName -Unique)
}

function Initialize-MigrationLedger {
    $sql = @'
CREATE TABLE IF NOT EXISTS public.unisaas_schema_migrations (
    filename text PRIMARY KEY,
    checksum_sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    applied_by text
);
'@
    $result = Invoke-Psql -Sql $sql -Database $Database -User $DbUser -Container $DbContainer
    if ($result.ExitCode -ne 0) { throw "No se pudo crear el ledger de migraciones: $($result.Output)" }
}

function Invoke-Migrations {
    param([switch]$BaselineOnly)

    Write-Section 'Migraciones SQL'
    Initialize-MigrationLedger

    $files = Get-MigrationFiles
    if ($files.Count -eq 0) {
        Write-Warn 'No se detectaron archivos de migracion en squad*/scripts/migrations, squad*/sql ni squad*/database/migrations.'
        return
    }

    foreach ($file in $files) {
        $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        $checksum = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $escaped = $relative.Replace("'", "''")

        $existing = Invoke-Psql -Sql "SELECT checksum_sha256 FROM public.unisaas_schema_migrations WHERE filename = '$escaped';" -Database $Database -User $DbUser -Container $DbContainer
        if ($existing.ExitCode -ne 0) { throw "No se pudo consultar el ledger para $relative : $($existing.Output)" }

        if (-not [string]::IsNullOrWhiteSpace($existing.Output)) {
            if ($existing.Output.Trim() -eq $checksum) {
                Write-Info "SKIP  $relative (ya aplicada, checksum identico)"
            } else {
                Add-Issue 'WARN' "La migracion $relative cambio despues de aplicarse (checksum distinto). No se reaplica automaticamente; revise el cambio manualmente."
                Write-Warn "SKIP  $relative (checksum distinto al registrado)"
            }
            continue
        }

        if ($BaselineOnly) {
            $insert = "INSERT INTO public.unisaas_schema_migrations (filename, checksum_sha256, applied_by) VALUES ('$escaped', '$checksum', 'baseline') ON CONFLICT (filename) DO NOTHING;"
            $record = Invoke-Psql -Sql $insert -Database $Database -User $DbUser -Container $DbContainer
            if ($record.ExitCode -ne 0) { throw "No se pudo registrar la linea base de $relative : $($record.Output)" }
            Write-Ok "BASELINE $relative (registrada sin ejecutar)"
            continue
        }

        Write-Info "APPLY $relative"

        $remote = "/tmp/unisaas_migration.sql"
        $copy = Invoke-Docker -Arguments @('cp', $file.FullName, ("{0}:{1}" -f $DbContainer, $remote))
        if ($copy.ExitCode -ne 0) { throw "docker cp fallo para $relative : $($copy.Output)" }

        try {
            $apply = Invoke-Docker -Arguments @(
                'exec', $DbContainer, 'psql',
                '-U', $DbUser, '-d', $Database,
                '-v', 'ON_ERROR_STOP=1',
                '-f', $remote
            )
            if ($apply.ExitCode -ne 0) {
                throw "La migracion $relative fallo: $($apply.Output)"
            }
        } finally {
            Invoke-Docker -Arguments @('exec', $DbContainer, 'rm', '-f', $remote) | Out-Null
        }

        $insert = "INSERT INTO public.unisaas_schema_migrations (filename, checksum_sha256, applied_by) VALUES ('$escaped', '$checksum', '$($env:USERNAME)') ON CONFLICT (filename) DO UPDATE SET checksum_sha256 = EXCLUDED.checksum_sha256, applied_at = now(), applied_by = EXCLUDED.applied_by;"
        $record = Invoke-Psql -Sql $insert -Database $Database -User $DbUser -Container $DbContainer
        if ($record.ExitCode -ne 0) {
            throw "La migracion $relative se aplico pero no se pudo registrar en el ledger: $($record.Output)"
        }
        Write-Ok "$relative aplicada y registrada"
    }
}

# ---------------------------------------------------------------------------
# PM2
# ---------------------------------------------------------------------------
function Get-Pm2RunningNames {
    return @(Get-Pm2Processes | ForEach-Object { $_.Name })
}

function Invoke-Pm2Reload {
    param([array]$TargetApps)

    Write-Section 'PM2 reload'
    $names = @($TargetApps | ForEach-Object { $_.Name })
    $running = Get-Pm2RunningNames
    $missing = @($names | Where-Object { $running -notcontains $_ })

    $previousDir = Get-Location
    try {
        Set-Location -LiteralPath $root
        if ($missing.Count -gt 0) {
            Write-Info "Apps no iniciadas: $($missing -join ', '). Ejecutando pm2 start..."
            $pm2Args = @('start', $ecosystemPath, '--only', ($names -join ','), '--update-env')
            & pm2 @pm2Args
            if ($LASTEXITCODE -ne 0) { throw 'pm2 start fallo.' }
        } else {
            Write-Info "Ejecutando pm2 reload ecosystem.config.cjs --update-env"
            $pm2Args = @('reload', $ecosystemPath, '--update-env')
            if ($names.Count -ne $AppCatalog.Count) { $pm2Args += @('--only', ($names -join ',')) }
            & pm2 @pm2Args
            if ($LASTEXITCODE -ne 0) { throw 'pm2 reload fallo.' }
        }
        & pm2 save | Out-Null
    } finally {
        Set-Location -LiteralPath $previousDir
    }
}

# ---------------------------------------------------------------------------
# Rollback / manifiesto
# ---------------------------------------------------------------------------
function Write-RollbackGuide {
    param(
        [Parameter(Mandatory = $true)][string]$ReleaseDir,
        $Backup,
        [Parameter(Mandatory = $true)]$GitInfo,
        [array]$TargetApps
    )

    $names = ($TargetApps | ForEach-Object { $_.Name }) -join ','
    $dumpPath = if ($Backup) { $Backup.Path } else { '(sin backup: se uso -SkipBackup)' }
    $lines = @(
        '===============================================================================',
        ' UniSaaS - Guia de rollback',
        '===============================================================================',
        "Generada : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "Git      : $($GitInfo.Branch) @ $($GitInfo.Sha)",
        "Apps     : $names",
        "Backup   : $dumpPath",
        '',
        'IMPORTANTE: restaurar la base exige detener las apps para evitar escrituras',
        'durante el pg_restore. Programe una ventana o use el rollback de codigo solo',
        'si el esquema no cambio.',
        '',
        '1) Detener las apps:',
        '   pm2 stop ecosystem.config.cjs',
        '',
        '2) Restaurar la base (dump formato custom):',
        "   docker cp `"$dumpPath`" postgres-saas:/tmp/unisaas_rollback.dump",
        '   docker exec postgres-saas pg_restore -U saas_admin -d saas_contable_db --clean --if-exists --no-owner /tmp/unisaas_rollback.dump',
        '   docker exec postgres-saas rm -f /tmp/unisaas_rollback.dump',
        '',
        '3) Volver al codigo anterior:',
        "   git checkout $($GitInfo.Sha)",
        "   # reconstruir: en cada squad, npm ci / pnpm install --frozen-lockfile y npm run build",
        '',
        '4) Reiniciar y verificar:',
        '   pm2 start ecosystem.config.cjs --update-env',
        '   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/healthcheck.ps1',
        '',
        'Si el fallo es solo de codigo y el esquema es compatible, puede omitir el paso 2.',
        '==============================================================================='
    )
    $path = Join-Path $ReleaseDir 'ROLLBACK.txt'
    ($lines -join [Environment]::NewLine) | Set-Content -Path $path -Encoding UTF8
    return $path
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
$startedAt = Get-Date
$targetApps = Resolve-TargetApps
$gitInfo = Get-GitInfo -Root $root

Write-Title 'UniSaaS - deploy de produccion'
if ($DryRun) { Write-Info 'MODO -DryRun: solo preflight y plan; no se modifica nada.' }
Write-Info "Raiz: $root"
Write-Info "Apps objetivo: $(($targetApps | ForEach-Object { $_.Name }) -join ', ')"

Invoke-Preflight -TargetApps $targetApps

$blockers = Get-IssuesByLevel -Level 'BLOCKER'
$warnings = Get-IssuesByLevel -Level 'WARN'

if ($DryRun) {
    Write-Section 'Plan de ejecucion (no ejecutado)'
    $stampPreview = Get-Date -Format 'yyyyMMdd_HHmmss'
    $previewDir = Join-Path (Join-Path $root $BackupRoot) $stampPreview
    if ($SkipBackup) {
        Write-Info '1. Backup: OMITIDO (-SkipBackup).'
    } else {
        Write-Info "1. Backup: pg_dump -Fc -Z 6 de '$Database' -> $previewDir"
    }
    if ($SkipBuild) {
        Write-Info '2. Build: OMITIDO (-SkipBuild); se usaran los dist/.next existentes.'
    } else {
        foreach ($app in $targetApps) {
            $pm = Get-PackageManager -Directory (Join-Path $root $app.Dir)
            Write-Info "2. Build $($app.Name): $pm run build"
        }
    }
    if ($SkipMigrations) {
        Write-Info '3. Migraciones: OMITIDAS (-SkipMigrations).'
    } else {
        $migrationFiles = Get-MigrationFiles
        Write-Info "3. Migraciones: $($migrationFiles.Count) archivo(s) detectado(s); ledger public.unisaas_schema_migrations."
        foreach ($file in $migrationFiles) {
            Write-Info "     - $($file.FullName.Substring($root.Length + 1))"
        }
        if ($BaselineMigrations) { Write-Warn '     -BaselineMigrations: se registraran SIN ejecutar.' }
    }
    Write-Info '4. PM2: pm2 start/reload ecosystem.config.cjs --update-env && pm2 save'
    Write-Info '5. Healthcheck: scripts/healthcheck.ps1'
    Write-Info "Rollback (si algo falla): se escribira $previewDir\ROLLBACK.txt"
    Write-Host ''
    Write-Info "Preflight: $($blockers.Count) bloqueo(s), $($warnings.Count) advertencia(s)."
    if ($blockers.Count -gt 0) {
        Write-Warn 'El deploy real NO debe ejecutarse hasta resolver los bloqueos (ver arriba).'
        Write-Info 'Se sale con 0 en -DryRun; use -DryRun -Strict para exigir 0 bloqueos.'
    } else {
        Write-Ok 'Listo para ejecutar sin bloqueos.'
    }
    if ($Strict -and $blockers.Count -gt 0) { exit 2 }
    exit 0
}

if ($blockers.Count -gt 0) {
    Write-Fail "Preflight con $($blockers.Count) bloqueo(s). No se realizo ningun cambio."
    exit 2
}

$releaseDir = $null
$backup = $null
try {
    # --- Directorio de release -------------------------------------------------
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $releaseDir = Join-Path (Join-Path $root $BackupRoot) $stamp
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

    # --- Backup ----------------------------------------------------------------
    if ($SkipBackup) {
        Write-Section 'Backup'
        Write-Warn 'Backup omitido por -SkipBackup. El rollback no podra restaurar datos.'
    } else {
        Write-Section 'Backup de PostgreSQL'
        Write-Info "Destino: $releaseDir"
        $backup = New-DatabaseBackup -DestinationRoot (Join-Path $root $BackupRoot) -Database $Database -User $DbUser -Container $DbContainer
        $releaseDir = $backup.Directory
        Write-Ok "Backup: $($backup.Path) ($(Get-HumanSize -Bytes $backup.Bytes))"
        Write-Ok "SHA256: $($backup.Sha256)"
    }

    # --- Build -----------------------------------------------------------------
    if ($SkipBuild) {
        Write-Section 'Build'
        Write-Warn 'Build omitido por -SkipBuild. Se usan los artefactos existentes.'
        foreach ($app in $targetApps) {
            if ($app.Entry) {
                $entryPath = Join-Path (Join-Path $root $app.Dir) $app.Entry
                if (-not (Test-Path -LiteralPath $entryPath)) {
                    throw "No existe el artefacto $($app.Entry) para $($app.Name); no se puede usar -SkipBuild."
                }
            }
        }
    } else {
        Write-Section 'Build por squad'
        foreach ($app in $targetApps) {
            Invoke-AppBuild -App $app -ReleaseDir $releaseDir

            # Verificacion del artefacto: un build "exitoso" sin entrypoint
            # deja a PM2 en crash-loop.
            if ($app.Entry) {
                $entryPath = Join-Path (Join-Path $root $app.Dir) $app.Entry
                if (-not (Test-Path -LiteralPath $entryPath)) {
                    throw "El build de $($app.Name) no genero $($app.Entry)."
                }
            } else {
                $nextDir = Join-Path (Join-Path $root $app.Dir) '.next'
                if (-not (Test-Path -LiteralPath $nextDir)) {
                    throw "El build de $($app.Name) no genero .next/."
                }
            }
        }
    }

    # --- Migraciones -----------------------------------------------------------
    if ($SkipMigrations) {
        Write-Section 'Migraciones SQL'
        Write-Warn 'Migraciones omitidas por -SkipMigrations.'
    } else {
        Invoke-Migrations -BaselineOnly:$BaselineMigrations
    }

    # --- PM2 -------------------------------------------------------------------
    Invoke-Pm2Reload -TargetApps $targetApps

    # --- Healthcheck -----------------------------------------------------------
    Write-Section 'Healthcheck posterior'
    $healthExit = 0
    & (Join-Path $PSScriptRoot 'healthcheck.ps1')
    $healthExit = $LASTEXITCODE

    $rollbackPath = Write-RollbackGuide -ReleaseDir $releaseDir -Backup $backup -GitInfo $gitInfo -TargetApps $targetApps

    $manifest = [pscustomobject]@{
        startedAt   = $startedAt.ToString('o')
        finishedAt  = (Get-Date).ToString('o')
        git         = $gitInfo
        apps        = @($targetApps | ForEach-Object { $_.Name })
        backup      = $backup
        releaseDir  = $releaseDir
        healthcheck = $healthExit
        warnings    = @($warnings | ForEach-Object { $_.Message })
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $releaseDir 'DEPLOY_MANIFEST.json') -Encoding UTF8

    if ($healthExit -ne 0) {
        Write-Fail 'El healthcheck posterior fallo. Ejecute el rollback descrito en:'
        Write-Host "    $rollbackPath" -ForegroundColor Yellow
        Write-Host ''
        Get-Content -LiteralPath $rollbackPath | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
        exit 1
    }

    Write-Host ''
    Write-Ok 'Deploy completado y healthcheck en verde.'
    Write-Info "Manifiesto: $(Join-Path $releaseDir 'DEPLOY_MANIFEST.json')"
    if ($backup) { Write-Info "Backup disponible: $($backup.Path)" }
    exit 0
} catch {
    Write-Fail $_.Exception.Message
    if ($releaseDir -and (Test-Path -LiteralPath $releaseDir)) {
        $guide = Write-RollbackGuide -ReleaseDir $releaseDir -Backup $backup -GitInfo $gitInfo -TargetApps $targetApps
        Write-Host ''
        Write-Warn 'Rollback disponible en:'
        Write-Host "    $guide" -ForegroundColor Yellow
        if ($backup) { Write-Host "    Backup: $($backup.Path)" -ForegroundColor Yellow }
    }
    exit 1
}
