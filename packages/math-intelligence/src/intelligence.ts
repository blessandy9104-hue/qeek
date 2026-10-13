import { getStore } from '@zoveli/memory-store';

export const MATH_MEMORY_TAG = 'math';
export const MATH_VERIFIED_TAG = 'verified';

function memorizeEnabled(): boolean {
  return process.env.ZOVELI_MATH_MEMORIZE !== '0';
}

function slugOf(request: string): string {
  const slug = request
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'untitled';
}

function isVerifiedText(text: string): boolean {
  return /VERIFIED/i.test(text) && !/WITHHELD/i.test(text);
}

function isWithheldText(text: string): boolean {
  return /WITHHELD/i.test(text);
}

const counters = {
  verified: 0,
  withheld: 0,
  mismatches: 0,
  recalls: 0,
};

/**
 * AI layer over verified math: every VERIFIED computation is memorized as a
 * proof note (dedupe by title via upsert) so future turns recall instead of
 * recompute. WITHHELD/MISMATCH outcomes only bump counters (no DB spam).
 */
export async function memorizeVerified(request: string, resultText: string): Promise<string | null> {
  if (!memorizeEnabled()) return null;
  if (!isVerifiedText(resultText)) {
    if (isWithheldText(resultText)) counters.withheld += 1;
    return null;
  }
  counters.verified += 1;
  const title = `math/${slugOf(request)}`;
  const body = `## Request\n\n${request}\n\n## Verified result\n\n${resultText}\n`;
  try {
    const store = getStore();
    try {
      store.createNote({ title, content: body, tags: [MATH_MEMORY_TAG, MATH_VERIFIED_TAG], links: [] });
    } catch {
      // Dedupe: note already memorized — refresh it.
      store.updateNote({ title, content: body, tags: [MATH_MEMORY_TAG, MATH_VERIFIED_TAG] });
    }
    return title;
  } catch {
    return null;
  }
}

export function recordMismatch(): void {
  counters.mismatches += 1;
}

export function recordWithheld(): void {
  counters.withheld += 1;
}

export async function recallSimilar(query: string, limit = 5): Promise<{ title: string; preview: string; score: number }[]> {
  counters.recalls += 1;
  try {
    const { results } = getStore().searchNotes({ query, tags: [MATH_MEMORY_TAG], limit });
    return results.map((r) => ({ title: r.title, preview: r.content.slice(0, 300), score: r.score }));
  } catch {
    return [];
  }
}

export function getMathStats(): { verified: number; withheld: number; mismatches: number; recalls: number; memorizeEnabled: boolean } {
  return { ...counters, memorizeEnabled: memorizeEnabled() };
}

export function resetMathStatsForTests(): void {
  counters.verified = 0;
  counters.withheld = 0;
  counters.mismatches = 0;
  counters.recalls = 0;
}
