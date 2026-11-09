<#
.SYNOPSIS
    Fase 4 - Script Maestro de Despliegue y Provisionamiento en Azure App Service (Linux B1)
    Proyecto: Habitat EC (NODE_ALO_HAB) - Reto 2 (Booking Central v2.1 / v2.2 + RabbitMQ CloudAMQP)

.DESCRIPTION
    1. Reutiliza un UNICO App Service Plan Linux B1 (asp-habitat-ec-b1) para proteger la cuota
       de vCPU y el credito de $100 USD de Azure for Students.
    2. Configura obligatoriamente:
       - SCM_DO_BUILD_DURING_DEPLOYMENT=false
       - ENABLE_ORYX_BUILD=false
       - WEBSITES_CONTAINER_START_TIME_LIMIT=600
       - --always-on true (respuesta < 1000ms para el semaforo de Booking Central)
    3. Inyecta las variables de entorno del contrato B2B v2.1/v2.2 y CloudAMQP:
       - NODE_ID="NODE_ALO_HAB"
       - API_KEY="hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c"
       - BOOKING_REST_STOCK_URL, BOOKING_BASE_URL, BOOKING_V2_URL
       - RABBITMQ_URL, EVENT_BUS_MODE="rabbitmq", TZ="America/Guayaquil"
    4. Empaqueta el artefacto ZIP mediante Python zipfile forzando barras diagonales POSIX (/)
       y despliega en Azure App Service.

.EXAMPLE
    .\scripts\deploy-azure-suite.ps1 -Mode unified
    .\scripts\deploy-azure-suite.ps1 -Mode full-suite
    .\scripts\deploy-azure-suite.ps1 -PackageOnly
#>

param(
    [ValidateSet("unified", "microservices", "full-suite")]
    [string]$Mode = "unified",
    [switch]$PackageOnly,
    [string]$ResourceGroup = "rg-habitat-ec",
    [string]$Location = "chilecentral",
    [string]$PlanName = "asp-habitat-ec-b1"
)

$ErrorActionPreference = "Stop"
$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PythonScript = Join-Path $PSScriptRoot "deploy-azure-suite.py"

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "[FASE 4] Despliegue Suite Azure App Service (Linux B1)" -ForegroundColor Cyan
Write-Host "Nodo B2B : NODE_ALO_HAB" -ForegroundColor Cyan
Write-Host "Modo     : $Mode" -ForegroundColor Cyan
Write-Host "Plan B1  : $PlanName ($Location)" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

$PythonArgs = @(
    $PythonScript,
    "--mode", $Mode,
    "--resource-group", $ResourceGroup,
    "--location", $Location,
    "--plan", $PlanName
)

if ($PackageOnly) {
    $PythonArgs += "--package-only"
}

python @PythonArgs
if ($LASTEXITCODE -ne 0) {
    throw "El script deploy-azure-suite.py finalizo con codigo de error $LASTEXITCODE"
}
