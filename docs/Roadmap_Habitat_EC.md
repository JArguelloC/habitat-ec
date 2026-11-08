# 🌿 Roadmap Oficial del Proyecto: Hábitat EC

> **Proyecto Integrador de Sistemas:** Plataforma Transaccional de Hospedaje Sostenible, Eco-Lodges y Hoteles en Ecuador.  
> **Arquitectura:** Ecosistema distribuido y desacoplado (`NestJS 12 + PostgreSQL Neon + PostGIS + RabbitMQ CloudAMQP + 5FN` en Backend y `React 19 + TypeScript + Tailwind CSS` en Frontend SPA).  
> **Fecha de Actualización:** 08 de Noviembre de 2026.  
> **Estado del Proyecto:** ✅ **Reto 1 Completado al 100%** | 🔥 **Reto 2 en Ejecución Activa**.

---

## 📊 Estado Ejecutivo de Cumplimiento

```mermaid
flowchart LR
    R1["✅ RETO 1: Core Transaccional, Web SPA & Despliegue (COMPLETADO)"]
    R2["🔥 RETO 2: Integración B2B con Booking, Microservicios & EDA (FASE ACTIVA)"]
    R3["⏳ RETO 3: App Móvil (Flutter/React Native) & Resiliencia Final"]
    R1 --> R2 --> R3
    style R1 fill:#6E7A6E,stroke:#3E4A3E,stroke-width:2px,color:#FFFFFF
    style R2 fill:#CBB279,stroke:#8C733E,stroke-width:3px,color:#242523
    style R3 fill:#F9F8F5,stroke:#E7E4DC,stroke-width:1px,color:#73726E
```

| Componente del Sistema | Estado Actual | Reto 1 | Reto 2 (Fase Activa) |
| :--- | :---: | :---: | :---: |
| **Base de Datos Relacional (Neon PostgreSQL 16)** | Operativa | **100%** (5FN, PostGIS, GiST, Auditoría, Outbox) | Sincronización multi-esquema y particionamiento lógico |
| **Backend API REST & OpenAPI (NestJS 12)** | Desplegado en Azure | **100%** (48 Endpoints certificados, Swagger, RBAC) | Descomposición a Microservicios & Contrato v2.2.0 |
| **Frontend Web SPA (React 19 + Tailwind CSS)** | Operativo | **100%** (Paleta Oro/Lino, 10 Heurísticas, 3D Card) | Adaptación a Gateway y consumo de eventos |
| **Persistencia & Temporizador Hold (15:00 min)** | Concluido | **100%** (`localStorage`, resiliente a F5 y expiración) | Cotizaciones B2B de 30 min (`availability`) |
| **Pasarelas de Pago & Checkout Seguro** | Concluido | **100%** (Payphone EC, Stripe, Transferencias Ecuador) | Saga compensatoria distribuida con Booking |
| **Event Bus & Mensajería B2B (RabbitMQ CloudAMQP)** | En Integración | **100%** (Transactional Outbox base) | Tópicos de eventos, sincronización de stock y DLQ |
| **Contenerización y DevOps (Docker + CI/CD)** | Operativo | **100%** (GitHub Actions verde, 0 errores ESLint) | Despliegue en Azure App Service Linux B1 |

---

## 🎯 Reto 1: Resumen de Cierre y Certificación (100% COMPLETADO)

El **Reto 1 (Semanas 1 a 6)** culminó exitosamente con la entrega de una solución transaccional completa, robusta y verificada:

### 1. Base de Datos en Quinta Forma Normal (5FN) & PostGIS
- Modelo en 5FN para resolver dependencias de unión entre alojamientos, canales de integración y políticas de cancelación (`vw_contratos_5fn_validos`).
- Georreferenciación con PostGIS para búsquedas espaciales de eco-lodges por coordenadas en Ecuador.
- Índices `btree_gist` para exclusión de rangos de fechas, garantizando cero sobreventa concurrente en cuartos y cabañas.
- Registro inmutable de mutaciones mediante triggers DML en `auditoria_forense_legal`.

