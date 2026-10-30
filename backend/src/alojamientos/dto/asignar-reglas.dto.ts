import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class AsignarReglasDto {
  @ApiProperty({
    example: [1, 2],
    description: 'Lista de IDs de reglas de convivencia a vincular (4FN)',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  reglaIds: number[];
}

