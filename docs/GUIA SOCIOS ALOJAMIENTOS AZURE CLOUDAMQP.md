# 🏨 Guía de Despliegue en Azure y CloudAMQP para Socios de ALOJAMIENTOS
## Integración con Booking Prototipo (RDA2 — Semanas 9 y 10)

Esta guía es para el nodo de **ALOJAMIENTOS** (`MS_ALO`: hoteles, hostales, hospedaje). Permite desplegar el microservicio en **Azure App Service (Linux B1)** y conectarlo al **Event Bus RabbitMQ (CloudAMQP)**. Incluye un **Prompt Maestro** para entregárselo a un asistente de IA (Claude Code, Copilot, ChatGPT, Cursor o Antigravity).

> **Fuente de verdad del API:** `alojamientos-openapi-v2.yaml` (v2.2.0). El despliegue no debe modificar el contrato.

---

## 📌 Estado actual del proyecto (leer antes de desplegar)

- Booking central ya está **100 % desplegado** en Azure App Service y conectado al clúster de **CloudAMQP (RabbitMQ)**.
- El servicio de **Alojamientos aún se está ajustando**. Por eso es importante que cada equipo tenga **funcionando todas sus partes por detrás** (despliegue, health, catálogo, reservas y notificación de stock) **antes** de la integración.
- En los **próximos días** se harán las **pruebas de integración** end-to-end (búsqueda → cotización → reserva → cancelación compensatoria → stock) contra el Booking ya desplegado.
- Hasta entonces, algunos detalles del servicio pueden ajustarse.

---

## 🎯 Requisitos de la Categoría ALOJAMIENTOS

Para cumplir la rúbrica **CE01, CE03, CE07 y CE10 (Condición Habilitante Obligatoria)**, el microservicio debe exponer en Internet:

1. **Salud / Telemetría:** `GET /alojamientos/health` (semáforo `GREEN`/`YELLOW`/`RED`, respuesta < 1 s).
2. **Catálogo y Búsqueda:** `GET /alojamientos` y `POST /alojamientos/search` (propiedades, estrellas, ciudad, precio total de la estancia).
3. **Disponibilidad y Cotización:** `POST /alojamientos/availability` (congela el precio 30 min, devuelve `cotizacionId`).
4. **Creación de Reservas (Saga):** `POST /alojamientos/orders/create` (idempotente, responde en ≤ 3000 ms).
5. **Cancelación compensatoria:** `POST /alojamientos/orders/{orderId}/cancel` (idempotente).
6. **Sincronización de stock con Booking:** al reservar, cancelar, bloquear una habitación o cargar inventario.
7. **Seguridad:** `X-API-Key` (transitoria, deprecada hasta v3) y `OAuth2ClientCredentials` con scopes `alojamientos:*` según el contrato.

---

## 📋 Parte 1: Lo que debe hacer el estudiante

1. **Activar Azure for Students** con el correo `@puce.edu.ec`: https://azure.microsoft.com/free/students (100 USD de crédito, sin tarjeta).
2. **Instalar Azure CLI** (PowerShell como Administrador): `winget install Microsoft.AzureCLI`. Reabrir PowerShell.
3. **Iniciar sesión:** `az login` y elegir **Azure for Students**.
4. **Cargar secretos en el Portal de Azure** (cuando el agente lo pida): Web App → Configuración → Variables de entorno. Agregar credenciales de base de datos, `API_KEY` y, si aplica, `OAUTH_*`. **No compartir contraseñas en chats de IA.**

---

## 🤖 Parte 2: Prompt Maestro para el Agente de IA

Copia y pega este bloque en tu agente, dentro del proyecto de Alojamientos:

