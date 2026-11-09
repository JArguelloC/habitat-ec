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
        `[${correlationId}] PostgreSQL / Unhandled Error [code: ${pgCode}]: ${rawMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      if (err?.detail) {
        this.logger.error(`[${correlationId}] Detail: ${err.detail}`);
      }
      if (err?.constraint || err?.table) {
        this.logger.error(`[${correlationId}] Table: ${err?.table}, Constraint: ${err?.constraint}`);
      }
      console.error('❌ [Unhandled Exception in HTTP Filter]', exception);

      // Mapeo exhaustivo de códigos y mensajes de PostgreSQL / Stored Procedures 5FN
      if (pgCode === '22P02') {
        statusCode = HttpStatus.BAD_REQUEST;
        errorTitle = 'Bad Request';
        errorMessage = 'Identificador o parámetro con formato inválido.';
      } else if (pgCode === '23P01' || rawMessage.includes('ROOM_NO_LONGER_AVAILABLE')) {
        statusCode = HttpStatus.CONFLICT;
        errorTitle = 'Conflict';
        errorMessage =
          'ROOM_NO_LONGER_AVAILABLE: Fechas no disponibles para reserva. Bloqueo o colisión concurrente.';
      } else if (pgCode === '23505') {
        statusCode = HttpStatus.CONFLICT;
        errorTitle = 'Conflict';
        errorMessage =
          'Registro duplicado. Ya existe una entidad con los mismos identificadores únicos.';
      } else if (pgCode === '23503') {
        statusCode = HttpStatus.CONFLICT;
        errorTitle = 'Conflict';
        errorMessage =
          err?.detail || 'Violación de restricción de clave foránea en la base de datos.';
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
        errorMessage = request.url?.includes('/api/v2')
          ? 'Parámetros de solicitud inválidos o restricciones de negocio no cumplidas.'
          : rawMessage.replace(/^ERROR:\s*/, '');
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
        errorTitle = 'Internal Server Error';
        errorMessage = request.url?.includes('/api/v2')
          ? 'Ha ocurrido un error interno al procesar la solicitud en el nodo.'
          : (rawMessage.replace(/^ERROR:\s*/, '') || 'Error en la capa de datos o procedimiento almacenado.');
      }
    }

    const errObj = exception as any;
    const isDev = process.env.NODE_ENV !== 'production';

    response.status(statusCode).json({
      statusCode,
      error: errorTitle,
      message: errorMessage,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(isDev && !request.url?.includes('/api/v2') && errObj && typeof errObj === 'object' && {
        debug: {
          pgCode: errObj.code || null,
          detail: errObj.detail || null,
          table: errObj.table || null,
          column: errObj.column || null,
          constraint: errObj.constraint || null,
          rawMessage: exception instanceof Error ? exception.message : String(exception),
        },
      }),
    });
  }
}

