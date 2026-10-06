import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Accommodation } from '../accommodations/entities/accommodation.entity.js';
import { SearchAccommodationRequestDto } from './dto/search-accommodation-request.dto.js';
import { SearchAccommodationResponseDto } from './dto/search-accommodation-response.dto.js';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly accommodationRepo: Repository<Accommodation>,
  ) {}

  async search(
    request: SearchAccommodationRequestDto,
  ): Promise<SearchAccommodationResponseDto> {
    const query = this.accommodationRepo.createQueryBuilder('acc')
      .where('acc.isAvailable = :available', { available: true });

    if (request.country) {
      query.andWhere('acc.country = :country', { country: request.country });
    }

    if (request.city) {
      query.andWhere('acc.cityId = :city', { city: request.city });
    }

    if (request.guests?.number_of_adults) {
      query.andWhere('acc.maxAdults >= :adults', {
        adults: request.guests.number_of_adults,
      });
    }

    const take = request.rows ?? 100;
    query.take(take);

    const accommodations = await query.getMany();

    return {
      request_id: `req-${randomUUID()}`,
      data: accommodations.map((item) => ({
        id: item.id,
        url: `/alojamientos/${item.id}`,
      })),
      next_page: null,
    };
  }
}

