import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AlojamientosService } from './alojamientos.service.js';
import { CrearAlojamientoDto } from './dto/crear-alojamiento.dto.js';
import { CrearFotoDto } from './dto/crear-foto.dto.js';
import { AsignarFacilidadesDto } from './dto/asignar-facilidades.dto.js';
import { AsignarReglasDto } from './dto/asignar-reglas.dto.js';
import { CrearProductoHabitacionDto } from './dto/crear-producto-habitacion.dto.js';
import { Contratos5FNDto } from './dto/contratos-5fn.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('2. Alojamientos (Admin / Anfitrión)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('admin/alojamientos')
export class AlojamientosAdminController {
  constructor(private readonly alojamientosService: AlojamientosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[ADMIN] Registrar una nueva propiedad o cabaña con producto base y contratos 5FN por defecto',
  })
  @ApiResponse({ status: 201, description: 'Alojamiento registrado exitosamente' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o SUPERADMIN' })
  crearAlojamiento(
    @CurrentUser('usuarioId') propietarioId: string,
    @Body() dto: CrearAlojamientoDto,
  ) {
    return this.alojamientosService.crearAlojamiento(propietarioId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '[ADMIN] Listar alojamientos del anfitrión autenticado',
  })
  @ApiResponse({ status: 200, description: 'Lista de alojamientos propios' })
  listarMisAlojamientos(@CurrentUser('usuarioId') propietarioId: string) {
    return this.alojamientosService.listarPorAnfitrion(propietarioId);
  }

  @Post(':id/fotos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[ADMIN] Agregar fotografía a la galería del alojamiento (alojamiento_fotos)',
  })
  @ApiResponse({ status: 201, description: 'Fotografía agregada' })
  agregarFoto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearFotoDto,
  ) {
    return this.alojamientosService.agregarFoto(id, dto);
  }

  @Post(':id/facilidades')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN] Asignar facilidades y amenidades ecológicas (alojamiento_facilidades - 4FN)',
  })
  @ApiResponse({ status: 200, description: 'Facilidades vinculadas' })
  asignarFacilidades(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarFacilidadesDto,
  ) {
    return this.alojamientosService.asignarFacilidades(id, dto);
  }

  @Post(':id/reglas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN] Asignar reglas de convivencia y sostenibilidad (alojamiento_reglas - 4FN)',
  })
  @ApiResponse({ status: 200, description: 'Reglas vinculadas' })
  asignarReglas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarReglasDto,
  ) {
    return this.alojamientosService.asignarReglas(id, dto);
  }

  @Post(':id/productos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[ADMIN] Crear tipos de habitación adicionales para la propiedad (productos_habitacion)',
  })
  @ApiResponse({ status: 201, description: 'Producto habitación creado' })
  agregarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearProductoHabitacionDto,
  ) {
    return this.alojamientosService.agregarProductoHabitacion(id, dto);
  }

  @Post(':id/contratos-5fn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[ADMIN] Habilitar canales y políticas de cancelación (alojamiento_canales y alojamiento_politicas - 5FN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contratos 5FN actualizados y validados',
  })
  configurarContratos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Contratos5FNDto,
  ) {
    return this.alojamientosService.configurarContratos5FN(id, dto);
  }
}
