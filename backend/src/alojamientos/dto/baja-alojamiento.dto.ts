import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { EstadoOperativoEnum } from '../enums/estado-operativo.enum.js';

export class BajaAlojamientoDto {
  @ApiPropertyOptional({
    example: 'Cierre de temporada por mantenimiento de senderos y cabañas',
    description: 'Motivo explicativo para la baja o suspensión del alojamiento',
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @MaxLength(300, { message: 'El motivo no puede exceder 300 caracteres.' })
  motivo?: string;

  @ApiPropertyOptional({
    example: EstadoOperativoEnum.BAJA,
    enum: EstadoOperativoEnum,
    description: 'Estado de destino para la propiedad (por defecto BAJA)',
  })
  @IsOptional()
  @IsEnum(EstadoOperativoEnum, {
    message: 'El estado objetivo debe ser SUSPENDIDO, INACTIVO o BAJA.',
  })
  estadoObjetivo?: EstadoOperativoEnum;
}

