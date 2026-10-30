import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  MinLength,
  Min,
  Max,
  IsOptional,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearAlojamientoDto {
  @ApiProperty({
    example: 'Eco-Lodge Cabañas del Bosque Nublado',
    description: 'Título descriptivo de la propiedad ecológica',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres.' })
  titulo: string;

  @ApiProperty({
    example: 'Alojamiento ecológico rodeado de flora nativa, senderos y cascadas.',
    description: 'Descripción detallada',
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  descripcion: string;

  @ApiProperty({
    example: 'Km 5 Vía a Mindo, Pichincha',
    description: 'Dirección física del alojamiento',
  })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  direccion: string;

  @ApiProperty({
    example: 1,
    description: 'ID de la ciudad registrada en el catálogo (ej: Mindo = 1)',
  })
  @IsInt({ message: 'El ciudadId debe ser un número entero.' })
  @IsPositive()
  ciudadId: number;

  @ApiProperty({
    example: 1,
    description: 'ID del tipo de alojamiento (ej: ECO_LODGE = 1)',
  })
  @IsInt({ message: 'El tipoId debe ser un número entero.' })
  @IsPositive()
  tipoId: number;

  @ApiProperty({
    example: 85.0,
    description: 'Precio base por noche en dólares',
  })
  @IsNumber({}, { message: 'El precio base por noche debe ser numérico.' })
  @IsPositive({ message: 'El precio debe ser mayor a 0.' })
  precioBaseNoche: number;

  @ApiProperty({
    example: 4,
    description: 'Capacidad máxima de adultos',
  })
  @IsInt({ message: 'maxAdultos debe ser un número entero.' })
  @Min(1, { message: 'Debe permitir al menos 1 adulto.' })
  @Max(30, { message: 'Capacidad máxima excedida.' })
  maxAdultos: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Cantidad de habitaciones disponibles',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  habitaciones?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cantidad de baños disponibles',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  banos?: number;
}