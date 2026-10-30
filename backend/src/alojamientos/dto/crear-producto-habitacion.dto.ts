import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearProductoHabitacionDto {
  @ApiProperty({
    example: 'PROD-CABANA-VIP-02',
    description: 'Código único de inventario del producto habitación',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  productoId: string;

  @ApiProperty({ example: 1, description: 'ID del plan alimenticio asociado' })
  @IsInt()
  @IsNotEmpty()
  planId: number;

  @ApiProperty({
    example: 'Suite Deluxe con Vista al Dosel',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombreProducto: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  capacidadAdultos: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacidadNinos?: number;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadCuartosInventario?: number;

  @ApiProperty({ example: 120.0, description: 'Precio base por noche en USD' })
  @IsNumber()
  @IsPositive()
  precioBaseNoche: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

