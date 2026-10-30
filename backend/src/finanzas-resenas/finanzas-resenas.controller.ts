import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { FinanzasResenasService } from './finanzas-resenas.service.js';
import { ProcesarPagoDto } from './dto/procesar-pago.dto.js';
import { CrearResenaDto } from './dto/crear-resena.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('5. Pagos, Liquidaciones y Reseñas')
@Controller()
export class FinanzasResenasController {
  constructor(private readonly finanzasResenasService: FinanzasResenasService) {}

  @Post('pagos/procesar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registrar cobro transaccional idempotente y generar liquidación al anfitrión (transacciones_pago y liquidaciones_anfitrion)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave única para procesar el pago sin duplicados',
  })
  @ApiHeader({
    name: 'X-Correlation-Id',
    required: false,
    description: 'ID de correlación para auditoría',
  })
  @ApiResponse({ status: 200, description: 'Pago procesado exitosamente' })
  procesarPago(
    @Body() dto: ProcesarPagoDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.finanzasResenasService.procesarPago(
      dto,
      idempotencyKey,
      correlationId,
    );
  }

  @Get('pagos/liquidaciones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[ADMIN/SUPERADMIN] Consultar balance y liquidaciones financieras del anfitrión (liquidaciones_anfitrion)',
  })
  @ApiResponse({ status: 200, description: 'Listado de liquidaciones' })
  listarLiquidaciones(
    @CurrentUser('usuarioId') usuarioId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.finanzasResenasService.listarLiquidaciones(usuarioId, roles || []);
  }

  @Get('resenas/categorias')
  @ApiOperation({
    summary:
      'Listar categorías de puntuación para reseñas (categorias_puntuacion)',
  })
  @ApiResponse({ status: 200, description: 'Catálogo de categorías' })
  getCategorias() {
    return this.finanzasResenasService.getCategoriasPuntuacion();
  }

  @Post('resenas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[CLIENTE] Publicar reseña y desglose de satisfacción (resenas y resena_puntuaciones_detalle - Trigger automático)',
  })
  @ApiResponse({ status: 201, description: 'Reseña registrada con éxito' })
  @ApiResponse({ status: 409, description: 'La orden ya tiene una reseña' })
  crearResena(
    @CurrentUser('usuarioId') usuarioId: string,
    @Body() dto: CrearResenaDto,
  ) {
    return this.finanzasResenasService.crearResena(usuarioId, dto);
  }

  @Get('resenas/alojamiento/:alojamientoId')
  @ApiOperation({
    summary:
      'Listar todas las reseñas y calificaciones de un alojamiento con su detalle por categoría',
  })
  @ApiResponse({ status: 200, description: 'Lista de reseñas del alojamiento' })
  listarResenasAlojamiento(
    @Param('alojamientoId', ParseIntPipe) alojamientoId: number,
  ) {
    return this.finanzasResenasService.listarResenasAlojamiento(alojamientoId);
  }
}

