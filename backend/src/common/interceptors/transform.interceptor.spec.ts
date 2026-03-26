import { describe, it, expect } from 'vitest';
import { TransformInterceptor } from './transform.interceptor.js';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  const mockContext = {
    getHandler: () => function mockHandler() {},
  } as unknown as ExecutionContext;

  it('should wrap plain data in standard response', async () => {
    const handler: CallHandler = { handle: () => of({ id: 1, name: 'test' }) };
    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, handler).subscribe(resolve);
    });
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: 'test' },
      message: 'OK',
    });
  });

  it('should pass through data that already has response shape', async () => {
    const existing = { success: true, data: [1], message: 'Done' };
    const handler: CallHandler = { handle: () => of(existing) };
    const result = await new Promise((resolve) => {
      interceptor.intercept(mockContext, handler).subscribe(resolve);
    });
    expect(result).toEqual(existing);
  });
});
