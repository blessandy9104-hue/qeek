#!/usr/bin/env node
/**
 * Zoveli doctor: check the local toolchain and optional dependencies.
 *
 * Usage: pnpm run doctor
 *
 * Hard requirements (exit 1 when missing): Node.js >= 22, pnpm.
 * Soft requirements (warnings only): git, Python >= 3.11, mathcore-mcp,
 * Ollama. Anything optional prints how to fix it and never fails the run.
 */
const { execSync, execFileSync } = require('node:child_process');
const http = require('node:http');

const results = [];
function ok(name, detail) {
  results.push({ level: 'ok', name, detail });
}
function warn(name, detail, fix) {
  results.push({ level: 'warn', name, detail, fix });
}
function fail(name, detail, fix) {
  results.push({ level: 'fail', name, detail, fix });
}

function cmdExists(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

// Node.js (hard requirement: node:sqlite needs >= 22)
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major >= 22) ok(`Node.js ${process.versions.node}`, 'meets >= 22 floor (node:sqlite, FTS5)');
else fail(`Node.js ${process.versions.node}`, 'below the >= 22 floor', 'install Node 22 LTS (see README) and re-run');

// pnpm (hard requirement: workspace installs)
if (cmdExists('pnpm')) ok('pnpm', 'available');
else fail('pnpm', 'not on PATH', 'npm install -g pnpm@11.7.0');

// git (needed for clones and version stamps; warn only)
if (cmdExists('git')) ok('git', 'available');
else warn('git', 'not on PATH', 'install git to clone and version the repo');

// Python >= 3.11 (only needed for the vendored verified-math backend)
let python = null;
for (const bin of ['python', 'python3']) {
  try {
    const out = execFileSync(bin, ['--version'], { stdio: 'pipe', timeout: 15000 }).toString();
    const m = out.match(/Python (\d+)\.(\d+)/);
    if (m && (parseInt(m[1], 10) > 3 || (m[1] === '3' && parseInt(m[2], 10) >= 11))) {
      python = `${bin} (${m[0]})`;
      break;
    }
  } catch {
    // try next binary
  }
}
if (python) ok(`Python ${python}`, 'meets >= 3.11 floor for mathcore');
else warn('Python 3.11+', 'missing or too old', 'install Python 3.11+, then pip install -e ./mathcore');

// mathcore-mcp binary (optional: CLI works without it, math tests skip)
if (cmdExists('mathcore-mcp')) ok('mathcore-mcp', 'verified-math backend reachable');
else warn('mathcore-mcp', 'not on PATH — math runs unverified-free, tests skip', 'pip install -e ./mathcore');

// Ollama (optional: free local chat; tools work without any model)
function probeOllama() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/tags', { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (await probeOllama()) ok('Ollama', 'local model server answers (free offline chat)');
  else warn('Ollama', 'not answering — chat needs a key or Ollama', 'install from https://ollama.com, then: ollama pull qwen3:4b');

  let failures = 0;
  let warnings = 0;
  for (const r of results) {
    const tag = r.level === 'ok' ? 'ok  ' : r.level === 'warn' ? 'warn' : 'FAIL';
    console.log(`[${tag}] ${r.name} — ${r.detail}`);
    if (r.fix) console.log(`       fix: ${r.fix}`);
    if (r.level === 'fail') failures += 1;
    if (r.level === 'warn') warnings += 1;
  }
  console.log(`\ndoctor: ${failures === 0 ? 'ready' : 'NOT ready'} (${warnings} warning${warnings === 1 ? '' : 's'}, ${failures} blocking)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
