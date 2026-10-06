import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { Alojamiento } from '../../alojamientos/entities/alojamiento.entity.js';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('resena')
export class Resena {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne('Alojamiento', (a: any) => a.resenas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idAlojamiento' })
  alojamiento: Relation<Alojamiento>;

  @Column({ type: 'int' })
  idAlojamiento: number;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    transformer: new ColumnNumericTransformer(),
  })
  puntajeLimpieza: number;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    transformer: new ColumnNumericTransformer(),
  })
  puntajeUbicacion: number;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    transformer: new ColumnNumericTransformer(),
  })
  puntajeServicio: number;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    transformer: new ColumnNumericTransformer(),
  })
  puntajeGeneral: number;

  @Column({ type: 'text' })
  comentario: string;

  @CreateDateColumn()
  creadoEn: Date;
}

