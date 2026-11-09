import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class CatalogController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('api/v2/alojamientos/health')
  async health() {
    const t0 = Date.now();
    await this.dataSource.query('SELECT 1;');
    return {
      status: 'HEALTHY',
      semaforo: 'GREEN',
      service: 'MS_CATALOG_GRAPHQL_REST',
      version: '2.2.0',
      latency_ms: Math.max(1, Date.now() - t0),
      uptime_seconds: Math.floor(process.uptime()),
      nodo_id: process.env.NODE_ID || 'NODE_ALO_HAB',
      vertical: 'ALOJAMIENTOS',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('graphql')
  async graphqlResolver(@Body() body: { query?: string; variables?: Record<string, any> }) {
    const queryStr = String(body?.query || '');
    const rows = await this.dataSource.query(
      `SELECT
         a.alojamiento_id AS "alojamientoId",
         a.titulo,
         a.descripcion,
         a.direccion,
         a.estado_operativo AS "estadoOperativo",
         a.activo,
         a.calificacion_promedio AS "calificacionPromedio",
         c.nombre AS ciudad,
         t.nombre AS tipo
       FROM alojamientos a
       JOIN ciudades c ON a.ciudad_id = c.ciudad_id
       JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
       WHERE a.activo = TRUE AND a.estado_operativo = 'PUBLICADO' AND a.deleted_at IS NULL
       ORDER BY a.alojamiento_id ASC;`,
    );

    return {
      data: {
        alojamientos: rows,
        queryReceived: queryStr.slice(0, 120),
      },
    };
  }

  @Get('api/v2/alojamientos')
  async listPublished(@Query('ciudad') ciudad?: string) {
    const params: unknown[] = [];
    let filter = '';
    if (ciudad) {
      params.push(`%${ciudad.trim()}%`);
      filter = 'AND c.nombre ILIKE $1';
    }
    const items = await this.dataSource.query(
      `SELECT
         a.alojamiento_id AS "alojamientoId",
         a.titulo,
         c.nombre AS ciudad,
         a.direccion,
         a.estado_operativo,
         a.activo,
         'USD' AS moneda
       FROM alojamientos a
       JOIN ciudades c ON a.ciudad_id = c.ciudad_id
       WHERE a.activo = TRUE AND a.estado_operativo = 'PUBLICADO' AND a.deleted_at IS NULL ${filter}
       ORDER BY a.alojamiento_id ASC;`,
      params,
    );
    return { total: items.length, moneda: 'USD', items };
  }
}