```text
Quiero desplegar el backend de nuestro nodo de ALOJAMIENTOS (MS_ALO, hospedaje hotelero) en Azure App Service (Linux, Plan B1) y conectarlo al Event Bus CloudAMQP para integrarnos con Booking Prototipo (RDA2).

Ya tengo la sesión activa en Azure con 'az login' en la suscripción "Azure for Students".
Nombre propuesto para nuestra app en Azure: <NOMBRE_DE_TU_APP> (ejemplo: alojamientos-api o hospedaje-ms-alo).

CONTEXTO DEL ESTADO DEL PROYECTO:
- Booking central ya está desplegado en Azure y conectado a CloudAMQP; no hay que tocarlo.
- Nuestro servicio de Alojamientos todavía se está ajustando. El objetivo de esta tarea es dejar TODAS las partes funcionando por detrás (despliegue, health, catálogo, reservas, cancelación y notificación de stock) para que, en los próximos días, las pruebas de integración con Booking no encuentren problemas.
- El contrato del API es el archivo alojamientos-openapi-v2.yaml (v2.2.0) incluido en el proyecto. Es la fuente de verdad: NO cambies rutas, nombres de campo ni códigos de error del contrato. Si algo no coincide con el contrato, avísame en lugar de resolverlo por tu cuenta.

Sigue estrictamente estas directrices (aprendidas en Booking y RutaLibre):

1. RESTRICCIÓN DE REGIÓN EN AZURE FOR STUDENTS:
   - Usa 'brazilsouth' (Brasil Sur), la misma región que Booking Prototipo, para latencia mínima.
   - Registra el proveedor si falta: az provider register --namespace Microsoft.Web

2. CREACIÓN DE RECURSOS:
   - Grupo de recursos: rg-<NOMBRE_DE_TU_APP> (ubicación: brazilsouth).
   - Plan de App Service: plan-<NOMBRE_DE_TU_APP> --sku B1 --is-linux (el plan F1 no soporta Always On).
   - Web App: az webapp create --resource-group rg-<NOMBRE_DE_TU_APP> --plan plan-<NOMBRE_DE_TU_APP> --name <NOMBRE_DE_TU_APP> --runtime "NODE:22-lts"

3. AJUSTES DEL RUNTIME Y CONFIGURACIÓN:
   - Always On activo: az webapp config set --always-on true
   - Tiempo de arranque extendido: WEBSITES_CONTAINER_START_TIME_LIMIT=600
   - Sin builds en la nube (el paquete va precompilado):
     az webapp config appsettings set --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false ENABLE_ORYX_BUILD=false
   - La app debe escuchar en process.env.PORT || 8080 en 0.0.0.0.
   - Startup file: "node dist/main.js" (o el archivo de entrada compilado del proyecto).
   - Zona horaria de negocio: America/Guayaquil (UTC-5). Check-in digital desde las 14:00 de Guayaquil (regla del contrato). No uses la hora local del servidor de Azure (UTC) para estas reglas.

4. CONEXIÓN CON BOOKING Y CLOUDAMQP (variables de entorno de la app):
   - BOOKING_REST_STOCK_URL="https://booking-core-api.azurewebsites.net/api/v3/inventory/stock"
   - BOOKING_BASE_URL="https://booking-core-api.azurewebsites.net/api/v3"
   - RABBITMQ_URL="amqps://qkvqjvku:ATBxToI1JvR6YbRBIIAnATa5mnjdIqz_@shark.rmq.cloudamqp.com/qkvqjvku"
   - EVENT_BUS_MODE="rabbitmq"
   - NODE_ID="NODE_ALO_<SIGLAS>"
   - API_KEY=<definida en el Portal de Azure, no en el chat>
   Las credenciales de base de datos y cualquier secreto OAuth las cargo yo en el Portal de Azure; pídemelas cuando haga falta.

5. EMPAQUETADO Y DESPLIEGUE SEGURO (CRÍTICO EN WINDOWS):
   - NO uses 'Compress-Archive' de PowerShell (introduce '\' que rompen rutas en Linux).
   - Usa un script de Python con 'zipfile' que genere un zip con barras POSIX '/' e incluya:
     * La carpeta compilada ('dist/' o 'build/').
     * 'package.json' y 'package-lock.json'.
     * 'node_modules/' de producción ('npm prune --omit=dev').
     * El archivo alojamientos-openapi-v2.yaml.
   - Despliega: az webapp deploy --resource-group rg-<NOMBRE_DE_TU_APP> --name <NOMBRE_DE_TU_APP> --src-path <RUTA_DEL_ZIP> --type zip --async true

6. VERIFICACIÓN Y AUDITORÍA (todo debe responder bien antes de integrar):
   a) Health, HTTP 200 con status HEALTHY y semaforo GREEN:
      GET https://<NOMBRE_DE_TU_APP>.azurewebsites.net/api/v2/alojamientos/health
   b) Catálogo: GET .../alojamientos?ciudad=Quito&limit=5
   c) Búsqueda: POST .../alojamientos/search con ciudad, fechas (YYYY-MM-DD) y ocupantes.
   d) Cotización: POST .../alojamientos/availability (debe devolver cotizacionId y tarifaValidaHasta).
   e) Reserva: POST .../alojamientos/orders/create con cabecera Idempotency-Key (UUID v4) y X-Correlation-ID. Debe responder 201 con externalOrderId (ORD-HTL-...) en ≤ 3000 ms. Repetir con la MISMA clave debe devolver la misma respuesta con la cabecera Idempotent-Replayed: true.
   f) Sin stock: forzar una reserva sin habitaciones disponibles debe dar 409 con code OUT_OF_STOCK.
   g) Cancelación: POST .../alojamientos/orders/{externalOrderId}/cancel debe liberar el cupo y ser idempotente (200 con yaCancelada: true al repetir).
   h) Stock: tras (e) y (g), comprobar que se notificó el cambio de stock a Booking (una actualización POR CADA NOCHE de la estancia; ver Parte 4).
   i) Errores en formato application/problem+json con 'code' del enum del contrato.

7. ENTREGA FINAL:
   - Dame la URL pública y la Ficha de Integración rellenada (Parte 5 de la guía), sin incluir secretos.
   - Avísame de cualquier diferencia que encuentres entre el contrato y lo desplegado; no la corrijas sin avisarme.
```

