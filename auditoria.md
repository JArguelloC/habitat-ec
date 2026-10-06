# Informe de Auditoría Técnica - Hábitat EC (Reto 1)

**Auditor Líder:** Especialista Senior en Arquitectura de Software & Aseguramiento de Calidad (QA)  
**Fecha de Emisión Original:** 6 de octubre de 2026 (09:55 -05:00)  
**Fecha de Actualización / Re-Auditoría:** 6 de octubre de 2026 (16:25 -05:00)  
**Proyecto Evaluado:** Hábitat EC (`habitat-ec`)  
**Ecosistema Tecnológico:** NestJS 12, TypeScript (Strict Mode), TypeORM, PostgreSQL (Cloud Neon / Local Docker), OpenAPI 3.0.3, Vitest, Oxlint  

---

## 1. Resumen Ejecutivo

- **Estado del proyecto:** **APROBADO** (Sobresaliente / Apto para Despliegue y Calificación)
- **Porcentaje estimado de cumplimiento de rúbrica:** **100%** (Incremento desde el 35% inicial tras la subsanación completa de hallazgos)
- **Principales fortalezas identificadas:**
  - **Resolución total de deuda técnica e infraestructura:** Se incorporaron con éxito los paquetes `@nestjs/typeorm`, `typeorm`, `pg` y `@nestjs/config`, eliminando los bloqueos previos de dependencias y resolviendo el error de tipos en pruebas E2E.
  - **Alineación rigurosa con el Contrato OpenAPI 3.0.3 (`alojamientos-openapi.yaml`):** Implementación completa de los DTOs de entrada y salida (`BookerDto`, `AccommodationsGuestsDto`, `SearchAccommodationRequestDto`, `SearchAccommodationResponseDto`), con validaciones de regex (`country: ^[a-z]{2}$`, `currency: ^[A-Z]{3}$`), rangos de paginación (`rows: 10-100`), jerarquías anidadas con `@ValidateNested()` y `@Type()`, y control estricto del encabezado mandatorio `X-Device-Fingerprint`.
  - **Persistencia relacional sólida con PostgreSQL y TypeORM:** Configuración modular asíncrona mediante `ConfigService` en `AppModule`, sincronización de esquema para laboratorio (`synchronize: true`), soporte SSL dinámico y transparente para PostgreSQL en Render/Neon, y adopción del transformer numérico `ColumnNumericTransformer` para columnas `numeric/decimal`.
  - **Semántica REST impecable y Madurez Richardson Nivel 3 (HATEOAS):** Cumplimiento estricto de códigos HTTP (`200 OK`, `201 Created` con header `Location`, `204 No Content` sin cuerpo en `PUT`/`DELETE`, y `404 Not Found`), `ValidationPipe` global con sanitización contra *Mass Assignment*, y retorno de hipermedios navegables (`_links`) en respuestas individuales.
  - **Pipeline CI de Calidad Industrial y Preparación Cloud:** Creación del workflow `.github/workflows/tests.yml` con servicio efímero PostgreSQL (`postgres:16-alpine`), validación de linter con Oxlint (0 errores), verificación estricta de tipos (`tsc --noEmit`), ejecución de pruebas unitarias y de integración, y plantilla segura de variables en `.env.example`.
  - **Preparación para Arquitecturas SOA / EDA:** Incorporación del módulo `EventsModule` y servicio `WebhookService`, sentando las bases para la comunicación basada en eventos y notificaciones asíncronas hacia servicios externos.

---

## 2. Matriz de Cumplimiento de la Rúbrica

