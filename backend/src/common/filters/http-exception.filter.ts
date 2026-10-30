import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'node:crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const correlationId =
      request.correlationId ||
      (typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : crypto.randomUUID());

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorTitle = 'Internal Server Error';
    let errorMessage: string | object = 'Ha ocurrido un error inesperado en el servidor.';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        errorMessage = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, any>;
        errorMessage = body.message || res;
        errorTitle = body.error || exception.name;
      }
    } else {
      const err = exception as any;
      const rawMessage =
        exception instanceof Error ? exception.message : String(exception);
      const pgCode = err?.code || '';

      this.logger.error(
        `[${correlationId}] PostgreSQL / Unhandled Error: ${rawMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );

      // Mapeo exhaustivo de códigos y mensajes de PostgreSQL / Stored Procedures 5FN
      if (pgCode === '23P01' || rawMessage.includes('ROOM_NO_LONGER_AVAILABLE')) {
        statusCode = HttpStatus.CONFLICT;
        errorTitle = 'Conflict';
        errorMessage =
          'ROOM_NO_LONGER_AVAILABLE: Fechas no disponibles para reserva. Bloqueo o colisión concurrente.';
      } else if (pgCode === '23505') {
        statusCode = HttpStatus.CONFLICT;
        errorTitle = 'Conflict';
        errorMessage =
          'Registro duplicado. Ya existe una entidad con los mismos identificadores únicos.';
      } else if (
        pgCode === '23514' ||
        pgCode === 'P0001' ||
        pgCode === 'P0002' ||
        pgCode === 'P0003' ||
        pgCode === 'P0004' ||
        rawMessage.includes('VALIDATION_FAILED') ||
        rawMessage.includes('BOOKING_NOT_CONFIRMED')
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
        errorTitle = 'Bad Request';
        errorMessage = rawMessage.replace(/^ERROR:\s*/, '');
      } else if (pgCode === 'P0005' || rawMessage.includes('NOT_FOUND')) {
        statusCode = HttpStatus.NOT_FOUND;
        errorTitle = 'Not Found';
        errorMessage = rawMessage.replace(/^ERROR:\s*/, '');
      } else if (
        pgCode === 'P0006' ||
        rawMessage.includes('CANCELLATION_NOT_ALLOWED')
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
        errorTitle = 'Bad Request';
        errorMessage = rawMessage.replace(/^ERROR:\s*/, '');
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        errorTitle = 'Database Error';
        errorMessage = 'Error en la capa de datos o procedimiento almacenado.';
      }
    }

    response.status(statusCode).json({
      statusCode,
      error: errorTitle,
      message: errorMessage,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

