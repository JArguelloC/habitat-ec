import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RegistrarFingerprintDto {
  @ApiProperty({
    example: 'fp-web-chrome-xyz1234567890abcdef',
    description: 'Hash SHA-256 único del dispositivo cliente',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  fingerprintHash: string;

  @ApiPropertyOptional({
    example: 'a0000000-0000-0000-0000-000000000001',
    description: 'UUID del usuario autenticado si aplica',
  })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiProperty({
    example: 'desktop',
    enum: ['android', 'desktop', 'ios', 'mobile', 'tablet'],
  })
  @IsString()
  @IsIn(['android', 'desktop', 'ios', 'mobile', 'tablet'])
  plataforma: 'android' | 'desktop' | 'ios' | 'mobile' | 'tablet';

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  bloqueado?: boolean;
}

