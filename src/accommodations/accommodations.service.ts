import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Accommodation } from './entities/accommodation.entity.js';
import { CreateAccommodationDto } from './dto/create-accommodation.dto.js';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto.js';
import { AccommodationResponseDto } from './dto/accommodation-response.dto.js';

@Injectable()
export class AccommodationsService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly accommodationRepo: Repository<Accommodation>,
  ) {}

  async create(createDto: CreateAccommodationDto): Promise<Accommodation> {
    const entity = this.accommodationRepo.create(createDto);
    return await this.accommodationRepo.save(entity);
  }

  async findAll(): Promise<Accommodation[]> {
    return await this.accommodationRepo.find();
  }

  async findOne(id: number): Promise<AccommodationResponseDto> {
    const item = await this.accommodationRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado`);
    }

    return this.buildHateoasResponse(item);
  }

  async update(id: number, updateDto: UpdateAccommodationDto): Promise<void> {
    const exists = await this.accommodationRepo.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para actualización`);
    }
    await this.accommodationRepo.update(id, updateDto);
  }

  async remove(id: number): Promise<void> {
    const result = await this.accommodationRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para eliminación`);
    }
  }

  private buildHateoasResponse(item: Accommodation): AccommodationResponseDto {
    return {
      ...item,
      _links: {
        self: { href: `/alojamientos/${item.id}`, rel: 'self', method: 'GET' },
        update: { href: `/alojamientos/${item.id}`, rel: 'update', method: 'PUT' },
        delete: { href: `/alojamientos/${item.id}`, rel: 'delete', method: 'DELETE' },
        search: { href: `/search`, rel: 'search', method: 'POST' },
      },
    };
  }
}

