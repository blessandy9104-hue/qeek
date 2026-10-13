import type * as http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

/**
 * Localhost web hardening. The server binds 127.0.0.1, but binding alone
 * does not stop DNS-rebinding pages or curious LAN processes that reach the
 * port — so every response carries hardening headers, non-loopback Host
 * headers are rejected, and optional bearer + rate limits guard the
 * tool-running and auth endpoints.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Merge hardening headers into an outgoing header set. */
export function withSecurityHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...SECURITY_HEADERS, ...extra };
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);

/** Extra allowed Hosts from `ZOVELI_ALLOWED_HOSTS` (comma-separated, no port). */
export function extraAllowedHosts(): string[] {
  return (process.env.ZOVELI_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Reject DNS-rebinding and LAN Host headers; allow loopback + configured. */
export function isHostAllowed(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.split(':')[0].trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (LOOPBACK_HOSTS.has(host)) return true;
  return extraAllowedHosts().includes(host);
}

/** Sliding-window per-key rate limiter (in-memory, single process). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) || []).filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Bound memory: drop idle keys opportunistically.
    if (this.hits.size > 10000) {
      for (const [k, v] of this.hits) {
        if (v.length === 0 || v[v.length - 1] <= cutoff) this.hits.delete(k);
      }
    }
    return true;
  }
}

/**
 * Optional bearer gate for tool-running routes. Off by default (preserves
 * no-account local UX); set `ZOVELI_API_TOKEN` (min 16 chars) to require
 * `Authorization: Bearer <token>` on POST /api/run and /api/chat.
 */
export function bearerAuthorized(req: http.IncomingMessage): boolean {
  const expected = process.env.ZOVELI_API_TOKEN || '';
  if (expected.length < 16) return true;
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
