import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('habitacion')
export class Habitacion {
  @PrimaryGeneratedColumn()
  id: number;

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

