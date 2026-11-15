#!/usr/bin/env node
/**
 * Suite Automatizada de QA (Individuales, Integracion y E2E) con Coeficiente Kappa de Cohen.
 *
 * Regla estricta: NO modifica ni crea archivos dentro de `backend/` ni `frontend/`.
 * Uso:
 *   node scripts/run-qa-kappa.mjs
 *   BASE_URL=http://localhost:3000 node scripts/run-qa-kappa.mjs
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const REPORT_PATH = path.join(ROOT_DIR, 'docs', 'Reporte_Pruebas_Kappa.md');

const BASE_URL = (
  process.env.BASE_URL ||
  'https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net'
).replace(/\/+$/, '');

const API_KEY =
  process.env.API_KEY || 'hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

const headersB2b = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function addDaysIso(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url, options = {}) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(20000),
    });
    const rawText = await res.text();
    let body = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = { rawText: rawText.slice(0, 300) };
    }
    return {
      ok: true,
      status: res.status,
      headers: res.headers,
      body,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      body: { error: err?.message || String(err) },
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Calcula matriz de confusion binaria (ACCEPT vs REJECT) y Coeficiente Kappa de Cohen.
 */
function computeKappaMetrics(results) {
  let tp = 0; // Esperado ACCEPT, Real ACCEPT
  let tn = 0; // Esperado REJECT, Real REJECT
  let fp = 0; // Esperado REJECT, Real ACCEPT
  let fn = 0; // Esperado ACCEPT, Real REJECT

  for (const r of results) {
    if (r.expected === 'ACCEPT' && r.actual === 'ACCEPT') tp += 1;
    else if (r.expected === 'REJECT' && r.actual === 'REJECT') tn += 1;
    else if (r.expected === 'REJECT' && r.actual === 'ACCEPT') fp += 1;
    else if (r.expected === 'ACCEPT' && r.actual === 'REJECT') fn += 1;
  }

  const n = results.length;
  if (n === 0) {
    return {
      n: 0,
      tp: 0,
      tn: 0,
      fp: 0,
      fn: 0,
      po: 0,
      pe: 0,
      kappa: 0,
      verdict: 'Sin casos evaluados',
    };
  }

  const po = (tp + tn) / n;
  const expAccept = tp + fn;
  const actAccept = tp + fp;
  const expReject = fp + tn;
  const actReject = fn + tn;
  const pe = (expAccept * actAccept + expReject * actReject) / (n * n);

  const kappa = pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);

  return {
    n,
    tp,
    tn,
    fp,
    fn,
    po,
    pe,
    kappa,
    verdict: interpretLandisKoch(Number(kappa.toFixed(4))),
  };
}

function interpretLandisKoch(k) {
  if (k < 0) return 'Sin acuerdo (< 0.00)';
  if (k <= 0.2) return 'Acuerdo leve (0.00 - 0.20)';
  if (k <= 0.4) return 'Acuerdo aceptable (0.21 - 0.40)';
  if (k <= 0.6) return 'Acuerdo moderado (0.41 - 0.60)';
  if (k <= 0.8) return 'Acuerdo sustancial (0.61 - 0.80)';
  return 'Acuerdo casi perfecto (0.81 - 1.00)';
}

function recordCase(list, { id, layer, name, expected, passed, detail, latencyMs }) {
  // Si esperabamos ACCEPT y paso -> actual ACCEPT (TP)
  // Si esperabamos REJECT y paso -> el sistema rechazo correctamente -> actual REJECT (TN)
  // Si esperabamos ACCEPT y fallo -> actual REJECT (FN)
  // Si esperabamos REJECT y fallo -> el sistema no rechazo como debia -> actual ACCEPT (FP)
  const actual = expected === 'ACCEPT' ? (passed ? 'ACCEPT' : 'REJECT') : (passed ? 'REJECT' : 'ACCEPT');
  list.push({
    id,
    layer,
    name,
    expected,
    actual,
    passed,
    detail,
    latencyMs: latencyMs ?? 0,
  });
}

/**
 * CAPA 1: Pruebas Individuales (Vitest en backend/ escribiendo JSON en os.tmpdir()).
 */
