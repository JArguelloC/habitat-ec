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

  it('7. Debe reflejar bookingCentralNotificado=false y estado PENDIENTE en outbox cuando Booking rechaza el check-in', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          order_id: 'ccad6434-1d85-4a29-a6ee-9bdc3701cf00',
          locator: 'BK-313359',
          alojamiento_id: 33,
          producto_id: 'PROD-33-8722',
          owner_id: '0e2ac999-01fe-40c0-ab32-4044a9c0b5d6',
          checkin_iso: '2026-11-15',
          checkout_iso: '2026-11-17',
          number_of_adults: 2,
          status: 'CONFIRMED',
          external_order_id: 'BK-313359',
        },
      ]) // SELECT orden
      .mockResolvedValueOnce([]) // UPDATE usuarios
      .mockResolvedValueOnce([]) // UPDATE ordenes -> CONFIRMADO_ASISTIDO
      .mockResolvedValueOnce([]); // INSERT outbox_events

    mockStockSyncService.notifyCheckinToBooking.mockResolvedValueOnce({
      notified: false,
      statusCode: 401,
      endpoint: 'https://booking-core-api.azurewebsites.net/api/v3/reservas/BK-313359/checkin',
      responseBody: { error: 'Unauthorized' },
    });

    const result = await b2bService.confirmarCheckinRecepcion('BK-313359', {
      documento_titular: '1600222176',
      huespedes_reales: 2,
      observaciones: 'Huésped presentado en mostrador',
    });

    expect(result.bookingCentralNotificado).toBe(false);
    expect(result.bookingPushDetalle.statusCode).toBe(401);
    const outboxCall = mockDataSource.query.mock.calls[3];
    expect(outboxCall[1][3]).toBe('PENDIENTE');
  });

  it('8. notifyCheckinToBooking debe enviar estrictamente los 4 campos del contrato y hacer fallback v3 -> notificar-checkin -> v2', async () => {
    const mockConfigService = { get: vi.fn().mockReturnValue(undefined) } as any;
    const syncService = new BookingStockSyncService(
      mockConfigService,
      mockDataSource as unknown as DataSource,
    );

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    try {
      const res = await syncService.notifyCheckinToBooking({
        external_order_id: 'BK-313359',
        locator: 'BK-313359',
        status: 'CONFIRMADO_ASISTIDO',
        checked_in_at: '2026-11-14T01:12:52.100Z',
        observaciones: 'Huésped presentado en mostrador',
      });

      expect(res.notified).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toContain('/api/v3/reservas/BK-313359/checkin');
      expect(fetchSpy.mock.calls[1][0]).toContain('/api/v3/reservas/notificar-checkin');

      const sentBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(Object.keys(sentBody).sort()).toEqual([
        'checked_in_at',
        'external_order_id',
        'observaciones',
        'status',
      ]);
      expect(sentBody).toEqual({
        external_order_id: 'BK-313359',
        status: 'CONFIRMADO_ASISTIDO',
        checked_in_at: '2026-11-14T01:12:52.100Z',
        observaciones: 'Huésped presentado en mostrador',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
