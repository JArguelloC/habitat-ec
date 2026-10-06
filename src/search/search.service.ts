import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { SearchAccommodationRequestDto } from './dto/search-accommodation-request.dto.js';
import { SearchAccommodationResponseDto } from './dto/search-accommodation-response.dto.js';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Alojamiento)
    private readonly alojamientoRepo: Repository<Alojamiento>,
  ) {}

  async search(
    request: SearchAccommodationRequestDto,
  ): Promise<SearchAccommodationResponseDto> {
    const query = this.alojamientoRepo.createQueryBuilder('acc')
      .where('acc.activo = :available', { available: true });

    if (request.country) {
      query.andWhere('acc.pais = :country', { country: request.country });
    }

    if (request.city) {
      query.andWhere('acc.idCiudad = :city', { city: request.city });
    }

    if (request.guests?.number_of_adults) {
      query.andWhere('acc.maximoAdultos >= :adults', {
        adults: request.guests.number_of_adults,
      });
    }

    const take = request.rows ?? 100;
    query.take(take);

    const alojamientos = await query.getMany();

    return {
      request_id: `req-${randomUUID()}`,
      data: alojamientos.map((item) => ({
        id: item.id,
        url: `/alojamientos/${item.id}`,
      })),
      next_page: null,
    };
  }
}
