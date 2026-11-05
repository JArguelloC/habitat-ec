import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SolicitarRecuperacionDto {
  @ApiProperty({
    example: 'anfitrion@galapagos-ecolodge.ec',
    description: 'Correo electrónico registrado en Hábitat EC',
  })
  @IsEmail({}, { message: 'Ingresa un correo electrónico con formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio para recuperar tu contraseña.' })
  correo: string;
}

export class RestablecerPasswordDto {
  @ApiProperty({
    example: 'anfitrion@galapagos-ecolodge.ec',
    description: 'Correo electrónico de la cuenta a restablecer',
  })
  @IsEmail({}, { message: 'Ingresa un correo electrónico con formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  correo: string;

  @ApiProperty({
    example: '849201',
    description: 'Código de seguridad de 6 dígitos o token firmado recibido en el correo HTTPS',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de seguridad o token de recuperación es obligatorio.' })
  codigoSeguridad: string;

  @ApiPropertyOptional({
    description: 'Token JWT firmado de recuperación (opcional si se usa código de 6 dígitos)',
  })
  @IsOptional()
  @IsString()
  tokenRecuperacion?: string;

  @ApiProperty({
    example: 'NuevaClaveSegura2026!',
    minLength: 8,
    description: 'Nueva contraseña segura del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'Debes ingresar tu nueva contraseña.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  nuevaPassword: string;
}

