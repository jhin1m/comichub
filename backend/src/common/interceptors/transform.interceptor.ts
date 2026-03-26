import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    // Skip wrapping for SSE endpoints (NestJS marks them with __sse__ metadata)
    const handler = _context.getHandler();
    if (Reflect.getMetadata('__sse__', handler)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If data already has our response shape, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }
        return {
          success: true,
          data,
          message: 'OK',
        };
      }),
    );
  }
}
