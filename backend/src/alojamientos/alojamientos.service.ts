import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Alojamiento } from './entities/alojamiento.entity.js';
import { CrearAlojamientoDto } from './dto/crear-alojamiento.dto.js';
import { ActualizarAlojamientoDto } from './dto/actualizar-alojamiento.dto.js';
import { BajaAlojamientoDto } from './dto/baja-alojamiento.dto.js';
import { SearchAlojamientosDto } from './dto/search-alojamientos.dto.js';
import { CrearFotoDto } from './dto/crear-foto.dto.js';
import { AsignarFacilidadesDto } from './dto/asignar-facilidades.dto.js';
import { AsignarReglasDto } from './dto/asignar-reglas.dto.js';
import { CrearProductoHabitacionDto } from './dto/crear-producto-habitacion.dto.js';
import { Contratos5FNDto } from './dto/contratos-5fn.dto.js';
import { EstadoOperativoEnum } from './enums/estado-operativo.enum.js';

export function normalizarHora(
  horaRaw?: string | null,
  fallback: string = '14:00',
): string {
  if (!horaRaw || typeof horaRaw !== 'string') return fallback;
  const raw = horaRaw.trim();
  if (!raw) return fallback;

  // Formato 12 horas con AM/PM (ej. "02:00 PM", "2:30 pm", "11:00 AM", "12:00 AM")
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const meridian = ampmMatch[3].toUpperCase();

    if (meridian === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridian === 'AM' && hours === 12) {
      hours = 0;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Formato 24 horas (ej. "14:00", "14:00:00", "9:05")
  const militaryMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (militaryMatch) {
    const hours = parseInt(militaryMatch[1], 10);
    const minutes = militaryMatch[2];
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  }

  return fallback;
}

@Injectable()
export class AlojamientosService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Alojamiento)
    private readonly alojamientoRepo: Repository<Alojamiento>,
  ) {}

  async onModuleInit() {
    await this.asegurarConstraintEstadoOperativo();
  }

  private async asegurarConstraintEstadoOperativo() {
    try {
      await this.dataSource.query(`
        ALTER TABLE alojamientos DROP CONSTRAINT IF EXISTS alojamientos_estado_operativo_check;
        ALTER TABLE alojamientos ADD CONSTRAINT alojamientos_estado_operativo_check 
          CHECK (estado_operativo IN ('BORRADOR', 'PUBLICADO', 'SUSPENDIDO', 'PAUSADO', 'INACTIVO', 'BAJA'));
      `);
      await this.dataSource.query(`
        ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
        ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS motivo_baja TEXT NULL;
        ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS hora_checkin VARCHAR(5) NOT NULL DEFAULT '14:00';
        ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS hora_checkout VARCHAR(5) NOT NULL DEFAULT '11:00';
      `);
      await this.dataSource.query(`
        UPDATE alojamientos 
        SET activo = CASE 
          WHEN estado_operativo = 'PUBLICADO' THEN TRUE 
          ELSE FALSE 
        END
        WHERE activo IS NULL;
      `);
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditoria_forense') THEN
            ALTER TABLE auditoria_forense ALTER COLUMN operacion TYPE VARCHAR(20);
          END IF;
        END $$;
      `);
    } catch (err: unknown) {
      console.warn('Nota: Sincronización de constraint estado_operativo en DB:', err);
    }
  }

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
      const horaCheckin = normalizarHora(dto.horaCheckin, '14:00');
      const horaCheckout = normalizarHora(dto.horaCheckout, '11:00');

      // 3. Insertar el alojamiento maestro con horas de check-in / check-out
      const insertAlojamiento = await queryRunner.query(
        `INSERT INTO alojamientos (
            propietario_id, ciudad_id, tipo_id, titulo, descripcion, direccion,
            latitud, longitud, estado_operativo, moneda_base, hora_checkin, hora_checkout
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLICADO', 'USD', $9, $10)
         RETURNING alojamiento_id, titulo, direccion, estado_operativo, hora_checkin, hora_checkout, creado_en`,
        [
          propietarioId,
          dto.ciudadId,
          dto.tipoId,
          dto.titulo.trim(),
          dto.descripcion.trim(),
          dto.direccion.trim(),
          latitud,
          longitud,
          horaCheckin,
          horaCheckout,
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
          dto.maxAdultos || 2,
          dto.habitaciones || 1,
          dto.precioBaseNoche || 0,
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
          precioBaseNoche: dto.precioBaseNoche || 0,
          creadoEn: nuevoAlojamiento.creado_en,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      console.error('[AlojamientosService.crearAlojamiento] Error DB crítico:', {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        propietarioId,
        dtoRecibido: dto,
      });

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
          a.descripcion,
          a.direccion,
          a.ciudad_id AS "ciudadId",
          a.tipo_id AS "tipoId",
          a.latitud,
          a.longitud,
          a.marca_id AS "marcaId",
          a.estado_operativo AS "estadoOperativo",
          a.calificacion_promedio AS "calificacionPromedio",
          a.total_resenas AS "totalResenas",
          c.nombre AS ciudad,
          t.nombre AS tipo,
          MIN(ph.producto_id) AS "productoId",
          MIN(ph.precio_base_noche) AS "precioBaseNoche",
          COALESCE(SUM(ph.cantidad_cuartos_inventario), 1) AS "totalCuartos",
          COALESCE(
            (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id ORDER BY es_portada DESC, orden ASC LIMIT 1),
            'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'
          ) AS "portadaUrl"
       FROM alojamientos a
       JOIN ciudades c ON a.ciudad_id = c.ciudad_id
       JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
       LEFT JOIN productos_habitacion ph ON a.alojamiento_id = ph.alojamiento_id
       WHERE a.propietario_id = $1
       GROUP BY a.alojamiento_id, a.titulo, a.descripcion, a.direccion, a.ciudad_id, a.tipo_id, a.latitud, a.longitud, a.marca_id, a.estado_operativo, a.calificacion_promedio, a.total_resenas, c.nombre, t.nombre, a.creado_en
       ORDER BY a.creado_en DESC`,
      [propietarioId],
    );
  }

  async actualizarAlojamiento(
    alojamientoId: number,
    usuario: { usuarioId: string; roles: string[] },
    dto: ActualizarAlojamientoDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verificar existencia y pertenencia
      const alojamientosExistentes = await queryRunner.query(
        `SELECT alojamiento_id, propietario_id, ciudad_id, tipo_id, estado_operativo, titulo, activo
         FROM alojamientos WHERE alojamiento_id = $1`,
        [alojamientoId],
      );

      if (alojamientosExistentes.length === 0) {
        throw new NotFoundException(`El alojamiento con ID ${alojamientoId} no existe.`);
      }

      const actual = alojamientosExistentes[0];
      const isSuperAdmin = Array.isArray(usuario.roles) && usuario.roles.includes('SUPERADMIN');
      if (!isSuperAdmin && actual.propietario_id !== usuario.usuarioId) {
        throw new ForbiddenException('No tienes permiso para modificar este alojamiento.');
      }

      // 2. Resolver ciudad y coordenadas
      const targetCiudadId = dto.ciudadId ?? dto.ciudad_id;
      let nuevaLatitud = dto.latitud;
      let nuevaLongitud = dto.longitud;

      if (targetCiudadId !== undefined) {
        const ciudadRows = await queryRunner.query(
          `SELECT ciudad_id, latitud, longitud FROM ciudades WHERE ciudad_id = $1`,
          [targetCiudadId],
        );
        if (ciudadRows.length === 0) {
          throw new NotFoundException(`La ciudad con ID ${targetCiudadId} no existe.`);
        }
        if (nuevaLatitud === undefined) nuevaLatitud = ciudadRows[0].latitud;
        if (nuevaLongitud === undefined) nuevaLongitud = ciudadRows[0].longitud;
      }

      // 3. Resolver tipo de alojamiento
      const targetTipoId = dto.tipoId ?? dto.tipo_alojamiento_id;
      if (targetTipoId !== undefined) {
        const tipoRows = await queryRunner.query(
          `SELECT tipo_id FROM tipos_alojamiento WHERE tipo_id = $1`,
          [targetTipoId],
        );
        if (tipoRows.length === 0) {
          throw new NotFoundException(`El tipo de alojamiento con ID ${targetTipoId} no existe.`);
        }
      }

      // 4. Resolver estado operativo y bandera activo
      let nuevoEstado = dto.estadoOperativo ?? dto.estado_operativo;
      let nuevoActivo = dto.activo;

      if (dto.activo !== undefined && !nuevoEstado) {
        nuevoEstado = dto.activo ? EstadoOperativoEnum.PUBLICADO : EstadoOperativoEnum.PAUSADO;
      } else if (nuevoEstado) {
        nuevoActivo = nuevoEstado === EstadoOperativoEnum.PUBLICADO;
      }

      // 5. Resolver marca hotelera y horas de check-in / check-out normalizadas
      const targetMarcaId = dto.marcaId ?? dto.marca_id;
      const targetHoraCheckinRaw = dto.horaCheckin ?? dto.hora_checkin;
      const targetHoraCheckoutRaw = dto.horaCheckout ?? dto.hora_checkout;
      const targetHoraCheckin = targetHoraCheckinRaw
        ? normalizarHora(targetHoraCheckinRaw, '14:00')
        : null;
      const targetHoraCheckout = targetHoraCheckoutRaw
        ? normalizarHora(targetHoraCheckoutRaw, '11:00')
        : null;

      // 6. Ejecutar UPDATE transaccional
      await queryRunner.query(
        `UPDATE alojamientos
         SET titulo = COALESCE($1, titulo),
             descripcion = COALESCE($2, descripcion),
             direccion = COALESCE($3, direccion),
             ciudad_id = COALESCE($4, ciudad_id),
             tipo_id = COALESCE($5, tipo_id),
             latitud = COALESCE($6, latitud),
             longitud = COALESCE($7, longitud),
             marca_id = COALESCE($8, marca_id),
             estado_operativo = COALESCE($9, estado_operativo),
             activo = COALESCE($10, activo),
             hora_checkin = COALESCE($11, hora_checkin),
             hora_checkout = COALESCE($12, hora_checkout),
             deleted_at = CASE WHEN $9 = 'PUBLICADO' THEN NULL ELSE deleted_at END,
             actualizado_en = NOW()
         WHERE alojamiento_id = $13`,
        [
          dto.titulo?.trim(),
          dto.descripcion?.trim(),
          dto.direccion?.trim(),
          targetCiudadId,
          targetTipoId,
          nuevaLatitud,
          nuevaLongitud,
          targetMarcaId,
          nuevoEstado,
          nuevoActivo,
          targetHoraCheckin,
          targetHoraCheckout,
          alojamientoId,
        ],
      );

      // 7. Sincronizar tarifa base en producto habitación por defecto si aplica
      const targetPrecio = dto.tarifa_base ?? dto.precioBaseNoche;
      if (targetPrecio !== undefined && targetPrecio > 0) {
        await queryRunner.query(
          `UPDATE productos_habitacion
           SET precio_base_noche = $1
           WHERE alojamiento_id = $2 AND producto_id = 'PROD-' || $2::TEXT || '-01'`,
          [targetPrecio, alojamientoId],
        );
      }

      // 8. Sincronizar relaciones N:M (Facilidades ecológicas - 4FN)
      const targetFacilidades = dto.facilidades_ids ?? dto.facilidadIds;
      if (Array.isArray(targetFacilidades)) {
        await queryRunner.query(
          `DELETE FROM alojamiento_facilidades WHERE alojamiento_id = $1`,
          [alojamientoId],
        );
        for (const facId of targetFacilidades) {
          await queryRunner.query(
            `INSERT INTO alojamiento_facilidades (alojamiento_id, facilidad_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [alojamientoId, facId],
          );
        }
      }

      // 9. Sincronizar relaciones N:M (Reglas de convivencia - 4FN)
      const targetReglas = dto.reglas_ids ?? dto.reglaIds;
      if (Array.isArray(targetReglas)) {
        await queryRunner.query(
          `DELETE FROM alojamiento_reglas WHERE alojamiento_id = $1`,
          [alojamientoId],
        );
        for (const regId of targetReglas) {
          await queryRunner.query(
            `INSERT INTO alojamiento_reglas (alojamiento_id, regla_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [alojamientoId, regId],
          );
        }
      }

      // 10. Sincronizar contratos 5FN (Políticas de cancelación) si aplica
      const targetPoliticas =
        dto.politicas_ids ?? (dto.politica_id ? [dto.politica_id] : undefined);
      if (Array.isArray(targetPoliticas)) {
        await queryRunner.query(
          `DELETE FROM alojamiento_politicas WHERE alojamiento_id = $1`,
          [alojamientoId],
        );
        for (const polId of targetPoliticas) {
          await queryRunner.query(
            `INSERT INTO alojamiento_politicas (alojamiento_id, politica_id)
             VALUES ($1, $2) ON CONFLICT (alojamiento_id, politica_id) DO NOTHING`,
            [alojamientoId, polId],
          );
        }
      }

      // 11. Sincronizar disponibilidad en productos_habitacion
      if (
        nuevoEstado === EstadoOperativoEnum.INACTIVO ||
        nuevoEstado === EstadoOperativoEnum.BAJA ||
        nuevoEstado === EstadoOperativoEnum.SUSPENDIDO ||
        nuevoEstado === EstadoOperativoEnum.PAUSADO
      ) {
        await queryRunner.query(
          `UPDATE productos_habitacion SET activo = FALSE WHERE alojamiento_id = $1`,
          [alojamientoId],
        );
      } else if (nuevoEstado === EstadoOperativoEnum.PUBLICADO) {
        await queryRunner.query(
          `UPDATE productos_habitacion SET activo = TRUE WHERE alojamiento_id = $1`,
          [alojamientoId],
        );
      }

      await queryRunner.commitTransaction();
      return this.obtenerDetalleCompleto(alojamientoId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async eliminarAlojamiento(
    alojamientoId: number,
    usuario: { usuarioId: string; roles: string[] },
    dto?: BajaAlojamientoDto,
  ) {
    // 1. Verificar existencia y pertenencia
    const alojamientosExistentes = await this.dataSource.query(
      `SELECT alojamiento_id, propietario_id, estado_operativo, titulo, activo
       FROM alojamientos WHERE alojamiento_id = $1`,
      [alojamientoId],
    );

    if (alojamientosExistentes.length === 0) {
      throw new NotFoundException(`El alojamiento con ID ${alojamientoId} no existe.`);
    }

    const actual = alojamientosExistentes[0];
    const isSuperAdmin = Array.isArray(usuario.roles) && usuario.roles.includes('SUPERADMIN');
    if (!isSuperAdmin && actual.propietario_id !== usuario.usuarioId) {
      throw new ForbiddenException('No tienes permiso para dar de baja este alojamiento.');
    }

    // 2. Validar que no existan reservas activas o pendientes en estado confirmado para fechas futuras
    const reservasFuturas = await this.dataSource.query(
      `SELECT COUNT(*)::INT AS total
       FROM ordenes
       WHERE alojamiento_id = $1
         AND status IN ('CONFIRMED', 'PAID', 'PENDING')
         AND checkout >= CURRENT_DATE`,
      [alojamientoId],
    );

    const activasTotal = Number(reservasFuturas[0]?.total || 0);
    if (activasTotal > 0) {
      throw new BadRequestException(
        `No es posible dar de baja "${actual.titulo}" porque existen ${activasTotal} reserva(s) activa(s) o pendientes con fechas de checkout futuras. Debes gestionar o reubicar estas reservas antes de proceder a la baja.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const estadoDestino = dto?.estadoObjetivo || EstadoOperativoEnum.BAJA;
      const motivoBaja =
        dto?.motivo?.trim() || 'Baja solicitada por el anfitrión o superadmin de la plataforma';

      // 3. Aplicar Soft Delete en alojamientos
      await queryRunner.query(
        `UPDATE alojamientos
         SET activo = FALSE,
             estado_operativo = $1,
             deleted_at = NOW(),
             motivo_baja = $2,
             actualizado_en = NOW()
         WHERE alojamiento_id = $3`,
        [estadoDestino, motivoBaja, alojamientoId],
      );

      // 4. Desactivar inventario en productos_habitacion
      await queryRunner.query(
        `UPDATE productos_habitacion SET activo = FALSE WHERE alojamiento_id = $1`,
        [alojamientoId],
      );

      // 5. Registrar en auditoría forense
      try {
        await queryRunner.query(
          `INSERT INTO auditoria_forense (
              correlation_id, nombre_tabla, operacion, registro_id,
              estado_anterior, estado_nuevo, ejecutado_en
           ) VALUES (
              gen_random_uuid(), 'alojamientos', 'BAJA', $1,
              $2, $3, NOW()
           )`,
          [
            String(alojamientoId),
            JSON.stringify({
              estado_operativo: actual.estado_operativo,
              activo: actual.activo,
            }),
            JSON.stringify({
              estado_operativo: estadoDestino,
              activo: false,
              motivo_baja: motivoBaja,
              ejecutado_por: usuario.usuarioId,
            }),
          ],
        );
      } catch (auditErr: unknown) {
        console.warn('Nota: Inserción opcional en auditoria_forense omitida:', auditErr);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Alojamiento dado de baja exitosamente (Soft Delete). Se conserva el historial de reservas.',
        alojamientoId,
        estadoOperativo: estadoDestino,
        activo: false,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  async findAllPublicos() {
    const query = `
      SELECT DISTINCT
        a.alojamiento_id AS "alojamientoId",
        a.titulo,
        a.descripcion,
        a.direccion,
        a.tipo_id AS "tipoId",
        t.nombre AS "tipoNombre",
        t.codigo AS "tipoCodigo",
        a.ciudad_id AS "ciudadId",
        c.nombre AS ciudad,
        MIN(ph.precio_base_noche) AS "precioBaseNoche",
        MAX(ph.capacidad_adultos) AS "maxAdultos",
        SUM(ph.cantidad_cuartos_inventario) AS "totalCuartos",
        a.calificacion_promedio AS "calificacionPromedio",
        a.total_resenas AS "totalResenas",
        COALESCE(
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id AND es_portada = TRUE LIMIT 1),
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id ORDER BY orden ASC LIMIT 1),
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'
        ) AS "portadaUrl"
      FROM alojamientos a
      JOIN ciudades c ON a.ciudad_id = c.ciudad_id
      JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
      JOIN productos_habitacion ph ON a.alojamiento_id = ph.alojamiento_id
      WHERE a.activo = TRUE
        AND a.deleted_at IS NULL
        AND a.estado_operativo = 'PUBLICADO'
        AND a.estado_operativo NOT IN ('BAJA', 'INACTIVO', 'PAUSADO', 'BORRADOR')
        AND ph.activo = TRUE
      GROUP BY a.alojamiento_id, a.titulo, a.descripcion, a.direccion, a.tipo_id, t.nombre, t.codigo, a.ciudad_id, c.nombre, a.calificacion_promedio, a.total_resenas
      ORDER BY a.calificacion_promedio DESC, "precioBaseNoche" ASC;
    `;

    const rows = await this.dataSource.query(query);
    return rows.map((r: any) => ({
      alojamientoId: Number(r.alojamientoId),
      titulo: r.titulo,
      descripcion: r.descripcion,
      direccion: r.direccion,
      tipoId: Number(r.tipoId),
      tipoNombre: r.tipoNombre,
      tipoCodigo: r.tipoCodigo,
      ciudadId: Number(r.ciudadId),
      ciudad: r.ciudad,
      precioBaseNoche: Number(r.precioBaseNoche),
      maxAdultos: Number(r.maxAdultos || 2),
      totalCuartos: Number(r.totalCuartos || 1),
      calificacionPromedio: Number(r.calificacionPromedio),
      totalResenas: Number(r.totalResenas || 0),
      portadaUrl: r.portadaUrl,
    }));
  }

  async findAll() {
    return this.alojamientoRepo
      .createQueryBuilder('a')
      .where('a.activo = :activo', { activo: true })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('a.estado_operativo = :estado', { estado: EstadoOperativoEnum.PUBLICADO })
      .andWhere('a.estado_operativo NOT IN (:...excluidos)', {
        excluidos: ['BAJA', 'INACTIVO', 'PAUSADO', 'BORRADOR'],
      })
      .orderBy('a.calificacion_promedio', 'DESC')
      .getMany();
  }

  async buscarAlojamientos(
    dto: SearchAlojamientosDto,
    fingerprintHash?: string,
  ) {
    // 1. Registrar actividad de fingerprint de forma no bloqueante y eficiente (con throttling DB)
    if (fingerprintHash) {
      void this.dataSource
        .query(
          `INSERT INTO dispositivos_fingerprint (fingerprint_hash, plataforma, ultima_actividad)
           VALUES ($1, 'desktop', NOW())
           ON CONFLICT (fingerprint_hash)
           DO UPDATE SET ultima_actividad = NOW()
           WHERE dispositivos_fingerprint.ultima_actividad < NOW() - INTERVAL '5 minutes';`,
          [fingerprintHash],
        )
        .catch(() => {
          // Fallo no crítico de fingerprint no interrumpe la búsqueda del cliente
        });
    }

    // 2. Búsqueda de alojamientos públicos con capacidad y disponibilidad de stock en el rango
    const habitacionesRequeridas = dto.habitaciones || 1;
    const adultosRequeridos = dto.adultos || 1;
    const ciudadFiltro = dto.ciudadId ?? null;
    const tipoFiltro = dto.tipoId ?? null;
    const hoy = new Date();
    const manana = new Date(hoy.getTime() + 86400000).toISOString().slice(0, 10);
    const pasadoManana = new Date(hoy.getTime() + 172800000)
      .toISOString()
      .slice(0, 10);
    const checkinFiltro = dto.checkin || manana;
    const checkoutFiltro = dto.checkout || pasadoManana;

    const query = `
      SELECT DISTINCT
        a.alojamiento_id AS "alojamientoId",
        a.titulo,
        a.descripcion,
        a.direccion,
        a.tipo_id AS "tipoId",
        t.nombre AS "tipoNombre",
        t.codigo AS "tipoCodigo",
        a.ciudad_id AS "ciudadId",
        c.nombre AS ciudad,
        MIN(ph.precio_base_noche) AS "precioBaseNoche",
        MAX(ph.capacidad_adultos) AS "maxAdultos",
        SUM(ph.cantidad_cuartos_inventario) AS "totalCuartos",
        a.calificacion_promedio AS "calificacionPromedio",
        a.total_resenas AS "totalResenas",
        COALESCE(
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id AND es_portada = TRUE LIMIT 1),
          (SELECT url_imagen FROM alojamiento_fotos WHERE alojamiento_id = a.alojamiento_id ORDER BY orden ASC LIMIT 1),
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'
        ) AS "portadaUrl"
      FROM alojamientos a
      JOIN ciudades c ON a.ciudad_id = c.ciudad_id
      JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
      JOIN productos_habitacion ph ON a.alojamiento_id = ph.alojamiento_id
      WHERE a.activo = TRUE
        AND a.deleted_at IS NULL
        AND a.estado_operativo = 'PUBLICADO'
        AND a.estado_operativo NOT IN ('BAJA', 'INACTIVO', 'PAUSADO', 'BORRADOR')
        AND ($1::INT IS NULL OR a.ciudad_id = $1)
        AND ($6::INT IS NULL OR a.tipo_id = $6)
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
      GROUP BY a.alojamiento_id, a.titulo, a.descripcion, a.direccion, a.tipo_id, t.nombre, t.codigo, a.ciudad_id, c.nombre, a.calificacion_promedio, a.total_resenas
      ORDER BY a.calificacion_promedio DESC, "precioBaseNoche" ASC;
    `;

    const resultados = await this.dataSource.query(query, [
      ciudadFiltro,
      adultosRequeridos,
      checkinFiltro,
      checkoutFiltro,
      habitacionesRequeridas,
      tipoFiltro,
    ]);

    return resultados.map((r: any) => ({
      alojamientoId: Number(r.alojamientoId),
      titulo: r.titulo,
      descripcion: r.descripcion,
      direccion: r.direccion,
      tipoId: Number(r.tipoId),
      tipoNombre: r.tipoNombre,
      tipoCodigo: r.tipoCodigo,
      ciudadId: Number(r.ciudadId),
      ciudad: r.ciudad,
      precioBaseNoche: Number(r.precioBaseNoche),
      maxAdultos: Number(r.maxAdultos || 2),
      totalCuartos: Number(r.totalCuartos || 1),
      calificacionPromedio: Number(r.calificacionPromedio),
      totalResenas: Number(r.totalResenas || 0),
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
        a.hora_checkin,
        a.hora_checkout,
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
      WHERE a.alojamiento_id = $1
        AND a.activo = TRUE
        AND a.deleted_at IS NULL
        AND a.estado_operativo = 'PUBLICADO';
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
        `El alojamiento con ID ${alojamientoId} no fue encontrado o no se encuentra disponible públicamente.`,
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

  async eliminarAlojamientoFisico(
    alojamientoId: number,
    usuario: { usuarioId: string; roles: string[] },
  ) {
    // 1. Verificar existencia del alojamiento (incluso si tiene deleted_at)
    const rows = await this.dataSource.query(
      `SELECT alojamiento_id, propietario_id, titulo, estado_operativo, activo
       FROM alojamientos
       WHERE alojamiento_id = $1`,
      [alojamientoId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`El alojamiento con ID ${alojamientoId} no existe.`);
    }

    const actual = rows[0];

    // 2. Validar permisos: debe ser SUPERADMIN o el propietario anfitrión
    const isSuperAdmin = Array.isArray(usuario.roles) && usuario.roles.includes('SUPERADMIN');
    if (!isSuperAdmin && actual.propietario_id !== usuario.usuarioId) {
      throw new ForbiddenException('No tienes permiso para eliminar definitivamente este alojamiento.');
    }

    // 3. Validar si existen órdenes o transacciones financieras asociadas (activas o históricas)
    // Se valida por alojamiento_id directo o por producto_id vinculado en productos_habitacion
    const ordenesRows = await this.dataSource.query(
      `SELECT COUNT(*)::INT AS total 
       FROM ordenes o 
       WHERE o.alojamiento_id = $1 
          OR o.producto_id IN (SELECT producto_id FROM productos_habitacion WHERE alojamiento_id = $1);`,
      [alojamientoId],
    );

    const totalOrdenes = Number(ordenesRows[0]?.total || 0);
    if (totalOrdenes > 0) {
      throw new ConflictException(
        'No se puede eliminar porque existen reservas asociadas. Manténgalo pausado',
      );
    }

    // 4. Ejecución transaccional del Hard Delete y limpieza de dependencias
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 4.1 Obtener IDs de habitaciones
      const prodRows = await queryRunner.query(
        `SELECT producto_id FROM productos_habitacion WHERE alojamiento_id = $1;`,
        [alojamientoId],
      );
      const prodIds = prodRows.map((p: any) => p.producto_id);

      // 4.2 Limpiar order_previews_holds si existe la tabla
      const previewTableRows = await queryRunner.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'order_previews_holds';`,
      );
      if (previewTableRows.length > 0) {
        await queryRunner.query(
          `DELETE FROM order_previews_holds WHERE alojamiento_id = $1;`,
          [alojamientoId],
        );
      }

      // 4.3 Limpiar calendario_inventario para los productos del alojamiento
      if (prodIds.length > 0) {
        await queryRunner.query(
          `DELETE FROM calendario_inventario WHERE producto_id = ANY($1);`,
          [prodIds],
        );
      }

      // 4.4 Eliminar tablas dependientes en cascada
      await queryRunner.query(`DELETE FROM productos_habitacion WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM alojamiento_fotos WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM alojamiento_facilidades WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM alojamiento_reglas WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM alojamiento_canales WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM alojamiento_politicas WHERE alojamiento_id = $1;`, [alojamientoId]);
      await queryRunner.query(`DELETE FROM resenas WHERE alojamiento_id = $1;`, [alojamientoId]);

      // 4.5 Eliminar registro físico en alojamientos (Hard Delete SQL real)
      await queryRunner.query(`DELETE FROM alojamientos WHERE alojamiento_id = $1;`, [alojamientoId]);

      // 4.6 Registrar traza en auditoría forense si la tabla existe
      const auditoriaTableRows = await queryRunner.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'auditoria_forense';`,
      );
      if (auditoriaTableRows.length > 0) {
        await queryRunner.query(
          `INSERT INTO auditoria_forense (
             correlation_id, nombre_tabla, operacion, registro_id,
             estado_anterior, estado_nuevo, ejecutado_en
           ) VALUES (
             gen_random_uuid(), 'alojamientos', 'DELETE', $1,
             $2, $3, NOW()
           )`,
          [
            String(alojamientoId),
            JSON.stringify(actual),
            JSON.stringify({ eliminado_por: usuario.usuarioId, roles: usuario.roles }),
          ],
        );
      }

      await queryRunner.commitTransaction();

      return {
        mensaje: `El alojamiento "${actual.titulo}" ha sido eliminado definitivamente del sistema.`,
        alojamientoId,
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const rawMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[AlojamientosService.eliminarAlojamientoFisico] Error al eliminar alojamiento ${alojamientoId}:`,
        err,
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Error al eliminar definitivamente el alojamiento: ${rawMsg}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
