# detener-unisaas.ps1
# Detiene los servicios de desarrollo o producción de UniSaaS

param(
    [switch]$StopDocker
)

Write-Host "Deteniendo procesos UniSaaS en puertos 3000 y 3001..." -ForegroundColor Yellow

$ports = @(3000, 3001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -and $pidToKill -gt 4) {
                Write-Host "Deteniendo PID $pidToKill en puerto $port..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-Host "Deteniendo procesos supervisados por PM2..." -ForegroundColor Yellow
    pm2 stop ecosystem.config.cjs -s 2>$null
}

if ($StopDocker) {
    Write-Host "Deteniendo contenedores Docker de prueba..." -ForegroundColor Yellow
    docker stop unisaas-postgres-rls-test unisaas-redis-test 2>$null
}

Write-Host "Servicios detenidos correctamente." -ForegroundColor Green
