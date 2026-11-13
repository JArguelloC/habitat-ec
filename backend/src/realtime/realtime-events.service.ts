import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AdminRealtimeEvent {
  type:
    | 'ORDER_CREATED'
    | 'ORDER_CANCELLED'
    | 'CHECKIN_CONFIRMED'
    | 'CHECKOUT_CONFIRMED'
    | 'ROOM_CLEANED'
    | 'ROOM_STATUS_CHANGED'
    | 'SETTLEMENT_UPDATED'
    | 'PING'
    | string;
  alojamientoId?: number;
  orderId?: string;
  locator?: string;
  huesped?: string;
  payload?: Record<string, any>;
  data?: Record<string, any>;
  timestamp?: string;
}

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private readonly eventSubject = new Subject<AdminRealtimeEvent>();

  emit(event: AdminRealtimeEvent): void {
    const enriched: AdminRealtimeEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    this.logger.log(
      `[RealtimeEvents] Emitiendo ${enriched.type} para Alojamiento=${enriched.alojamientoId || 'Global'} Orden=${enriched.locator || enriched.orderId || '-'}`,
    );
    this.eventSubject.next(enriched);
  }

  getEventStream(): Observable<{ data: string }> {
    return this.eventSubject.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}
