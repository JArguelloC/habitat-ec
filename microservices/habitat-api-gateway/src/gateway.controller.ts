import {
  Controller,
  All,
  Get,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { EsbOrchestratorService } from './esb-orchestrator.service.js';

@Controller()
export class GatewayController {
  constructor(private readonly esbService: EsbOrchestratorService) {}

  @Get('api/v2/alojamientos/health')
  async healthB2b() {
    return {
      status: 'HEALTHY',
      semaforo: 'GREEN',
      service: 'HABITAT_API_GATEWAY_ESB',
      version: '2.2.0',
      latency_ms: 8,
      uptime_seconds: Math.floor(process.uptime()),
      nodo_id: process.env.NODE_ID || 'NODE_ALO_HAB',
      vertical: 'ALOJAMIENTOS',
      paradigms: ['REST', 'GraphQL', 'gRPC', 'SOA', 'EDA_RABBITMQ'],
      timestamp: new Date().toISOString(),
    };
  }

  @All('*path')
  async routePerimeterRequest(@Req() req: Request, @Res() res: Response) {
    const urlPath = req.originalUrl || req.url;

    // Clasificación de microservicio destino según dominio funcional
    let target: 'CATALOG' | 'ORDERS' | 'PAYMENTS_SOA' = 'CATALOG';
    if (
      urlPath.includes('/ordenes') ||
      urlPath.includes('/orders') ||
      urlPath.includes('/availability')
    ) {
      target = 'ORDERS';
    } else if (
      urlPath.includes('/pagos') ||
      urlPath.includes('/clientes') ||
      urlPath.includes('/usuarios') ||
      urlPath.includes('/auth') ||
      urlPath.includes('/integracion') ||
      urlPath.includes('/auditoria')
    ) {
      target = 'PAYMENTS_SOA';
    }

    try {
      const result = await this.esbService.forwardRequest({
        targetService: target,
        path: urlPath,
        method: req.method,
        headers: req.headers as Record<string, any>,
        body: req.body,
      });

      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
      return res.status(result.status).send(result.data);
    } catch (err) {
      return res.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: 502,
        error: 'Bad Gateway (ESB Orchestrator)',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

