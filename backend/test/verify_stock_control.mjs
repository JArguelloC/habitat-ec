import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'node:crypto';

dotenv.config({ path: path.resolve('backend/.env') });

const BASE_URL = 'http://127.0.0.1:3000/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('--- INICIANDO VERIFICACIÓN E2E DE STOCK NUMÉRICO ---');

  // 1. Login Superadmin
  console.log('1. Autenticando como Superadmin...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      correo: 'superadmin@habitat-ec.com',
      password: 'Superadmin2026!'
    })
  });
  if (loginRes.status !== 200) {
    throw new Error('Fallo al autenticar superadmin: ' + JSON.stringify(loginRes.data));
  }
  const superToken = loginRes.data.accessToken;
  console.log('✅ Superadmin autenticado.');

  // 2. Crear un Administrador / Anfitrión de prueba
  console.log('2. Registrando anfitrión para el hotel...');
  const adminEmail = `anfitrion.hotel.${Date.now()}@habitat-ec.com`;
  const adminPass = 'HotelPass2026!';
  const createAdminRes = await request('/superadmin/crear-admin', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superToken}` },
    body: JSON.stringify({
      nombre: 'Carlos',
      apellido: 'Hotelero',
      correo: adminEmail,
      password: adminPass,
      telefono: '+593991234567'
    })
  });
  if (createAdminRes.status !== 201) {
    throw new Error('Fallo al crear anfitrión: ' + JSON.stringify(createAdminRes.data));
  }
  console.log('✅ Anfitrión creado:', adminEmail);

  // 3. Login como Anfitrión
  const adminLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: adminEmail, password: adminPass })
  });
  const adminToken = adminLoginRes.data.accessToken;

  // 4. Crear Hotel con 5 habitaciones en inventario
  console.log('3. Creando Hotel Boutique con 5 habitaciones en inventario...');
  const hotelRes = await request('/admin/alojamientos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      titulo: 'Hotel Boutique Plaza Colonial',
      descripcion: 'Hotel boutique patrimonial con habitaciones ejecutivas sostenibles.',
      direccion: 'Centro Histórico de Mindo',
      ciudadId: 1,
      tipoId: 3, // Hotel Boutique
      precioBaseNoche: 75.0,
      maxAdultos: 2,
      habitaciones: 5 // ¡5 cuartos en inventario!
    })
  });
  if (hotelRes.status !== 201) {
    throw new Error('Fallo al crear hotel: ' + JSON.stringify(hotelRes.data));
  }
  const hotelId = hotelRes.data.alojamiento.alojamientoId;
  const productoId = hotelRes.data.alojamiento.productoId;
  console.log(`✅ Hotel creado (ID: ${hotelId}, Producto: ${productoId}, Inventario: 5 cuartos)`);

  // 5. Registrar un Cliente viajero
  console.log('4. Registrando y autenticando cliente viajero...');
  const clienteEmail = `viajero.${Date.now()}@habitat-ec.com`;
  const clientePass = 'ViajeroPass2026!';
  await request('/auth/registro-cliente', {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Lucía',
      apellido: 'Mendoza',
      correo: clienteEmail,
      password: clientePass,
      telefono: '+593988776655'
    })
  });
  const clienteLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: clienteEmail, password: clientePass })
  });
  const clienteToken = clienteLogin.data.accessToken;
  console.log('✅ Cliente viajero autenticado:', clienteEmail);

  // 6. Buscar en Marketplace para 2 habitaciones
  const checkin = '2026-12-10';
  const checkout = '2026-12-13';
  console.log(`5. Buscando en Marketplace disponibilidad para 2 habitaciones (${checkin} al ${checkout})...`);
  const searchRes = await request('/alojamientos/search', {
    method: 'POST',
    body: JSON.stringify({
      ciudadId: 1,
      checkin,
      checkout,
      adultos: 2,
      habitaciones: 2
    })
  });
  const encontrado = searchRes.data.some(a => a.alojamientoId === hotelId);
  console.log('✅ ¿Hotel encontrado en búsqueda para 2 habitaciones?:', encontrado ? 'SÍ' : 'NO');
  if (!encontrado) throw new Error('El hotel debería aparecer disponible');

  // 7. Cliente solicita Hold temporal para 2 habitaciones
  console.log('6. Cliente solicita Hold de 2 habitaciones en /ordenes/preview...');
  const previewRes = await request('/ordenes/preview', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clienteToken}` },
    body: JSON.stringify({
      alojamientoId: hotelId,
      productoId,
      checkin,
      checkout,
      adultos: 2,
      cuartos: 2
    })
  });
  if (previewRes.status !== 201) {
    throw new Error('Fallo al generar Hold: ' + JSON.stringify(previewRes.data));
  }
  const previewId = previewRes.data.orderPreviewId;
  console.log(`✅ Hold generado exitosamente (PreviewId: ${previewId}, Total: $${previewRes.data.totalPrice})`);

  // 8. Verificar que el calendario refleja la reducción de stock (5 - 2 = 3)
  console.log('7. Verificando que cuartos_disponibles bajó a 3 en el calendario...');
  const calRes = await request(`/ordenes/calendario/${productoId}?inicio=${checkin}&fin=${checkout}`);
  console.log('Estado de fechas en calendario:', calRes.data.map(d => ({
    fecha: d.fecha.substring(0, 10),
    totales: d.cuartosTotales,
    disponibles: d.cuartosDisponibles,
    estado: d.estadoDia
  })));
  const todosTres = calRes.data.every(d => d.cuartosDisponibles === 3);
  if (!todosTres) {
    throw new Error('Las fechas deberían tener exactamente 3 cuartos disponibles.');
  }
  console.log('✅ ¡Stock decrementado correctamente a 3 cuartos disponibles!');

  // 9. Intentar pedir 4 habitaciones (Solo quedan 3, debe fallar con 409 o 400)
  console.log('8. Intentando solicitar 4 habitaciones (solo quedan 3)...');
  const previewExceso = await request('/ordenes/preview', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clienteToken}` },
    body: JSON.stringify({
      alojamientoId: hotelId,
      productoId,
      checkin,
      checkout,
      adultos: 2,
      cuartos: 4
    })
  });
  console.log(`Status de respuesta ante sobre-demanda: ${previewExceso.status}`);
  if (previewExceso.status < 400) {
    throw new Error('La petición de 4 habitaciones debió ser rechazada.');
  }
  console.log('✅ Sobre-demanda rechazada adecuadamente (Previene Overbooking). Mensaje:', previewExceso.data?.message);

  // 10. Confirmar la reserva de 2 habitaciones
  console.log('9. Confirmando reserva de las 2 habitaciones en /ordenes/create...');
  const idempotencyKey = crypto.randomUUID();
  const createOrderRes = await request('/ordenes/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clienteToken}`,
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      orderPreviewId: previewId,
      paymentReference: 'PAY-HOTEL-TEST-001',
      customer: {
        nombre: 'Lucía',
        apellido: 'Mendoza',
        email: clienteEmail
      }
    })
  });
  if (createOrderRes.status !== 201) {
    throw new Error('Fallo al confirmar reserva: ' + JSON.stringify(createOrderRes.data));
  }
  const orderId = createOrderRes.data.orderId;
  console.log(`✅ Reserva confirmada exitosamente (Order ID: ${orderId}, Locator: ${createOrderRes.data.locator})`);

  // 11. Cancelar la reserva y verificar reposición de stock (3 + 2 = 5)
  console.log('10. Cancelando la reserva para verificar compensación y restitución de stock...');
  const cancelRes = await request(`/ordenes/${orderId}/cancelar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clienteToken}`,
      'Idempotency-Key': crypto.randomUUID()
    }
  });
  if (cancelRes.status !== 200 && cancelRes.status !== 201) {
    throw new Error('Fallo al cancelar orden: ' + JSON.stringify(cancelRes.data));
  }
  console.log('✅ Orden cancelada:', cancelRes.data.mensaje);

  // 12. Verificar que el calendario restituyó los 5 cuartos
  console.log('11. Verificando que cuartos_disponibles volvió a 5 en el calendario...');
  const calRestituido = await request(`/ordenes/calendario/${productoId}?inicio=${checkin}&fin=${checkout}`);
  console.log('Estado de fechas restituidas:', calRestituido.data.map(d => ({
    fecha: d.fecha.substring(0, 10),
    totales: d.cuartosTotales,
    disponibles: d.cuartosDisponibles,
    estado: d.estadoDia
  })));
  const todosCinco = calRestituido.data.every(d => d.cuartosDisponibles === 5);
  if (!todosCinco) {
    throw new Error('Las fechas deberían tener los 5 cuartos restituidos.');
  }
  console.log('✅ ¡Stock restituido exitosamente a 5 cuartos disponibles!');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE STOCK NUMÉRICO CONTROLADO PASARON CON ÉXITO! 🎉\n');
}

run().catch(err => {
  console.error('❌ Error en prueba E2E:', err.message);
  process.exit(1);
});
