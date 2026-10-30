import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SuscribirWebhookDto {
  @ApiProperty({
    example: 'https://webhook.site/my-integration-endpoint',
    description: 'URL de destino para recibir notificaciones HTTP POST',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(500)
  url: string;

  @ApiProperty({
    example: 'whsec_HabitatSecretKey2026_xyz',
    description: 'Secreto compartido para firma HMAC SHA-256',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  secret: string;

  @ApiProperty({
    example: ['ORDER_CONFIRMED', 'ORDER_CANCELLED'],
    description: 'Eventos de dominio a los cuales suscribirse (webhook_subscription_events)',
    type: [String],
    enum: [
      'ORDER_CONFIRMED',
      'ORDER_CANCELLED',
      'ORDER_MODIFIED',
      'ACCOMMODATION_UPDATED',
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(
    [
      'ORDER_CONFIRMED',
      'ORDER_CANCELLED',
      'ORDER_MODIFIED',
      'ACCOMMODATION_UPDATED',
    ],
    { each: true },
  )
  eventTypes: (
    | 'ORDER_CONFIRMED'
    | 'ORDER_CANCELLED'
    | 'ORDER_MODIFIED'
    | 'ACCOMMODATION_UPDATED'
  )[];
}

