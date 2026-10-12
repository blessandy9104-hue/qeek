"""Algebra: evaluate, simplify, expand, factor, solve."""
from __future__ import annotations

from fractions import Fraction
from typing import Any, Dict, List, Tuple

import mpmath as mp
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import (close, describe_number, fmt_mp, is_exact, mp_env, sample_points, same_number, to_fraction_exact,
                      to_mp)
from .safe_expr import (NotApplicable, ParseError, free_names, split_equation, to_fraction, to_mpmath, to_sympy)


# --------------------------------------------------------------------------- evaluate
def _evaluate_sympy(a: Dict[str, Any]) -> Any:
    e = to_sympy(a["expr"])
    if isinstance(e, list) or e.free_symbols:
        raise ParseError("evaluate needs a number; use simplify for expressions with variables")
    return sp.simplify(e)


def _evaluate_fraction(a: Dict[str, Any]) -> Any:
    return to_fraction(a["expr"])


def _evaluate_mp(a: Dict[str, Any]) -> Any:
    return to_mpmath(a["expr"])


def _evaluate_caveats(a: Dict[str, Any], v: Any) -> List[str]:
    return ["result is numeric (about 30 digits); no exact closed form was produced"] \
        if isinstance(v, (mp.mpf, mp.mpc)) else []


REGISTRY.add(Operation(
    "evaluate", "Exact value of a variable-free expression",
    [Method("sympy-exact", "sympy", _evaluate_sympy),
     Method("rational-arithmetic", "fractions", _evaluate_fraction),
     Method("mpmath-60-digits", "mpmath", _evaluate_mp)],
    same=same_number, show=describe_number, caveats=_evaluate_caveats))


# --------------------------------------------------------------------------- simplify family
def _transform(kind: str):
    def run(a: Dict[str, Any]) -> Any:
        e = to_sympy(a["expr"])
        if isinstance(e, list):
            raise ParseError("expected one expression")
        return {"simplify": sp.simplify, "expand": sp.expand, "factor": sp.factor}[kind](e)
    return run


def _exact_equivalence(a: Dict[str, Any], new: Any) -> Tuple[bool, str]:
    old = to_sympy(a["expr"])
    d = old - new
    if sp.expand(d) == 0:
        return True, "expand(original - result) = 0"
    if sp.simplify(d) == 0:
        return True, "simplify(original - result) = 0"
    if d.equals(0) is True:
        return True, "original - result equals 0"
    return False, "could not show original = result exactly"


def _numeric_equivalence(a: Dict[str, Any], new: Any) -> Tuple[bool, str]:
    names = free_names(a["expr"])
    syms = [sp.Symbol(n) for n in names]
    fn = sp.lambdify(syms, new, modules="mpmath")
    good = 0
    for pt in sample_points(names, 12) if names else [{}]:
        env = mp_env(pt)
        try:
            lhs = to_mpmath(a["expr"], env)
            rhs = fn(*[env[n] for n in names])
        except Exception:
            continue
        if isinstance(rhs, (sp.Basic,)):
            rhs = to_mp(rhs)
        if not close(lhs, rhs, mp.mpf(10) ** -25):
            return False, f"differs at {pt}"
        good += 1
    need = 1 if not names else 3
    return good >= need, f"{good} sample points agree"


for _k in ("simplify", "expand", "factor"):
    REGISTRY.add(Operation(
        _k, f"{_k.capitalize()} an algebraic expression",
        [Method(f"sympy-{_k}", "sympy", _transform(_k))],
        checks=[Check("exact-equivalence", _exact_equivalence),
                Check("numeric-sampling", _numeric_equivalence)],
        same=lambda x, y: sp.simplify(x - y) == 0, show=str))


# --------------------------------------------------------------------------- solve
Solution = Dict[str, Any]


def _equation(text: str) -> Any:
    parts = split_equation(text)
    if parts is None:
        e = to_sympy(text)
        if isinstance(e, list) or getattr(e, "is_Relational", False):
            raise ParseError("expected an equation")
        return sp.Eq(e, 0)
    return sp.Eq(to_sympy(parts[0]), to_sympy(parts[1]))