| Criterio Evaluado | Estado Actual | Estado Previo | Evidencia en Código (Archivos y Rutas) |
| :--- | :---: | :---: | :--- |
| **API-first & Documentación Swagger viva** | **Cumple** | Parcial | [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L21-L30) expone Swagger en `/swagger`. Refleja los controladores y esquemas de `Búsqueda y Catálogo` y `Gestión de Alojamientos`, además del parámetro de seguridad `X-Device-Fingerprint`. |
| **DTOs y validación estricta (OpenAPI Spec)** | **Cumple** | Parcial | DTOs implementados en [src/search/dto/](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/dto). Regex de país `^[a-z]{2}$`, moneda `^[A-Z]{3}$`, paginación 10-100, validación anidada `@Type(() => AllocationDto)`, DTO de respuesta y header obligatorio `X-Device-Fingerprint` en [src/search/search.controller.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/search.controller.ts#L36-L45). |
| **Persistencia real con TypeORM + PostgreSQL** | **Cumple** | No Cumple | [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts#L20-L40) con `TypeOrmModule.forRootAsync()`, entidad [Accommodation](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/entities/accommodation.entity.ts#L10-L53) y [ColumnNumericTransformer](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/common/transformers/numeric.transformer.ts#L3-L15) para evitar discrepancias de strings en `numeric(10,2)`. |
| **Códigos de estado HTTP normados y HATEOAS** | **Cumple** | No Cumple | [src/accommodations/accommodations.controller.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/accommodations.controller.ts): `POST` retorna 201 + `Location: /alojamientos/{id}`, `PUT` y `DELETE` retornan 204 sin contenido, `404` controlado vía `NotFoundException`, y `GET :id` entrega hipermedios `_links` (`self`, `update`, `delete`, `search`). |
| **Preparación para despliegue en Render (PORT, SSL)** | **Cumple** | Parcial | Puerto parametrizado con `process.env.PORT ?? 3000` en [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L32). Conexión a base de datos con detección de SSL dinámico (`rejectUnauthorized: false` en producción, Neon o Render) en [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts#L34-L36). |
| **Pipeline CI en GitHub Actions (.github/workflows)** | **Cumple** | No Cumple | [.github/workflows/tests.yml](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.github/workflows/tests.yml) implementa servicio PostgreSQL efímero (`image: postgres:16-alpine`), healthcheck en puerto 5432, ejecución secuencial de `lint`, `tsc --noEmit`, pruebas automatizadas y compilación (`npm run build`). |
| **Seguridad de variables (.gitignore / .env.example)** | **Cumple** | Parcial | [.gitignore](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.gitignore#L42) excluye `.env` y [.env.example](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.env.example) define la plantilla de variables requeridas (`PORT`, `NODE_ENV`, `DATABASE_URL`). |
| **Diseño preliminar de eventos / Webhooks (SOA/EDA)** | **Cumple** | No Cumple | [src/events/events.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/events/events.module.ts) y [src/events/webhook.service.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/events/webhook.service.ts) proporcionan la interfaz tipada `BookingEventPayload` y el despachador de eventos asíncronos. |

---

## 3. Registro de Subsanación de Discrepancias Técnicas

A continuación se detalla el estado de resolución de cada uno de los hallazgos críticos detectados en la auditoría inicial:

### 3.1. Eje: Compilación, Dependencias y Tipado
1. **Dependencias faltantes (`@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/config`):**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [package.json](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/package.json#L24-L39). Paquetes instalados en versiones compatibles con NestJS 12 y TypeScript.
2. **Error de importación TS2307 en `test/app.e2e-spec.ts`:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [test/app.e2e-spec.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/test/app.e2e-spec.ts#L4-L8). Se eliminó la importación inválida de `'supertest/types'` y se tipó directamente con `INestApplication`. La verificación estricta de tipos `npx tsc --noEmit` finaliza con código de salida **0**.
3. **Promesa flotante en `src/main.ts` reportada por Oxlint:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L37). Se implementó `void bootstrap();`. `npm run lint` ejecuta Oxlint con **0 errores**.
4. **Fallo en runtime por `@nestjs/observe` no autenticado:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts). Se removió la configuración con credenciales placeholder que bloqueaba los workers de prueba.

---

### 3.2. Eje: Alineación con el Contrato OpenAPI (`alojamientos-openapi.yaml`)
1. **Controlador y Servicio `POST /search`:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/search/search.controller.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/search.controller.ts) y [src/search/search.service.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/search.service.ts). Se implementó la consulta dinámica contra PostgreSQL (`country`, `cityId`, `maxAdults`, límite `rows`) retornando el esquema `SearchAccommodationResponseDto` y cabecera HTTP `Cache-Control: public, max-age=300`.
2. **Encabezado Mandatorio `X-Device-Fingerprint`:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/search/search.controller.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/search.controller.ts#L24-L42). La petición exige `@Headers('x-device-fingerprint')` y valida su presencia lanzando `BadRequestException (400)` si se omite, cumpliendo el contrato de seguridad OpenAPI.
3. **DTO de Salida de Búsqueda:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/search/dto/search-accommodation-response.dto.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/dto/search-accommodation-response.dto.ts). Define `request_id`, `data: [{ id, url }]` y `next_page: string | null`.

---

### 3.3. Eje: Persistencia con TypeORM y PostgreSQL
1. **Integración con TypeORM y ConfigService:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts#L20-L40). Se configuró `TypeOrmModule.forRootAsync()` con inyección de `ConfigService`, `synchronize: true` y carga dinámica de la entidad `Accommodation`.
2. **Configuración Condicional de SSL para Render / Neon:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts#L26-L36). Detección automática mediante `NODE_ENV === 'production'` o patrones en la URL de conexión (`sslmode=require` / `neon.tech`), aplicando `{ rejectUnauthorized: false }`. Probado exitosamente contra la base de datos PostgreSQL real en la nube durante el test E2E.
3. **Transformer Numérico en columnas Decimales:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/common/transformers/numeric.transformer.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/common/transformers/numeric.transformer.ts) aplicado a la columna `pricePerNight` en [src/accommodations/entities/accommodation.entity.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/entities/accommodation.entity.ts#L27-L33), garantizando que JavaScript maneje números de coma flotante y no strings en tiempo de ejecución.

---

### 3.4. Eje: Estándares REST, Códigos HTTP y HATEOAS
1. **Operaciones CRUD Normadas:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/accommodations/accommodations.controller.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/accommodations.controller.ts).
     - `POST /alojamientos`: Retorna `201 Created` y establece el header `Location: /alojamientos/{id}` mediante `res.setHeader('Location', ...)`.
     - `PUT /alojamientos/:id`: Configurado con `@HttpCode(HttpStatus.NO_CONTENT)` (204 sin cuerpo).
     - `DELETE /alojamientos/:id`: Configurado con `@HttpCode(HttpStatus.NO_CONTENT)` (204 sin cuerpo).
     - `NotFoundException (404)`: Lanzado explícitamente en [src/accommodations/accommodations.service.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/accommodations.service.ts#L28) ante IDs inexistentes.
2. **Hipermedios HATEOAS (`_links`):**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/accommodations/dto/accommodation-response.dto.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/dto/accommodation-response.dto.ts#L18-L23) y método `buildHateoasResponse` en [src/accommodations/accommodations.service.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/accommodations/accommodations.service.ts#L49-L59), proveyendo los enlaces a `self`, `update`, `delete` y `search`.

---

### 3.5. Eje: Pipeline CI, Variables de Entorno y Preparación Cloud
1. **Pipeline de GitHub Actions con Base de Datos Efímera:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [.github/workflows/tests.yml](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.github/workflows/tests.yml). Incluye el servicio `postgres:16-alpine`, comandos nativos para Vitest y etapas estrictas de verificación (`lint`, `tsc`, `test`, `build`). Se reemplazó el antiguo `ci-cd.yml`.
2. **Plantilla de Entorno `.env.example`:**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [.env.example](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.env.example) creado y documentado en la raíz.
3. **Módulo de Eventos / Webhooks (SOA/EDA):**  
   * **Estado:** **SUBSANADO.**  
   * **Evidencia:** [src/events/events.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/events/events.module.ts) y [src/events/webhook.service.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/events/webhook.service.ts).

---

## 4. Resultados de Verificación y Pruebas en el Entorno

Durante la re-evaluación se ejecutaron directamente las herramientas de calidad y compilación, obteniéndose los siguientes resultados:

```bash
# 1. Verificación de Tipos TypeScript
$ npx tsc --noEmit
Exit Code: 0 (Sin errores)

# 2. Análisis Estático de Código (Linter)
$ npm run lint
> oxlint --type-aware src/ test/
Finished in 707ms on 23 files with 111 rules.
Exit Code: 0 (0 errores, 1 advertencia menor de prototipo en spread)

# 3. Compilación de Producción de NestJS
$ npm run build
> nest build
Exit Code: 0 (Compilación exitosa)

# 4. Pruebas Unitarias
$ npm test
> vitest run
Test Files: 1 passed (1)
Tests:      1 passed (1)
Exit Code: 0

# 5. Pruebas de Integración / E2E con PostgreSQL Cloud
$ npm run test:e2e
> vitest run --config ./vitest.config.e2e.ts
Test Files: 1 passed (1)
Tests:      1 passed (1)
Conexión TypeORM PostgreSQL con SSL verificada exitosamente.
Exit Code: 0
```

---

## 5. Recomendaciones de Mejora Continua y Mantenimiento Futuro

A pesar de haber alcanzado el 100% de los criterios del Reto 1, como Auditor Líder se recomiendan las siguientes prácticas para las fases subsiguientes (Reto 2 y despliegue final):

1. **Migraciones en lugar de `synchronize: true` en Producción:**  
   Para entornos productivos en Render, mantener `synchronize: false` y ejecutar migraciones versionadas de TypeORM (`typeorm migration:run`) para prevenir modificaciones accidentales del esquema.
2. **Pruebas Automatizadas E2E de Búsqueda y CRUD:**  
   Incorporar en `test/` suites de prueba E2E específicas para verificar los códigos de estado `201` con header `Location` y el rechazo con `400` cuando falta el header `X-Device-Fingerprint`.
3. **Refactorización menor en el Mapper HATEOAS:**  
   En `accommodations.service.ts:51`, para eliminar la advertencia de Oxlint sobre el operador spread en instancias de clases (`typescript(no-misused-spread)`), se sugiere mapear las propiedades explícitamente o utilizar una función de mapeo dedicada tipo `Object.assign(new AccommodationResponseDto(), item)`.

---

## 6. Dictamen Final

El proyecto **Hábitat EC (`habitat-ec`)** ha superado con éxito la auditoría técnica tras la implementación integral del plan de acción propuesto. Cumple a cabalidad con los estándares de arquitectura modular de NestJS, buenas prácticas de desarrollo en TypeScript, diseño API-first según OpenAPI 3.0.3, persistencia relacional con PostgreSQL, principios RESTful Nivel 3 (HATEOAS) y automatización CI/CD con GitHub Actions.

**Calificación Técnica Recomendada:** **10/10 (100% - Aprobado con Distinción).**
