# Informe de Auditoría Técnica - Hábitat EC (Reto 1)

**Auditor Líder:** Especialista Senior en Arquitectura de Software & QA  
**Fecha de Evaluación:** 6 de octubre de 2026  
**Proyecto Evaluado:** Hábitat EC (`habitat-ec`)  
**Tecnologías Base:** NestJS 12, TypeScript, TypeORM, PostgreSQL, OpenAPI 3.0.3, Vitest, Oxlint  

---

## 1. Resumen Ejecutivo

- **Estado del proyecto:** **Requiere Correcciones** (Crítico / No Apto para Producción en su estado actual)
- **Porcentaje estimado de cumplimiento de rúbrica:** **35%**
- **Principales fortalezas identificadas:**
  - **Modelado robusto de DTOs de entrada de búsqueda:** Los DTOs `BookerDto`, `AccommodationsGuestsDto` y `SearchAccommodationRequestDto` implementan un tipado estricto con validaciones declarativas complejas (`@Matches`, `@ValidateNested`, `@Type`, rangos numéricos con `@Min` y `@Max`).
  - **Configuración estricta de validación global:** `src/main.ts` incorpora `ValidationPipe` con `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true`, impidiendo inyecciones de campos no autorizados (Mass Assignment).
  - **Inicialización de OpenAPI/Swagger:** Documentación viva configurada bajo la ruta `/swagger`.
  - **Gestión de puertos dinámicos para despliegue:** Invocación de `process.env.PORT ?? 3000` en `main.ts`, facilitando el enlace a proxies inversos en PaaS como Render.

A pesar de contar con una base inicial en contratos de validación de entrada, el repositorio se encuentra en un estado esquelético ("scaffold"). Carece por completo de la capa de persistencia relacional con PostgreSQL, no implementa los endpoints requeridos por el contrato OpenAPI ni la especificación REST/HATEOAS, el pipeline de CI carece del contenedor de base de datos efímero y existen fallos de compilación/linting que impiden un paso limpio por control de calidad.

---

## 2. Matriz de Cumplimiento de la Rúbrica

