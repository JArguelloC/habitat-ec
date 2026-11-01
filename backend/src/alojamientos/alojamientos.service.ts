import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrearAlojamientoDto } from './dto/crear-alojamiento.dto.js';
import { SearchAlojamientosDto } from './dto/search-alojamientos.dto.js';
import { CrearFotoDto } from './dto/crear-foto.dto.js';
import { AsignarFacilidadesDto } from './dto/asignar-facilidades.dto.js';
import { AsignarReglasDto } from './dto/asignar-reglas.dto.js';
import { CrearProductoHabitacionDto } from './dto/crear-producto-habitacion.dto.js';
import { Contratos5FNDto } from './dto/contratos-5fn.dto.js';

@Injectable()
export class AlojamientosService {
  constructor(private readonly dataSource: DataSource) {}

  async crearAlojamiento(propietarioId: string, dto: CrearAlojamientoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar que la ciudad exista
      const ciudad = await queryRunner.query(
        `SELECT ciudad_id, latitud, longitud FROM ciudades WHERE ciudad_id = $1`,
        [dto.ciudadId],
      );
      if (ciudad.length === 0) {
        throw new NotFoundException(
          `La ciudad con ID ${dto.ciudadId} no existe en el catálogo.`,
        );
      }

      // 2. Validar que el tipo de alojamiento exista
      const tipo = await queryRunner.query(
        `SELECT tipo_id FROM tipos_alojamiento WHERE tipo_id = $1`,
        [dto.tipoId],
      );
      if (tipo.length === 0) {
        throw new NotFoundException(
          `El tipo de alojamiento con ID ${dto.tipoId} no existe.`,
        );
      }

      const { latitud, longitud } = ciudad[0];

      // 3. Insertar el alojamiento maestro
      const insertAlojamiento = await queryRunner.query(
        `INSERT INTO alojamientos (
            propietario_id, ciudad_id, tipo_id, titulo, descripcion, direccion,
            latitud, longitud, estado_operativo, moneda_base
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLICADO', 'USD')
         RETURNING alojamiento_id, titulo, direccion, estado_operativo, creado_en`,
        [
          propietarioId,
          dto.ciudadId,
          dto.tipoId,
          dto.titulo.trim(),
          dto.descripcion.trim(),
          dto.direccion.trim(),
          latitud,
          longitud,
        ],
      );

      const nuevoAlojamiento = insertAlojamiento[0];
      const alojamientoId = nuevoAlojamiento.alojamiento_id;

      // 4. Crear el producto habitación por defecto (para disponibilidad y reservas)
      const productoId = `PROD-${alojamientoId}-01`;
      const planAlimenticio = await queryRunner.query(
        `SELECT plan_id FROM planes_alimenticios WHERE codigo_meal_plan = 'ROOM_ONLY' LIMIT 1`,
      );
      const planId = planAlimenticio[0]?.plan_id || 1;

      await queryRunner.query(
        `INSERT INTO productos_habitacion (
            producto_id, alojamiento_id, plan_id, nombre_producto,
            capacidad_adultos, cantidad_cuartos_inventario, precio_base_noche
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          productoId,
          alojamientoId,
          planId,
          'Habitación Principal Estándar',
          dto.maxAdultos,
          dto.habitaciones || 1,
          dto.precioBaseNoche,
        ],
      );

      // 5. Vincular proyecciones 5FN por defecto (WEB_REST y FREE_CANCELLATION)
      await queryRunner.query(
        `INSERT INTO alojamiento_canales (alojamiento_id, canal_id, habilitado)
         SELECT $1, canal_id, TRUE FROM canales_integracion WHERE codigo_protocolo = 'WEB_REST'`,
        [alojamientoId],
      );

      await queryRunner.query(
        `INSERT INTO alojamiento_politicas (alojamiento_id, politica_id)
         SELECT $1, politica_id FROM politicas_cancelacion WHERE codigo_politica = 'FREE_CANCELLATION'`,
        [alojamientoId],
      );

      await queryRunner.commitTransaction();

      return {
        mensaje: 'Alojamiento registrado exitosamente.',
        alojamiento: {
          alojamientoId: Number(nuevoAlojamiento.alojamiento_id),
          titulo: nuevoAlojamiento.titulo,
          direccion: nuevoAlojamiento.direccion,
          estado: nuevoAlojamiento.estado_operativo,
          productoId,
          precioBaseNoche: dto.precioBaseNoche,
          creadoEn: nuevoAlojamiento.creado_en,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }

      const mensajeError =
        error instanceof Error ? error.message : 'Error desconocido';

      throw new InternalServerErrorException(
        `Error al registrar el alojamiento: ${mensajeError}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async listarPorAnfitrion(propietarioId: string) {
    return this.dataSource.query(
      `SELECT 
          a.alojamiento_id AS "alojamientoId",
          a.titulo,
          a.direccion,
          a.estado_operativo AS "estadoOperativo",
          a.calificacion_promedio AS "calificacionPromedio",
          a.total_resenas AS "totalResenas",
          c.nombre AS ciudad,
          t.nombre AS tipo,
          ph.producto_id AS "productoId",
          ph.precio_base_noche AS "precioBaseNoche"
       FROM alojamientos a
       JOIN ciudades c ON a.ciudad_id = c.ciudad_id
       JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
       LEFT JOIN productos_habitacion ph ON a.alojamiento_id = ph.alojamiento_id
       WHERE a.propietario_id = $1
       ORDER BY a.creado_en DESC`,
      [propietarioId],
    );
  }

  async agregarFoto(alojamientoId: number, dto: CrearFotoDto) {
    const orden = dto.orden || 1;
    const esPortada = dto.esPortada ?? false;

    // Si es portada, desmarcar otras portadas previas
    if (esPortada) {
      await this.dataSource.query(
        `UPDATE alojamiento_fotos SET es_portada = FALSE WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );
    }

    const result = await this.dataSource.query(
      `INSERT INTO alojamiento_fotos (alojamiento_id, url_imagen, orden, es_portada)
       VALUES ($1, $2, $3, $4)
       RETURNING foto_id, alojamiento_id, url_imagen, orden, es_portada;`,
      [alojamientoId, dto.urlImagen, orden, esPortada],
    );

    return result[0];
  }

  async asignarFacilidades(alojamientoId: number, dto: AsignarFacilidadesDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Limpiar asignaciones previas para idempotencia 4FN
      await queryRunner.query(
        `DELETE FROM alojamiento_facilidades WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );

      for (const facilidadId of dto.facilidadIds) {
        await queryRunner.query(
          `INSERT INTO alojamiento_facilidades (alojamiento_id, facilidad_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [alojamientoId, facilidadId],
        );
      }

      await queryRunner.commitTransaction();
      return {
        mensaje: 'Facilidades asignadas exitosamente al alojamiento.',
        alojamientoId,
        facilidadIds: dto.facilidadIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async asignarReglas(alojamientoId: number, dto: AsignarReglasDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Limpiar asignaciones previas para idempotencia 4FN
      await queryRunner.query(
        `DELETE FROM alojamiento_reglas WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );

      for (const reglaId of dto.reglaIds) {
        await queryRunner.query(
          `INSERT INTO alojamiento_reglas (alojamiento_id, regla_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [alojamientoId, reglaId],
        );
      }

      await queryRunner.commitTransaction();
      return {
        mensaje: 'Reglas de convivencia asignadas exitosamente al alojamiento.',
        alojamientoId,
        reglaIds: dto.reglaIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async agregarProductoHabitacion(
    alojamientoId: number,
    dto: CrearProductoHabitacionDto,
  ) {
    const result = await this.dataSource.query(
      `INSERT INTO productos_habitacion (
          producto_id, alojamiento_id, plan_id, nombre_producto,
          capacidad_adultos, capacidad_ninos, cantidad_cuartos_inventario,
          precio_base_noche, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        dto.productoId,
        alojamientoId,
        dto.planId,
        dto.nombreProducto,
        dto.capacidadAdultos,
        dto.capacidadNinos ?? 0,
        dto.cantidadCuartosInventario ?? 1,
        dto.precioBaseNoche,
        dto.activo ?? true,
      ],
    );

    return result[0];
  }

  async configurarContratos5FN(alojamientoId: number, dto: Contratos5FNDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Proyección 5FN #1: Alojamiento <-> Canales
      await queryRunner.query(
        `DELETE FROM alojamiento_canales WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );
      for (const canalId of dto.canalIds) {
        await queryRunner.query(
          `INSERT INTO alojamiento_canales (alojamiento_id, canal_id, habilitado)
           VALUES ($1, $2, TRUE) ON CONFLICT (alojamiento_id, canal_id) DO UPDATE SET habilitado = TRUE;`,
          [alojamientoId, canalId],
        );
      }

      // 2. Proyección 5FN #2: Alojamiento <-> Políticas
      await queryRunner.query(
        `DELETE FROM alojamiento_politicas WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );
      for (const politicaId of dto.politicaIds) {
        await queryRunner.query(
          `INSERT INTO alojamiento_politicas (alojamiento_id, politica_id)
           VALUES ($1, $2) ON CONFLICT (alojamiento_id, politica_id) DO NOTHING;`,
          [alojamientoId, politicaId],
        );
      }

      await queryRunner.commitTransaction();

      // Consultar contratos resultantes desde la vista Lossless-Join 5FN
      const contratosValidos = await this.dataSource.query(
        `SELECT * FROM vw_contratos_5fn_validos WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );

      return {
        mensaje:
          'Contratos 5FN configurados y verificados con vista de lossless-join.',
        alojamientoId,
        contratosValidos,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async buscarAlojamientos(
    dto: SearchAlojamientosDto,
    fingerprintHash?: string,
  ) {
    // 1. Registrar actividad de fingerprint si fue provisto
    if (fingerprintHash) {
      await this.dataSource.query(
        `INSERT INTO dispositivos_fingerprint (fingerprint_hash, plataforma, ultima_actividad)
         VALUES ($1, 'desktop', NOW())
         ON CONFLICT (fingerprint_hash) DO UPDATE SET ultima_actividad = NOW();`,
        [fingerprintHash],
      );
    }

    // 2. Búsqueda de alojamientos públicos con capacidad y disponibilidad de stock en el rango
    const habitacionesRequeridas = dto.habitaciones || 1;
    const query = `
      SELECT DISTINCT
        a.alojamiento_id AS "alojamientoId",
        a.titulo,
        c.nombre AS ciudad,
        MIN(ph.precio_base_noche) AS "precioBaseNoche",
        a.calificacion_promedio AS "calificacionPromedio",
        COALESCE(
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id AND es_portada = TRUE LIMIT 1),
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id ORDER BY orden ASC LIMIT 1),
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'
        ) AS "portadaUrl"
      FROM alojamientos a
      JOIN ciudades c ON a.ciudad_id = c.ciudad_id
      JOIN productos_habitacion ph ON a.alojamiento_id = ph.alojamiento_id
      WHERE a.estado_operativo = 'PUBLICADO'
        AND a.ciudad_id = $1
        AND ph.activo = TRUE
        AND ph.capacidad_adultos >= $2
        AND ph.cantidad_cuartos_inventario >= $5
        AND NOT EXISTS (
          SELECT 1 
          FROM calendario_inventario ci
          WHERE ci.producto_id = ph.producto_id
            AND ci.fecha >= $3::DATE AND ci.fecha < $4::DATE
            AND (ci.cuartos_disponibles < $5 OR ci.estado_dia = 'BLOQUEADO_ANFITRION')
        )
      GROUP BY a.alojamiento_id, a.titulo, c.nombre, a.calificacion_promedio
      ORDER BY a.calificacion_promedio DESC, "precioBaseNoche" ASC;
    `;

    const resultados = await this.dataSource.query(query, [
      dto.ciudadId,
      dto.adultos,
      dto.checkin,
      dto.checkout,
      habitacionesRequeridas,
    ]);

    return resultados.map((r: any) => ({
      alojamientoId: Number(r.alojamientoId),
      titulo: r.titulo,
      ciudad: r.ciudad,
      precioBaseNoche: Number(r.precioBaseNoche),
      calificacionPromedio: Number(r.calificacionPromedio),
      portadaUrl: r.portadaUrl,
    }));
  }

  async obtenerDetalleCompleto(alojamientoId: number) {
    const baseQuery = `
      SELECT 
        a.alojamiento_id,
        a.titulo,
        a.descripcion,
        a.direccion,
        a.latitud,
        a.longitud,
        a.moneda_base,
        a.estado_operativo,
        a.calificacion_promedio,
        a.total_resenas,
        a.creado_en,
        c.nombre AS ciudad,
        p.nombre AS provincia,
        r.nombre AS region,
        pa.nombre AS pais,
        t.nombre AS tipo_alojamiento,
        mh.nombre AS marca_hotelera,
        ch.nombre AS cadena_hotelera,
        u.nombre || ' ' || u.apellido AS anfitrion_nombre,
        u.correo AS anfitrion_correo
      FROM alojamientos a
      JOIN ciudades c ON a.ciudad_id = c.ciudad_id
      JOIN provincias p ON c.provincia_id = p.provincia_id
      JOIN regiones r ON p.region_id = r.region_id
      JOIN paises pa ON r.pais_iso = pa.pais_iso
      JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
      JOIN usuarios u ON a.propietario_id = u.usuario_id
      LEFT JOIN marcas_hoteleras mh ON a.marca_id = mh.marca_id
      LEFT JOIN cadenas_hoteleras ch ON mh.cadena_id = ch.cadena_id
      WHERE a.alojamiento_id = $1;
    `;

    const [alojamientoRows, fotos, facilidades, reglas, productos, contratos] =
      await Promise.all([
        this.dataSource.query(baseQuery, [alojamientoId]),
        this.dataSource.query(
          `SELECT foto_id, url_imagen, orden, es_portada FROM alojamiento_fotos WHERE alojamiento_id = $1 ORDER BY orden ASC;`,
          [alojamientoId],
        ),
        this.dataSource.query(
          `SELECT f.facilidad_id, f.codigo, f.nombre, f.es_sostenible 
           FROM alojamiento_facilidades af
           JOIN facilidades f ON af.facilidad_id = f.facilidad_id
           WHERE af.alojamiento_id = $1;`,
          [alojamientoId],
        ),
        this.dataSource.query(
          `SELECT rc.regla_id, rc.codigo, rc.descripcion
           FROM alojamiento_reglas ar
           JOIN reglas_convivencia rc ON ar.regla_id = rc.regla_id
           WHERE ar.alojamiento_id = $1;`,
          [alojamientoId],
        ),
        this.dataSource.query(
          `SELECT ph.producto_id AS "productoId",
                  ph.nombre_producto AS "nombreProducto",
                  ph.capacidad_adultos AS "capacidadAdultos",
                  ph.capacidad_ninos AS "capacidadNinos",
                  ph.cantidad_cuartos_inventario AS "cantidadCuartosInventario",
                  ph.precio_base_noche AS "precioBaseNoche",
                  ph.activo,
                  pa.codigo_meal_plan AS "codigoMealPlan",
                  pa.nombre AS "mealPlanNombre"
           FROM productos_habitacion ph
           JOIN planes_alimenticios pa ON ph.plan_id = pa.plan_id
           WHERE ph.alojamiento_id = $1 AND ph.activo = TRUE;`,
          [alojamientoId],
        ),
        this.dataSource.query(
          `SELECT canal_id, codigo_protocolo, politica_id, codigo_politica, porcentaje_reembolso, horas_anticipacion
           FROM vw_contratos_5fn_validos
           WHERE alojamiento_id = $1;`,
          [alojamientoId],
        ),
      ]);

    if (alojamientoRows.length === 0) {
      throw new NotFoundException(
        `El alojamiento con ID ${alojamientoId} no fue encontrado.`,
      );
    }

    return {
      alojamiento: alojamientoRows[0],
      fotos,
      facilidades,
      reglas,
      productosHabitacion: productos,
      contratosValidos5FN: contratos,
    };
  }
}
