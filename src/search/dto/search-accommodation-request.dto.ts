import { IsString, Matches, IsEnum, IsOptional, IsArray, IsInt, Min, Max, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookerDto } from './booker.dto.js';
import { AccommodationsGuestsDto } from './accommodations-guests.dto.js';

export enum SearchExtras {
  EXTRA_CHARGES = 'extra_charges',
  PRODUCTS = 'products',
}

export class SearchAccommodationRequestDto {
  @ApiProperty({ type: BookerDto })
  @ValidateNested()
  @Type(() => BookerDto)
  booker: BookerDto;

  @ApiProperty({ format: 'date', example: '2026-11-15' })
  @IsDateString({}, { message: 'El checkin debe tener formato YYYY-MM-DD' })
  checkin: string;

  @ApiProperty({ format: 'date', example: '2026-11-20' })
  @IsDateString({}, { message: 'El checkout debe tener formato YYYY-MM-DD' })
  checkout: string;

  @ApiPropertyOptional({ type: Number, description: 'ID interno de la ciudad' })
  @IsOptional()
  @IsInt()
  city?: number;

  @ApiPropertyOptional({ pattern: '^[a-z]{2}$', example: 'ec' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/)
  country?: string;

  @ApiProperty({ type: AccommodationsGuestsDto })
  @ValidateNested()
  @Type(() => AccommodationsGuestsDto)
  guests: AccommodationsGuestsDto;

  @ApiPropertyOptional({ enum: SearchExtras, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SearchExtras, { each: true })
  extras?: SearchExtras[];

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$', example: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La moneda debe ser 3 letras mayúsculas (Ej. USD)' })
  currency?: string;

  @ApiPropertyOptional({ minimum: 10, maximum: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  rows?: number = 100;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;
}