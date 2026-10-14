# Zoveli AI — local-first personal assistant

> The assistant that proves its math, runs on your hardware, and never trains on your data.

Website: **https://blessandy9104-hue.github.io/zoveli-ai/**

[![CI](https://github.com/blessandy9104-hue/zoveli-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/blessandy9104-hue/zoveli-ai/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22%2B-green.svg)](https://nodejs.org/)

## Why Zoveli instead of ChatGPT / Claude?

| | Zoveli AI | ChatGPT / Claude |
|---|---|---|
| Price | **Free forever**, MIT | $8–$20+/mo subscriptions |
| Your data | **Stays on your machine**, never trained on | Processed in their cloud |
| Offline | **Yes** — ~51 tools, no network needed | Internet required |
| Math | **Verified or withheld** (+ audit certificate) | Confident best-effort guesses |
| Lock-in | None — BYO key or local Ollama | One vendor's models |

Details + honest "when not to pick us": [docs/why-zoveli.md](docs/why-zoveli.md).

## Try it in 30 seconds

```bash
git clone https://github.com/blessandy9104-hue/zoveli-ai.git
cd zoveli-ai
pip install -e ./mathcore   # verified-math backend
pnpm install && pnpm run build
pnpm start                  # then type: /math solve x^2 - 5x + 6 = 0
```

No account, no API key needed — local tools (math, memory, sysinfo, …) work fully offline.

## Download & install

> One-line install (opencode-style, review before running):
> ```bash
> curl -fsSL https://raw.githubusercontent.com/blessandy9104-hue/zoveli-ai/main/install/install-zoveli.sh | bash -s -- --yes
> ```
> Windows PowerShell: `irm https://raw.githubusercontent.com/blessandy9104-hue/zoveli-ai/main/install/install-zoveli.ps1 | iex`
> See [`install/install-zoveli.sh`](install/install-zoveli.sh) (idempotent, `--yes/--dir/--branch` flags, no telemetry).

Prerequisites: Node.js 22.16+, Python 3.11+, pnpm 11.7.0+.

**Windows (PowerShell):**

```powershell
# 1. Toolchain
winget install OpenJS.NodeJS.LTS Python.Python.3.11 Git.Git
npm install -g pnpm@11.7.0

# 2. Download
git clone https://github.com/blessandy9104-hue/zoveli-ai.git
cd zoveli-ai

# 3. Verified-math backend (vendored in ./mathcore, optional but recommended)
pip install -e .\mathcore

# 4. Install + build + verify
pnpm install
pnpm run build
pnpm test
```

**macOS / Linux:**

```bash
# 1. Toolchain (macOS shown; apt/dnf equivalents on Linux)
brew install node@22 python@3.11 git
npm install -g pnpm@11.7.0

# 2. Download
git clone https://github.com/blessandy9104-hue/zoveli-ai.git
cd zoveli-ai

# 3. Verified-math backend (vendored in ./mathcore, optional but recommended)
pip install -e ./mathcore

# 4. Install + build + verify
pnpm install
pnpm run build
pnpm test
```

## Launch it

```bash
pnpm start            # CLI assistant (works fully offline)
pnpm run web          # Web UI + HTTP API at http://127.0.0.1:3080
pnpm run desktop      # Electron shell (dev mode)
```

The CLI works fully offline for all local tools (verified math via
mathcore, memory vault, sysinfo, languages, search, scheduler, ...).
For free offline chat with no keys: install Ollama and run
`ollama pull qwen3:4b` — Zoveli detects it automatically. Or set any API
key (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`,
`GROQ_API_KEY`, `TOGETHER_API_KEY` or `ZOVELI_API_KEY`) with optional
`ZOVELI_MODEL` / `ZOVELI_API_BASE` to use any OpenAI-compatible model.
Try: `/math solve x^2 - 5x + 6 = 0` · `/sys` · `/tools`.

## Features (all runnable today)

- **🔬 Verified Mathematics** — one AI math intelligence subsystem: mathcore MCP gives zero-hallucination math with hash-chained audit certificates, governed with 6 specialists (algebra, calculus, statistics, logic, units, discrete) that memorize verified proofs and recall them (keyword + semantic)
- **🧠 Local-First Memory** — SQLite store with FTS5 ranked search, wiki-links and tags (Markdown vault kept as human-readable export mirror)
- **🤖 Full Agent Framework** — 61 packages: agent loop, tools, LLM, MCP, sandbox, subagents, workflows (`/tools` or `GET /api/tools` lists all ~51 live tools)
- **🖥️ System & Hardware Awareness** — local OS/CPU/memory/disk/GPU/battery/network insight with budget checks (`@zoveli/sysinfo`)
- **💻 Programming Languages** — detection, analysis, formatting, linting, testing, tooling for 17+ languages (`@zoveli/languages`)
- **⚡ Capability Awareness** — runtime discovery, introspection, adaptation, and gap reports
- **🔍 Vault Search** — SQLite FTS5 ranked full-text search over the knowledge store
- **🕸️ Knowledge Graph** — wiki-link graph with orphans, hubs, DOT export
- **🧪 Code Review** — complexity hotspots, duplication, dead code, secret detection
- **📄 Doc Generator** — offline Markdown API docs from source exports
- **❤️ Project Health** — tests/CI/docs/deps/TODO-debt scoring
- **🗓️ Smart Scheduler** — energy-aware prioritization + time-blocking
- **🛡️ Security Scanner** — secrets + risky-pattern scanning
- **📊 Telemetry** — in-memory meters + Prometheus/OTLP + Grafana
- **🔑 Passwordless login** — email OTP for any inbox incl. @proton.me, `GET /login`
- **🔒 Privacy-First** — runs locally, no cloud required, MIT licensed

## Documentation

- [Architecture](docs/architecture.md)
- [Math intelligence subsystem](docs/math-subsystem.md) · [Memory store](docs/memory-store.md)
- [API Reference](docs/api/)
- [Runbooks](docs/runbooks/)
- [ADRs](docs/adr/)
- [Security policy](SECURITY.md)
- [Desktop guide](docs/guides/desktop.md) · [CLI guide](docs/guides/cli.md) · [Web guide](docs/guides/web.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every PR runs lint, strict
typecheck, unit + integration tests, Playwright e2e (Chromium, Firefox,
WebKit), Trivy + secret scans, and Docker builds.

## License

MIT — see [LICENSE](LICENSE).

## Author

Founded by **Andy** — [@blessandy9104-hue](https://github.com/blessandy9104-hue) — blessandy9104@gmail.com
