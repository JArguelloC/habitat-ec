import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración integral de CORS para integración con React y clientes externos
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Fingerprint', 'Idempotency-Key'],
    exposedHeaders: ['Location', 'Cache-Control'],
    credentials: true,
  });

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
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'Introduce tu token JWT Bearer para acceder a los endpoints protegidos',
      },
      'JWT-Auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[Habitat EC] Servidor iniciado en puerto: ${port}`);
}

void bootstrap();