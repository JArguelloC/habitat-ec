import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrearCiudadDto } from './dto/crear-ciudad.dto.js';
import { CrearTipoAlojamientoDto } from './dto/crear-tipo-alojamiento.dto.js';
import { CrearFacilidadDto } from './dto/crear-facilidad.dto.js';
import { CrearReglaDto } from './dto/crear-regla.dto.js';
import { CrearCadenaDto } from './dto/crear-cadena.dto.js';
import { CrearMarcaDto } from './dto/crear-marca.dto.js';
import { CrearCanalPoliticaDto } from './dto/crear-canal-politica.dto.js';

@Injectable()
export class CatalogosService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) { }

  async onModuleInit() {
    await this.asegurarProvinciasEcuador();
    await this.depurarReglasRedundantes();
  }

  async getGeografia() {
    await this.asegurarProvinciasEcuador();
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
        COALESCE(r.nombre, 'Ecuador') AS region,
        COALESCE(pa.nombre, 'Ecuador') AS pais
      FROM ciudades c
      JOIN provincias p ON c.provincia_id = p.provincia_id
      LEFT JOIN regiones r ON p.region_id = r.region_id
      LEFT JOIN paises pa ON r.pais_iso = pa.pais_iso
      ORDER BY c.nombre ASC;
    `);
  }

  async getProvincias() {
    await this.asegurarProvinciasEcuador();
    return this.dataSource.query(`
      SELECT 
        p.provincia_id AS "provinciaId", 
        p.nombre, 
        p.codigo_estado AS "codigoEstado", 
        COALESCE(r.nombre, 'Ecuador') AS region
      FROM provincias p
      LEFT JOIN regiones r ON p.region_id = r.region_id
      ORDER BY p.nombre ASC;
    `);
  }

  private async asegurarProvinciasEcuador(): Promise<void> {
    try {
      const check = await this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM provincias;`,
      );
      if (check && check[0] && check[0].total >= 24) {
        return;
      }

      await this.dataSource.query(`
        -- 1. Asegurar país Ecuador (código 'ec' en minúsculas por restricción paises_pais_iso_check)
        INSERT INTO paises (pais_iso, nombre)
        VALUES ('ec', 'Ecuador')
        ON CONFLICT (pais_iso) DO NOTHING;

        -- 2. Asegurar 4 regiones geográficas con 'ec'
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'costa') THEN
            INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Costa');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'sierra') THEN
            INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Sierra');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('oriente', 'amazonía', 'amazonia')) THEN
            INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Oriente');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('galápagos', 'galapagos', 'insular')) THEN
            INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Galápagos');
          END IF;
        END $$;

        -- 3. Sembrar las 24 provincias con códigos char(2) en minúsculas
        DO $$
        DECLARE
          v_costa_id INT;
          v_sierra_id INT;
          v_oriente_id INT;
          v_galapagos_id INT;
          v_fallback_id INT;
        BEGIN
          SELECT region_id INTO v_costa_id FROM regiones WHERE LOWER(nombre) = 'costa' LIMIT 1;
          SELECT region_id INTO v_sierra_id FROM regiones WHERE LOWER(nombre) = 'sierra' LIMIT 1;
          SELECT region_id INTO v_oriente_id FROM regiones WHERE LOWER(nombre) IN ('oriente', 'amazonía', 'amazonia') LIMIT 1;
          SELECT region_id INTO v_galapagos_id FROM regiones WHERE LOWER(nombre) IN ('galápagos', 'galapagos', 'insular') LIMIT 1;
          SELECT region_id INTO v_fallback_id FROM regiones LIMIT 1;

          v_costa_id := COALESCE(v_costa_id, v_fallback_id, 1);
          v_sierra_id := COALESCE(v_sierra_id, v_fallback_id, 1);
          v_oriente_id := COALESCE(v_oriente_id, v_fallback_id, 1);
          v_galapagos_id := COALESCE(v_galapagos_id, v_fallback_id, 1);

          -- Costa (6 provincias)
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'esmeraldas') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'es', 'Esmeraldas');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('manabí', 'manabi')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'ma', 'Manabí');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('los ríos', 'los rios')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'lr', 'Los Ríos');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'guayas') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'gy', 'Guayas');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'santa elena') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'se', 'Santa Elena');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'el oro') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa_id, 'eo', 'El Oro');
          END IF;

          -- Sierra (11 provincias)
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'carchi') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'cr', 'Carchi');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'imbabura') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'im', 'Imbabura');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pichincha') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'pi', 'Pichincha');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%santo domingo%') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'sd', 'Santo Domingo de los Tsáchilas');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'cotopaxi') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'co', 'Cotopaxi');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'tungurahua') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'tu', 'Tungurahua');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('bolívar', 'bolivar')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'bo', 'Bolívar');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'chimborazo') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'ch', 'Chimborazo');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('cañar', 'canar')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'cn', 'Cañar');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'azuay') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'az', 'Azuay');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'loja') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra_id, 'lo', 'Loja');
          END IF;

          -- Oriente / Amazonía (6 provincias)
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('sucumbíos', 'sucumbios')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'su', 'Sucumbíos');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'orellana') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'or', 'Orellana');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'napo') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'na', 'Napo');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pastaza') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'pa', 'Pastaza');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%morona%') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'ms', 'Morona Santiago');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%zamora%') THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente_id, 'za', 'Zamora Chinchipe');
          END IF;

          -- Galápagos / Insular (1 provincia)
          IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('galápagos', 'galapagos', 'insular')) THEN
            INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_galapagos_id, 'ga', 'Galápagos');
          END IF;
        END $$;
      `);
    } catch (err) {
      console.error('Error asegurando catálogo de provincias de Ecuador:', err);
    }
  }

  private async depurarReglasRedundantes(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        DECLARE
          v_silencio_canonico INT;
          v_silencio_duplicado INT;
          v_plastico_canonico INT;
          v_plastico_duplicado INT;
        BEGIN
          -- 1. Unificar reglas de silencio (conservar silencio estricto en bioma/fauna)
          SELECT regla_id INTO v_silencio_canonico 
          FROM reglas_convivencia 
          WHERE LOWER(descripcion) LIKE '%silencio estricto%' OR codigo = 'SILENCIO_BIOMA'
          ORDER BY regla_id ASC LIMIT 1;

          SELECT regla_id INTO v_silencio_duplicado 
          FROM reglas_convivencia 
          WHERE (LOWER(descripcion) LIKE '%horas de silencio%' OR LOWER(descripcion) LIKE '%22:00 a 07:00%')
            AND regla_id <> COALESCE(v_silencio_canonico, 0)
          ORDER BY regla_id ASC LIMIT 1;

          IF v_silencio_canonico IS NOT NULL AND v_silencio_duplicado IS NOT NULL THEN
            UPDATE alojamiento_reglas 
            SET regla_id = v_silencio_canonico 
            WHERE regla_id = v_silencio_duplicado 
              AND alojamiento_id NOT IN (
                SELECT alojamiento_id FROM alojamiento_reglas WHERE regla_id = v_silencio_canonico
              );
            DELETE FROM alojamiento_reglas WHERE regla_id = v_silencio_duplicado;
            DELETE FROM reglas_convivencia WHERE regla_id = v_silencio_duplicado;
          END IF;

          -- 2. Unificar reglas de plásticos de un solo uso
          SELECT regla_id INTO v_plastico_canonico 
          FROM reglas_convivencia 
          WHERE LOWER(descripcion) LIKE '%envases plásticos desechables%' OR codigo = 'NO_PLASTICOS_RESERVA'
          ORDER BY regla_id ASC LIMIT 1;

          SELECT regla_id INTO v_plastico_duplicado 
          FROM reglas_convivencia 
          WHERE LOWER(descripcion) LIKE '%plásticos de un solo uso%' 
            AND regla_id <> COALESCE(v_plastico_canonico, 0)
          ORDER BY regla_id ASC LIMIT 1;

          IF v_plastico_canonico IS NOT NULL AND v_plastico_duplicado IS NOT NULL THEN
            UPDATE alojamiento_reglas 
            SET regla_id = v_plastico_canonico 
            WHERE regla_id = v_plastico_duplicado 
              AND alojamiento_id NOT IN (
                SELECT alojamiento_id FROM alojamiento_reglas WHERE regla_id = v_plastico_canonico
              );
            DELETE FROM alojamiento_reglas WHERE regla_id = v_plastico_duplicado;
            DELETE FROM reglas_convivencia WHERE regla_id = v_plastico_duplicado;
          END IF;

          -- Consolidar texto claro y profesional en la regla de plásticos
          IF v_plastico_canonico IS NOT NULL THEN
            UPDATE reglas_convivencia 
            SET descripcion = 'Prohibido el ingreso de envases plásticos desechables y plásticos de un solo uso en todas las instalaciones y senderos.'
            WHERE regla_id = v_plastico_canonico;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.error('Error depurando reglas redundantes:', err);
    }
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

  // Métodos de Creación y Mantenimiento (SUPERADMIN)
  async crearCiudad(dto: CrearCiudadDto) {
    const result = await this.dataSource.query(
      `INSERT INTO ciudades (provincia_id, nombre, latitud, longitud)
       VALUES ($1, $2, $3, $4)
       RETURNING ciudad_id, provincia_id, nombre, latitud, longitud;`,
      [dto.provinciaId, dto.nombre.trim(), dto.latitud, dto.longitud],
    );
    return result[0];
  }

  async eliminarCiudad(id: number) {
    await this.dataSource.query(`DELETE FROM ciudades WHERE ciudad_id = $1;`, [id]);
    return { mensaje: 'Ciudad eliminada exitosamente', ciudadId: id };
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
    const existing = await this.dataSource.query(
      `SELECT canal_id, politica_id FROM canal_politicas WHERE canal_id = $1 AND politica_id = $2;`,
      [dto.canalId, dto.politicaId],
    );

    if (existing && existing.length > 0) {
      return {
        canal_id: existing[0].canal_id,
        politica_id: existing[0].politica_id,
        mensaje: 'La proyección 5FN (Canal × Política) ya se encontraba habilitada.',
        yaExistia: true,
      };
    }

    const result = await this.dataSource.query(
      `INSERT INTO canal_politicas (canal_id, politica_id)
       VALUES ($1, $2)
       ON CONFLICT (canal_id, politica_id) DO NOTHING
       RETURNING canal_id, politica_id;`,
      [dto.canalId, dto.politicaId],
    );

    return {
      ...(result[0] || { canal_id: dto.canalId, politica_id: dto.politicaId }),
      mensaje: 'Relación 5FN habilitada exitosamente.',
      yaExistia: false,
    };
  }

  async eliminarTipoAlojamiento(id: number) {
    const uso = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM alojamientos WHERE tipo_id = $1;`,
      [id],
    );
    if (uso && uso[0] && uso[0].total > 0) {
      throw new BadRequestException(
        `No se puede eliminar el tipo de alojamiento porque está asociado a ${uso[0].total} alojamiento(s) existente(s).`,
      );
    }
    await this.dataSource.query(
      `DELETE FROM tipos_alojamiento WHERE tipo_id = $1;`,
      [id],
    );
    return { mensaje: 'Tipo de alojamiento eliminado exitosamente', tipoId: id };
  }

  async eliminarFacilidad(id: number) {
    await this.dataSource.query(
      `DELETE FROM alojamiento_facilidades WHERE facilidad_id = $1;`,
      [id],
    );
    await this.dataSource.query(
      `DELETE FROM facilidades WHERE facilidad_id = $1;`,
      [id],
    );
    return { mensaje: 'Facilidad eliminada exitosamente', facilidadId: id };
  }

  async eliminarRegla(id: number) {
    await this.dataSource.query(
      `DELETE FROM alojamiento_reglas WHERE regla_id = $1;`,
      [id],
    );
    await this.dataSource.query(
      `DELETE FROM reglas_convivencia WHERE regla_id = $1;`,
      [id],
    );
    return { mensaje: 'Regla de convivencia eliminada exitosamente', reglaId: id };
  }

  async eliminarCadena(id: number) {
    await this.dataSource.query(
      `UPDATE alojamientos SET cadena_id = NULL WHERE cadena_id = $1;`,
      [id],
    );
    await this.dataSource.query(
      `DELETE FROM marcas_hoteleras WHERE cadena_id = $1;`,
      [id],
    );
    await this.dataSource.query(
      `DELETE FROM cadenas_hoteleras WHERE cadena_id = $1;`,
      [id],
    );
    return { mensaje: 'Cadena hotelera eliminada exitosamente', cadenaId: id };
  }
}
