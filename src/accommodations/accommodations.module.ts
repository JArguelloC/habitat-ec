import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { AccommodationsService } from './accommodations.service.js';
import { AccommodationsController } from './accommodations.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alojamiento])],
  controllers: [AccommodationsController],
  providers: [AccommodationsService],
  exports: [AccommodationsService, TypeOrmModule],
})
export class AccommodationsModule {}
