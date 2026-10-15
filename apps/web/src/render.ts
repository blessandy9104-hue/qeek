/**
 * URL splitting for safe link rendering. Pure and dependency-free so both
 * unit tests (Node) and the browser template (DOM applier) share the logic.
 * Deliberately regex-free: this exact algorithm is mirrored in the served
 * page, where backslash escaping across template layers is error-prone.
 */

export type TextPart = string | { url: string };

const PREFIXES = ['https://', 'http://'];
const TERMINATORS = ' \t\n<>"\')]}';
const TRAILING_PUNCT = '.,;:!?';

function linkEnd(text: string, start: number): number {
  let end = start;
  while (end < text.length && TERMINATORS.indexOf(text[end]) < 0) end++;
  let link = text.slice(start, end);
  while (link.length > 0 && TRAILING_PUNCT.indexOf(link[link.length - 1]) >= 0) {
    link = link.slice(0, -1);
  }
  return start + link.length;
}

/** Split text into plain spans and URL parts (lossless: join === input). */
export function splitUrls(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  let i = 0;
  while (i < text.length) {
    const h = text.indexOf('http', i);
    if (h < 0) break;
    let prefix = '';
    for (const p of PREFIXES) {
      if (text.startsWith(p, h)) {
        prefix = p;
        break;
      }
    }
    if (prefix === '') {
      i = h + 4;
      continue;
    }
    const end = linkEnd(text, h);
    if (end <= h + prefix.length) {
      i = h + prefix.length;
      continue;
    }
    if (h > last) parts.push(text.slice(last, h));
    parts.push({ url: text.slice(h, end) });
    last = end;
    i = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.filter((p) => (typeof p === 'string' ? p.length > 0 : true));
}
