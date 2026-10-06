import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccommodationItemDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: '/alojamientos/101' })
  url: string;
}

export class SearchAccommodationResponseDto {
  @ApiProperty({ example: 'req-f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  request_id: string;

  @ApiProperty({ type: [AccommodationItemDto] })
  data: AccommodationItemDto[];

  @ApiPropertyOptional({ example: null, nullable: true })
  next_page: string | null;
}

