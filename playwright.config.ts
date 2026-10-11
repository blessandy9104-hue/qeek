import { defineConfig, devices } from '@playwright/test';

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
  // Chromium only: the suite must run on a fresh clone with a single
  // `playwright install chromium`. Add firefox/webkit when CI needs them.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node apps/assistant-web/dist/server.js',
    url: 'http://localhost:3080/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      ASSISTANT_VAULT_PATH: './test-vault',
      MATHCORE_AUDIT: './test-audit.jsonl',
      // Test-only: echo OTP codes in /api/auth/request responses so e2e
      // can complete login without an SMTP server. Never set in production.
      QEEK_AUTH_DEV_ECHO: '1',
      QEEK_AUTH_DIR: './test-auth-data'
    }
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2
    }
  }
});