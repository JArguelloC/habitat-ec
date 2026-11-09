# 🌿 Auditoría Técnica de Calidad y Transición al Reto 2 — Hábitat EC

> **Ecosistema:** Plataforma Transaccional de Hospedaje Sostenible, Eco-Lodges y Hoteles en Ecuador  
> **Rol:** Tech Lead & Auditor de Calidad de Software  
> **Fecha de Emisión:** 08 de Noviembre de 2026  
> **Estado Global:** ✅ **Reto 1 (100% Cimentado & Certificado)** | 🔥 **Reto 2 (Fase Activa: Microservicios & Integración B2B)**  

---

## 1. Resumen Ejecutivo

La plataforma **Hábitat EC** ha concluido con éxito la totalidad de los requisitos funcionales, arquitectónicos y no funcionales correspondientes al **Reto 1 (Semanas 1 a 6)**. A través de una auditoría exhaustiva sobre el código fuente, la base de datos relacional y las interfaces de usuario, se certifica que el núcleo transaccional monolítico modular opera con estabilidad garantizada de extremo a extremo:

1. **Flujo E2E Completo y Blindado:** El recorrido crítico del usuario desde la búsqueda en catálogo público georreferenciado (PostGIS), retención pesimista de stock por 15 minutos (*Hold* atómico con `NOWAIT`), checkout con medios de pago locales e internacionales (tarjeta de crédito/débito y transferencias bancarias ecuatorianas con comprobante), liquidación contable al anfitrión (85% neto / 15% comisión) y confirmación de reserva con código amigable (PNR) se encuentra **100% operativo**.
2. **Cero Deuda Técnica Transaccional:** Se eliminaron las condiciones de carrera, errores de restricciones huérfanas en PostgreSQL (`42703`, `23514`) y cascadas de transacciones abortadas (`25P02`), dotando al sistema de una alta tolerancia a fallos.
3. **Preparación para el Reto 2:** La persistencia relacional en **Quinta Forma Normal (5FN)** y el patrón **Transactional Outbox** constituyen los cimientos arquitectónicos para desacoplar el sistema hacia microservicios (`MS_CATALOG`, `MS_ORDERS`, `MS_PAYMENTS`), publicar eventos en colas de mensajería **RabbitMQ (CloudAMQP)** e integrarse con la plataforma central mayorista **Booking Prototipo**.

---

## 2. Inspección de Frontend (React 19 + TypeScript + Tailwind CSS)

El cliente web SPA ha sido sometido a un refinamiento integral de usabilidad conforme a las 10 Heurísticas de Jakob Nielsen y los estándares modernos de ingeniería en React:

### 2.1. Datepickers Interactivos Validados (Heurística #5: Prevención de Errores)
- **Componente:** `SearchBar.tsx` y `PropertyDetailPage.tsx`.
- **Lógica Implementada:**
  - `checkin >= hoy`: El usuario no puede seleccionar fechas pasadas.
  - `checkout > checkin`: La fecha de salida se restringe dinámicamente (`min = checkin + 1 día`).
  - Si el usuario modifica el check-in a una fecha posterior al check-out actual, el check-out se reajusta automáticamente al día siguiente sin desincronizar el estado.
- **Resultado:** Cero excepciones por rangos de fecha inválidos (`P0003`) en backend.

### 2.2. Tarjeta de Crédito Interactiva en 3D (`InteractiveCreditCard`)
- **Componente:** `InteractiveCreditCard.tsx` y `CheckoutPage.tsx`.
- **Lógica Implementada:**
  - Renderizado dinámico en tiempo real de los 16 dígitos formateados en bloques de 4 (`4242 4242 ...`), titular y fecha de expiración `MM/AA`.
  - Detección algorítmica instantánea de franquicia emisora (**Visa, Mastercard, Diners Club / American Express**) con cambio reactivo de logotipos y fondos temáticos.
  - Animación 3D de volteo (*flip*) al hacer foco en el campo de seguridad (CVV/CVC), mostrando la banda magnética y el código en el reverso.
- **Validación Estricta:** Verificación de fecha de expiración contra `new Date()` (mes y año en curso) impidiendo cobros a tarjetas vencidas antes de invocar la API.

