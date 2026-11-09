<#
.SYNOPSIS
    Generador Automatizado de Multi-Repositorios Independientes por Microservicio (Reto 2 - Habitat EC / NODE_ALO_HAB)
.DESCRIPTION
    Toma cada microservicio de ./microservices (habitat-api-gateway, habitat-ms-catalog, habitat-ms-orders, habitat-ms-payments-soa),
    inicializa su estructura independiente con su propio package.json, Dockerfile, tsconfig.json, contratos (.proto / .graphql)
    y flujo .github/workflows/deploy-azure.yml (con empaquetado ZIP POSIX en Python), e inicializa su repositorio Git (git init -b main).
.EXAMPLE
    .\scripts\split-microservices-repos.ps1 -OutputDir "..\habitat-microservices-repos" -GitHubOwner "JArguelloC"
#>

param(
    [string]$OutputDir = "..\habitat-microservices-repos",
    [string]$GitHubOwner = "JArguelloC",
    [switch]$CreateGitHubRepos = $false
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MicroservicesSourceDir = Join-Path $RepoRoot "microservices"

if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $ResolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDir)
} else {
    $ResolvedOutputDir = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputDir))
}

$Services = @(
    @{
        Name        = "habitat-api-gateway"
        Paradigm    = "API Gateway / ESB Orquestador (/api/v1, /api/v2, /graphql)"
        IncludePath = @("src", ".github", "package.json", "tsconfig.json", "Dockerfile", ".gitignore", "README.md")
    },
    @{
        Name        = "habitat-ms-catalog"
        Paradigm    = "GraphQL (/graphql) + REST (Catalogo, Busqueda y Matriz 5FN)"
        IncludePath = @("src", ".github", "package.json", "tsconfig.json", "Dockerfile", "schema.graphql", ".gitignore", "README.md")
    },
    @{
        Name        = "habitat-ms-orders"
        Paradigm    = "gRPC + Protobuf (proto/inventory.proto, Concurrencia GiST y Sagas)"
        IncludePath = @("src", "proto", ".github", "package.json", "tsconfig.json", "Dockerfile", ".gitignore", "README.md")
    },
    @{
        Name        = "habitat-ms-payments-soa"
        Paradigm    = "SOA (Liquidaciones 85%/15%, Clientes Cross-Platform) + EDA Outbox Worker (RabbitMQ)"
        IncludePath = @("src", ".github", "package.json", "tsconfig.json", "Dockerfile", ".gitignore", "README.md")
    }
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "[MULTI-REPO] PARTIDOR DE MICROSERVICIOS - HABITAT EC (NODE_ALO_HAB)" -ForegroundColor Cyan
Write-Host "[DESTINO]    $ResolvedOutputDir" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if (-not (Test-Path $ResolvedOutputDir)) {
    New-Item -ItemType Directory -Path $ResolvedOutputDir -Force | Out-Null
}

foreach ($svc in $Services) {
    $svcName = $svc.Name
    $srcPath = Join-Path $MicroservicesSourceDir $svcName
    $dstPath = Join-Path $ResolvedOutputDir $svcName

    Write-Host "-> Procesando [$svcName] ($($svc.Paradigm))..." -ForegroundColor Yellow

    if (-not (Test-Path $srcPath)) {
        Write-Error "No existe el directorio fuente: $srcPath"
    }

    if (Test-Path $dstPath) {
        Remove-Item -Path $dstPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $dstPath -Force | Out-Null

    foreach ($item in $svc.IncludePath) {
        $itemSrc = Join-Path $srcPath $item
        if (Test-Path $itemSrc) {
            Copy-Item -Path $itemSrc -Destination $dstPath -Recurse -Force
        }
    }

    Push-Location $dstPath
    try {
        git init -b main | Out-Null
        git config user.name "Habitat EC Architect"
        git config user.email "devops@habitat.ec"
        git add .
        git commit -m "feat($svcName): initial standalone microservice repo with Azure POSIX ZIP CI/CD" | Out-Null

        $remoteUrl = "https://github.com/$GitHubOwner/$svcName.git"
        git remote add origin $remoteUrl 2>$null

        Write-Host "   [OK] Repositorio Git inicializado en: $dstPath" -ForegroundColor Green
        Write-Host "   [REMOTE] $remoteUrl" -ForegroundColor Gray

        if ($CreateGitHubRepos) {
            Write-Host "   [GITHUB] Creando y subiendo repositorio en GitHub via gh CLI..." -ForegroundColor Cyan
            gh repo create "$GitHubOwner/$svcName" --public --source=. --remote=origin --push
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "[COMPLETADO] Los 4 repositorios independientes han sido generados en: $ResolvedOutputDir" -ForegroundColor Green
