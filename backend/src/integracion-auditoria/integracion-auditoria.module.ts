import { Module } from '@nestjs/common';
import { IntegracionAuditoriaController } from './integracion-auditoria.controller.js';
import { IntegracionAuditoriaService } from './integracion-auditoria.service.js';
import { OutboxRabbitWorkerService } from './outbox-rabbit-worker.service.js';

@Module({
  controllers: [IntegracionAuditoriaController],
  providers: [IntegracionAuditoriaService, OutboxRabbitWorkerService],
  exports: [IntegracionAuditoriaService, OutboxRabbitWorkerService],
})
export class IntegracionAuditoriaModule {}

