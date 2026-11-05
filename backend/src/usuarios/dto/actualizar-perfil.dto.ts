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
  @MinLength(2, { message: 'El nombre debe tener al menos 2 letras.' })
  @MaxLength(80)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El nombre solo debe contener letras y espacios.',
  })
  nombre?: string;

  @ApiPropertyOptional({ example: 'Galarza' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 letras.' })
  @MaxLength(80)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El apellido solo debe contener letras y espacios.',
  })
  apellido?: string;

  @ApiPropertyOptional({ example: '1712345678' })
  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|1[0-9]|2[0-4]|30)\d{8}(001)?$/, {
    message:
      'La Cédula (10 dígitos) o RUC (13 dígitos terminado en 001) debe iniciar con un código de provincia ecuatoriana válido (01-24 o 30).',
  })
  cedulaRuc?: string;

  @ApiPropertyOptional({ example: '+593981122334' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^(\+593\s?9\d{2}\s?\d{3}\s?\d{3}|\+5939\d{8}|09\d{8}|09\d{2}\s?\d{3}\s?\d{3})$/, {
    message:
      'El teléfono móvil debe tener formato ecuatoriano válido (+593 9XXXXXXXX o 09XXXXXXXX).',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: 'ec' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/)
  paisIso?: string;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'Nueva contraseña directa desde el perfil del usuario autenticado',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  password?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordActual?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  passwordNueva?: string;
}