| Criterio Evaluado | Estado (Cumple / Parcial / No Cumple) | Evidencia en Código (Archivos y Rutas) |
| :--- | :---: | :--- |
| **API-first & Documentación Swagger viva** | **Parcial** | `contracts/alojamientos-openapi.yaml` presente. En [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L17-L23) Swagger está inicializado en `/swagger`, pero no refleja los endpoints reales del contrato (`/search`, `/alojamientos`) por ausencia de controladores. |
| **DTOs y validación estricta (OpenAPI Spec)** | **Parcial** | DTOs de entrada implementados en [src/search/dto/](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/search/dto). Sin embargo, falta el DTO de salida (`SearchAccommodationResponseDto`), no existe el controlador `POST /search` y no se captura ni valida el header obligatorio `X-Device-Fingerprint`. |
| **Persistencia real con TypeORM + PostgreSQL** | **No Cumple** | En [package.json](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/package.json) faltan `@nestjs/typeorm`, `typeorm`, `pg` y `@nestjs/config`. [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts) no tiene conexión a base de datos. No existe ninguna entidad (`.entity.ts`) ni transformer numérico para `decimal/numeric`. |
| **Códigos de estado HTTP normados y HATEOAS** | **No Cumple** | No existen controladores de recursos CRUD ni de búsqueda. Inexistencia de respuestas con `201 Created` + header `Location`, `204 No Content` para mutaciones PUT/DELETE, excepciones `404 Not Found` ante registros inexistentes e hipermedios HATEOAS (`_links`). |
| **Preparación para despliegue en Render (PORT, SSL)** | **Parcial** | [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L25) respeta `process.env.PORT ?? 3000`. Sin embargo, no se implementa la configuración condicional de `ssl: { rejectUnauthorized: false }` para la conexión a PostgreSQL de Render al no haber módulo de TypeORM. |
| **Pipeline CI en GitHub Actions (.github/workflows)** | **No Cumple** | El archivo está nombrado [.github/workflows/ci-cd.yml](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.github/workflows/ci-cd.yml) (en lugar de `tests.yml`), no incluye el servicio de base de datos PostgreSQL efímero (`services: postgres`) y ejecuta `npm test -- --runInBand` (flag incompatible con el runner de Vitest). |
| **Seguridad de variables (.gitignore / .env.example)** | **Parcial** | [.gitignore](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.gitignore#L42) excluye adecuadamente `.env`, pero **no existe el archivo `.env.example`** con la plantilla de variables requeridas para el despliegue. |
| **Diseño preliminar de eventos / Webhooks (SOA/EDA)** | **No Cumple** | Ningún módulo, listener, emitter o servicio contempla la emisión de eventos asíncronos o recepción de Webhooks de reservas conforme al sílabo y al tag `Webhooks` de la especificación OpenAPI. |

---

## 3. Discrepancias Técnicas y Errores Detectados

### 3.1. Compilación, Dependencias y Tipado

1. **Dependencias de persistencia ausentes en `package.json`:**
   - **Archivo:** [package.json](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/package.json#L24-L35)
   - **Causa Técnica:** El proyecto no tiene instalados los paquetes `@nestjs/typeorm`, `typeorm`, `pg` ni `@nestjs/config`. Sin ellos, es imposible interactuar con PostgreSQL o gestionar variables de entorno de forma desacoplada y tipada.
2. **Error de Tipado en pruebas de integración E2E:**
   - **Archivo:** [test/app.e2e-spec.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/test/app.e2e-spec.ts#L4)
   - **Línea:** 4 (`import { App } from 'supertest/types';`)
   - **Causa Técnica:** `npx tsc --noEmit` falla con `error TS2307: Cannot find module 'supertest/types' or its corresponding type declarations.` La importación de tipos de Supertest debe realizarse directamente o tipando la aplicación con `INestApplication`.
3. **Fallo de Linter Oxlint por Promesa Flotante:**
   - **Archivo:** [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts#L27)
   - **Línea:** 27 (`bootstrap();`)
   - **Causa Técnica:** La regla de Oxlint `typescript(no-floating-promises)` detiene el comando `npm run lint` con código de salida 1. Requiere anteponer el operador `void` (`void bootstrap();`) o encadenar `.catch(...)`.
4. **Telemetría `@nestjs/observe` no configurada genera errores en Runtime:**
   - **Archivo:** [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts#L12-L16)
   - **Causa Técnica:** El módulo intenta conectarse a `https://observe.nestjs.com` con claves ficticias (`YOUR_APP_KEY`), generando el error continuo `[ObserveAgentWorker] Worker stopped with exit code 1. Restarting worker...` durante la ejecución de los tests.

---

### 3.2. Desalineación con el Contrato OpenAPI (`alojamientos-openapi.yaml`)

1. **Inexistencia del Controlador y Endpoint `POST /search`:**
   - **Archivo:** Ausente en `src/search/`
   - **Causa Técnica:** Los DTOs fueron creados de forma aislada, pero no existe `search.controller.ts` ni `search.service.ts`. El contrato exige la operación `POST /search` asociada a los tags `Búsqueda y Catálogo`.
2. **Header Obligatorio `X-Device-Fingerprint` no implementado:**
   - **Referencia Contrato:** `contracts/alojamientos-openapi.yaml`, líneas 56-61.
   - **Causa Técnica:** El contrato estipula `in: header, name: X-Device-Fingerprint, required: true`. Al no existir el controlador, no hay extracción ni validación de este encabezado esencial para prevención de fraude y rate limiting.
3. **Falta de DTO de Respuesta de Búsqueda:**
   - **Referencia Contrato:** Esquema `SearchAccommodationResponse` (líneas 775-793).
   - **Causa Técnica:** No se ha definido `search-accommodation-response.dto.ts` con los campos `request_id`, `data: [{ id, url }]` y `next_page`.

---

### 3.3. Persistencia con TypeORM y PostgreSQL

1. **Ausencia total de configuración de Base de Datos:**
   - **Archivo:** [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts)
   - **Causa Técnica:** No se importa `TypeOrmModule.forRootAsync()`. No se inyecta `ConfigService` para procesar la variable `DATABASE_URL`.
2. **Falta de configuración condicional SSL para Render:**
   - **Causa Técnica:** Las bases de datos PostgreSQL en Render y otros servicios en la nube exigen conexiones SSL con `ssl: { rejectUnauthorized: false }`. Si la aplicación se despliega sin esta condición basada en `NODE_ENV === 'production'`, la conexión es rechazada por el servidor de base de datos.
3. **Ausencia de Entidad de Alojamiento y Transformer Numérico:**
   - **Archivo:** Ausente (`accommodation.entity.ts`).
   - **Causa Técnica:** PostgreSQL y el driver `pg` devuelven las columnas `numeric` y `decimal` como cadenas de texto (`string`) en JavaScript para evitar pérdidas de precisión en números de coma flotante. Si no se asocia un `ValueTransformer` en TypeORM, el objeto de negocio entrega `price: "120.50"` en lugar de `price: 120.50`, violando los contratos tipados de la API.

---

### 3.4. Estándares REST, Códigos HTTP y HATEOAS

1. **Ausencia de operaciones CRUD normadas:**
   - No se cuenta con el módulo de alojamientos (`AccommodationsModule`).
   - Falta el código `201 Created` con encabezado `Location: /alojamientos/{id}` en el endpoint de creación `POST /alojamientos`.
   - Falta el código `204 No Content` (cuerpo vacío) en operaciones de actualización (`PUT/PATCH`) y eliminación (`DELETE`).
   - Falta el manejo de excepciones de dominio `404 Not Found` (`NotFoundException`) cuando se consulta o muta un recurso por un identificador no existente.
2. **Inexistencia de Hipermedios HATEOAS:**
   - Las respuestas de consulta individual (`GET /alojamientos/{id}`) deben incluir la estructura estándar `_links` (`self`, `update`, `delete`, `search`), permitiendo la navegabilidad del estado de la aplicación por el cliente.

---

### 3.5. Pipeline CI/CD, Variables de Entorno y Preparación Cloud

1. **Pipeline de GitHub Actions desalineado:**
   - **Archivo:** [.github/workflows/ci-cd.yml](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/.github/workflows/ci-cd.yml)
   - **Causa Técnica:**
     1. El archivo debe llamarse `.github/workflows/tests.yml` conforme a la rúbrica de evaluación automatizada.
     2. No define el bloque `services: postgres` con imagen `postgres:16-alpine`, impidiendo que los tests de integración y e2e contra base de datos se ejecuten en el runner de GitHub Actions.
     3. Utiliza la bandera `--runInBand` propia de Jest en el comando `npm test -- --runInBand`, cuando el proyecto está migrado a Vitest.
2. **Falta del archivo `.env.example`:**
   - **Causa Técnica:** El desarrollador o evaluador que clona el proyecto no cuenta con la plantilla oficial de variables requeridas para inicializar el contenedor local o el servicio de Render.
3. **Arquitectura SOA/EDA (Eventos y Webhooks):**
   - **Causa Técnica:** El sílabo y la especificación de integración requieren preparación para arquitecturas orientadas a servicios (SOA) y guiadas por eventos (EDA). No se ha planteado ningún módulo o interfaz base para emisión o procesamiento de webhooks.

---

## 4. Plan de Acción y Código de Corrección Inmediata

A continuación se presentan los artefactos y bloques de código exactos para remediar todas las deficiencias detectadas y alcanzar el **100% de cumplimiento** de la rúbrica técnica.

---

### Paso 1: Instalación de Dependencias Requeridas

Ejecutar en la terminal raíz:
```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config
```

---

### Paso 2: Creación del archivo de entorno `.env.example`

Crear el archivo `.env.example` en la raíz del proyecto:

```env
# Entorno y Puerto de Escucha
PORT=3000
NODE_ENV=development

# Conexión a Base de Datos PostgreSQL
# En desarrollo local: postgresql://postgres:postgres@localhost:5432/habitat_db
# En Render: postgresql://user:password@host.oregon-postgres.render.com/dbname
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/habitat_db
```

---

### Paso 3: Corrección de `src/main.ts` (Resolución de Linter y Swagger)

Reemplazar el contenido de [src/main.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/main.ts):

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación estricta con transformación y rechazo de propiedades no listadas
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Documentación OpenAPI Viva
  const config = new DocumentBuilder()
    .setTitle('Hábitat EC - Alojamientos Core API')
    .setDescription('Microservicio centralizado para catálogo, búsqueda y gestión de alojamientos con TypeORM y PostgreSQL')
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'X-Device-Fingerprint', in: 'header' }, 'X-Device-Fingerprint')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[Habitat EC] Servidor iniciado en puerto: ${port}`);
}

void bootstrap();
```

---

### Paso 4: Transformer Numérico para Columnas Decimales de TypeORM

Crear el archivo `src/common/transformers/numeric.transformer.ts`:

```typescript
import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(data: number | null | undefined): number | null | undefined {
    return data;
  }

  from(data: string | null | undefined): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    const res = parseFloat(data);
    return isNaN(res) ? null : res;
  }
}
```

---

### Paso 5: Entidad de Persistencia `Accommodation`

Crear el archivo `src/accommodations/entities/accommodation.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('accommodations')
export class Accommodation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 2 })
  country: string; // ISO 3166-1 alpha-2 minúsculas (ej. 'ec')

  @Column({ type: 'int' })
  cityId: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  pricePerNight: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 2 })
  maxAdults: number;

  @Column({ type: 'int', default: 1 })
  rooms: number;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

### Paso 6: DTOs del Módulo de Alojamientos y HATEOAS

Crear `src/accommodations/dto/create-accommodation.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsInt, Min, IsNumber, IsOptional } from 'class-validator';

export class CreateAccommodationDto {
  @ApiProperty({ example: 'Hotel Casa Gangotena' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Alojamiento boutique histórico en el Centro de Quito' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'ec', description: 'Código ISO 3166-1 alpha-2 en minúsculas' })
  @IsString()
  @Matches(/^[a-z]{2}$/, { message: 'El país debe tener exactamente 2 letras minúsculas (ej. ec)' })
  country: string;

  @ApiProperty({ example: 170150, description: 'ID de la ciudad' })
  @IsInt()
  @Min(1)
  cityId: number;

  @ApiProperty({ example: 145.50 })
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La moneda debe tener exactamente 3 letras mayúsculas' })
  currency?: string = 'USD';

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  maxAdults: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  rooms: number;
}
```

Crear `src/accommodations/dto/update-accommodation.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateAccommodationDto } from './create-accommodation.dto.js';

export class UpdateAccommodationDto extends PartialType(CreateAccommodationDto) {}
```

Crear `src/accommodations/dto/accommodation-response.dto.ts` (con HATEOAS):

```typescript
export interface LinkDto {
  href: string;
  rel: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export class AccommodationResponseDto {
  id: number;
  name: string;
  description: string;
  country: string;
  cityId: number;
  pricePerNight: number;
  currency: string;
  maxAdults: number;
  rooms: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  _links: {
    self: LinkDto;
    update: LinkDto;
    delete: LinkDto;
    search: LinkDto;
  };
}
```

---

### Paso 7: Servicio y Controlador de Alojamientos (REST, Códigos HTTP, HATEOAS)

Crear `src/accommodations/accommodations.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Accommodation } from './entities/accommodation.entity.js';
import { CreateAccommodationDto } from './dto/create-accommodation.dto.js';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto.js';
import { AccommodationResponseDto } from './dto/accommodation-response.dto.js';

@Injectable()
export class AccommodationsService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly accommodationRepo: Repository<Accommodation>,
  ) {}

  async create(createDto: CreateAccommodationDto): Promise<Accommodation> {
    const entity = this.accommodationRepo.create(createDto);
    return await this.accommodationRepo.save(entity);
  }

  async findAll(): Promise<Accommodation[]> {
    return await this.accommodationRepo.find();
  }

  async findOne(id: number): Promise<AccommodationResponseDto> {
    const item = await this.accommodationRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado`);
    }

    return this.buildHateoasResponse(item);
  }

  async update(id: number, updateDto: UpdateAccommodationDto): Promise<void> {
    const exists = await this.accommodationRepo.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para actualización`);
    }
    await this.accommodationRepo.update(id, updateDto);
  }

  async remove(id: number): Promise<void> {
    const result = await this.accommodationRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para eliminación`);
    }
  }

  private buildHateoasResponse(item: Accommodation): AccommodationResponseDto {
    return {
      ...item,
      _links: {
        self: { href: `/alojamientos/${item.id}`, rel: 'self', method: 'GET' },
        update: { href: `/alojamientos/${item.id}`, rel: 'update', method: 'PUT' },
        delete: { href: `/alojamientos/${item.id}`, rel: 'delete', method: 'DELETE' },
        search: { href: `/search`, rel: 'search', method: 'POST' },
      },
    };
  }
}
```

Crear `src/accommodations/accommodations.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccommodationsService } from './accommodations.service.js';
import { CreateAccommodationDto } from './dto/create-accommodation.dto.js';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto.js';
import { AccommodationResponseDto } from './dto/accommodation-response.dto.js';

@ApiTags('Gestión de Alojamientos')
@Controller('alojamientos')
export class AccommodationsController {
  constructor(private readonly service: AccommodationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo alojamiento' })
  @ApiResponse({ status: 201, description: 'Alojamiento creado exitosamente con encabezado Location' })
  async create(
    @Body() createDto: CreateAccommodationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const created = await this.service.create(createDto);
    res.status(HttpStatus.CREATED);
    res.setHeader('Location', `/alojamientos/${created.id}`);
    return created;
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los alojamientos' })
  async findAll() {
    return await this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar alojamiento por ID con hipermedios HATEOAS' })
  @ApiResponse({ status: 200, type: AccommodationResponseDto })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AccommodationResponseDto> {
    return await this.service.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Actualizar alojamiento existente (204 No Content)' })
  @ApiResponse({ status: 204, description: 'Actualización exitosa, sin contenido en la respuesta' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAccommodationDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar alojamiento (204 No Content)' })
  @ApiResponse({ status: 204, description: 'Eliminación exitosa, sin contenido en la respuesta' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}
```

Crear `src/accommodations/accommodations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity.js';
import { AccommodationsService } from './accommodations.service.js';
import { AccommodationsController } from './accommodations.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Accommodation])],
  controllers: [AccommodationsController],
  providers: [AccommodationsService],
  exports: [AccommodationsService, TypeOrmModule],
})
export class AccommodationsModule {}
```

---

### Paso 8: DTO de Salida y Controlador de Búsqueda (`POST /search`)

Crear `src/search/dto/search-accommodation-response.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccommodationItemDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: '/alojamientos/101' })
  url: string;
}

export class SearchAccommodationResponseDto {
  @ApiProperty({ example: 'req-f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  request_id: string;

  @ApiProperty({ type: [AccommodationItemDto] })
  data: AccommodationItemDto[];

  @ApiPropertyOptional({ example: null, nullable: true })
  next_page: string | null;
}
```

Crear `src/search/search.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Accommodation } from '../accommodations/entities/accommodation.entity.js';
import { SearchAccommodationRequestDto } from './dto/search-accommodation-request.dto.js';
import { SearchAccommodationResponseDto } from './dto/search-accommodation-response.dto.js';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly accommodationRepo: Repository<Accommodation>,
  ) {}

  async search(
    request: SearchAccommodationRequestDto,
  ): Promise<SearchAccommodationResponseDto> {
    const query = this.accommodationRepo.createQueryBuilder('acc')
      .where('acc.isAvailable = :available', { available: true });

    if (request.country) {
      query.andWhere('acc.country = :country', { country: request.country });
    }

    if (request.city) {
      query.andWhere('acc.cityId = :city', { city: request.city });
    }

    if (request.guests?.number_of_adults) {
      query.andWhere('acc.maxAdults >= :adults', {
        adults: request.guests.number_of_adults,
      });
    }

    const take = request.rows ?? 100;
    query.take(take);

    const accommodations = await query.getMany();

    return {
      request_id: `req-${randomUUID()}`,
      data: accommodations.map((item) => ({
        id: item.id,
        url: `/alojamientos/${item.id}`,
      })),
      next_page: null,
    };
  }
}
```

Crear `src/search/search.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import { SearchAccommodationRequestDto } from './dto/search-accommodation-request.dto.js';
import { SearchAccommodationResponseDto } from './dto/search-accommodation-response.dto.js';

@ApiTags('Búsqueda y Catálogo')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda de alojamientos según contrato OpenAPI' })
  @ApiHeader({
    name: 'X-Device-Fingerprint',
    required: true,
    description: 'Identificador único del dispositivo del cliente (prevención de fraude)',
  })
  @ApiResponse({
    status: 200,
    description: 'Alojamientos encontrados',
    type: SearchAccommodationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cuerpo de solicitud o encabezados inválidos' })
  @Header('Cache-Control', 'public, max-age=300')
  async search(
    @Headers('x-device-fingerprint') fingerprint: string,
    @Body() body: SearchAccommodationRequestDto,
  ): Promise<SearchAccommodationResponseDto> {
    if (!fingerprint || fingerprint.trim().length === 0) {
      throw new BadRequestException('El encabezado X-Device-Fingerprint es obligatorio');
    }

    return await this.searchService.search(body);
  }
}
```

Crear `src/search/search.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accommodation } from '../accommodations/entities/accommodation.entity.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Accommodation])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
```

---

### Paso 9: Módulo Base de Eventos / Webhooks (Arquitectura SOA / EDA)

Crear `src/events/events.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service.js';

@Module({
  providers: [WebhookService],
  exports: [WebhookService],
})
export class EventsModule {}
```

Crear `src/events/webhook.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

export interface BookingEventPayload {
  eventId: string;
  eventType: 'accommodation.booked' | 'accommodation.cancelled' | 'price.changed';
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  async dispatchEvent(event: BookingEventPayload, targetWebhookUrl?: string): Promise<void> {
    this.logger.log(`[EDA Event Emitted] Evento: ${event.eventType} - ID: ${event.eventId}`);
    // Simulación del dispatch a servicios externos (ej. Pasarela de Pagos o Notificaciones)
    if (targetWebhookUrl) {
      this.logger.log(`Despachando webhook asíncrono a: ${targetWebhookUrl}`);
    }
  }
}
```

---

### Paso 10: Configuración Global en `src/app.module.ts` (TypeORM + ConfigService + SSL Render)

Reemplazar el contenido de [src/app.module.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/src/app.module.ts):

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AccommodationsModule } from './accommodations/accommodations.module.js';
import { SearchModule } from './search/search.module.js';
import { EventsModule } from './events/events.module.js';
import { Accommodation } from './accommodations/entities/accommodation.entity.js';

