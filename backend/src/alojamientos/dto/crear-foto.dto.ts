import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CrearFotoDto {
  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
    description: 'URL de la imagen del alojamiento',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  urlImagen: string;

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

