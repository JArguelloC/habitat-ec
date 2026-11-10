import axios from 'axios';
import { observabilityService } from '../services/observability.service';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

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

    if (!config.headers.get('Idempotency-Key') && needsIdempotency) {
      config.headers.set('Idempotency-Key', crypto.randomUUID());
    }
  }

  config.metadata = { startTime: performance.now() };

  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    const startTime = response.config.metadata?.startTime;
    const duration = startTime ? performance.now() - startTime : 0;
    const url = response.config.url || '';
    const method = (response.config.method || 'GET').toUpperCase();
    const isError = response.status >= 400;
    observabilityService.recordApiCall(duration, isError, `${method} ${url}`);
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.config) {
      const startTime = error.config.metadata?.startTime;
      const duration = startTime ? performance.now() - startTime : 0;
      const url = error.config.url || '';
      const method = (error.config.method || 'GET').toUpperCase();
      observabilityService.recordApiCall(duration, true, `${method} ${url}`);
    } else {
      observabilityService.recordApiCall(0, true, 'FETCH_NETWORK_ERROR');
    }
    return Promise.reject(error);
  },
);

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

