import { describe, it, expect } from 'vitest';
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  UNICORN_SDK_URL,
  DEFAULT_UNICORN_PROJECT,
  unicornProjectId,
  themeById,
  themeCSS,
  themeSwitcherHTML,
  themeHeadScript,
  themeBootScript,
} from '../../apps/desktop/src/server/themes';

const REQUIRED_VARS = ['--bg', '--fg', '--muted', '--accent', '--panel', '--border', '--badge-bg', '--badge-fg'];

describe('interface themes', () => {
  it('ships daylight (default), midnight, forest, sunset, unicorn', () => {
    expect(THEMES.map((t) => t.id).sort()).toEqual(
      ['daylight', 'forest', 'midnight', 'sunset', 'unicorn'].sort()
    );
    expect(DEFAULT_THEME).toBe('daylight');
    expect(themeById('daylight').id).toBe('daylight');
  });

  it('falls back to daylight for unknown ids', () => {
    expect(themeById('nope').id).toBe('daylight');
  });

  it('every theme defines the full variable contract', () => {
    for (const t of THEMES) {
      for (const v of REQUIRED_VARS) {
        expect(t.vars[v], `${t.id} missing ${v}`).toBeDefined();
      }
    }
  });

  it('exactly one theme needs the network (unicorn)', () => {
    expect(THEMES.filter((t) => t.unicorn).map((t) => t.id)).toEqual(['unicorn']);
  });

  it('css covers every theme plus Lenis and the backdrop', () => {
    const css = themeCSS();
    for (const t of THEMES) {
      expect(css).toContain(`html[data-theme="${t.id}"]`);
    }
    expect(css).toContain('.lenis.lenis-smooth');
    expect(css).toContain('#us-bg');
  });

  it('switcher lists every theme with test ids', () => {
    const html = themeSwitcherHTML();
    expect(html).toContain('data-testid="theme-switcher"');
    for (const t of THEMES) {
      expect(html).toContain(`data-testid="theme-option-${t.id}"`);
    }
  });

  it('head script applies stored theme before paint', () => {
    const js = themeHeadScript();
    expect(js).toContain(THEME_STORAGE_KEY);
    expect(js).toContain('data-theme');
  });

  it('boot script lazily loads unicorn only, guards lenis', () => {
    const js = themeBootScript('proj123');
    expect(js).toContain(UNICORN_SDK_URL);
    expect(js).toContain('proj123');
    expect(js).toContain('window.Lenis');
    expect(js).toContain('us-fallback');
  });

  it('unicorn project id honors env override', () => {
    const prev = process.env.ZOVELI_UNICORN_PROJECT;
    try {
      delete process.env.ZOVELI_UNICORN_PROJECT;
      expect(unicornProjectId()).toBe(DEFAULT_UNICORN_PROJECT);
      process.env.ZOVELI_UNICORN_PROJECT = '  custom-id-9 ';
      expect(unicornProjectId()).toBe('custom-id-9');
    } finally {
      if (prev === undefined) delete process.env.ZOVELI_UNICORN_PROJECT;
      else process.env.ZOVELI_UNICORN_PROJECT = prev;
    }
  });
});
