import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'habitat_ec_token';
export const USER_STORAGE_KEY = 'habitat_ec_user';
export const FINGERPRINT_STORAGE_KEY = 'habitat_ec_device_fingerprint';

function getOrCreateDeviceFingerprint(): string {
  try {
    let fingerprint = localStorage.getItem(FINGERPRINT_STORAGE_KEY);
    if (!fingerprint) {
      fingerprint = crypto.randomUUID();
      localStorage.setItem(FINGERPRINT_STORAGE_KEY, fingerprint);
    }
    return fingerprint;
  } catch {
    return crypto.randomUUID();
  }
}

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers.set('X-Correlation-Id', crypto.randomUUID());
  config.headers.set('X-Device-Fingerprint', getOrCreateDeviceFingerprint());

  const method = (config.method || '').toUpperCase();
  const url = config.url || '';

  if (method === 'POST') {
    const needsIdempotency =
      url.includes('/ordenes/create') ||
      /\/ordenes\/[^/]+\/cancelar/.test(url) ||
      url.includes('/pagos/procesar');

    if (needsIdempotency && !config.headers.get('Idempotency-Key')) {
      config.headers.set('Idempotency-Key', crypto.randomUUID());
    }
  }

  return config;
});

export function extractErrorMessage(error: unknown, fallback = 'Ha ocurrido un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[]; error?: string } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(' • ') : data.message;
    }
    if (data?.error) {
      return data.error;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

