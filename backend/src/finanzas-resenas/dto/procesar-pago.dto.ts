import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class ProcesarPagoDto {
  @ApiProperty({
    example: 'd0000000-0000-0000-0000-000000000001',
    description: 'ID de la orden confirmada a cobrar',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 'TARJETA_CREDITO',
    enum: ['TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA'],
  })
  @IsString()
  @IsIn(['TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA'])
  metodoPago: 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA';

  @ApiPropertyOptional({ example: '4242', maxLength: 4, minLength: 4 })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  ultimosCuatro?: string;

  @ApiProperty({ example: 425.5, description: 'Monto cobrado en USD' })
  @IsNumber()
  @IsPositive()
  montoCobrado: number;

  @ApiProperty({
    example: 'AUTH-GATEWAY-TX-99001',
    description: 'Código de transacción de la pasarela de pagos',
  })
  @IsString()
  @IsNotEmpty()
  referenciaPasarela: string;

  @ApiPropertyOptional({
    example: 'PAYPHONE_EC',
    enum: ['PAYPHONE_EC', 'STRIPE', 'SANDBOX_INTERNAL'],
    description: 'Adquirente / Pasarela utilizada para procesar el cobro',
  })
  @IsOptional()
  @IsString()
  @IsIn(['PAYPHONE_EC', 'STRIPE', 'SANDBOX_INTERNAL'])
  proveedorPasarela?: 'PAYPHONE_EC' | 'STRIPE' | 'SANDBOX_INTERNAL';

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/comprobante.jpg',
    description: 'URL del comprobante de transferencia bancaria',
  })
  @IsOptional()
  @IsString()
  comprobanteUrl?: string;
}
