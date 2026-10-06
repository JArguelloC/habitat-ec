import { ApiProperty } from '@nestjs/swagger';

export class OrderPreviewGuestsDto {
  @ApiProperty({ example: 2 })
  number_of_adults: number;
}

export class OrderPreviewRequestDto {
  @ApiProperty({ example: 101 })
  accommodation_id: number;

  @ApiProperty({ example: 'HAB-01' })
  product_id: string;

  @ApiProperty()
  guests: OrderPreviewGuestsDto;
}

export class CustomerDetailsDto {
  @ApiProperty({ example: 'Juan' })
  first_name: string;

  @ApiProperty({ example: 'Perez' })
  last_name: string;

  @ApiProperty({ example: 'juan@example.com' })
  email: string;

  @ApiProperty({ example: 'EC' })
  country: string;

  @ApiProperty({ example: 'IOS' })
  platform: string;
}

export class OrderCreateRequestDto {
  @ApiProperty({ example: 'uuid-de-cotizacion' })
  order_preview_id: string;

  @ApiProperty({ example: 'PAY-123456' })
  payment_reference: string;

  @ApiProperty()
  customer_details: CustomerDetailsDto;
}

