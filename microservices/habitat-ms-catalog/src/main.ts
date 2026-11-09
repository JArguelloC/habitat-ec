import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog.module.js';

process.env.TZ = process.env.TZ || 'America/Guayaquil';

async function bootstrap() {
  const app = await NestFactory.create(CatalogModule);
  app.enableCors();
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 [habitat-ms-catalog] Microservicio GraphQL + REST activo en puerto ${port}`);
}
void bootstrap();
