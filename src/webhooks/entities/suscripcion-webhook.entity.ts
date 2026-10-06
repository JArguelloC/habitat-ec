import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('suscripcion_webhook')
export class SuscripcionWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  urlDestino: string;

  @Column({ type: 'simple-array' })
  eventos: string[];

  @Column({ type: 'varchar', length: 255 })
  secreto: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

