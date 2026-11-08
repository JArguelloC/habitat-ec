import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export const BANCOS_ECUADOR = [
  'BANCO_PICHINCHA',
  'BANCO_GUAYAQUIL',
  'BANCO_PACIFICO',
  'PRODUBANCO',
  'BANCO_INTERNACIONAL',
] as const;

export type BancoEcuadorType = (typeof BANCOS_ECUADOR)[number];

export const TIPOS_CUENTA_BANCARIA = ['AHORROS', 'CORRIENTE'] as const;
export type TipoCuentaBancariaType = (typeof TIPOS_CUENTA_BANCARIA)[number];

export class CrearCuentaBancariaDto {
  @ApiProperty({
    example: 'BANCO_PICHINCHA',
    enum: BANCOS_ECUADOR,
    description: 'Entidad bancaria ecuatoriana autorizada',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(BANCOS_ECUADOR, {
    message:
      'El banco debe ser uno de: BANCO_PICHINCHA, BANCO_GUAYAQUIL, BANCO_PACIFICO, PRODUBANCO, BANCO_INTERNACIONAL.',
  })
  banco: BancoEcuadorType;

  @ApiProperty({
    example: 'AHORROS',
    enum: TIPOS_CUENTA_BANCARIA,
    description: 'Tipo de cuenta bancaria (AHORROS o CORRIENTE)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(TIPOS_CUENTA_BANCARIA, {
    message: 'El tipo de cuenta debe ser AHORROS o CORRIENTE.',
  })
  tipoCuenta: TipoCuentaBancariaType;

  @ApiProperty({
    example: '2204567890',
    description: 'Número de cuenta bancaria',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(30)
  numeroCuenta: string;

  @ApiProperty({
    example: 'Mateo Villalobos',
    description: 'Nombres completos o razón social del titular de la cuenta',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  nombreTitular: string;

  @ApiProperty({
    example: '1712345678',
    description: 'Cédula de ciudadanía o RUC del titular',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  identificacionTitular: string;
}

