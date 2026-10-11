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
- No eval/exec in user-facing code
- Input validation on all tool parameters
- Rate limiting on webhooks and APIs

### Data Protection
- Local-first architecture (no cloud required)
- E2E encryption for optional cloud sync
- Credential storage via OS keychain
- Audit logging for all operations
- mathcore verification prevents hallucinated outputs

### Network
- Localhost-only by default
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

- **Primary**: Andy (blessandy9104) - blessandy9104@gmail.com
- **GPG Key**: Available on GitHub profile

## Bug Bounty

Currently no formal bug bounty program. Significant vulnerabilities may receive recognition in release notes and swag.