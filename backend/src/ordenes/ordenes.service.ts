import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import * as crypto from 'node:crypto';
import { OrderPreviewDto } from './dto/order-preview.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdenesService {
  private readonly logger = new Logger(OrdenesService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Cron Job cada 2 minutos:
   * Restablece el stock en 'calendario_inventario' para cualquier Hold
   * que haya superado los 15 minutos de TTL sin concretarse en orden.
   */
  @Cron('*/2 * * * *')
  async liberarHoldsExpiradosCron() {
    try {
      const sql = `
        WITH holds_expirados AS (
          UPDATE order_previews_holds
          SET estado_preview = 'EXPIRADO'
          WHERE expira_en < NOW() AND estado_preview = 'ACTIVO'
          RETURNING producto_id, checkin, checkout, num_cuartos
        )
        UPDATE calendario_inventario ci
        SET cuartos_disponibles = LEAST(ci.cuartos_totales, ci.cuartos_disponibles + he.num_cuartos),
            estado_dia = 'DISPONIBLE'
        FROM holds_expirados he
        WHERE ci.producto_id = he.producto_id
          AND ci.fecha >= he.checkin
          AND ci.fecha < he.checkout;
      `;

      await this.dataSource.query(sql);
      this.logger.debug(
        'Purga periódica de holds expirados ejecutada exitosamente.',
      );
    } catch (error) {
      this.logger.error(
        'Error durante la liberación periódica de holds expirados:',
        error,
      );
    }
  }

  async obtenerCalendario(productoId: string, inicio?: string, fin?: string) {
    let query = `
      SELECT producto_id AS "productoId",
             fecha,
             estado_dia AS "estadoDia",
             tarifa_noche AS "tarifaNoche",
             cuartos_totales AS "cuartosTotales",
             cuartos_disponibles AS "cuartosDisponibles",
             order_preview_id AS "orderPreviewId",
             order_id_actual AS "orderIdActual",
             actualizado_en AS "actualizadoEn"
      FROM calendario_inventario
      WHERE producto_id = $1
    `;
    const params: any[] = [productoId];

    if (inicio && fin) {
      query += ` AND fecha >= $2::DATE AND fecha <= $3::DATE`;
      params.push(inicio, fin);
    }

    query += ` ORDER BY fecha ASC;`;
    return this.dataSource.query(query, params);
  }

  async generarOrderPreview(
    dto: OrderPreviewDto,
    usuarioId?: string,
    correlationId?: string,
  ) {
    const cid = correlationId || crypto.randomUUID();
    const uid = usuarioId || null;
    const cuartos = dto.cuartos || 1;

    // Invocación directa del Stored Procedure de Hold pesimista NOWAIT (evita Overbooking)
    const query = `
      SELECT order_preview_id, total_price, currency, expires_at
      FROM sp_generar_order_preview(
        $1::BIGINT,
        $2::VARCHAR,
        $3::UUID,
        $4::DATE,
        $5::DATE,
        $6::SMALLINT,
        $7::SMALLINT,
        $8::UUID,
        'USD'::CHAR(3),
        15::INT
      );
    `;

    const result = await this.dataSource.query(query, [
      dto.alojamientoId,
      dto.productoId,
      uid,
      dto.checkin,
      dto.checkout,
      dto.adultos,
      cuartos,
      cid,
    ]);

    const row = result[0];
    return {
      orderPreviewId: row.order_preview_id,
      totalPrice: Number(row.total_price),
      currency: row.currency,
      expiresAt: row.expires_at,
    };
  }

  async confirmarReservaYPago(
    orderPreviewId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
    correlationId?: string,
    authUserId?: string,
  ) {
    const key = idempotencyKey || crypto.randomUUID();
    const cid = correlationId || crypto.randomUUID();

    // 1. Iniciar transacción atómica con QueryRunner de TypeORM
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Verificar idempotencia previa
      const ordenPrevia = await queryRunner.query(
        `SELECT o.order_id, o.locator, o.status, o.total_price, o.currency, o.created_at
         FROM ordenes o
         WHERE o.idempotency_key = $1::UUID LIMIT 1;`,
        [key],
      );

      if (ordenPrevia.length > 0) {
        await queryRunner.rollbackTransaction();
        const row = ordenPrevia[0];
        return {
          mensaje: 'Orden previamente confirmada (Idempotente).',
          orderId: row.order_id,
          locator: row.locator,
          status: row.status,
          totalPrice: Number(row.total_price),
          currency: row.currency,
          creationDate: row.created_at,
        };
      }

      // 3. Recuperar y validar el hold activo en order_previews_holds
      const holdRows = await queryRunner.query(
        `SELECT oph.order_preview_id, oph.alojamiento_id, oph.producto_id, oph.usuario_id,
                oph.checkin, oph.checkout, oph.num_adultos, oph.num_cuartos, oph.moneda,
                oph.precio_total_cotizado, oph.estado_preview, oph.expira_en, oph.correlation_id,
                a.propietario_id AS anfitrion_id,
                COALESCE(ci.comision_porcentaje, 15.0) AS comision_porcentaje
         FROM order_previews_holds oph
         JOIN alojamientos a ON oph.alojamiento_id = a.alojamiento_id
         LEFT JOIN canales_integracion ci ON ci.codigo_protocolo = $2
         WHERE oph.order_preview_id = $1::UUID;`,
        [orderPreviewId, dto.canalProtocolo || 'WEB_REST'],
      );

      if (holdRows.length === 0) {
        throw new NotFoundException(
          `El Hold / Preview con ID ${orderPreviewId} no existe.`,
        );
      }

      const hold = holdRows[0];

      if (
        hold.estado_preview === 'EXPIRADO' ||
        new Date(hold.expira_en) < new Date()
      ) {
        throw new BadRequestException(
          'El tiempo de retención de 15 minutos ha expirado. Por favor, cotice nuevamente.',
        );
      }

      if (hold.estado_preview === 'CONVERTIDO_EN_ORDEN') {
        throw new ConflictException(
          'Este Hold ya ha sido utilizado para confirmar una reserva previa.',
        );
      }

      // 4. Resolver usuario cliente / titular de la reserva
      let ownerId = authUserId || hold.usuario_id;
      if (!ownerId && dto.customer?.email) {
        const userRows = await queryRunner.query(
          `SELECT usuario_id FROM usuarios WHERE correo = $1 LIMIT 1;`,
          [dto.customer.email.toLowerCase().trim()],
        );
        if (userRows.length > 0) {
          ownerId = userRows[0].usuario_id;
        } else {
          // Fallback a cuenta principal si es reserva express
          const fallbackRows = await queryRunner.query(
            `SELECT usuario_id FROM usuarios ORDER BY creado_en ASC LIMIT 1;`,
          );
          ownerId = fallbackRows[0]?.usuario_id;
        }
      }

      if (!ownerId) {
        throw new BadRequestException(
          'No fue posible asociar la orden a un usuario cliente válido.',
        );
      }

      // 5. Simular / Generar el paymentReference interno
      const shortHash = crypto.randomUUID().slice(0, 8).toUpperCase();
      const paymentRef =
        dto.paymentReference ||
        dto.referenciaPasarela ||
        `PAY-AUTOPROC-${shortHash}`;
      const metodoPago = dto.metodoPago || 'TARJETA_CREDITO';
      const ultimosCuatro = dto.ultimosCuatro || '4242';

      // 6. Invocar sp_crear_orden_idempotente dentro de la misma transacción
      const spQuery = `
        SELECT r_order_id, r_locator, r_status, r_total_price, r_currency, r_creation_date
        FROM sp_crear_orden_idempotente(
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::VARCHAR,
          $5::VARCHAR,
          $6::VARCHAR,
          $7::VARCHAR,
          $8::VARCHAR,
          $9::VARCHAR,
          $10::UUID
        );
      `;

      const spResult = await queryRunner.query(spQuery, [
        key,
        orderPreviewId,
        ownerId,
        paymentRef,
        dto.customer?.nombre?.trim() || 'Huésped',
        dto.customer?.apellido?.trim() || 'Hábitat',
        dto.customer?.email?.toLowerCase()?.trim() || 'cliente@habitat-ec.com',
        dto.canalProtocolo || 'WEB_REST',
        dto.politicaCodigo || 'FREE_CANCELLATION',
        cid,
      ]);

      const ordenCreada = spResult[0];
      const orderId = ordenCreada.r_order_id;
      const montoTotal = Number(ordenCreada.r_total_price);

      // 7. Asentar la transacción financiera aprobada
      const txRows = await queryRunner.query(
        `INSERT INTO transacciones_pago (
            order_id, idempotency_key, correlation_id, metodo_pago,
            ultimos_cuatro, monto_cobrado, estado_pago, referencia_pasarela
         ) VALUES ($1, $2, $3, $4, $5, $6, 'APROBADO', $7)
         ON CONFLICT (idempotency_key) DO UPDATE SET estado_pago = 'APROBADO'
         RETURNING *;`,
        [
          orderId,
          key,
          cid,
          metodoPago,
          ultimosCuatro,
          montoTotal,
          paymentRef,
        ],
      );

      // 8. Generar la liquidación financiera al anfitrión (85% neto / 15% comisión)
      const comisionPct = Number(hold.comision_porcentaje || 15.0);
      const comisionPlataforma =
        Math.round(montoTotal * (comisionPct / 100) * 100) / 100;
      const montoNeto = Math.round((montoTotal - comisionPlataforma) * 100) / 100;

      const liqRows = await queryRunner.query(
        `INSERT INTO liquidaciones_anfitrion (
            order_id, anfitrion_id, monto_bruto, comision_plataforma, monto_neto_pagar, estado_liquidacion
         ) VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
         ON CONFLICT (order_id) DO UPDATE SET
            monto_bruto = EXCLUDED.monto_bruto,
            monto_neto_pagar = EXCLUDED.monto_neto_pagar
         RETURNING *;`,
        [orderId, hold.anfitrion_id, montoTotal, comisionPlataforma, montoNeto],
      );

      // 9. Asentar distribución de niños (4FN) si aplica
      if (dto.ninosEdades && dto.ninosEdades.length > 0) {
        for (const edad of dto.ninosEdades) {
          await queryRunner.query(
            `INSERT INTO orden_distribucion_ninos (order_id, numero_cuarto, edad_nino)
             VALUES ($1, 1, $2);`,
            [orderId, edad],
          );
        }
      }

      // 10. Marcar el hold como convertido en orden
      await queryRunner.query(
        `UPDATE order_previews_holds
         SET estado_preview = 'CONVERTIDO_EN_ORDEN'
         WHERE order_preview_id = $1::UUID;`,
        [orderPreviewId],
      );

      // 11. Emitir evento atómico en Transactional Outbox
      await queryRunner.query(
        `INSERT INTO outbox_events (
            correlation_id, event_type, resource_id, protocolo_origen, data, estado_despacho
         ) VALUES ($1, 'ORDER_CONFIRMED', $2, 'INTERNAL_CHECKOUT', $3::jsonb, 'PENDIENTE');`,
        [
          cid,
          String(orderId),
          JSON.stringify({
            orderId,
            locator: ordenCreada.r_locator,
            montoCobrado: montoTotal,
            referenciaPasarela: paymentRef,
            liquidacionId: liqRows[0]?.liquidacion_id,
            anfitrionId: hold.anfitrion_id,
            checkin: hold.checkin,
            checkout: hold.checkout,
          }),
        ],
      );

      // 12. Consolidar transacción ACID
      await queryRunner.commitTransaction();

      return {
        mensaje: 'Reserva y pago confirmados exitosamente.',
        orderId,
        locator: ordenCreada.r_locator,
        status: ordenCreada.r_status,
        totalPrice: montoTotal,
        currency: ordenCreada.r_currency,
        creationDate: ordenCreada.r_creation_date,
        pago: {
          referencia: paymentRef,
          metodo: metodoPago,
          ultimosCuatro,
          montoCobrado: montoTotal,
          transaccionId: txRows[0]?.transaccion_id,
        },
        liquidacion: {
          liquidacionId: liqRows[0]?.liquidacion_id,
          montoNetoAnfitrion: montoNeto,
          comisionPlataforma,
          estado: 'PENDIENTE',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async crearOrdenIdempotente(
    idempotencyKey: string,
    correlationId: string,
    dto: CreateOrderDto,
    authUserId?: string,
  ) {
    return this.confirmarReservaYPago(
      dto.orderPreviewId,
      dto,
      idempotencyKey,
      correlationId,
      authUserId,
    );
  }

  async cancelarOrden(orderId: string, idempotencyKey: string) {
    const key = idempotencyKey || crypto.randomUUID();

    // Invocación del Stored Procedure compensador Saga
    await this.dataSource.query(
      `SELECT sp_cancelar_orden_idempotente($1::UUID, $2::UUID);`,
      [orderId, key],
    );

    return {
      mensaje: 'Orden cancelada exitosamente y fechas liberadas en inventario.',
      orderId,
      status: 'CANCELLED',
    };
  }

  async listarMisReservas(usuarioId: string) {
    const query = `
      SELECT 
        o.order_id,
        o.locator,
        o.status,
        o.checkin,
        o.checkout,
        o.noches,
        o.number_of_adults,
        o.number_of_rooms,
        o.currency,
        o.total_price,
        o.payment_reference,
        o.creation_date,
        a.alojamiento_id,
        a.titulo AS alojamiento_titulo,
        a.direccion AS alojamiento_direccion,
        ph.producto_id,
        ph.nombre_producto,
        ci.codigo_protocolo AS canal,
        pc.codigo_politica AS politica_cancelacion,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'concepto', cc.codigo,
                'monto', ocd.monto
              )
            )
            FROM orden_cargos_desglose ocd
            JOIN conceptos_cargo cc ON ocd.concepto_id = cc.concepto_id
            WHERE ocd.order_id = o.order_id
          ), '[]'::json
        ) AS desglose_financiero,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('distribucionId', odn.distribucion_id, 'numeroCuarto', odn.numero_cuarto, 'edadNino', odn.edad_nino)
            )
            FROM orden_distribucion_ninos odn
            WHERE odn.order_id = o.order_id
          ), '[]'::json
        ) AS distribucion_ninos,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('modificacionId', om.modificacion_id, 'checkinAnterior', om.checkin_anterior, 'checkinNuevo', om.checkin_nuevo, 'precioNuevo', om.precio_nuevo)
            )
            FROM orden_modificaciones om
            WHERE om.order_id = o.order_id
          ), '[]'::json
        ) AS modificaciones
      FROM ordenes o
      JOIN alojamientos a ON o.alojamiento_id = a.alojamiento_id
      JOIN productos_habitacion ph ON o.producto_id = ph.producto_id
      JOIN canales_integracion ci ON o.canal_id = ci.canal_id
      JOIN politicas_cancelacion pc ON o.politica_id = pc.politica_id
      WHERE o.owner_id = $1
      ORDER BY o.creation_date DESC;
    `;

    return this.dataSource.query(query, [usuarioId]);
  }
}

