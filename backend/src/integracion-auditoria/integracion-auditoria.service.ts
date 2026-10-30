import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuscribirWebhookDto } from './dto/suscribir-webhook.dto.js';

@Injectable()
export class IntegracionAuditoriaService {
  constructor(private readonly dataSource: DataSource) {}

  async suscribirWebhook(suscriptorId: string, dto: SuscribirWebhookDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertSub = await queryRunner.query(
        `INSERT INTO webhook_subscriptions (suscriptor_id, url, secret, activo)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, suscriptor_id, url, activo, creado_en;`,
        [suscriptorId, dto.url.trim(), dto.secret.trim()],
      );

      const nuevaSub = insertSub[0];

      for (const eventType of dto.eventTypes) {
        await queryRunner.query(
          `INSERT INTO webhook_subscription_events (subscription_id, event_type)
           VALUES ($1, $2);`,
          [nuevaSub.id, eventType],
        );
      }

      await queryRunner.commitTransaction();

      return {
        mensaje: 'Suscripción de webhook registrada exitosamente.',
        suscripcion: nuevaSub,
        eventosSuscritos: dto.eventTypes,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listarWebhooks(usuarioId: string, roles: string[]) {
    const isSuperadmin = roles.includes('SUPERADMIN');
    let query = `
      SELECT 
        ws.id,
        ws.url,
        ws.activo,
        ws.creado_en,
        u.nombre || ' ' || u.apellido AS suscriptor_nombre,
        u.correo AS suscriptor_correo,
        COALESCE(
          json_agg(wse.event_type) FILTER (WHERE wse.event_type IS NOT NULL),
          '[]'::json
        ) AS eventos
      FROM webhook_subscriptions ws
      JOIN usuarios u ON ws.suscriptor_id = u.usuario_id
      LEFT JOIN webhook_subscription_events wse ON ws.id = wse.subscription_id
    `;
    const params: any[] = [];

    if (!isSuperadmin) {
      query += ` WHERE ws.suscriptor_id = $1`;
      params.push(usuarioId);
    }

    query += ` GROUP BY ws.id, ws.url, ws.activo, ws.creado_en, u.nombre, u.apellido, u.correo
               ORDER BY ws.creado_en DESC;`;

    return this.dataSource.query(query, params);
  }

  async listarOutbox(estado?: string, limite: number = 50) {
    let query = `
      SELECT event_id, correlation_id, event_type, resource_id, protocolo_origen, data,
             estado_despacho, intentos, "timestamp", procesado_en
      FROM outbox_events
    `;
    const params: any[] = [];

    if (estado) {
      query += ` WHERE estado_despacho = $1`;
      params.push(estado);
    }

    query += ` ORDER BY "timestamp" DESC LIMIT $${params.length + 1};`;
    params.push(limite);

    return this.dataSource.query(query, params);
  }

  async listarAuditoriaForense(limite: number = 50) {
    const query = `
      SELECT auditoria_id, correlation_id, nombre_tabla, operacion, registro_id,
             estado_anterior, estado_nuevo, ejecutado_en
      FROM auditoria_forense
      ORDER BY ejecutado_en DESC
      LIMIT $1;
    `;
    return this.dataSource.query(query, [limite]);
  }
}

