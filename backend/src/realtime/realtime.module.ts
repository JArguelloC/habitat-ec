import { Global, Module } from '@nestjs/common';
import { RealtimeEventsService } from './realtime-events.service.js';
import { RealtimeEventsController } from './realtime-events.controller.js';

@Global()
@Module({
  controllers: [RealtimeEventsController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}

