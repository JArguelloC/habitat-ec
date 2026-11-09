$scratch = 'C:\Users\james\.gemini\antigravity\brain\ec08c8e8-3879-4e91-a8e2-09f4430d92a1\scratch\microservices-repos'
$repos = @(
    'habitat-api-gateway',
    'habitat-ms-catalog',
    'habitat-ms-orders',
    'habitat-ms-payments-soa'
)

foreach ($r in $repos) {
    $dir = Join-Path $scratch $r
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Subiendo repositorio: $r" -ForegroundColor Green
    Write-Host "Directorio: $dir" -ForegroundColor Gray
    Write-Host "========================================"
    Set-Location $dir
    git push -u origin main
}
