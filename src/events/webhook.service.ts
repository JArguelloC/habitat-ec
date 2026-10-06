import { Injectable, Logger } from '@nestjs/common';

export interface BookingEventPayload {
  eventId: string;
  eventType: 'accommodation.booked' | 'accommodation.cancelled' | 'price.changed';
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  async dispatchEvent(event: BookingEventPayload, targetWebhookUrl?: string): Promise<void> {
    this.logger.log(`[EDA Event Emitted] Evento: ${event.eventType} - ID: ${event.eventId}`);
    // Simulación del dispatch a servicios externos (ej. Pasarela de Pagos o Notificaciones)
    if (targetWebhookUrl) {
      this.logger.log(`Despachando webhook asíncrono a: ${targetWebhookUrl}`);
    }
  }
}

