import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearAdminDto {
  @ApiProperty({ example: 'Carlos', description: 'Nombre del anfitrión o administrador' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre: string;

  @ApiProperty({ example: 'Galarza', description: 'Apellido del anfitrión o administrador' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
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
  telefono?: string;
}