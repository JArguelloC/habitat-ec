import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccommodationsService } from './accommodations.service.js';
import { CreateAccommodationDto } from './dto/create-accommodation.dto.js';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto.js';
import { AccommodationResponseDto } from './dto/accommodation-response.dto.js';

@ApiTags('Gestión de Alojamientos')
@Controller('alojamientos')
export class AccommodationsController {
  constructor(private readonly service: AccommodationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo alojamiento' })
  @ApiResponse({ status: 201, description: 'Alojamiento creado exitosamente con encabezado Location' })
  async create(
    @Body() createDto: CreateAccommodationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const created = await this.service.create(createDto);
    res.status(HttpStatus.CREATED);
    res.setHeader('Location', `/alojamientos/${created.id}`);
    return created;
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los alojamientos' })
  async findAll() {
    return await this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar alojamiento por ID con hipermedios HATEOAS' })
  @ApiResponse({ status: 200, type: AccommodationResponseDto })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AccommodationResponseDto> {
    return await this.service.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Actualizar alojamiento existente (204 No Content)' })
  @ApiResponse({ status: 204, description: 'Actualización exitosa, sin contenido en la respuesta' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAccommodationDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar alojamiento (204 No Content)' })
  @ApiResponse({ status: 204, description: 'Eliminación exitosa, sin contenido en la respuesta' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}

