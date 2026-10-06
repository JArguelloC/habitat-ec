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