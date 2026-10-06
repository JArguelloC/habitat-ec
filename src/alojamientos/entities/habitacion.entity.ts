import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import type { Alojamiento } from './alojamiento.entity.js';

@Entity('habitacion')
export class Habitacion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne('Alojamiento', (a: any) => a.habitacionesRelacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idAlojamiento' })
  alojamiento: Relation<Alojamiento>;

  @Column({ type: 'int' })
  idAlojamiento: number;

  @Column({ type: 'varchar', length: 100 })
  tipoHabitacion: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  precioBase: number;

  @Column({ type: 'int' })
  capacidadAdultos: number;

  @Column({ type: 'int' })
  inventarioTotal: number;
}

