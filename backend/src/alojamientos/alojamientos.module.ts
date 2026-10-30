import { Module } from '@nestjs/common';
import { AlojamientosService } from './alojamientos.service.js';
import { AlojamientosAdminController } from './alojamientos-admin.controller.js';
import { AlojamientosPublicController } from './alojamientos-public.controller.js';

@Module({
  controllers: [AlojamientosAdminController, AlojamientosPublicController],
  providers: [AlojamientosService],
  exports: [AlojamientosService],
})
export class AlojamientosModule {}
