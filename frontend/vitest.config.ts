import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    root: './',
    include: ['**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/**/*.ts',
        'hooks/**/*.ts',
        'contexts/**/*.tsx',
        'components/**/*.tsx',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.types.ts',
        'types/**',
        'components/ui/**',
      ],
      thresholds: {
        'lib/utils.ts': { statements: 100, lines: 100 },
        'lib/notification-grouping.ts': { statements: 100, lines: 100 },
        'lib/api-client.ts': { statements: 80, lines: 80 },
        'contexts/**/*.tsx': { statements: 78, lines: 78 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