### 2. Backend NestJS 12 Certificado
- 48 endpoints probados y certificados con 100% PASS documentados en Swagger/OpenAPI.
- Autenticación Google OAuth 2.0 y JWT con RBAC (`CLIENTE`, `ADMIN`, `SUPERADMIN`, `PARTNER_B2B`).
- Módulo de órdenes con *Hold* pesimista de inventario de 15 minutos e idempotencia transaccional.
- Adaptador financiero híbrido (Payphone Ecuador, Stripe y soporte de Cuentas Bancarias / Transferencias locales).

### 3. Frontend Web SPA de Alta Usabilidad (React 19 + TypeScript + Tailwind CSS)
- **Paleta Oficial "Oro Campestre & Lino":** Fondo `#F9F8F5`, Texto `#242523`, Primario `#CBB279`, Secundario `#6E7A6E`, Acento `#8C733E`.
- **Marketplace (`/`):** Buscador interactivo con datepickers nativos validados (Check-in $\ge$ hoy, Check-out $>$ Check-in).
- **Detalle de Alojamiento (`/alojamientos/:id`):** Mosaico responsivo de imágenes 16:9 y 4:3, selector dinámico de habitaciones con inventario numérico y cotización sticky.
- **Checkout Seguro (`/checkout`):**
  - Temporizador de 15 minutos persistente en `localStorage` (inmune a F5 y con detección de expiración en segundo plano).
  - Validación de expiración de tarjeta contra fecha actual (`new Date()`).
  - Tarjeta de crédito interactiva en 3D con animación de volteo automático para CVV y detección de franquicias (Visa, Mastercard, Amex).
  - Desglose contable ecuatoriano con IVA 15% y soporte para transferencias directas con subida de comprobantes.
- **Admin Dashboard (`/admin`):** KPIs, estadísticas de anfitrión, liquidaciones 85% neto y Wizard de publicación en 4 pasos sin retención de estado (*stale state* resuelto).
- **Control de Calidad:** 0 errores de ESLint (`npm run lint`), compilación limpia (`npm run build`) y pipeline CI/CD de GitHub Actions en verde.

### 4. Despliegue en la Nube
- Backend desplegado en Azure App Service: `habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net`.
- Base de datos operativa en Neon PostgreSQL Serverless con backups automatizados.

---

## 🔥 RETO 2: Integración B2B, Microservicios y EDA (Semanas 7 a 11)

### 🎯 Propósito del Reto
Evolucionar la arquitectura de **Hábitat EC** desde un backend monolítico modular hacia un **ecosistema de microservicios desacoplados**, integrándose activamente como nodo socio de alojamientos (**`MS_ALO`**) con la plataforma central **Booking Prototipo**.

---

### 🏛️ Arquitectura Objetivo del Reto 2

```mermaid
flowchart TD
    subgraph Central ["Ecosistema Central Booking Prototipo"]
        BookingCore["Booking Prototipo Core API<br/>(Azure App Service)"]
        CloudAMQP["Clúster CloudAMQP<br/>(RabbitMQ Event Bus)"]
    end

    subgraph Perimetro ["Perímetro Hábitat EC (MS_ALO)"]
        APIGW["API Gateway / Reverse Proxy<br/>(Rate Limiting, CORS, Auth Guard)"]
    end

    subgraph Microservicios ["Servicios Desacoplados Hábitat EC"]
        MS_Catalog["Microservicio de Catálogo y Alojamientos<br/>(Propiedades, Habitaciones, Reglas)"]
        MS_Orders["Microservicio de Reservas & Hold de Stock<br/>(Saga Orquestada, 15/30 min Hold)"]
        MS_Payments["Microservicio de Pagos & Liquidaciones<br/>(Payphone, Transferencias, Comisiones)"]
        WorkerOutbox["Worker Asíncrono de Eventos<br/>(Transactional Outbox Runner)"]
    end

    subgraph Storage ["Persistencia"]
        DB_Neon[(PostgreSQL Neon 16<br/>5FN + PostGIS + Outbox)]
    end

    BookingCore <-->|"REST / OpenAPI v2.2.0<br/>(Search, Availability, Orders)"| APIGW
    APIGW --> MS_Catalog
    APIGW --> MS_Orders
    APIGW --> MS_Payments

    MS_Catalog --> DB_Neon
    MS_Orders --> DB_Neon
    MS_Payments --> DB_Neon
    WorkerOutbox <--> DB_Neon

    WorkerOutbox -->|"Eventos de Stock & Reservas<br/>(amqps://...)"| CloudAMQP
    CloudAMQP -->|"Notificaciones de Inventario"| BookingCore
```

