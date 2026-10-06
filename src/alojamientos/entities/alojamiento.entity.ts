import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

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

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}

