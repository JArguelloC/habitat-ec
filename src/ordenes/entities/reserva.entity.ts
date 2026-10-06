import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import type { Alojamiento } from '../../alojamientos/entities/alojamiento.entity.js';

@Entity('reserva')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Alojamiento', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'idAlojamiento' })
  alojamiento: Relation<Alojamiento>;

  @Column({ type: 'int', nullable: true })
  idAlojamiento?: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  localizador: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  estado: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  claveIdempotencia: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referenciaPago: string;

  @Column({ type: 'varchar', length: 100 })
  nombreCliente: string;

  @Column({ type: 'varchar', length: 100 })
  apellidoCliente: string;

  @Column({ type: 'varchar', length: 255 })
  correoCliente: string;

  @Column({ type: 'varchar', length: 2 })
  paisComprador: string;

  @Column({ type: 'varchar', length: 20 })
  plataformaComprador: string;

  @Column({ type: 'date' })
  fechaEntrada: string;

  @Column({ type: 'date' })
  fechaSalida: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montoTotal: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}

