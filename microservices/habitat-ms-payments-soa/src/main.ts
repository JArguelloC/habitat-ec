import { NestFactory } from '@nestjs/core';
import { PaymentsSoaModule } from './payments-soa.module.js';

process.env.TZ = process.env.TZ || 'America/Guayaquil';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsSoaModule);
  app.enableCors();
  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(
    `🚀 [habitat-ms-payments-soa] Servicio SOA + Outbox Worker RabbitMQ activo en puerto ${port}`,
  );
}
void bootstrap();

