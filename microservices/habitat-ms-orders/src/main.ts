import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import { OrdersModule } from './orders.module.js';

process.env.TZ = process.env.TZ || 'America/Guayaquil';

async function bootstrap() {
  const app = await NestFactory.create(OrdersModule);

  const grpcPort = process.env.GRPC_PORT || '50051';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'habitat.inventory.v1',
      protoPath: join(process.cwd(), 'proto/inventory.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  const httpPort = process.env.PORT || 3002;
  await app.listen(httpPort);
  console.log(
    `🚀 [habitat-ms-orders] Motor gRPC (:${grpcPort}) + HTTP (:${httpPort}) activo`,
  );
}
void bootstrap();
