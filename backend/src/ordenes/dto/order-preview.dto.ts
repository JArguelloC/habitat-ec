import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class OrderPreviewDto {
  @ApiProperty({ example: 1, description: 'ID del alojamiento' })
  @IsInt()
  @IsNotEmpty()
  alojamientoId: number;

  @ApiProperty({
    example: 'PROD-1-01',
    description: 'Código de inventario del producto habitación',
  })
  @IsString()
  @IsNotEmpty()
  productoId: string;

  @ApiProperty({ example: '2026-11-10', description: 'Fecha de llegada (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  checkin: string;

  @ApiProperty({ example: '2026-11-15', description: 'Fecha de salida (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  checkout: string;

  @ApiProperty({ example: 2, minimum: 1, description: 'Número de adultos' })
  @IsInt()
  @Min(1)
  adultos: number;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    minimum: 1,
    description: 'Número de habitaciones solicitadas',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cuartos?: number;
}

