import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import * as amqp from 'amqplib';

const DEFAULT_RABBITMQ_URL =
  'amqps://qkvqjvku:ATBxToI1JvR6YbRBIIAnATa5mnjdIqz_@shark.rmq.cloudamqp.com/qkvqjvku';

@Injectable()
export class OutboxWorkerService {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private busy = false;

  constructor(private readonly dataSource: DataSource) {}

  @Cron('*/30 * * * * *')
  async processOutboxQueue(): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    try {
      const pending = await this.dataSource.query(
        `SELECT event_id, correlation_id, event_type, resource_id, protocolo_origen, data
         FROM outbox_events
         WHERE estado_despacho = 'PENDIENTE'
         ORDER BY "timestamp" ASC
         LIMIT 20;`,
      );
      if (pending.length === 0) return;

      const conn = await amqp.connect(
        process.env.RABBITMQ_URL || DEFAULT_RABBITMQ_URL,
        { timeout: 4000 },
      );
      const ch = await conn.createChannel();
      await ch.assertExchange('booking.events', 'topic', { durable: true });

      for (const ev of pending) {
        const routingKey = `habitat.outbox.${String(ev.event_type || 'event').toLowerCase()}`;
        ch.publish(
          'booking.events',
          routingKey,
          Buffer.from(
            JSON.stringify({
              service_id: process.env.NODE_ID || 'NODE_ALO_HAB',
              event_id: ev.event_id,
              correlation_id: ev.correlation_id,
              event_type: ev.event_type,
              resource_id: ev.resource_id,
              data: ev.data,
            }),
          ),
          { persistent: true, contentType: 'application/json' },
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

      await ch.close();
      await conn.close();
      this.logger.log(
        `[SOA Outbox Worker] Despachados ${pending.length} evento(s) a RabbitMQ CloudAMQP.`,
      );
    } catch (err) {
      this.logger.debug(
        `[SOA Outbox Worker] Ciclo diferido: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.busy = false;
    }
  }
}

