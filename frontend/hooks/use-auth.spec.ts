import { describe, it, expect } from 'vitest';
import { useAuth } from './use-auth';
import { useAuth as useAuthFromContext } from '@/contexts/auth.context';

describe('use-auth', () => {
  it('re-exports useAuth from auth.context', () => {
    expect(useAuth).toBe(useAuthFromContext);
  });
});
