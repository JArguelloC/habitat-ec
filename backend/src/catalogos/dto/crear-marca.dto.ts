import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CrearMarcaDto {
  @ApiProperty({ example: 1, description: 'ID de la cadena hotelera matriz' })
  @IsNumber()
  @IsNotEmpty()
  cadenaId: number;

  @ApiProperty({ example: 'Highland Glampings', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;
}

