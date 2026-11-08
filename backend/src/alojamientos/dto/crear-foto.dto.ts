import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CrearFotoDto {
  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
    description: 'URL individual de la imagen del alojamiento',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  urlImagen?: string;

  @ApiPropertyOptional({
    example: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562',
    ],
    description: 'Arreglo de URLs de imágenes para subida múltiple en lote',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urls?: string[];

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  esPortada?: boolean;
}