function runUnitLayer() {
  const results = [];
  const tmpJson = path.join(os.tmpdir(), `habitat-vitest-qa-${Date.now()}.json`);

  try {
    const vitestEntry = path.join(BACKEND_DIR, 'node_modules', 'vitest', 'vitest.mjs');
    const proc = fs.existsSync(vitestEntry)
      ? spawnSync(
          process.execPath,
          [vitestEntry, 'run', '--reporter=json', '--outputFile', tmpJson],
          { cwd: BACKEND_DIR, encoding: 'utf8' },
        )
      : spawnSync(
          'npx',
          ['vitest', 'run', '--reporter=json', '--outputFile', tmpJson],
          { cwd: BACKEND_DIR, shell: true, encoding: 'utf8' },
        );

    if (!fs.existsSync(tmpJson)) {
      recordCase(results, {
        id: 'UNI-ERR',
        layer: 'Individual',
        name: 'Ejecucion suite Vitest backend',
        expected: 'ACCEPT',
        passed: false,
        detail: `No se genero salida JSON de Vitest (exit=${proc.status}): ${(proc.stderr || proc.stdout || '').slice(0, 200)}`,
      });
      return results;
    }

    const report = JSON.parse(fs.readFileSync(tmpJson, 'utf8'));
    let idx = 1;
    const negativeRegex = /404|409|rechaz|conflict|not found|invalido|invalid|error|deneg|fail/i;

    for (const suite of report.testResults || []) {
      const fileShort = path.relative(BACKEND_DIR, suite.name || 'spec').replaceAll('\\', '/');
      for (const assertion of suite.assertionResults || []) {
        const title = assertion.title || assertion.fullName || `Test ${idx}`;
        const expected = negativeRegex.test(title) ? 'REJECT' : 'ACCEPT';
        const passed = assertion.status === 'passed';
        const duration = Math.round(assertion.duration || 0);
        const failMsg = assertion.failureMessages?.[0]?.split('\n')[0] || '';

        recordCase(results, {
          id: `UNI-${String(idx).padStart(2, '0')}`,
          layer: 'Individual',
          name: `[${fileShort}] ${title}`,
          expected,
          passed,
          detail: passed ? `Vitest status=passed (${duration}ms)` : `Vitest status=${assertion.status}: ${failMsg}`,
          latencyMs: duration,
        });
        idx += 1;
      }
    }
  } finally {
    if (fs.existsSync(tmpJson)) {
      try {
        fs.unlinkSync(tmpJson);
      } catch {
        // ignorar error de limpieza temporal
      }
    }
  }

  return results;
}

/**
 * CAPA 2: Pruebas de Integracion (API B2B, catalogo, contratos, seguridad y validaciones).
 */
