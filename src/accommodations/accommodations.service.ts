import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { CreateAccommodationDto } from './dto/create-accommodation.dto.js';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto.js';
import { AccommodationResponseDto } from './dto/accommodation-response.dto.js';

@Injectable()
export class AccommodationsService {
  constructor(
    @InjectRepository(Alojamiento)
    private readonly alojamientoRepo: Repository<Alojamiento>,
  ) {}

  async create(createDto: CreateAccommodationDto): Promise<AccommodationResponseDto> {
    const entity = this.alojamientoRepo.create({
      nombre: createDto.name,
      descripcion: createDto.description ?? '',
      tipo: createDto.tipo ?? 'hotel', // default mapping
      pais: createDto.country,
      idCiudad: createDto.cityId,
      direccion: createDto.direccion ?? 'Pendiente', // default mapping
      precioPorNoche: createDto.pricePerNight,
      moneda: createDto.currency ?? 'USD',
      maximoAdultos: createDto.maxAdults,
      habitaciones: createDto.rooms,
      activo: true,
    });
    const saved = await this.alojamientoRepo.save(entity);
    return this.buildHateoasResponse(saved);
  }

  async findAll(): Promise<AccommodationResponseDto[]> {
    const entities = await this.alojamientoRepo.find();
    return entities.map(e => this.buildHateoasResponse(e));
  }

  async findOne(id: number): Promise<AccommodationResponseDto> {
    const item = await this.alojamientoRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado`);
    }

    return this.buildHateoasResponse(item);
  }

  async update(id: number, updateDto: UpdateAccommodationDto): Promise<void> {
    const exists = await this.alojamientoRepo.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para actualización`);
    }
    
    const updateData: Partial<Alojamiento> = {};
    if (updateDto.name) updateData.nombre = updateDto.name;
    if (updateDto.description) updateData.descripcion = updateDto.description;
    if (updateDto.country) updateData.pais = updateDto.country;
    if (updateDto.cityId) updateData.idCiudad = updateDto.cityId;
    if (updateDto.pricePerNight) updateData.precioPorNoche = updateDto.pricePerNight;
    if (updateDto.currency) updateData.moneda = updateDto.currency;
    if (updateDto.maxAdults) updateData.maximoAdultos = updateDto.maxAdults;
    if (updateDto.rooms) updateData.habitaciones = updateDto.rooms;
    if (updateDto.tipo) updateData.tipo = updateDto.tipo;
    if (updateDto.direccion) updateData.direccion = updateDto.direccion;

    await this.alojamientoRepo.update(id, updateData);
  }

  async remove(id: number): Promise<void> {
    const result = await this.alojamientoRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Alojamiento con ID ${id} no encontrado para eliminación`);
    }
  }

  private buildHateoasResponse(item: Alojamiento): AccommodationResponseDto {
    return {
      id: item.id,
      name: item.nombre,
      description: item.descripcion,
      tipo: item.tipo,
      type: item.tipo,
      country: item.pais,
      cityId: item.idCiudad,
      pricePerNight: item.precioPorNoche,
      currency: item.moneda,
      maxAdults: item.maximoAdultos,
      rooms: item.habitaciones,
      isAvailable: item.activo,
      createdAt: item.creadoEn,
      updatedAt: item.actualizadoEn,
      _links: {
        self: { href: `/alojamientos/${item.id}`, rel: 'self', method: 'GET' },
        update: { href: `/alojamientos/${item.id}`, rel: 'update', method: 'PUT' },
        delete: { href: `/alojamientos/${item.id}`, rel: 'delete', method: 'DELETE' },
        search: { href: `/search`, rel: 'search', method: 'POST' },
      },
    };
  }
}
