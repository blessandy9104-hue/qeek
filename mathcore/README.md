# mathcore

A local subsystem that does mathematics with **code instead of a model's guess**, and releases a result only after it has been **verified**. It runs offline, needs **no API key**, and uses no language model: parsing, planning and checking are deterministic.

```
user text ──► parse ──► authorize ──► Coordinator ──► verification quorum ──► OutputGuard ──► person / AI
 (the input    typed      only the      plans steps,    ≥2 independent          renders only     (certificate
  authorizes   command    named ops     chains only     confirmations and       from a sealed    + hash-chained
  the run)     + echo     may run       verified        zero failed checks      certificate      audit log)
                                        values
```

## Quick start

```sh
pip install -e .                     # sympy, mpmath, numpy, scipy, networkx, z3-solver, pint
mathcore "solve x^2 - 5x + 6 = 0"
mathcore "derivative of x^3*sin(x)"
mathcore "integrate sin(x)^2 from 0 to pi"
mathcore "prove integer: x*x >= x"
mathcore check "integrate x^2 from 0 to 3" "the answer is 8"   # audits an answer someone else gave
mathcore --json "determinant of [[1,2],[3,4]]"                  # structured output for agents
mathcore ops          # list operations
mathcore verify-log   # detect edits to the audit history
mathcore-mcp          # MCP server (stdio) so any MCP-capable AI can call it
```

`examples/demo.txt` is a recorded run, including refusals.

## What it can compute

| Operation | Independent methods | Witness checks |
|---|---|---|
| `evaluate` | SymPy exact, rational arithmetic, mpmath 60 digits | n/a (3 methods agree) |
| `simplify` `expand` `factor` | SymPy | exact equivalence; numeric sampling with mpmath on the original text |
| `solve` (equations, linear/non-linear systems) | SymPy, mpmath polynomial roots, exact Gaussian elimination | exact substitution; distinct-root count `deg p − deg gcd(p,p')` |
| `derivative` | SymPy | central and one-sided numeric differences |
| `integrate` | SymPy, mpmath quadrature (definite) | derivative of result equals integrand, exactly and numerically |
| `limit` | SymPy, mpmath extrapolation | values at 1e-15 and 1e-35 converge |
| `dsolve` (ODEs) | SymPy | `checkodesol`; substitution |
| `determinant` `rank` `inverse` `eigenvalues` `linsolve` `matmul` | SymPy, own rational elimination, NumPy | `A·A⁻¹ = I`; `det(A−λI)=0`; trace; `Ax=b` exactly |
| `is_prime` `factor_int` `gcd` `lcm` `modpow` `factorial` `choose` | own Miller–Rabin / Pollard rho / Euclid, stdlib, SymPy | product of factors = n; factors prime; Bézout |
| `sat` `prove` | Z3 (two configurations), truth tables, random model search | every model/counterexample re-evaluated in exact rationals |
| `stat` (sum, min, max, mean, median, variance, stdev) | exact rationals, NumPy, `statistics` | n/a |
| `convert` (length, mass, time, volume, energy, temperature) | exact NIST table, pint | exact round trip |
| `shortest_path` | Dijkstra, Bellman–Ford, NetworkX | path exists and sums to the cost |

## The rule that decides what is released

For each request every method runs. Agreeing results are grouped. A candidate is released only if

> (methods that agree + witness checks that pass) ≥ 2 **and** no witness check fails **and** it is not tied with a different candidate.

Otherwise the request is `WITHHELD`. Methods that crash or time out are recorded and ignored, never replaced by a guess. If the first tier disagrees, tier-2 methods are run to break the tie. Results with a known gap are marked `VERIFIED (with caveats)` and say what the gap is.

## Layers

* **`safe_expr`**: parses math text through a Python AST allowlist and interprets it node by node in four backends (SymPy, exact `Fraction`, mpmath, Z3). No `eval`/`exec`; attribute access, imports, lambdas, strings, comprehensions are rejected; `9^9^9`, huge factorials and 2000+ character inputs are refused.
* **`command`**: deterministic grammar. The text is the authorization: only the operations it names may run. The parsed command is echoed in every result so a misreading is visible.
* **`framework`**: methods, checks, the rule above, time limits, sealed certificates (SHA-256 over the content).
* **`Coordinator`** (the agent that coordinates): plans multi-step requests (`evaluate 10!; evaluate $1/4`), passes only verified values between steps, retries once with a longer time budget, refuses unauthorized operations.
* **`OutputGuard`** (the orchestration gate): renders text only from a releasable certificate. For AI consumers (`for_ai`, MCP) a withheld result carries a reason that never repeats a discarded value. `audit_claim` recomputes a question and says `MATCH`, `MISMATCH` (with the verified answer), `UNCOMPARABLE` or `UNVERIFIABLE` for an answer an AI proposed.
* **`AuditLog`**: append-only hash chain; edits or deletions are detected by `mathcore verify-log`.

## Using it with an AI (including the DeepSeek harness)

The AI proposes; mathcore computes and audits. Add `harness/model-instruction.txt` to the model's instructions and register the MCP server. For the harness in this repository family, `harness/mathcore.cordis.yml` is an overlay modeled on the shipped MCP examples:

```sh
dsh web --patch "$PWD/harness/mathcore.cordis.yml"
```

The overlay is **untested against a running harness**; the MCP server itself is tested over its real stdio protocol. Any other MCP client can use `mathcore-mcp` directly (`compute`, `check_answer`, `list_operations`).

## What "verified" means, and what it does not

* It means independent algorithms or libraries agreed, and/or a checkable witness (a root substituted back, factors multiplied, a model evaluated) passed. It is strong evidence, not a formal proof that SymPy, mpmath, NumPy or Z3 are bug-free, and several methods share SymPy for convenience.
* **Understanding the request is the weak point.** Exact mathematics cannot fix a question that was read wrongly (during testing the cleaner dropped the `!` of `10!` and answered `10`; fixed and covered by a test). That is why the parsed command is always echoed. Check the echo.
* Solving: for polynomials in one variable and square linear systems the solution list is complete. For other equations every listed solution is verified but completeness is not claimed, and the result is marked partial. Infinite solution sets are refused.
* Z3 proofs of arithmetic statements have no independent proof engine; they are marked partial. Propositional formulas are fully checked by truth table.
* NumPy comparisons use a tolerance (about 1e-8 relative); exact methods are compared exactly.
* Hard problems (large semiprimes, intractable integrals) time out and are withheld; they are never approximated silently.
* The "run machines and robots perfectly" idea holds only as far as the *model* of the machine and the translation of the request are right. This subsystem makes the calculation step exact and checkable; it does not make a physical system safe by itself.

## Tests

```sh
pip install -e .[test] && pytest
```

132 tests, about 86% line coverage: 60 known answers across every operation, 26 claim-audit cases, fault injection (a wrong engine is outvoted; two engines wrong in the same way are stopped by the witness check; all engines wrong releases nothing; crashing and hanging engines), hostile inputs, hash-chain tampering, the MCP protocol, and property tests on random inputs.

## Adding an operation

Create an `Operation` with at least two independent `Method`s or one method plus witness `Check`s, a `same` comparator and a `show` function, register it with `REGISTRY.add`, and add a pattern in `command.py`. The framework supplies voting, time limits, sealing and guard behaviour.
