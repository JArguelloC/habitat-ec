import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { OutboxWorkerService } from './outbox-worker.service.js';

@Controller()
export class SoaPaymentsController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWorker: OutboxWorkerService,
  ) {}

  @Get('api/v2/alojamientos/health')
  async health() {
    const t0 = Date.now();
    await this.dataSource.query('SELECT 1;');
    return {
      status: 'HEALTHY',
      semaforo: 'GREEN',
      service: 'MS_PAYMENTS_SOA_EDA',
      version: '2.2.0',
      latency_ms: Math.max(1, Date.now() - t0),
      uptime_seconds: Math.floor(process.uptime()),
      nodo_id: process.env.NODE_ID || 'NODE_ALO_HAB',
      vertical: 'ALOJAMIENTOS',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('soa/contract/settlement-policy')
  getSettlementContract() {
    return {
      serviceName: 'HabitatFinancialSettlementSOA',
      contractVersion: '2.2.0',
      splitModel: {
        hostNetPercentage: 85.0,
        platformCommissionPercentage: 15.0,
        vatEcuadorPercentage: 15.0,
      },
      eventBus: {
        broker: 'CloudAMQP RabbitMQ',
        exchange: 'booking.events',
        pattern: 'Transactional Outbox Pattern',
      },
    };
  }

  @Get('api/v2/clientes')
  async findCliente(
    @Query('email') email?: string,
    @Query('identificacion') identificacion?: string,
  ) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanId = (identificacion || '').trim();
    if (!cleanEmail && !cleanId) {
      throw new BadRequestException('Debe proporcionar email o identificacion.');
    }

    const rows = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, identificacion, telefono
       FROM usuarios
       WHERE ($1 <> '' AND LOWER(correo) = $1)
          OR ($2 <> '' AND identificacion = $2)
       LIMIT 1;`,
      [cleanEmail, cleanId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    const u = rows[0];
    return {
      client_id: u.usuario_id,
      nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim(),
      email: u.correo,
      identificacion: u.identificacion,
      telefono: u.telefono,
    };
  }

  @Post('api/v2/clientes')
  async upsertCliente(
    @Body()
    dto: {
      nombre?: string;
      email?: string;
      identificacion?: string;
      telefono?: string;
    },
  ) {
    const cleanEmail = (
      dto.email || `cliente.${Date.now()}@booking.habitat.ec`
    )
      .trim()
      .toLowerCase();
    const cleanId = dto.identificacion ? String(dto.identificacion).trim() : null;
    const cleanTel = dto.telefono ? String(dto.telefono).trim() : null;

    const existing = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, identificacion, telefono
       FROM usuarios
       WHERE LOWER(correo) = $1
          OR ($2::VARCHAR IS NOT NULL AND $2 <> '' AND identificacion = $2)
       LIMIT 1;`,
      [cleanEmail, cleanId],
    );
    if (existing.length > 0) {
      return {
        client_id: existing[0].usuario_id,
        nombre: `${existing[0].nombre} ${existing[0].apellido}`.trim(),
        email: existing[0].correo,
        identificacion: cleanId || existing[0].identificacion,
      };
    }

    const parts = (dto.nombre || 'Huésped Booking').trim().split(/\s+/);
    const hash = await bcrypt.hash(crypto.randomUUID(), 10);
    const created = await this.dataSource.query(
      `INSERT INTO usuarios (nombre, apellido, correo, password_hash, telefono, identificacion, pais_iso, activo)
       VALUES ($1, $2, $3, $4, $5, $6, 'ec', TRUE)
       RETURNING usuario_id, nombre, apellido, correo, identificacion;`,
      [
        parts[0] || 'Huésped',
        parts.slice(1).join(' ') || 'Booking',
        cleanEmail,
        hash,
        cleanTel,
        cleanId,
      ],
    );
    return {
      client_id: created[0].usuario_id,
      nombre: `${created[0].nombre} ${created[0].apellido}`.trim(),
      email: created[0].correo,
      identificacion: created[0].identificacion,
    };
  }

  @Post('soa/outbox/dispatch')
  async triggerOutboxDispatch() {
    await this.outboxWorker.processOutboxQueue();
    return { status: 'DISPATCHED', timestamp: new Date().toISOString() };
  }
}
