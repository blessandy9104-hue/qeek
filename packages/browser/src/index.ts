import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliBrowser = definePlugin({
  name: 'zoveli-browser',
  description: 'Browser automation with Playwright',

  setup(ctx) {
    ctx.register('browser-config', {
      engine: 'playwright',
      headless: true,
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Assistant/1.0',
      timeout: 30000,
      slowMo: 0,
      args: ['--disable-blink-features=AutomationControlled']
    });

    ctx.register('browser-contexts', {
      default: {
        acceptDownloads: true,
        bypassCSP: false,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        locale: 'en-US',
        timezoneId: 'UTC'
      },
      stealth: {
        acceptDownloads: true,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    ctx.register('browser-policy', {
      allowedDomains: ['*'],
      blockedDomains: [],
      requireConfirmation: ['download', 'file-upload', 'payment'],
      maxConcurrentPages: 5,
      maxHistorySize: 100
    });
  }
});

export default zoveliBrowser;

