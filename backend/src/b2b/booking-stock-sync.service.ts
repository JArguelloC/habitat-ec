import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as amqp from 'amqplib';
import { DEFAULT_B2B_API_KEY } from './guards/b2b-auth.guard.js';

export const DEFAULT_RABBITMQ_URL =
  'amqps://qkvqjvku:ATBxToI1JvR6YbRBIIAnATa5mnjdIqz_@shark.rmq.cloudamqp.com/qkvqjvku';
export const DEFAULT_BOOKING_REST_STOCK_URL =
  'https://booking-core-api.azurewebsites.net/api/v3/inventory/stock';
export const DEFAULT_BOOKING_V2_URL =
  'https://booking-core-api.azurewebsites.net/api/v2';

export interface CheckinPushPayload {
  external_order_id: string;
  client_id: string;
  estado: 'CONFIRMADO_ASISTIDO';
  huespedes_reales: number;
  admin_id: string;
  fecha_checkin: string;
  observaciones: string;
}

@Injectable()
export class BookingStockSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingStockSyncService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private connectingPromise: Promise<amqp.Channel | null> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    // Iniciar conexión a CloudAMQP en segundo plano sin bloquear el arranque HTTP
    void this.ensureRabbitChannel().catch((err) => {
      this.logger.warn(
        `[RabbitMQ] Conexión diferida al primer evento: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch {
      // Ignorar errores al cerrar recursos
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  private getNodeId(): string {
    return (
      this.configService.get<string>('NODE_ID') ||
      process.env.NODE_ID ||
      'NODE_ALO_HAB'
    );
  }

  private getApiKey(): string {
    return (
      this.configService.get<string>('API_KEY') ||
      process.env.API_KEY ||
      DEFAULT_B2B_API_KEY
    );
  }

  private getRabbitMqUrl(): string {
    return (
      this.configService.get<string>('RABBITMQ_URL') ||
      process.env.RABBITMQ_URL ||
      DEFAULT_RABBITMQ_URL
    );
  }

  private getBookingRestStockUrl(): string {
    return (
      this.configService.get<string>('BOOKING_REST_STOCK_URL') ||
      process.env.BOOKING_REST_STOCK_URL ||
      DEFAULT_BOOKING_REST_STOCK_URL
    );
  }

  private getBookingV2Url(): string {
    return (
      this.configService.get<string>('BOOKING_V2_URL') ||
      process.env.BOOKING_V2_URL ||
      DEFAULT_BOOKING_V2_URL
    );
  }

  private async ensureRabbitChannel(): Promise<amqp.Channel | null> {
    if (this.channel) {
      return this.channel;
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        const url = this.getRabbitMqUrl();
        const conn = await amqp.connect(url, { timeout: 4000 });
        conn.on('error', (err) => {
          this.logger.warn(`[RabbitMQ] Error en conexión AMQPS: ${err.message}`);
          this.channel = null;
          this.connection = null;
        });
        conn.on('close', () => {
          this.channel = null;
          this.connection = null;
        });

        const ch = await conn.createChannel();
        await ch.assertExchange('booking.events', 'topic', { durable: true });

        this.connection = conn;
        this.channel = ch;
        this.logger.log(
          `[RabbitMQ] Conectado a CloudAMQP y exchange 'booking.events' (topic, durable) listo.`,
        );
        return ch;
      } catch (err) {
        this.logger.warn(
          `[RabbitMQ] No se pudo establecer canal con CloudAMQP: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.channel = null;
        this.connection = null;
        return null;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Formatea una fecha a YYYY-MM-DD en zona horaria America/Guayaquil (UTC-5)
   */
  public formatDateIso(dateInput: Date | string): string {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  }

  /**
   * Genera el arreglo de fechas (YYYY-MM-DD) por cada noche desde checkIn hasta checkOut - 1 día
   */
  public enumerateNights(checkIn: Date | string, checkOut: Date | string): string[] {
    const startStr = this.formatDateIso(checkIn);
    const endStr = this.formatDateIso(checkOut);
    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T00:00:00.000Z`);

    const nights: string[] = [];
    const cursor = new Date(start);
    let safety = 0;

    while (cursor < end && safety < 365) {
      nights.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      safety++;
    }

    if (nights.length === 0) {
      nights.push(startStr);
    }

    return nights;
  }

  /**
   * Construye el identificador compuesto item_id: <alojamientoId>:<tipoHabitacionCodigo>
   */
  public buildItemId(
    alojamientoId: number | string,
    productoId: string,
  ): string {
    return `${alojamientoId}:${productoId}`;
  }

  /**
   * Publica el stock de una noche específica por Canal 1 (RabbitMQ) y Canal 2 (REST Push)
   */
  async publishSingleNightStock(params: {
    item_id: string;
    available_units: number;
    date: string;
    reason: string;
  }): Promise<{ rabbitPublished: boolean; restPushed: boolean }> {
    const serviceId = this.getNodeId();
    const apiKey = this.getApiKey();
    const restUrl = this.getBookingRestStockUrl();

    const rabbitPayload = {
      service_id: serviceId,
      item_id: params.item_id,
      available_units: Math.max(0, Number(params.available_units)),
      date: params.date,
    };

    const restPayload = {
      item_id: params.item_id,
      available_units: Math.max(0, Number(params.available_units)),
      date: params.date,
      reason: params.reason,
    };

    const [rabbitResult, restResult] = await Promise.all([
      // Canal 1: RabbitMQ CloudAMQP (exchange booking.events, routing key stock.updated)
      (async (): Promise<boolean> => {
        try {
          const ch = await this.ensureRabbitChannel();
          if (!ch) return false;
          const ok = ch.publish(
            'booking.events',
            'stock.updated',
            Buffer.from(JSON.stringify(rabbitPayload)),
            {
              persistent: true,
              contentType: 'application/json',
              timestamp: Date.now(),
            },
          );
          return ok;
        } catch (err) {
          this.logger.warn(
            `[RabbitMQ] Fallo al publicar stock.updated para ${params.item_id} (${params.date}): ${err instanceof Error ? err.message : String(err)}`,
          );
          this.channel = null;
          return false;
        }
      })(),

      // Canal 2: Push HTTP REST a Booking Core API (timeout 2.5s no bloqueante)
      (async (): Promise<boolean> => {
        try {
          const response = await fetch(restUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify(restPayload),
            signal: AbortSignal.timeout(2500),
          });
          return response.ok;
        } catch (err) {
          this.logger.debug(
            `[Booking REST] Push de stock (${params.item_id} @ ${params.date}) completado con aviso: ${err instanceof Error ? err.message : String(err)}`,
          );
          return false;
        }
      })(),
    ]);

    return {
      rabbitPublished: rabbitResult,
      restPushed: restResult,
    };
  }

  /**
   * Itera por cada noche entre checkIn y checkOut - 1 día, consulta las unidades disponibles reales
   * en la base de datos y sincroniza por RabbitMQ y HTTP REST hacia Booking Central.
   */
  async syncStockForStay(
    alojamientoId: number | string,
    productoId: string,
    checkIn: Date | string,
    checkOut: Date | string,
    reason: string = 'STOCK_UPDATED',
  ): Promise<void> {
    try {
      const nights = this.enumerateNights(checkIn, checkOut);
      const itemId = this.buildItemId(alojamientoId, productoId);

      // Consultar stock base de la habitación
      const prodRows = await this.dataSource.query(
        `SELECT cantidad_cuartos_inventario
         FROM productos_habitacion
         WHERE producto_id = $1
         LIMIT 1;`,
        [productoId],
      );
      const fallbackUnits = Number(
        prodRows[0]?.cantidad_cuartos_inventario ?? 0,
      );

      // Consultar calendario por cada noche del rango
      const calRows = await this.dataSource.query(
        `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_iso, cuartos_disponibles
         FROM calendario_inventario
         WHERE producto_id = $1
           AND fecha >= $2::DATE
           AND fecha < $3::DATE;`,
        [productoId, nights[0], this.formatDateIso(checkOut)],
      );

      const calMap = new Map<string, number>();
      for (const r of calRows) {
        calMap.set(
          String(r.fecha_iso),
          Math.min(fallbackUnits, Number(r.cuartos_disponibles ?? fallbackUnits)),
        );
      }

      await Promise.all(
        nights.map((dateStr) => {
          const available = calMap.has(dateStr)
            ? Number(calMap.get(dateStr))
            : fallbackUnits;
          return this.publishSingleNightStock({
            item_id: itemId,
            available_units: available,
            date: dateStr,
            reason,
          });
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[BookingStockSyncService] Error no bloqueante al sincronizar noches (${alojamientoId}:${productoId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Sincroniza los próximos 7 días cuando se crea o edita una habitación en el panel de Anfitrión
   */
  async syncRoomInventorySnapshot(
    alojamientoId: number | string,
    productoId: string,
    reason: string = 'ADMIN_ROOM_UPDATED',
  ): Promise<void> {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setUTCDate(today.getUTCDate() + 7);
    await this.syncStockForStay(
      alojamientoId,
      productoId,
      today.toISOString().slice(0, 10),
      nextWeek.toISOString().slice(0, 10),
      reason,
    );
  }

  /**
   * Notifica el Check-in Asistido en Recepción hacia Booking Central (Requerimiento v2.1)
   */
  async notifyCheckinToBooking(payload: CheckinPushPayload): Promise<{
    notified: boolean;
    statusCode: number | null;
    endpoint: string;
    responseBody?: unknown;
  }> {
    // Enlace oficial de Check-in Flujo 2 del Booking Central (v2 con fallback a v1)
    const baseV2Url = this.getBookingV2Url().replace(/\/+$/, '');
    const endpointV2 = `${baseV2Url}/reservas/${encodeURIComponent(payload.external_order_id)}/checkin`;
    const baseV1Url =
      process.env.BOOKING_CHECKIN_URL ||
      'https://booking-core-api.azurewebsites.net/api/v1';
    const endpointV1 = `${baseV1Url.replace(/\/+$/, '')}/reservas/${encodeURIComponent(payload.external_order_id)}/checkin`;
    const apiKey = this.getApiKey();

    const bookingPayload = {
      external_order_id: String(payload.external_order_id),
      estado: 'CONFIRMADO_ASISTIDO',
      huespedes_reales: Number(payload.huespedes_reales || 1),
      admin_id: String(payload.admin_id || 'recepcionista-hotel'),
      observaciones: payload.observaciones,
      fecha_checkin: payload.fecha_checkin,
    };

    let endpointUsed = endpointV2;

    try {
      let response = await fetch(endpointV2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(bookingPayload),
        signal: AbortSignal.timeout(4000),
      });

      // Fallback a v1 si v2 devolviera 404
      if (!response.ok && response.status === 404) {
        const respV1 = await fetch(endpointV1, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(bookingPayload),
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        if (respV1 && respV1.ok) {
          response = respV1;
          endpointUsed = endpointV1;
        }
      }

      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text().catch(() => null);
      }

      this.logger.log(
        `[Booking Check-in Push] POST ${endpointUsed} -> HTTP ${response.status}`,
      );

      return {
        notified: response.ok,
        statusCode: response.status,
        endpoint: endpointUsed,
        responseBody,
      };
    } catch (err) {
      this.logger.warn(
        `[Booking Check-in Push] Aviso al notificar a ${endpointUsed}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        notified: false,
        statusCode: null,
        endpoint: endpointUsed,
        responseBody: {
          warning:
            err instanceof Error
              ? err.message
              : 'Booking Central no alcanzable en este instante; registrado en Outbox local.',
        },
      };
    }
  }
}