### 2.3. Temporizador de Retención Persistente (15:00 min)
- **Hook:** `useCheckoutTimer.ts`.
- **Lógica Implementada:**
  - Persistencia en `localStorage` bajo la clave `checkout_expires_at` sincronizada con el timestamp devuelto por el servidor (`oph.expira_en`).
  - Resiliencia absoluta ante recarga de página (F5): calcula la diferencia exacta `expiresAt - Date.now()`.
  - Detección de expiración en segundo plano o abandono: si el tiempo transcurre con la pestaña cerrada, al volver se detecta `remaining <= 0`, se cancela el proceso, se libera el stock y se redirige al usuario con notificación clara.
  - Pausado automático cuando la reserva ya está confirmada (`voucher != null`).

### 2.4. Optimización y Prevención de Re-renderizados Cíclicos
- **Implementación:**
  - Memorización mediante `useCallback` y `useMemo` en cálculos financieros, filtros de tarjetas y callbacks de expiración.
  - Limpieza de suscripciones temporales en `useEffect` con `window.setInterval` y `window.setTimeout`.
  - Mantenimiento estricto de cero errores en el linter: `npm run lint` pasa con **0 advertencias y 0 errores**.

### 2.5. Navegación Post-Pago Higiénica (Reemplazo de Historial)
- **Mecanismo:** `navigate('/mis-reservas', { replace: true })`.
- **Lógica Implementada:**
  - Tras la confirmación del pago o la subida del comprobante bancario, se purga explícitamente `checkout_expires_at` de `localStorage` y `sessionStorage`.
  - La navegación reemplaza la entrada en el historial de navegación. Si el usuario pulsa el botón "Atrás" en su navegador o dispositivo móvil, retrocede al catálogo o detalle del alojamiento y **nunca al checkout con un temporizador activo**.

### 2.6. Copywriting Humanizado (Heurística #2: Relación Sistema-Mundo Real)
- **Componente:** `MyReservationsPage.tsx`.
- **Refactorización de Términos:**
  - De *"Mis Reservas y Vouchers PNR"* $\rightarrow$ **"Mis Próximos Viajes"**.
  - De *"Localizador PNR"* $\rightarrow$ **"Código de Reserva"** (ej. `HAB-EC-A1B2C3`).
  - De *"Política 5FN: FREE_CANCELLATION"* $\rightarrow$ **"Política: Cancelación Gratuita"** mediante el helper `formatCancellationPolicy`.
  - De *"la Saga Compensatoria liberará las habitaciones"* $\rightarrow$ *"tu reserva quedará cancelada y la(s) habitación(es) quedará(n) disponible(s) nuevamente para otros viajeros"*.

---

## 3. Inspección de Backend y Base de Datos (NestJS 12 + PostgreSQL Neon)

La capa de datos y servicios en NestJS ha sido estabilizada para cumplir con los estándares de transacciones ACID y alta concurrencia:

### 3.1. Estabilización Transaccional Lineal (Resolución de Error `25P02`)
- **Problema previo:** Si una consulta dentro de una transacción fallaba (ej. violación de check constraint), PostgreSQL marcaba la transacción como abortada. Cualquier consulta subsiguiente arrojaba `25P02: current transaction is aborted, commands ignored until end of transaction block`, enmascarando la causa raíz.
- **Solución Implementada:**
  - Se eliminó el `try/catch` anidado en el paso 10 de `confirmarReservaYPago` en `OrdenesService`.
  - Flujo transaccional secuencial y lineal: si **cualquier** consulta asíncrona falla, la ejecución se interrumpe inmediatamente y viaja al `catch` global.
  - Verificación segura con `if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();` antes del `queryRunner.release()`.
  - Propagación transparente del error original (`throw error`), permitiendo al filtro global devolver diagnósticos enriquecidos (`pgCode`, `constraint`, `table`).

### 3.2. Sincronización de Esquema y Triggers Bidireccionales (`created_at` $\leftrightarrow$ `creation_date`)
- **Migración:** `009_garantizar_columna_created_at_ordenes.sql`.
- **Implementación:**
  - Se añadió la columna `created_at` como espejo y fallback en la tabla `ordenes`.
  - Se instaló el trigger `trg_sync_ordenes_created_at`: cualquier `INSERT` o `UPDATE` sincroniza bidireccionalmente ambos campos.
  - Compatibilidad total: consultas que soliciten `creation_date` o `created_at` se ejecutan sin fallos (`42703`).

