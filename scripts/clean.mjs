#!/usr/bin/env node
/**
 * Cross-platform clean: removes every dist directory under
 * packages and apps.
 * (Per-package `clean` scripts use `rm -rf`, which only works on Unix;
 * this root driver works everywhere Node runs.)
 */
import { rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let removed = 0;
for (const group of ['packages', 'apps']) {
  let entries = [];
  try {
    entries = readdirSync(join(root, group), { withFileTypes: true });
  } catch {
    continue;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dist = join(root, group, e.name, 'dist');
    if (existsSync(dist)) {
      rmSync(dist, { recursive: true, force: true });
      removed++;
      console.log('removed', `${group}/${e.name}/dist`);
    }
  }
}
console.log(`clean done: ${removed} dist director${removed === 1 ? 'y' : 'ies'} removed`);

// Test-run scratch: auth OTP/session material and property-test cache.
// All gitignored; safe to drop when no server or test run is active.
for (const extra of [
  join(root, 'test-auth-data', 'auth.json'),
  join(root, 'test-auth-data', '.session-secret'),
  join(root, '.hypothesis'),
]) {
  if (existsSync(extra)) {
    rmSync(extra, { recursive: true, force: true });
    console.log('removed', extra.replace(root + '/', ''));
  }
}
