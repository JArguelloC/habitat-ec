import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class Contratos5FNDto {
  @ApiProperty({
    example: [1, 2],
    description: 'IDs de canales de integración a habilitar (alojamiento_canales)',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  canalIds: number[];

  @ApiProperty({
    example: [1, 2],
    description: 'IDs de políticas de cancelación a habilitar (alojamiento_politicas)',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  politicaIds: number[];
}

