import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { EstadoOperativoEnum } from '../enums/estado-operativo.enum.js';

export const NumericColumnTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null): number | null =>
    value !== null && value !== undefined ? Number.parseFloat(String(value)) : null,
};

@Entity('alojamientos')
export class Alojamiento {
  @PrimaryGeneratedColumn({ name: 'alojamiento_id', type: 'bigint' })
  alojamientoId: number;

  @Column({ name: 'propietario_id', type: 'uuid' })
  propietarioId: string;

  @Column({ name: 'ciudad_id', type: 'int' })
  ciudadId: number;

  @Column({ name: 'tipo_id', type: 'int' })
  tipoId: number;

  @Column({ name: 'marca_id', type: 'int', nullable: true })
  marcaId?: number | null;

  @Column({ name: 'titulo', type: 'varchar', length: 150 })
  titulo: string;

  @Column({ name: 'descripcion', type: 'text' })
  descripcion: string;

  @Column({ name: 'direccion', type: 'varchar', length: 255 })
  direccion: string;

  @Column({
    name: 'latitud',
    type: 'numeric',
    precision: 10,
    scale: 6,
    transformer: NumericColumnTransformer,
  })
  latitud: number;

  @Column({
    name: 'longitud',
    type: 'numeric',
    precision: 10,
    scale: 6,
    transformer: NumericColumnTransformer,
  })
  longitud: number;

  @Column({
    name: 'estado_operativo',
    type: 'varchar',
    length: 30,
    default: EstadoOperativoEnum.PUBLICADO,
  })
  estadoOperativo: EstadoOperativoEnum;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'hora_checkin', type: 'varchar', length: 5, default: '14:00' })
  horaCheckin: string;

  @Column({ name: 'hora_checkout', type: 'varchar', length: 5, default: '11:00' })
  horaCheckout: string;

  @Column({ name: 'moneda_base', type: 'char', length: 3, default: 'USD' })
  monedaBase: string;

  @Column({
    name: 'calificacion_promedio',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 5.0,
    transformer: NumericColumnTransformer,
  })
  calificacionPromedio: number;

  @Column({ name: 'total_resenas', type: 'int', default: 0 })
  totalResenas: number;

  @Column({ name: 'motivo_baja', type: 'text', nullable: true })
  motivoBaja?: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz', nullable: true })
  actualizadoEn?: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

