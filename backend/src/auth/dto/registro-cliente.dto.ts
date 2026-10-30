import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegistroClienteDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'Paredes' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ example: 'maria.paredes@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  correo: string;

  @ApiProperty({ example: 'ClientePass2026!', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+593981122334' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'ec', default: 'ec' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/)
  paisIso?: string;
}

