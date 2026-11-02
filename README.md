# Hábitat-EC 🌿🇪🇨
> **Plataforma Integral de Hospitalidad Sostenible, Ecoturismo y Gestión Hotelera en Ecuador**  
> *Proyecto Integrador de Sistemas — Nodo Microservicio Proveedor de Alojamientos (`MS_ALOJAMIENTOS`)*

[![CI/CD Pipeline](https://github.com/JArguelloC/habitat-ec/actions/workflows/ci.yml/badge.svg)](https://github.com/JArguelloC/habitat-ec/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20PostGIS-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 1. Contexto y Visión del Proyecto

**Hábitat-EC** es una solución tecnológica completa diseñada para impulsar y formalizar la hospitalidad ecológica en el Ecuador (Amazonía, Andes, Costa y Galápagos). Resuelve la dispersión de alojamientos verdes, la falta de trazabilidad en reservas y la necesidad de interoperabilidad con plataformas agregadoras mayoristas (como el Booking Prototipo central).

### Capacidades Nucleares
* **Modelo Relacional Riguroso (5FN):** Base de datos normalizada hasta la **Quinta Forma Normal (5FN)** con garantía matemática de *Lossless Join* para la gobernanza estricta entre Alojamientos, Canales de Integración y Políticas de Cancelación.
* **Control de Concurrencia y Stock Numérico:** Descuento atómico de cupos de habitación mediante bloqueos distribuidos en **Redis (`SET NX PX`)** y transacciones ACID en PostgreSQL, previniendo sobreventas (*overbooking*).
* **Idempotencia Transaccional:** Procesamiento seguro de pagos y órdenes utilizando cabeceras `Idempotency-Key` (UUID v4) con deduplicación y respuesta en caché.
* **Seguridad y Control de Acceso (RBAC):** Autenticación híbrida con **Google OAuth2** y credenciales locales protegidas por **Bcrypt**, acompañada de control de acceso basado en roles (`SUPERADMIN`, `ADMIN`, `CLIENTE`).
* **Arquitectura Orientada a Eventos (EDA):** Patrón **Transactional Outbox** que garantiza entrega *At-Least-Once* de eventos de dominio y suscripciones **Webhooks B2B** firmadas digitalmente con **HMAC-SHA256**.
* **Integración B2B con Plataforma Booking (Reto 2):** Preparado para operar como nodo socio (`NODE_ALO_HABITAT_EC`) proveyendo endpoints bajo el contrato OpenAPI `/api/v2` y publicando actualizaciones de inventario por noche vía **CloudAMQP (RabbitMQ)**.

---

## 2. Arquitectura del Sistema

El sistema implementa una arquitectura desacoplada y modular con capacidad de despliegue unificado o distribuido:

```
                                  ┌───────────────────────────────┐
                                  │      CLIENTES & ANFITRIONES    │
                                  │   Navegador Web / Mobile SPA   │
                                  └───────────────┬───────────────┘
                                                  │ HTTPS
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │              HÁBITAT-EC (AZURE APP SERVICE)             │
                     │                                                         │
                     │   ┌─────────────────────────────────────────────────┐   │
                     │   │     Frontend SPA (React 19 + TailwindCSS)       │   │
                     │   └────────────────────────┬────────────────────────┘   │
                     │                            │ REST API                   │
                     │   ┌────────────────────────▼────────────────────────┐   │
                     │   │       Backend Gateway (NestJS 10 Framework)     │   │
                     │   │   - JWT Auth & Google OAuth2 Guard              │   │
                     │   │   - RBAC & Scope Interceptors                   │   │
                     │   │   - Global Exception Filter & ValidationPipe    │   │
                     │   └────────────┬────────────────────────┬───────────┘   │
                     └────────────────┼────────────────────────┼───────────────┘
                                      │                        │
                    ACID Transactions │                        │ Caching & DistLocks
                                      ▼                        ▼
                      ┌────────────────────────┐      ┌────────────────────────┐
                      │    PostgreSQL 16 DB    │      │     Redis 7 Cache      │
                      │  - PostGIS Coordenadas │      │  - Redlock Distributed │
                      │  - 5FN Lossless Views  │      │  - Token Blacklist     │
                      │  - Audit Triggers DML  │      │  - Idempotency Cache   │
                      │  - Outbox Events Table │      └────────────────────────┘
                      └───────────────┬────────┘
                                      │
                         Event Bus    │ (Transactional Outbox Poller)
                                      ▼
                      ┌────────────────────────────────────────┐
                      │    SISTEMAS EXTERNOS & ASOCIADOS       │
                      │  - Webhooks B2B (HMAC-SHA256)          │
                      │  - CloudAMQP / RabbitMQ (Booking Core) │
                      │  - Payphone Ecuador / Stripe API       │
                      └────────────────────────────────────────┘
```

---

## 3. Módulos y Dominio Funcional

El backend se organiza en **6 módulos de dominio** que exponen **48 APIs REST certificadas**:

| Módulo | Descripción Técnica | Endpoints Clave |
| :--- | :--- | :--- |
| **`auth` & `usuarios`** | Gestión de identidad, sesiones JWT, OAuth2 con Google, registro de huellas de dispositivos (*fingerprint*) y aprovisionamiento exclusivo de administradores. | `POST /auth/login`<br>`POST /auth/google`<br>`POST /superadmin/crear-admin`<br>`GET /usuarios/perfil` |
| **`catalogos`** | Catálogos maestros geográficos (PostGIS), tipologías ecológicas, facilidades sostenibles, reglas comunitarias y la matriz proyectiva en **Quinta Forma Normal (5FN)** (`canal_politicas`). | `GET /catalogos/geografia`<br>`GET /catalogos/ciudades`<br>`GET /catalogos/matriz-5fn`<br>`POST /catalogos/canal-politicas` |
| **`alojamientos`** | Catálogo público y panel anfitrión para registro de cabañas, galerías fotográficas, productos de habitaciones y contratos multi-canal. | `GET /alojamientos/search`<br>`GET /alojamientos/:id`<br>`POST /admin/alojamientos`<br>`POST /alojamientos/:id/productos-habitacion` |
| **`ordenes`** | Motor transaccional de reservas, cotización previa, asignación de PNR (`ORD-HTL-XXXXXXXX`), control de bloqueos en Redis y compensación para orquestaciones Saga. | `POST /ordenes/cotizar`<br>`POST /ordenes/crear`<br>`GET /ordenes/mis-reservas`<br>`POST /ordenes/:id/cancelar` |
| **`finanzas-resenas`** | Procesamiento de cobros idempotentes (Payphone/Stripe), libro mayor de liquidaciones anfitrión y motor de reseñas con cálculo ponderado de satisfacción. | `POST /pagos/procesar-cobro`<br>`GET /pagos/liquidaciones`<br>`POST /resenas`<br>`GET /resenas/alojamiento/:id` |
| **`integracion-auditoria`** | Bitácora forense capturada mediante triggers de base de datos, Transactional Outbox para arquitectura EDA y suscripciones a Webhooks firmadas con HMAC. | `GET /auditoria/forense`<br>`GET /auditoria/outbox`<br>`POST /auditoria/outbox/despachar`<br>`POST /webhooks/subscribe` |

---

## 4. Stack Tecnológico

### Backend
* **Runtime:** Node.js v22 LTS
* **Framework:** NestJS 10 con arquitectura modular y TypeScript 5.9
* **ORM & Database:** TypeORM con PostgreSQL 16 y extensión PostGIS
* **In-Memory Store:** Redis 7 (distlocks `SET NX PX`, caché de consultas e idempotencia)
* **Validación & Docs:** `class-validator`, `class-transformer`, Swagger / OpenAPI v3

### Frontend
* **Core:** React 19 con TypeScript
* **Bundler & Tooling:** Vite 8
* **Estilos:** TailwindCSS v4 con paleta personalizada (*Forest Green, Earth Brown, Gold Accent*)
* **Iconografía:** Lucide React
* **Resiliencia:** Error Boundary personalizado y adaptadores de datos defensivos

### DevOps & Despliegue
* **Contenedor:** Dockerfile Multi-stage (compilación frontend + runtime backend unificado)
* **CI/CD:** GitHub Actions (verificación estricta de TypeScript, linter, tests y build)
* **Hosting de Producción:** Azure App Service Linux (Plan B1 / F1 en `brazilsouth`)

---

## 5. Guía de Instalación y Ejecución Local

### Prerrequisitos
* Node.js v22 o superior y `npm`
* Docker y Docker Compose (opcional para levantar Postgres y Redis en 1 comando)
* PostgreSQL 16 y Redis 7 activos

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/JArguelloC/habitat-ec.git
cd habitat-ec
```

### Paso 2: Configuración de Variables de Entorno
Crear el archivo `.env` en la raíz (o copiar desde `.env.example`):
```env
# Servidor
NODE_ENV=development
PORT=3000

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=habitat_db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/habitat_db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Seguridad y Autenticación
JWT_SECRET=super_secret_jwt_key_habitat_ec_2026_dev
JWT_EXPIRES_IN=24h

# Google OAuth2
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Pasarelas de Pago
PAYPHONE_TOKEN=tu_token_sandbox_payphone
STRIPE_SECRET_KEY=sk_test_tu_clave_stripe
```

### Paso 3: Levantar Servicios de Infraestructura (Docker)
```bash
docker compose up -d
```

### Paso 4: Instalar Dependencias y Compilar Backend
```bash
cd backend
npm install
npm run build
npm run start:dev
```
* Swagger UI disponible en: `http://localhost:3000/api/docs`

### Paso 5: Instalar Dependencias y Levantar Frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```
* Aplicación web disponible en: `http://localhost:5173`

---

## 6. Credenciales de Prueba Preconfiguradas

Para evaluar las diferentes áreas del sistema, se dispone de usuarios de prueba en cada rol RBAC:

| Rol | Correo Electrónico | Contraseña | Vistas y Accesos |
| :--- | :--- | :--- | :--- |
| **SUPERADMIN** | `superadmin@habitat-ec.gob.ec` | `SuperAdmin2026*` | Consola Maestra (`/superadmin`): Gobernanza, Creación de ADMINs, 5FN, Auditoría Forense y Outbox. |
| **ADMIN (Anfitrión)** | `anfitrion@mindo-ecolodge.com` | `Anfitrion2026*` | Panel Anfitrión (`/admin`): Publicación de hospedajes, gestión de habitaciones y liquidaciones financieras. |
| **CLIENTE** | `cliente@turista-ecuador.com` | `Cliente2026*` | Marketplace (`/`), Detalle de Propiedad (`/alojamientos/:id`), Checkout (`/checkout`) y Mis Reservas (`/mis-reservas`). |

---

## 7. Integración con Booking Prototipo (Reto 2)

Hábitat-EC está homologado como **Socio Proveedor (`MS_ALOJAMIENTOS`)** ante la plataforma integradora central de la asignatura:

1. **Vía Síncrona (REST v2):**
   * Contrato estricto OpenAPI v2.2.0 bajo el prefijo `/api/v2/alojamientos/...`.
   * Endpoint de monitoreo de disponibilidad semafórico: `GET /api/v2/alojamientos/health` ($< 500\text{ ms}$).
   * Creación idempotente de órdenes de alojamiento (`POST .../orders/create`) con compensación Saga (`POST .../orders/{id}/cancel`).
2. **Vía Asíncrona (Inventario por Noche):**
   * Difusión de eventos de stock afectado por cada fecha de la estadía mediante **CloudAMQP (RabbitMQ)** en el Exchange `booking.events` con Routing Key `stock.updated`.
3. **Despliegue Azure:**
   * Configurado para ejecución en Azure App Service Linux (Node 22 LTS) en la región `brazilsouth` para minimizar latencia con el clúster Booking.

---

## 8. Licencia y Créditos

* **Autor:** James Arguello (`JArguelloC`)
* **Asignatura:** Integración de Sistemas
* **Institución:** Pontificia Universidad Católica del Ecuador (PUCE)
* **Licencia:** MIT License
