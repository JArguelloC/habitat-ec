import { IsInt, Min, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AllocationDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  adults?: number;

  @ApiPropertyOptional({ type: [Number], example: [4, 7] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  children?: number[];
}

export class AccommodationsGuestsDto {
  @ApiProperty({ minimum: 1, example: 2 })
  @IsInt()
  @Min(1, { message: 'Debe haber al menos 1 adulto' })
  number_of_adults: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1, { message: 'Debe haber al menos 1 habitación' })
  number_of_rooms: number;

  @ApiPropertyOptional({ type: [Number], description: 'Edades de los niños', example: [4, 7] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  children?: number[];

  @ApiPropertyOptional({ type: [AllocationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto) // Crucial para que class-validator valide objetos anidados
  allocation?: AllocationDto[];
}