export interface LinkDto {
  href: string;
  rel: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export class AccommodationResponseDto {
  id: number;
  name: string;
  description: string;
  tipo?: string;
  type?: string;
  country: string;
  cityId: number;
  pricePerNight: number;
  currency: string;
  maxAdults: number;
  rooms: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  _links: {
    self: LinkDto;
    update: LinkDto;
    delete: LinkDto;
    search: LinkDto;
  };
}

