import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Accommodation } from '../accommodations/entities/accommodation.entity.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Accommodation])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

