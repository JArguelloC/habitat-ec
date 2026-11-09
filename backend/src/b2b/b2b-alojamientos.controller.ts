import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { B2bService } from './b2b.service.js';
import { B2bAuthGuard } from './guards/b2b-auth.guard.js';
import { PublicB2b } from './decorators/public-b2b.decorator.js';

@ApiTags('7. Interoperabilidad B2B Booking (/api/v2/alojamientos)')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description:
    'API Key de interoperabilidad B2B (hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c)',
})
@UseGuards(B2bAuthGuard)
@Controller({ path: 'alojamientos', version: '2' })
export class B2bAlojamientosController {
  constructor(private readonly b2bService: B2bService) {}

  @PublicB2b()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[B2B Público] Healthcheck de latencia (< 1000ms) con Neon DB',
  })
  getHealth() {
    return this.b2bService.getHealthStatus();
  }

  @PublicB2b()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Listar alojamientos publicados con precioTotalEstancia en USD',
  })
  findAll(
    @Query('ciudad') ciudad?: string,
    @Query('city') city?: string,
    @Query('destination') destination?: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkin') checkin?: string,
    @Query('checkOut') checkOut?: string,
    @Query('checkout') checkout?: string,
    @Query('adultos') adultos?: string,
    @Query('habitaciones') habitaciones?: string,
  ) {
    return this.b2bService.searchAlojamientosB2b({
      ciudad,
      city,
      destination,
      checkIn,
      checkin,
      checkOut,
      checkout,
      adultos,
      habitaciones,
    });
  }

  @PublicB2b()
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Búsqueda avanzada de alojamientos publicados con cálculo de estancia',
  })
  search(@Body() body: Record<string, any> = {}) {
    return this.b2bService.searchAlojamientosB2b(body);
  }

  @PublicB2b()
  @Post('availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Congelar tarifa por 30 minutos en order_previews_holds y retornar cotizacionId',
  })
  checkAvailability(
    @Body() body: Record<string, any> = {},
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.b2bService.createAvailabilityHold30Min(body, correlationId);
  }

  @Post('orders/create')
  @ApiOperation({
    summary:
      '[B2B Saga] Crear orden idempotente (<= 3000ms), descontar stock por noche y sincronizar con Booking',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 único de idempotencia',
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    required: true,
    description: 'Identificador de correlación transversal',
  })
  async createOrderSaga(
    @Body() body: Record<string, any> = {},
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.b2bService.createOrderSagaB2b(
      body,
      idempotencyKey,
      correlationId,
    );

    if (result.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(HttpStatus.OK).json(result.body);
    }

    if (result.statusCode === 409 && result.problemJson) {
      res.setHeader('Content-Type', 'application/problem+json');
      return res
        .status(HttpStatus.CONFLICT)
        .send(JSON.stringify(result.problemJson));
    }

    if (result.statusCode === 422 && result.problemJson) {
      res.setHeader('Content-Type', 'application/problem+json');
      return res
        .status(HttpStatus.UNPROCESSABLE_ENTITY)
        .send(JSON.stringify(result.problemJson));
    }

    return res.status(HttpStatus.CREATED).json(result.body);
  }

  @Get('orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Consultar orden por saga_id, orderId, codigoReserva o idempotency_key',
  })
  findOrderByQuery(
    @Query('saga_id') sagaId?: string,
    @Query('sagaId') sagaIdCamel?: string,
    @Query('orderId') orderId?: string,
    @Query('externalOrderId') externalOrderId?: string,
    @Query('codigoReserva') codigoReserva?: string,
    @Query('idempotency_key') idempotencyKey?: string,
    @Query('idempotencyKey') idempotencyKeyCamel?: string,
  ) {
    const identifier =
      sagaId ||
      sagaIdCamel ||
      orderId ||
      externalOrderId ||
      codigoReserva ||
      idempotencyKey ||
      idempotencyKeyCamel ||
      '';
    return this.b2bService.findOrderB2b(identifier);
  }

  @Get('orders/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Consultar detalle de orden por orderId, externalOrderId, codigoReserva o saga_id',
  })
  findOrderById(@Param('orderId') orderId: string) {
    return this.b2bService.findOrderB2b(orderId);
  }

  @Post('orders/:orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B Saga] Compensación idempotente de orden, liberación de stock por noche y notificación a Booking',
  })
  cancelOrder(@Param('orderId') orderId: string) {
    return this.b2bService.cancelOrderSagaB2b(orderId);
  }

  @Post('orders/:orderId/checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B v2.1] Confirmar Check-in asistido en recepción y notificar push a Booking Central',
  })
  checkinOrderB2b(
    @Param('orderId') orderId: string,
    @Body()
    body?: {
      huespedes_reales?: number;
      admin_id?: string;
      observaciones?: string;
    },
  ) {
    return this.b2bService.confirmarCheckinRecepcion(orderId, body);
  }

  @PublicB2b()
  @Get(':id/habitaciones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[B2B] Listar tipos de habitaciones de un alojamiento específico',
  })
  findHabitaciones(@Param('id') id: string) {
    return this.b2bService.findHabitacionesByAlojamientoIdB2b(id);
  }

  @PublicB2b()
  @Get(':id/availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B] Consultar disponibilidad y cotización de un alojamiento por query params',
  })
  checkAvailabilityByQuery(
    @Param('id') id: string,
    @Query() query: Record<string, any> = {},
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.b2bService.checkAvailabilityByQueryB2b(
      id,
      query,
      correlationId,
    );
  }

  @PublicB2b()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[B2B] Consultar detalle de un alojamiento específico por ID',
  })
  findAlojamientoById(
    @Param('id') id: string,
    @Query() query: Record<string, any> = {},
  ) {
    return this.b2bService.findAlojamientoByIdB2b(id, query);
  }
}

