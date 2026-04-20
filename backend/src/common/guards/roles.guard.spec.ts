import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';

function mockContext(user: unknown, roles?: string[]): ExecutionContext {
  const reflector = {
    getAllAndOverride: () => roles,
  } as unknown as Reflector;
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  (context as unknown as { _reflector: Reflector })._reflector = reflector;
  return context;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const make = (user: unknown, roles?: string[]): boolean => {
    const reflector = {
      getAllAndOverride: () => roles,
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
    return guard.canActivate(mockContext(user, roles));
  };

  beforeEach(() => {
    guard = new RolesGuard({} as Reflector);
  });

  it('allows when no roles metadata (non-role-restricted endpoint)', () => {
    expect(make({ role: 'user' }, undefined)).toBe(true);
  });

  it('denies when roles required but user missing (H1 default-deny)', () => {
    expect(make(undefined, ['admin'])).toBe(false);
  });

  it('denies when user role does not match', () => {
    expect(make({ role: 'user' }, ['admin'])).toBe(false);
  });

  it('allows when user role matches required', () => {
    expect(make({ role: 'admin' }, ['admin'])).toBe(true);
  });

  it('denies when user has no role property', () => {
    expect(make({}, ['admin'])).toBe(false);
  });
});
