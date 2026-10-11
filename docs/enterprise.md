# qeek Enterprise Notes

## Air-gapped deployment
1. Build images: `docker build -f docker/Dockerfile.web .`
2. Pre-install: Python + mathcore wheel, Ollama + GGUF models, LSP servers.
3. Run with `--network none` except loopback; mount vault + sessions as volumes.
4. Verify: `math-showcase.mjs` passes fully offline; `capability_report` shows `mcp.mathcore: available`.

## SSO / RBAC (roadmap)
- Identity plugin supports OAuth (GitHub/Google/Microsoft); OIDC/SAML via `assistant-identity` extension point.
- Capability-gated RBAC: map roles → allowed capabilities (`code.push`, `shell.exec`, `computer-use.*`).
- All decisions logged to session + audit logs.

## Audit & compliance
- Session logs: append-only JSONL (`~/.personal-assistant/sessions`).
- Math certificates: hash-chained `audit.jsonl` (`mathcore verify-log` detects edits).
- SBOM per release (`scripts/security/generate-sbom.sh`); images signed with Cosign.
- EU AI Act Art.12: 6-month log retention supported via session persistence config.

## FIPS / regulated
- Use FIPS-validated OpenSSL base image; `encrypted-file` credential store with AES-256-GCM.
- Disable telemetry (`TELEMETRY_ENABLED=false` default); no external calls in local profile.
