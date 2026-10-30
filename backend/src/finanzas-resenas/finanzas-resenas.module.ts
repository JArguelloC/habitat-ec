import { Module } from '@nestjs/common';
import { FinanzasResenasController } from './finanzas-resenas.controller.js';
import { FinanzasResenasService } from './finanzas-resenas.service.js';

@Module({
  controllers: [FinanzasResenasController],
  providers: [FinanzasResenasService],
  exports: [FinanzasResenasService],
})
export class FinanzasResenasModule {}

