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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as crypto from 'node:crypto';
import { B2bService } from './b2b.service.js';
import { CancelOrderRequestDto } from './dto/cancel-order-request.dto.js';
import { B2bAuthGuard } from './guards/b2b-auth.guard.js';

@ApiTags('7. Interoperabilidad B2B Booking Direct Orders (/api/v2/orders)')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description:
    'API Key de interoperabilidad B2B (hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c)',
})
@UseGuards(B2bAuthGuard)
@Controller({ path: 'orders', version: '2' })
export class B2bOrdersController {
  private readonly logger = new Logger(B2bOrdersController.name);

  constructor(private readonly b2bService: B2bService) {}

  @Post('create')
  @ApiOperation({
    summary:
      '[B2B Saga Alias] Crear orden idempotente (<= 3000ms), descontar stock por noche y sincronizar con Booking',
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
    @Query() query: Record<string, any> = {},
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const merged = { ...query, ...body };
    this.logger.log(
      `[B2B_ORDERS_CREATE] IdempotencyKey=${idempotencyKey} CorrelationId=${correlationId} Payload=${JSON.stringify(merged)}`,
    );
    const result = await this.b2bService.createOrderSagaB2b(
      merged,
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

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B Direct] Consultar orden por saga_id, orderId, codigoReserva o idempotency_key',
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

  @Get(':orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B Direct] Consultar detalle de orden por orderId, externalOrderId, codigoReserva o saga_id',
  })
  findOrderById(@Param('orderId') orderId: string) {
    return this.b2bService.findOrderB2b(orderId);
  }

  @Post(':orderId/cancel')
  @ApiOperation({
    summary:
      '[B2B Saga Direct] Compensación idempotente de orden, liberación de stock por noche y notificación a Booking',
  })
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Res() res: Response,
    @Body() body?: CancelOrderRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    this.logger.log(
      `[B2B_ORDERS_CANCEL] OrderId=${orderId} IdempotencyKey=${idempotencyKey} CorrelationId=${correlationId} Body=${JSON.stringify(body)}`,
    );
    const result = await this.b2bService.cancelOrderSagaB2b(
      orderId,
      body,
      correlationId,
    );

    const effCorrelationId =
      correlationId ||
      (result.problemJson?.correlation_id as string) ||
      crypto.randomUUID();
    res.setHeader('X-Correlation-ID', effCorrelationId);

    if (result.statusCode === 404 && result.problemJson) {
      res.setHeader('Content-Type', 'application/problem+json');
      return res
        .status(HttpStatus.NOT_FOUND)
        .send(JSON.stringify(result.problemJson));
    }

    if (result.statusCode === 409 && result.problemJson) {
      res.setHeader('Content-Type', 'application/problem+json');
      return res
        .status(HttpStatus.CONFLICT)
        .send(JSON.stringify(result.problemJson));
    }

    if (result.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
    }

    return res.status(HttpStatus.OK).json(result.body);
  }

  @Post(':orderId/checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B Direct] Confirmar Check-in asistido en recepción y notificar push a Booking Central',
  })
  checkinOrderB2b(
    @Param('orderId') orderId: string,
    @Body()
    body?: {
      documento_titular?: string;
      huespedes_reales?: number;
      admin_id?: string;
      observaciones?: string;
    },
  ) {
    return this.b2bService.confirmarCheckinRecepcion(orderId, body);
  }
}