---

### 📋 Desglose de Tareas Técnicas por Semanas

### Semana 7: Esquemas, Compatibilidad y Gestión de Contratos B2B
- [ ] **Alineación con el Contrato `alojamientos-openapi-v2.yaml` (v2.2.0):**
  - [ ] Implementar endpoint de salud y telemetría: `GET /api/v2/alojamientos/health` (semáforo `GREEN`/`YELLOW`/`RED`, tiempo de respuesta $< 1$ s).
  - [ ] Implementar búsqueda B2B: `GET /api/v2/alojamientos` y `POST /api/v2/alojamientos/search` (propiedades, estrellas, ciudad y tarifa total de la estancia).
  - [ ] Implementar disponibilidad y cotización congelada: `POST /api/v2/alojamientos/availability` (genera `cotizacionId` con validez de 30 minutos).
  - [ ] Implementar creación de reservas B2B: `POST /api/v2/alojamientos/orders/create` (idempotente mediante `Idempotency-Key`, SLA $\le 3000$ ms).
  - [ ] Implementar cancelación compensatoria: `POST /api/v2/alojamientos/orders/{orderId}/cancel` (idempotente con reversión de inventario).
- [ ] **Validación de Esquemas:** Control de versiones en DTOs con compatibilidad hacia atrás garantizada.

### Semana 8: API Gateway, BFF y Migración a Microservicios
- [ ] **Descomposición en Microservicios:**
  - [ ] Separación del Servicio de Catálogo de Alojamientos (`MS_CAT`).
  - [ ] Separación del Servicio de Reservas y Bloqueo de Stock (`MS_RES`).
  - [ ] Separación del Servicio Financiero y Liquidaciones (`MS_FIN`).
- [ ] **API Gateway Unificado:**
  - [ ] Punto único de entrada perimetral para el tráfico de clientes Web y del Booking central.
  - [ ] Enrutamiento dinámico, políticas de CORS restrictivas y protección ante abusos (Rate Limiting por IP y Token).
  - [ ] Enriquecimiento de cabeceras de contexto (`X-Correlation-Id`, `X-Forwarded-For`).

### Semana 9: Arquitectura Orientada a Eventos (EDA) con RabbitMQ (CloudAMQP)
- [ ] **Conexión al Event Bus Central:**
  - [ ] Configurar cliente AMQP (`amqplib`) conectado a la URL oficial de CloudAMQP:  
    `amqps://qkvqjvku:ATBxToI1JvR6YbRBIIAnATa5mnjdIqz_@shark.rmq.cloudamqp.com/qkvqjvku`.
  - [ ] Habilitar selector de modo de mensajería mediante variable de entorno `EVENT_BUS_MODE="rabbitmq"`.
  - [ ] Registrar identificación del nodo de Hábitat EC: `NODE_ID="NODE_ALO_HABITAT_EC"`.
- [ ] **Sincronización Automática de Stock hacia Booking:**
  - [ ] Publicar eventos en el bus ante cada reserva, cancelación, bloqueo temporal o ajuste de cuartos.
  - [ ] Soporte de sincronización REST de respaldo hacia `BOOKING_REST_STOCK_URL` (`https://booking-core-api.azurewebsites.net/api/v3/inventory/stock`).
- [ ] **Patrón Transactional Outbox Automatizado:**
  - [ ] Worker en segundo plano (daemon o cron job) que procese la tabla `outbox_events` de forma continua.
  - [ ] Mecanismo de reintentos exponenciales y cola de mensajes no procesados (Dead Letter Queue - DLQ).

