import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://mi-servidor.com/webhook' })
  url: string;

  @ApiProperty({ example: ['accommodation.booked', 'price.changed'] })
  events: string[];

  @ApiProperty({ example: 'super_secreto_123' })
  secret: string;
}

