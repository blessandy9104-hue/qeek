# mathcore — vendored verified-mathematics subsystem

This directory is a **vendored copy** of the standalone `mathcore` project
(a local, keyless, verified mathematical execution subsystem: parse →
authorize → coordinate → guard), placed here so this repository works from
a **single clone** with no sibling checkout.

## Provenance

Copied from the author's local `mathcore` tree. No separate license file
was provided with the original, and its `pyproject.toml` declares no
license field — so **no license is asserted here**. The surrounding
repository is MIT-licensed (see `../LICENSE`); if mathcore upstream carries
a different license, replace this notice with its `LICENSE` file.
Maintainer action item: confirm and pin the mathcore license.

## Layout

- `src/mathcore/` — the subsystem (`cli.py`, `command.py`, `framework.py`,
  `orchestrator.py`, `safe_expr.py`, `mcp_server.py`, `numeric.py`,
  `ops_*.py`)
- `tests/` — 132 tests: known answers, CLI, adversarial/fault-injection,
  property tests
- `harness/` — model instructions + DeepSeek-harness Cordis overlay
  (`mathcore.cordis.yml`, superseded here by `@zoveli/math`)
- `examples/` — recorded demo runs
- `pyproject.toml` — exposes the `mathcore` and `mathcore-mcp` commands

## Install (from the repo root)

```bash
pip install -e ./mathcore
mathcore "solve x^2 - 5x + 6 = 0"
```
