import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrearCiudadDto } from './dto/crear-ciudad.dto.js';
import { CrearTipoAlojamientoDto } from './dto/crear-tipo-alojamiento.dto.js';
import { CrearFacilidadDto } from './dto/crear-facilidad.dto.js';
import { CrearReglaDto } from './dto/crear-regla.dto.js';
import { CrearCadenaDto } from './dto/crear-cadena.dto.js';
import { CrearMarcaDto } from './dto/crear-marca.dto.js';
import { CrearCanalPoliticaDto } from './dto/crear-canal-politica.dto.js';

@Injectable()
export class CatalogosService {
  constructor(private readonly dataSource: DataSource) {}

  async getGeografia() {
    const query = `
      SELECT 
        pa.pais_iso,
        pa.nombre AS pais,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'regionId', r.region_id,
              'nombre', r.nombre,
              'provincias', (
                SELECT COALESCE(
                  json_agg(
                    json_build_object(
                      'provinciaId', p.provincia_id,
                      'codigoEstado', p.codigo_estado,
                      'nombre', p.nombre,
                      'ciudades', (
                        SELECT COALESCE(
                          json_agg(
                            json_build_object(
                              'ciudadId', c.ciudad_id,
                              'nombre', c.nombre,
                              'latitud', c.latitud,
                              'longitud', c.longitud
                            )
                          ), '[]'::json
                        )
                        FROM ciudades c
                        WHERE c.provincia_id = p.provincia_id
                      )
                    )
                  ), '[]'::json
                )
                FROM provincias p
                WHERE p.region_id = r.region_id
              )
            )
          ) FILTER (WHERE r.region_id IS NOT NULL),
          '[]'::json
        ) AS regiones
      FROM paises pa
      LEFT JOIN regiones r ON pa.pais_iso = r.pais_iso
      GROUP BY pa.pais_iso, pa.nombre;
    `;
    return this.dataSource.query(query);
  }

  async getCiudades() {
    return this.dataSource.query(`
      SELECT 
        c.ciudad_id,
        c.nombre,
        c.latitud,
        c.longitud,
        p.provincia_id,
        p.nombre AS provincia,
        r.nombre AS region,
        pa.nombre AS pais
      FROM ciudades c
      JOIN provincias p ON c.provincia_id = p.provincia_id
      JOIN regiones r ON p.region_id = r.region_id
      JOIN paises pa ON r.pais_iso = pa.pais_iso
      ORDER BY c.nombre ASC;
    `);
  }

  async getTiposAlojamiento() {
    return this.dataSource.query(
      `SELECT tipo_id, codigo, nombre FROM tipos_alojamiento ORDER BY tipo_id ASC;`,
    );
  }

  async getFacilidades() {
    return this.dataSource.query(
      `SELECT facilidad_id, codigo, nombre, es_sostenible FROM facilidades ORDER BY facilidad_id ASC;`,
    );
  }

  async getReglasConvivencia() {
    return this.dataSource.query(
      `SELECT regla_id, codigo, descripcion FROM reglas_convivencia ORDER BY regla_id ASC;`,
    );
  }

  async getPlanesAlimenticios() {
    return this.dataSource.query(
      `SELECT plan_id, codigo_meal_plan, nombre FROM planes_alimenticios ORDER BY plan_id ASC;`,
    );
  }

  async getCadenasYMarcas() {
    const query = `
      SELECT 
        ch.cadena_id,
        ch.nombre,
        ch.activo,
        COALESCE(
          json_agg(
            json_build_object('marcaId', mh.marca_id, 'nombre', mh.nombre)
          ) FILTER (WHERE mh.marca_id IS NOT NULL),
          '[]'::json
        ) AS marcas
      FROM cadenas_hoteleras ch
      LEFT JOIN marcas_hoteleras mh ON ch.cadena_id = mh.cadena_id
      GROUP BY ch.cadena_id
      ORDER BY ch.nombre ASC;
    `;
    return this.dataSource.query(query);
  }

  async getMatriz5FN() {
    const [contratosValidos, canales, politicas, canalPoliticas] =
      await Promise.all([
        this.dataSource.query(
          `SELECT * FROM vw_contratos_5fn_validos ORDER BY alojamiento_id, canal_id, politica_id;`,
        ),
        this.dataSource.query(
          `SELECT * FROM canales_integracion ORDER BY canal_id ASC;`,
        ),
        this.dataSource.query(
          `SELECT * FROM politicas_cancelacion ORDER BY politica_id ASC;`,
        ),
        this.dataSource.query(
          `SELECT * FROM canal_politicas ORDER BY canal_id, politica_id;`,
        ),
      ]);

    return {
      canalesIntegracion: canales,
      politicasCancelacion: politicas,
      proyeccionCanalPoliticas: canalPoliticas,
      vistaLosslessJoinContratosValidos: contratosValidos,
    };
  }

  // Métodos de Creación (SUPERADMIN)
  async crearCiudad(dto: CrearCiudadDto) {
    const result = await this.dataSource.query(
      `INSERT INTO ciudades (provincia_id, nombre, latitud, longitud)
       VALUES ($1, $2, $3, $4)
       RETURNING ciudad_id, provincia_id, nombre, latitud, longitud;`,
      [dto.provinciaId, dto.nombre, dto.latitud, dto.longitud],
    );
    return result[0];
  }

  async crearTipoAlojamiento(dto: CrearTipoAlojamientoDto) {
    const result = await this.dataSource.query(
      `INSERT INTO tipos_alojamiento (codigo, nombre)
       VALUES ($1, $2)
       RETURNING tipo_id, codigo, nombre;`,
      [dto.codigo.toUpperCase().trim(), dto.nombre.trim()],
    );
    return result[0];
  }

  async crearFacilidad(dto: CrearFacilidadDto) {
    const result = await this.dataSource.query(
      `INSERT INTO facilidades (codigo, nombre, es_sostenible)
       VALUES ($1, $2, $3)
       RETURNING facilidad_id, codigo, nombre, es_sostenible;`,
      [
        dto.codigo.toUpperCase().trim(),
        dto.nombre.trim(),
        dto.esSostenible ?? true,
      ],
    );
    return result[0];
  }

  async crearRegla(dto: CrearReglaDto) {
    const result = await this.dataSource.query(
      `INSERT INTO reglas_convivencia (codigo, descripcion)
       VALUES ($1, $2)
       RETURNING regla_id, codigo, descripcion;`,
      [dto.codigo.toUpperCase().trim(), dto.descripcion.trim()],
    );
    return result[0];
  }

  async crearCadena(dto: CrearCadenaDto) {
    const result = await this.dataSource.query(
      `INSERT INTO cadenas_hoteleras (nombre)
       VALUES ($1)
       RETURNING cadena_id, nombre, activo, actualizado_en;`,
      [dto.nombre.trim()],
    );
    return result[0];
  }

  async crearMarca(dto: CrearMarcaDto) {
    const result = await this.dataSource.query(
      `INSERT INTO marcas_hoteleras (cadena_id, nombre)
       VALUES ($1, $2)
       RETURNING marca_id, cadena_id, nombre;`,
      [dto.cadenaId, dto.nombre.trim()],
    );
    return result[0];
  }

  async crearCanalPolitica(dto: CrearCanalPoliticaDto) {
    const result = await this.dataSource.query(
      `INSERT INTO canal_politicas (canal_id, politica_id)
       VALUES ($1, $2)
       RETURNING canal_id, politica_id;`,
      [dto.canalId, dto.politicaId],
    );
    return result[0];
  }
}

