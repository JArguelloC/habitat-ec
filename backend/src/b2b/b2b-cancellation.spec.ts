import { describe, it, expect, vi, beforeEach } from 'vitest';
import { B2bService } from './b2b.service.js';
import { DataSource } from 'typeorm';
import { BookingStockSyncService } from './booking-stock-sync.service.js';

describe('B2B Order Cancellation & Housekeeping Unit Tests', () => {
  let b2bService: B2bService;
  let mockDataSource: { query: ReturnType<typeof vi.fn> };
  let mockStockSyncService: {
    syncStockForStay: ReturnType<typeof vi.fn>;
    notifyCheckinToBooking: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDataSource = {
      query: vi.fn(),
    };
    mockStockSyncService = {
      syncStockForStay: vi.fn(),
      notifyCheckinToBooking: vi.fn(),
    };

    b2bService = new B2bService(
      mockDataSource as unknown as DataSource,
      mockStockSyncService as unknown as BookingStockSyncService,
    );
    (b2bService as any).schemaReady = true;
  });

  it('1. Debe devolver 404 NOT_FOUND en formato RFC 7807 si la orden no existe', async () => {
    mockDataSource.query.mockResolvedValue([]);

    const result = await b2bService.cancelOrderSagaB2b('NON_EXISTENT_ORDER');

    expect(result.statusCode).toBe(404);
    expect(result.problemJson).toBeDefined();
    expect(result.problemJson?.code).toBe('NOT_FOUND');
    expect(result.problemJson?.status).toBe(404);
    expect(result.problemJson?.type).toContain('errors/not-found');
  });

  it('2. Debe devolver 409 Conflict con code INVALID_STATE_TRANSITION si la orden está en CHECKED_IN', async () => {
    mockDataSource.query.mockResolvedValueOnce([
      {
        order_id: '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
        locator: 'BK-HOTEL-9912',
        status: 'CHECKED_IN',
        total_price: '120.00',
        external_order_id: 'ORD-HTL-8842',
      },
    ]);

    const result = await b2bService.cancelOrderSagaB2b('7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876');

    expect(result.statusCode).toBe(409);
    expect(result.problemJson).toBeDefined();
    expect(result.problemJson?.code).toBe('INVALID_STATE_TRANSITION');
    expect(result.problemJson?.status).toBe(409);
    expect(result.problemJson?.detail).toContain('CHECKED_IN');
  });

  it('3. Debe procesar cancelación válida con reembolso 100%, código regex y montos decimales exactos', async () => {
    const futureCheckin = '2027-01-10';
    const futureCheckout = '2027-01-12';

    mockDataSource.query
      .mockResolvedValueOnce([
        {
          order_id: '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
          locator: 'BK-HOTEL-9912',
          alojamiento_id: 1,
          producto_id: 'PROD-01',
          owner_id: 'usr-1',
          checkin_iso: futureCheckin,
          checkout_iso: futureCheckout,
          noches: 2,
          number_of_rooms: 1,
          total_price: '120.00',
          currency: 'USD',
          status: 'CONFIRMED',
          external_order_id: 'ORD-HTL-8842',
          codigo_reembolso: null,
        },
      ]) // SELECT ordenes
      .mockResolvedValueOnce([]) // UPDATE calendario_inventario
      .mockResolvedValueOnce([]) // UPDATE ordenes
      .mockResolvedValueOnce([]); // UPDATE liquidaciones_anfitrion

    const result = await b2bService.cancelOrderSagaB2b(
      'ORD-HTL-8842',
      { motivo: 'Cancelación solicitada por cliente', solicitadoPor: 'CLIENTE' },
    );

    expect(result.statusCode).toBe(200);
    expect(result.replayed).toBe(false);
    expect(result.body.orderId).toBe('7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876');
    expect(result.body.external_order_id).toBe('ORD-HTL-8842');
    expect(result.body.estado).toBe('CANCELLED');
    expect(result.body.refundStatus).toBe('REFUNDED');
    expect(result.body.porcentajeReembolso).toBe(100);
    expect(result.body.montoReembolsado).toBe('120.00');
    expect(result.body.penalidad).toBe('0.00');
    expect(result.body.cuposRestaurados).toBe(true);
    expect(result.body.yaCancelada).toBe(false);
    expect(result.body.codigoReembolso).toMatch(/^REF-HTL-[0-9]{5,10}$/);
  });

  it('4. Debe soportar Idempotencia estricta en reintentos devolviendo el mismo código de reembolso', async () => {
    mockDataSource.query.mockResolvedValueOnce([
      {
        order_id: '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
        locator: 'BK-HOTEL-9912',
        status: 'CANCELLED',
        total_price: '120.00',
        external_order_id: 'ORD-HTL-8842',
        codigo_reembolso: 'REF-HTL-77491',
        refund_status: 'REFUNDED',
        porcentaje_reembolso: 100,
        monto_reembolsado: '120.00',
        penalidad_cancelacion: '0.00',
        cancelled_at: new Date('2026-11-11T12:00:00Z'),
      },
    ]);

    const result = await b2bService.cancelOrderSagaB2b('BK-HOTEL-9912');

    expect(result.statusCode).toBe(200);
    expect(result.replayed).toBe(true);
    expect(result.body.yaCancelada).toBe(true);
    expect(result.body.codigoReembolso).toBe('REF-HTL-77491');
    expect(result.body.montoReembolsado).toBe('120.00');
    expect(result.body.penalidad).toBe('0.00');
  });

  it('5. Debe otorgar compensación 100% cuando solicitadoPor es SAGA_ORCHESTRATOR', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          order_id: '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
          locator: 'BK-HOTEL-9912',
          alojamiento_id: 1,
          producto_id: 'PROD-01',
          owner_id: 'usr-1',
          checkin_iso: '2026-11-11', // Mismo día
          checkout_iso: '2026-11-12',
          noches: 1,
          number_of_rooms: 1,
          total_price: '85.50',
          currency: 'USD',
          status: 'CONFIRMED',
          external_order_id: 'ORD-HTL-8842',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await b2bService.cancelOrderSagaB2b(
      '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
      { motivo: 'Fallo compensación vuelo', solicitadoPor: 'SAGA_ORCHESTRATOR' },
    );

    expect(result.statusCode).toBe(200);
    expect(result.body.refundStatus).toBe('COMPENSATED');
    expect(result.body.porcentajeReembolso).toBe(100);
    expect(result.body.montoReembolsado).toBe('85.50');
    expect(result.body.penalidad).toBe('0.00');
  });

  it('6. Debe realizar check-out en recepción y transicionar la habitación a EN_LIMPIEZA', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          order_id: '7b8be3ab-bfa1-476a-a2ab-5fbcd8e2d876',
          locator: 'BK-HOTEL-9912',
          alojamiento_id: 1,
          producto_id: 'PROD-01',
          checkin_iso: '2026-11-10',
          checkout_iso: '2026-11-11',
          status: 'CONFIRMADO_ASISTIDO',
          external_order_id: 'ORD-HTL-8842',
        },
      ]) // SELECT orden
      .mockResolvedValueOnce([]) // UPDATE ordenes -> CHECKED_OUT
      .mockResolvedValueOnce([]); // UPDATE productos_habitacion -> EN_LIMPIEZA

    const result = await b2bService.confirmarCheckoutRecepcion('BK-HOTEL-9912', {
      observaciones: 'Huésped se retira a las 11:00 am',
    });

    expect(result.status).toBe('CHECKED_OUT');
    expect(result.estadoLimpieza).toBe('EN_LIMPIEZA');
    expect(result.productoId).toBe('PROD-01');
    expect(mockStockSyncService.syncStockForStay).toHaveBeenCalled();
  });
});
