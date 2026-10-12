"""Calculus: derivative, integrate, limit, ordinary differential equations."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

import mpmath as mp
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, mp_env, sample_points, to_mp
from .safe_expr import NotApplicable, ParseError, free_names, to_mpmath, to_sympy

_INF = {"oo": mp.inf, "inf": mp.inf, "+oo": mp.inf, "-oo": -mp.inf, "-inf": -mp.inf}


def _bound_sympy(text: str) -> Any:
    t = text.strip()
    return {"oo": sp.oo, "inf": sp.oo, "+oo": sp.oo, "-oo": -sp.oo, "-inf": -sp.oo}.get(t) or to_sympy(t)


def _bound_mp(text: str) -> Any:
    t = text.strip()
    return _INF[t] if t in _INF else to_mpmath(t)


def _fn(expr_text: str, var: str, fixed: Dict[str, Any]):
    def f(t: Any) -> Any:
        env = dict(fixed)
        env[var] = t
        return to_mpmath(expr_text, env)
    return f


def _others(expr_text: str, var: str) -> List[str]:
    return [n for n in free_names(expr_text) if n != var]


# --------------------------------------------------------------------------- derivative
def _derivative(a: Dict[str, Any]) -> Any:
    e = to_sympy(a["expr"])
    return sp.diff(e, sp.Symbol(a["var"]), int(a.get("order", 1)))


def _numeric_derivative_check(direction: int, label: str):
    def check(a: Dict[str, Any], d: Any) -> Tuple[bool, str]:
        var, order = a["var"], int(a.get("order", 1))
        others = _others(a["expr"], var)
        syms = [sp.Symbol(var)] + [sp.Symbol(o) for o in others]
        g = sp.lambdify(syms, d, modules="mpmath")
        good = 0
        for pt in sample_points([var] + others, 12):
            env = mp_env(pt)
            fixed = {k: env[k] for k in others}
            try:
                f = _fn(a["expr"], var, fixed)
                with mp.workdps(60):
                    num = mp.diff(f, env[var], order, direction=direction)
                sym = g(env[var], *[env[o] for o in others])
            except Exception:
                continue
            tol = mp.mpf(10) ** (-18 if direction == 0 else -10)
            if not close(num, sym, tol):
                return False, f"{label} derivative differs at {pt}"
            good += 1
        return good >= 3, f"{good} sample points agree ({label})"
    return check


REGISTRY.add(Operation(
    "derivative", "Derivative of an expression (any order, partial allowed)",
    [Method("sympy-diff", "sympy", _derivative)],
    checks=[Check("central-difference", _numeric_derivative_check(0, "central")),
            Check("one-sided-difference", _numeric_derivative_check(1, "one-sided"))],
    same=lambda x, y: sp.simplify(x - y) == 0, show=str))


# --------------------------------------------------------------------------- integrate
def _integrate_sympy(a: Dict[str, Any]) -> Any:
    e = to_sympy(a["expr"])
    x = sp.Symbol(a["var"])
    if a.get("lower") is None:
        r = sp.integrate(e, x)
    else:
        r = sp.integrate(e, (x, _bound_sympy(a["lower"]), _bound_sympy(a["upper"])))
    if r.has(sp.Integral):
        raise NotApplicable("no closed form found")
    return r


def _integrate_quad(a: Dict[str, Any]) -> Any:
    if a.get("lower") is None:
        raise NotApplicable("indefinite integral")
    others = _others(a["expr"], a["var"])
    if others:
        raise NotApplicable("free parameters")
    f = _fn(a["expr"], a["var"], {})
    with mp.workdps(40):
        return mp.quad(f, [_bound_mp(a["lower"]), _bound_mp(a["upper"])])


def _same_integral(x: Any, y: Any) -> bool:
    return close(x, y, mp.mpf(10) ** -15)


def _check_antiderivative_exact(a: Dict[str, Any], F: Any) -> Tuple[bool, str]:
    if a.get("lower") is not None:
        return True, "definite integral: antiderivative check not needed"
    f = to_sympy(a["expr"])
    d = sp.diff(F, sp.Symbol(a["var"])) - f
    if sp.expand(d) == 0 or sp.simplify(d) == 0 or d.equals(0) is True:
        return True, "d/dx(result) - integrand = 0"
    return False, "derivative of the result does not equal the integrand"


def _check_antiderivative_numeric(a: Dict[str, Any], F: Any) -> Tuple[bool, str]:
    if a.get("lower") is not None:
        return True, "definite integral: not applicable"
    var = a["var"]
    others = _others(a["expr"], var)
    syms = [sp.Symbol(var)] + [sp.Symbol(o) for o in others]
    g = sp.lambdify(syms, F, modules="mpmath")
    good = 0
    for pt in sample_points([var] + others, 12):
        env = mp_env(pt)
        fixed = {k: env[k] for k in others}
        try:
            with mp.workdps(60):
                num = mp.diff(lambda t: g(t, *[env[o] for o in others]), env[var])
            expect = _fn(a["expr"], var, fixed)(env[var])
        except Exception:
            continue
        if not close(num, expect, mp.mpf(10) ** -15):
            return False, f"numeric derivative of the result differs at {pt}"
        good += 1
    return good >= 3, f"{good} sample points agree"


def _integral_caveats(a: Dict[str, Any], v: Any) -> List[str]:
    return ["indefinite integral: valid up to an additive constant"] if a.get("lower") is None else []


REGISTRY.add(Operation(
    "integrate", "Indefinite or definite integral",
    [Method("sympy-integrate", "sympy", _integrate_sympy),
     Method("mpmath-quadrature", "mpmath", _integrate_quad)],
    checks=[Check("antiderivative-exact", _check_antiderivative_exact),
            Check("antiderivative-numeric", _check_antiderivative_numeric)],
    same=lambda x, y: _same_integral(x, y) if (_defin(x) and _defin(y)) else (sp.simplify(x - y) == 0),
    show=lambda v: str(v) if not _defin(v) or getattr(v, "is_Integer", False) else f"{v}  (\u2248 {mp.nstr(to_mp(v), 25)})",
    caveats=_integral_caveats))


def _defin(v: Any) -> bool:
    """True for numbers (no free symbols)."""
    return isinstance(v, (mp.mpf, mp.mpc)) or not getattr(v, "free_symbols", {None})


# --------------------------------------------------------------------------- limit
def _limit_sympy(a: Dict[str, Any]) -> Any:
    e = to_sympy(a["expr"])
    x = sp.Symbol(a["var"])
    d = {"+": "+", "-": "-", "both": "+-"}[a.get("dir", "both")]
    r = sp.limit(e, x, _bound_sympy(a["point"]), d)
    if r.has(sp.Limit) or r == sp.nan:
        raise NotApplicable("limit not determined")
    return r


def _limit_mp(a: Dict[str, Any]) -> Any:
    if _others(a["expr"], a["var"]):
        raise NotApplicable("free parameters")
    f = _fn(a["expr"], a["var"], {})
    p = _bound_mp(a["point"])
    direction = {"+": 1, "-": -1, "both": 1}[a.get("dir", "both")]
    with mp.workdps(40):
        return mp.limit(f, p, direction=direction)


def _same_limit(x: Any, y: Any) -> bool:
    return close(x, y, mp.mpf(10) ** -12)


def _check_approach(a: Dict[str, Any], L: Any) -> Tuple[bool, str]:
    if _others(a["expr"], a["var"]):
        return True, "free parameters: approach check skipped"
    p = _bound_mp(a["point"])
    sides = {"+": [1], "-": [-1], "both": [1, -1]}[a.get("dir", "both")]
    target = to_mp(L)
    f = _fn(a["expr"], a["var"], {})
    with mp.workdps(100):
        for side in sides:
            errs = []
            for k in (15, 35):
                step = mp.mpf(10) ** k if mp.isinf(p) else mp.mpf(10) ** -k
                pt = (side * step if p == 0 else p + side * step) if not mp.isinf(p) else (mp.sign(p) * step)
                val = f(pt)
                if mp.isinf(target):
                    if abs(val) < 1e10 or mp.sign(val) != mp.sign(target):
                        return False, f"values near the point do not diverge toward {L}"
                    errs.append(0)
                else:
                    errs.append(abs(val - target))
            if not mp.isinf(target) and not (errs[1] < mp.mpf(10) ** -6 and errs[1] <= errs[0] * 1.0000001 + mp.mpf(10) ** -40):
                return False, f"values near the point do not converge to {L}"
    return True, "values at distances 1e-15 and 1e-35 converge toward the limit"


REGISTRY.add(Operation(
    "limit", "Limit of an expression (finite point or infinity, one- or two-sided)",
    [Method("sympy-limit", "sympy", _limit_sympy),
     Method("mpmath-extrapolation", "mpmath", _limit_mp)],
    checks=[Check("approach-values", _check_approach)],
    same=_same_limit, show=str))


# --------------------------------------------------------------------------- dsolve
def _ode_parts(a: Dict[str, Any]) -> Tuple[Any, Any, Any]:
    text, fname, var = a["equation"], a["func"], a["var"]
    text = re.sub(rf"\b{fname}\s*\(\s*{var}\s*\)", fname, text)
    text = re.sub(rf"\b{fname}('+)", lambda m: f"{fname}__{len(m.group(1))}", text)
    lhs, _, rhs = text.partition("=")
    x = sp.Symbol(var)
    f = sp.Function(fname)
    mapping = {sp.Symbol(fname): f(x)}
    for n in range(1, 6):
        mapping[sp.Symbol(f"{fname}__{n}")] = f(x).diff(x, n)
    eq = sp.Eq(to_sympy(lhs).subs(mapping), to_sympy(rhs or "0").subs(mapping))
    return eq, f(x), x


def _dsolve(a: Dict[str, Any]) -> Any:
    eq, fx, _ = _ode_parts(a)
    return sp.dsolve(eq, fx)


def _check_ode(a: Dict[str, Any], sol: Any) -> Tuple[bool, str]:
    eq, fx, _ = _ode_parts(a)
    ok, rem = sp.checkodesol(eq, sol)
    return bool(ok), f"checkodesol remainder {rem}"


def _check_ode_substitution(a: Dict[str, Any], sol: Any) -> Tuple[bool, str]:
    eq, fx, x = _ode_parts(a)
    residual = (eq.lhs - eq.rhs).subs(fx, sol.rhs).doit()
    ok = sp.simplify(residual) == 0
    return ok, "substituting the solution leaves residual " + str(sp.simplify(residual))


REGISTRY.add(Operation(
    "dsolve", "General solution of an ordinary differential equation",
    [Method("sympy-dsolve", "sympy", _dsolve)],
    checks=[Check("checkodesol", _check_ode), Check("substitution", _check_ode_substitution)],
    same=lambda x, y: sp.simplify(x.rhs - y.rhs) == 0, show=str,
    caveats=lambda a, v: ["general solution: C1, C2, ... are arbitrary constants"]))
