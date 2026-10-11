import { definePlugin } from '@deepseek-ai/dsh-core';
import * as fs from 'fs/promises';
import * as path from 'path';

interface HealthReport {
  projectPath: string;
  score: number;
  checks: { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }[];
}

export const qeekHealth = definePlugin({
  name: 'qeek-health',
  description: 'Project health: deps, tests, docs, freshness',

  setup(ctx) {
    async function check(projectPath: string): Promise<HealthReport> {
      const checks: HealthReport['checks'] = [];
      const exists = async (p: string) => {
        try { await fs.access(path.join(projectPath, p)); return true; } catch { return false; }
      };

      // 1. tests present
      const hasTests = (await exists('tests')) || (await exists('test')) || (await exists('__tests__'));
      checks.push({
        name: 'tests-present', status: hasTests ? 'pass' : 'warn',
        detail: hasTests ? 'test directory found' : 'no tests/ directory',
      });

      // 2. CI present
      const hasCI = await exists('.github/workflows');
      checks.push({
        name: 'ci-present', status: hasCI ? 'pass' : 'warn',
        detail: hasCI ? 'GitHub Actions workflows found' : 'no CI workflows',
      });

      // 3. docs present
      const hasDocs = (await exists('README.md')) && (await exists('docs'));
      checks.push({
        name: 'docs-present', status: hasDocs ? 'pass' : 'warn',
        detail: hasDocs ? 'README + docs/ found' : 'missing README or docs/',
      });

      // 4. dependency manifests parse
      let depCount = 0;
      try {
        const pkgRaw = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        depCount = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
        checks.push({ name: 'deps-parse', status: 'pass', detail: `${depCount} npm deps declared` });
      } catch {
        checks.push({ name: 'deps-parse', status: 'warn', detail: 'no package.json or unparsable' });
      }

      // 5. TODO debt
      let todos = 0;
      try {
        const files = await walkTsFiles(projectPath);
        for (const f of files.slice(0, 200)) {
          const c = await fs.readFile(f, 'utf-8');
          todos += (c.match(/\bTODO\b|\bFIXME\b/g) ?? []).length;
        }
        checks.push({
          name: 'todo-debt', status: todos > 50 ? 'warn' : 'pass',
          detail: `${todos} TODO/FIXME markers`,
        });
      } catch {
        checks.push({ name: 'todo-debt', status: 'warn', detail: 'could not scan source' });
      }

      const fails = checks.filter((c) => c.status === 'fail').length;
      const warns = checks.filter((c) => c.status === 'warn').length;
      const score = Math.max(0, 100 - fails * 25 - warns * 10);
      return { projectPath, score, checks };
    }

    async function walkTsFiles(dir: string): Promise<string[]> {
      const out: string[] = [];
      async function walk(d: string) {
        let entries;
        try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
          const full = path.join(d, e.name);
          if (e.isDirectory()) await walk(full);
          else if (/\.(ts|js|py)$/.test(e.name)) out.push(full);
        }
      }
      await walk(dir);
      return out;
    }

    ctx.provide('health', { check });

    ctx.register('health-tools', [
      {
        name: 'project_health',
        description: 'Check project health (tests, CI, docs, deps, TODO debt)',
        parameters: {
          type: 'object',
          properties: { projectPath: { type: 'string' } },
          required: ['projectPath'],
        },
        async execute({ projectPath }: { projectPath: string }) {
          return check(projectPath);
        },
      },
    ]);
  },
});

export default qeekHealth;
