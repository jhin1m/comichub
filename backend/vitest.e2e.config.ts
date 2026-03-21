import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['tests/e2e/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    // E2E tests may take longer due to app initialization
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run sequentially — shared app instance, stateful mock DB
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [swc.vite()],
});