def _key(sol: Solution) -> Tuple:
    out = []
    for k in sorted(sol):
        m = to_mp(sol[k])
        out.append((float(mp.re(m)), float(mp.im(m))))
    return tuple(out)


def _norm(sols: List[Solution]) -> List[Solution]:
    return sorted(sols, key=_key)


def _single_polynomial(a: Dict[str, Any]):
    """Return (variable, numerator polynomial) when the equation is a rational function of one variable."""
    if len(a["equations"]) != 1 or len(a["vars"]) != 1:
        return None
    x = sp.Symbol(a["vars"][0])
    eq = _equation(a["equations"][0])
    expr = sp.cancel(sp.together(eq.lhs - eq.rhs))
    num, den = sp.fraction(expr)
    try:
        pn = sp.Poly(num, x)
        sp.Poly(den, x)
    except sp.PolynomialError:
        return None
    if any(not c.is_Rational for c in pn.all_coeffs()) or pn.is_zero:
        return None
    if expr.free_symbols - {x}:
        return None
    return x, pn


def _solve_sympy(a: Dict[str, Any]) -> List[Solution]:
    eqs = [_equation(e) for e in a["equations"]]
    syms = [sp.Symbol(v) for v in a["vars"]]
    if len(eqs) == 1 and len(syms) == 1:
        s = sp.solveset(eqs[0], syms[0], domain=sp.S.Complexes)
        if not isinstance(s, sp.FiniteSet):
            raise NotApplicable("the solution set is not a finite list")
        return _norm([{str(syms[0]): v} for v in s])
    res = sp.solve(eqs, syms, dict=True)
    sols = [{str(k): v for k, v in d.items()} for d in res]
    if any(set(d) != set(a["vars"]) for d in sols):
        raise NotApplicable("underdetermined or parametric system")
    return _norm(sols)


def _solve_numeric(a: Dict[str, Any]) -> List[Solution]:
    found = _single_polynomial(a)
    if found is None:
        raise NotApplicable("not a polynomial in one variable")
    x, pn = found
    if pn.degree() <= 0:
        return []
    coeffs = [mp.mpf(int(c.p)) / mp.mpf(int(c.q)) for c in pn.all_coeffs()]
    with mp.workdps(120):
        roots = mp.polyroots(coeffs, maxsteps=800, extraprec=400)
    distinct: List[Any] = []
    for r in roots:
        if not any(abs(r - d) < mp.mpf(10) ** -9 * max(1, abs(r)) for d in distinct):
            distinct.append(r)
    return _norm([{str(x): +r} for r in distinct])


def _solve_linear_exact(a: Dict[str, Any]) -> List[Solution]:
    """Gaussian elimination over the rationals, independent of SymPy's solvers."""
    eqs = [_equation(e) for e in a["equations"]]
    syms = [sp.Symbol(v) for v in a["vars"]]
    if len(eqs) != len(syms):
        raise NotApplicable("not a square system")
    try:
        A, b = sp.linear_eq_to_matrix([e.lhs - e.rhs for e in eqs], syms)
    except Exception:
        raise NotApplicable("not linear") from None
    n = len(syms)
    M = [[Fraction(int(A[i, j].p), int(A[i, j].q)) for j in range(n)] + [Fraction(int(b[i].p), int(b[i].q))]
         for i in range(n)]
    for col in range(n):
        piv = next((r for r in range(col, n) if M[r][col] != 0), None)
        if piv is None:
            raise NotApplicable("singular system")
        M[col], M[piv] = M[piv], M[col]
        M[col] = [v / M[col][col] for v in M[col]]
        for r in range(n):
            if r != col and M[r][col] != 0:
                f = M[r][col]
                M[r] = [rv - f * cv for rv, cv in zip(M[r], M[col])]
    return [{str(s): M[i][n] for i, s in enumerate(syms)}]