---

## 📡 Parte 3: Contratos REST del nodo (resumen; el detalle está en el OpenAPI)

Base del contrato: `/api/v2` · Convenciones: dinero como string decimal (`"560.00"`), moneda `USD`, fechas `YYYY-MM-DD` (America/Guayaquil), campos de integración en `snake_case` y campos de dominio en `camelCase`.

| Función | Ruta | Notas |
| :--- | :--- | :--- |
| Health | `GET /alojamientos/health` | Público. `status` (HEALTHY/DEGRADED/DOWN), `semaforo`, `service`, `latency_ms`. `503` si el nodo está apagado. |
| Catálogo | `GET /alojamientos` | Paginado, `ETag`, `actualizadoDesde`. |
| Búsqueda | `POST /alojamientos/search` | Calcula `precioTotalEstancia`. No retiene inventario. |
| Cotización | `POST /alojamientos/availability` | Devuelve `cotizacionId`, precio congelado 30 min. |
| Reserva | `POST /alojamientos/orders/create` | Header `Idempotency-Key` obligatorio. `201` / `409 OUT_OF_STOCK` / `422` reglas de negocio. |
| Consulta | `GET /alojamientos/orders/{orderId}` | Acepta `orderId`, `externalOrderId` o `codigoReserva`. |
| Recuperación Saga | `GET /alojamientos/orders?saga_id=…` | Para saber si una reserva llegó a crearse tras un timeout. |
| Cancelación | `POST /alojamientos/orders/{orderId}/cancel` | Idempotente. Compensación Saga reembolsa 100 %. |

### Ejemplo de respuesta de Health

```json
{
  "status": "HEALTHY",
  "semaforo": "GREEN",
  "service": "MS_ALOJAMIENTOS",
  "version": "2.2.0",
  "latency_ms": 38,
  "uptime_seconds": 1250,
  "nodo_id": "NODE_ALO_<SIGLAS>",
  "vertical": "ALOJAMIENTOS",
  "timestamp": "2026-11-01T14:00:00.000Z"
}
```

