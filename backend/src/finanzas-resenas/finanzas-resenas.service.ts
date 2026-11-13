import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'node:crypto';
import { ProcesarPagoDto } from './dto/procesar-pago.dto.js';
import { CrearResenaDto } from './dto/crear-resena.dto.js';

@Injectable()
export class FinanzasResenasService {
  constructor(private readonly dataSource: DataSource) {}

  async procesarPago(
    dto: ProcesarPagoDto,
    idempotencyKey?: string,
    correlationId?: string,
  ) {
    const key = idempotencyKey || crypto.randomUUID();
    const cid = correlationId || crypto.randomUUID();

    // 1. Verificar idempotencia de la transacción
    const txExistente = await this.dataSource.query(
      `SELECT transaccion_id, order_id, monto_cobrado, estado_pago, referencia_pasarela, procesado_en
       FROM transacciones_pago
       WHERE idempotency_key = $1;`,
      [key],
    );

    if (txExistente.length > 0) {
      return {
        mensaje: 'Transacción previamente procesada (Idempotente).',
        transaccion: txExistente[0],
      };
    }

    // 2. Obtener datos de la orden y anfitrión
    const ordenRows = await this.dataSource.query(
      `SELECT o.order_id, o.locator, o.alojamiento_id, o.total_price, a.propietario_id AS anfitrion_id, ci.comision_porcentaje
       FROM ordenes o
       JOIN alojamientos a ON o.alojamiento_id = a.alojamiento_id
       JOIN canales_integracion ci ON o.canal_id = ci.canal_id
       WHERE o.order_id = $1;`,
      [dto.orderId],
    );

    if (ordenRows.length === 0) {
      throw new NotFoundException(`La orden con ID ${dto.orderId} no existe.`);
    }

    const orden = ordenRows[0];
    const precioEsperado = Number(orden.total_price);
    const montoBruto = Number(dto.montoCobrado);

    // Blindaje contra manipulación arbitraria de precios (Price Tampering)
    if (Math.abs(montoBruto - precioEsperado) > 0.01) {
      throw new BadRequestException(
        `Discrepancia en el monto a cobrar. Monto oficial de la orden: $${precioEsperado.toFixed(2)}, recibido: $${montoBruto.toFixed(2)}`,
      );
    }

    const comisionPct = Number(orden.comision_porcentaje || 15.0);
    const comisionPlataforma = Math.round(montoBruto * (comisionPct / 100) * 100) / 100;
    const montoNeto = Math.round((montoBruto - comisionPlataforma) * 100) / 100;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const esTransferencia = dto.metodoPago === 'TRANSFERENCIA';
      const estadoPagoFinal = esTransferencia ? 'PENDIENTE' : 'APROBADO';

      if (esTransferencia || dto.comprobanteUrl) {
        await queryRunner.query(
          `UPDATE ordenes
           SET status = $1,
               comprobante_url = COALESCE($2, comprobante_url)
           WHERE order_id = $3;`,
          [
            esTransferencia ? 'PENDIENTE_VERIFICACION' : 'CONFIRMED',
            dto.comprobanteUrl || null,
            dto.orderId,
          ],
        );
      }

      // 3. Insertar o actualizar transacción de pago
      const insertTx = await queryRunner.query(
        `INSERT INTO transacciones_pago (
            order_id, idempotency_key, correlation_id, metodo_pago,
            ultimos_cuatro, monto_cobrado, estado_pago, referencia_pasarela, comprobante_url
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO UPDATE SET
            estado_pago = EXCLUDED.estado_pago,
            comprobante_url = COALESCE(EXCLUDED.comprobante_url, transacciones_pago.comprobante_url)
         RETURNING *;`,
        [
          dto.orderId,
          key,
          cid,
          dto.metodoPago,
          dto.ultimosCuatro || null,
          montoBruto,
          estadoPagoFinal,
          dto.referenciaPasarela,
          dto.comprobanteUrl || null,
        ],
      );

      // 4. Generar liquidación al anfitrión
      const insertLiq = await queryRunner.query(
        `INSERT INTO liquidaciones_anfitrion (
            order_id, anfitrion_id, monto_bruto, comision_plataforma, monto_neto_pagar, estado_liquidacion
         ) VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
         ON CONFLICT (order_id) DO UPDATE SET
            monto_bruto = EXCLUDED.monto_bruto,
            monto_neto_pagar = EXCLUDED.monto_neto_pagar
         RETURNING *;`,
        [dto.orderId, orden.anfitrion_id, montoBruto, comisionPlataforma, montoNeto],
      );

      // 5. Emitir evento en el Transactional Outbox para Webhooks / Notificaciones B2B
      await queryRunner.query(
        `INSERT INTO outbox_events (
            correlation_id, event_type, resource_id, protocolo_origen, data, estado_despacho
         ) VALUES ($1, $2, $3, $4, $5::jsonb, 'PENDIENTE');`,
        [
          cid,
          esTransferencia ? 'ORDER_PENDING_VERIFICATION' : 'ORDER_CONFIRMED',
          String(dto.orderId),
          dto.proveedorPasarela || 'PAYPHONE_EC',
          JSON.stringify({
            orderId: dto.orderId,
            locator: orden.locator,
            montoCobrado: montoBruto,
            referenciaPasarela: dto.referenciaPasarela,
            comprobanteUrl: dto.comprobanteUrl || null,
            proveedorPasarela: dto.proveedorPasarela || 'PAYPHONE_EC',
            liquidacionId: insertLiq[0]?.liquidacion_id,
          }),
        ],
      );

      await queryRunner.commitTransaction();

      return {
        mensaje: esTransferencia
          ? 'Comprobante registrado. Reserva pendiente de verificación.'
          : 'Pago procesado exitosamente y liquidación generada.',
        proveedorPasarela: dto.proveedorPasarela || 'PAYPHONE_EC',
        transaccion: insertTx[0],
        liquidacion: insertLiq[0],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listarLiquidaciones(
    usuarioId: string,
    roles: string[],
    alojamientoId?: number,
  ) {
    const isSuperadmin = Array.isArray(roles) && roles.includes('SUPERADMIN');
    if (!isSuperadmin && !usuarioId) {
      return [];
    }

    let query = `
      SELECT 
        l.liquidacion_id,
        l.order_id,
        o.alojamiento_id,
        l.monto_bruto,
        l.comision_plataforma,
        l.monto_neto_pagar,
        l.estado_liquidacion,
        l.fecha_liquidacion,
        o.locator AS orden_localizador,
        o.status AS orden_estado,
        COALESCE(o.comprobante_url, tp.comprobante_url) AS comprobante_url,
        tp.metodo_pago,
        tp.estado_pago,
        o.checkin,
        o.checkout,
        a.titulo AS alojamiento_titulo,
        u.nombre || ' ' || u.apellido AS anfitrion_nombre
      FROM liquidaciones_anfitrion l
      JOIN ordenes o ON l.order_id = o.order_id
      JOIN alojamientos a ON o.alojamiento_id = a.alojamiento_id
      JOIN usuarios u ON l.anfitrion_id = u.usuario_id
      LEFT JOIN LATERAL (
        SELECT metodo_pago, estado_pago, comprobante_url
        FROM transacciones_pago
        WHERE order_id = o.order_id
        ORDER BY transaccion_id DESC
        LIMIT 1
      ) tp ON TRUE
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (!isSuperadmin) {
      params.push(usuarioId);
      conditions.push(`a.propietario_id = $${params.length}`);
    }

    if (alojamientoId && Number.isInteger(alojamientoId) && alojamientoId > 0) {
      params.push(alojamientoId);
      conditions.push(`o.alojamiento_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY l.liquidacion_id DESC;`;
    return this.dataSource.query(query, params);
  }

  async getCategoriasPuntuacion() {
    return this.dataSource.query(
      `SELECT categoria_score_id, codigo, nombre FROM categorias_puntuacion ORDER BY categoria_score_id ASC;`,
    );
  }

  async crearResena(usuarioId: string, dto: CrearResenaDto) {
    // 1. Validar que la orden exista y pertenezca al usuario (o esté confirmada)
    const ordenRows = await this.dataSource.query(
      `SELECT order_id, alojamiento_id, owner_id, status FROM ordenes WHERE order_id = $1;`,
      [dto.orderId],
    );

    if (ordenRows.length === 0) {
      throw new NotFoundException(`La orden con ID ${dto.orderId} no existe.`);
    }

    const orden = ordenRows[0];

    // Verificar unicidad de reseña por orden
    const resenaExistente = await this.dataSource.query(
      `SELECT resena_id FROM resenas WHERE order_id = $1;`,
      [dto.orderId],
    );

    if (resenaExistente.length > 0) {
      throw new ConflictException(
        'Ya se ha registrado una reseña para esta orden de reserva.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Insertar reseña maestra
      const insertResena = await queryRunner.query(
        `INSERT INTO resenas (
            order_id, alojamiento_id, usuario_id, idioma, puntuacion_general, comentario
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING resena_id, order_id, alojamiento_id, puntuacion_general, comentario, creado_en;`,
        [
          dto.orderId,
          orden.alojamiento_id,
          usuarioId,
          dto.idioma || 'es',
          dto.puntuacionGeneral,
          dto.comentario.trim(),
        ],
      );

      const nuevaResena = insertResena[0];

      // 3. Insertar detalle de puntuaciones por categoría (4FN)
      for (const det of dto.detalles) {
        await queryRunner.query(
          `INSERT INTO resena_puntuaciones_detalle (resena_id, categoria_score_id, puntaje)
           VALUES ($1, $2, $3);`,
          [nuevaResena.resena_id, det.categoriaScoreId, det.puntaje],
        );
      }

      await queryRunner.commitTransaction();

      // Trigger trg_resenas_rating recalculó automáticamente la calificación del alojamiento
      const ratingActualizado = await this.dataSource.query(
        `SELECT calificacion_promedio, total_resenas FROM alojamientos WHERE alojamiento_id = $1;`,
        [orden.alojamiento_id],
      );

      return {
        mensaje:
          'Reseña registrada con éxito. Promedio del alojamiento recalculado automáticamente.',
        resena: nuevaResena,
        alojamientoRating: ratingActualizado[0],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listarResenasAlojamiento(alojamientoId: number) {
    const query = `
      SELECT 
        r.resena_id,
        r.puntuacion_general,
        r.comentario,
        r.creado_en,
        u.nombre || ' ' || SUBSTRING(u.apellido, 1, 1) || '.' AS autor,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'categoria', cp.nombre,
                'codigo', cp.codigo,
                'puntaje', rpd.puntaje
              )
            )
            FROM resena_puntuaciones_detalle rpd
            JOIN categorias_puntuacion cp ON rpd.categoria_score_id = cp.categoria_score_id
            WHERE rpd.resena_id = r.resena_id
          ), '[]'::json
        ) AS detalles_por_categoria
      FROM resenas r
      JOIN usuarios u ON r.usuario_id = u.usuario_id
      WHERE r.alojamiento_id = $1
      ORDER BY r.creado_en DESC;
    `;

    return this.dataSource.query(query, [alojamientoId]);
  }
}
