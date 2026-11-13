import { Controller, Sse, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { RealtimeEventsService } from './realtime-events.service.js';

@ApiTags('Admin Realtime Events (SSE)')
@Controller({ path: 'admin/realtime', version: '1' })
export class RealtimeEventsController {
  constructor(private readonly realtimeEventsService: RealtimeEventsService) {}

  @Sse('stream')
  @ApiOperation({
    summary:
      'Canal SSE unidireccional en tiempo real para actualización instantánea de Recepción, Liquidaciones e Inventario',
  })
  streamEvents(@Query('alojamientoId') _alojamientoId?: string): Observable<{ data: string }> {
    // Heartbeat cada 25 segundos para mantener activo el proxy de Render / Vercel
    const heartbeat$ = interval(25000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }),
      })),
    );

    return merge(this.realtimeEventsService.getEventStream(), heartbeat$);
  }
}

