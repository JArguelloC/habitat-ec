import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alojamiento])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
