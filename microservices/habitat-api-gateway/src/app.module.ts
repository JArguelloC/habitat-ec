import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GatewayController } from './gateway.controller.js';
import { EsbOrchestratorService } from './esb-orchestrator.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [GatewayController],
  providers: [EsbOrchestratorService],
})
export class AppModule {}
