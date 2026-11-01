import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { RedisUnavailableException } from '@unisaas/redis-client';
import { TenantContextException } from '@unisaas/database';
import { DomainException } from '@unisaas/core-domain';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request?.url || '';

    // 1. Manejo prioritario de caídas de Redis (HTTP 503 con Retry-After: 5)
    if (exception instanceof RedisUnavailableException) {
      this.logger.error(`[503 Service Unavailable] Falla de Redis en ${path}: ${exception.message}`);

      response.status(HttpStatus.SERVICE_UNAVAILABLE)
        .header('Retry-After', String(exception.retryAfter || 5))
        .json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: exception.message,
          retryAfterSeconds: exception.retryAfter || 5,
          timestamp,
          path,
        });
      return;
    }

    // 2. Manejo de excepciones de aislamiento de inquilino (HTTP 400)
    if (exception instanceof TenantContextException) {
      this.logger.warn(`[400 TenantContextException] En ${path}: ${exception.message}`);

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.message,
        timestamp,
        path,
      });
      return;
    }

    // 3. Manejo de excepciones puras de dominio (Money, Quantity, PUC) (HTTP 400)
    if (exception instanceof DomainException) {
      this.logger.warn(`[400 DomainException] En ${path}: ${exception.message}`);

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Domain Validation Error',
        message: exception.message,
        timestamp,
        path,
      });
      return;
    }

    // 4. Manejo estándar de excepciones HTTP de NestJS
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message = typeof res === 'object' && res !== null && 'message' in res ? (res as { message: unknown }).message : exception.message;

      if (status >= 500) {
        this.logger.error(`[${status} HttpException] En ${path}: ${exception.message}`);
      }

      response.status(status).json({
        statusCode: status,
        error: exception.name,
        message,
        timestamp,
        path,
      });
      return;
    }

    // 5. Excepciones no controladas (HTTP 500)
    const errorMsg = exception instanceof Error ? exception.message : 'Error interno inesperado';
    this.logger.error(`[500 InternalServerError] En ${path}: ${errorMsg}`, exception instanceof Error ? exception.stack : undefined);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ha ocurrido un error inesperado en el servidor',
      timestamp,
      path,
    });
  }
}

