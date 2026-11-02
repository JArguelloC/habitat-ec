import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrearIntentPagoDto {
  @ApiProperty({
    example: 'd0000000-0000-0000-0000-000000000001',
    description: 'UUID de la orden confirmada a cobrar',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 'PAYPHONE_EC',
    enum: ['PAYPHONE_EC', 'STRIPE', 'SANDBOX_INTERNAL'],
    description: 'Proveedor de pasarela de pago seleccionado',
  })
  @IsString()
  @IsIn(['PAYPHONE_EC', 'STRIPE', 'SANDBOX_INTERNAL'])
  proveedor: 'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL';

  @ApiProperty({
    example: 285.0,
    description: 'Monto total a autorizar en USD',
  })
  @IsNumber()
  @IsPositive()
  montoCobrado: number;

  @ApiPropertyOptional({
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  moneda?: string;
}

