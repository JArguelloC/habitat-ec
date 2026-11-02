# Documento de Arquitectura, Contexto y Requerimientos - Hábitat EC

## 1. Descripción y Contexto del Proyecto
**Hábitat EC** es una plataforma de hospitalidad sostenible y *marketplace* transaccional (eco-lodges, cabañas de montaña, hostales y hoteles boutique) en Ecuador. El proyecto se rige bajo un enfoque **API-First**, garantizando que el contrato formal ([`contracts/habitat-ec-v1.yaml`](file:///c:/Users/USUARIO/Desktop/Cosas%20James/ProyectoIntegradeSistemas/habitat-ec/contracts/habitat-ec-v1.yaml)) y los esquemas OpenAPI 3.0.3 rijan la interacción entre clientes, anfitriones y futuros partners comerciales (Booking Prototipo).

---

## 2. Stack Tecnológico Implementado
- **Backend:** NestJS 12 + TypeScript (Arquitectura modular en capas)
- **Base de Datos:** PostgreSQL 16 desplegado en Neon Serverless + PostGIS + `btree_gist`
- **ORM / Persistencia:** TypeORM con `synchronize: false` (control estricto por migraciones y *Stored Procedures*)
- **Autenticación & Identidad:** JWT (`passport-jwt`), bcrypt y Google OAuth 2.0 (`google-auth-library`)
- **Pasarelas de Pago:** Adaptador híbrido (`PaymentGatewayAdapterService`) para Payphone Ecuador, Stripe y Sandbox
- **Frontend SPA:** React 19 + TypeScript + Vite + Tailwind CSS (Paleta oficial "Oro Campestre & Lino")
- **Contenerización & DevOps:** Docker multi-stage (Node 22 / Nginx Alpine), `docker-compose.yml` y GitHub Actions CI/CD
- **Documentación API:** Swagger interactivo (`/api/docs`) y especificación OpenAPI 3.0.3

---

## 3. Roles del Sistema (RBAC Multinivel)
- **SUPERADMIN:** Administrador supremo. Gestión del directorio de usuarios, aprovisionamiento exclusivo de cuentas `ADMIN`, control de catálogos maestros, matriz 5FN, bitácora forense y despacho del Transactional Outbox.
- **ADMIN (Anfitrión):** Dueño de establecimientos turísticos. Consola estilo Lodgify con KPIs, liquidaciones financieras automáticas (85% neto), y Wizard guiado en 4 pasos para publicar propiedades con stock numérico controlado y contratos 5FN.
- **CLIENTE (Viajero):** Huésped que explora el marketplace, consulta disponibilidad en tiempo real, bloquea fechas con *Hold* de 15 minutos, procesa pagos y evalúa alojamientos mediante reseñas multicriterio.
- **PARTNER_B2B:** Sistemas externos (ej. Booking Prototipo) que reciben eventos firmados con `HMAC-SHA256` vía Webhooks suscritos.

---

## 4. Diseño de Base de Datos y Restricciones Arquitectónicas
- **Quinta Forma Normal (5FN):** Descomposición sin pérdida (*lossless-join*) de la relación cíclica ternaria entre `alojamientos`, `canales_integracion` y `politicas_cancelacion`, proyectada en `vw_contratos_5fn_validos`.
- **Control de Inventario Concurrente & GiST:** Exclusiones temporales mediante índices `btree_gist` y control ACID dual (bloqueo total para cabañas vs. decremento/incremento de cupos numéricos para hoteles y hostales).
- **Hold Pesimista de 15 Minutos:** *Stored Procedure* `sp_generar_order_preview` que protege contra *overbooking* liberando automáticamente el inventario si la orden expira.
- **Sagas Compensatorias:** Cancelación transaccional con devolución proporcional según política 5FN y reintegro inmediato del stock al marketplace.
- **Auditoría Forense Legal (CDC) & Outbox:** Trazabilidad estricta en `auditoria_forense_legal` mediante triggers DML y patrón **Transactional Outbox** (`outbox_events`) para integración desacoplada (EDA).

---

## 5. Módulos de Dominio (Backend NestJS)
1. **`AuthModule` & `UsuariosModule`:** Google OAuth 2.0 (`POST /auth/google`), autenticación tradicional, autogestión de perfil (`GET`/`PATCH /usuarios/perfil`) y control de dispositivos (`dispositivos_fingerprint`).
2. **`CatalogosModule`:** Gestión de divisiones geográficas PostGIS, tipologías de alojamiento, facilidades ecológicas, reglas y matriz 5FN (`canal_politicas`).
3. **`AlojamientosModule`:** Búsqueda pública multicriterio con filtros cruzados (`POST /alojamientos/search`), detalle completo con relaciones (`GET /alojamientos/:id`) y Wizard del anfitrión.
4. **`OrdenesModule`:** Motor de calendario de inventario, Holds de 15 minutos, checkout idempotente (`POST /ordenes/create`) y vouchers PNR (`HAB-EC-...`).
5. **`FinanzasResenasModule`:** Adaptador de pasarelas (Payphone / Stripe), liquidaciones al anfitrión y reseñas multicriterio con recálculo automático de estrellas por trigger.
6. **`IntegracionAuditoriaModule`:** Suscripciones B2B a Webhooks, visor de auditoría forense y worker despachador de Outbox (`POST /auditoria/outbox/despachar`).

---

## 6. Evolución Teórica hacia el Reto 2 y Reto 3 (Semanas 3 a 6)

### Semana 3: Evaluación de gRPC para Alta Concurrencia
- **Caso de uso identificado:** La verificación de disponibilidad de habitaciones y el bloqueo temporal (*Hold* pesimista de 15:00 minutos) requieren latencias ultra-bajas (< 25 ms) para evitar condiciones de carrera entre múltiples clientes simultáneos.
- **Evolución:** El módulo `OrdenesModule` encapsulará su motor de inventario en un servicio gRPC con esquemas Protobuf (`inventory.proto`), comunicándose internamente con el API Gateway mientras mantiene la interfaz REST para clientes externos.

### Semana 4: Evaluación de GraphQL para el Marketplace
- **Problema actual (Over-fetching):** Para renderizar las tarjetas del catálogo o el mosaico de detalle, se transfieren campos completos de georreferenciación, reglas y políticas que no siempre se consumen en la vista inicial.
- **Evolución:** Implementar un endpoint GraphQL como capa BFF (*Backend for Frontend*) para permitir que el marketplace solicite exactamente los campos necesarios (título, precio, foto de portada y calificación promedio), reduciendo el consumo de ancho de banda móvil.

### Semanas 5 y 6: SOA Práctica, Mensajería y EDA (Transactional Outbox)
- **Desacoplamiento de Servicios:** La creación de una orden y el cobro no deben bloquear de forma síncrona el envío de confirmaciones o la notificación al partner de Booking.
- **Patrón Outbox implementado:** Todo cambio de estado (`ORDER_CONFIRMED`, `ORDER_CANCELLED`, `ACCOMMODATION_UPDATED`) se persiste atómicamente en `outbox_events`. El endpoint `POST /api/v1/auditoria/outbox/despachar` actúa como el consumidor inicial que firma y entrega las notificaciones con `HMAC-SHA256`, sentando las bases para integrar un Broker de Mensajería (RabbitMQ o Apache Kafka) en el Reto 2.

---

## 7. Verificación de Cumplimiento de Entregables - Reto 1
1. ✅ **Backend funcional con APIs documentadas:** 48 endpoints activos y Swagger interactivo en `/api/docs`.
2. ✅ **Base de datos operativa:** PostgreSQL 16 Neon Serverless configurada en 5FN, PostGIS y auditoría.
3. ✅ **Sistema de administración funcional:** Panel del Anfitrión (`/admin`) y Consola Superadmin (`/superadmin`).
4. ✅ **Marketplace web funcional:** Catálogo completo (`/`), detalle con mosaico (`/alojamientos/:id`), checkout con Hold y voucher PNR.
5. ✅ **Documento técnico completo:** Este documento consolida el modelo, contratos, arquitectura y propuesta de microservicios.
6. ✅ **Preparación para despliegue:** Dockerfile multi-etapa, Nginx SPA proxy, docker-compose y GitHub Actions CI/CD en verde.