async function runIntegrationLayer(checkIn, checkOut) {
  const results = [];
  let discoveredRoom = null;

  // INT-01 [ACCEPT]: Healthcheck
  const health = await fetchJson(`${BASE_URL}/api/v2/alojamientos/health`, {
    headers: headersB2b,
  });
  recordCase(results, {
    id: 'INT-01',
    layer: 'Integración',
    name: 'GET /api/v2/alojamientos/health responde 200 y semaforo operativo',
    expected: 'ACCEPT',
    passed: health.ok && health.status === 200 && Boolean(health.body?.semaforo),
    detail: `HTTP ${health.status} | semaforo=${health.body?.semaforo ?? 'N/A'}`,
    latencyMs: health.latencyMs,
  });

  // INT-02 [ACCEPT]: Catalogo B2B publicado
  const catalog = await fetchJson(`${BASE_URL}/api/v2/alojamientos`, {
    headers: headersB2b,
  });
  const catalogItems = Array.isArray(catalog.body?.items)
    ? catalog.body.items
    : Array.isArray(catalog.body)
      ? catalog.body
      : [];
  recordCase(results, {
    id: 'INT-02',
    layer: 'Integración',
    name: 'GET /api/v2/alojamientos devuelve catalogo publicado con precios validos',
    expected: 'ACCEPT',
    passed: catalog.ok && catalog.status === 200 && catalogItems.length > 0,
    detail: `HTTP ${catalog.status} | total=${catalog.body?.total ?? catalogItems.length}`,
    latencyMs: catalog.latencyMs,
  });

  // INT-03 [ACCEPT]: Search B2B para fechas futuras
  const search = await fetchJson(`${BASE_URL}/api/v2/alojamientos/search`, {
    method: 'POST',
    headers: headersB2b,
    body: JSON.stringify({
      checkIn,
      checkOut,
      adultos: 2,
      habitaciones: 1,
    }),
  });
  const searchItems = Array.isArray(search.body?.items) ? search.body.items : [];
  for (const hotel of searchItems) {
    const subRooms = Array.isArray(hotel?.habitaciones) ? hotel.habitaciones : [];
    const richRoom = subRooms.find(
      (r) => r?.productoId && Number(r?.stockDisponible ?? 0) >= 2,
    );
    if (hotel?.alojamientoId && richRoom) {
      discoveredRoom = {
        alojamientoId: hotel.alojamientoId,
        productoId: richRoom.productoId,
      };
      break;
    }
  }
  if (!discoveredRoom) {
    discoveredRoom =
      searchItems.find((x) => x?.alojamientoId && x?.productoId && Number(x?.stockDisponible ?? 1) > 0) ||
      searchItems[0] ||
      null;
  }
  recordCase(results, {
    id: 'INT-03',
    layer: 'Integración',
    name: 'POST /api/v2/alojamientos/search filtra disponibilidad y precios por fechas',
    expected: 'ACCEPT',
    passed: search.ok && search.status === 200 && searchItems.length > 0 && Boolean(discoveredRoom?.productoId),
    detail: `HTTP ${search.status} | items=${searchItems.length} | muestra=${discoveredRoom?.alojamientoId ?? 'N/A'}/${discoveredRoom?.productoId ?? 'N/A'}`,
    latencyMs: search.latencyMs,
  });

  const targetAloId = discoveredRoom?.alojamientoId || catalogItems[0]?.alojamientoId || catalogItems[0]?.id || 18;

  // INT-04 [ACCEPT]: Sub-ruta habitaciones de alojamiento
  const rooms = await fetchJson(`${BASE_URL}/api/v2/alojamientos/${targetAloId}/habitaciones`, {
    headers: headersB2b,
  });
  const roomsList = Array.isArray(rooms.body?.habitaciones) ? rooms.body.habitaciones : [];
  recordCase(results, {
    id: 'INT-04',
    layer: 'Integración',
    name: `GET /api/v2/alojamientos/${targetAloId}/habitaciones devuelve inventario`,
    expected: 'ACCEPT',
    passed: rooms.ok && rooms.status === 200 && roomsList.length > 0,
    detail: `HTTP ${rooms.status} | habitaciones=${roomsList.length}`,
    latencyMs: rooms.latencyMs,
  });

  // INT-05 [ACCEPT]: GET availability v2
  const availGet = await fetchJson(
    `${BASE_URL}/api/v2/alojamientos/${targetAloId}/availability?checkin=${checkIn}&checkout=${checkOut}&habitaciones=1&adultos=2`,
    { headers: headersB2b },
  );
  recordCase(results, {
    id: 'INT-05',
    layer: 'Integración',
    name: `GET /api/v2/alojamientos/${targetAloId}/availability devuelve estructura agregada`,
    expected: 'ACCEPT',
    passed:
      availGet.ok &&
      availGet.status === 200 &&
      typeof availGet.body?.available_rooms === 'number',
    detail: `HTTP ${availGet.status} | available_rooms=${availGet.body?.available_rooms ?? 'N/A'}`,
    latencyMs: availGet.latencyMs,
  });

  // INT-06 [REJECT]: Seguridad - Solicitud sin X-API-Key
  const noAuth = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ cotizacionId: 'cot-invalida' }),
  });
  recordCase(results, {
    id: 'INT-06',
    layer: 'Integración',
    name: 'POST /orders/create sin X-API-Key rechaza acceso (401)',
    expected: 'REJECT',
    passed: noAuth.ok && (noAuth.status === 401 || noAuth.status === 403),
    detail: `HTTP ${noAuth.status}`,
    latencyMs: noAuth.latencyMs,
  });

  // INT-07 [REJECT]: Seguridad - X-API-Key invalida
  const badAuth = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
    method: 'POST',
    headers: {
      'X-API-Key': 'hab_invalid_key_qa_kappa_000',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ cotizacionId: 'cot-invalida' }),
  });
  recordCase(results, {
    id: 'INT-07',
    layer: 'Integración',
    name: 'POST /orders/create con X-API-Key invalida rechaza acceso (401/403)',
    expected: 'REJECT',
    passed: badAuth.ok && (badAuth.status === 401 || badAuth.status === 403),
    detail: `HTTP ${badAuth.status}`,
    latencyMs: badAuth.latencyMs,
  });

  // INT-08 [REJECT]: Validacion - POST /orders/create sin Idempotency-Key UUID v4 -> 400
  const missingIdem = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
    method: 'POST',
    headers: {
      ...headersB2b,
      'X-Correlation-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({ alojamientoId: targetAloId }),
  });
  recordCase(results, {
    id: 'INT-08',
    layer: 'Integración',
    name: 'POST /orders/create sin Idempotency-Key UUID v4 rechaza (400)',
    expected: 'REJECT',
    passed: missingIdem.ok && missingIdem.status === 400,
    detail: `HTTP ${missingIdem.status} | msg=${missingIdem.body?.message ?? missingIdem.body?.detail ?? 'N/A'}`,
    latencyMs: missingIdem.latencyMs,
  });

  // INT-09 [REJECT]: Validacion - Estancia mayor a 90 noches -> 400
  const longStay = await fetchJson(
    `${BASE_URL}/api/v2/alojamientos?checkIn=${checkIn}&checkOut=${addDaysIso(165)}`,
    { headers: headersB2b },
  );
  recordCase(results, {
    id: 'INT-09',
    layer: 'Integración',
    name: 'GET /alojamientos con estancia > 90 noches rechaza (400)',
    expected: 'REJECT',
    passed: longStay.ok && longStay.status === 400,
    detail: `HTTP ${longStay.status} | msg=${longStay.body?.message ?? longStay.body?.detail ?? 'N/A'}`,
    latencyMs: longStay.latencyMs,
  });

  // INT-10 [REJECT]: Recurso inexistente
  const missingAlo = await fetchJson(`${BASE_URL}/api/v2/alojamientos/99999999`, {
    headers: headersB2b,
  });
  recordCase(results, {
    id: 'INT-10',
    layer: 'Integración',
    name: 'GET /alojamientos/99999999 inexistente rechaza (404)',
    expected: 'REJECT',
    passed: missingAlo.ok && missingAlo.status === 404,
    detail: `HTTP ${missingAlo.status}`,
    latencyMs: missingAlo.latencyMs,
  });

  return { results, discoveredRoom };
}

