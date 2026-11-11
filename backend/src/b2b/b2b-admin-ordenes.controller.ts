import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
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
    let whereClause = `WHERE o.status IN ('CONFIRMED', 'CONFIRMADO', 'CONFIRMADO_ASISTIDO', 'PENDIENTE_VERIFICACION', 'PAGADO', 'CONFIRMADA')`;

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
         o.creation_date,
         a.alojamiento_id,
         a.titulo AS alojamiento_titulo,
         ph.producto_id,
         ph.nombre_producto AS habitacion_nombre,
         u.usuario_id AS client_id,
         TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')) AS huesped_nombre,
         u.correo AS huesped_correo,
         u.identificacion AS huesped_identificacion,
         u.telefono AS huesped_telefono
       FROM ordenes o
       JOIN alojamientos a ON o.alojamiento_id = a.alojamiento_id
       JOIN productos_habitacion ph ON o.producto_id = ph.producto_id
       LEFT JOIN usuarios u ON o.owner_id = u.usuario_id
       ${whereClause}
       ORDER BY o.creation_date DESC
       LIMIT 100;`,
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
}

