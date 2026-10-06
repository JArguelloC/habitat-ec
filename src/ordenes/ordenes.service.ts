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
    const alojamiento = await this.alojamientoRepo.findOne({ where: { id: dto.accommodation_id } });
    if (!alojamiento) throw new NotFoundException('Alojamiento no encontrado');

    const total = alojamiento.precioPorNoche; // Simulación de cálculo
    const cotizacion = this.cotizacionRepo.create({
      idAlojamiento: alojamiento.id,
      idProducto: dto.product_id,
      precioTotal: total,
      moneda: alojamiento.moneda,
      detalleHuespedes: dto.guests,
      expiraEn: new Date(Date.now() + 15 * 60000), // expira en 15 min
    });
    const saved = await this.cotizacionRepo.save(cotizacion);

    return {
      request_id: `req-${randomUUID()}`,
      data: {
        order_preview_id: saved.id,
        total_price: saved.precioTotal,
        currency: saved.moneda,
      },
    };
  }

  async create(idempotencyKey: string, dto: OrderCreateRequestDto) {
    const existing = await this.reservaRepo.findOne({ where: { claveIdempotencia: idempotencyKey } });
    if (existing) return this.buildResponse(existing);

    const cotizacion = await this.cotizacionRepo.findOne({ where: { id: dto.order_preview_id } });
    if (!cotizacion) throw new NotFoundException('Cotización no encontrada');

    const reserva = this.reservaRepo.create({
      localizador: `PNR-${randomUUID().substring(0, 6).toUpperCase()}`,
      estado: 'CONFIRMED',
      claveIdempotencia: idempotencyKey,
      referenciaPago: dto.payment_reference,
      nombreCliente: dto.customer_details.first_name,
      apellidoCliente: dto.customer_details.last_name,
      correoCliente: dto.customer_details.email,
      paisComprador: dto.customer_details.country,
      plataformaComprador: dto.customer_details.platform,
      fechaEntrada: new Date().toISOString().split('T')[0],
      fechaSalida: new Date(Date.now() + 86400000).toISOString().split('T')[0],
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
