import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearAdminDto {
  @ApiProperty({ example: 'Carlos', description: 'Nombre del anfitrión o administrador' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El nombre solo debe contener letras y espacios.',
  })
  nombre: string;

  @ApiProperty({ example: 'Galarza', description: 'Apellido del anfitrión o administrador' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El apellido solo debe contener letras y espacios.',
  })
  apellido: string;

  @ApiProperty({ example: 'anfitrion@mindo-ecolodge.com', description: 'Correo institucional o personal' })
  @IsEmail({}, { message: 'El correo debe tener un formato válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo: string;

  @ApiProperty({ example: 'AdminPass2026!', description: 'Contraseña temporal de acceso' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @ApiPropertyOptional({ example: '+593987654321', description: 'Teléfono de contacto' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+593\s?9\d{2}\s?\d{3}\s?\d{3}|\+5939\d{8}|09\d{8}|09\d{2}\s?\d{3}\s?\d{3})$/, {
    message:
      'El teléfono móvil debe tener formato ecuatoriano válido (+593 9XXXXXXXX o 09XXXXXXXX).',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: '1790012345001', description: 'Cédula o RUC ecuatoriano' })
  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|1[0-9]|2[0-4]|30)\d{8}(001)?$/, {
    message:
      'La Cédula (10 dígitos) o RUC (13 dígitos terminado en 001) debe iniciar con un código de provincia ecuatoriana válido (01-24 o 30).',
  })
  cedulaRuc?: string;

  @ApiPropertyOptional({ example: 'TENANT_ALL', description: 'Scope RBAC o identificador de recurso' })
  @IsOptional()
  @IsString()
  scopeRecursoCodigo?: string;
}
