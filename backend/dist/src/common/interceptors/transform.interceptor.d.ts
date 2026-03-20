import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
    meta?: Record<string, unknown>;
}
export declare class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>>;
}
