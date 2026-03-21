import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        // test files
        'src/**/*.spec.ts',
        // declarative / no testable business logic
        'src/**/*.dto.ts',
        'src/**/*.module.ts',
        'src/**/*.decorator.ts',
        'src/**/*.type.ts',
        'src/**/*.types.ts',
        // auto-generated schema / migrations / seed
        'src/database/schema/**',
        'src/database/seed/**',
        'src/database/migrations/**',
        // controllers: pure delegation, no business logic (tested via integration)
        'src/**/*.controller.ts',
        // Passport strategies: OAuth flows require real provider round-trips
        'src/**/strategies/**',
        // Passport middleware wrappers (zero logic)
        'src/**/middleware/**',
        // Event data-transfer objects (plain TypeScript classes)
        'src/**/events/**',
        // External HTTP integration (Discord webhook) — tested separately
        'src/**/discord/**',
        // Sitemap generation — infrastructure / not business logic
        'src/modules/sitemap/**',
        // entry point
        'src/main.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [swc.vite()],
});
