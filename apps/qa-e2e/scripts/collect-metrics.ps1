# ============================================================================
# OBSERVABILIDAD Y RECOPILACIÓN DE MÉTRICAS - POSTGRESQL, REDIS Y NODE.JS
# ============================================================================

param (
  [string]$OutputFile = "C:\unisaas\new\apps\qa-e2e\reports\resource-metrics.json"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "--- Recopilando métricas de infraestructura ---" -ForegroundColor Cyan

# 1. PostgreSQL Metrics
$pgConnections = docker exec unisaas-postgres-rls-test psql -U saas_migration_admin -d saas_contable_db -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL;"
$pgDeadlocks = docker exec unisaas-postgres-rls-test psql -U saas_migration_admin -d saas_contable_db -t -A -c "SELECT deadlocks FROM pg_stat_database WHERE datname = 'saas_contable_db';"
$pgLocks = docker exec unisaas-postgres-rls-test psql -U saas_migration_admin -d saas_contable_db -t -A -c "SELECT count(*) FROM pg_locks WHERE NOT granted;"

# 2. Redis Metrics
$redisClients = docker exec unisaas-redis-test redis-cli info clients | Select-String "connected_clients"
$redisMemory = docker exec unisaas-redis-test redis-cli info memory | Select-String "used_memory_human"

# 3. Docker Container Stats
$dockerStats = docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}" unisaas-postgres-rls-test unisaas-redis-test

# 4. Node.js Process Stats (NestJS Gateway)
$nodeProcess = Get-Process node | Where-Object { $_.MainWindowTitle -ne "Visual Studio Code" } | Select-Object -First 1
$nodeCpu = if ($nodeProcess) { $nodeProcess.CPU } else { 0 }
$nodeRssMb = if ($nodeProcess) { [math]::Round($nodeProcess.WorkingSet64 / 1MB, 2) } else { 0 }

$metrics = @{
  timestamp = (Get-Date).ToString("o")
  postgresql = @{
    active_connections = [int]($pgConnections -replace '\s','')
    deadlocks = [int]($pgDeadlocks -replace '\s','')
    lock_waits = [int]($pgLocks -replace '\s','')
  }
  redis = @{
    connected_clients = ($redisClients -replace 'connected_clients:','').Trim()
    used_memory = ($redisMemory -replace 'used_memory_human:','').Trim()
  }
  node = @{
    process_rss_mb = $nodeRssMb
    cpu_time_sec = $nodeCpu
  }
  containers = $dockerStats
}

$json = $metrics | ConvertTo-Json -Depth 5
New-Item -ItemType Directory -Force -Path (Split-Path $OutputFile) | Out-Null
Set-Content -Path $OutputFile -Value $json -Force

Write-Host "Métricas guardadas en: $OutputFile" -ForegroundColor Green
Write-Output $json

