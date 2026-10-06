import { Controller, Post, Get, Body, Param, Headers, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdenesService } from './ordenes.service.js';
import { OrderPreviewRequestDto, OrderCreateRequestDto } from './dto/ordenes.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Gestión de Órdenes (Reservas)')
@ApiBearerAuth('JWT-Auth')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar cotización previa' })
  preview(@Body() dto: OrderPreviewRequestDto) {
    return this.ordenesService.preview(dto);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nueva reserva' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia' })
  create(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: OrderCreateRequestDto,
  ) {
    return this.ordenesService.create(idempotencyKey, dto);
  }

  @Get(':orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consultar orden por ID' })
  findOne(@Param('orderId') orderId: string) {
    return this.ordenesService.findOne(orderId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar orden' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia' })
  cancel(
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.ordenesService.cancel(orderId, idempotencyKey);
  }
}

