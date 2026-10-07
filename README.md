# Hábitat EC — Plataforma de Gestión y Reserva de Alojamientos Sostenibles

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%2B%20%7C%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%20Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TypeORM](https://img.shields.io/badge/ORM-TypeORM-FE0803?style=flat-square&logo=typeorm&logoColor=white)](https://typeorm.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Neon-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OpenAPI](https://img.shields.io/badge/Contract-OpenAPI%203.0.3-85EA2D?style=flat-square&logo=openapiinitiative&logoColor=black)](https://swagger.io/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

---

## 1. Descripción del Proyecto y Arquitectura

**Hábitat EC** es una plataforma tecnológica integral orientada a la digitalización, búsqueda, cotización, reserva y publicación de alojamientos ecológicos y patrimoniales en las cuatro regiones naturales del Ecuador (Sierra, Costa, Amazonía y Galápagos).

El sistema está concebido bajo una **arquitectura desacoplada (Headless / API-First)** dividida en dos capas independientes:
1. **Núcleo de Servicios Backend:** Desarrollado sobre **NestJS** en modo estricto modular, implementando **TypeORM** para persistencia relacional sobre **PostgreSQL (Neon Cloud)**, validación declarativa con `class-validator` y `class-transformer`, seguridad mediante **JWT**, y documentación viva OpenAPI 3.0.3.
2. **Cliente Web Frontend:** SPA de alto rendimiento construida con **React**, **Vite**, **TypeScript**, **TanStack Router**, **Tailwind CSS** y componentes accesibles basados en **Radix UI** y **Lucide Icons**.

```
┌────────────────────────────────────────────────────────┐
│                   HÁBITAT EC CLIENT                    │
│      React + Vite + TanStack Router + Tailwind CSS     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP/REST (JSON)
                           │ Bearer JWT + Idempotency-Key
                           ▼
┌────────────────────────────────────────────────────────┐
│                   HÁBITAT EC BACKEND                   │
│          NestJS 12 Core Architecture (Modular)         │
│  ┌──────────────┬───────────────┬───────────────────┐  │
│  │ /auth (JWT)  │ /alojamientos │ /orders (Checkout)│  │
│  └──────┬───────┴───────┬───────┴───────────┬───────┘  │
│         └───────────────┼───────────────────┘          │
│                         ▼                              │
│              TypeORM Enterprise Layer                  │
└─────────────────────────┬──────────────────────────────┘
                          │ SSL Pool Connection
                          ▼
┌────────────────────────────────────────────────────────┐
│            POSTGRESQL (Neon Serverless / Cloud)        │
│          Esquema Relacional Normalizado                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

### Backend (Servicios de Integración)
- **Framework:** NestJS 12 (Node.js runtime LTS 20+).
- **Lenguaje:** TypeScript 5.8+ en modo estricto (`strict: true`, `noImplicitAny`).
- **Persistencia:** TypeORM 1.1 con drivers nativos de `pg` y soporte SSL automatizado.
- **Base de Datos:** PostgreSQL 16 (Neon Cloud Serverless Database).
- **Seguridad & Autenticación:** Passport JWT, Bcrypt para cifrado hash de contraseñas.
- **Validación & Sanitización:** `ValidationPipe` global con `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- **Contratos & Especificaciones:** OpenAPI 3.0.3 viva vía Swagger UI.
- **Control de Calidad:** Oxlint (`--type-aware`) y Vitest (Testing Engine de ultra alta velocidad).

### Frontend (Experiencia de Usuario)
- **Librería Base:** React 19 / 18 con Vite como bundler ultrarrápido.
- **Enrutamiento:** TanStack Router con carga declarativa y tipado de rutas en tiempo de compilación.
- **Estilos:** Tailwind CSS 4 con utilidades dinámicas y diseño adaptativo (*Mobile-First*).
- **Componentes Accesibles:** Radix UI Primitives (Diálogos modales, menús flotantes, acordeones).
- **Iconografía & Notificaciones:** Lucide React y Sonner (Toasts no intrusivos).

### CI/CD e Infraestructura Cloud
- **Integración Continua:** GitHub Actions con contenedor de base de datos efímero (`postgres:16-alpine`), validación de linter Oxlint, comprobación estricta de tipos (`tsc --noEmit`) y pruebas unitarias/E2E.
- **Despliegue Productivo:** 
  - Backend Web Service en **Render** (Node.js Environment con `process.env.PORT` dinámico).
  - Frontend Static Site en **Render / Vercel** con variables de entorno de producción.

---

## 3. Instalación y Configuración Local

### Prerrequisitos
- **Node.js:** Versión `>= 20.10.0` instalada.
- **npm:** Versión `>= 10.0.0`.
- **PostgreSQL:** Instancia local activa (puerto 5432) o una base de datos gestionada en la nube (ej. **Neon.tech**).

### 3.1. Clonado del Repositorio
```bash
git clone https://github.com/James-Arguello/habitat-ec.git
cd habitat-ec
```

### 3.2. Configuración de Variables de Entorno

#### Backend (`.env` en la raíz del proyecto):
Copie la plantilla `.env.example` y configure las credenciales correspondientes:
```bash
cp .env.example .env
```
Contenido de `.env`:
```env
# Entorno y Puerto de Escucha
PORT=3000
NODE_ENV=development

# Conexión a Base de Datos PostgreSQL
# Local: postgresql://postgres:postgres@localhost:5432/habitat_db
# Cloud (Neon): postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/habitat_db

# Clave Secreta para Tokens JWT
JWT_SECRET=habitat_ec_secret_jwt_key_2026_super_secure
```

#### Frontend (`client/.env` en el directorio cliente):
Copie la plantilla de variables del cliente:
```bash
cp client/.env.example client/.env
```
Contenido de `client/.env`:
```env
# URL de consumo de la API de NestJS
VITE_API_URL=http://localhost:3000
```

---

### 3.3. Instalación de Dependencias

Instale las dependencias de ambas aplicaciones:

```bash
# Dependencias del Backend
npm install

# Dependencias del Frontend
cd client
npm install
cd ..
```

---

### 3.4. Semillero de Datos Inicial (Seed)

La base de datos cuenta con un servicio de sembrado inteligente (`AlojamientosSeederService`). Al levantar el backend por primera vez, el sistema detecta si la tabla de alojamientos se encuentra vacía e inserta automáticamente los 6 alojamientos ecológicos emblemáticos de Ecuador con sus respectivas tarifas, capacidades y ubicaciones geográficas.

---

### 3.5. Ejecución en Entorno de Desarrollo

Para ejecutar ambas aplicaciones simultáneamente en desarrollo, abra dos terminales:

**Terminal 1 (Backend NestJS):**
```bash
npm run start:dev
```
*El servidor iniciará en `http://localhost:3000`.*

**Terminal 2 (Frontend React + Vite):**
```bash
cd client
npm run dev
```
*La aplicación web estará disponible en `http://localhost:5173` (o el puerto asignado por Vite).*

---

## 4. Endpoints Principales y Documentación API

La especificación completa del contrato OpenAPI se encuentra documentada e interactiva a través de **Swagger UI**:
- **Swagger UI:** [http://localhost:3000/api](http://localhost:3000/api) (o alternativamente `/swagger`).
- **Especificación YAML:** Disponible en el repositorio en `contracts/alojamientos-openapi.yaml`.

### Resumen de Módulos Expuestos

| Módulo | Método | Endpoint | Descripción | Encabezados / Seguridad |
| :--- | :---: | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/register` | Registro de usuarios (`CLIENTE` o `PROPIETARIO`). | Público |
| **Auth** | `POST` | `/auth/login` | Inicio de sesión y emisión de token Bearer JWT. | Público |
| **Alojamientos** | `GET` | `/alojamientos` | Listado completo de alojamientos disponibles. | Público |
| **Alojamientos** | `GET` | `/alojamientos/:id` | Detalle de alojamiento con enlaces **HATEOAS** (`_links`). | Público |
| **Alojamientos** | `POST` | `/alojamientos` | Creación de propiedad (Retorna `201` + `Location`). | `Authorization: Bearer <token>` |
| **Alojamientos** | `PUT` | `/alojamientos/:id` | Actualización de propiedad (Retorna `204 No Content`). | `Authorization: Bearer <token>` |
| **Alojamientos** | `DELETE` | `/alojamientos/:id` | Eliminación de propiedad (Retorna `204 No Content`). | `Authorization: Bearer <token>` |
| **Búsqueda** | `POST` | `/search` | Búsqueda filtrada por fechas, ciudad, huéspedes y moneda. | `X-Device-Fingerprint` (Obligatorio) |
| **Órdenes** | `POST` | `/orders/preview` | Generación de cotización previa con tiempo de expiración. | `Authorization: Bearer <token>` |
| **Órdenes** | `POST` | `/orders/create` | Creación de reserva / Confirmación de orden de compra. | `Idempotency-Key` (UUIDv4) + JWT |
| **Órdenes** | `GET` | `/orders/:orderId` | Consulta de estado de orden y código localizador (PNR). | `Authorization: Bearer <token>` |

---

## 5. Flujos de Interacción y Roles de Usuario

El sistema contempla dos perfiles principales con privilegios diferenciados:

```mermaid
flowchart TD
    subgraph Viajero ["Rol: CLIENTE (Viajero)"]
        A1[Explorar Catálogo] --> A2[Filtrar por Destino y Tipo]
        A2 --> A3[Seleccionar Fechas y Huéspedes]
        A3 --> A4[Cotización Dinámica en Tiempo Real]
        A4 --> A5[Checkout Seguro con Tarjeta/Transferencia]
        A5 --> A6[Confirmación Inmediata con Código PNR]
    end

    subgraph Anfitrion ["Rol: PROPIETARIO (Anfitrión)"]
        B1[Iniciar Sesión como Anfitrión] --> B2[Acceder al Panel de Gestión]
        B2 --> B3[Crear Nuevo Alojamiento Sostenible]
        B3 --> B4[Modificar Tarifas por Noche y Capacidad]
        B4 --> B5[Visualizar Métricas de Ocupación]
    end
```

### 5.1. Flujo del Viajero (`CLIENTE`)
1. **Descubrimiento y Catálogo:** El usuario visualiza la oferta de eco-lodges y cabañas organizadas por regiones y categorías (Cabañas de Montaña, Eco-Lodges, Hoteles Boutique, Hostales).
2. **Filtrado Reactivo:** Búsqueda en tiempo real por destino geográfico (Quito, Mindo, Galápagos, Cuenca, Tena, Montañita), fechas de estancia y número de ocupantes.
3. **Cotización & Checkout Idempotente:** Cálculo transparente de costos (tarifa base, impuestos, tarifa de servicio ecológico). Al confirmar la reserva, el sistema genera una clave de idempotencia (`UUIDv4`) para proteger la transacción de cobros duplicados en caso de reconexión.
4. **Reserva Confirmada:** Emisión de un código localizador (PNR) respaldado en la base de datos relacional.

### 5.2. Flujo del Anfitrión (`PROPIETARIO`)
1. **Acceso al Panel Administrativo:** Autenticación protegida con rol `PROPIETARIO` para ingresar a la vista de administración (`/admin`).
2. **Publicación y Edición de Alojamientos:** Formulario validado para registrar nuevas propiedades indicando nombre, descripción, provincia, ciudad, tarifa por noche en dólares estadounidenses (`USD`), número de habitaciones y capacidad máxima de adultos.
3. **Gestión de Disponibilidad:** Activación/desactivación de inmuebles y actualización de datos en tiempo real.

---

## 6. Aseguramiento de Calidad y Pruebas

Para validar la integridad de la solución, ejecute los comandos de prueba y verificación estática:

```bash
# 1. Comprobación de Tipos Estrictos en TypeScript
npx tsc --noEmit

# 2. Análisis Estático de Código (Linter Oxlint)
npm run lint

# 3. Pruebas Unitarias con Vitest
npm run test

# 4. Pruebas de Integración y End-to-End (E2E)
npm run test:e2e

# 5. Compilación de Producción
npm run build
```

---

## 7. Licencia y Créditos

Este proyecto fue desarrollado como parte de la evaluación técnica de integración de sistemas del **Reto 1 de Hábitat EC**.  
Desarrollado por **James Arguello**. Distribuido bajo la licencia MIT.