def _same_solutions(x: List[Solution], y: List[Solution]) -> bool:
    if len(x) != len(y):
        return False
    left = list(y)
    for s in x:
        for t in left:
            if set(s) == set(t) and all(close(s[k], t[k], mp.mpf(10) ** -9) for k in s):
                left.remove(t)
                break
        else:
            return False
    return True


def _as_sympy(v: Any) -> Any:
    if isinstance(v, Fraction):
        return sp.Rational(v.numerator, v.denominator)
    if isinstance(v, (mp.mpf, mp.mpc)):
        return sp.Float(mp.nstr(mp.re(v), 50), 50) + sp.I * sp.Float(mp.nstr(mp.im(v), 50), 50)
    return v


def _check_substitution(a: Dict[str, Any], sols: List[Solution]) -> Tuple[bool, str]:
    eqs = [_equation(e) for e in a["equations"]]
    for sol in sols:
        sub = {sp.Symbol(k): _as_sympy(v) for k, v in sol.items()}
        for eq in eqs:
            res = (eq.lhs - eq.rhs).subs(sub)
            if res.has(sp.zoo, sp.nan, sp.oo, -sp.oo):
                return False, f"{sol} makes the equation undefined"
            if res == 0 or sp.simplify(res) == 0:
                continue
            approx = abs(complex(sp.N(res, 40))) if not res.free_symbols else 1.0
            scale = max(1.0, abs(complex(sp.N((eq.lhs).subs(sub), 40)))) if not res.free_symbols else 1.0
            if approx > 1e-25 * scale:
                return False, f"residual {approx:.3g} for {sol}"
    return True, f"all {len(sols)} solution(s) satisfy every equation"


def _check_root_count(a: Dict[str, Any], sols: List[Solution]) -> Tuple[bool, str]:
    found = _single_polynomial(a)
    if found is None:
        return True, "not a one-variable polynomial; count check skipped"
    x, pn = found
    g = sp.gcd(pn, pn.diff(x))
    distinct = pn.degree() - g.degree() if pn.degree() > 0 else 0
    return len(sols) == distinct, f"{len(sols)} found, {distinct} distinct roots by degree - degree(gcd(p, p'))"


def _show_solutions(sols: List[Solution]) -> str:
    if not sols:
        return "no solutions"
    rows = []
    for s in sols:
        rows.append(", ".join((f"{k} \u2248 {fmt_mp(v, 20)}" if isinstance(v, (mp.mpf, mp.mpc))
                               else f"{k} = {describe_number(v, 20)}") for k, v in sorted(s.items())))
    return "; ".join(rows)


def _solve_caveats(a: Dict[str, Any], sols: List[Solution]) -> List[str]:
    if any(isinstance(v, (mp.mpf, mp.mpc)) for s in sols for v in s.values()):
        return ["solutions are numeric approximations (about 20 digits); the exact solver did not confirm them"]
    if _single_polynomial(a) is not None:
        return []
    if len(a["equations"]) == len(a["vars"]) and all(
            _is_linear(a, e) for e in a["equations"]):
        return []
    return ["every listed solution is verified exactly, but the list is not proven complete "
            "(non-polynomial or non-linear system)"]


def _is_linear(a: Dict[str, Any], text: str) -> bool:
    eq = _equation(text)
    syms = [sp.Symbol(v) for v in a["vars"]]
    try:
        return sp.Poly(eq.lhs - eq.rhs, *syms).total_degree() <= 1
    except sp.PolynomialError:
        return False


REGISTRY.add(Operation(
    "solve", "Solve equations or a system exactly (all complex solutions for polynomials)",
    [Method("sympy-solve", "sympy", _solve_sympy),
     Method("numeric-polynomial-roots", "mpmath", _solve_numeric),
     Method("rational-gaussian-elimination", "fractions", _solve_linear_exact)],
    checks=[Check("exact-substitution", _check_substitution),
            Check("distinct-root-count", _check_root_count)],
    same=_same_solutions, show=_show_solutions, caveats=_solve_caveats))
