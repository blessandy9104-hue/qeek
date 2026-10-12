import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/**',
        '**/vitest.*.ts',
        '**/tsdown.config.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4
      }
    },
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    }
  },
  resolve: {
    // NOTE: `@zoveli/*` maps to local package sources; the old glob-based
    // mapping resolved to a literal `packages/*/src` path and never worked.
    alias: [
      {
        find: /^@zoveli\/([^/]+)\/src(.*)$/,
        replacement: path.resolve(__dirname, 'packages/$1/src$2'),
      },
    ],
  }
});