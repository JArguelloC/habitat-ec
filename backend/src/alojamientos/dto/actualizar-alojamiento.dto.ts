import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  IsIn,
  MinLength,
  MaxLength,
  IsPositive,
} from 'class-validator';
import { CrearAlojamientoDto } from './crear-alojamiento.dto.js';

export class ActualizarAlojamientoDto extends PartialType(CrearAlojamientoDto) {
  @ApiPropertyOptional({
    example: 'Eco-Lodge Cabañas del Bosque Nublado Actualizado',
    description: 'Título comercial del alojamiento',
  })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres.' })
  @MaxLength(100, { message: 'El título no puede exceder 100 caracteres.' })
  override titulo?: string;

  @ApiPropertyOptional({
    example: 'Descripción actualizada con amenidades y senderos.',
    description: 'Descripción detallada',
  })
  @IsOptional()
  @IsString()
  @MinLength(15, { message: 'La descripción debe tener al menos 15 caracteres.' })
  @MaxLength(1000, { message: 'La descripción no puede exceder 1000 caracteres.' })
  override descripcion?: string;

  @ApiPropertyOptional({
    example: 'Km 6 Vía a Mindo, Pichincha',
    description: 'Dirección física del alojamiento',
  })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'La dirección debe tener al menos 5 caracteres.' })
  @MaxLength(120, { message: 'La dirección no puede exceder 120 caracteres.' })
  override direccion?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID de la ciudad registrada en el catálogo' })
  @IsOptional()
  @IsInt({ message: 'ciudadId debe ser un número entero.' })
  @IsPositive()
  override ciudadId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Alias para ciudadId' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  ciudad_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID del tipo de alojamiento' })
  @IsOptional()
  @IsInt({ message: 'tipoId debe ser un número entero.' })
  @IsPositive()
  override tipoId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Alias para tipoId' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  tipo_alojamiento_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID de la marca hotelera asociada' })
  @IsOptional()
  @IsInt()
  marcaId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Alias para marcaId' })
  @IsOptional()
  @IsInt()
  marca_id?: number;

  @ApiPropertyOptional({ example: -0.1807, description: 'Latitud geográfica' })
  @IsOptional()
  @IsNumber({}, { message: 'La latitud debe ser numérica.' })
  latitud?: number;

  @ApiPropertyOptional({ example: -78.4678, description: 'Longitud geográfica' })
  @IsOptional()
  @IsNumber({}, { message: 'La longitud debe ser numérica.' })
  longitud?: number;

  @ApiPropertyOptional({ example: 95.0, description: 'Precio base por noche en USD' })
  @IsOptional()
  @IsNumber({}, { message: 'El precio base por noche debe ser numérico.' })
  @IsPositive({ message: 'El precio debe ser mayor a 0.' })
  override precioBaseNoche?: number;

  @ApiPropertyOptional({ example: 'PUBLICADO', enum: ['PUBLICADO', 'PAUSADO', 'INACTIVO'] })
  @IsOptional()
  @IsString()
  @IsIn(['PUBLICADO', 'PAUSADO', 'INACTIVO'], {
    message: 'El estado debe ser PUBLICADO, PAUSADO o INACTIVO.',
  })
  estadoOperativo?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Booleano simplificado para pausar o activar',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

