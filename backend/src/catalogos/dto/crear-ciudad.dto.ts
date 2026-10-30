import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CrearCiudadDto {
  @ApiProperty({ example: 1, description: 'ID de la provincia a la que pertenece' })
  @IsNumber()
  @IsNotEmpty()
  provinciaId: number;

  @ApiProperty({ example: 'Baños de Agua Santa', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: -1.396389, description: 'Latitud geográfica decimal' })
  @IsNumber()
  @IsNotEmpty()
  latitud: number;

  @ApiProperty({ example: -78.424722, description: 'Longitud geográfica decimal' })
  @IsNumber()
  @IsNotEmpty()
  longitud: number;
}