`nodo_id` y `vertical` son campos **aditivos** (el contrato permite agregarlos sin cambiar de versión mayor); se añaden para alinearse con el formato de health que usa Booking.

---

## 🔄 Parte 4: Notificación de Stock a Booking

El stock de alojamientos es **por noche**:

- `item_id` = `<alojamientoId>:<tipoHabitacionCodigo>` (ej. `HTL-QUITO-001:SUITE_DELUXE`).
- **Una actualización por cada noche** de la estancia (`check-in … check-out − 1`). Una reserva de 4 noches genera **4** mensajes.
- Se emite al **reservar, cancelar, bloquear** una habitación y al cargar inventario.
- Los mensajes **no llevan datos personales** (LOPDP): solo identificadores de reserva y cifras de inventario.

### Opción A: Push HTTP REST (recomendada en Azure)

`POST https://booking-core-api.azurewebsites.net/api/v3/inventory/stock`

Headers: `Content-Type: application/json`, `X-API-Key: <TU_API_KEY_REGISTRADA>`

```json
{
  "item_id": "HTL-QUITO-001:SUITE_DELUXE",
  "available_units": 3,
  "date": "2026-11-02",
  "reason": "ORDER_CREATED"
}
```

### Opción B: Event Bus (CloudAMQP RabbitMQ)

- **Exchange:** `booking.events` (Topic, Durable) · **Routing key:** `stock.updated`

```json
{
  "service_id": "NODE_ALO_<SIGLAS>",
  "item_id": "HTL-QUITO-001:SUITE_DELUXE",
  "available_units": 3,
  "date": "2026-11-02"
}
```

---

## ⚠️ Checklist de Errores Comunes

| Error | Causa | Solución |
| :--- | :--- | :--- |
| `SkuNotAvailable` al crear VM | Azure for Students sin cupo de VMs | No usar VMs; App Service B1 Linux. |
| `sh: 1: nest: not found` | Oryx compila en la nube | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` y `ENABLE_ORYX_BUILD=false`; subir `dist/`. |
| `Cannot find module ...` | `Compress-Archive` usó `\` | Empaquetar con Python `zipfile`. |
| `502 Bad Gateway` en subida | `node_modules` con dependencias de desarrollo | `npm prune --omit=dev` antes de empaquetar. |
| `401 Unauthorized` | `X-API-Key` no coincide | Usar la clave acordada con Booking. |
| `422 CHECKIN_TIME_NOT_REACHED` fuera de hora | Servidor en UTC, no en Guayaquil | Calcular con la zona America/Guayaquil. |
| `409 PRICE_MISMATCH` | `totalPagar` no coincide con la cotización | Enviar el `cotizacionId` o recalcular con la fórmula del contrato. |

---

## 📬 Parte 5: Ficha Técnica para Enviar a Joselyn Cadena (Integración de Alojamientos)

Cuando el servicio esté desplegado y responda `200 OK` en el health, envíenle esta ficha a Joselyn Cadena para registrar formalmente su nodo y agregarlo al catálogo y al panel administrativo:

```text
📋 FICHA DE INTEGRACIÓN - TIENDA DE ALOJAMIENTOS
---------------------------------------------------------------
1. Nombre del sistema: <Nombre comercial>
2. Integrantes del equipo: <Nombres>
3. Código de nodo propuesto: NODE_ALO_<SIGLAS>
4. URL base de la API REST en Azure: https://<tu-app>.azurewebsites.net/api/v2
5. URL directa del Healthcheck: https://<tu-app>.azurewebsites.net/api/v2/alojamientos/health
6. X-API-Key de tu microservicio: <Tu clave secreta>
7. Endpoint de Búsqueda: POST /alojamientos/search
8. Endpoint de Reserva: POST /alojamientos/orders/create (Idempotency-Key obligatorio)
9. ¿Conectado a CloudAMQP de RabbitMQ?: [ SÍ / NO ]
10. Canal de stock usado: [ REST / AMQP ]
---------------------------------------------------------------
```
