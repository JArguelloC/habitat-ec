# Documento de Arquitectura, Contexto y Requerimientos - Hábitat EC

## 1. Descripción y Contexto del Proyecto
**Hábitat EC** es una plataforma de *marketplace* (similar a un Airbnb ecológico) enfocada en la publicación, búsqueda y reserva de alojamientos sostenibles (eco-lodges, cabañas de montaña, hoteles boutique) en Ecuador. El proyecto se rige por una arquitectura **API-First**, garantizando que el contrato (OpenAPI 3.0.3) sea la fuente única de verdad antes de cualquier implementación de código.

## 2. Stack Tecnológico
- **Backend:** NestJS (TypeScript)
- **Base de Datos:** PostgreSQL 16 desplegado en Neon Serverless
- **ORM:** TypeORM
- **Frontend (Próxima etapa):** React 18/19 + Vite + Tailwind + TanStack Router
- **Documentación API:** Swagger (OpenAPI 3.0.3)
- **Herramientas Adicionales:** Antigravity (integrado en VS Code) para generación de código automatizada.

## 3. Roles del Sistema (RBAC)
- **SUPERADMIN:** Administrador global. Gestiona catálogos maestros, auditoría y crea cuentas de anfitriones.
- **ADMIN (Anfitrión):** Dueño o administrador de alojamientos. Registra propiedades, fotos, reglas, facilidades y habilita canales/políticas comerciales.
- **CLIENTE (Viajero):** Usuario que busca alojamientos, cotiza, bloquea fechas (Hold) y realiza reservas.
- **PARTNER_B2B:** Sistemas externos o canales de integración (ej. Booking Prototipo).

## 4. Diseño de Base de Datos y Restricciones
El esquema de base de datos se basa en un diseño relacional altamente normalizado, optimizado para concurrencia e integridad:
- **Quinta Forma Normal (5FN):** Descomposición sin pérdida de la relación cíclica ternaria entre Alojamiento, Canal de Integración y Política de Cancelación. Validada a través de la vista `vw_contratos_5fn_validos`.
- **Auditoría Forense y Outbox:** Trazabilidad transaccional tipo CDC en la tabla `auditoria_forense` y arquitectura orientada a eventos (EDA) usando el patrón Transactional Outbox (`outbox_events`).

## 5. Módulos de Dominio (Backend en NestJS)
Para asegurar que todas las tablas de la base de datos expongan su respectiva API (Requerimiento del Docente), el backend se organiza en 6 módulos principales:
1. **`IdentidadModule`:** Autenticación JWT, gestión de `usuarios`, `roles`, y `dispositivos_fingerprint`.
2. **`CatalogosModule`:** Gestión de catálogos maestros (`ciudades`, `tipos_alojamiento`, `facilidades`, `reglas_convivencia`, `planes_alimenticios`).
3. **`AlojamientosModule`:** Publicación de propiedades, fotos, facilidades (4FN) y búsqueda pública.
4. **`DisponibilidadOrdenesModule`:** Bloqueos temporales (Hold 15 minutos), cotizaciones y confirmación de reservas (Checkout Idempotente) gestionados mediante *Stored Procedures* para evitar *overbooking*.
5. **`FinanzasResenasModule`:** Liquidaciones a anfitriones y sistema de reseñas con recalculo automático de calificación.
6. **`IntegracionAuditoriaModule`:** Suscripción de Webhooks B2B y visualización de la auditoría forense.

## 6. Reglas Técnicas y Requerimientos Inquebrantables
1. **Importaciones ESM Estrictas:** Todas las importaciones locales de archivos en TypeScript deben terminar explícitamente con `.js` (ej. `import { AuthService } from './auth.service.js';`).
2. **TypeORM Sincronización Apagada:** La propiedad `synchronize` debe permanecer en `false`. TypeORM no alterará el esquema 5FN de Neon.
3. **Conexión a Neon:** Para evitar colisiones SSL o *Timeouts* de libpq en Node/Windows, se debe usar `ssl: { rejectUnauthorized: false }` e incluir parámetros de tolerancia de red (`keepAlive`, `connectionTimeoutMillis`).
4. **Resiliencia Transaccional:** Validar siempre `error instanceof Error` en bloques `catch` para evitar fallos de tipado (`ts(18046)`).
5. **Idempotencia y Trazabilidad:** Todo endpoint crítico debe manejar `X-Correlation-Id` y `Idempotency-Key`.
