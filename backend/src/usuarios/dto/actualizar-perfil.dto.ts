import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class ActualizarPerfilDto {
  @ApiPropertyOptional({ example: 'Carlos' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Galarza' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellido?: string;

  @ApiPropertyOptional({ example: '+593981122334' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'ec' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/)
  paisIso?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordActual?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordNueva?: string;
}

