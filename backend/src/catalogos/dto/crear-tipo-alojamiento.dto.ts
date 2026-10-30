import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearTipoAlojamientoDto {
  @ApiProperty({ example: 'GLAMPING_DOMO', maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  codigo: string;

  @ApiProperty({ example: 'Glamping en Domo Geodésico', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;
}

