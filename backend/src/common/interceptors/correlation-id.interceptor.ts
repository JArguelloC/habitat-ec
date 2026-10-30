import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as crypto from 'node:crypto';
import type { Request, Response } from 'express';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { correlationId?: string }>();
    const res = http.getResponse<Response>();

    const rawHeader = req.headers['x-correlation-id'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const correlationId =
      headerValue && UUID_REGEX.test(headerValue)
        ? headerValue
        : crypto.randomUUID();

    req.correlationId = correlationId;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    return next.handle();
  }
}

