import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { PublicB2b } from '../b2b/decorators/public-b2b.decorator.js';

interface GraphQLRequestDto {
  query?: string;
  operationName?: string;
  variables?: Record<string, any>;
}

@ApiTags('2.1 Catálogo GraphQL BFF (/graphql - habitat-ms-catalog)')
@PublicB2b()
@Controller({ path: 'graphql', version: [VERSION_NEUTRAL, '1', '2'] })
export class CatalogGraphqlController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[GraphQL BFF] Metadatos del esquema SDL y estado del motor GraphQL de Catálogo',
  })
  getGraphqlInfo() {
    return {
      service: 'habitat-ms-catalog',
      paradigm: 'GraphQL + REST BFF',
      endpoint: '/api/v1/graphql',
      status: 'ACTIVE',
      queriesSupported: [
        'alojamientos(ciudad, limit)',
        'alojamiento(id)',
        'ciudades',
        'contratos5FN(alojamientoId)',
        '__schema',
      ],
      sampleQuery:
        'query { alojamientos { alojamientoId titulo ciudad precioBaseNoche portadaUrl habitaciones { productoId nombreProducto stockDisponible precioBaseNoche } contratos5FN { canalCodigo politicaCodigo } } }',
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[GraphQL BFF] Ejecutar consulta GraphQL flexible de alojamientos, fotos, precios y matriz 5FN sin over-fetching',
  })
  async executeGraphql(@Body() body: GraphQLRequestDto = {}) {
    const queryStr = String(body.query || '').trim();
    const vars = body.variables || {};

    if (!queryStr) {
      return {
        errors: [{ message: 'Se requiere un documento query GraphQL válido.' }],
      };
    }

    const resultData: Record<string, any> = {};

    // 1. Introspección GraphQL (__schema / __type)
    if (queryStr.includes('__schema') || queryStr.includes('__type')) {
      resultData.__schema = {
        queryType: { name: 'Query' },
        types: [
          { name: 'Query', kind: 'OBJECT' },
          { name: 'AlojamientoCard', kind: 'OBJECT' },
          { name: 'FotoAlojamiento', kind: 'OBJECT' },
          { name: 'HabitacionProducto', kind: 'OBJECT' },
          { name: 'CiudadGeo', kind: 'OBJECT' },
          { name: 'Contrato5FN', kind: 'OBJECT' },
        ],
      };
    }

    // 2. Resolver Query: ciudades
    if (/\bciudades\b/.test(queryStr)) {
      const ciudadesRows = await this.dataSource.query(
        `SELECT ciudad_id AS "ciudadId", nombre, latitud, longitud
         FROM ciudades
         ORDER BY nombre ASC;`,
      );
      resultData.ciudades = ciudadesRows.map((c: Record<string, any>) => ({
        ciudadId: String(c.ciudadId),
        nombre: c.nombre,
        latitud: Number(c.latitud || 0),
        longitud: Number(c.longitud || 0),
      }));
    }

    // 3. Resolver Query: contratos5FN
    if (/\bcontratos5FN\b/.test(queryStr) && !/\balojamientos\b/.test(queryStr)) {
      const aloId = vars.alojamientoId ? Number(vars.alojamientoId) : null;
      const params: unknown[] = [];
      let where = '';
      if (aloId) {
        params.push(aloId);
        where = 'WHERE alojamiento_id = $1';
      }
      const cRows = await this.dataSource.query(
        `SELECT
           alojamiento_id AS "alojamientoId",
           codigo_protocolo AS "canalCodigo",
           codigo_politica AS "politicaCodigo",
           comision_porcentaje AS "comisionPorcentaje",
           reembolso_porcentaje AS "reembolsoPorcentaje"
         FROM vw_contratos_5fn_validos
         ${where}
         LIMIT 100;`,
        params,
      );
      resultData.contratos5FN = cRows;
    }

    // 4. Resolver Query: alojamientos / alojamiento(id)
    if (/\balojamientos\b/.test(queryStr) || /\balojamiento\b/.test(queryStr)) {
      const ciudadFilter = vars.ciudad || null;
      const idMatch = queryStr.match(/alojamiento\s*\(\s*id\s*:\s*["']?(\d+)["']?\s*\)/);
      const specificId = vars.id || (idMatch ? Number(idMatch[1]) : null);

      const params: unknown[] = [];
      let where = `WHERE a.activo = TRUE AND a.estado_operativo = 'PUBLICADO' AND a.deleted_at IS NULL`;

      if (specificId) {
        params.push(Number(specificId));
        where += ` AND a.alojamiento_id = $${params.length}`;
      } else if (ciudadFilter) {
        params.push(`%${String(ciudadFilter).trim()}%`);
        where += ` AND c.nombre ILIKE $${params.length}`;
      }

      const wantFotos = /\bfotos\b/.test(queryStr);
      const wantHabitaciones = /\bhabitaciones\b/.test(queryStr);
      const wantContratos = /\bcontratos5FN\b/.test(queryStr);

      const rows = await this.dataSource.query(
        `SELECT
           a.alojamiento_id,
           a.titulo,
           a.descripcion,
           a.direccion,
           a.estado_operativo,
           a.activo,
           a.calificacion_promedio,
           a.total_resenas,
           a.hora_checkin,
           a.hora_checkout,
           c.nombre AS ciudad,
           t.nombre AS tipo,
           (
             SELECT af.url_imagen
             FROM alojamiento_fotos af
             WHERE af.alojamiento_id = a.alojamiento_id
             ORDER BY af.es_portada DESC, af.orden ASC
             LIMIT 1
           ) AS portada_url,
           COALESCE(
             (
               SELECT MIN(ph.precio_base_noche)
               FROM productos_habitacion ph
               WHERE ph.alojamiento_id = a.alojamiento_id AND ph.activo = TRUE
             ),
             100.00
           ) AS precio_base_noche
         FROM alojamientos a
         JOIN ciudades c ON a.ciudad_id = c.ciudad_id
         JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
         ${where}
         ORDER BY a.alojamiento_id ASC
         LIMIT 50;`,
        params,
      );

      const mapped = await Promise.all(
        rows.map(async (r: Record<string, any>) => {
          const card: Record<string, any> = {
            alojamientoId: String(r.alojamiento_id),
            titulo: r.titulo,
            descripcion: r.descripcion,
            direccion: r.direccion,
            ciudad: r.ciudad,
            tipo: r.tipo,
            estadoOperativo: r.estado_operativo,
            activo: Boolean(r.activo),
            calificacionPromedio: Number(r.calificacion_promedio || 5.0),
            totalResenas: Number(r.total_resenas || 0),
            horaCheckin: r.hora_checkin || '14:00',
            horaCheckout: r.hora_checkout || '11:00',
            precioBaseNoche: Number(r.precio_base_noche || 100).toFixed(2),
            moneda: 'USD',
            portadaUrl: r.portada_url || null,
          };

          if (wantFotos) {
            const fRows = await this.dataSource.query(
              `SELECT foto_id AS "fotoId", url_imagen AS "urlImagen", orden, es_portada AS "esPortada"
               FROM alojamiento_fotos
               WHERE alojamiento_id = $1
               ORDER BY es_portada DESC, orden ASC;`,
              [r.alojamiento_id],
            );
            card.fotos = fRows;
          }

          if (wantHabitaciones) {
            const hRows = await this.dataSource.query(
              `SELECT
                 producto_id AS "productoId",
                 nombre_producto AS "nombreProducto",
                 capacidad_adultos AS "capacidadAdultos",
                 capacidad_ninos AS "capacidadNinos",
                 cantidad_cuartos_inventario AS "stockDisponible",
                 precio_base_noche
               FROM productos_habitacion
               WHERE alojamiento_id = $1 AND activo = TRUE;`,
              [r.alojamiento_id],
            );
            card.habitaciones = hRows.map((h: Record<string, any>) => ({
              productoId: h.productoId,
              item_id: `${r.alojamiento_id}:${h.productoId}`,
              nombreProducto: h.nombreProducto,
              capacidadAdultos: Number(h.capacidadAdultos || 2),
              capacidadNinos: Number(h.capacidadNinos || 0),
              stockDisponible: Number(h.stockDisponible || 0),
              precioBaseNoche: Number(h.precio_base_noche || 100).toFixed(2),
            }));
          }

          if (wantContratos) {
            const c5Rows = await this.dataSource.query(
              `SELECT
                 alojamiento_id AS "alojamientoId",
                 codigo_protocolo AS "canalCodigo",
                 codigo_politica AS "politicaCodigo",
                 comision_porcentaje AS "comisionPorcentaje",
                 reembolso_porcentaje AS "reembolsoPorcentaje"
               FROM vw_contratos_5fn_validos
               WHERE alojamiento_id = $1;`,
              [r.alojamiento_id],
            );
            card.contratos5FN = c5Rows;
          }

          return card;
        }),
      );

      if (/\balojamiento\s*\(/.test(queryStr) && !/\balojamientos\b/.test(queryStr)) {
        resultData.alojamiento = mapped[0] || null;
      } else {
        resultData.alojamientos = mapped;
      }
    }

    return {
      data: resultData,
    };
  }
}

