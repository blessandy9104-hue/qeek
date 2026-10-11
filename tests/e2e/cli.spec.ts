import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';

const CLI = 'apps/assistant-cli/dist/cli.js';

function waitForOutput(
  stream: NodeJS.ReadableStream,
  text: string,
  timeout = 60000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for: ${text}`)),
      timeout
    );
    stream.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes(text)) {
        clearTimeout(timer);
        resolve(buffer);
      }
    });
  });
}

test.describe('CLI Application', () => {
  test('boots and lists tools', async () => {
    const cli = spawn('node', [CLI], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await waitForOutput(cli.stdout, 'qeek — local-first assistant');
      cli.stdin.write('/tools\n');
      // vault_graph sorts last; waiting for it guarantees the full list.
      const out = await waitForOutput(cli.stdout, 'vault_graph');
      expect(out).toContain('mathcore_compute');
      expect(out).toContain('sysinfo_snapshot');
    } finally {
      cli.stdin.write('/quit\n');
      await new Promise((r) => cli.on('close', r));
    }
  });

  test('verified math over stdio', async () => {
    const cli = spawn('node', [CLI], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await waitForOutput(cli.stdout, 'local-first assistant');
      cli.stdin.write('/math 2+2\n');
      const out = await waitForOutput(cli.stdout, '"value": "4"');
      expect(out).toContain('VERIFIED');
    } finally {
      cli.stdin.write('/quit\n');
      await new Promise((r) => cli.on('close', r));
    }
  });

  test('exits zero on /quit', async () => {
    const cli = spawn('node', [CLI], { stdio: ['pipe', 'pipe', 'pipe'] });
    await waitForOutput(cli.stdout, 'local-first assistant');
    cli.stdin.write('/quit\n');
    const code = await new Promise((r) => cli.on('close', r));
    expect(code).toBe(0);
  });
});

test.describe('Web Application', () => {
  test('health endpoint reports tool count', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tools).toBeGreaterThan(20);
  });

  test('tools API lists mathcore tools', async ({ request }) => {
    const res = await request.get('/api/tools');
    const tools = await res.json();
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('mathcore_compute');
    expect(names).toContain('sysinfo_snapshot');
  });

  test('chat API verifies bare arithmetic', async ({ request }) => {
    const res = await request.post('/api/chat', { data: { message: '2+2' } });
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(JSON.stringify(body.reply)).toContain('4');
  });

  test('UI sends a message and shows VERIFIED badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('qeek');
    await page.fill('[data-testid="chat-input"]', '2+2');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();
    await expect(page.locator('[data-testid="verification-badge"]').first()).toContainText(
      'VERIFIED'
    );
  });

  test('UI lists tools', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="tools-list"]')).toContainText(
      'mathcore_compute'
    );
  });
});

test.describe('Auth (email OTP, proton.me compatible)', () => {
  const email = `e2e-${Date.now()}@proton.me`;

  test('request + verify + me + logout over API', async ({ request }) => {
    const req = await request.post('/api/auth/request', { data: { email } });
    expect(req.ok()).toBeTruthy();
    const reqBody = await req.json();
    expect(reqBody.ok).toBe(true);
    expect(reqBody.devCode).toMatch(/^\d{6}$/);

    const bad = await request.post('/api/auth/verify', {
      data: { email, code: '000000' },
    });
    expect(bad.status()).toBe(401);

    const good = await request.post('/api/auth/verify', {
      data: { email, code: reqBody.devCode },
    });
    expect(good.ok()).toBeTruthy();
    const setCookie = good.headers()['set-cookie'] || '';
    expect(setCookie).toContain('qeek_session=');

    const me = await request.get('/api/auth/me', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    expect((await me.json()).email).toBe(email);

    const out = await request.post('/api/auth/logout', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    expect(out.ok()).toBeTruthy();
  });

  test('login page completes signup with a proton.me address', async ({ page }) => {
    const addr = `ui-${Date.now()}@proton.me`;
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', addr);
    await page.click('[data-testid="login-send"]');
    await expect(page.locator('[data-testid="login-status"]')).toContainText(
      'Code sent'
    );

    // In test mode the server echoes the code via the API — standing in
    // for the email a real SMTP sink would deliver to the proton.me inbox.
    const codeRes = await page.request.post('/api/auth/request', {
      data: { email: addr },
    });
    const { devCode } = await codeRes.json();
    expect(devCode).toMatch(/^\d{6}$/);
    await page.fill('[data-testid="login-code"]', devCode);
    await page.click('[data-testid="login-verify"]');
    await expect(page.locator('[data-testid="login-status"]')).toContainText(
      `Signed in as ${addr}`
    );
  });

  test('rejects invalid email addresses', async ({ request }) => {
    const res = await request.post('/api/auth/request', {
      data: { email: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
  });
});
