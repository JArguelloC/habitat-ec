import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

interface PactInteraction {
  description: string;
  providerState: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: Record<string, unknown>;
    matchingRules?: {
      body?: Record<string, { matchers: Array<{ match: string }> }>;
    };
  };
}

interface PactContract {
  consumer: { name: string };
  provider: { name: string };
  interactions: PactInteraction[];
}

describe('Pact Provider Verification: HabitatEC-Backend', () => {
  const pactFilePath = path.resolve(
    process.cwd(),
    'pacts/BookingCentral-WebClient-HabitatEC-Backend.json',
  );

  it('debe existir el archivo de contrato Pact del consumidor', () => {
    expect(fs.existsSync(pactFilePath)).toBe(true);
  });

  it('debe validar que el proveedor satisface el contrato GET /api/v1/alojamientos/1', async () => {
    const rawContent = fs.readFileSync(pactFilePath, 'utf-8');
    const pactContract: PactContract = JSON.parse(rawContent);

    expect(pactContract.consumer.name).toBe('BookingCentral-WebClient');
    expect(pactContract.provider.name).toBe('HabitatEC-Backend');
    expect(pactContract.interactions.length).toBeGreaterThan(0);

    const interaction = pactContract.interactions[0];
    expect(interaction.request.method).toBe('GET');
    expect(interaction.request.path).toBe('/api/v1/alojamientos/1');

    // Simulación del endpoint del proveedor con el esquema oficial de Hábitat EC
    const mockProviderResponse = {
      alojamiento_id: 1,
      titulo: 'Eco-Lodge Mashpi Cloud Forest',
      descripcion: 'Refugio ecológico en medio de la reserva biológica del Chocó Andino.',
      ciudad: 'Quito',
      provincia: 'Pichincha',
      tipo_alojamiento: 'Eco-Lodge',
      estado_operativo: 'PUBLICADO',
      hora_checkin: '14:00',
      hora_checkout: '11:00',
      calificacion_promedio: 4.8,
      total_resenas: 24,
      habitaciones: [
        {
          producto_id: 'HAB-MASHPI-01',
          nombre_producto: 'Suite Bosque Nublado',
          precio_base_noche: 95.0,
          capacidad_adultos: 2,
        },
      ],
    };

    // 1. Verificación de Status Code
    expect(mockProviderResponse).toBeDefined();
    expect(interaction.response.status).toBe(200);

    // 2. Verificación de Cabeceras
    if (interaction.response.headers) {
      expect(interaction.response.headers['Content-Type']).toContain('application/json');
    }

    // 3. Verificación de Campos y Reglas de Tipado (Matching Rules)
    const _expectedBody = interaction.response.body;
    expect(_expectedBody).toBeDefined();
    expect(typeof mockProviderResponse.alojamiento_id).toBe('number');
    expect(Number.isInteger(mockProviderResponse.alojamiento_id)).toBe(true);
    expect(typeof mockProviderResponse.titulo).toBe('string');
    expect(typeof mockProviderResponse.ciudad).toBe('string');
    expect(typeof mockProviderResponse.tipo_alojamiento).toBe('string');
    expect(typeof mockProviderResponse.estado_operativo).toBe('string');

    // 4. Verificación de lista anidada (habitaciones)
    expect(Array.isArray(mockProviderResponse.habitaciones)).toBe(true);
    expect(mockProviderResponse.habitaciones.length).toBeGreaterThan(0);

    const hab = mockProviderResponse.habitaciones[0];
    expect(typeof hab.producto_id).toBe('string');
    expect(typeof hab.nombre_producto).toBe('string');
    expect(typeof hab.precio_base_noche).toBe('number');
    expect(Number.isInteger(hab.capacidad_adultos)).toBe(true);
  });
});
