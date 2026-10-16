import { describe, it, expect } from 'vitest';
import { splitUrls } from '../../apps/desktop/src/server/render';

describe('splitUrls (safe link rendering)', () => {
  it('passes plain text through untouched', () => {
    expect(splitUrls('hello world')).toEqual(['hello world']);
    expect(splitUrls('')).toEqual([]);
  });

  it('extracts http(s) URLs and rejoins losslessly', () => {
    const text = 'see https://example.com/x and http://a.b/c?d=1 end';
    const parts = splitUrls(text);
    expect(parts).toContainEqual({ url: 'https://example.com/x' });
    expect(parts).toContainEqual({ url: 'http://a.b/c?d=1' });
    expect(parts.map((p) => (typeof p === 'string' ? p : p.url)).join('')).toBe(text);
  });

  it('trims trailing sentence punctuation but keeps it', () => {
    const parts = splitUrls('visit https://example.com/x. Next');
    expect(parts).toContainEqual({ url: 'https://example.com/x' });
    expect(parts.map((p) => (typeof p === 'string' ? p : p.url)).join('')).toBe(
      'visit https://example.com/x. Next'
    );
  });

  it('ignores non-URLs and dangerous schemes', () => {
    expect(splitUrls('run javascript:alert(1) now')).toEqual(['run javascript:alert(1) now']);
    expect(splitUrls('mail me at a@b.com')).toEqual(['mail me at a@b.com']);
  });

  it('skips bare prefixes without an address', () => {
    expect(splitUrls('go to http:// now')).toEqual(['go to http:// now']);
  });
});
