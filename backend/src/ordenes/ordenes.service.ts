import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'node:crypto';
import { OrderPreviewDto } from './dto/order-preview.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdenesService {
  constructor(private readonly dataSource: DataSource) {}

  async obtenerCalendario(productoId: string, inicio?: string, fin?: string) {
    let query = `
      SELECT producto_id, fecha, estado_dia, tarifa_noche, order_preview_id, order_id_actual, actualizado_en
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

  async crearOrdenIdempotente(
    idempotencyKey: string,
    correlationId: string,
    dto: CreateOrderDto,
    authUserId?: string,
  ) {
    const cid = correlationId || crypto.randomUUID();

    // Resolver el usuario owner (si está autenticado se usa su ID, o se busca por email o se usa cuenta cliente)
    let ownerId = authUserId;
    if (!ownerId) {
      const userRows = await this.dataSource.query(
        `SELECT usuario_id FROM usuarios WHERE correo = $1 LIMIT 1;`,
        [dto.customer.email.toLowerCase().trim()],
      );
      if (userRows.length > 0) {
        ownerId = userRows[0].usuario_id;
      } else {
        // Asignar al superadmin o primer usuario si es reserva express pública
        const fallbackRows = await this.dataSource.query(
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

    // Invocación del Stored Procedure transaccional e idempotente que valida la vista 5FN
    const query = `
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

    const result = await this.dataSource.query(query, [
      idempotencyKey,
      dto.orderPreviewId,
      ownerId,
      dto.paymentReference,
      dto.customer.nombre.trim(),
      dto.customer.apellido.trim(),
      dto.customer.email.toLowerCase().trim(),
      dto.canalProtocolo || 'WEB_REST',
      dto.politicaCodigo || 'FREE_CANCELLATION',
      cid,
    ]);

    const row = result[0];
    const orderId = row.r_order_id;

    // Insertar distribución de niños si aplica (4FN)
    if (dto.ninosEdades && dto.ninosEdades.length > 0) {
      for (const edad of dto.ninosEdades) {
        await this.dataSource.query(
          `INSERT INTO orden_distribucion_ninos (order_id, numero_cuarto, edad_nino)
           VALUES ($1, 1, $2);`,
          [orderId, edad],
        );
      }
    }

    return {
      orderId: row.r_order_id,
      locator: row.r_locator,
      status: row.r_status,
      totalPrice: Number(row.r_total_price),
      currency: row.r_currency,
      creationDate: row.r_creation_date,
    };
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