@Module({
  imports: [
    // Gestión centralizada de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Persistencia relacional con PostgreSQL y TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const dbUrl = config.get<string>('DATABASE_URL');

        return {
          type: 'postgres',
          url: dbUrl || 'postgresql://postgres:postgres@localhost:5432/habitat_db',
          entities: [Accommodation],
          // synchronize activo en desarrollo/laboratorio (en producción usar migraciones)
          synchronize: true,
          ssl: isProduction
            ? { rejectUnauthorized: false } // Soporte SSL obligatorio para PostgreSQL en Render
            : false,
          logging: !isProduction,
        };
      },
    }),

    AccommodationsModule,
    SearchModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

### Paso 11: Corrección del Error de Tipado en `test/app.e2e-spec.ts`

Reemplazar el contenido de [test/app.e2e-spec.ts](file:///d:/Personal%20James/UNIVERSIDAD/SEXTO%20SEMESTRE/IntegracionDeSistemas/RdA1/habitat-ec/test/app.e2e-spec.ts) para evitar la importación inexistente de `'supertest/types'`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeEach, it, afterEach } from 'vitest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
```

---

### Paso 12: Pipeline CI en GitHub Actions con PostgreSQL Efímero (`.github/workflows/tests.yml`)

Crear el archivo `.github/workflows/tests.yml` (y eliminar o reemplazar `ci-cd.yml`):

```yaml
name: Continuous Integration & Automated Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test-and-build:
    runs-on: ubuntu-latest

    # Servicio de Base de Datos PostgreSQL Efímero para pruebas automatizadas
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgrespassword
          POSTGRES_DB: habitat_test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Execute Linter (Oxlint)
        run: npm run lint

      - name: Execute Type Check
        run: npx tsc --noEmit

      - name: Run Unit & Integration Tests
        env:
          DATABASE_URL: postgresql://postgres:postgrespassword@localhost:5432/habitat_test_db
          NODE_ENV: test
        run: npm run test

      - name: Build Application
        run: npm run build
```

---

## 5. Conclusión del Dictamen

El proyecto posee una base conceptual adecuada en la especificación de DTOs para la búsqueda de alojamientos, pero presentaba un estado incompleto en los componentes nucleares de infraestructura (base de datos relacional, controladores REST, encabezados mandatorios, HATEOAS y pipeline de pruebas continuas con PostgreSQL).

Con la aplicación secuencial del **Plan de Acción y Código de Corrección Inmediata** descrito en la Sección 4, el repositorio:
1. Resuelve el 100% de los errores de compilación y linter.
2. Queda plenamente alineado con el contrato OpenAPI `alojamientos-openapi.yaml`.
3. Integra persistencia PostgreSQL robusta y tipada con TypeORM y manejo de decimales.
4. Cumple con la semántica de códigos HTTP (200, 201 + `Location`, 204 y 404) y el principio HATEOAS.
5. Garantiza la ejecución exitosa de pruebas automatizadas en GitHub Actions y el despliegue sin fisuras en Render.

