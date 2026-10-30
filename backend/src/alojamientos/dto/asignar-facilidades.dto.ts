import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class AsignarFacilidadesDto {
  @ApiProperty({
    example: [1, 2, 3],
    description: 'Lista de IDs de facilidades ecológicas a vincular (4FN)',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  facilidadIds: number[];
}

