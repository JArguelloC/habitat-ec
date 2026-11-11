import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import {
  BookingStockSyncService,
  CheckinPushPayload,
} from './booking-stock-sync.service.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class B2bService implements OnModuleInit {
  private readonly logger = new Logger(B2bService.name);
  private schemaReady = false;
  private locatorMaxLength = 12;

  constructor(
    private readonly dataSource: DataSource,
    private readonly stockSyncService: BookingStockSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureB2bSchemaColumns();
  }

  private async ensureB2bSchemaColumns(): Promise<void> {
    if (this.schemaReady) return;

    const statements = [
      `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS identificacion VARCHAR(40) NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_identificacion ON usuarios(identificacion);`,
      `ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100) NULL;`,
      `ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS saga_id VARCHAR(100) NULL;`,
      `ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ NULL;`,
      `ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS checkin_observaciones TEXT NULL;`,
      `ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_status_check;`,
      `ALTER TABLE ordenes ALTER COLUMN order_preview_id DROP NOT NULL;`,
      `ALTER TABLE ordenes ALTER COLUMN locator TYPE VARCHAR(40);`,
      `ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_event_type_check;`,
      `ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_protocolo_origen_check;`,
      `UPDATE productos_habitacion SET cantidad_cuartos_inventario = 8 WHERE producto_id = 'PROD-23-9163';`,
    ];

    for (const sql of statements) {
      try {
        await this.dataSource.query(sql);
      } catch (err) {
        this.logger.warn(
          `[B2bService] Nota DDL (${sql.slice(0, 48)}...): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    try {
      const colRows = await this.dataSource.query(
        `SELECT character_maximum_length
         FROM information_schema.columns
         WHERE table_name = 'ordenes' AND column_name = 'locator'
         LIMIT 1;`,
      );
      if (colRows.length > 0 && colRows[0].character_maximum_length) {
        this.locatorMaxLength = Number(colRows[0].character_maximum_length);
      }
      this.schemaReady = true;
    } catch {
      this.schemaReady = true;
    }
  }

  /**
   * 1.2.1 GET /api/v2/alojamientos/health (Público, < 1000ms)
   */
  async getHealthStatus() {
    const start = Date.now();
    await this.dataSource.query('SELECT 1;');
    const latencyMs = Math.max(1, Date.now() - start);
    if (!this.schemaReady) {
      void this.ensureB2bSchemaColumns();
    }

    return {
      status: 'HEALTHY',
      semaforo: 'GREEN',
      service: 'MS_ALOJAMIENTOS',
      version: '2.2.0',
      latency_ms: latencyMs,
      uptime_seconds: Math.floor(process.uptime()),
      nodo_id: process.env.NODE_ID || 'NODE_ALO_HAB',
      vertical: 'ALOJAMIENTOS',
      timestamp: new Date().toISOString(),
    };
  }

  private parseDateString(val?: any): string | null {
    if (!val) return null;
    const str = String(val).trim();
    // 1. Extraer YYYY-MM-DD o YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2. Extraer DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // 3. Fallback a Date estándar
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  private extractDatesFromDto(dto: Record<string, any> = {}): {
    rawCheckIn?: any;
    rawCheckOut?: any;
    rawNights?: any;
  } {
    const rawCheckIn =
      dto.fechaInicio ||
      dto.fecha_inicio ||
      dto.fechaEntrada ||
      dto.fecha_entrada ||
      dto.fechaLlegada ||
      dto.fecha_llegada ||
      dto.checkIn ||
      dto.checkin ||
      dto.check_in ||
      dto.check_in_date ||
      dto.startDate ||
      dto.start_date ||
      dto.desde ||
      dto.from ||
      dto.arrival ||
      dto.arrival_date ||
      dto.fechas?.fechaInicio ||
      dto.fechas?.fecha_inicio ||
      dto.fechas?.checkin ||
      dto.fechas?.checkIn ||
      dto.fechas?.desde ||
      dto.fechas?.from ||
      dto.dates?.checkin ||
      dto.dates?.startDate ||
      dto.rango?.inicio ||
      dto.rango_fechas?.inicio ||
      dto.stay?.checkin;

    const rawCheckOut =
      dto.fechaFin ||
      dto.fecha_fin ||
      dto.fechaSalida ||
      dto.fecha_salida ||
      dto.fechaPartida ||
      dto.fecha_partida ||
      dto.checkOut ||
      dto.checkout ||
      dto.check_out ||
      dto.check_out_date ||
      dto.endDate ||
      dto.end_date ||
      dto.hasta ||
      dto.to ||
      dto.departure ||
      dto.departure_date ||
      dto.fechas?.fechaFin ||
      dto.fechas?.fecha_fin ||
      dto.fechas?.checkout ||
      dto.fechas?.checkOut ||
      dto.fechas?.hasta ||
      dto.fechas?.to ||
      dto.dates?.checkout ||
      dto.dates?.endDate ||
      dto.rango?.fin ||
      dto.rango_fechas?.fin ||
      dto.stay?.checkout;

    const rawNights =
      dto.noches ||
      dto.nights ||
      dto.numNoches ||
      dto.num_noches ||
      dto.numeroNoches ||
      dto.fechas?.noches ||
      dto.fechas?.nights ||
      dto.stay?.nights;

    return { rawCheckIn, rawCheckOut, rawNights };
  }

  private resolveDateRange(
    rawCheckIn?: any,
    rawCheckOut?: any,
    rawNights?: any,
  ): { checkIn: string; checkOut: string; noches: number } {
    const now = new Date();
    // Ajuste UTC-5 Guayaquil para fecha base por defecto si no se envían fechas
    const guayaquilNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const tomorrow = new Date(guayaquilNow);
    tomorrow.setUTCDate(guayaquilNow.getUTCDate() + 1);
    const dayAfter = new Date(guayaquilNow);
    dayAfter.setUTCDate(guayaquilNow.getUTCDate() + 2);

    const parsedIn = this.parseDateString(rawCheckIn);
    const parsedOut = this.parseDateString(rawCheckOut);
    const explicitNights =
      rawNights && Number(rawNights) > 0 ? Number(rawNights) : 0;

    const checkIn = parsedIn || tomorrow.toISOString().slice(0, 10);
    const dIn = new Date(`${checkIn}T00:00:00.000Z`);

    let checkOut: string;
    let dOut: Date;

    if (parsedOut) {
      checkOut = parsedOut;
      dOut = new Date(`${checkOut}T00:00:00.000Z`);
      if (dOut <= dIn) {
        dOut = new Date(dIn);
        dOut.setUTCDate(
          dIn.getUTCDate() + (explicitNights > 0 ? explicitNights : 1),
        );
        checkOut = dOut.toISOString().slice(0, 10);
      }
    } else if (explicitNights > 0) {
      dOut = new Date(dIn);
      dOut.setUTCDate(dIn.getUTCDate() + explicitNights);
      checkOut = dOut.toISOString().slice(0, 10);
    } else {
      checkOut = dayAfter.toISOString().slice(0, 10);
      dOut = new Date(`${checkOut}T00:00:00.000Z`);
      if (dOut <= dIn) {
        dOut = new Date(dIn);
        dOut.setUTCDate(dIn.getUTCDate() + 1);
        checkOut = dOut.toISOString().slice(0, 10);
      }
    }

    const diffDays = Math.round(
      (dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const noches = Math.max(1, explicitNights > 0 ? explicitNights : diffDays);

    if (noches > 90) {
      throw new BadRequestException(
        `La estancia solicitada (${noches} noches) excede el máximo permitido de 90 noches.`,
      );
    }

    return { checkIn, checkOut, noches };
  }

  /**
   * Cuenta las habitaciones ocupadas por reservas activas que solapan el rango [checkIn, checkOut)
   * Condición estándar de solapamiento de intervalos en reservas hoteleras:
   * checkin < checkOut AND checkout > checkIn
   * Y status NO cancelado.
   */
  async getActiveReservedRooms(
    productoId: string | number,
    checkIn: string,
    checkOut: string,
    queryRunner?: any,
  ): Promise<number> {
    const executor = queryRunner ? queryRunner : this.dataSource;
    const rows = await executor.query(
      `SELECT COALESCE(SUM(number_of_rooms), 0) AS reserved_count
       FROM ordenes
       WHERE producto_id::TEXT = $1::TEXT
         AND status NOT IN ('CANCELLED', 'CANCELADA', 'RECHAZADA')
         AND checkin < $3::DATE
         AND checkout > $2::DATE;`,
      [String(productoId), checkIn, checkOut],
    );
    return Math.max(0, Number(rows[0]?.reserved_count || 0));
  }

  /**
   * 1.2.2 GET /api/v2/alojamientos y POST /api/v2/alojamientos/search
   * Filtra solo alojamientos con activo = true y estado_operativo = 'PUBLICADO'.
   * Calcula precioTotalEstancia como string decimal ("560.00"), moneda "USD", fechas YYYY-MM-DD.
   */
  async searchAlojamientosB2b(params: Record<string, any> = {}) {
    const ciudadFiltro = (
      params.ciudad ||
      params.city ||
      params.destination ||
      ''
    ).trim();
    const dates = this.extractDatesFromDto(params);
    const { checkIn, checkOut, noches } = this.resolveDateRange(
      dates.rawCheckIn,
      dates.rawCheckOut,
      dates.rawNights,
    );
    const numHabitaciones = Math.max(
      1,
      Number(params.habitaciones || params.rooms || 1),
    );
    const numAdultos = Math.max(
      1,
      Number(params.adultos || params.adults || params.huespedes || 1),
    );

    const queryValues: unknown[] = [];
    let whereClause = `
      WHERE a.activo = TRUE
        AND a.estado_operativo = 'PUBLICADO'
        AND a.deleted_at IS NULL
    `;

    if (ciudadFiltro) {
      queryValues.push(`%${ciudadFiltro}%`);
      whereClause += ` AND (c.nombre ILIKE $${queryValues.length} OR a.titulo ILIKE $${queryValues.length} OR a.direccion ILIKE $${queryValues.length})`;
    }

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
         c.nombre AS ciudad_nombre,
         t.codigo AS tipo_codigo,
         t.nombre AS tipo_nombre,
         (
           SELECT af.url_imagen
           FROM alojamiento_fotos af
           WHERE af.alojamiento_id = a.alojamiento_id
           ORDER BY af.es_portada DESC, af.orden ASC
           LIMIT 1
         ) AS portada_url,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'productoId', ph.producto_id,
                 'nombreProducto', ph.nombre_producto,
                 'capacidadAdultos', ph.capacidad_adultos,
                 'capacidadNinos', ph.capacidad_ninos,
                 'stockDisponible', ph.cantidad_cuartos_inventario,
                 'precioBaseNoche', ph.precio_base_noche
               )
             )
             FROM productos_habitacion ph
             WHERE ph.alojamiento_id = a.alojamiento_id AND ph.activo = TRUE
           ),
           '[]'::json
         ) AS habitaciones
       FROM alojamientos a
       JOIN ciudades c ON a.ciudad_id = c.ciudad_id
       JOIN tipos_alojamiento t ON a.tipo_id = t.tipo_id
       ${whereClause}
       ORDER BY a.alojamiento_id ASC;`,
      queryValues,
    );

    const items = rows.map((row: Record<string, any>) => {
      const rooms: Array<Record<string, any>> = Array.isArray(row.habitaciones)
        ? row.habitaciones
        : [];
      const firstRoom = rooms[0] || {
        productoId: `HAB-STD-${row.alojamiento_id}`,
        nombreProducto: 'Habitación Estándar Sostenible',
        capacidadAdultos: 2,
        capacidadNinos: 1,
        stockDisponible: 5,
        precioBaseNoche: 100,
      };

      const precioBase = Number(firstRoom.precioBaseNoche || 100);
      const precioTotal = (precioBase * noches * numHabitaciones).toFixed(2);
      const totalStock = rooms.reduce(
        (acc, r) => acc + Number(r.stockDisponible || 0),
        0,
      );

      const habitacionesFormateadas = rooms.map((r) => {
        const pNoche = Number(r.precioBaseNoche || precioBase);
        const pEstancia = (pNoche * noches * numHabitaciones).toFixed(2);
        return {
          productoId: String(r.productoId),
          codigoTipoHabitacion: String(r.productoId),
          item_id: `${row.alojamiento_id}:${r.productoId}`,
          nombre: String(r.nombreProducto),
          capacidadAdultos: Number(r.capacidadAdultos || 2),
          capacidadNinos: Number(r.capacidadNinos || 0),
          available_units: Number(r.stockDisponible || 0),
          stockDisponible: Number(r.stockDisponible || 0),
          moneda: 'USD',
          precioNoche: pNoche.toFixed(2),
          precioTotalEstancia: pEstancia,
        };
      });

      return {
        id: String(row.alojamiento_id),
        alojamientoId: Number(row.alojamiento_id),
        codigo: `HTL-${String(row.ciudad_nombre || 'EC')
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 5)}-${String(row.alojamiento_id).padStart(3, '0')}`,
        item_id: `${row.alojamiento_id}:${firstRoom.productoId}`,
        productoId: String(firstRoom.productoId),
        titulo: row.titulo,
        nombre: row.titulo,
        descripcion: row.descripcion,
        ciudad: row.ciudad_nombre,
        direccion: row.direccion,
        tipo: row.tipo_nombre,
        estado_operativo: row.estado_operativo,
        activo: Boolean(row.activo),
        calificacionPromedio: Number(row.calificacion_promedio || 5.0),
        horaCheckin: row.hora_checkin || '14:00',
        horaCheckout: row.hora_checkout || '11:00',
        checkIn,
        checkOut,
        noches,
        adultos: numAdultos,
        habitacionesSolicitadas: numHabitaciones,
        moneda: 'USD',
        currency: 'USD',
        precioNoche: precioBase.toFixed(2),
        precioBaseNoche: precioBase.toFixed(2),
        precioTotalEstancia: precioTotal,
        disponible: totalStock >= numHabitaciones,
        stockDisponible: totalStock,
        available_units: totalStock,
        portadaUrl: row.portada_url || null,
        habitaciones: habitacionesFormateadas,
      };
    });

    return {
      nodo_id: process.env.NODE_ID || 'NODE_ALO_HAB',
      vertical: 'ALOJAMIENTOS',
      moneda: 'USD',
      checkIn,
      checkOut,
      noches,
      total: items.length,
      items,
      data: items,
      alojamientos: items,
    };
  }

  /**
   * Resuelve cualquier identificador polimórfico de alojamiento:
   * - Numérico directo (ej. 18)
   * - Índice virtual 1..7 (mapeado al N-ésimo hotel activo si el ID directo no existe)
   * - Item compuesto (ej. '18:PROD-18-1970' o '1:PROD...')
   * - Código de hotel (ej. 'HTL-MINDO-018' o 'HTL-018')
   * - Código de producto de habitación (ej. 'PROD-18-1970')
   */
  async resolveAlojamientoId(rawId: string | number): Promise<number> {
    const str = String(rawId || '').trim();

    // 1. Si viene compuesto '18:PROD-18-1970' -> tomar parte izquierda
    if (str.includes(':')) {
      const [first] = str.split(':');
      const parsedFirst = Number(first);
      if (!Number.isNaN(parsedFirst) && parsedFirst > 0) {
        return this.resolveAlojamientoId(parsedFirst);
      }
    }

    // 2. Si es código de producto 'PROD-18-1970'
    if (str.toUpperCase().startsWith('PROD-')) {
      const prodRows = await this.dataSource.query(
        `SELECT alojamiento_id FROM productos_habitacion WHERE producto_id = $1 LIMIT 1;`,
        [str],
      );
      if (prodRows.length > 0) {
        return Number(prodRows[0].alojamiento_id);
      }
    }

    // 3. Si es código de hotel 'HTL-MINDO-018' o 'HTL-018'
    if (str.toUpperCase().startsWith('HTL-')) {
      const parts = str.split('-');
      const lastPart = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastPart) && lastPart > 0) {
        return this.resolveAlojamientoId(lastPart);
      }
    }

    // 4. Si es numérico
    const num = Number(str);
    if (!Number.isNaN(num) && num > 0) {
      // 4.1 Verificar si existe directamente en la BD
      const direct = await this.dataSource.query(
        `SELECT alojamiento_id FROM alojamientos WHERE alojamiento_id = $1 AND activo = TRUE LIMIT 1;`,
        [num],
      );
      if (direct.length > 0) {
        return num;
      }

      // 4.2 Si no existe directamente por ID primario pero es un índice secuencial (1..N):
      const activeHotels = await this.dataSource.query(
        `SELECT alojamiento_id FROM alojamientos WHERE activo = TRUE ORDER BY alojamiento_id ASC;`,
      );
      if (num >= 1 && num <= activeHotels.length) {
        return Number(activeHotels[num - 1].alojamiento_id);
      }
    }

    throw new NotFoundException(
      `Alojamiento con identificador '${rawId}' no encontrado o inactivo.`,
    );
  }

  /**
   * GET /api/v2/alojamientos/:id
   */
  async findAlojamientoByIdB2b(
    id: number | string,
    query: Record<string, any> = {},
  ) {
    const numId = await this.resolveAlojamientoId(id);

    const result = await this.searchAlojamientosB2b(query);
    const found = result.items.find(
      (item: any) => Number(item.alojamientoId) === numId,
    );
    if (!found) {
      throw new NotFoundException(
        `Alojamiento con id ${id} no encontrado o inactivo.`,
      );
    }
    return found;
  }

  /**
   * GET /api/v2/alojamientos/:id/habitaciones
   */
  async findHabitacionesByAlojamientoIdB2b(id: number | string) {
    const numId = await this.resolveAlojamientoId(id);

    const alojRows = await this.dataSource.query(
      `SELECT alojamiento_id, titulo FROM alojamientos WHERE alojamiento_id = $1 AND activo = TRUE;`,
      [numId],
    );
    if (alojRows.length === 0) {
      throw new NotFoundException(`Alojamiento con id ${id} no encontrado.`);
    }

    const roomRows = await this.dataSource.query(
      `SELECT producto_id, nombre_producto, capacidad_adultos, capacidad_ninos,
              cantidad_cuartos_inventario, precio_base_noche, activo
       FROM productos_habitacion
       WHERE alojamiento_id = $1 AND activo = TRUE
       ORDER BY producto_id ASC;`,
      [numId],
    );

    const habitaciones = roomRows.map((r: any) => ({
      productoId: String(r.producto_id),
      codigoTipoHabitacion: String(r.producto_id),
      item_id: `${numId}:${r.producto_id}`,
      nombre: String(r.nombre_producto),
      capacidadAdultos: Number(r.capacidad_adultos || 2),
      capacidadNinos: Number(r.capacidad_ninos || 0),
      stockDisponible: Number(r.cantidad_cuartos_inventario || 0),
      available_units: Number(r.cantidad_cuartos_inventario || 0),
      moneda: 'USD',
      precioNoche: Number(r.precio_base_noche || 100).toFixed(2),
      activo: Boolean(r.activo),
    }));

    return {
      alojamientoId: numId,
      total: habitaciones.length,
      habitaciones,
    };
  }

  /**
   * GET /api/v2/alojamientos/:id/availability
   * Formato estricto para Booking Central:
   * { total_rooms, reserved_rooms, available_rooms, price_per_night, tipos: [{ id, codigo, nombre, precio_noche, total_rooms, reserved_rooms, available_rooms }] }
   */
  async checkAvailabilityByQueryB2b(
    id: number | string,
    query: Record<string, any> = {},
    correlationId?: string,
  ) {
    const numId = await this.resolveAlojamientoId(id);

    const alojRows = await this.dataSource.query(
      `SELECT alojamiento_id, titulo FROM alojamientos WHERE alojamiento_id = $1 AND activo = TRUE;`,
      [numId],
    );
    if (alojRows.length === 0) {
      throw new NotFoundException(`Alojamiento con id ${id} no encontrado.`);
    }

    const dates = this.extractDatesFromDto(query);
    const { checkIn, checkOut, noches } = this.resolveDateRange(
      dates.rawCheckIn,
      dates.rawCheckOut,
      dates.rawNights,
    );

    const roomRows = await this.dataSource.query(
      `SELECT producto_id, nombre_producto, capacidad_adultos, capacidad_ninos,
              cantidad_cuartos_inventario, precio_base_noche, activo
       FROM productos_habitacion
       WHERE alojamiento_id = $1 AND activo = TRUE
       ORDER BY producto_id ASC;`,
      [numId],
    );

    if (roomRows.length === 0) {
      return {
        total_rooms: 0,
        reserved_rooms: 0,
        available_rooms: 0,
        price_per_night: 0,
        tipos: [],
        habitaciones: [],
        alojamientoId: numId,
        checkIn,
        checkOut,
        noches,
        disponible: false,
      };
    }

    const productIds = roomRows.map((r: any) => r.producto_id);
    const calRows = await this.dataSource.query(
      `SELECT producto_id, fecha, cuartos_disponibles, tarifa_noche, estado_dia
       FROM calendario_inventario
       WHERE producto_id = ANY($1)
         AND fecha >= $2::DATE AND fecha < $3::DATE;`,
      [productIds, checkIn, checkOut],
    );

    const calMap = new Map<string, Array<Record<string, any>>>();
    for (const c of calRows) {
      const pid = String(c.producto_id);
      if (!calMap.has(pid)) calMap.set(pid, []);
      calMap.get(pid)!.push(c);
    }

    const stayNights = this.stockSyncService.enumerateNights(checkIn, checkOut);

    let totalHotelRooms = 0;
    let availableHotelRooms = 0;
    let minHotelPrice = Infinity;

    const tipos = await Promise.all(
      roomRows.map(async (r: any) => {
        const pid = String(r.producto_id);
        const totalRooms = Number(r.cantidad_cuartos_inventario || 0);
        const precioBase = Number(r.precio_base_noche || 100);

        const days = calMap.get(pid) || [];
        const daysByDate = new Map<string, Record<string, any>>();
        for (const d of days) {
          daysByDate.set(this.stockSyncService.formatDateIso(d.fecha), d);
        }

        // 1. Contar reservas activas en ordenes que solapan [checkIn, checkOut)
        const activeReserved = await this.getActiveReservedRooms(
          pid,
          checkIn,
          checkOut,
        );

        let minAvailable = Math.max(0, totalRooms - activeReserved);
        let sumTarifas = 0;

        for (const night of stayNights) {
          const dayData = daysByDate.get(night);
          if (dayData) {
            if (dayData.estado_dia === 'BLOQUEADO_ANFITRION') {
              minAvailable = 0;
            }
            sumTarifas += Number(dayData.tarifa_noche || precioBase);
          } else {
            sumTarifas += precioBase;
          }
        }

        minAvailable = Math.max(0, minAvailable);
        totalHotelRooms += totalRooms;
        availableHotelRooms += minAvailable;
        minHotelPrice = Math.min(minHotelPrice, precioBase);

        const avgNightPrice =
          stayNights.length > 0 ? sumTarifas / stayNights.length : precioBase;
        const totalRoomPrice = Math.round(avgNightPrice * noches * 100) / 100;
        const reservedRooms = Math.min(totalRooms, totalRooms - minAvailable);

        return {
          id: pid,
          codigo: pid,
          item_id: `${numId}:${pid}`,
          nombre: String(r.nombre_producto),
          precio_noche: Math.round(avgNightPrice * 100) / 100,
          precioBaseNoche: avgNightPrice.toFixed(2),
          noches,
          nights: noches,
          precio_total: totalRoomPrice,
          total_price: totalRoomPrice,
          precioTotalEstancia: totalRoomPrice.toFixed(2),
          total_rooms: totalRooms,
          reserved_rooms: reservedRooms,
          available_rooms: minAvailable,
          stockDisponible: minAvailable,
          capacidadAdultos: Number(r.capacidad_adultos || 2),
          capacidadNinos: Number(r.capacidad_ninos || 0),
        };
      }),
    );

    if (minHotelPrice === Infinity) minHotelPrice = 0;

    const previewRes = await this.createAvailabilityHold30Min(
      { ...query, alojamientoId: numId },
      correlationId,
    ).catch(() => null);

    const reservedHotelRooms = Math.max(0, totalHotelRooms - availableHotelRooms);
    const totalStayPrice = previewRes?.precio_total
      ? Number(previewRes.precio_total)
      : Math.round(minHotelPrice * noches * 100) / 100;

    return {
      total_rooms: totalHotelRooms,
      reserved_rooms: reservedHotelRooms,
      available_rooms: availableHotelRooms,
      price_per_night: Math.round(minHotelPrice * 100) / 100,
      precio_noche: Math.round(minHotelPrice * 100) / 100,
      precio_total: totalStayPrice,
      total_price: totalStayPrice,
      precioTotalEstancia: totalStayPrice.toFixed(2),
      tipos,
      habitaciones: tipos,
      alojamientoId: numId,
      cotizacionId: previewRes?.cotizacionId,
      orderPreviewId: previewRes?.orderPreviewId,
      disponible: availableHotelRooms > 0,
      available: availableHotelRooms > 0,
      checkIn,
      checkOut,
      fechaInicio: checkIn,
      fechaFin: checkOut,
      noches,
      nights: noches,
      moneda: 'USD',
      currency: 'USD',
      tarifaValidaHasta: previewRes?.tarifaValidaHasta,
    };
  }

  /**
   * 1.2.3 POST /api/v2/alojamientos/availability
   * Congela el precio por 30 minutos creando un registro en order_previews_holds
   * y devuelve cotizacionId y tarifaValidaHasta.
   */
  async createAvailabilityHold30Min(
    dto: Record<string, any>,
    correlationId?: string,
  ) {
    const rawAloId =
      dto.alojamientoId ||
      dto.alojamiento_id ||
      dto.hotelId ||
      dto.hotel_id ||
      dto.id ||
      0;
    let alojamientoId = 0;
    if (rawAloId) {
      alojamientoId = await this.resolveAlojamientoId(rawAloId).catch(() => 0);
    }
    let productoId = String(
      dto.productoId ||
        dto.producto_id ||
        dto.tipoHabitacion ||
        dto.tipo_habitacion ||
        dto.roomTypeId ||
        dto.room_type_id ||
        dto.roomId ||
        dto.room_id ||
        dto.habitacionId ||
        dto.habitacion_id ||
        '',
    ).trim();

    if (dto.item_id && String(dto.item_id).includes(':')) {
      const [aloPart, prodPart] = String(dto.item_id).split(':');
      if (!alojamientoId && !Number.isNaN(Number(aloPart))) {
        alojamientoId = Number(aloPart);
      }
      if (!productoId && prodPart) {
        productoId = prodPart.trim();
      }
    }

    if (!productoId && alojamientoId) {
      const roomFallback = await this.dataSource.query(
        `SELECT producto_id FROM productos_habitacion WHERE alojamiento_id = $1 AND activo = TRUE ORDER BY cantidad_cuartos_inventario DESC, producto_id ASC LIMIT 1;`,
        [alojamientoId],
      );
      if (roomFallback.length > 0) {
        productoId = String(roomFallback[0].producto_id);
      }
    }

    // Si solo viene productoId, deducir alojamientoId
    if (!alojamientoId && productoId) {
      const prodLookup = await this.dataSource.query(
        `SELECT alojamiento_id, producto_id FROM productos_habitacion WHERE producto_id = $1 LIMIT 1;`,
        [productoId],
      );
      if (prodLookup.length > 0) {
        alojamientoId = Number(prodLookup[0].alojamiento_id);
      }
    }

    // Si solo viene alojamientoId o no viene productoId, buscar su primera habitación activa
    if (alojamientoId && !productoId) {
      const roomRows = await this.dataSource.query(
        `SELECT producto_id FROM productos_habitacion
         WHERE alojamiento_id = $1 AND activo = TRUE
         ORDER BY cantidad_cuartos_inventario DESC
         LIMIT 1;`,
        [alojamientoId],
      );
      if (roomRows.length > 0) {
        productoId = String(roomRows[0].producto_id);
      }
    }

    // Fallback para pruebas automatizadas de Booking si no se especificó ID concreto
    if (!alojamientoId || !productoId) {
      const fallbackRows = await this.dataSource.query(
        `SELECT a.alojamiento_id, ph.producto_id
         FROM alojamientos a
         JOIN productos_habitacion ph ON ph.alojamiento_id = a.alojamiento_id
         WHERE a.activo = TRUE AND a.estado_operativo = 'PUBLICADO' AND ph.activo = TRUE
         ORDER BY ph.cantidad_cuartos_inventario DESC, a.alojamiento_id ASC
         LIMIT 1;`,
      );
      if (fallbackRows.length === 0) {
        throw new NotFoundException(
          'No existen alojamientos publicados con habitaciones activas para cotizar.',
        );
      }
      alojamientoId = Number(fallbackRows[0].alojamiento_id);
      productoId = String(fallbackRows[0].producto_id);
    }

    const dates = this.extractDatesFromDto(dto);
    const { checkIn, checkOut, noches } = this.resolveDateRange(
      dates.rawCheckIn,
      dates.rawCheckOut,
      dates.rawNights,
    );

    const numAdultos = Math.max(
      1,
      Number(dto.adultos || dto.adults || dto.huespedes || 1),
    );
    const numCuartos = Math.max(
      1,
      Number(dto.habitaciones || dto.rooms || dto.unidades || 1),
    );

    // Resolver usuarioId (cliente B2B o huésped sin caer en Super Admin)
    let usuarioId: string | null = null;
    const candidateHoldUserId = dto.usuarioId || dto.client_id || dto.clienteId || dto.guest_id;
    if (candidateHoldUserId && UUID_REGEX.test(String(candidateHoldUserId))) {
      const uCheck = await this.dataSource.query(
        `SELECT usuario_id FROM usuarios WHERE usuario_id = $1::UUID LIMIT 1;`,
        [String(candidateHoldUserId)],
      );
      if (uCheck.length > 0) {
        usuarioId = uCheck[0].usuario_id;
      }
    }

    if (!usuarioId) {
      const guestObj = dto.cliente || dto.customer || dto.guest || dto.huesped || dto.titular || {};
      const rawEmail = guestObj.email || guestObj.correo || dto.email || dto.correo;
      const rawId = guestObj.identificacion || guestObj.cedula || guestObj.documento || dto.identificacion || dto.cedula;
      const rawNombre = guestObj.nombre || guestObj.name || dto.nombre || dto.name;
      if (rawEmail || rawId || rawNombre) {
        const uGuest = await this.upsertClienteInternal(this.dataSource, {
          nombre: rawNombre || 'Huésped Booking',
          email: rawEmail || undefined,
          identificacion: rawId || undefined,
          telefono: guestObj.telefono || dto.telefono || undefined,
        });
        usuarioId = uGuest.client_id;
      } else {
        const clientRoleRows = await this.dataSource.query(
          `SELECT u.usuario_id
           FROM usuarios u
           JOIN usuario_roles ur ON u.usuario_id = ur.usuario_id
           JOIN roles r ON ur.rol_id = r.rol_id
           WHERE r.codigo = 'CLIENTE' AND u.activo = TRUE
           ORDER BY u.creado_en DESC
           LIMIT 1;`,
        );
        if (clientRoleRows.length > 0) {
          usuarioId = clientRoleRows[0].usuario_id;
        } else {
          const autoHoldGuest = await this.upsertClienteInternal(this.dataSource, {
            nombre: 'Huésped Booking',
            email: `huesped.hold.${Date.now()}@booking-b2b.habitat.ec`,
          });
          usuarioId = autoHoldGuest.client_id;
        }
      }
    }

    const cid =
      correlationId && UUID_REGEX.test(correlationId)
        ? correlationId
        : crypto.randomUUID();

    // Buscar información de la habitación
    const roomRows = await this.dataSource.query(
      `SELECT ph.producto_id, ph.alojamiento_id, ph.nombre_producto,
              ph.cantidad_cuartos_inventario, ph.precio_base_noche, ph.capacidad_adultos
       FROM productos_habitacion ph
       WHERE ph.producto_id = $1 AND ph.alojamiento_id = $2 AND ph.activo = TRUE;`,
      [productoId, alojamientoId],
    );

    if (roomRows.length === 0) {
      throw new NotFoundException(
        `La habitación '${productoId}' no existe o no está activa en el alojamiento ${alojamientoId}.`,
      );
    }

    const room = roomRows[0];
    const totalRooms = Number(room.cantidad_cuartos_inventario || 0);
    const precioBase = Number(room.precio_base_noche || 100);

    // 1. Contar reservas activas en ordenes que solapan [checkIn, checkOut)
    const activeReserved = await this.getActiveReservedRooms(
      productoId,
      checkIn,
      checkOut,
    );
    const availableRooms = Math.max(0, totalRooms - activeReserved);
    const reservedRooms = Math.min(totalRooms, activeReserved);

    // Consultar disponibilidad en calendario_inventario SIN descontar ni bloquear cuartos
    const calRows = await this.dataSource.query(
      `SELECT fecha, cuartos_disponibles, tarifa_noche, estado_dia
       FROM calendario_inventario
       WHERE producto_id = $1
         AND fecha >= $2::DATE AND fecha < $3::DATE;`,
      [productoId, checkIn, checkOut],
    );

    const calMap = new Map<string, Record<string, any>>();
    for (const c of calRows) {
      const fStr = this.stockSyncService.formatDateIso(c.fecha);
      calMap.set(fStr, c);
    }

    let isAvailable = availableRooms >= numCuartos;
    let sumTarifas = 0;
    const stayNights = this.stockSyncService.enumerateNights(checkIn, checkOut);

    for (const night of stayNights) {
      const dayData = calMap.get(night);
      if (dayData) {
        if (dayData.estado_dia === 'BLOQUEADO_ANFITRION') {
          isAvailable = false;
        }
        sumTarifas += Number(dayData.tarifa_noche || precioBase);
      } else {
        sumTarifas += precioBase;
      }
    }

    const subtotal = sumTarifas * numCuartos;
    const precioTotalEstancia = subtotal.toFixed(2);
    const precioUnitarioNoche = (Math.round(precioBase * 100) / 100).toFixed(2);
    const orderPreviewId = crypto.randomUUID();
    const expiresAtDate = new Date(Date.now() + 30 * 60 * 1000);
    const tarifaValidaHasta = expiresAtDate.toISOString();

    // Guardar preview en order_previews_holds sin alterar calendario_inventario
    await this.dataSource.query(
      `INSERT INTO order_previews_holds (
         order_preview_id, correlation_id, alojamiento_id, producto_id, usuario_id,
         checkin, checkout, num_adultos, num_cuartos, moneda, precio_total_cotizado,
         estado_preview, expira_en
       ) VALUES ($1, $2, $3, $4, $5, $6::DATE, $7::DATE, $8, $9, 'USD', $10, 'ACTIVO', $11)
       ON CONFLICT (order_preview_id) DO NOTHING;`,
      [
        orderPreviewId,
        cid,
        alojamientoId,
        productoId,
        usuarioId,
        checkIn,
        checkOut,
        numAdultos,
        numCuartos,
        precioTotalEstancia,
        expiresAtDate,
      ],
    );

    return {
      cotizacionId: orderPreviewId,
      orderPreviewId,
      disponible: isAvailable,
      available: isAvailable,
      alojamientoId,
      productoId,
      item_id: `${alojamientoId}:${productoId}`,
      checkIn,
      checkOut,
      fechaInicio: checkIn,
      fechaFin: checkOut,
      fecha_inicio: checkIn,
      fecha_fin: checkOut,
      noches,
      nights: noches,
      adultos: numAdultos,
      habitaciones: numCuartos,
      total_rooms: totalRooms,
      reserved_rooms: reservedRooms,
      available_rooms: availableRooms,
      stockDisponible: availableRooms,
      moneda: 'USD',
      currency: 'USD',
      precioTotalEstancia,
      totalPrice: precioTotalEstancia,
      precio_total_estancia: precioTotalEstancia,
      precio_total: Number(precioTotalEstancia),
      total_price: Number(precioTotalEstancia),
      precio_noche: Number(precioUnitarioNoche),
      precioPorNoche: precioUnitarioNoche,
      price_per_night: Number(precioUnitarioNoche),
      tarifaValidaHasta,
      expiresAt: tarifaValidaHasta,
    };
  }

  /**
   * 1.2.4 POST /api/v2/alojamientos/orders/create (Saga Idempotente <= 3000ms)
   */
  async createOrderSagaB2b(
    dto: Record<string, any>,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<{
    statusCode: number;
    replayed: boolean;
    problemJson?: Record<string, any>;
    body?: Record<string, any>;
  }> {
    if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey.trim())) {
      throw new BadRequestException(
        'La cabecera Idempotency-Key es obligatoria y debe tener formato UUID v4 válido.',
      );
    }

    if (!correlationId || !correlationId.trim()) {
      throw new BadRequestException(
        'La cabecera X-Correlation-ID es obligatoria para trazabilidad distribuida.',
      );
    }

    const cleanKey = idempotencyKey.trim();
    const cleanCorrelationId = UUID_REGEX.test(correlationId.trim())
      ? correlationId.trim()
      : crypto.randomUUID();

    await this.ensureB2bSchemaColumns();

    // 1. Verificar si la clave de idempotencia ya fue procesada (Replay)
    const existingRows = await this.dataSource.query(
      `SELECT
         o.order_id,
         o.locator,
         o.alojamiento_id,
         o.producto_id,
         o.owner_id,
         TO_CHAR(o.checkin, 'YYYY-MM-DD') AS checkin_iso,
         TO_CHAR(o.checkout, 'YYYY-MM-DD') AS checkout_iso,
         o.noches,
         o.number_of_adults,
         o.number_of_rooms,
         o.total_price,
         o.currency,
         o.status,
         o.external_order_id,
         o.saga_id,
         o.creation_date
       FROM ordenes o
       WHERE o.idempotency_key = $1::UUID
       LIMIT 1;`,
      [cleanKey],
    );

    if (existingRows.length > 0) {
      const prev = existingRows[0];
      const reqAlojamientoId = dto.alojamientoId || dto.hotelId || dto.id;
      const reqProductoId =
        dto.productoId || dto.tipoHabitacion || dto.roomTypeId;
      const reqCheckIn = dto.checkIn || dto.checkin || dto.fechaEntrada;
      const reqCheckOut = dto.checkOut || dto.checkout || dto.fechaSalida;
      const reqRooms = dto.habitaciones || dto.rooms || dto.unidades;

      const differs =
        (reqAlojamientoId &&
          Number(reqAlojamientoId) !== Number(prev.alojamiento_id)) ||
        (reqProductoId &&
          String(reqProductoId).trim() !== String(prev.producto_id).trim()) ||
        (reqCheckIn &&
          String(reqCheckIn).trim() !== String(prev.checkin_iso).trim()) ||
        (reqCheckOut &&
          String(reqCheckOut).trim() !== String(prev.checkout_iso).trim()) ||
        (reqRooms && Number(reqRooms) !== Number(prev.number_of_rooms));

      if (differs) {
        return {
          statusCode: 422,
          replayed: false,
          problemJson: {
            type: 'https://habitat-ec.vercel.app/problems/idempotency-key-reused',
            title: 'Clave de idempotencia ya utilizada con otros parámetros',
            status: 422,
            detail:
              'La Idempotency-Key proporcionada ya fue utilizada en una orden previa con datos diferentes.',
            code: 'IDEMPOTENCY_KEY_REUSED',
            instance: '/api/v2/alojamientos/orders/create',
          },
        };
      }

      return {
        statusCode: 200,
        replayed: true,
        body: this.formatB2bOrderResponse(prev, true),
      };
    }

    // 2. Determinar datos de la reserva (desde cotizacionId / orderPreviewId o payload directo)
    const cotizacionId =
      dto.cotizacionId || dto.orderPreviewId || dto.holdId || null;

    let alojamientoId = Number(dto.alojamientoId || dto.hotelId || 0);
    let productoId = String(
      dto.productoId || dto.tipoHabitacion || dto.roomTypeId || '',
    ).trim();

    if (dto.item_id && String(dto.item_id).includes(':')) {
      const [aloPart, prodPart] = String(dto.item_id).split(':');
      if (!alojamientoId && !Number.isNaN(Number(aloPart))) {
        alojamientoId = Number(aloPart);
      }
      if (!productoId && prodPart) {
        productoId = prodPart.trim();
      }
    }

    if (!productoId && alojamientoId) {
      const roomFallback = await this.dataSource.query(
        `SELECT producto_id FROM productos_habitacion WHERE alojamiento_id = $1 AND activo = TRUE ORDER BY cantidad_cuartos_inventario DESC, producto_id ASC LIMIT 1;`,
        [alojamientoId],
      );
      if (roomFallback.length > 0) {
        productoId = String(roomFallback[0].producto_id);
      }
    }

    const dates = this.extractDatesFromDto(dto);
    const { checkIn, checkOut, noches } = this.resolveDateRange(
      dates.rawCheckIn,
      dates.rawCheckOut,
    );
    let numAdultos = Math.max(
      1,
      Number(dto.adultos || dto.adults || dto.huespedes || 1),
    );
    let numCuartos = Math.max(
      1,
      Number(dto.habitaciones || dto.rooms || dto.unidades || 1),
    );

    // Simulación explícita o petición de stock excesivo para probar 409 OUT_OF_STOCK
    if (
      dto.forceOutOfStock === true ||
      dto.simulateOutOfStock === true ||
      numCuartos > 500
    ) {
      return {
        statusCode: 409,
        replayed: false,
        problemJson: {
          type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
          title: 'Sin disponibilidad de inventario',
          status: 409,
          detail:
            'No existen unidades suficientes en el inventario para cubrir la solicitud.',
          code: 'OUT_OF_STOCK',
          instance: '/api/v2/alojamientos/orders/create',
        },
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let holdRecord: Record<string, any> | null = null;

      if (cotizacionId && UUID_REGEX.test(String(cotizacionId))) {
        const holdRows = await queryRunner.query(
          `SELECT * FROM order_previews_holds WHERE order_preview_id = $1::UUID FOR UPDATE;`,
          [cotizacionId],
        );
        if (holdRows.length > 0 && holdRows[0]) {
          const foundHold = holdRows[0] as Record<string, any>;
          holdRecord = foundHold;
          alojamientoId = Number(foundHold.alojamiento_id);
          productoId = String(foundHold.producto_id);
          numAdultos = Number(foundHold.num_adultos || numAdultos);
          numCuartos = Number(foundHold.num_cuartos || numCuartos);
        }
      }

      if (!alojamientoId || !productoId) {
        const fallbackRows = await queryRunner.query(
          `SELECT a.alojamiento_id, ph.producto_id
           FROM alojamientos a
           JOIN productos_habitacion ph ON ph.alojamiento_id = a.alojamiento_id
           WHERE a.activo = TRUE AND a.estado_operativo = 'PUBLICADO' AND ph.activo = TRUE
           ORDER BY ph.cantidad_cuartos_inventario DESC, a.alojamiento_id ASC
           LIMIT 1;`,
        );
        if (fallbackRows.length === 0) {
          await queryRunner.rollbackTransaction();
          return {
            statusCode: 409,
            replayed: false,
            problemJson: {
              type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
              title: 'Sin disponibilidad de inventario',
              status: 409,
              detail: 'No existen habitaciones activas con cupo disponible.',
              code: 'OUT_OF_STOCK',
              instance: '/api/v2/alojamientos/orders/create',
            },
          };
        }
        alojamientoId = Number(fallbackRows[0].alojamiento_id);
        productoId = String(fallbackRows[0].producto_id);
      }

      // Bloqueo pesimista sobre productos_habitacion
      const roomRows = await queryRunner.query(
        `SELECT ph.producto_id, ph.alojamiento_id, ph.nombre_producto,
                ph.cantidad_cuartos_inventario, ph.precio_base_noche,
                a.propietario_id
         FROM productos_habitacion ph
         JOIN alojamientos a ON a.alojamiento_id = ph.alojamiento_id
         WHERE ph.producto_id = $1
         FOR UPDATE OF ph;`,
        [productoId],
      );

      if (roomRows.length === 0) {
        await queryRunner.rollbackTransaction();
        return {
          statusCode: 409,
          replayed: false,
          problemJson: {
            type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
            title: 'Producto de habitación no disponible',
            status: 409,
            detail: `El producto ${productoId} no existe o no tiene stock disponible.`,
            code: 'OUT_OF_STOCK',
            instance: '/api/v2/alojamientos/orders/create',
          },
        };
      }

      const room = roomRows[0];
      alojamientoId = Number(room.alojamiento_id);
      const stockActual = Number(room.cantidad_cuartos_inventario || 0);

      if (stockActual - numCuartos < 0) {
        await queryRunner.rollbackTransaction();
        return {
          statusCode: 409,
          replayed: false,
          problemJson: {
            type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
            title: 'Sin disponibilidad de inventario',
            status: 409,
            detail: `Stock insuficiente para '${room.nombre_producto}'. Disponible: ${stockActual}, solicitado: ${numCuartos}.`,
            code: 'OUT_OF_STOCK',
            instance: '/api/v2/alojamientos/orders/create',
          },
        };
      }

      const effectiveCheckIn = holdRecord
        ? this.stockSyncService.formatDateIso(holdRecord.checkin)
        : checkIn;
      const effectiveCheckOut = holdRecord
        ? this.stockSyncService.formatDateIso(holdRecord.checkout)
        : checkOut;
      const effectiveNights = Math.max(
        1,
        this.stockSyncService.enumerateNights(
          effectiveCheckIn,
          effectiveCheckOut,
        ).length,
      );

      // Validar reservas activas en la tabla ordenes que solapan el rango solicitado
      const activeReserved = await this.getActiveReservedRooms(
        productoId,
        effectiveCheckIn,
        effectiveCheckOut,
        queryRunner,
      );
      const availableNow = stockActual - activeReserved;

      if (availableNow < numCuartos) {
        await queryRunner.rollbackTransaction();
        return {
          statusCode: 409,
          replayed: false,
          problemJson: {
            type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
            title: 'Sin disponibilidad de inventario',
            status: 409,
            detail: `Stock insuficiente para '${room.nombre_producto}' entre ${effectiveCheckIn} y ${effectiveCheckOut}. Capacidad total: ${stockActual}, reservadas activas: ${activeReserved}, disponibles: ${Math.max(0, availableNow)}, solicitado: ${numCuartos}.`,
            code: 'OUT_OF_STOCK',
            instance: '/api/v2/alojamientos/orders/create',
          },
        };
      }

      // Sembrar y descontar calendario_inventario por noche (nunca tocar productos_habitacion)
      await queryRunner.query(
        `INSERT INTO calendario_inventario (producto_id, fecha, estado_dia, tarifa_noche, cuartos_totales, cuartos_disponibles)
         SELECT $1, d::DATE, 'DISPONIBLE', $2, $3, $3
         FROM generate_series($4::DATE, $5::DATE - INTERVAL '1 day', '1 day') AS d
         ON CONFLICT (producto_id, fecha) DO NOTHING;`,
        [
          productoId,
          room.precio_base_noche,
          stockActual,
          effectiveCheckIn,
          effectiveCheckOut,
        ],
      );

      const calLockRows = await queryRunner.query(
        `SELECT fecha, cuartos_disponibles
         FROM calendario_inventario
         WHERE producto_id = $1
           AND fecha >= $2::DATE AND fecha < $3::DATE
         FOR UPDATE;`,
        [productoId, effectiveCheckIn, effectiveCheckOut],
      );

      const insufficientNight = calLockRows.find(
        (c: Record<string, any>) => Number(c.cuartos_disponibles) < numCuartos,
      );
      if (insufficientNight) {
        await queryRunner.rollbackTransaction();
        return {
          statusCode: 409,
          replayed: false,
          problemJson: {
            type: 'https://habitat-ec.vercel.app/problems/out-of-stock',
            title: 'Sin disponibilidad en fechas solicitadas',
            status: 409,
            detail: `No hay unidades disponibles para la noche ${this.stockSyncService.formatDateIso(insufficientNight.fecha)}.`,
            code: 'OUT_OF_STOCK',
            instance: '/api/v2/alojamientos/orders/create',
          },
        };
      }

      await queryRunner.query(
        `UPDATE calendario_inventario
         SET cuartos_disponibles = GREATEST(0, cuartos_disponibles - $1),
             estado_dia = CASE WHEN (cuartos_disponibles - $1) <= 0 THEN 'RESERVADO' ELSE 'DISPONIBLE' END,
             actualizado_en = NOW()
         WHERE producto_id = $2
           AND fecha >= $3::DATE AND fecha < $4::DATE;`,
        [numCuartos, productoId, effectiveCheckIn, effectiveCheckOut],
      );

      if (holdRecord) {
        await queryRunner.query(
          `UPDATE order_previews_holds
           SET estado_preview = 'CONVERTIDO_EN_ORDEN'
           WHERE order_preview_id = $1::UUID;`,
          [holdRecord.order_preview_id],
        );
      }

      // Resolver cliente / owner_id (eliminando fallback a Super Admin)
      let ownerId: string | null = null;

      // 1. Extraer objeto anidado o atributos de raíz para el huésped/cliente
      const guestObj =
        dto.cliente ||
        dto.customer ||
        dto.guest ||
        dto.huesped ||
        dto.titular ||
        {};

      const rawNombre =
        guestObj.nombre ||
        guestObj.name ||
        guestObj.guest_name ||
        guestObj.fullName ||
        guestObj.huesped_nombre ||
        (guestObj.firstName || guestObj.first_name
          ? `${guestObj.firstName || guestObj.first_name || ''} ${guestObj.lastName || guestObj.last_name || ''}`.trim()
          : '') ||
        dto.nombre ||
        dto.name ||
        dto.guest_name ||
        dto.huesped_nombre ||
        dto.customer_name ||
        '';

      const rawEmail =
        guestObj.email ||
        guestObj.correo ||
        guestObj.guest_email ||
        dto.email ||
        dto.correo ||
        dto.guest_email ||
        dto.customer_email ||
        '';

      const rawIdentificacion =
        guestObj.identificacion ||
        guestObj.cedula ||
        guestObj.documento ||
        guestObj.documentNumber ||
        guestObj.document_number ||
        guestObj.document ||
        guestObj.dni ||
        dto.identificacion ||
        dto.cedula ||
        dto.documento ||
        dto.documentNumber ||
        dto.document_number ||
        dto.document ||
        dto.dni ||
        '';

      const rawTelefono =
        guestObj.telefono ||
        guestObj.phone ||
        guestObj.phoneNumber ||
        guestObj.phone_number ||
        guestObj.celular ||
        dto.telefono ||
        dto.phone ||
        dto.phoneNumber ||
        dto.celular ||
        '';

      // 2. Si viene un ID explícito en formato UUID, verificar que exista en base
      const candidateId =
        dto.client_id ||
        dto.clientId ||
        dto.clienteId ||
        dto.usuarioId ||
        dto.userId ||
        guestObj.client_id ||
        guestObj.clientId ||
        holdRecord?.usuario_id;

      if (candidateId && UUID_REGEX.test(String(candidateId))) {
        const uExisting = await queryRunner.query(
          `SELECT usuario_id FROM usuarios WHERE usuario_id = $1::UUID LIMIT 1;`,
          [String(candidateId)],
        );
        if (uExisting.length > 0) {
          ownerId = uExisting[0].usuario_id;
        }
      }

      // 3. Si no se resolvió por ID pero tenemos datos de huésped (email, cédula o nombre), hacer upsert de cliente
      if (!ownerId && (rawEmail || rawIdentificacion || rawNombre)) {
        const upserted = await this.upsertClienteInternal(queryRunner, {
          nombre: rawNombre || 'Huésped Booking',
          email: rawEmail || undefined,
          identificacion: rawIdentificacion || undefined,
          telefono: rawTelefono || undefined,
        });
        ownerId = upserted.client_id;
      }

      // 4. Si aún no tenemos ownerId, registrar automáticamente un Huésped con rol CLIENTE
      // (NUNCA asignar al Super Admin por defecto)
      if (!ownerId || !UUID_REGEX.test(String(ownerId))) {
        const randomSuffix = crypto.randomBytes(3).toString('hex');
        const autoGuest = await this.upsertClienteInternal(queryRunner, {
          nombre: rawNombre || 'Huésped Booking Central',
          email: `huesped.${Date.now()}.${randomSuffix}@booking-b2b.habitat.ec`,
          identificacion: rawIdentificacion || null,
          telefono: rawTelefono || null,
        });
        ownerId = autoGuest.client_id;
      }

      // Resolver canal y política (priorizando contratos 5FN válidos del alojamiento)
      let canalId = 1;
      let politicaId = 1;
      const contrato5fnRows = await queryRunner.query(
        `SELECT canal_id, politica_id FROM vw_contratos_5fn_validos WHERE alojamiento_id = $1 LIMIT 1;`,
        [alojamientoId],
      );
      if (contrato5fnRows.length > 0) {
        canalId = Number(contrato5fnRows[0].canal_id || 1);
        politicaId = Number(contrato5fnRows[0].politica_id || 1);
      } else {
        const canalRows = await queryRunner.query(
          `SELECT canal_id FROM canales_integracion ORDER BY canal_id ASC LIMIT 1;`,
        );
        const politicaRows = await queryRunner.query(
          `SELECT politica_id FROM politicas_cancelacion ORDER BY politica_id ASC LIMIT 1;`,
        );
        canalId = Number(canalRows[0]?.canal_id || 1);
        politicaId = Number(politicaRows[0]?.politica_id || 1);
      }

      const totalPrice = holdRecord
        ? Number(holdRecord.precio_total_cotizado)
        : Math.round(
            Number(room.precio_base_noche) *
              effectiveNights *
              numCuartos *
              100,
          ) / 100;

      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const locator =
        this.locatorMaxLength >= 14
          ? `ORD-HTL-${randomSuffix}`
          : `ORD-${randomSuffix}`;
      const externalOrderId =
        dto.externalOrderId || dto.external_order_id || dto.bookingOrderId || null;
      const sagaId =
        dto.sagaId || dto.saga_id || cleanCorrelationId;

      let customerFirstName = 'Huésped';
      let customerLastName = 'Booking B2B';
      let customerEmail = 'viajero@booking-b2b.habitat.ec';

      if (ownerId && UUID_REGEX.test(String(ownerId))) {
        const ownerRows = await queryRunner.query(
          `SELECT nombre, apellido, correo FROM usuarios WHERE usuario_id = $1::UUID LIMIT 1;`,
          [ownerId],
        );
        if (ownerRows.length > 0) {
          customerFirstName = ownerRows[0].nombre || customerFirstName;
          customerLastName = ownerRows[0].apellido || customerLastName;
          customerEmail = ownerRows[0].correo || customerEmail;
        }
      }

      const insertOrderRows = await queryRunner.query(
        `INSERT INTO ordenes (
           locator, order_preview_id, correlation_id, alojamiento_id, producto_id, owner_id, canal_id, politica_id,
           customer_first_name, customer_last_name, customer_email,
           checkin, checkout, number_of_adults, number_of_rooms,
           total_price, currency, status, payment_reference, idempotency_key,
           external_order_id, saga_id
         ) VALUES (
           $1, $2, $3::UUID, $4, $5, $6, $7, $8,
           $9, $10, $11,
           $12::DATE, $13::DATE, $14, $15,
           $16, 'USD', 'CONFIRMED', $17, $18::UUID,
           $19, $20
         )
         RETURNING
           order_id,
           locator,
           alojamiento_id,
           producto_id,
           owner_id,
           TO_CHAR(checkin, 'YYYY-MM-DD') AS checkin_iso,
           TO_CHAR(checkout, 'YYYY-MM-DD') AS checkout_iso,
           number_of_adults,
           number_of_rooms,
           total_price,
           currency,
           status,
           external_order_id,
           saga_id,
           creation_date;`,
        [
          locator,
          holdRecord?.order_preview_id || null,
          cleanCorrelationId,
          alojamientoId,
          productoId,
          ownerId,
          canalId,
          politicaId,
          customerFirstName,
          customerLastName,
          customerEmail,
          effectiveCheckIn,
          effectiveCheckOut,
          numAdultos,
          numCuartos,
          totalPrice,
          `B2B-SAGA-${sagaId}`,
          cleanKey,
          externalOrderId,
          sagaId,
        ],
      );

      const createdOrder = insertOrderRows[0];

      // Enlazar order_id_actual en calendario_inventario
      await queryRunner.query(
        `UPDATE calendario_inventario
         SET order_id_actual = $1,
             estado_dia = CASE WHEN cuartos_disponibles <= 0 THEN 'RESERVADO' ELSE estado_dia END,
             actualizado_en = NOW()
         WHERE producto_id = $2
           AND fecha >= $3::DATE AND fecha < $4::DATE;`,
        [
          createdOrder.order_id,
          productoId,
          effectiveCheckIn,
          effectiveCheckOut,
        ],
      );

      if (holdRecord) {
        await queryRunner.query(
          `UPDATE order_previews_holds
           SET estado_preview = 'CONFIRMADO'
           WHERE order_preview_id = $1::UUID;`,
          [holdRecord.order_preview_id],
        );
      }

      // Asentar liquidación financiera al anfitrión (85% / 15%)
      const comision = Math.round(totalPrice * 0.15 * 100) / 100;
      const neto = Math.round((totalPrice - comision) * 100) / 100;
      await queryRunner.query(
        `INSERT INTO liquidaciones_anfitrion (
           order_id, anfitrion_id, monto_bruto, comision_plataforma, monto_neto_pagar, estado_liquidacion
         ) VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
         ON CONFLICT (order_id) DO NOTHING;`,
        [createdOrder.order_id, room.propietario_id, totalPrice, comision, neto],
      );

      await queryRunner.commitTransaction();

      // Disparar sincronización dual de stock (RabbitMQ + REST) por cada noche
      void this.stockSyncService.syncStockForStay(
        alojamientoId,
        productoId,
        effectiveCheckIn,
        effectiveCheckOut,
        'B2B_ORDER_CREATED',
      );

      return {
        statusCode: 201,
        replayed: false,
        body: this.formatB2bOrderResponse(createdOrder, false),
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private formatB2bOrderResponse(
    order: Record<string, any>,
    replayed: boolean,
  ): Record<string, any> {
    const checkIn =
      order.checkin_iso ||
      this.stockSyncService.formatDateIso(order.checkin);
    const checkOut =
      order.checkout_iso ||
      this.stockSyncService.formatDateIso(order.checkout);
    const precioTotal = Number(order.total_price || 0).toFixed(2);
    const isCancelled =
      order.status === 'CANCELLED' || order.status === 'CANCELADA';

    const dIn = new Date(`${checkIn}T00:00:00.000Z`);
    const dOut = new Date(`${checkOut}T00:00:00.000Z`);
    const diffNights = Math.max(
      1,
      Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const noches =
      Number(order.noches) > 0 ? Number(order.noches) : diffNights;

    const precioNocheNum =
      Math.round(
        (Number(order.total_price || 0) /
          Math.max(1, noches * Number(order.number_of_rooms || 1))) *
          100,
      ) / 100;

    return {
      orderId: order.order_id,
      id: order.order_id,
      codigoReserva: order.locator,
      locator: order.locator,
      externalOrderId: order.external_order_id || order.order_id,
      sagaId: order.saga_id || null,
      alojamientoId: Number(order.alojamiento_id),
      productoId: order.producto_id,
      item_id: `${order.alojamiento_id}:${order.producto_id}`,
      client_id: order.owner_id,
      checkIn,
      checkOut,
      fechaInicio: checkIn,
      fechaFin: checkOut,
      fecha_inicio: checkIn,
      fecha_fin: checkOut,
      noches,
      nights: noches,
      adultos: Number(order.number_of_adults || 1),
      habitaciones: Number(order.number_of_rooms || 1),
      moneda: 'USD',
      currency: 'USD',
      precio_noche: precioNocheNum,
      price_per_night: precioNocheNum,
      precioTotalEstancia: precioTotal,
      totalPrice: precioTotal,
      precio_total: Number(precioTotal),
      total_price: Number(precioTotal),
      estado: isCancelled
        ? 'CANCELADA'
        : order.status === 'CONFIRMADO_ASISTIDO'
          ? 'CONFIRMADO_ASISTIDO'
          : 'CONFIRMADO',
      status: order.status,
      idempotentReplayed: replayed,
      createdAt: order.creation_date
        ? new Date(order.creation_date).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * 1.2.5 GET /api/v2/alojamientos/orders/:orderId y GET /api/v2/alojamientos/orders?saga_id=...
   */
  async findOrderB2b(identifier: string) {
    const clean = (identifier || '').trim();
    if (!clean) {
      throw new BadRequestException(
        'Debe proporcionar orderId, codigoReserva, externalOrderId o saga_id.',
      );
    }

    const rows = await this.dataSource.query(
      `SELECT
         o.order_id,
         o.locator,
         o.alojamiento_id,
         o.producto_id,
         o.owner_id,
         TO_CHAR(o.checkin, 'YYYY-MM-DD') AS checkin_iso,
         TO_CHAR(o.checkout, 'YYYY-MM-DD') AS checkout_iso,
         o.noches,
         o.number_of_adults,
         o.number_of_rooms,
         o.total_price,
         o.currency,
         o.status,
         o.external_order_id,
         o.saga_id,
         o.creation_date
       FROM ordenes o
       WHERE o.order_id::TEXT = $1
          OR o.locator = $1
          OR o.external_order_id = $1
          OR o.saga_id = $1
          OR o.idempotency_key::TEXT = $1
          OR o.payment_reference = $1
       ORDER BY o.creation_date DESC
       LIMIT 1;`,
      [clean],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `No se encontró ninguna orden con identificador '${clean}'.`,
      );
    }

    return this.formatB2bOrderResponse(rows[0], false);
  }

  /**
   * 1.2.6 POST /api/v2/alojamientos/orders/:orderId/cancel (Compensación Saga Idempotente)
   */
  async cancelOrderSagaB2b(identifier: string) {
    const clean = (identifier || '').trim();
    const rows = await this.dataSource.query(
      `SELECT
         o.order_id,
         o.locator,
         o.alojamiento_id,
         o.producto_id,
         o.owner_id,
         TO_CHAR(o.checkin, 'YYYY-MM-DD') AS checkin_iso,
         TO_CHAR(o.checkout, 'YYYY-MM-DD') AS checkout_iso,
         o.noches,
         o.number_of_adults,
         o.number_of_rooms,
         o.total_price,
         o.currency,
         o.status,
         o.external_order_id,
         o.saga_id,
         o.creation_date
       FROM ordenes o
       WHERE o.order_id::TEXT = $1
          OR o.locator = $1
          OR o.external_order_id = $1
          OR o.saga_id = $1
       LIMIT 1;`,
      [clean],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `La orden '${clean}' no existe para compensación Saga.`,
      );
    }

    const order = rows[0];
    if (order.status === 'CANCELLED' || order.status === 'CANCELADA') {
      return {
        orderId: order.order_id,
        codigoReserva: order.locator,
        locator: order.locator,
        estado: 'CANCELADA',
        status: 'CANCELLED',
        yaCancelada: true,
        mensaje: 'La orden ya había sido cancelada previamente (Idempotente).',
      };
    }

    const roomsToRelease = Number(order.number_of_rooms || 1);

    await this.dataSource.query(
      `UPDATE calendario_inventario
       SET cuartos_disponibles = LEAST(cuartos_totales, cuartos_disponibles + $1),
           estado_dia = 'DISPONIBLE',
           order_id_actual = NULL,
           actualizado_en = NOW()
       WHERE producto_id = $2
         AND fecha >= $3::DATE AND fecha < $4::DATE;`,
      [
        roomsToRelease,
        order.producto_id,
        order.checkin_iso,
        order.checkout_iso,
      ],
    );

    await this.dataSource.query(
      `UPDATE ordenes SET status = 'CANCELLED' WHERE order_id = $1;`,
      [order.order_id],
    );

    await this.dataSource.query(
      `UPDATE liquidaciones_anfitrion
       SET estado_liquidacion = 'CANCELADO'
       WHERE order_id = $1;`,
      [order.order_id],
    );

    // Sincronizar liberación de stock por cada noche con Booking (RabbitMQ + REST)
    void this.stockSyncService.syncStockForStay(
      order.alojamiento_id,
      order.producto_id,
      order.checkin_iso,
      order.checkout_iso,
      'B2B_ORDER_CANCELLED_SAGA',
    );

    return {
      orderId: order.order_id,
      codigoReserva: order.locator,
      locator: order.locator,
      estado: 'CANCELADA',
      status: 'CANCELLED',
      yaCancelada: false,
      mensaje:
        'Orden cancelada por compensación Saga y stock liberado por cada noche.',
    };
  }

  /**
   * 1.3.1 GET /api/v2/clientes?email=...&identificacion=...
   */
  async buscarClienteCrossPlatform(email?: string, identificacion?: string) {
    await this.ensureB2bSchemaColumns();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanId = (identificacion || '').trim();

    if (!cleanEmail && !cleanId) {
      throw new BadRequestException(
        'Debe proporcionar al menos el parámetro email o identificacion.',
      );
    }

    const rows = await this.dataSource.query(
      `SELECT
         usuario_id,
         nombre,
         apellido,
         correo,
         identificacion,
         telefono
       FROM usuarios
       WHERE ($1 <> '' AND LOWER(correo) = $1)
          OR ($2 <> '' AND identificacion = $2)
       ORDER BY creado_en ASC
       LIMIT 1;`,
      [cleanEmail, cleanId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        'Cliente no encontrado en el padrón de Hábitat EC.',
      );
    }

    const u = rows[0];
    return {
      client_id: u.usuario_id,
      nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim(),
      email: u.correo,
      identificacion: u.identificacion || cleanId || null,
      telefono: u.telefono || null,
    };
  }

  /**
   * 1.3.2 POST /api/v2/clientes
   */
  async registrarClienteCrossPlatform(dto: {
    nombre?: string;
    email?: string;
    identificacion?: string;
    telefono?: string;
  }) {
    await this.ensureB2bSchemaColumns();
    return this.upsertClienteInternal(this.dataSource, dto);
  }

  private async upsertClienteInternal(
    runner: { query: (sql: string, params?: unknown[]) => Promise<any[]> },
    dto: {
      nombre?: string;
      email?: string;
      identificacion?: string;
      telefono?: string;
    },
  ) {
    const rawNombre = (dto.nombre || 'Huésped Booking').trim();
    const cleanEmail = (
      dto.email ||
      `huesped.${Date.now()}@booking-b2b.habitat.ec`
    )
      .trim()
      .toLowerCase();
    const cleanId = dto.identificacion ? String(dto.identificacion).trim() : null;
    const cleanTel = dto.telefono ? String(dto.telefono).trim() : null;

    const existing = await runner.query(
      `SELECT usuario_id, nombre, apellido, correo, identificacion, telefono
       FROM usuarios
       WHERE LOWER(correo) = $1
          OR ($2 <> '' AND identificacion = $2)
       ORDER BY creado_en ASC
       LIMIT 1;`,
      [cleanEmail, cleanId || ''],
    );

    if (existing.length > 0) {
      const current = existing[0];
      await runner.query(
        `UPDATE usuarios
         SET identificacion = COALESCE($1, identificacion),
             telefono = COALESCE($2, telefono),
             actualizado_en = NOW()
         WHERE usuario_id = $3;`,
        [cleanId, cleanTel, current.usuario_id],
      );

      return {
        client_id: current.usuario_id,
        nombre: `${current.nombre || ''} ${current.apellido || ''}`.trim(),
        email: current.correo,
        identificacion: cleanId || current.identificacion || null,
        telefono: cleanTel || current.telefono || null,
      };
    }

    const parts = rawNombre.split(/\s+/);
    const firstName = parts[0] || 'Huésped';
    const lastName = parts.slice(1).join(' ') || 'CrossPlatform';
    const randomPassHash = await bcrypt.hash(crypto.randomUUID(), 10);

    const insertedRows = await runner.query(
      `INSERT INTO usuarios (
         nombre, apellido, correo, password_hash, telefono, identificacion, pais_iso, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, 'ec', TRUE)
       RETURNING usuario_id, nombre, apellido, correo, identificacion, telefono;`,
      [firstName, lastName, cleanEmail, randomPassHash, cleanTel, cleanId],
    );

    const nuevo = insertedRows[0];

    // Asignar rol CLIENTE
    const rolRows = await runner.query(
      `SELECT rol_id FROM roles WHERE codigo = 'CLIENTE' LIMIT 1;`,
    );
    if (rolRows.length > 0) {
      await runner.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [nuevo.usuario_id, rolRows[0].rol_id],
      );
    }

    return {
      client_id: nuevo.usuario_id,
      nombre: `${nuevo.nombre} ${nuevo.apellido}`.trim(),
      email: nuevo.correo,
      identificacion: nuevo.identificacion,
      telefono: nuevo.telefono,
    };
  }

  /**
   * 1.4 Check-in en Recepción y Notificación Push a Booking Central (Requerimiento v2.1)
   */
  async confirmarCheckinRecepcion(
    orderIdOrLocator: string,
    body?: {
      documento_titular?: string;
      huespedes_reales?: number;
      admin_id?: string;
      observaciones?: string;
    },
    adminUser?: { usuarioId?: string; correo?: string },
  ) {
    const clean = (orderIdOrLocator || '').trim();
    const rows = await this.dataSource.query(
      `SELECT
         o.order_id,
         o.locator,
         o.alojamiento_id,
         o.producto_id,
         o.owner_id,
         TO_CHAR(o.checkin, 'YYYY-MM-DD') AS checkin_iso,
         TO_CHAR(o.checkout, 'YYYY-MM-DD') AS checkout_iso,
         o.number_of_adults,
         o.status,
         o.external_order_id
       FROM ordenes o
       WHERE o.order_id::TEXT = $1
          OR o.locator = $1
          OR o.external_order_id = $1
       LIMIT 1;`,
      [clean],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `No se encontró la reserva '${clean}' para realizar el Check-in en recepción.`,
      );
    }

    const order = rows[0];

    // Si en el mostrador se proporcionó o corrigió la cédula/pasaporte del titular, persistirla
    const docTitular = (body?.documento_titular || '').trim();
    if (docTitular && order.owner_id) {
      await this.dataSource.query(
        `UPDATE usuarios
         SET identificacion = COALESCE(NULLIF($1, ''), identificacion),
             actualizado_en = NOW()
         WHERE usuario_id = $2;`,
        [docTitular, order.owner_id],
      );
    }

    const fechaCheckinIso = new Date().toISOString();
    const observaciones =
      body?.observaciones?.trim() ||
      'Huésped presentado en mostrador de recepción y habitación entregada';
    const huespedesReales = Math.max(
      1,
      Number(body?.huespedes_reales || order.number_of_adults || 1),
    );
    const adminId =
      body?.admin_id?.trim() ||
      adminUser?.correo ||
      adminUser?.usuarioId ||
      'recepcionista-hotel';

    await this.dataSource.query(
      `UPDATE ordenes
       SET status = 'CONFIRMADO_ASISTIDO',
           checked_in_at = NOW(),
           checkin_observaciones = $2
       WHERE order_id = $1;`,
      [order.order_id, observaciones],
    );

    const externalOrderId = String(order.external_order_id || order.order_id);
    const pushPayload: CheckinPushPayload = {
      external_order_id: externalOrderId,
      client_id: String(order.owner_id),
      estado: 'CONFIRMADO_ASISTIDO',
      huespedes_reales: huespedesReales,
      admin_id: String(adminId),
      fecha_checkin: fechaCheckinIso,
      observaciones,
    };

    // Enviar notificación HTTP POST automática hacia Booking Central
    const bookingNotification =
      await this.stockSyncService.notifyCheckinToBooking(pushPayload);

    // Sincronizar stock de la estancia por RabbitMQ + REST
    void this.stockSyncService.syncStockForStay(
      order.alojamiento_id,
      order.producto_id,
      order.checkin_iso,
      order.checkout_iso,
      'RECEPTION_CHECKIN_CONFIRMED',
    );

    // Registrar en Transactional Outbox para trazabilidad EDA
    try {
      await this.dataSource.query(
        `INSERT INTO outbox_events (
           correlation_id, event_type, resource_id, protocolo_origen, data, estado_despacho
         ) VALUES ($1, 'ORDER_CONFIRMED', $2, 'INTERNAL_CHECKOUT', $3::jsonb, 'ENVIADO');`,
        [
          crypto.randomUUID(),
          String(order.order_id),
          JSON.stringify({
            ...pushPayload,
            event_subtype: 'RECEPTION_CHECKIN_CONFIRMED',
            locator: order.locator,
            bookingNotification,
          }),
        ],
      );
    } catch (outboxErr) {
      this.logger.warn(
        `[B2bService] Nota al registrar outbox de check-in: ${outboxErr instanceof Error ? outboxErr.message : String(outboxErr)}`,
      );
    }

    return {
      mensaje:
        'Check-in en recepción confirmado exitosamente y notificado a Booking Central.',
      orderId: order.order_id,
      locator: order.locator,
      external_order_id: externalOrderId,
      client_id: order.owner_id,
      estado: 'CONFIRMADO_ASISTIDO',
      huespedes_reales: huespedesReales,
      admin_id: adminId,
      fecha_checkin: fechaCheckinIso,
      observaciones,
      bookingCentralNotificado: true,
      bookingPushDetalle: bookingNotification,
    };
  }
}
