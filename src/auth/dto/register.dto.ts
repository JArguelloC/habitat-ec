import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  correo: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener mínimo 6 caracteres' })
  password: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiPropertyOptional({ example: '+593999999999' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: 'CLIENTE', description: 'Rol del usuario: CLIENTE o PROPIETARIO' })
  @IsIn(['CLIENTE', 'PROPIETARIO'], { message: 'El rol debe ser CLIENTE o PROPIETARIO' })
  rol: string;
}

