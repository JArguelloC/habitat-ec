import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('resena')
export class Resena {
  @PrimaryGeneratedColumn()
  id: number;

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

