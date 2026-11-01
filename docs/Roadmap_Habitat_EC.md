Ran list files in docs directory
Analyzed Pendientes_29_10_2026.md:L1-37
Analyzed Proyecto de la asignatura.md:L190-250
Analyzed Proyecto de la asignatura.md:L251-320
Analyzed Proyecto de la asignatura.md:L321-400
Analyzed Habitat-EC-Contexto-Requerimientos.md:L1-39

Aquí tienes el **Roadmap completo y actualizado de Hábitat EC**, estructurado por fases según los entregables oficiales de la asignatura ([`Proyecto de la asignatura.md`](file:///c:/Users/USUARIO/Desktop/Cosas%20James/ProyectoIntegradeSistemas/habitat-ec/docs/Proyecto%20de%20la%20asignatura.md)) y el estado registrado en [`Pendientes_29_10_2026.md`](file:///c:/Users/USUARIO/Desktop/Cosas%20James/ProyectoIntegradeSistemas/habitat-ec/docs/Pendientes_29_10_2026.md).

---

### 📊 Resumen de Estado General

| Componente | Estado | Progreso |
| :--- | :---: | :---: |
| **Base de Datos (Neon PostgreSQL)** | Concluida (5FN, Auditoría, Stored Procedures) | **100%** |
| **Backend API (NestJS)** | Módulos de dominio y Swagger listos | **95%** |
| **Contratos API (OpenAPI 3.0.3)** | Especificación en [`contracts/habitat-ec-v1.yaml`](file:///c:/Users/USUARIO/Desktop/Cosas%20James/ProyectoIntegradeSistemas/habitat-ec/contracts/habitat-ec-v1.yaml) | **100%** |
| **Frontend Web (React/Vite)** | Aún no inicializado en el repositorio | **0%** |
| **Despliegue Público (Cloud)** | Base de datos en Neon; falta Backend y Frontend | **25%** |
| **Documentación Técnica** | Arquitectura y contexto base listo; falta sección teórica | **75%** |

---

### 🎯 Fase 1: Cierre Inmediato del Reto 1 (Semanas 1 a 6)

Esta es la prioridad actual para cumplir con la primera entrega evaluable:

#### 1. Construcción del Frontend Web (React + Vite + Tailwind)
- [ ] **Inicialización de la app frontend:** Crear la carpeta `/frontend` con Vite, React, Tailwind CSS y cliente HTTP / TanStack Query.
- [ ] **Marketplace Web (Vista Cliente / Viajero):**
  - [ ] Buscador y catálogo de eco-alojamientos con filtros (ciudad, precio, amenidades).
  - [ ] Vista de detalle del alojamiento (fotos, reglas, políticas de cancelación, calificación).
  - [ ] Flujo de reserva: cotización, bloqueo temporal (*Hold* de 15 minutos) y confirmación de reserva (checkout).
- [ ] **Módulo de Administración (Panel Anfitrión / Admin):**
  - [ ] Inicio de sesión y manejo de sesión JWT.
  - [ ] CRUD de alojamientos (dar de alta propiedad, cargar amenidades, tarifas y políticas).
  - [ ] Visualización de reservas activas y estado de contratos.

#### 2. Despliegue Público en Internet
- [ ] Desplegar el **Backend NestJS** en un PaaS gratuito o accesible (Render, Railway, Fly.io) conectado a la base de datos de Neon.
- [ ] Desplegar el **Frontend** (Vercel o Netlify) enlazado con la URL pública del backend desplegado.
- [ ] Verificar CORS, variables de entorno de producción y Swagger público accesible.

#### 3. Completar el Documento Técnico de Arquitectura
Incorporar en [`Habitat-EC-Contexto-Requerimientos.md`](file:///c:/Users/USUARIO/Desktop/Cosas%20James/ProyectoIntegradeSistemas/habitat-ec/docs/Habitat-EC-Contexto-Requerimientos.md) las justificaciones teóricas de las semanas 3 a 6 para la transición al Reto 2:
- [ ] **Semana 3 (gRPC):** Justificar qué servicios de alta frecuencia y baja latencia migrarán a gRPC (ej. motor de disponibilidad/holds entre microservicios).
- [ ] **Semana 4 (GraphQL):** Evaluar cómo GraphQL evitará el *over-fetching* de fotos, amenidades y reseñas en las vistas de catálogo del marketplace.
- [ ] **Semanas 5 y 6 (EDA / Transactional Outbox):** Explicar los eventos del Outbox (`ReservaCreadaEvent`, `AlojamientoPublicadoEvent`) preparados para integración externa.

---

### 🚀 Fase 2: Reto 2 - Integración con Booking y Microservicios (Semanas 7 a 11)

- [ ] **Desacoplamiento a Microservicios:**
  - Migración del backend modular a servicios independientes (ej. Servicio de Identidad/Usuarios, Servicio de Alojamientos/Catálogos, Servicio de Órdenes/Disponibilidad).
- [ ] **API Gateway & BFF:**
  - Implementación de un API Gateway para ruteo centralizado, autenticación perimetral y rate limiting.
- [ ] **Integración B2B con Booking Prototipo:**
  - Consumo bidireccional de APIs y eventos con el equipo de Booking del curso.
  - Implementación formal de Webhooks y publicación de eventos desde `outbox_events`.
- [ ] **Pruebas y Calidad de Integración:**
  - Contract testing (consumer-driven contracts).
  - Pruebas de integración automatizadas.
- [ ] **Observabilidad y Seguridad:**
  - Trazabilidad distribuida (`X-Correlation-Id`), métricas y centralización de logs.
  - Políticas de seguridad reforzadas con scopes JWT y roles RBAC.

---

### 📱 Fase 3: Reto 3 - Experiencia Móvil y Resiliencia Final (Semanas 12 a 16)

- [ ] **Migración del Marketplace a Móvil:**
  - Desarrollo de la app móvil del marketplace en **Flutter** o **React Native** (según sorteo).
- [ ] **Mantenimiento del Panel Web:**
  - Conservar el módulo de administración en web para los anfitriones.
- [ ] **Resiliencia e Interoperabilidad:**
  - Circuit breakers, fallbacks y reintentos exponenciales en integraciones.
- [ ] **Despliegue y Defensa Final:**
  - Despliegue del ecosistema multi-dominio integrado y sustentación técnica.