import { getStore } from '@zoveli/memory-store';
import { recordRecall } from './intelligence.js';
import { domainMemoryTag, type MathDomain } from './domains.js';

export type SemanticMode = 'vector' | 'keyword';

export interface SemanticHit {
  title: string;
  preview: string;
  score: number;
}

export interface SemanticResult {
  mode: SemanticMode;
  model: string | null;
  results: SemanticHit[];
}

function embedBaseUrl(): string {
  return process.env.ZOVELI_OLLAMA_URL || 'http://localhost:11434';
}

function embedModel(): string {
  return process.env.ZOVELI_EMBED_MODEL || 'nomic-embed-text';
}

/** Cosine similarity in [-1, 1]; 0 for degenerate inputs. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tokensOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_#@+-]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 1)
  );
}

/** Deterministic keyword fallback: Jaccard overlap + title boost. */
export function keywordScore(query: string, title: string, preview: string): number {
  const q = tokensOf(query);
  if (q.size === 0) return 0;
  const doc = tokensOf(`${title} ${preview}`);
  let inter = 0;
  for (const t of q) if (doc.has(t)) inter++;
  const union = q.size + doc.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  const titleTokens = tokensOf(title);
  let titleHit = false;
  for (const t of q) if (titleTokens.has(t)) { titleHit = true; break; }
  return jaccard + (titleHit ? 0.3 : 0);
}

async function embedTexts(texts: string[], timeoutMs = 15000): Promise<number[][] | null> {
  try {
    const out: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${embedBaseUrl()}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embedModel(), prompt: text }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(body.embedding) || body.embedding.length === 0) return null;
      out.push(body.embedding);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Semantic recall over proof memory. Prefilters by keyword over the domain
 * namespace, then ranks by embedding cosine when an embedding model is
 * reachable (`ollama pull nomic-embed-text` or `ZOVELI_EMBED_MODEL`), else
 * by deterministic keyword overlap. Never throws, never hangs: embed calls
 * carry a 15s timeout and any failure degrades to `keyword` mode.
 */
export async function recallSemantic(
  query: string,
  opts: { domain?: MathDomain; limit?: number; candidates?: number } = {}
): Promise<SemanticResult> {
  const domain = opts.domain || 'general';
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 20);
  const candidateLimit = Math.min(Math.max(opts.candidates ?? 30, limit), 50);
  recordRecall();
  const tags = domain === 'general' ? ['math'] : [domainMemoryTag(domain)];
  let pool: { title: string; content: string }[] = [];
  try {
    pool = getStore()
      .searchNotes({ query, tags, limit: candidateLimit })
      .results.map((r) => ({ title: r.title, content: r.content }));
  } catch {
    return { mode: 'keyword', model: null, results: [] };
  }
  if (pool.length === 0) return { mode: 'keyword', model: null, results: [] };

  const vecs = await embedTexts([query, ...pool.map((p) => `${p.title} ${p.content}`)]);
  if (vecs) {
    const [q, ...docs] = vecs;
    return {
      mode: 'vector',
      model: embedModel(),
      results: pool
        .map((p, i) => ({ title: p.title, preview: p.content.slice(0, 300), score: cosine(q, docs[i]) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
    };
  }
  return {
    mode: 'keyword',
    model: null,
    results: pool
      .map((p) => ({ title: p.title, preview: p.content.slice(0, 300), score: keywordScore(query, p.title, p.content) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
  };
}
