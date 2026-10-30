import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { OrdenesService } from './ordenes.service.js';
import { OrderPreviewDto } from './dto/order-preview.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('4. Disponibilidad y Reservas (Cliente)')
@Controller('ordenes')
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Get('calendario/:productoId')
  @ApiOperation({
    summary:
      'Consultar disponibilidad y tarifas de inventario diario (calendario_inventario)',
  })
  @ApiResponse({ status: 200, description: 'Fechas de calendario del producto' })
  obtenerCalendario(
    @Param('productoId') productoId: string,
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
  ) {
    return this.ordenesService.obtenerCalendario(productoId, inicio, fin);
  }

  @Post('preview')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[CLIENTE] Bloquear fechas temporalmente (Hold 15 min con NOWAIT) y cotizar tarifa',
  })
  @ApiHeader({
    name: 'X-Correlation-Id',
    required: true,
    description: 'Identificador único de correlación transversal',
    example: 'c0000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 201,
    description:
      'Hold generado exitosamente. Fechas retenidas en base de datos.',
  })
  @ApiResponse({
    status: 409,
    description: 'ROOM_NO_LONGER_AVAILABLE: Fechas no disponibles (evita overbooking)',
  })
  generarPreview(
    @Body() dto: OrderPreviewDto,
    @Headers('x-correlation-id') correlationId?: string,
    @CurrentUser('usuarioId') usuarioId?: string,
  ) {
    return this.ordenesService.generarOrderPreview(
      dto,
      usuarioId,
      correlationId,
    );
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[CLIENTE] Confirmar reserva idempotente, validar 5FN y generar localizador PNR',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única para garantizar idempotencia en checkout',
    example: 'e0000000-0000-0000-0000-000000000001',
  })
  @ApiHeader({
    name: 'X-Correlation-Id',
    required: true,
    description: 'Identificador único de trazabilidad',
    example: 'c0000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 201,
    description: 'Reserva confirmada y asentada en el calendario',
  })
  @ApiResponse({
    status: 400,
    description: 'BOOKING_NOT_CONFIRMED o violación de contrato 5FN',
  })
  crearOrden(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @CurrentUser('usuarioId') authUserId?: string,
  ) {
    if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey)) {
      throw new BadRequestException(
        'La cabecera Idempotency-Key es obligatoria y debe ser un UUID válido.',
      );
    }
    return this.ordenesService.crearOrdenIdempotente(
      idempotencyKey,
      correlationId || '',
      dto,
      authUserId,
    );
  }

  @Post(':orderId/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[CLIENTE/ADMIN] Cancelar orden mediante compensación Saga y liberar inventario',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave de idempotencia para la transacción de cancelación',
    example: 'e0000000-0000-0000-0000-000000000002',
  })
  @ApiResponse({ status: 200, description: 'Orden cancelada exitosamente' })
  @ApiResponse({ status: 400, description: 'Tarifa no reembolsable o error' })
  @ApiResponse({ status: 404, description: 'Orden inexistente' })
  cancelarOrden(
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey)) {
      throw new BadRequestException(
        'La cabecera Idempotency-Key es obligatoria y debe ser un UUID válido.',
      );
    }
    return this.ordenesService.cancelarOrden(orderId, idempotencyKey);
  }

  @Get('mis-reservas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[CLIENTE] Listar reservas del usuario autenticado con desglose financiero normalizado (orden_cargos_desglose)',
  })
  @ApiResponse({ status: 200, description: 'Historial de reservas del cliente' })
  listarMisReservas(@CurrentUser('usuarioId') usuarioId: string) {
    return this.ordenesService.listarMisReservas(usuarioId);
  }
}

