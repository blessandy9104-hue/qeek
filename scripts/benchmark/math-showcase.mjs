// qeek verified-math showcase: runs a fixed problem set through the
// mathcore MCP server and prints VERIFIED / WITHHELD + certificate hashes.
// Usage: MATHCORE_AUDIT=./audit.jsonl node scripts/benchmark/math-showcase.mjs
import { spawn } from 'node:child_process';

const PROBLEMS = [
  'solve x^2 - 5x + 6 = 0',
  'derivative of x^3*sin(x)',
  'integrate sin(x)^2 from 0 to pi',
  'determinant of [[1,2],[3,4]]',
  'factor_int 10403',
  'prove integer: x*x >= x',
];

function mcpRequest(method, params) {
  return new Promise((resolve, reject) => {
    const child = spawn('mathcore-mcp', [], { stdio: ['pipe', 'pipe', 'inherit'] });
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) + '\n';
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
      try {
        const msg = JSON.parse(out.split('\n')[0]);
        child.kill();
        resolve(msg);
      } catch { /* wait for more */ }
    });
    child.on('error', reject);
    child.stdin.write(payload);
    child.stdin.end();
    setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 30000);
  });
}

let verified = 0, withheld = 0;
for (const p of PROBLEMS) {
  try {
    const res = await mcpRequest('compute', { request: p });
    const text = JSON.stringify(res.result ?? res).slice(0, 160);
    const ok = /verified/i.test(text) && !/withheld/i.test(text);
    if (ok) verified++; else withheld++;
    console.log(`${ok ? 'VERIFIED ' : 'WITHHELD '} ${p} :: ${text}`);
  } catch (e) {
    withheld++;
    console.log(`WITHHELD  ${p} :: ${e.message} (server unavailable?)`);
  }
}
console.log(`\nSummary: ${verified} verified, ${withheld} withheld / unavailable out of ${PROBLEMS.length}`);
console.log('Audit trail: check $MATHCORE_AUDIT for hash-chained certificates.');
