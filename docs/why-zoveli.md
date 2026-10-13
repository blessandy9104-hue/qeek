# Why Zoveli? (vs ChatGPT and Claude)

> One paragraph: ChatGPT and Claude are excellent cloud assistants. Zoveli is the
> assistant for work that must stay yours — it runs on your hardware, proves its
> math instead of guessing, and costs nothing to run.

## The 10-second comparison (October 2026)

| | Zoveli AI | ChatGPT (Free–$20+/mo) | Claude (Free–$20+/mo) |
|---|---|---|---|
| Price | Free forever, MIT licensed | Free tier + Go $8 / Plus $20 / Pro $100+ | Free tier + Pro $20 / Max $100–$200 |
| Where it runs | **Your machine** (CLI, web UI, desktop, Docker) | OpenAI's cloud | Anthropic's cloud |
| Offline | **Yes** — ~48 local tools work with no network | No | No |
| Your data | **Never leaves home**; SQLite store you own (+ Markdown mirror); **never trained on** | Cloud processing; training opt-out in settings | Cloud processing; configurable retention |
| Math answers | **Verified or withheld** (mathcore: independent methods must agree + sealed certificate; governed specialists memorize proofs) | Best-effort, confidently stated | Best-effort, confidently stated |
| Model lock-in | None — `DEEPSEEK_API_KEY`, any OpenAI-compatible base (incl. local Ollama), or tools-only | OpenAI models only | Anthropic models only |
| Memory | SQLite store you own (+ Markdown mirror), wiki-links, knowledge graph | Projects + memory (cloud) | Projects + memory (cloud) |
| Login | Passwordless email OTP, any inbox incl. @proton.me | OAuth / passwords | OAuth / passwords |

Pricing sources: [OpenAI pricing](https://openai.com/chatgpt/pricing),
[Claude pricing](https://claude.com/pricing). Plans change often; Zoveli's row
doesn't — free and local is structural, not promotional.

## When to pick Zoveli

- Private notes, journals, or client work that must not touch a third-party server.
- Exact computation (homework, engineering, finance) where a confident wrong
  answer is worse than no answer — `/math` and `/check` give VERIFIED/MATCH/MISMATCH.
- Planes, labs, and locked-down networks — the CLI works fully offline.
- Tinkerers: 61 packages, MCP servers, and an HTTP API you can extend in an afternoon.

## When to pick ChatGPT or Claude instead (honest version)

- You need frontier reasoning, vision, voice, or image generation — Zoveli has
  none of those built in (it can call outside models via API, but the models
  themselves aren't ours).
- You want zero setup — they run in a browser; Zoveli needs a 10-minute install.
- Team collaboration with shared workspaces, SSO/SAML, audit logs, HIPAA —
  Zoveli is single-user local-first today (see `docs/enterprise.md` for status).

## FAQ

**Is Zoveli a ChatGPT wrapper?**
No. Chat is an optional adapter (`DEEPSEEK_API_KEY` / `ZOVELI_API_BASE`); the
core — verified math, SQLite memory, sysinfo, scheduler, search, 61 packages —
runs with no model and no network.

**What does "verified math" mean?**
Every computation runs through independent methods (e.g. symbolic solve +
numeric roots + exact substitution). All must agree or the answer is WITHHELD
with a MISMATCH notice — plus a hash-chained audit certificate (`MATHCORE_AUDIT`).

**What does it cost to run?**
Electricity. No subscription, no credits, no seat fees. Optional model API
usage is billed by whoever provides your key, not by us.

**Can I use it at work?**
It's MIT licensed with a threat model (`docs/THREAT_MODEL.md`) and security
policy (`SECURITY.md`). But review both first: local-first means *you* own
backups, updates, and access control for the machine it runs on.
