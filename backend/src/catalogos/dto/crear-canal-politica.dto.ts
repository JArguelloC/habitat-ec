import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CrearCanalPoliticaDto {
  @ApiProperty({ example: 1, description: 'ID del canal de integración' })
  @IsNumber()
  @IsNotEmpty()
  canalId: number;

  @ApiProperty({ example: 1, description: 'ID de la política de cancelación' })
  @IsNumber()
  @IsNotEmpty()
  politicaId: number;
}

