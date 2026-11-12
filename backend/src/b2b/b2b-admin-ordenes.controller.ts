import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { B2bService } from './b2b.service.js';
import { B2bAuthGuard } from './guards/b2b-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('4.1 Recepción y Check-in Asistido (Anfitrión / Booking B2B)')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description: 'Soporta autenticación por JWT Bearer (Panel Admin) o X-API-Key',
})
@UseGuards(B2bAuthGuard)
@Controller({ path: 'admin/ordenes', version: '1' })
export class B2bAdminOrdenesController {
  constructor(
    private readonly b2bService: B2bService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('recepcion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN / RECEPCIÓN] Listar reservas activas y asistidas para Check-in en mostrador',
  })
  async listarReservasRecepcion(
    @CurrentUser()
    usuario?: {
      usuarioId?: string;
      sub?: string;
      roles?: string[];
    },
  ) {
    const userId = usuario?.usuarioId || usuario?.sub;
    const roles: string[] = Array.isArray(usuario?.roles) ? usuario.roles : [];
    const isSuperadmin = roles.includes('SUPERADMIN') || !userId;

    const params: unknown[] = [];
    let whereClause = `WHERE UPPER(o.status) IN ('CONFIRMED', 'CONFIRMADO', 'CONFIRMADO_ASISTIDO', 'PENDIENTE_VERIFICACION', 'PAGADO', 'CONFIRMADA', 'CANCELLED', 'CANCELADA', 'CHECKED_IN', 'CHECKED_OUT')`;

    if (!isSuperadmin && userId) {
      params.push(userId);
      whereClause += ` AND a.propietario_id = $1`;
    }

    const rows = await this.dataSource.query(
      `SELECT
         o.order_id,
         o.locator,
         o.external_order_id,
         o.status,
         TO_CHAR(o.checkin, 'YYYY-MM-DD') AS checkin,
         TO_CHAR(o.checkout, 'YYYY-MM-DD') AS checkout,
         o.noches,
         o.number_of_adults,
         o.number_of_rooms,
         o.total_price,
         o.currency,
         o.checked_in_at,
         o.checkin_observaciones,
         o.motivo_cancelacion,
         o.solicitado_por_cancelacion,
         o.cancelled_at,
         o.creation_date,
         a.alojamiento_id,
         COALESCE(a.titulo, 'Alojamiento Registrado') AS alojamiento_titulo,
         ph.producto_id,
         COALESCE(ph.nombre_producto, 'Habitación General') AS habitacion_nombre,
         u.usuario_id AS client_id,
         COALESCE(
           NULLIF(TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')), ''),
           NULLIF(TRIM(COALESCE(o.customer_first_name, '') || ' ' || COALESCE(o.customer_last_name, '')), ''),
           'Huésped Registrado'
         ) AS huesped_nombre,
         COALESCE(NULLIF(u.correo, ''), NULLIF(o.customer_email, ''), 'Sin correo') AS huesped_correo,
         COALESCE(u.identificacion, '') AS huesped_identificacion,
         COALESCE(u.telefono, '') AS huesped_telefono
       FROM ordenes o
       LEFT JOIN alojamientos a ON o.alojamiento_id = a.alojamiento_id
       LEFT JOIN productos_habitacion ph ON o.producto_id = ph.producto_id
       LEFT JOIN usuarios u ON o.owner_id = u.usuario_id
       ${whereClause}
       ORDER BY o.creation_date DESC
       LIMIT 150;`,
      params,
    );

    return rows;
  }

  @Post(':orderId/checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN / RECEPCIÓN] Confirmar Check-in asistido en mostrador y enviar notificación push a Booking Central',
  })
  async confirmarCheckin(
    @Param('orderId') orderId: string,
    @Body()
    body?: {
      documento_titular?: string;
      huespedes_reales?: number;
      admin_id?: string;
      observaciones?: string;
    },
    @CurrentUser()
    usuario?: {
      usuarioId?: string;
      correo?: string;
    },
  ) {
    return this.b2bService.confirmarCheckinRecepcion(orderId, body, usuario);
  }

  @Post(':orderId/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN / RECEPCIÓN] Confirmar Check-out asistido, transicionar habitación a EN_LIMPIEZA y notificar a Booking',
  })
  async confirmarCheckout(
    @Param('orderId') orderId: string,
    @Body()
    body?: {
      observaciones?: string;
    },
    @CurrentUser()
    usuario?: {
      usuarioId?: string;
      correo?: string;
    },
  ) {
    return this.b2bService.confirmarCheckoutRecepcion(orderId, body, usuario);
  }

  @Post(':orderId/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN / RECEPCIÓN] Cancelar reserva desde el mostrador, restituir stock y notificar a Booking',
  })
  async cancelarReservaMostrador(
    @Param('orderId') orderId: string,
    @Body()
    body?: {
      motivo?: string;
    },
  ) {
    const orderRows = await this.dataSource.query(
      `SELECT order_id, locator, external_order_id, status FROM ordenes WHERE order_id::text = $1 OR locator = $1 LIMIT 1;`,
      [orderId],
    );
    if (orderRows.length === 0) {
      throw new NotFoundException(`La orden con identificador ${orderId} no existe.`);
    }
    const order = orderRows[0];
    if (order.external_order_id) {
      throw new BadRequestException(
        'Operación denegada: Las reservas originadas en Booking Central solo pueden ser canceladas unilateralmente desde la plataforma de Booking.',
      );
    }

    const result = await this.b2bService.cancelOrderSagaB2b(
      orderId,
      {
        motivo: body?.motivo || 'Cancelada en mostrador por el anfitrión / recepción',
        solicitadoPor: 'HOTEL',
      },
      crypto.randomUUID(),
    );
    return result.body;
  }
}