/**
 * CAPA 3: Pruebas E2E (Flujo completo cliente -> cotizacion -> reserva -> idempotencia -> cancelacion/limpieza -> rechazo post-cancelacion).
 */
async function runE2eLayer(discoveredRoom, checkIn, checkOut) {
  const results = [];
  const targetAloId = discoveredRoom?.alojamientoId;
  const targetProdId = discoveredRoom?.productoId;

  // E2E-01 [ACCEPT]: Registro y consulta de cliente B2B
  const ts = Date.now();
  const testEmail = `qa.kappa.${ts}@habitat-test.ec`;
  const testCedula = `17${String(ts).slice(-8)}`;
  const cliCreate = await fetchJson(`${BASE_URL}/api/v2/clientes`, {
    method: 'POST',
    headers: headersB2b,
    body: JSON.stringify({
      nombre: 'QA Kappa Automated',
      email: testEmail,
      identificacion: testCedula,
      telefono: '+593990001122',
    }),
  });
  const clientId = cliCreate.body?.client_id;
  const cliGet = await fetchJson(
    `${BASE_URL}/api/v2/clientes?identificacion=${encodeURIComponent(testCedula)}`,
    { headers: headersB2b },
  );
  recordCase(results, {
    id: 'E2E-01',
    layer: 'E2E',
    name: 'Registro y consulta cross-platform de cliente (POST & GET /api/v2/clientes)',
    expected: 'ACCEPT',
    passed:
      cliCreate.ok &&
      (cliCreate.status === 200 || cliCreate.status === 201) &&
      cliGet.ok &&
      cliGet.status === 200 &&
      Boolean(clientId) &&
      cliGet.body?.client_id === clientId,
    detail: `HTTP ${cliCreate.status}/${cliGet.status} | client_id=${clientId ?? 'N/A'}`,
    latencyMs: cliCreate.latencyMs + cliGet.latencyMs,
  });

  // E2E-02 [ACCEPT]: Cotizacion / Availability previa a la reserva
  const availPost = await fetchJson(`${BASE_URL}/api/v2/alojamientos/availability`, {
    method: 'POST',
    headers: {
      ...headersB2b,
      'X-Correlation-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({
      alojamientoId: targetAloId,
      productoId: targetProdId,
      checkIn,
      checkOut,
      adultos: 2,
      habitaciones: 1,
    }),
  });
  const cotizacionId = availPost.body?.cotizacionId;
  recordCase(results, {
    id: 'E2E-02',
    layer: 'E2E',
    name: 'Cotizacion de tarifa y stock (POST /api/v2/alojamientos/availability)',
    expected: 'ACCEPT',
    passed:
      availPost.ok &&
      (availPost.status === 200 || availPost.status === 201) &&
      Boolean(cotizacionId),
    detail: `HTTP ${availPost.status} | cotizacionId=${cotizacionId ?? 'N/A'}`,
    latencyMs: availPost.latencyMs,
  });

  // E2E-03 [ACCEPT]: Creacion de orden B2B idempotente usando cotizacionId (hold 30m)
  const idemKeyHold = crypto.randomUUID();
  const corrIdHold = crypto.randomUUID();
  const holdPayload = {
    cotizacionId,
    client_id: clientId,
    externalOrderId: `QA-HOLD-${ts}`,
    sagaId: corrIdHold,
  };
  const orderCreate = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
    method: 'POST',
    headers: {
      ...headersB2b,
      'Idempotency-Key': idemKeyHold,
      'X-Correlation-ID': corrIdHold,
    },
    body: JSON.stringify(holdPayload),
  });
  let activeIdemKey = idemKeyHold;
  let activeCorrId = corrIdHold;
  let activePayload = holdPayload;
  let activeOrderId = orderCreate.body?.orderId;
  let activeCodigoReserva = orderCreate.body?.codigoReserva;
  const errMsg03 = orderCreate.body?.message || orderCreate.body?.detail || orderCreate.body?.error || '';
  recordCase(results, {
    id: 'E2E-03',
    layer: 'E2E',
    name: 'Creacion de reserva B2B con hold cotizacionId (POST /api/v2/alojamientos/orders/create)',
    expected: 'ACCEPT',
    passed:
      orderCreate.ok &&
      (orderCreate.status === 200 || orderCreate.status === 201) &&
      Boolean(activeOrderId),
    detail: `HTTP ${orderCreate.status} | orderId=${activeOrderId ?? 'N/A'} | locator=${activeCodigoReserva ?? 'N/A'}${errMsg03 ? ` | msg=${JSON.stringify(errMsg03)}` : ''}`,
    latencyMs: orderCreate.latencyMs,
  });

  // Fallback E2E-03B si el hold cotizacionId fallo en BD remota, para continuar evaluando el flujo Saga sin saltos
  if (!activeOrderId) {
    const idemKeyDirect = crypto.randomUUID();
    const corrIdDirect = crypto.randomUUID();
    const directPayload = {
      alojamientoId: targetAloId,
      productoId: targetProdId,
      checkIn,
      checkOut,
      adultos: 2,
      habitaciones: 1,
      client_id: clientId,
      externalOrderId: `QA-DIR-${ts}`,
      sagaId: corrIdDirect,
    };
    const directCreate = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
      method: 'POST',
      headers: {
        ...headersB2b,
        'Idempotency-Key': idemKeyDirect,
        'X-Correlation-ID': corrIdDirect,
      },
      body: JSON.stringify(directPayload),
    });
    activeIdemKey = idemKeyDirect;
    activeCorrId = corrIdDirect;
    activePayload = directPayload;
    activeOrderId = directCreate.body?.orderId;
    activeCodigoReserva = directCreate.body?.codigoReserva;
    const errMsg03b = directCreate.body?.message || directCreate.body?.detail || '';
    recordCase(results, {
      id: 'E2E-03B',
      layer: 'E2E',
      name: 'Creacion directa de reserva B2B sin hold (POST /api/v2/alojamientos/orders/create)',
      expected: 'ACCEPT',
      passed:
        directCreate.ok &&
        (directCreate.status === 200 || directCreate.status === 201) &&
        Boolean(activeOrderId),
      detail: `HTTP ${directCreate.status} | orderId=${activeOrderId ?? 'N/A'} | locator=${activeCodigoReserva ?? 'N/A'}${errMsg03b ? ` | msg=${JSON.stringify(errMsg03b)}` : ''}`,
      latencyMs: directCreate.latencyMs,
    });
  }

  // E2E-04 [ACCEPT]: Replay idempotente con misma Idempotency-Key
  const orderReplay = activeOrderId
    ? await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
        method: 'POST',
        headers: {
          ...headersB2b,
          'Idempotency-Key': activeIdemKey,
          'X-Correlation-ID': activeCorrId,
        },
        body: JSON.stringify(activePayload),
      })
    : { ok: false, status: 0, headers: new Headers(), body: {}, latencyMs: 0 };
  const replayedFlag = orderReplay.headers.get('idempotent-replayed');
  const errMsg04 = orderReplay.body?.message || orderReplay.body?.detail || '';
  recordCase(results, {
    id: 'E2E-04',
    layer: 'E2E',
    name: 'Replay idempotente de creacion devuelve misma orden sin duplicar stock',
    expected: 'ACCEPT',
    passed:
      orderReplay.ok &&
      (orderReplay.status === 200 || orderReplay.status === 201) &&
      Boolean(activeOrderId) &&
      orderReplay.body?.orderId === activeOrderId,
    detail: `HTTP ${orderReplay.status} | Idempotent-Replayed=${replayedFlag ?? 'N/A'}${errMsg04 ? ` | msg=${JSON.stringify(errMsg04)}` : ''}`,
    latencyMs: orderReplay.latencyMs,
  });

  // E2E-05 [ACCEPT]: Consulta de orden por idempotency_key
  const orderGet = await fetchJson(
    `${BASE_URL}/api/v2/alojamientos/orders?idempotency_key=${encodeURIComponent(activeIdemKey)}`,
    { headers: headersB2b },
  );
  recordCase(results, {
    id: 'E2E-05',
    layer: 'E2E',
    name: 'Trazabilidad de orden por idempotency_key (GET /api/v2/alojamientos/orders)',
    expected: 'ACCEPT',
    passed:
      orderGet.ok &&
      orderGet.status === 200 &&
      Boolean(activeCodigoReserva) &&
      orderGet.body?.locator === activeCodigoReserva,
    detail: `HTTP ${orderGet.status} | locator=${orderGet.body?.locator ?? 'N/A'}`,
    latencyMs: orderGet.latencyMs,
  });

  // E2E-06 [REJECT]: Reutilizar Idempotency-Key con payload distinto -> 422
  const reused422 = activeOrderId
    ? await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
        method: 'POST',
        headers: {
          ...headersB2b,
          'Idempotency-Key': activeIdemKey,
          'X-Correlation-ID': activeCorrId,
        },
        body: JSON.stringify({
          alojamientoId: 999,
          productoId: 'PROD-CONFLICTO-QA',
        }),
      })
    : { ok: false, status: 0, body: { detail: 'Omitido por falta de orden previa' }, latencyMs: 0 };
  if (reused422.body?.orderId && reused422.body.orderId !== activeOrderId) {
    await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/${reused422.body.orderId}/cancel`, {
      method: 'POST',
      headers: headersB2b,
    });
  }
  recordCase(results, {
    id: 'E2E-06',
    layer: 'E2E',
    name: 'Reuso de Idempotency-Key con distinto payload rechaza (422 IDEMPOTENCY_KEY_REUSED)',
    expected: 'REJECT',
    passed: reused422.ok && reused422.status === 422,
    detail: `HTTP ${reused422.status} | code=${reused422.body?.code ?? reused422.body?.detail ?? 'N/A'}`,
    latencyMs: reused422.latencyMs,
  });

  // E2E-07 [REJECT]: Solicitud de 999 habitaciones -> 409 OUT_OF_STOCK
  const outOfStock = await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/create`, {
    method: 'POST',
    headers: {
      ...headersB2b,
      'Idempotency-Key': crypto.randomUUID(),
      'X-Correlation-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({
      alojamientoId: targetAloId,
      productoId: targetProdId,
      checkIn,
      checkOut,
      habitaciones: 999,
    }),
  });
  recordCase(results, {
    id: 'E2E-07',
    layer: 'E2E',
    name: 'Reserva por encima del inventario disponible rechaza (409 OUT_OF_STOCK)',
    expected: 'REJECT',
    passed: outOfStock.ok && outOfStock.status === 409,
    detail: `HTTP ${outOfStock.status} | code=${outOfStock.body?.code ?? 'N/A'}`,
    latencyMs: outOfStock.latencyMs,
  });

  // E2E-08 [ACCEPT]: Cancelacion Saga (1ra vez libera stock y limpia la reserva QA)
  const cancel1 = activeOrderId
    ? await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/${activeOrderId}/cancel`, {
        method: 'POST',
        headers: headersB2b,
      })
    : { ok: false, status: 0, body: { error: 'Sin activeOrderId previo' }, latencyMs: 0 };
  recordCase(results, {
    id: 'E2E-08',
    layer: 'E2E',
    name: 'Cancelacion Saga libera stock de reserva QA (POST /orders/:id/cancel)',
    expected: 'ACCEPT',
    passed:
      cancel1.ok &&
      cancel1.status === 200 &&
      cancel1.body?.yaCancelada === false &&
      cancel1.body?.cuposRestaurados === true,
    detail: `HTTP ${cancel1.status} | yaCancelada=${cancel1.body?.yaCancelada} | cuposRestaurados=${cancel1.body?.cuposRestaurados}`,
    latencyMs: cancel1.latencyMs,
  });

  // E2E-09 [ACCEPT]: Replay idempotente de cancelacion
  const cancel2 = activeOrderId
    ? await fetchJson(`${BASE_URL}/api/v2/alojamientos/orders/${activeOrderId}/cancel`, {
        method: 'POST',
        headers: headersB2b,
      })
    : { ok: false, status: 0, body: { error: 'Sin activeOrderId previo' }, latencyMs: 0 };
  recordCase(results, {
    id: 'E2E-09',
    layer: 'E2E',
    name: 'Replay idempotente de cancelacion confirma yaCancelada=true sin doble liberacion',
    expected: 'ACCEPT',
    passed: cancel2.ok && cancel2.status === 200 && cancel2.body?.yaCancelada === true,
    detail: `HTTP ${cancel2.status} | yaCancelada=${cancel2.body?.yaCancelada}`,
    latencyMs: cancel2.latencyMs,
  });

  // E2E-10 [REJECT]: Cancelacion de orden inexistente -> 404
  const cancelMissing = await fetchJson(
    `${BASE_URL}/api/v2/alojamientos/orders/00000000-0000-0000-0000-000000000000/cancel`,
    {
      method: 'POST',
      headers: headersB2b,
    },
  );
  recordCase(results, {
    id: 'E2E-10',
    layer: 'E2E',
    name: 'Cancelacion de orden inexistente rechaza (404)',
    expected: 'REJECT',
    passed: cancelMissing.ok && cancelMissing.status === 404,
    detail: `HTTP ${cancelMissing.status}`,
    latencyMs: cancelMissing.latencyMs,
  });

  // E2E-11 [REJECT]: Check-in sobre reserva inexistente -> 404
  const checkinMissing = await fetchJson(
    `${BASE_URL}/api/v2/alojamientos/orders/00000000-0000-0000-0000-000000000000/checkin`,
    {
      method: 'POST',
      headers: headersB2b,
      body: JSON.stringify({
        huespedes_reales: 2,
        observaciones: 'Intento check-in reserva inexistente QA Kappa',
      }),
    },
  );
  recordCase(results, {
    id: 'E2E-11',
    layer: 'E2E',
    name: 'Check-in sobre reserva inexistente rechaza (404)',
    expected: 'REJECT',
    passed: checkinMissing.ok && checkinMissing.status === 404,
    detail: `HTTP ${checkinMissing.status}`,
    latencyMs: checkinMissing.latencyMs,
  });

  return results;
}

function buildMarkdownReport({ generatedAt, layers, globalMetrics }) {
  const lines = [];
  lines.push('# Reporte Automatizado de QA — Pruebas Individuales, Integración y E2E con Coeficiente Kappa');
  lines.push('');
  lines.push(`- **Fecha de ejecución:** ${generatedAt}`);
  lines.push(`- **Entorno evaluado (` + '`BASE_URL`' + `):** \`${BASE_URL}\``);
  lines.push('- **Integridad del código fuente:** Ejecutado sin modificar `backend/` ni `frontend/`.');
  lines.push('');
  lines.push('## Resumen Ejecutivo — Coeficiente Kappa de Cohen ($\\kappa$)');
  lines.push('');
  lines.push('Se evalúa la concordancia entre la expectativa de aceptación/rechazo del caso de prueba (`ACCEPT` / `REJECT`) y la respuesta real del sistema:');
  lines.push('');
  lines.push('| Capa de Prueba | N | TP | TN | FP | FN | Acuerdo Observado ($P_o$) | Acuerdo al Azar ($P_e$) | Kappa ($\\kappa$) | Interpretación (Landis & Koch) |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |');

  for (const l of layers) {
    const m = l.metrics;
    lines.push(
      `| **${l.title}** | ${m.n} | ${m.tp} | ${m.tn} | ${m.fp} | ${m.fn} | ${(m.po * 100).toFixed(2)}% | ${(m.pe * 100).toFixed(2)}% | **${m.kappa.toFixed(4)}** | ${m.verdict} |`,
    );
  }
  lines.push(
    `| **GLOBAL (Todas las capas)** | **${globalMetrics.n}** | **${globalMetrics.tp}** | **${globalMetrics.tn}** | **${globalMetrics.fp}** | **${globalMetrics.fn}** | **${(globalMetrics.po * 100).toFixed(2)}%** | **${(globalMetrics.pe * 100).toFixed(2)}%** | **${globalMetrics.kappa.toFixed(4)}** | **${globalMetrics.verdict}** |`,
  );

  lines.push('');
  lines.push('> **Leyenda de la matriz:** `TP` = Aceptado correctamente · `TN` = Rechazado correctamente · `FP` = Falso positivo (aceptado cuando debía rechazarse) · `FN` = Falso negativo (rechazado cuando debía aceptarse).');
  lines.push('');

  for (const l of layers) {
    lines.push(`## ${l.title}`);
    lines.push('');
    lines.push('| ID | Caso de Prueba | Esperado | Real | Resultado | Latencia | Detalle |');
    lines.push('| :--- | :--- | :---: | :---: | :---: | :---: | :--- |');
    for (const c of l.cases) {
      const statusEmoji = c.passed ? 'OK' : 'FALLO';
      const safeName = c.name.replaceAll('|', '\\|');
      const safeDetail = String(c.detail || '').replaceAll('|', '\\|');
      lines.push(
        `| \`${c.id}\` | ${safeName} | \`${c.expected}\` | \`${c.actual}\` | **${statusEmoji}** | ${c.latencyMs} ms | ${safeDetail} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function printConsoleTable(layers, globalMetrics) {
  console.log('\n================================================================================');
  console.log(' RESULTADOS DE QA AUTOMATIZADA — COEFICIENTE KAPPA DE COHEN (HABITAT EC)');
  console.log('================================================================================');
  console.log(`Target URL : ${BASE_URL}`);
  console.log('Restriccion: backend/ y frontend/ intactos (sin modificaciones)\n');

  for (const l of layers) {
    console.log(`--- ${l.title} ---`);
    for (const c of l.cases) {
      const tag = c.passed ? '[OK]   ' : '[FAIL] ';
      console.log(
        `${tag} ${c.id} | Exp=${c.expected.padEnd(6)} Real=${c.actual.padEnd(6)} | ${c.name} -> ${c.detail}`,
      );
    }
    const m = l.metrics;
    console.log(
      `=> Resumen ${l.title}: N=${m.n}, TP=${m.tp}, TN=${m.tn}, FP=${m.fp}, FN=${m.fn} | Po=${(m.po * 100).toFixed(2)}% | Pe=${(m.pe * 100).toFixed(2)}% | Kappa=${m.kappa.toFixed(4)} (${m.verdict})\n`,
    );
  }

  console.log('================================================================================');
  console.log(
    `KAPPA GLOBAL: N=${globalMetrics.n} | TP=${globalMetrics.tp} TN=${globalMetrics.tn} FP=${globalMetrics.fp} FN=${globalMetrics.fn} | Po=${(globalMetrics.po * 100).toFixed(2)}% | Pe=${(globalMetrics.pe * 100).toFixed(2)}% | kappa=${globalMetrics.kappa.toFixed(4)} | ${globalMetrics.verdict}`,
  );
  console.log('================================================================================\n');
}

async function main() {
  const checkIn = addDaysIso(25);
  const checkOut = addDaysIso(27);

  console.log('[1/3] Ejecutando Pruebas Individuales (Vitest en backend/)...');
  const unitCases = runUnitLayer();

  console.log(`[2/3] Ejecutando Pruebas de Integracion contra ${BASE_URL}...`);
  const { results: integrationCases, discoveredRoom } = await runIntegrationLayer(
    checkIn,
    checkOut,
  );

  console.log(`[3/3] Ejecutando Pruebas E2E (fechas ${checkIn} -> ${checkOut}, con limpieza)...`);
  const e2eCases = await runE2eLayer(discoveredRoom, checkIn, checkOut);

  const layers = [
    {
      title: 'Capa 1: Pruebas Individuales (Unitarias + Pact)',
      cases: unitCases,
      metrics: computeKappaMetrics(unitCases),
    },
    {
      title: 'Capa 2: Pruebas de Integracion (API B2B, Seguridad y Validacion)',
      cases: integrationCases,
      metrics: computeKappaMetrics(integrationCases),
    },
    {
      title: 'Capa 3: Pruebas E2E (Reserva Completa, Idempotencia y Cancelacion)',
      cases: e2eCases,
      metrics: computeKappaMetrics(e2eCases),
    },
  ];

  const allCases = [...unitCases, ...integrationCases, ...e2eCases];
  const globalMetrics = computeKappaMetrics(allCases);

  printConsoleTable(layers, globalMetrics);

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    buildMarkdownReport({
      generatedAt: new Date().toISOString(),
      layers,
      globalMetrics,
    }),
    'utf8',
  );
  console.log(`Reporte Markdown guardado en: ${REPORT_PATH}`);

  const hasFailures = globalMetrics.fp > 0 || globalMetrics.fn > 0;
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('Error fatal ejecutando suite QA Kappa:', err);
  process.exit(1);
});
