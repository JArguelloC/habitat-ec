import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class SearchAlojamientosDto {
  @ApiProperty({ example: 1, description: 'ID de la ciudad de destino' })
  @IsInt()
  @IsNotEmpty()
  ciudadId: number;

  @ApiProperty({ example: '2026-11-10', description: 'Fecha de ingreso (YYYY-MM-DD)' })
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

  @ApiProperty({ example: 1, default: 1, minimum: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  habitaciones?: number;
}

