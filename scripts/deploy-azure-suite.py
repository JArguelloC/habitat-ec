#!/usr/bin/env python3
"""
Fase 4 — Script Maestro de Despliegue y Provisionamiento en Azure App Service (Linux B1)
Proyecto: Hábitat EC (NODE_ALO_HAB) — Reto 2 (Booking Central v2.1 / v2.2 + RabbitMQ CloudAMQP)

Características clave para cuenta Azure for Students ($100 USD):
  1. Reutiliza un ÚNICO App Service Plan Linux B1 (asp-habitat-ec-b1) para alojar el backend
     unificado y/o los 4 microservicios sin agotar la cuota de vCPU estudiantil.
  2. Configura obligatoriamente:
     - SCM_DO_BUILD_DURING_DEPLOYMENT=false
     - ENABLE_ORYX_BUILD=false
     - WEBSITES_CONTAINER_START_TIME_LIMIT=600
     - --always-on true (evita cold starts > 1000ms en el semáforo de Booking Central)
  3. Inyecta las variables de entorno del contrato B2B v2.1/v2.2 y CloudAMQP:
     - NODE_ID="NODE_ALO_HAB"
     - API_KEY="hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c"
     - BOOKING_REST_STOCK_URL, BOOKING_BASE_URL, BOOKING_V2_URL
     - RABBITMQ_URL, EVENT_BUS_MODE="rabbitmq", TZ="America/Guayaquil"
  4. Empaqueta el artefacto ZIP en Python forzando barras diagonales POSIX (/) en Windows
     para evitar fallos de extracción en contenedores Linux de Azure App Service.

Uso:
  python scripts/deploy-azure-suite.py --mode unified
  python scripts/deploy-azure-suite.py --mode full-suite
  python scripts/deploy-azure-suite.py --package-only
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

DEFAULT_RESOURCE_GROUP = os.environ.get("AZURE_RESOURCE_GROUP", "rg-habitat-ec")
DEFAULT_LOCATION = os.environ.get("AZURE_LOCATION", "chilecentral")
DEFAULT_PLAN_NAME = os.environ.get("AZURE_APP_SERVICE_PLAN", "asp-habitat-ec-b1")
MAIN_BACKEND_APP = os.environ.get("AZURE_MAIN_WEBAPP", "habitat-ec-backend")

B2B_ENV_DEFAULTS = {
    "SCM_DO_BUILD_DURING_DEPLOYMENT": "false",
    "ENABLE_ORYX_BUILD": "false",
    "WEBSITES_CONTAINER_START_TIME_LIMIT": "600",
    "NODE_ENV": "production",
    "TZ": "America/Guayaquil",
    "NODE_ID": "NODE_ALO_HAB",
    "API_KEY": os.environ.get(
        "API_KEY", "hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c"
    ),
    "BOOKING_REST_STOCK_URL": os.environ.get(
        "BOOKING_REST_STOCK_URL",
        "https://booking-api-v21-22.azurewebsites.net/api/v2/providers/stock-Rest",
    ),
    "BOOKING_BASE_URL": os.environ.get(
        "BOOKING_BASE_URL",
        "https://booking-api-v21-22.azurewebsites.net",
    ),
    "BOOKING_V2_URL": os.environ.get(
        "BOOKING_V2_URL",
        "https://booking-api-v21-22.azurewebsites.net",
    ),
    "EVENT_BUS_MODE": os.environ.get("EVENT_BUS_MODE", "rabbitmq"),
    "RABBITMQ_URL": os.environ.get("RABBITMQ_URL", ""),
}

SERVICES = {
    "unified": [
        {
            "name": MAIN_BACKEND_APP,
            "path": ROOT_DIR / "backend",
            "include": ["dist", "node_modules", "package.json", "proto", "src/graphql"],
        }
    ],
    "microservices": [
        {
            "name": "habitat-api-gateway",
            "path": ROOT_DIR / "microservices" / "habitat-api-gateway",
            "include": ["dist", "node_modules", "package.json"],
        },
        {
            "name": "habitat-ms-catalog",
            "path": ROOT_DIR / "microservices" / "habitat-ms-catalog",
            "include": ["dist", "node_modules", "package.json"],
        },
        {
            "name": "habitat-ms-orders",
            "path": ROOT_DIR / "microservices" / "habitat-ms-orders",
            "include": ["dist", "node_modules", "package.json", "proto"],
        },
        {
            "name": "habitat-ms-payments-soa",
            "path": ROOT_DIR / "microservices" / "habitat-ms-payments-soa",
            "include": ["dist", "node_modules", "package.json"],
        },
    ],
}


def find_az_executable() -> str:
    """Localiza el ejecutable de Azure CLI en PATH o rutas por defecto de Windows."""
    az_bin = shutil.which("az") or shutil.which("az.cmd")
    if az_bin:
        return az_bin

    windows_candidates = [
        r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
        r"C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
    ]
    for candidate in windows_candidates:
        if os.path.exists(candidate):
            return candidate

    return ""


def run_cmd(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=check,
        text=True,
        shell=(os.name == "nt" and cmd[0].endswith(".cmd")),
    )


def create_posix_zip(service_dir: Path, include_paths: list[str], output_zip: Path) -> int:
    """
    Crea un archivo ZIP garantizando que todas las rutas internas usen barras diagonales POSIX (/).
    Indispensable al empaquetar desde Windows hacia contenedores Linux en Azure App Service.
    """
    if output_zip.exists():
        output_zip.unlink()

    file_count = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel_target in include_paths:
            target_path = service_dir / rel_target
            if not target_path.exists():
                continue
            if target_path.is_file():
                arcname = target_path.relative_to(service_dir).as_posix()
                zf.write(target_path, arcname)
                file_count += 1
            else:
                for root, _, files in os.walk(target_path):
                    for file in files:
                        full_path = Path(root) / file
                        arcname = full_path.relative_to(service_dir).as_posix()
                        zf.write(full_path, arcname)
                        file_count += 1

    size_mb = output_zip.stat().st_size / (1024 * 1024)
    print(f"  [OK] Empaquetado POSIX: {output_zip.name} ({file_count} archivos, {size_mb:.2f} MB)")
    return file_count


def build_and_package_service(service: dict) -> Path:
    service_dir: Path = service["path"]
    service_name: str = service["name"]
    print(f"\n=============================================================")
    print(f"[BUILD & PACKAGE] {service_name} ({service_dir})")
    print(f"=============================================================")

    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    run_cmd([npm_cmd, "install"], cwd=service_dir)
    run_cmd([npm_cmd, "run", "build"], cwd=service_dir)
    run_cmd([npm_cmd, "prune", "--omit=dev"], cwd=service_dir)

    zip_path = service_dir / "deploy.zip"
    create_posix_zip(service_dir, service["include"], zip_path)
    return zip_path


def ensure_azure_login(az_bin: str) -> dict:
    """Verifica sesión activa en Azure CLI o abre el navegador para cuenta estudiantil."""
    res = subprocess.run(
        [az_bin, "account", "show", "-o", "json"],
        capture_output=True,
        text=True,
        shell=(os.name == "nt" and az_bin.endswith(".cmd")),
    )
    if res.returncode != 0:
        print("\n[AUTH] No se detectó sesión activa en Azure CLI.")
        print("[AUTH] Abriendo ventana del navegador para iniciar sesión con tu cuenta estudiantil...")
        run_cmd([az_bin, "login"])
        res = subprocess.run(
            [az_bin, "account", "show", "-o", "json"],
            capture_output=True,
            text=True,
            check=True,
            shell=(os.name == "nt" and az_bin.endswith(".cmd")),
        )
    account = json.loads(res.stdout)
    print(f"  [OK] Suscripción Azure activa: {account.get('name')} ({account.get('id')})")
    return account


def ensure_shared_linux_b1_plan(az_bin: str, resource_group: str, location: str, plan_name: str) -> None:
    """Crea o reutiliza un único App Service Plan Linux B1 para cuidar el crédito de Azure for Students."""
    print(f"\n[INFRA] Verificando Resource Group '{resource_group}' y App Service Plan Linux B1 '{plan_name}'...")
    run_cmd([az_bin, "group", "create", "--name", resource_group, "--location", location, "-o", "none"])

    check_plan = subprocess.run(
        [az_bin, "appservice", "plan", "show", "--name", plan_name, "--resource-group", resource_group, "-o", "json"],
        capture_output=True,
        text=True,
        shell=(os.name == "nt" and az_bin.endswith(".cmd")),
    )
    if check_plan.returncode != 0:
        print(f"  [CREATE] Creando App Service Plan compartido '{plan_name}' (Linux B1)...")
        run_cmd(
            [
                az_bin,
                "appservice",
                "plan",
                "create",
                "--name",
                plan_name,
                "--resource-group",
                resource_group,
                "--location",
                location,
                "--sku",
                "B1",
                "--is-linux",
                "-o",
                "none",
            ]
        )
    else:
        print(f"  [REUSE] Reutilizando App Service Plan Linux B1 existente: '{plan_name}'")


def deploy_service_to_azure(
    az_bin: str,
    resource_group: str,
    plan_name: str,
    app_name: str,
    zip_path: Path,
) -> None:
    print(f"\n[DEPLOY] Provisionando y configurando Web App '{app_name}' en plan '{plan_name}'...")
    check_app = subprocess.run(
        [az_bin, "webapp", "show", "--name", app_name, "--resource-group", resource_group, "-o", "json"],
        capture_output=True,
        text=True,
        shell=(os.name == "nt" and az_bin.endswith(".cmd")),
    )
    if check_app.returncode != 0:
        run_cmd(
            [
                az_bin,
                "webapp",
                "create",
                "--name",
                app_name,
                "--resource-group",
                resource_group,
                "--plan",
                plan_name,
                "--runtime",
                "NODE:22-lts",
                "-o",
                "none",
            ]
        )

    # 1. Configurar App Settings del Contrato B2B y desactivar Oryx Build
    settings_pairs = [f"{k}={v}" for k, v in B2B_ENV_DEFAULTS.items() if v != ""]
    run_cmd(
        [
            az_bin,
            "webapp",
            "config",
            "appsettings",
            "set",
            "--name",
            app_name,
            "--resource-group",
            resource_group,
            "--settings",
            *settings_pairs,
            "-o",
            "none",
        ]
    )

    # 2. Activar Always-On y comando de inicio en producción
    run_cmd(
        [
            az_bin,
            "webapp",
            "config",
            "set",
            "--name",
            app_name,
            "--resource-group",
            resource_group,
            "--always-on",
            "true",
            "--startup-file",
            "node dist/main.js",
            "-o",
            "none",
        ]
    )

    # 3. Desplegar artefacto ZIP POSIX
    run_cmd(
        [
            az_bin,
            "webapp",
            "deploy",
            "--name",
            app_name,
            "--resource-group",
            resource_group,
            "--src-path",
            str(zip_path),
            "--type",
            "zip",
        ]
    )
    print(f"  [OK] Despliegue completado para {app_name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Despliegue Azure App Service Linux B1 — Hábitat EC (NODE_ALO_HAB)")
    parser.add_argument(
        "--mode",
        choices=["unified", "microservices", "full-suite"],
        default="unified",
        help="Desplegar el backend unificado (unified), los 4 microservicios (microservices) o ambos (full-suite).",
    )
    parser.add_argument(
        "--package-only",
        action="store_true",
        help="Compilar y generar los paquetes deploy.zip con rutas POSIX sin invocar Azure CLI.",
    )
    parser.add_argument("--resource-group", default=DEFAULT_RESOURCE_GROUP)
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--plan", default=DEFAULT_PLAN_NAME)
    args = parser.parse_args()

    selected_services = []
    if args.mode in ("unified", "full-suite"):
        selected_services.extend(SERVICES["unified"])
    if args.mode in ("microservices", "full-suite"):
        selected_services.extend(SERVICES["microservices"])

    packaged: list[tuple[dict, Path]] = []
    for svc in selected_services:
        zip_path = build_and_package_service(svc)
        packaged.append((svc, zip_path))

    if args.package_only:
        print("\n[DONE] Empaquetado POSIX finalizado (--package-only).")
        return

    az_bin = find_az_executable()
    if not az_bin:
        print("\n[WARN] Azure CLI ('az') no está instalado localmente en esta máquina.")
        print("       Para instalarlo en Windows ejecuta: winget install -e --id Microsoft.AzureCLI")
        print("       Nota: El despliegue automático a Azure ya está activo vía GitHub Actions (ci-cd.yml / deploy-azure.yml).")
        sys.exit(0)

    ensure_azure_login(az_bin)
    ensure_shared_linux_b1_plan(az_bin, args.resource_group, args.location, args.plan)

    for svc, zip_path in packaged:
        deploy_service_to_azure(az_bin, args.resource_group, args.plan, svc["name"], zip_path)


if __name__ == "__main__":
    main()

