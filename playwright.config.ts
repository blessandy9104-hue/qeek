import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'os';
import { join } from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000
  },
  // Full matrix: `pnpm exec playwright install` fetches all three engines.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  webServer: {
    command: 'node apps/web/dist/server.js',
    url: 'http://localhost:3080/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      ZOVELI_VAULT_PATH: './test-vault',
      // Isolate the math proof memory: verified e2e computations
      // auto-memorize, which must not touch the developer's home DB
      // or export Markdown into the repo vault.
      ZOVELI_MEMORY_DB: join(tmpdir(), 'zoveli-e2e-web-memory.db'),
      ZOVELI_MEMORY_EXPORT: '0',
      MATHCORE_AUDIT: './test-audit.jsonl',
      // Test-only: echo OTP codes in /api/auth/request responses so e2e
      // can complete login without an SMTP server. Never set in production.
      ZOVELI_AUTH_DEV_ECHO: '1',
      ZOVELI_AUTH_DIR: './test-auth-data'
    }
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2
    }
  }
});
