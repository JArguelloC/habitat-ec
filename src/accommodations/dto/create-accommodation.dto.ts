import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsInt, Min, IsNumber, IsOptional } from 'class-validator';

export class CreateAccommodationDto {
  @ApiProperty({ example: 'Hotel Casa Gangotena' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Alojamiento boutique histórico en el Centro de Quito' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'ec', description: 'Código ISO 3166-1 alpha-2 en minúsculas' })
  @IsString()
  @Matches(/^[a-z]{2}$/, { message: 'El país debe tener exactamente 2 letras minúsculas (ej. ec)' })
  country: string;

  @ApiProperty({ example: 170150, description: 'ID de la ciudad' })
  @IsInt()
  @Min(1)
  cityId: number;

  @ApiProperty({ example: 145.50 })
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La moneda debe tener exactamente 3 letras mayúsculas' })
  currency?: string = 'USD';

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  maxAdults: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  rooms: number;
}

