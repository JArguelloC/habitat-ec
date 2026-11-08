import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AlojamientosService } from './alojamientos.service.js';
import { SearchAlojamientosDto } from './dto/search-alojamientos.dto.js';
import { EstadisticasAnfitrionDto } from './dto/estadisticas-anfitrion.dto.js';
import { ActualizarAlojamientoDto } from './dto/actualizar-alojamiento.dto.js';
import { BajaAlojamientoDto } from './dto/baja-alojamiento.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('3. Catálogo y Búsqueda (Público)')
@Controller('alojamientos')
export class AlojamientosPublicController {
  constructor(private readonly alojamientosService: AlojamientosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar alojamientos activos para el Marketplace público',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de alojamientos activos y publicados',
  })
  findAll() {
    return this.alojamientosService.findAllPublicos();
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Búsqueda pública de alojamientos disponibles con filtros de ciudad, fechas y capacidad',
  })
  @ApiHeader({
    name: 'X-Device-Fingerprint',
    required: true,
    description: 'Hash único de fingerprint del cliente para antifraude y analítica',
    example: 'fp-web-chrome-xyz123',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de alojamientos disponibles coincidentes',
  })
  buscarAlojamientos(
    @Body() dto: SearchAlojamientosDto,
    @Headers('x-device-fingerprint') fingerprint?: string,
  ) {
    return this.alojamientosService.buscarAlojamientos(dto, fingerprint);
  }

  @Get('estadisticas')
  @ApiOperation({
    summary: 'Obtener estadísticas públicas o de demostración de alojamientos',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de alojamientos (fallback seguro)',
    type: EstadisticasAnfitrionDto,
  })
  obtenerEstadisticasPublicas(
    @CurrentUser('usuarioId') usuarioId?: string,
  ): Promise<EstadisticasAnfitrionDto> {
    return this.alojamientosService.obtenerEstadisticasAnfitrion(usuarioId);
  }

  @Get(':id/cuentas-bancarias')
  @ApiOperation({
    summary: 'Obtener cuentas bancarias públicas de un alojamiento para pagos por transferencia',
  })
  @ApiResponse({ status: 200, description: 'Listado de cuentas bancarias del alojamiento' })
  obtenerCuentasBancariasPublicas(@Param('id', ParseIntPipe) id: number) {
    return this.alojamientosService.listarCuentasBancarias(id);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Obtener ficha técnica completa de un alojamiento (fotos, facilidades, reglas, productos y contratos 5FN válidos)',
  })
  @ApiResponse({ status: 200, description: 'Detalle del alojamiento' })
  @ApiResponse({ status: 404, description: 'Alojamiento no encontrado' })
  obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.alojamientosService.obtenerDetalleCompleto(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar un alojamiento (requiere rol ADMIN o SUPERADMIN)',
  })
  @ApiResponse({ status: 200, description: 'Alojamiento actualizado con éxito' })
  @ApiResponse({ status: 403, description: 'No autorizado para editar este alojamiento' })
  @ApiResponse({ status: 404, description: 'Alojamiento no encontrado' })
  actualizarAlojamiento(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: { usuarioId: string; roles: string[] },
    @Body() dto: ActualizarAlojamientoDto,
  ) {
    return this.alojamientosService.actualizarAlojamiento(id, usuario, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dar de baja / suspender un alojamiento (Soft Delete)',
  })
  @ApiResponse({ status: 200, description: 'Alojamiento dado de baja con éxito' })
  @ApiResponse({ status: 400, description: 'No se puede dar de baja porque existen reservas activas futuras' })
  @ApiResponse({ status: 403, description: 'No autorizado para dar de baja este alojamiento' })
  @ApiResponse({ status: 404, description: 'Alojamiento no encontrado' })
  eliminarAlojamiento(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: { usuarioId: string; roles: string[] },
    @Body() dto?: BajaAlojamientoDto,
  ) {
    return this.alojamientosService.eliminarAlojamiento(id, usuario, dto);
  }

  @Patch(':id/baja')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dar de baja / suspender un alojamiento mediante PATCH semántico',
  })
  @ApiResponse({ status: 200, description: 'Alojamiento dado de baja con éxito' })
  @ApiResponse({ status: 400, description: 'No se puede dar de baja porque existen reservas activas futuras' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alojamiento no encontrado' })
  darDeBajaAlojamientoPatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: { usuarioId: string; roles: string[] },
    @Body() dto?: BajaAlojamientoDto,
  ) {
    return this.alojamientosService.eliminarAlojamiento(id, usuario, dto);
  }

  @Delete(':id/force')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar permanentemente un alojamiento (Hard Delete)',
  })
  @ApiResponse({ status: 200, description: 'Alojamiento eliminado definitivamente' })
  @ApiResponse({ status: 409, description: 'Conflicto: Existen reservas o transacciones asociadas' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alojamiento no encontrado' })
  eliminarAlojamientoFisico(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: { usuarioId: string; roles: string[] },
  ) {
    return this.alojamientosService.eliminarAlojamientoFisico(id, usuario);
  }
}

