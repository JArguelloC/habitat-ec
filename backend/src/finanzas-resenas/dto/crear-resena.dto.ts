import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PuntuacionDetalleDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la categoría de puntuación (categorias_puntuacion)',
  })
  @IsInt()
  @IsNotEmpty()
  categoriaScoreId: number;

  @ApiProperty({ example: 4.8, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  puntaje: number;
}

export class CrearResenaDto {
  @ApiProperty({
    example: 'd0000000-0000-0000-0000-000000000001',
    description: 'ID único de la orden completada',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 4.9,
    minimum: 1,
    maximum: 5,
    description: 'Puntuación general de 1.00 a 5.00',
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  puntuacionGeneral: number;

  @ApiProperty({
    example: 'Una estadía inolvidable. El entorno natural y la sostenibilidad del lodge son excepcionales.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  comentario: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  idioma?: string;

  @ApiProperty({
    type: [PuntuacionDetalleDto],
    description: 'Desglose detallado de puntuaciones por categoría (4FN)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PuntuacionDetalleDto)
  detalles: PuntuacionDetalleDto[];
}

