import { describe, it, expect, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createMockHost() {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const response = { status };
    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => ({ url: '/test' }),
        }),
      } as unknown as ArgumentsHost,
      json,
      status,
    };
  }

  it('should handle HttpException with string message', () => {
    const { host, json, status } = createMockHost();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      message: 'Not found',
      statusCode: 404,
    });
  });

  it('should handle unknown exceptions as 500', () => {
    const { host, json, status } = createMockHost();
    filter.catch(new Error('unexpected'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      message: 'Internal server error',
      statusCode: 500,
    });
  });
});
