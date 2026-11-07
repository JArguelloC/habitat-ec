import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class SearchAlojamientosDto {
  @ApiPropertyOptional({ example: 1, description: 'ID de la ciudad de destino' })
  @IsOptional()
  @IsInt()
  ciudadId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del tipo de alojamiento (ECO_LODGE, CABANA_MONTANA, etc.)',
  })
  @IsOptional()
  @IsInt()
  tipoId?: number;

  @ApiPropertyOptional({
    example: '2026-11-10',
    description: 'Fecha de ingreso (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  checkin?: string;

  @ApiPropertyOptional({
    example: '2026-11-15',
    description: 'Fecha de salida (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  checkout?: string;

  @ApiPropertyOptional({
    example: 2,
    default: 1,
    minimum: 1,
    description: 'Número de adultos',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  adultos?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description: 'Número de niños',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  ninos?: number;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  habitaciones?: number;
}
