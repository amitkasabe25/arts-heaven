import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiEnvelope } from '../responses/api-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string[]> | undefined;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        message = typeof body.message === 'string' ? body.message : exception.message;
        if (Array.isArray(body.message)) message = 'Validation failed';
        if (body.errors && typeof body.errors === 'object')
          errors = body.errors as Record<string, string[]>;
        if (typeof body.code === 'string') code = body.code;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`${request.method} ${request.url}: unknown failure`);
    }

    const body: ApiEnvelope<null> = {
      success: false,
      message,
      data: null,
      code,
      errors,
    };
    response.status(status).json(body);
  }
}
