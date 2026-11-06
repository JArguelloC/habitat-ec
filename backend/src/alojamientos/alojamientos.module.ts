import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlojamientosService } from './alojamientos.service.js';
import { AlojamientosAdminController } from './alojamientos-admin.controller.js';
import { AlojamientosPublicController } from './alojamientos-public.controller.js';
import { Alojamiento } from './entities/alojamiento.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alojamiento])],
  controllers: [AlojamientosAdminController, AlojamientosPublicController],
  providers: [AlojamientosService],
  exports: [AlojamientosService],
})
export class AlojamientosModule {}
