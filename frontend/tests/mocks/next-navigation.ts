import { vi } from 'vitest';

// Shared stable router object — all calls to useRouter() return the same spies
// so tests can assert on push/replace without reference mismatch.
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

const useRouter = vi.fn(() => mockRouter);

const useSearchParams = vi.fn(() => new URLSearchParams());
const usePathname = vi.fn(() => '/');
const useParams = vi.fn(() => ({}));
const redirect = vi.fn();
const notFound = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter,
  useSearchParams,
  usePathname,
  useParams,
  redirect,
  notFound,
}));

export { useRouter, useSearchParams, usePathname, useParams, redirect, notFound };
