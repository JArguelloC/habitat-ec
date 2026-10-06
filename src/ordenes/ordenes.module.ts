import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reserva } from './entities/reserva.entity.js';
import { CotizacionPrevia } from './entities/cotizacion-previa.entity.js';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { OrdenesController } from './ordenes.controller.js';
import { OrdenesService } from './ordenes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Reserva, CotizacionPrevia, Alojamiento])],
  controllers: [OrdenesController],
  providers: [OrdenesService],
})
export class OrdenesModule {}

