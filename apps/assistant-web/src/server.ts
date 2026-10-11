import * as http from 'node:http';
import { QeekHost, defaultPlugins, chatConfigFromEnv, chat } from '@qeek/qeek-host';
import {
  qeekAuth, issueCode, verifyCode, mintSession,
  sessionEmailFromCookie, sessionCookie, clearSessionCookie,
  deliverCode,
} from '@qeek/qeek-auth';

const PORT = parseInt(process.env.PORT || '3080', 10);
const HOST = '127.0.0.1';

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c: Buffer) => {
      raw += c.toString('utf-8');
      if (raw.length > 1_000_000) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>qeek — local-first assistant</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
  #log { border: 1px solid #ccc; border-radius: 8px; min-height: 240px; padding: 1rem; margin-bottom: 1rem; white-space: pre-wrap; }
  .badge { display: inline-block; font-size: 0.75rem; background: #e6f4ea; color: #137333; border-radius: 4px; padding: 0 6px; margin-left: 8px; }
  form { display: flex; gap: 8px; }
  input { flex: 1; padding: 8px; }
  button { padding: 8px 16px; }
  #tools { font-size: 0.85rem; color: #444; }
</style>
</head>
<body>
<h1>qeek</h1>
<p>Local-first assistant. Math is verified by mathcore; everything runs on your machine. <a href="/login" data-testid="login-link">Log in / sign up</a> with any email address, including your @proton.me address — we send a login code, no password needed.</p>
<div id="log" data-testid="chat-log"></div>
<form id="composer">
  <input id="chat-input" data-testid="chat-input" placeholder="Ask anything — try: derivative of x^2" autocomplete="off" />
  <button type="submit" data-testid="send-button">Send</button>
</form>
<h2>Tools</h2>
<div id="tools" data-testid="tools-list">loading…</div>
<script>
const log = document.getElementById('log');
const form = document.getElementById('composer');
const input = document.getElementById('chat-input');
function addMsg(role, text, verified) {
  const div = document.createElement('div');
  div.setAttribute('data-testid', role === 'user' ? 'user-message' : 'assistant-message');
  div.textContent = (role === 'user' ? 'you: ' : 'qeek: ') + text;
  if (verified) {
    const b = document.createElement('span');
    b.setAttribute('data-testid', 'verification-badge');
    b.className = 'badge';
    b.textContent = 'VERIFIED';
    div.appendChild(b);
  }
  log.appendChild(div);
}
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg('user', text, false);
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });
  const data = await res.json();
  addMsg('assistant', data.reply || data.error || '(empty reply)', !!data.verified);
});
fetch('/api/tools').then((r) => r.json()).then((tools) => {
  document.getElementById('tools').textContent = tools.map((t) => t.name).join(', ');
});
</script>
</body>
</html>`;

async function main(): Promise<void> {
  const host = new QeekHost();
  const agent = host.mount([...(defaultPlugins as any), qeekAuth]);
  const systemSections = agent.systemSections;
  const chatCfg = chatConfigFromEnv();
  const baseSystem = [
    'You are qeek, a personal assistant with verified computation and persistent memory.',
    'For any arithmetic, algebra, calculus, linear algebra, number theory, logic, statistics or unit conversion: do not compute in your head. Call the mathcore tools and state only verified values. If a result is WITHHELD, say so; never guess.',
    ...systemSections,
  ].join('\n\n');
  const history: any[] = [];

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
      if (req.method === 'GET' && url.pathname === '/') {
        const text = PAGE;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(text),
        });
        res.end(text);
        return;
      }
const LOGIN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>qeek — log in</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  input, button { padding: 8px; margin: 4px 0; width: 100%; box-sizing: border-box; }
  #status { min-height: 1.5em; color: #444; }
</style>
</head>
<body>
<h1>Log in / sign up</h1>
<p>Enter any email address — including <code>@proton.me</code> — and we will send a 6-digit code. No password, no OAuth middleman.</p>
<div id="status" data-testid="login-status"></div>
<form id="email-form">
  <input id="login-email" data-testid="login-email" type="email" placeholder="you@proton.me" required />
  <button type="submit" data-testid="login-send">Send code</button>
</form>
<form id="code-form" style="display:none">
  <input id="login-code" data-testid="login-code" inputmode="numeric" placeholder="123456" required />
  <button type="submit" data-testid="login-verify">Verify</button>
</form>
<script>
const status = document.getElementById('status');
let email = '';
document.getElementById('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  email = document.getElementById('login-email').value.trim();
  const res = await fetch('/api/auth/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!data.ok) { status.textContent = data.error || 'failed'; return; }
  status.textContent = 'Code sent — check your inbox.';
  document.getElementById('code-form').style.display = 'block';
});
document.getElementById('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('login-code').value.trim();
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  status.textContent = data.ok ? ('Signed in as ' + data.email) : ('Failed: ' + (data.reason || data.error));
});
</script>
</body>
</html>`;

      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true, tools: host.tools().length });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/tools') {
        json(
          res,
          200,
          host.tools().map((t) => ({ name: t.name, description: t.description, plugin: t.plugin }))
        );
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/run') {
        const body = await readBody(req);
        if (!body.tool) {
          json(res, 400, { ok: false, error: 'missing tool' });
          return;
        }
        try {
          const result = await host.runTool(body.tool, body.args ?? {});
          json(res, 200, { ok: true, result });
        } catch (e) {
          json(res, 200, {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/chat') {
        const body = await readBody(req);
        const message = String(body.message ?? '').trim();
        if (!message) {
          json(res, 400, { ok: false, error: 'missing message' });
          return;
        }
        // Offline fast path: verified math without any model.
        if (/^[0-9\s+\-*/^().!%]+$/.test(message) && /\d/.test(message)) {
          try {
            const out = await host.runTool('mathcore_compute', { expression: message });
            json(res, 200, {
              ok: true,
              reply: typeof out === 'string' ? out : JSON.stringify(out),
              verified: true,
            });
          } catch (e) {
            json(res, 200, {
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          return;
        }
        if (!chatCfg) {
          json(res, 200, {
            ok: true,
            verified: false,
            reply:
              'Chat needs a model (set DEEPSEEK_API_KEY). Meanwhile I can run tools: try /api/run, e.g. {"tool":"sysinfo_snapshot"}.',
          });
          return;
        }
        const next = await chat(host, chatCfg, baseSystem, history, message, () => {});
        history.length = 0;
        history.push(...next);
        const last = [...next]
          .reverse()
          .find((m: any) => m.role === 'assistant' && m.content);
        json(res, 200, { ok: true, verified: false, reply: last?.content ?? '(empty)' });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(LOGIN_PAGE),
        });
        res.end(LOGIN_PAGE);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/request') {
        const body = await readBody(req);
        try {
          const { code, email } = issueCode(String(body.email ?? ''));
          const delivery = await deliverCode(email, code);
          json(res, 200, {
            ok: true,
            emailed: delivery.delivered,
            // Test-only escape hatch: echo the code so e2e can complete the
            // flow without an SMTP server. Never enable in production.
            ...(process.env.QEEK_AUTH_DEV_ECHO === '1' ? { devCode: code } : {}),
          });
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
        const body = await readBody(req);
        const verdict = verifyCode(String(body.email ?? ''), String(body.code ?? ''));
        if (!verdict.ok) {
          json(res, 401, { ok: false, reason: verdict.reason });
          return;
        }
        const token = mintSession(verdict.email);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': sessionCookie(token),
        });
        res.end(JSON.stringify({ ok: true, email: verdict.email }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        json(res, 200, { email: sessionEmailFromCookie(req.headers.cookie) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': clearSessionCookie(),
        });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      json(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      json(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`qeek web UI running at http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
