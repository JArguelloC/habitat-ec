import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';

// Priorizar IPv4 para prevenir timeouts por resolución IPv6 en Windows con Neon
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  // Interceptor global de trazabilidad (Correlation ID)
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  // Filtro global estandarizado de excepciones (Mapeo de Stored Procedures y Postgres)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Validación estricta de DTOs contra asignación masiva
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Habilitar CORS para conectar con el frontend en React
  app.enableCors();

  // Documentación Swagger / OpenAPI 3.0.3 agrupada por módulos de dominio
  const config = new DocumentBuilder()
    .setTitle('Hábitat EC Core API')
    .setDescription(
      'API REST para la plataforma de alojamientos sostenibles Hábitat EC con roles Superadmin, Admin y Cliente. Arquitectura en 5FN desplegada en Neon Serverless.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag(
      '1. Autenticación y Superadmin',
      'Login, emisión de JWT y registro de administradores de alojamiento.',
    )
    .addTag(
      '1.1 Gestión de Usuarios e Identidad',
      'Auditoría y control de usuarios, roles, scopes y fingerprints antifraude.',
    )
    .addTag(
      '2. Catálogos Maestros y 5FN',
      'Geografía, amenidades ecológicas, reglas y matriz 5FN (Canales x Políticas).',
    )
    .addTag(
      '2. Alojamientos (Admin / Anfitrión)',
      'Publicación, inventario, reglas, fotos y contratos 5FN gestionados por anfitriones.',
    )
    .addTag(
      '3. Catálogo y Búsqueda (Público)',
      'Búsqueda y descubrimiento de eco-lodges y cabañas para viajeros.',
    )
    .addTag(
      '4. Disponibilidad y Reservas (Cliente)',
      'Bloqueo pesimista temporal (Hold 15 min NOWAIT), cálculo de tarifas y checkout idempotente.',
    )
    .addTag(
      '5. Pagos, Liquidaciones y Reseñas',
      'Cobros idempotentes, liquidación al anfitrión y reseñas con desglose y trigger automático.',
    )
    .addTag(
      '6. Integración EDA, Webhooks y Auditoría',
      'Gestión de webhooks, Transactional Outbox Pattern y auditoría forense.',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Servidor listo en: http://localhost:${port}/api/v1`);
  console.log(`📑 Swagger disponible en: http://localhost:${port}/api/docs`);
}
void bootstrap();
