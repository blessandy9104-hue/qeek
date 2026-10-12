# ADR 003: mathcore Integration for Verified Mathematics

## Status
Accepted

## Context
LLMs hallucinate mathematical computations. qeek requires **zero-hallucination math** for:
- Financial calculations
- Engineering computations
- Scientific research
- Code verification
- Audit trails

## Decision
Integrate **mathcore** via MCP (Model Context Protocol) for verified mathematics.

### mathcore Properties
- **Offline**: No API keys, no network required
- **Verified**: Every result verified by ≥2 independent methods
- **Auditable**: Hash-chained certificates for every computation
- **Comprehensive**: Algebra, calculus, linear algebra, number theory, logic, statistics, units

### Integration Pattern
```
User Request → Agent → mathcore_compute tool → MCP Client → mathcore-mcp (stdio) → mathcore Python → Verified Result → Certificate → Agent → User
```

### mathcore MCP Server
- Command: `mathcore-mcp` (provided by `pip install -e mathcore`)
- Transport: stdio
- Methods: `compute`, `check_answer`, `list_operations`
- Audit log: `~/.mathcore/audit.jsonl` (hash-chained)

### Agent Rules (Enforced via System Prompt)
```
FOR ANY ARITHMETIC, ALGEBRA, CALCULUS, LINEAR ALGEBRA, NUMBER THEORY, LOGIC, STATISTICS OR UNIT CONVERSION:
1. DO NOT compute in your head
2. CALL mathcore_compute with the request
3. STATE ONLY values it returns as VERIFIED
4. If WITHHELD, say result could not be verified; DO NOT GUESS
5. Before stating any numeric/symbolic result, CALL mathcore_check_answer and correct if MISMATCH
```

## Supported Operations
| Category | Operations | Verification |
|----------|------------|--------------|
| Arithmetic | evaluate, simplify, expand, factor | 3 methods agree |
| Calculus | derivative, integrate, limit, dsolve | Numeric differentiation, substitution |
| Linear Algebra | determinant, rank, inverse, eigenvalues, linsolve, matmul | A·A⁻¹=I, det(A-λI)=0 |
| Number Theory | is_prime, factor_int, gcd, lcm, modpow, factorial, choose | Product of factors = n |
| Logic | sat, prove | Z3 (2 configs), truth tables |
| Statistics | sum, mean, median, variance, stdev | Exact rationals, NumPy |
| Units | convert (length, mass, time, volume, energy, temp) | Exact round-trip |

## Audit Trail
Every computation produces a **sealed certificate**:
- SHA-256 hash of content
- Timestamp
- Method results
- Witness check results
- Verdict (VERIFIED / WITHHELD / VERIFIED WITH CAVEATS)

Certificates are append-only in `audit.jsonl` with hash-chaining for tamper detection.

## Consequences

### Positive
- **Zero Hallucination**: Mathematical results are provably correct
- **Auditability**: Complete trail for compliance/regulatory
- **Offline**: Works air-gapped, no cloud dependency
- **Trust**: Users can verify the verification

### Negative
- **Dependency**: Requires Python + mathcore installation
- **Latency**: MCP round-trip adds ~50-200ms per computation
- **Coverage**: Not all mathematical domains supported
- **Maintenance**: Separate Python package to update

## Implementation
- `packages/math/`: MCP client plugin
- `packages/capability/src/scanner.ts`: Builtin capability registration
- `config/*.cordis.yml`: MCP client configuration
- System prompt enforcement in `packages/core/src/system-prompt.ts`

## References
- [mathcore directory](./../../mathcore/README.md) (vendored in-repo; see `mathcore/NOTICE.md` for provenance)
- [MCP Specification](https://modelcontextprotocol.io/)
- [ADR 002: Capability Awareness](./002-capability-awareness.md)
