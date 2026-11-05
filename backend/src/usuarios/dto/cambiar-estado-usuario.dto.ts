import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class CambiarEstadoUsuarioDto {
  @ApiProperty({
    example: false,
    description: 'Estado activo del usuario (true = Activo, false = Dado de baja / Inactivo)',
  })
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano.' })
  @IsNotEmpty({ message: 'El estado activo es obligatorio.' })
  activo: boolean;
}