### Semana 10: Observabilidad, Métricas y Trazabilidad Distribuida
- [ ] **Trazabilidad Distribuida:**
  - [ ] Propagación transversal del encabezado `X-Correlation-Id` en todas las peticiones síncronas y eventos asíncronos.
  - [ ] Logs estructurados en formato JSON con marcas de tiempo ISO-8601, correlación y duración de ejecución.
- [ ] **Métricas y Monitoreo de Rendimiento:**
  - [ ] Medición de latencia de endpoints críticos (SLA de cotización y reservas $< 3000$ ms).
  - [ ] Alertas automatizadas ante tasa de errores HTTP 5xx o fallos en el bus de RabbitMQ.
  - [ ] Endpoint `/health` reportando estado de conexión a PostgreSQL Neon y RabbitMQ.

### Semana 11: Seguridad en Integraciones B2B y Despliegue en Azure
- [ ] **Autenticación y Autorización Híbrida B2B:**
  - [ ] Cabecera de autenticación por API Key (`X-API-Key`) para integración rápida con Booking.
  - [ ] Soporte de credenciales de cliente (`OAuth2ClientCredentials`) con validación de scopes `alojamientos:*`.
  - [ ] Validación de firmas de mensajes mediante `HMAC-SHA256` en el Worker Outbox.
- [ ] **Despliegue de Producción en Azure App Service:**
  - [ ] Región de despliegue de baja latencia: `brazilsouth` (misma región que Booking Prototipo).
  - [ ] Plan de App Service: `plan-habitat-ec` (Plan B1 Linux, con *Always On* activado).
  - [ ] Runtime: `NODE:22-lts` con comando de arranque `node dist/main.js`.
  - [ ] Zona horaria de negocio configurada: `TZ="America/Guayaquil"` (UTC-5) para validación de Check-in digital (14:00).
  - [ ] Empaquetado seguro con script Python `zipfile` para garantizar rutas compatibles con Linux.

---

## 📦 Matriz de Entregables Oficiales del Reto 2

| # | Entregable Oficial | Criterio de Aceptación / Verificación |
| :-: | :--- | :--- |
| **1** | **Arquitectura de Microservicios Operativa** | Desacoplamiento funcional entre Catálogo, Reservas y Pagos. |
| **2** | **Integración B2B con Booking Prototipo** | Comunicación bidireccional exitosa contra la API central de Booking. |
| **3** | **Conexión a CloudAMQP (RabbitMQ)** | Publicación de eventos de stock y reservas en el bus central. |
| **4** | **Contrato OpenAPI v2.2.0 Implementado** | Rutas `/health`, `/search`, `/availability`, `/orders/create` y `/cancel` 100% conformes. |
| **5** | **API Gateway Configurado** | Enrutamiento centralizado, rate limiting y protección perimetral. |
| **6** | **Despliegue Activo en Azure App Service** | Web App accesible públicamente en `brazilsouth` con *Always On*. |
| **7** | **Seguridad en Integraciones** | API Keys validadas, scopes OAuth2 y firmas HMAC en eventos. |
| **8** | **Trazabilidad & Observabilidad** | `X-Correlation-Id` en logs estructurados y semáforo `/health` en verde. |
| **9** | **Documento Técnico Actualizado** | Diagramas de arquitectura C4, flujos Saga y evidencias de pruebas. |

---

## 📱 Fase 3: Reto 3 - Experiencia Móvil y Resiliencia Final (Semanas 12 a 16)

- [ ] **Aplicación Móvil para Huéspedes:** Desarrollo del frontend móvil nativo en **Flutter** o **React Native** (según asignación académica).
- [ ] **Modo Offline & Caché Local:** Visualización y validación de vouchers PNR sin conexión a Internet para zonas rurales de Ecuador.
- [ ] **Pruebas de Caos & Resiliencia:** Circuit Breakers (Resilience4j / Opossum), tolerancia a fallos del bus y mitigación de latencia.
- [ ] **Defensa Final del Ecosistema:** Demostración en vivo del flujo completo de reserva entre Hábitat EC, Booking Prototipo y la App Móvil.