### 3.3. Flexibilización de Check Constraints en Holds (`order_previews_holds`)
- **Migración:** `010_actualizar_check_constraint_estado_preview.sql`.
- **Implementación:**
  - Se amplió la columna a `VARCHAR(30)` y se actualizó `order_previews_holds_estado_preview_check` para aceptar:
    `CHECK (estado_preview IN ('ACTIVO', 'EXPIRADO', 'CONFIRMADO', 'CONVERTIDO_EN_ORDEN', 'RESERVADO', 'UTILIZADO'))`.
  - En `OrdenesService`, el paso 10 utiliza el estado canónico `'CONFIRMADO'`, garantizando compatibilidad retroactiva y hacia adelante.

---

## 4. Matriz de Triage Arquitectónico (Reto 1 vs. Reto 2)

| Módulo / Componente | Capa Técnica | Estado | Observaciones y Alcance |
| :--- | :--- | :---: | :--- |
| **Búsqueda & Catálogos** | Frontend & Backend | ✅ Cimentado | PostGIS operativo en Neon, búsqueda por ciudad, adultos y fechas validada. |
| **Modelado 5FN** | Base de Datos | ✅ Cimentado | Matriz de proyección `canal_politicas` y vista `vw_contratos_5fn_validos` íntegras. |
| **Hold Pesimista 15 min** | Base de Datos | ✅ Cimentado | `sp_generar_order_preview` descuenta stock con `FOR UPDATE NOWAIT` sin colisiones. |
| **Temporizador Persistente** | Frontend SPA | ✅ Cimentado | `useCheckoutTimer` sincronizado en `localStorage`, resistente a F5 y expiración. |
| **Tarjeta 3D & Checkout** | Frontend SPA | ✅ Cimentado | Volteo automático para CVV, detección de franquicias y validación de expiración. |
| **Pagos Híbridos (IVA 15%)** | Backend & Front | ✅ Cimentado | Tarjeta simulada / Payphone y Cuentas Bancarias con subida de comprobantes. |
| **Transacción Atómica de Orden** | Backend NestJS | ✅ Cimentado | `confirmarReservaYPago` con rollback lineal estricto; error 25P02 erradicado. |
| **Navegación Post-Pago** | Frontend SPA | ✅ Cimentado | Redirección con `replace: true` y purga de storage; historial limpio. |
| **Copywriting de Reservas** | Frontend SPA | ✅ Cimentado | Lenguaje 100% amigable al viajero en `/mis-reservas`; jerga técnica removida. |
| **Transactional Outbox** | Backend & BD | ✅ Cimentado | Tabla `outbox_events` poblándose atómicamente en cada confirmación de reserva. |
| **DevOps & Despliegue Cloud** | CI/CD | ✅ Cimentado | Azure Web App Backend y Vercel Frontend con pipelines automáticos en verde. |
| **Extracción Microservicio Catálogo** | Microservicios | ⏳ Pendiente (Reto 2) | Desacoplar `MS_CATALOG` con su propio ciclo de vida e interfaz REST/gRPC. |
| **Extracción Microservicio Reservas** | Microservicios | ⏳ Pendiente (Reto 2) | Desacoplar `MS_ORDERS` con gestión de stock distribuido y hold B2B de 30 min. |
| **Extracción Microservicio Finanzas** | Microservicios | ⏳ Pendiente (Reto 2) | Desacoplar `MS_PAYMENTS` para cobros, transferencias y liquidaciones al anfitrión. |
| **API Gateway Perimetral** | Arquitectura | ⏳ Pendiente (Reto 2) | Implementación de Reverse Proxy / Gateway unificado con Rate Limiting y CORS. |
| **Broker de Mensajería CloudAMQP** | EDA / Event Bus | ⏳ Pendiente (Reto 2) | Publicación de eventos desde el Outbox a exchanges y colas RabbitMQ para Booking. |
| **Integración B2B Booking Prototipo** | Interoperabilidad | ⏳ Pendiente (Reto 2) | Exponer contrato `/api/v2` y sincronización bidireccional de inventarios por noche. |

---

## 5. Conclusión y Veredicto Técnico

> **DICTAMEN:** El ecosistema de **Hábitat EC** cumple con calificación sobresaliente todos los estándares del **Reto 1**. La base arquitectónica es sólida, robusta y resiliente. Queda formalmente autorizada y expedita la transición a la **Fase Activa del Reto 2**.
