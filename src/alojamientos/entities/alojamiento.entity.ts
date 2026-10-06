import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import type { Habitacion } from './habitacion.entity.js';
import type { Resena } from '../../resenas/entities/resena.entity.js';
import type { CotizacionPrevia } from '../../ordenes/entities/cotizacion-previa.entity.js';

@Entity('alojamiento')
export class Alojamiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 50 })
  tipo: string;

  @Column({ type: 'varchar', length: 2 })
  pais: string;

  @Column({ type: 'int' })
  idCiudad: number;

  @Column({ type: 'text' })
  direccion: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  precioPorNoche: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'int', default: 2 })
  maximoAdultos: number;

  @Column({ type: 'int', default: 1 })
  habitaciones: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'uuid', nullable: true })
  idPropietario?: string;

  @CreateDateColumn()
  creadoEn: Date;

  @OneToMany('Habitacion', (h: any) => h.alojamiento)
  habitacionesRelacion: Relation<Habitacion>[]; // renamed to not conflict with `habitaciones: number`

  @OneToMany('Resena', (r: any) => r.alojamiento)
  resenas: Relation<Resena>[];

  @OneToMany('CotizacionPrevia', (cp: any) => cp.alojamiento)
  cotizaciones: Relation<CotizacionPrevia>[];

  @UpdateDateColumn()
  actualizadoEn: Date;
}

