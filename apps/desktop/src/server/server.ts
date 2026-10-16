import * as http from 'node:http';
import { ZoveliHost, defaultPlugins, resolveChatConfig, chat, isLocalProvider } from '@zoveli/host';
import { promptSectionsText } from '@zoveli/core';
import {
  zoveliAuth, issueCode, verifyCode, mintSession,
  sessionEmailFromCookie, sessionCookie, clearSessionCookie,
  deliverCode,
} from '@zoveli/auth';
import { redactSecrets } from '@zoveli/secscan';
import {
  withSecurityHeaders,
  isHostAllowed,
  RateLimiter,
  bearerAuthorized,
  parseChatMessage,
  parseRunCall,
  hstsForRequest,
} from './security.js';
import {
  themeCSS,
  themeSwitcherHTML,
  themeHeadScript,
  themeBootScript,
  unicornProjectId,
} from './themes.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PORT = parseInt(process.env.PORT || '3080', 10);
const HOST = '127.0.0.1';

// Vendored Lenis smooth-scroll runtime (same origin, pinned version).
// Resolves from dist/../../vendor in production and apps/desktop/vendor in dev.
function loadVendorLenis(): Buffer | null {
  // Works in CJS (tsc) and ESM (tsdown) outputs alike.
  const here =
    typeof __dirname === 'string' && __dirname
      ? __dirname
      : path.dirname(process.argv[1] || process.cwd());
  const candidates = [
    path.join(here, '..', '..', 'vendor', 'lenis.min.js'),
    path.join(here, '..', 'vendor', 'lenis.min.js'),
    path.join(process.cwd(), 'apps', 'desktop', 'vendor', 'lenis.min.js'),
  ];
  for (const file of candidates) {
    try {
      return fs.readFileSync(file);
    } catch {
      // try next
    }
  }
  return null;
}
const LENIS_BUNDLE = loadVendorLenis();

// Per-IP sliding windows: auth endpoints are OTP-sensitive (tight),
// tool-running routes are LLM-costly (generous but bounded).
const authLimiter = new RateLimiter(30, 60_000);
const apiLimiter = new RateLimiter(120, 60_000);

// Test-mode escape hatch: the e2e suite runs 5 browser projects against
// one server, which would legitimately trip per-IP budgets (auth PROVEN to
// 429 the last project on CI). DEV_ECHO already marks test mode — it echoes
// OTP codes — so limits stay enforced everywhere else, including production.
function rateLimitsEnabled(): boolean {
  return process.env.ZOVELI_AUTH_DEV_ECHO !== '1';
}

function clientIp(req: http.IncomingMessage): string {
  return req.socket?.remoteAddress || 'unknown';
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, withSecurityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(text)),
  }));
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
<html lang="en" data-theme="daylight" data-testid="app-root">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Zoveli AI — local-first assistant</title>
${themeHeadScript()}
<style>
  ${themeCSS()}
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; background: var(--bg); color: var(--fg); position: relative; z-index: 1; }
  #log { border: 1px solid var(--border); border-radius: 8px; min-height: 240px; padding: 1rem; margin-bottom: 1rem; white-space: pre-wrap; background: var(--panel); }
  .badge { display: inline-block; font-size: 0.75rem; background: var(--badge-bg); color: var(--badge-fg); border-radius: 4px; padding: 0 6px; margin-left: 8px; }
  form { display: flex; gap: 8px; }
  input { flex: 1; padding: 8px; background: var(--panel); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; }
  button { padding: 8px 16px; }
  #starters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1rem; }
  #starters button { font-size: 0.85rem; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--fg); cursor: pointer; }
  #tools { font-size: 0.85rem; color: var(--muted); }
  a { color: var(--accent); }
</style>
</head>
<body>
<div id="us-bg" aria-hidden="true"></div>
<h1>Zoveli AI</h1>
<p>Local-first assistant. Math is verified by mathcore; everything runs on your machine. <a href="/login" data-testid="login-link">Log in / sign up</a> with any email address, including your @proton.me address — we send a login code, no password needed.</p>
<p>No account needed for local tools. Math answers carry a <span class="badge">VERIFIED</span> badge — anything unverified is withheld, never guessed.</p>
<div id="starters" data-testid="suggestion-chips">
  <button type="button" data-testid="suggestion-chip" data-q="2+2">2+2</button>
  <button type="button" data-testid="suggestion-chip" data-q="(3+4)*5">(3+4)*5</button>
  <button type="button" data-testid="suggestion-chip" data-q="10!">10!</button>
