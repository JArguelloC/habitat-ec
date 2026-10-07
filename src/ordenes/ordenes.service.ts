import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Reserva } from './entities/reserva.entity.js';
import { CotizacionPrevia } from './entities/cotizacion-previa.entity.js';
import { Alojamiento } from '../alojamientos/entities/alojamiento.entity.js';
import { OrderPreviewRequestDto, OrderCreateRequestDto } from './dto/ordenes.dto.js';

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(CotizacionPrevia)
    private readonly cotizacionRepo: Repository<CotizacionPrevia>,
    @InjectRepository(Alojamiento)
    private readonly alojamientoRepo: Repository<Alojamiento>,
  ) {}

  async preview(dto: OrderPreviewRequestDto) {
    const accId = dto.alojamientoId ?? dto.accommodation_id;
    const alojamiento = await this.alojamientoRepo.findOne({ where: { id: accId } });
    if (!alojamiento) throw new NotFoundException('Alojamiento no encontrado');

    const total = alojamiento.precioPorNoche; // Simulación de cálculo
    const guests = dto.guests ?? (dto.huespedes ? { number_of_adults: dto.huespedes } : { number_of_adults: 2 });
    const cotizacion = this.cotizacionRepo.create({
      idAlojamiento: alojamiento.id,
      idProducto: dto.product_id ?? `HAB-${alojamiento.id}`,
      precioTotal: total,
      moneda: alojamiento.moneda,
      detalleHuespedes: guests,
      expiraEn: new Date(Date.now() + 15 * 60000), // expira en 15 min
    });
    const saved = await this.cotizacionRepo.save(cotizacion);

    return {
      request_id: `req-${randomUUID()}`,
      data: {
        order_preview_id: saved.id,
        cotizacionId: saved.id,
        total_price: saved.precioTotal,
        currency: saved.moneda,
      },
    };
  }

  async create(idempotencyKey: string, dto: OrderCreateRequestDto) {
    const existing = await this.reservaRepo.findOne({ where: { claveIdempotencia: idempotencyKey } });
    if (existing) return this.buildResponse(existing);

    const previewId = dto.cotizacionId ?? dto.order_preview_id;
    const cotizacion = await this.cotizacionRepo.findOne({ where: { id: previewId } });
    if (!cotizacion) throw new NotFoundException('Cotización no encontrada');

    const customer = dto.cliente ?? dto.customer_details;
    const reserva = this.reservaRepo.create({
      localizador: `PNR-${randomUUID().substring(0, 6).toUpperCase()}`,
      estado: 'CONFIRMED',
      claveIdempotencia: idempotencyKey,
      referenciaPago: dto.referenciaPago ?? dto.payment_reference ?? `PAY-${Date.now()}`,
      nombreCliente: customer?.nombre ?? customer?.first_name ?? '',
      apellidoCliente: customer?.apellido ?? customer?.last_name ?? '',
      correoCliente: customer?.correo ?? customer?.email ?? '',
      paisComprador: customer?.country ?? 'EC',
      plataformaComprador: customer?.platform ?? 'DESKTOP',
      fechaEntrada: dto.checkin ?? new Date().toISOString().split('T')[0],
      fechaSalida: dto.checkout ?? new Date(Date.now() + 86400000).toISOString().split('T')[0],
      montoTotal: cotizacion.precioTotal,
      moneda: cotizacion.moneda,
      idAlojamiento: cotizacion.idAlojamiento,
    });

    const saved = await this.reservaRepo.save(reserva);
    return this.buildResponse(saved);
  }

  async findOne(orderId: string) {
    const reserva = await this.reservaRepo.findOne({ where: { id: orderId } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return this.buildResponse(reserva);
  }

  async cancel(orderId: string, idempotencyKey: string) {
    const reserva = await this.reservaRepo.findOne({ where: { id: orderId } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    reserva.estado = 'CANCELLED';
    await this.reservaRepo.save(reserva);

    return { description: 'Cancelación procesada' };
  }

  private buildResponse(reserva: Reserva) {
    return {
      ...reserva,
      _links: {
        self: { href: `/orders/${reserva.id}`, rel: 'self', method: 'GET' },
        modify: { href: `/orders/${reserva.id}`, rel: 'update', method: 'PUT' },
        cancel: { href: `/orders/${reserva.id}/cancel`, rel: 'cancel', method: 'POST' },
      },
    };
  }
}
