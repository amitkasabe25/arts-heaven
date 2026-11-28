import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ApiSuccess, isApiEnvelope } from './api-response';

export const API_MESSAGE_KEY = 'api_message';
export const ApiMessage = (message: string) => SetMetadata(API_MESSAGE_KEY, message);

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const message =
      this.reflector.getAllAndOverride<string>(API_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Request completed successfully';

    return next.handle().pipe(
      map((value: unknown) => {
        if (isApiEnvelope(value)) return value;
        if (value && typeof value === 'object' && 'data' in value && 'meta' in value) {
          const paged = value as { data: unknown; meta: Record<string, unknown> };
          return new ApiSuccess(message, paged.data, paged.meta);
        }
        return new ApiSuccess(message, value ?? null);
      }),
    );
  }
}
