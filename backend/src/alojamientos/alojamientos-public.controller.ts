import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { AlojamientosService } from './alojamientos.service.js';
import { SearchAlojamientosDto } from './dto/search-alojamientos.dto.js';

@ApiTags('3. Catálogo y Búsqueda (Público)')
@Controller('alojamientos')
export class AlojamientosPublicController {
  constructor(private readonly alojamientosService: AlojamientosService) {}

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
}

