#!/usr/bin/env node
/**
 * Script de Auditoría E2E de Contrato B2B Booking Central (v2.1 y v2.2)
 * Nodo: NODE_ALO_HAB (Hábitat EC)
 *
 * Uso:
 *   node scripts/verify-e2e-booking.js
 *   BASE_URL="https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net" node scripts/verify-e2e-booking.js
 */
import crypto from 'node:crypto';

const BASE_URL = (
  process.env.BASE_URL ||
  'https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net'
).replace(/\/+$/, '');

const API_KEY =
  process.env.API_KEY || 'hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

const headersB2b = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

async function runAudit() {
  console.log(`\n=============================================================`);
  console.log(`🚀 AUDITORÍA E2E CONTRATO B2B BOOKING (NODE_ALO_HAB)`);
  console.log(`🌐 Destino: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // 1. Healthcheck (< 1000ms, Público)
  const t0 = Date.now();
  const healthRes = await fetch(`${BASE_URL}/api/v2/alojamientos/health`);
  const healthLatency = Date.now() - t0;
  const healthBody = await healthRes.json();
  console.log(
    `1️⃣  [GET /api/v2/alojamientos/health] HTTP ${healthRes.status} (${healthLatency}ms) -> Semaforo: ${healthBody.semaforo}, Nodo: ${healthBody.nodo_id}`,
  );

  // 2. Catálogo B2B
  const catRes = await fetch(`${BASE_URL}/api/v2/alojamientos`, {
    headers: headersB2b,
  });
  const catBody = await catRes.json();
  console.log(
    `2️⃣  [GET /api/v2/alojamientos] HTTP ${catRes.status} -> Total publicados: ${catBody.total}`,
  );

  // 3. Search B2B
  const searchRes = await fetch(`${BASE_URL}/api/v2/alojamientos/search`, {
    method: 'POST',
    headers: headersB2b,
    body: JSON.stringify({
      checkIn: '2026-12-10',
      checkOut: '2026-12-14',
      adultos: 2,
      habitaciones: 1,
    }),
  });
  const searchBody = await searchRes.json();
  const sampleItem = searchBody.items?.[0];
  console.log(
    `3️⃣  [POST /api/v2/alojamientos/search] HTTP ${searchRes.status} -> Ejemplo: ${sampleItem?.titulo || 'N/A'} | precioTotalEstancia: ${sampleItem?.precioTotalEstancia} ${searchBody.moneda}`,
  );

  // 4. Availability (Congelamiento 30 min)
  const availRes = await fetch(`${BASE_URL}/api/v2/alojamientos/availability`, {
    method: 'POST',
    headers: {
      ...headersB2b,
      'X-Correlation-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({
      alojamientoId: sampleItem?.alojamientoId,
      productoId: sampleItem?.productoId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-14',
      adultos: 2,
      habitaciones: 1,
    }),
  });
  const availBody = await availRes.json();
  console.log(
    `4️⃣  [POST /api/v2/alojamientos/availability] HTTP ${availRes.status} -> cotizacionId: ${availBody.cotizacionId} | tarifaValidaHasta: ${availBody.tarifaValidaHasta}`,
  );

  // 5. Registro y Consulta Cross-Platform de Clientes (/api/v2/clientes)
  const testEmail = `viajero.b2b.${Date.now()}@booking.ec`;
  const testCedula = `17${String(Date.now()).slice(-8)}`;
  const cliCreateRes = await fetch(`${BASE_URL}/api/v2/clientes`, {
    method: 'POST',
    headers: headersB2b,
    body: JSON.stringify({
      nombre: 'Elena Viteri B2B',
      email: testEmail,
      identificacion: testCedula,
      telefono: '+593991122334',
    }),
  });
  const cliCreateBody = await cliCreateRes.json();
  const cliGetRes = await fetch(
    `${BASE_URL}/api/v2/clientes?identificacion=${encodeURIComponent(testCedula)}`,
    { headers: headersB2b },
  );
  const cliGetBody = await cliGetRes.json();
  console.log(
    `5️⃣  [POST & GET /api/v2/clientes] HTTP ${cliCreateRes.status}/${cliGetRes.status} -> client_id: ${cliGetBody.client_id} (${cliGetBody.nombre})`,
  );

  // 6. Orders Create (Saga Idempotente + Replay)
  const idemKey = crypto.randomUUID();
  const corrId = crypto.randomUUID();
  const orderCreateRes = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/create`,
    {
      method: 'POST',
      headers: {
        ...headersB2b,
        'Idempotency-Key': idemKey,
        'X-Correlation-ID': corrId,
      },
      body: JSON.stringify({
        cotizacionId: availBody.cotizacionId,
        client_id: cliCreateBody.client_id,
        externalOrderId: `BKG-EXT-${Date.now()}`,
        sagaId: corrId,
      }),
    },
  );
  const orderCreateBody = await orderCreateRes.json();

  // Replay con la misma Idempotency-Key
  const orderReplayRes = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/create`,
    {
      method: 'POST',
      headers: {
        ...headersB2b,
        'Idempotency-Key': idemKey,
        'X-Correlation-ID': corrId,
      },
      body: JSON.stringify({
        cotizacionId: availBody.cotizacionId,
      }),
    },
  );
  console.log(
    `6️⃣  [POST /api/v2/alojamientos/orders/create + Replay] HTTP ${orderCreateRes.status} -> locator: ${orderCreateBody.codigoReserva} | Replay header Idempotent-Replayed: ${orderReplayRes.headers.get('idempotent-replayed')}`,
  );

  // 7. Error 409 OUT_OF_STOCK (application/problem+json)
  const outOfStockRes = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/create`,
    {
      method: 'POST',
      headers: {
        ...headersB2b,
        'Idempotency-Key': crypto.randomUUID(),
        'X-Correlation-ID': crypto.randomUUID(),
      },
      body: JSON.stringify({
        alojamientoId: sampleItem?.alojamientoId,
        productoId: sampleItem?.productoId,
        habitaciones: 999,
      }),
    },
  );
  const outOfStockBody = await outOfStockRes.json();
  console.log(
    `7️⃣  [409 OUT_OF_STOCK] HTTP ${outOfStockRes.status} (${outOfStockRes.headers.get('content-type')}) -> code: ${outOfStockBody.code}`,
  );

  // 8. Check-in Asistido en Recepción + Push a Booking Central
  const checkinRes = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/${orderCreateBody.orderId}/checkin`,
    {
      method: 'POST',
      headers: headersB2b,
      body: JSON.stringify({
        huespedes_reales: 2,
        admin_id: 'recepcionista-hotel',
        observaciones:
          'Huésped presentado en mostrador de recepción y habitación entregada',
      }),
    },
  );
  const checkinBody = await checkinRes.json();
  console.log(
    `8️⃣  [POST /checkin] HTTP ${checkinRes.status} -> estado: ${checkinBody.estado}`,
  );

  // 9. Cancelación Saga Idempotente (1ra vez libera stock, 2da vez yaCancelada: true)
  const cancelRes1 = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/${orderCreateBody.orderId}/cancel`,
    {
      method: 'POST',
      headers: headersB2b,
    },
  );
  const cancelBody1 = await cancelRes1.json();
  const cancelRes2 = await fetch(
    `${BASE_URL}/api/v2/alojamientos/orders/${orderCreateBody.orderId}/cancel`,
    {
      method: 'POST',
      headers: headersB2b,
    },
  );
  const cancelBody2 = await cancelRes2.json();
  console.log(
    `9️⃣  [POST /cancel Saga Idempotente] HTTP ${cancelRes1.status}/${cancelRes2.status} -> 1ra: yaCancelada=${cancelBody1.yaCancelada}, 2da: yaCancelada=${cancelBody2.yaCancelada}\n`,
  );
}

runAudit().catch((err) => {
  console.error('❌ Error en auditoría E2E:', err);
  process.exit(1);
});