</div>
<div id="log" data-testid="chat-log"></div>
<div><button type="button" data-testid="chat-clear" id="clear-chats" style="font-size:.8rem;margin-bottom:1rem">Clear chats (stored in this browser only)</button></div>
<form id="composer">
  <input id="chat-input" data-testid="chat-input" placeholder="Ask anything — try: 2+2 (verified offline)" autocomplete="off" />
  <button type="submit" data-testid="send-button">Send</button>
</form>
<h2>Tools</h2>
<div id="tools" data-testid="tools-list">loading…</div>
${themeSwitcherHTML()}
<script src="/vendor/lenis.min.js" defer></script>
${themeBootScript(unicornProjectId())}
<script>
const log = document.getElementById('log');
const form = document.getElementById('composer');
const input = document.getElementById('chat-input');
document.querySelectorAll('[data-testid="suggestion-chip"]').forEach((chip) => {
  chip.addEventListener('click', () => {
    input.value = chip.getAttribute('data-q') || '';
    form.requestSubmit();
  });
});
function addMsg(role, text, verified, meta) {
  const div = document.createElement('div');
  div.setAttribute('data-testid', role === 'user' ? 'user-message' : 'assistant-message');
  div.appendChild(document.createTextNode((role === 'user' ? 'you: ' : 'zoveli: ')));
  appendLinkified(div, text);
  if (verified) {
    const b = document.createElement('span');
    b.setAttribute('data-testid', 'verification-badge');
    b.className = 'badge';
    b.textContent = 'VERIFIED';
    div.appendChild(b);
  }
  if (meta) {
    const m = document.createElement('div');
    m.setAttribute('data-testid', 'reply-meta');
    m.style.cssText = 'font-size:.75rem;opacity:.75;margin-top:2px';
    m.textContent = meta;
    div.appendChild(m);
  }
  log.appendChild(div);
  saveChat(role, text, verified, meta);
}
// Mirrors render.ts splitUrls (tested there): safe link rendering —
// http(s) URLs become links, everything else stays inert text.
// Regex-free on purpose: no backslash escaping across template layers.
function appendLinkified(el, text) {
  var last = 0, i = 0;
  while (i < text.length) {
    var h = text.indexOf('http', i);
    if (h < 0) break;
    var prefix = '';
    if (text.startsWith('https://', h)) prefix = 'https://';
    else if (text.startsWith('http://', h)) prefix = 'http://';
    if (prefix === '') { i = h + 4; continue; }
    var end = h + prefix.length;
    // Char-code terminators: space, tab, newline, angle brackets, quotes,
    // paren, bracket, brace. Codes avoid escaping issues in this template.
    var TERMINATORS = [32, 9, 10, 60, 62, 34, 39, 41, 93, 125];
    while (end < text.length && TERMINATORS.indexOf(text.charCodeAt(end)) < 0) end++;
    var link = text.slice(h, end);
    while (link.length > prefix.length && '.,;:!?'.indexOf(link[link.length - 1]) >= 0) link = link.slice(0, -1);
    if (link.length <= prefix.length) { i = h + prefix.length; continue; }
    if (h > last) el.appendChild(document.createTextNode(text.slice(last, h)));
    var a = document.createElement('a');
    a.href = link; a.rel = 'noopener'; a.target = '_blank';
    a.textContent = link;
    el.appendChild(a);
    last = h + link.length;
    i = h + link.length;
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}
// Recent chats live in this browser only (Duck.ai principle, local-first):
// persisted across reloads, capped, erasable, never sent anywhere.
const CHAT_KEY = 'zoveli-chats';
const CHAT_CAP = 100;
function loadChats() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
    if (!Array.isArray(raw)) return;
    raw.slice(-CHAT_CAP).forEach((m) => {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') {
        const div = document.createElement('div');
        div.setAttribute('data-testid', m.role === 'user' ? 'user-message' : 'assistant-message');
        div.appendChild(document.createTextNode((m.role === 'user' ? 'you: ' : 'zoveli: ') + m.text));
        log.appendChild(div);
      }
    });
  } catch (e) {}
}
function saveChat(role, text, verified, meta) {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
    raw.push({ role, text: String(text).slice(0, 4000), verified: !!verified, meta: meta || '' });
    localStorage.setItem(CHAT_KEY, JSON.stringify(raw.slice(-CHAT_CAP)));
  } catch (e) {}
}
function clearChats() {
  try { localStorage.removeItem(CHAT_KEY); } catch (e) {}
  log.innerHTML = '';
}
loadChats();
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
  const meta = data.model ? ('via ' + data.model + (data.local === false ? '' : ' · stays on this machine')) : '';
  addMsg('assistant', data.reply || data.error || '(empty reply)', !!data.verified, meta);
});
fetch('/api/tools').then((r) => r.json()).then((tools) => {
  document.getElementById('tools').textContent = tools.map((t) => t.name).join(', ');
});
document.getElementById('clear-chats').addEventListener('click', clearChats);
</script>
</body>
</html>`;

async function main(): Promise<void> {
  const host = new ZoveliHost();
  const agent = host.mount([...(defaultPlugins as any), zoveliAuth]);
  const systemSections = agent.systemSections;
  // Any API key wins; otherwise a free local Ollama server when one answers;
  // otherwise tools-only offline mode (probe refuses instantly when absent).
  const chatCfg = await resolveChatConfig();
  const baseSystem = [
    'You are Zoveli, a personal helper that shows its work in math and remembers what matters to you.',
    'For any arithmetic, algebra, calculus, linear algebra, number theory, logic, statistics or unit conversion: do not compute in your head. Call the mathcore tools and state only verified values. If a result is WITHHELD, say so; never guess.',
    promptSectionsText(),
    ...systemSections,
  ].join('\n\n');
  const history: any[] = [];

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
      // DNS-rebinding guard: only loopback (or explicitly allowed) Hosts.
      if (!isHostAllowed(req.headers.host)) {
        json(res, 403, { ok: false, error: 'forbidden host' });
        return;
      }
      // HSTS behind TLS (direct or proxied); localhost stays plain http.
      const hsts = hstsForRequest(req);
      if (Object.keys(hsts).length > 0) {
        const origWriteHead = res.writeHead.bind(res);
        (res as unknown as { writeHead: (...args: never[]) => unknown }).writeHead = ((
          status: number,
          headers?: Record<string, string>
        ) => origWriteHead(status, { ...hsts, ...headers })) as never;
      }
      if (req.method === 'GET' && url.pathname === '/') {
        const text = PAGE;
        res.writeHead(200, withSecurityHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(text)),
        }));
        res.end(text);
        return;
      }
const LOGIN_PAGE = `<!doctype html>
<html lang="en" data-theme="daylight" data-testid="app-root">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Zoveli AI — log in</title>
${themeHeadScript()}
<style>
  ${themeCSS()}
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; background: var(--bg); color: var(--fg); position: relative; z-index: 1; }
  input, button { padding: 8px; margin: 4px 0; width: 100%; box-sizing: border-box; }
  input { background: var(--panel); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; }
  #status { min-height: 1.5em; color: var(--muted); }
  a { color: var(--accent); }
