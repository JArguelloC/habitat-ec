import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { Alojamiento } from '../../alojamientos/entities/alojamiento.entity.js';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('cotizacion_previa')
export class CotizacionPrevia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Alojamiento', (a: any) => a.cotizaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idAlojamiento' })
  alojamiento: Relation<Alojamiento>;

  @Column({ type: 'int' })
  idAlojamiento: number;

  @Column({ type: 'varchar', length: 100 })
  idProducto: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  precioTotal: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'jsonb' })
  detalleHuespedes: any;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;
}

