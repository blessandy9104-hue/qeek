# qeek - Personal Assistant AI Intelligence Subsystem

> The only AI assistant that proves its math, owns your data, and knows its own capabilities.

[![CI](https://github.com/blessandy9104-hue/qeek/actions/workflows/ci.yml/badge.svg)](https://github.com/blessandy9104-hue/qeek/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22%2B-green.svg)](https://nodejs.org/)

## Quick Start

Prerequisites: Node.js 22+, Python 3.11+, pnpm 11.7.0+ (`npm install -g pnpm@11.7.0`).

```bash
# Clone and install
git clone https://github.com/blessandy9104-hue/qeek.git
cd qeek

# Install mathcore (verified mathematics)
pip install -e ../mathcore

# Install Node dependencies (self-contained workspace, no other checkout needed)
pnpm install

# Build all packages
pnpm run build

# Start the CLI assistant
pnpm start
```

The CLI works fully offline for all local tools (verified math via
mathcore, memory vault, sysinfo, languages, search, scheduler, ...).
Set `DEEPSEEK_API_KEY` (optionally with `QEEK_API_BASE` for any
OpenAI-compatible endpoint, e.g. local Ollama) to enable open-ended chat
with tool use. Try: `/math solve x^2 - 5x + 6 = 0` · `/sys` · `/tools`.

## Features

- **🔬 Verified Mathematics** - mathcore MCP provides zero-hallucination math with audit trail
- **🧠 Local-First Memory** - Obsidian-compatible vault with wiki-links and tags
- **🤖 Full Agent Framework** - 55 plugins: agent loop, tools, LLM, MCP, sandbox, subagents, workflows
- **🖥️ System & Hardware Awareness** - local OS/CPU/memory/disk/GPU/battery/network insight with budget checks (`@qeek/qeek-sysinfo`)
- **💻 Programming Languages** - detection, analysis, formatting, linting, testing, tooling for 17+ languages (`@qeek/qeek-languages`)
- **⚡ Capability Awareness** - Dynamic discovery, introspection, and adaptation
- **🔍 Vault Search** - Tantivy-powered full-text search with live indexing
- **🕸️ Knowledge Graph** - wiki-link graph with orphans, hubs, DOT export
- **🧪 Code Review** - complexity hotspots, duplication, dead code, secret detection
- **📄 Doc Generator** - offline Markdown API docs from source exports
- **❤️ Project Health** - tests/CI/docs/deps/TODO-debt scoring
- **🗓️ Smart Scheduler** - energy-aware prioritization + time-blocking
- **🛡️ Security Scanner** - secrets + risky-pattern scanning
- **📊 Telemetry** - in-memory meters + Prometheus/OTLP + Grafana
- **🔑 Passwordless login** - email OTP for any inbox incl. @proton.me, `GET /login`
- **🔒 Privacy-First** - Runs locally, no cloud required, MIT/Apache-2.0 licenses

## Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api/)
- [Runbooks](docs/runbooks/)
- [ADRs](docs/adr/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT - See [LICENSE](LICENSE)

## Author

**Andy** - [@blessandy9104](https://github.com/blessandy9104) - blessandy9104@gmail.com