</style>
</head>
<body>
<div id="us-bg" aria-hidden="true"></div>
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
${themeSwitcherHTML()}
<script src="/vendor/lenis.min.js" defer></script>
${themeBootScript(unicornProjectId())}
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
      // Vendored Lenis runtime (same origin, pinned; missing file → 404 and
      // pages fall back to native scroll via the window.Lenis guard).
      if (req.method === 'GET' && url.pathname === '/vendor/lenis.min.js') {
        if (!LENIS_BUNDLE) {
          json(res, 404, { ok: false, error: 'not found' });
          return;
        }
        res.writeHead(200, withSecurityHeaders({
          'Content-Type': 'text/javascript; charset=utf-8',
          'Content-Length': String(LENIS_BUNDLE.length),
          'Cache-Control': 'public, max-age=86400',
        }));
        res.end(LENIS_BUNDLE);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/run') {        let tool: string;
        let args: Record<string, unknown>;
        try {
          ({ tool, args } = parseRunCall(await readBody(req)));
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
          return;
        }
        if (!bearerAuthorized(req)) {
          json(res, 401, { ok: false, error: 'unauthorized' });
          return;
        }
        if (rateLimitsEnabled() && !apiLimiter.allow(`run:${clientIp(req)}`)) {
          res.writeHead(429, withSecurityHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          }));
          res.end(JSON.stringify({ ok: false, error: 'rate limited' }));
          return;
        }
        try {
          const result = await host.runTool(tool, args);
          json(res, 200, { ok: true, result });
        } catch (e) {
          json(res, 200, {
            ok: false,
            error: redactSecrets(e instanceof Error ? e.message : String(e)),
          });
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/chat') {
        let message: string;
        try {
          message = parseChatMessage(await readBody(req));
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
          return;
        }
        if (!bearerAuthorized(req)) {
          json(res, 401, { ok: false, error: 'unauthorized' });
          return;
        }
        if (rateLimitsEnabled() && !apiLimiter.allow(`chat:${clientIp(req)}`)) {
          res.writeHead(429, withSecurityHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          }));
          res.end(JSON.stringify({ ok: false, error: 'rate limited' }));
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
              model: 'mathcore',
              provider: 'local',
              local: true,
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
              'Chat needs a model (set any API key: OPENAI_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY or ZOVELI_API_KEY — or run local Ollama for free: ollama pull qwen3:4b). Meanwhile I can run tools: try /api/run, e.g. {"tool":"sysinfo_snapshot"}.',
          });
          return;
        }
        const next = await chat(host, chatCfg, baseSystem, history, message, () => {});
        history.length = 0;
        history.push(...next);
        const last = [...next]
          .reverse()
          .find((m: any) => m.role === 'assistant' && m.content);
        json(res, 200, {
          ok: true,
          verified: false,
          reply: last?.content ?? '(empty)',
          model: chatCfg.model,
          provider: chatCfg.provider || 'custom',
          local: isLocalProvider(chatCfg),
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, withSecurityHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(LOGIN_PAGE)),
        }));
        res.end(LOGIN_PAGE);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/request') {
        if (rateLimitsEnabled() && !authLimiter.allow(`auth:${clientIp(req)}`)) {
          res.writeHead(429, withSecurityHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          }));
          res.end(JSON.stringify({ ok: false, error: 'rate limited' }));
          return;
        }
        const body = await readBody(req);
        try {
          const { code, email } = issueCode(String(body.email ?? ''));
          const delivery = await deliverCode(email, code);
          json(res, 200, {
            ok: true,
            emailed: delivery.delivered,
            // Test-only escape hatch: echo the code so e2e can complete the
            // flow without an SMTP server. Never enable in production.
            ...(process.env.ZOVELI_AUTH_DEV_ECHO === '1' ? { devCode: code } : {}),
          });
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
        if (rateLimitsEnabled() && !authLimiter.allow(`auth:${clientIp(req)}`)) {
          res.writeHead(429, withSecurityHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          }));
          res.end(JSON.stringify({ ok: false, error: 'rate limited' }));
          return;
        }
        const body = await readBody(req);
        const verdict = verifyCode(String(body.email ?? ''), String(body.code ?? ''));
        if (!verdict.ok) {
          json(res, 401, { ok: false, reason: verdict.reason });
          return;
        }
        const token = mintSession(verdict.email);
        res.writeHead(200, withSecurityHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': sessionCookie(token),
        }));
        res.end(JSON.stringify({ ok: true, email: verdict.email }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        json(res, 200, { email: sessionEmailFromCookie(req.headers.cookie) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        res.writeHead(200, withSecurityHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': clearSessionCookie(),
        }));
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      json(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      json(res, 500, { ok: false, error: redactSecrets(e instanceof Error ? e.message : String(e)) });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Zoveli web UI running at http://${HOST}:${PORT}`);
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




