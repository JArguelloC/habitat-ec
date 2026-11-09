import { Module } from '@nestjs/common';
import { CatalogGraphqlController } from './catalog-graphql.controller.js';

@Module({
  controllers: [CatalogGraphqlController],
})
export class CatalogGraphqlModule {}

