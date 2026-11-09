#!/usr/bin/env bash
# ==============================================================================
# Generador Automatizado de Multi-Repositorios por Microservicio (POSIX Bash)
# Proyecto: Hábitat EC (NODE_ALO_HAB) — Transición Reto 2
# ==============================================================================
set -euo pipefail

OUTPUT_DIR="${1:-../habitat-microservices-repos}"
GITHUB_OWNER="${2:-JArguelloC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MS_SOURCE_DIR="$REPO_ROOT/microservices"

mkdir -p "$OUTPUT_DIR"
RESOLVED_OUT="$(cd "$OUTPUT_DIR" && pwd)"

SERVICES=(
  "habitat-api-gateway"
  "habitat-ms-catalog"
  "habitat-ms-orders"
  "habitat-ms-payments-soa"
)

echo "================================================================="
echo "📦 PARTIDOR MULTI-REPOSITORIO DE MICROSERVICIOS — HÁBITAT EC"
echo "📂 Destino: $RESOLVED_OUT"
echo "================================================================="

for SVC in "${SERVICES[@]}"; do
  SRC_PATH="$MS_SOURCE_DIR/$SVC"
  DST_PATH="$RESOLVED_OUT/$SVC"

  echo "➡️  Inicializando repositorio independiente: $SVC"
  rm -rf "$DST_PATH"
  mkdir -p "$DST_PATH"

  cp -R "$SRC_PATH/." "$DST_PATH/"

  (
    cd "$DST_PATH"
    git init -b main >/dev/null
    git config user.name "Habitat EC Architect"
    git config user.email "devops@habitat.ec"
    git add .
    git commit -m "feat($SVC): initial standalone microservice repo with Azure POSIX ZIP CI/CD" >/dev/null
    git remote add origin "https://github.com/$GITHUB_OWNER/$SVC.git" || true
    echo "   ✅ Listo en $DST_PATH (remote: https://github.com/$GITHUB_OWNER/$SVC.git)"
  )
done

echo ""
echo "🎉 Todos los repositorios independientes han sido generados exitosamente."
