import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

type ErrorResponse = {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.responseBody(exception, statusCode);

    if (statusCode >= 500) {
      this.logger.error(
        `Unhandled API error: ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  private responseBody(exception: unknown, statusCode: number): ErrorResponse {
    const httpResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message = this.message(httpResponse, statusCode);
    return {
      success: false,
      statusCode,
      code: this.code(httpResponse, message, statusCode),
      message,
      details: this.details(httpResponse),
    };
  }

  private message(response: unknown, statusCode: number): string {
    if (typeof response === 'string' && response.trim()) return response.trim();
    if (this.isRecord(response)) {
      const message = response.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
      if (Array.isArray(message) && message.length > 0) {
        return message.filter((item) => typeof item === 'string').join(', ');
      }
    }
    return statusCode === 500
      ? 'Internal server error'
      : 'Unable to complete the request.';
  }

  private code(response: unknown, message: string, statusCode: number): string {
    if (this.isRecord(response) && typeof response.code === 'string') {
      return response.code;
    }
    const normalized = message
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || `HTTP_${statusCode}`;
  }

  private details(response: unknown): unknown {
    if (!this.isRecord(response)) return null;
    if ('details' in response) return response.details;
    const message = response.message;
    return Array.isArray(message) ? message : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
