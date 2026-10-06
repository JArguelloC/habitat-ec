import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuscripcionWebhook } from './entities/suscripcion-webhook.entity.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SuscripcionWebhook])],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}

