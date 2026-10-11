import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';

test.describe('CLI Application', () => {
  let cliProcess: ChildProcess;

  test.beforeAll(async () => {
    // Build the project first
    // This would be handled by CI
  });

  test('should show help', async () => {
    const result = await runCLI(['--help']);
    expect(result.stdout).toContain('qeek');
    expect(result.stdout).toContain('Personal Assistant');
  });

  test('should start and respond to chat', async () => {
    cliProcess = spawn('node', ['apps/qeek-cli/dist/cli.js'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ASSISTANT_VAULT_PATH: './test-vault',
        MATHCORE_AUDIT: './test-audit.jsonl'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    await waitForOutput(cliProcess.stdout, 'qeek started');
    
    cliProcess.stdin.write('What is 2 + 2?\n');
    const response = await waitForOutput(cliProcess.stdout, '4');
    expect(response).toContain('VERIFIED');
    
    cliProcess.kill();
  });

  test('should handle math computation', async () => {
    cliProcess = spawn('node', ['apps/qeek-cli/dist/cli.js'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    await waitForOutput(cliProcess.stdout, 'qeek started');
    
    cliProcess.stdin.write('compute derivative of x^2\n');
    const response = await waitForOutput(cliProcess.stdout, '2x');
    expect(response).toContain('VERIFIED');
    
    cliProcess.kill();
  });

  test('should handle memory operations', async () => {
    cliProcess = spawn('node', ['apps/qeek-cli/dist/cli.js'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    await waitForOutput(cliProcess.stdout, 'qeek started');
    
    cliProcess.stdin.write('remember that I like dark mode\n');
    const response = await waitForOutput(cliProcess.stdout, 'saved');
    expect(response.toLowerCase()).toContain('saved');
    
    cliProcess.stdin.write('what do I like?\n');
    const response2 = await waitForOutput(cliProcess.stdout, 'dark mode');
    expect(response2.toLowerCase()).toContain('dark mode');
    
    cliProcess.kill();
  });
});

test.describe('Web Application', () => {
  test('should load web UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('qeek');
  });

  test('should send chat message', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="chat-input"]', 'Hello qeek');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
  });

  test('should show math verification badge', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="chat-input"]', 'What is 2 + 2?');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="verification-badge"]')).toContainText('VERIFIED');
  });

  test('should open vault sidebar', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="vault-toggle"]');
    await expect(page.locator('[data-testid="vault-sidebar"]')).toBeVisible();
  });

  test('should create note from chat', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="chat-input"]', 'Remember that my favorite color is blue');
    await page.click('[data-testid="send-button"]');
    await page.click('[data-testid="vault-toggle"]');
    await expect(page.locator('[data-testid="vault-note"]')).toContainText('blue');
  });
});

function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['apps/qeek-cli/dist/cli.js', ...args], {
      env: { ...process.env, NODE_ENV: 'test' }
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ stdout, stderr, code: code || 0 }));
  });
}

function waitForOutput(stream: NodeJS.ReadableStream, text: string, timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${text}`)), timeout);
    
    stream.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes(text)) {
        clearTimeout(timer);
        resolve(buffer);
      }
    });
  });
}