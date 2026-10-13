# Math intelligence subsystem (one subsystem)

Zoveli's math is a single AI subsystem with one engine, one transport, one
tool surface, one proof memory, and one rule text. Nothing computes in the
chat model — ever.

```
Python engine        mathcore/                  sympy/mpmath/numpy/scipy/
                     (pip install -e ./mathcore) networkx/z3/pint + quorum
                            |
stdio JSON-RPC       `mathcore-mcp` binary      tools/call compute|check_answer
                            |
TS transport         @zoveli/math-intelligence  MathcoreClient (persistent
                     src/transport.ts           child; transports, never computes)
                            |
TS tools             mathcore_compute           assistant-math-tools
                     mathcore_check_answer      (auto-memorize VERIFIED proofs)
                     mathcore_list_operations
                            |
AI layer             math_recall                proof memory in SQLite
                     math_memorize              (@zoveli/memory-store, tag math)
                     math_stats                 counters: verified/withheld/
                                                mismatches/recalls
                            |
Plugin + rules       zoveli-math-intelligence   registers mathcore-mcp-client +
                     (zoveliMath alias)         both toolsets; injects MATH_RULES
                                                + MATH_INTELLIGENCE_RULES
                            |
Shims (no logic)     @zoveli/math              re-exports canonical values
                     packages/core              re-exports transport + tools
                     @zoveli/mcp                references same server entry
                                                (same command/env, never a copy)
                            |
Callers              CLI /math, /check · web /api/chat fast path ·
                     agent tool loop (mathcore_compute / mathcore_check_answer
                     / math_recall)
```

## Single sources (do not duplicate)

All in `packages/math-intelligence/src/`:

- `constants.ts`: `MATHCORE_MCP_COMMAND` (`mathcore-mcp`), `MATHCORE_MCP_SERVER_ID`
  (`mathcore`), `defaultMathcoreAuditPath()` (`MATHCORE_AUDIT` overrides),
  `MATH_RULES` (verbatim 5-rule text), `MATH_INTELLIGENCE_RULES` (recall-first
  guidance), `mathcoreServerConfig()` (the one stdio spawn config).
- `transport.ts`: `MathcoreClient` + `mathcore` singleton.
- `tools.ts`: `mathcoreTools` (3, names frozen) + `mathIntelligenceTools` (3).
- `intelligence.ts`: `memorizeVerified` (upsert `math/<slug>`, tags
  `math,verified`), `recallSimilar` (keyword over math-tagged notes),
  `getMathStats`, `recordMismatch`, `recordWithheld`.

## Environment

`MATHCORE_MCP_COMMAND` (override the binary), `MATHCORE_AUDIT` (audit path),
`MATHCORE_TIMEOUT_MS` (per-request timeout, default 120000),
`ZOVELI_MATH_MEMORIZE=0` disables proof auto-memorize,
`ZOVELI_OLLAMA_URL` is unrelated (chat models, see `docs/guides/cli.md`).

## Guarantees

- **Verified or withheld:** independent methods must agree or the answer is
  WITHHELD/MISMATCH — the model never guesses numbers.
- **Transport never computes:** the TS client only carries JSON-RPC.
- **Proofs accumulate:** VERIFIED results are upserted to the memory store;
  WITHHELD/MISMATCH only bump counters (no DB spam).
- **Install once:** `pip install -e ./mathcore` (vendored). Docker images
  build the z3 wheel with ephemeral `build-base` + `cmake`, then remove them.

## Tests

- Python: `python -m pytest mathcore/tests/test_known_answers.py mathcore/tests/test_cli.py -q`
- TS unity: `tests/unit/math-intelligence.test.ts` → "one AI math intelligence
  subsystem" (constants, shim drift, transport default, tool names, memorize/
  recall, withheld opt-out, plugin contract); `tests/unit/core.test.ts` →
  "one math subsystem" (legacy contract still green via shims).
- E2E: `/math 2+2` → `VERIFIED`; web `2+2` → verification badge.
- Smoke: `math_memorize` → `math_recall` → `math_stats` over host tools.
