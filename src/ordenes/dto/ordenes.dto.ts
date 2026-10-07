import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, ValidateNested, IsEmail, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderPreviewGuestsDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  number_of_adults?: number;
}

export class OrderPreviewRequestDto {
  @ApiPropertyOptional({ example: 101 })
  @IsOptional()
  @IsInt()
  accommodation_id?: number;

  @ApiPropertyOptional({ example: 101 })
  @IsOptional()
  @IsInt()
  alojamientoId?: number;

  @ApiPropertyOptional({ example: 'HAB-01' })
  @IsOptional()
  @IsString()
  product_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderPreviewGuestsDto)
  guests?: OrderPreviewGuestsDto;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  huespedes?: number;
}

export class CustomerDetailsDto {
  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'Perez' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: 'Perez' })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiPropertyOptional({ example: 'EC' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'IOS' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class OrderCreateRequestDto {
  @ApiPropertyOptional({ example: 'uuid-de-cotizacion' })
  @IsOptional()
  @IsString()
  order_preview_id?: string;

  @ApiPropertyOptional({ example: 'uuid-de-cotizacion' })
  @IsOptional()
  @IsString()
  cotizacionId?: string;

  @ApiPropertyOptional({ example: 'PAY-123456' })
  @IsOptional()
  @IsString()
  payment_reference?: string;

  @ApiPropertyOptional({ example: 'PAY-123456' })
  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-15' })
  @IsOptional()
  @IsDateString()
  checkin?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-17' })
  @IsOptional()
  @IsDateString()
  checkout?: string;

  @ApiPropertyOptional({ example: 'TARJETA' })
  @IsOptional()
  @IsString()
  metodoPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customer_details?: CustomerDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  cliente?: CustomerDetailsDto;
}

