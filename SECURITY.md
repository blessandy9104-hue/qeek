# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

**Do not report security vulnerabilities via public GitHub issues.**

Please report security vulnerabilities to: **blessandy9104@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond within 48 hours and provide a fix timeline within 7 days.

## Security Measures

### Supply Chain
- All dependencies scanned via `pnpm audit` and Snyk
- SBOM generated for each release (Syft)
- Docker images signed with Cosign
- Dependabot for automated updates

### Runtime
- Sandboxed execution environments
- Capability-based permissions
- Guard enforcement: destructive shell patterns are denied in the host
  (`guard_set_policy` switches strict/balanced/permissive live)
- Injection-safe system prompt: tool outputs and web content are treated as
  untrusted data, never as instructions
- No eval/exec in user-facing code (verified: only the secscan pattern
  table mentions `eval`)
- Input validation on all tool parameters
- Per-IP rate limiting on web APIs (auth 30/min, chat/run 120/min)

### Data Protection
- Local-first architecture (no cloud required; no cloud sync exists —
  backups are user-managed encrypted copies)
- Credential storage via OS keychain
- OTP codes hashed at rest, 5/hour issuance cap, 5 verify attempts,
  constant-time comparison; HMAC-signed sessions, HttpOnly + SameSite cookies
- Secret redaction in server errors and logs (key material masked;
  math certificates pass through)
- Audit logging for all operations
- mathcore verification prevents hallucinated outputs

### Network
- Localhost-only by default (binds 127.0.0.1)
- DNS-rebinding guard: non-loopback `Host` headers rejected
  (`ZOVELI_ALLOWED_HOSTS` for explicit extras)
- Hardening headers on every response (nosniff, SAMEORIGIN framing,
  same-origin referrer/COOP)
- Optional bearer token for tool-running routes (`ZOVELI_API_TOKEN`, off by default)
- Optional TLS for web UI
- MCP servers run in isolated processes
- No telemetry without explicit consent

## Threat Model

We use STRIDE methodology:
- **Spoofing**: JWT/OIDC authentication, signed releases
- **Tampering**: Immutable audit logs, signed containers
- **Repudiation**: Comprehensive audit trails
- **Information Disclosure**: Local-first, encrypted storage
- **Denial of Service**: Rate limits, resource quotas
- **Elevation of Privilege**: Capability-based access, sandboxing

## Compliance

- EU AI Act ready (local processing, audit logs)
- GDPR compliant (user data control, right to deletion)
- SOC 2 compatible (audit logging, access controls)

## Responsible Disclosure

We follow coordinated vulnerability disclosure:
1. Report received → 48h acknowledgment
2. Investigation → 7d initial assessment
3. Fix development → 30d target for critical
4. Release → Coordinated with reporter
5. Public disclosure → After fix deployed

## Security Contacts

- **Primary**: Andy ([@blessandy9104-hue](https://github.com/blessandy9104-hue)) - blessandy9104@gmail.com
- **GPG Key**: Available on GitHub profile

## Bug Bounty

Currently no formal bug bounty program. Significant vulnerabilities may receive recognition in release notes and swag.

## Pre-launch checklist (verified)

No API key, account, or network is required for any local capability —
these controls add safety without gating effectiveness:

- **API keys hidden**: keys live only in env vars and the `Authorization`
  header; provider/model names (never values) appear in logs.
- **Git secrets purged**: history scanned — only synthetic test fixtures
  (`sk-abcd…`, documented example keys); no `.env` or key files tracked.
- **DB access**: SQLite has no credentials by design; `memory.db` is
  chmod-0600 (owner-only, best-effort on Windows), sessions are HMAC-signed.
- **Sensitive data encrypted/hashed**: OTP codes SHA-256 at rest, 5/hour
  issuance, 5 verify attempts, constant-time compare; session secret 0600.
- **Server-side auth enforced**: OTP + HMAC sessions verified server-side;
  optional bearer token gates tool-running routes (off by default to
  preserve no-account local UX).
- **Record access locked**: single-user model — OS file ownership is the
  boundary; no cross-user record access exists.
- **Field tampering blocked**: hash-chained math certificates + audit log
  (`verify-log` detects edits); HMAC session tokens; hashed OTP codes.
- **Session cookies secured**: HttpOnly, SameSite=Lax, host-only, 30-day TTL.
- **Passwords hashed**: passwordless by design — no passwords exist; OTP
  codes are hashed, never stored or logged.
- **Login rate-limited**: 5 codes/hour per email, 5 verify attempts per code,
  30 auth req/min per IP (plus code expiry + lockout).
- **Bot protection**: layered caps above make brute force infeasible
  (10⁶-code space vs ~300 guesses/hour); no third-party CAPTCHA by design
  (local-first, no external calls).
- **Queries parameterized**: every SQLite statement uses `?` bindings,
  including FTS5 `MATCH` — no string-interpolated SQL.
- **Input validated**: email format, chat message presence + 50k cap,
  `/api/run` tool-name + object-args checks, 1MB body cap, operation enums.
- **User content escaped**: web UI renders via `textContent` (no innerHTML);
  note titles sanitized for filenames and frontmatter.
- **File uploads restricted**: no executable upload surface exists
  (`attachment_upload` declares limits but has no implementation).
- **API uploads trimmed**: 1MB bodies, 50k chat messages, bounded histories.
- **Security headers**: nosniff, SAMEORIGIN framing, same-origin
  referrer/COOP on every response; HSTS behind TLS.
- **HTTPS**: localhost serves plain http by design; terminate TLS at a
  reverse proxy for any network exposure (see web guide).
- **Dependencies scanned**: `pnpm audit` (CI gate) + Snyk + Trivy + SBOM.