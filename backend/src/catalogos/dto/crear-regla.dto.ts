import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearReglaDto {
  @ApiProperty({ example: 'PETS_ALLOWED', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;

  @ApiProperty({ example: 'Mascotas permitidas con supervisión en áreas verdes', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;
}

