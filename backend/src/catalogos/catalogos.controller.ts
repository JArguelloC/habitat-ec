import {
  Controller,
  Get,
  Post,
  Body,
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
import { CatalogosService } from './catalogos.service.js';
import { CrearCiudadDto } from './dto/crear-ciudad.dto.js';
import { CrearTipoAlojamientoDto } from './dto/crear-tipo-alojamiento.dto.js';
import { CrearFacilidadDto } from './dto/crear-facilidad.dto.js';
import { CrearReglaDto } from './dto/crear-regla.dto.js';
import { CrearCadenaDto } from './dto/crear-cadena.dto.js';
import { CrearMarcaDto } from './dto/crear-marca.dto.js';
import { CrearCanalPoliticaDto } from './dto/crear-canal-politica.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('2. Catálogos Maestros y 5FN')
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('geografia')
  @ApiOperation({
    summary:
      'Obtener árbol geográfico completo (paises, regiones, provincias, ciudades)',
  })
  @ApiResponse({ status: 200, description: 'Catálogo geográfico jerárquico' })
  getGeografia() {
    return this.catalogosService.getGeografia();
  }

  @Get('ciudades')
  @ApiOperation({ summary: 'Listar ciudades con su provincia y región' })
  @ApiResponse({ status: 200, description: 'Lista de ciudades' })
  getCiudades() {
    return this.catalogosService.getCiudades();
  }

  @Get('tipos-alojamiento')
  @ApiOperation({ summary: 'Listar tipos de alojamiento (tipos_alojamiento)' })
  @ApiResponse({ status: 200, description: 'Lista de tipos de alojamiento' })
  getTiposAlojamiento() {
    return this.catalogosService.getTiposAlojamiento();
  }

  @Get('facilidades')
  @ApiOperation({
    summary: 'Listar facilidades y amenidades ecológicas (facilidades)',
  })
  @ApiResponse({ status: 200, description: 'Lista de facilidades' })
  getFacilidades() {
    return this.catalogosService.getFacilidades();
  }

  @Get('reglas-convivencia')
  @ApiOperation({
    summary: 'Listar reglas de convivencia y sostenibilidad (reglas_convivencia)',
  })
  @ApiResponse({ status: 200, description: 'Lista de reglas' })
  getReglasConvivencia() {
    return this.catalogosService.getReglasConvivencia();
  }

  @Get('planes-alimenticios')
  @ApiOperation({
    summary: 'Listar planes alimenticios disponibles (planes_alimenticios)',
  })
  @ApiResponse({ status: 200, description: 'Lista de planes alimenticios' })
  getPlanesAlimenticios() {
    return this.catalogosService.getPlanesAlimenticios();
  }

  @Get('cadenas-marcas')
  @ApiOperation({
    summary: 'Listar cadenas y marcas hoteleras anidadas (cadenas_hoteleras, marcas_hoteleras)',
  })
  @ApiResponse({ status: 200, description: 'Cadenas y marcas hoteleras' })
  getCadenasYMarcas() {
    return this.catalogosService.getCadenasYMarcas();
  }

  @Get('matriz-5fn')
  @ApiOperation({
    summary:
      'Consultar matriz y vista Lossless-Join 5FN (canales_integracion, politicas_cancelacion, canal_politicas, vw_contratos_5fn_validos)',
  })
  @ApiResponse({
    status: 200,
    description: 'Matriz 5FN y vista de contratos válidos',
  })
  getMatriz5FN() {
    return this.catalogosService.getMatriz5FN();
  }

  // Endpoints de inserción protegidos (SUPERADMIN)
  @Post('ciudades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar una nueva ciudad' })
  @ApiResponse({ status: 201, description: 'Ciudad creada' })
  crearCiudad(@Body() dto: CrearCiudadDto) {
    return this.catalogosService.crearCiudad(dto);
  }

  @Post('tipos-alojamiento')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar un nuevo tipo de alojamiento' })
  @ApiResponse({ status: 201, description: 'Tipo de alojamiento creado' })
  crearTipoAlojamiento(@Body() dto: CrearTipoAlojamientoDto) {
    return this.catalogosService.crearTipoAlojamiento(dto);
  }

  @Post('facilidades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar una nueva facilidad' })
  @ApiResponse({ status: 201, description: 'Facilidad creada' })
  crearFacilidad(@Body() dto: CrearFacilidadDto) {
    return this.catalogosService.crearFacilidad(dto);
  }

  @Post('reglas-convivencia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar una nueva regla de convivencia' })
  @ApiResponse({ status: 201, description: 'Regla creada' })
  crearRegla(@Body() dto: CrearReglaDto) {
    return this.catalogosService.crearRegla(dto);
  }

  @Post('cadenas-hoteleras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar una cadena hotelera' })
  @ApiResponse({ status: 201, description: 'Cadena creada' })
  crearCadena(@Body() dto: CrearCadenaDto) {
    return this.catalogosService.crearCadena(dto);
  }

  @Post('marcas-hoteleras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPERADMIN] Registrar una marca hotelera' })
  @ApiResponse({ status: 201, description: 'Marca creada' })
  crearMarca(@Body() dto: CrearMarcaDto) {
    return this.catalogosService.crearMarca(dto);
  }

  @Post('canal-politicas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[SUPERADMIN] Habilitar relación Canal x Política (canal_politicas - Proyección 3 de la 5FN)',
  })
  @ApiResponse({ status: 201, description: 'Relación 5FN creada' })
  crearCanalPolitica(@Body() dto: CrearCanalPoliticaDto) {
    return this.catalogosService.crearCanalPolitica(dto);
  }
}

