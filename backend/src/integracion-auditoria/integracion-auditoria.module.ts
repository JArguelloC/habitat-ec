import { Module } from '@nestjs/common';
import { IntegracionAuditoriaController } from './integracion-auditoria.controller.js';
import { IntegracionAuditoriaService } from './integracion-auditoria.service.js';

@Module({
  controllers: [IntegracionAuditoriaController],
  providers: [IntegracionAuditoriaService],
  exports: [IntegracionAuditoriaService],
})
export class IntegracionAuditoriaModule {}

