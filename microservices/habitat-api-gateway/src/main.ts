import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

process.env.TZ = process.env.TZ || 'America/Guayaquil';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'Idempotency-Key',
      'X-Correlation-ID',
    ],
    exposedHeaders: ['Idempotency-Key', 'Idempotent-Replayed', 'X-Correlation-ID'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 [habitat-api-gateway] ESB Orquestador activo en puerto ${port}`);
}
void bootstrap();

