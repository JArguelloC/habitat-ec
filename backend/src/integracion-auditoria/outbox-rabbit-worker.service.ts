import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import * as amqp from 'amqplib';
import { DEFAULT_RABBITMQ_URL } from '../b2b/booking-stock-sync.service.js';

/**
 * Worker Asíncrono del Transactional Outbox conectado a RabbitMQ (CloudAMQP)
 * Microservicio 3: habitat-ms-payments-soa (Paradigma SOA + EDA)
 */
@Injectable()
export class OutboxRabbitWorkerService {
  private readonly logger = new Logger(OutboxRabbitWorkerService.name);
  private isProcessing = false;

  constructor(private readonly dataSource: DataSource) {}

  @Cron('*/45 * * * * *')
  async pollAndPublishOutboxEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingRows = await this.dataSource.query(
        `SELECT event_id, correlation_id, event_type, resource_id, protocolo_origen, data
         FROM outbox_events
         WHERE estado_despacho = 'PENDIENTE'
         ORDER BY "timestamp" ASC
         LIMIT 20;`,
      );

      if (pendingRows.length === 0) {
        return;
      }

      const rabbitUrl = process.env.RABBITMQ_URL || DEFAULT_RABBITMQ_URL;
      let conn: amqp.ChannelModel | null = null;
      let ch: amqp.Channel | null = null;

      try {
        conn = await amqp.connect(rabbitUrl, { timeout: 4000 });
        ch = await conn.createChannel();
        await ch.assertExchange('booking.events', 'topic', { durable: true });

        for (const ev of pendingRows) {
          const routingKey = `habitat.outbox.${String(ev.event_type || 'event').toLowerCase()}`;
          const messagePayload = {
            service_id: process.env.NODE_ID || 'NODE_ALO_HAB',
            event_id: ev.event_id,
            correlation_id: ev.correlation_id,
            event_type: ev.event_type,
            resource_id: ev.resource_id,
            protocolo_origen: ev.protocolo_origen,
            data: ev.data,
            published_at: new Date().toISOString(),
          };

          ch.publish(
            'booking.events',
            routingKey,
            Buffer.from(JSON.stringify(messagePayload)),
            {
              persistent: true,
              contentType: 'application/json',
            },
          );

          await this.dataSource.query(
            `UPDATE outbox_events
             SET estado_despacho = 'ENVIADO',
                 intentos = intentos + 1,
                 procesado_en = NOW()
             WHERE event_id = $1;`,
            [ev.event_id],
          );
        }

        this.logger.log(
          `[OutboxRabbitWorker] Publicados ${pendingRows.length} evento(s) del Transactional Outbox hacia CloudAMQP (exchange: booking.events).`,
        );
      } catch (err) {
        this.logger.debug(
          `[OutboxRabbitWorker] Reintento diferido de Outbox: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        try {
          if (ch) await ch.close();
          if (conn) await conn.close();
        } catch {
          // Ignorar errores al cerrar
        }
      }
    } catch {
      // Ignorar si la tabla aún no existe en entorno de pruebas
    } finally {
      this.isProcessing = false;
    }
  }
}

