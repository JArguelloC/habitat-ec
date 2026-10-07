import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alojamiento } from './entities/alojamiento.entity.js';

@Injectable()
export class AlojamientosSeederService implements OnModuleInit {
  private readonly logger = new Logger(AlojamientosSeederService.name);

  constructor(
    @InjectRepository(Alojamiento)
    private readonly alojamientoRepo: Repository<Alojamiento>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    try {
      const count = await this.alojamientoRepo.count();
      if (count > 0) {
        this.logger.log('Los alojamientos ya están poblados, saltando seed...');
        return;
      }

      this.logger.log('Iniciando sembrado (Seed) de alojamientos desde mock data de Lovable...');

      const alojamientosMock = [
        { nombre: 'Refugio del Cotopaxi', tipo: 'Cabaña de Montaña', idCiudad: 1, direccion: 'Camino al páramo, km 12', precioPorNoche: 95, maximoAdultos: 4, habitaciones: 2, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'Despierta frente a los Andes. Una cabaña de madera, ventanales abiertos al paisaje y el silencio del páramo.' },
        { nombre: 'Mindo Bosque Vivo', tipo: 'Eco-Lodge', idCiudad: 2, direccion: 'Vía al bosque nublado, km 3', precioPorNoche: 78, maximoAdultos: 4, habitaciones: 2, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'Un refugio entre helechos y colibríes. Arquitectura que se integra al bosque nublado y una terraza para desconectar.' },
        { nombre: 'Isla Brisa Boutique', tipo: 'Hotel Boutique', idCiudad: 3, direccion: 'Avenida Charles Darwin', precioPorNoche: 165, maximoAdultos: 4, habitaciones: 2, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'La calma del Pacífico, jardines de plantas nativas y una estancia íntima en el corazón de las islas.' },
        { nombre: 'Casa del Patio', tipo: 'Hotel Boutique', idCiudad: 4, direccion: 'Centro histórico, calle Larga', precioPorNoche: 88, maximoAdultos: 6, habitaciones: 3, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'Patios llenos de vida y tradición cuencana en una casa patrimonial restaurada con cuidado.' },
        { nombre: 'Napo Selva Lodge', tipo: 'Eco-Lodge', idCiudad: 5, direccion: 'Vía al río Napo, km 8', precioPorNoche: 65, maximoAdultos: 6, habitaciones: 3, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'Conecta con la selva y sus sonidos en un alojamiento de bajo impacto junto al río.' },
        { nombre: 'Brisa del Pacífico', tipo: 'Hostal', idCiudad: 6, direccion: 'Malecón de Montañita', precioPorNoche: 38, maximoAdultos: 4, habitaciones: 2, moneda: 'USD', pais: 'EC', activo: true, descripcion: 'Días de mar, espacios compartidos y la hospitalidad de la costa ecuatoriana.' },
      ];

      for (const item of alojamientosMock) {
        const alojamiento = this.alojamientoRepo.create(item);
        await this.alojamientoRepo.save(alojamiento);
      }

      this.logger.log(`Sembrado completado: Se insertaron ${alojamientosMock.length} alojamientos.`);
    } catch (error) {
      this.logger.error('Error durante el sembrado de alojamientos', error);
    }
  }
}

