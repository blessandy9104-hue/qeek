import { describe, it, expect } from 'vitest';
import { LanguageDetector } from '../../packages/languages/src/detector';
import { CodeAnalyzer } from '../../packages/languages/src/analyzer';
import { CodeFormatter } from '../../packages/languages/src/formatter';
import { LanguageTooling } from '../../packages/languages/src/tooling';
import { createMockContext } from '../setup';

describe('LanguageDetector', () => {
  const detector = new LanguageDetector();

  it('detects by extension', () => {
    expect(detector.detect('app.ts').language).toBe('typescript');
    expect(detector.detect('main.py').language).toBe('python');
    expect(detector.detect('lib.rs').language).toBe('rust');
    expect(detector.detect('main.go').language).toBe('go');
  });

  it('detects by shebang', () => {
    const r = detector.detect('run', '#!/usr/bin/env python3\nprint("hi")');
    expect(r.language).toBe('python');
    expect(r.method).toBe('shebang');
  });

  it('returns unknown for empty', () => {
    const r = detector.detect('README', 'hello world');
    expect(r.language).toBe('unknown');
  });

  it('lists supported languages', () => {
    const langs = detector.getSupportedLanguages();
    expect(langs.length).toBeGreaterThanOrEqual(10);
    expect(langs.some((l) => l.name === 'typescript')).toBe(true);
  });
});

describe('CodeAnalyzer', () => {
  it('analyzes TypeScript functions and metrics', async () => {
    const ctx = createMockContext();
    const analyzer = new CodeAnalyzer(ctx);
    const res = await analyzer.analyze({
      filePath: 'a.ts',
      content: 'export function add(a: number, b: number) {\n if (a > 0) { return a + b; }\n return b;\n}\nconsole.log("hi");\n',
      language: 'typescript',
    });
    expect(res.language).toBe('typescript');
    expect(res.metrics?.linesOfCode).toBeGreaterThan(0);
    expect(res.structure.functions.some((f) => f.name === 'add')).toBe(true);
    expect(res.issues?.some((i) => i.rule === 'no-console')).toBe(true);
  });
});

describe('CodeFormatter', () => {
  it('trims trailing whitespace and ensures newline', async () => {
    const ctx = createMockContext();
    const fmt = new CodeFormatter(ctx);
    const res = await fmt.format({
      filePath: 'a.py',
      content: 'x = 1   \n',
      language: 'python',
    });
    expect(res.formatted).toBe('x = 1\n');
    expect(res.language).toBe('python');
  });

  it('flags missing trailing newline', async () => {
    const ctx = createMockContext();
    const fmt = new CodeFormatter(ctx);
    const res = await fmt.lint({ filePath: 'a.ts', content: 'const x = 1;', language: 'typescript' });
    expect(res.issues.some((i) => i.rule === 'eol-last')).toBe(true);
  });
});

describe('LanguageTooling', () => {
  it('returns tooling for known languages', async () => {
    const ctx = createMockContext();
    const tooling = new LanguageTooling(ctx);
    const ts = await tooling.getForLanguage('typescript');
    expect(ts.tooling.formatter).toBe('prettier');
    expect(ts.installHints.formatter).toContain('prettier');

    const py = await tooling.getForLanguage('python');
    expect(py.tooling.testRunner).toBe('pytest');
  });
});
