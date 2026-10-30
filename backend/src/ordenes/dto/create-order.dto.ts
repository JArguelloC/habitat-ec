import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CustomerDto {
  @ApiProperty({ example: 'James' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Argüello' })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiProperty({ example: 'james.arguello@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class CreateOrderDto {
  @ApiProperty({
    example: 'c0000000-0000-0000-0000-000000000001',
    description: 'ID de la previsualización Hold activa',
  })
  @IsUUID()
  @IsNotEmpty()
  orderPreviewId: string;

  @ApiProperty({
    example: 'PAY-CARD-REF-9921',
    description: 'Referencia o código de autorización del procesador de pago',
  })
  @IsString()
  @IsNotEmpty()
  paymentReference: string;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  @IsNotEmpty()
  customer: CustomerDto;

  @ApiPropertyOptional({
    example: 'WEB_REST',
    default: 'WEB_REST',
    description: 'Protocolo de integración del canal',
  })
  @IsOptional()
  @IsString()
  canalProtocolo?: string;

  @ApiPropertyOptional({
    example: 'FREE_CANCELLATION',
    default: 'FREE_CANCELLATION',
    description: 'Código de política de cancelación elegida',
  })
  @IsOptional()
  @IsString()
  politicaCodigo?: string;

  @ApiPropertyOptional({
    example: [5, 8],
    description: 'Edades de los niños acompañantes para orden_distribucion_ninos (4FN)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  ninosEdades?: number[];
}

