import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

/**
 * Orquestador ESB (Enterprise Service Bus) y Aggregator Pattern
 * Coordina llamadas distribuidas hacia:
 *  - MS_CATALOG (GraphQL /graphql + REST)
 *  - MS_ORDERS (gRPC Protobuf + REST Saga)
 *  - MS_PAYMENTS_SOA (SOA + EDA RabbitMQ Outbox)
 */
@Injectable()
export class EsbOrchestratorService {
  private readonly logger = new Logger(EsbOrchestratorService.name);

  private getCatalogUrl(): string {
    return (
      process.env.MS_CATALOG_URL ||
      'https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net'
    ).replace(/\/+$/, '');
  }

  private getOrdersUrl(): string {
    return (
      process.env.MS_ORDERS_URL ||
      'https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net'
    ).replace(/\/+$/, '');
  }

  private getPaymentsSoaUrl(): string {
    return (
      process.env.MS_PAYMENTS_SOA_URL ||
      'https://habitat-ec-backend-e9h5dndpcuhseqc8.chilecentral-01.azurewebsites.net'
    ).replace(/\/+$/, '');
  }

  async forwardRequest(params: {
    targetService: 'CATALOG' | 'ORDERS' | 'PAYMENTS_SOA';
    path: string;
    method: string;
    headers: Record<string, any>;
    body?: unknown;
  }): Promise<{ status: number; headers: Record<string, string>; data: unknown }> {
    const baseUrl =
      params.targetService === 'CATALOG'
        ? this.getCatalogUrl()
        : params.targetService === 'ORDERS'
          ? this.getOrdersUrl()
          : this.getPaymentsSoaUrl();

    const correlationId =
      params.headers['x-correlation-id'] ||
      params.headers['X-Correlation-ID'] ||
      crypto.randomUUID();

    const targetUrl = `${baseUrl}${params.path}`;
    const outgoingHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': String(correlationId),
    };

    if (params.headers['authorization']) {
      outgoingHeaders['Authorization'] = String(params.headers['authorization']);
    }
    if (params.headers['x-api-key']) {
      outgoingHeaders['X-API-Key'] = String(params.headers['x-api-key']);
    } else if (process.env.API_KEY) {
      outgoingHeaders['X-API-Key'] = process.env.API_KEY;
    }
    if (params.headers['idempotency-key']) {
      outgoingHeaders['Idempotency-Key'] = String(
        params.headers['idempotency-key'],
      );
    }

    this.logger.log(
      `[ESB Router] ${params.method} ${params.path} -> ${params.targetService} (cid=${correlationId})`,
    );

    const response = await fetch(targetUrl, {
      method: params.method,
      headers: outgoingHeaders,
      body:
        params.method !== 'GET' && params.method !== 'HEAD' && params.body
          ? JSON.stringify(params.body)
          : undefined,
      signal: AbortSignal.timeout(8000),
    });

    const responseHeaders: Record<string, string> = {
      'X-Correlation-ID': String(correlationId),
    };
    const replayed = response.headers.get('idempotent-replayed');
    if (replayed) {
      responseHeaders['Idempotent-Replayed'] = replayed;
    }
    const contentType = response.headers.get('content-type');
    if (contentType) {
      responseHeaders['Content-Type'] = contentType;
    }

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return {
      status: response.status,
      headers: responseHeaders,
      data,
    };
  }
}

