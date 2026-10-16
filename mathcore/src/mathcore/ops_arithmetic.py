"""Arithmetic extras: percentages and ratios."""
from __future__ import annotations

import math
from fractions import Fraction
from typing import Any, Dict, Tuple

import mpmath as mp
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, describe_number, to_mp
from .safe_expr import ParseError

_TOL = mp.mpf(10) ** -12


def _same_close(x: Any, y: Any) -> bool:
    try:
        return bool(close(x, y, _TOL))
    except Exception:
        return False


# --------------------------------------------------------------------------- percent
def _pct_base(a: Dict[str, Any]) -> Tuple[Fraction, Fraction]:
    try:
        return Fraction(a["pct"]), Fraction(a["base"])
    except (KeyError, ValueError, ZeroDivisionError) as exc:
        raise ParseError(f"percent needs a percentage and a base value ({exc})")


def _percent_exact(a: Dict[str, Any]) -> Any:
    pct, base = _pct_base(a)
    f = pct * base / 100
    return sp.Rational(f.numerator, f.denominator)


def _percent_float(a: Dict[str, Any]) -> Any:
    pct, base = _pct_base(a)
    return float(pct) * float(base) / 100.0


def _check_percent_recompute(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    pct, base = _pct_base(a)
    want = pct * base / 100
    ok = _same_close(v, want)
    return ok, "recomputed percentage matches" if ok else "recomputed percentage differs"


def _check_percent_share(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    pct, base = _pct_base(a)
    m = to_mp(v)
    if base == 0:
        ok = m == 0
        return ok, "a percentage of zero is zero" if ok else "a percentage of zero must be zero"
    share = m * 100 / to_mp(base)
    tol = _TOL * max(1, abs(share), abs(to_mp(pct)))
    ok = bool(abs(share - to_mp(pct)) <= tol)
    return ok, "value/base restores the percentage" if ok else "value/base does not restore the percentage"


REGISTRY.add(Operation(
    "percent", "Percentage of a value (p percent of base)",
    [Method("fraction-exact", "fractions", _percent_exact),
     Method("float", "stdlib", _percent_float)],
    checks=[Check("recompute-exact", _check_percent_recompute),
            Check("share-consistency", _check_percent_share)],
    same=_same_close, show=describe_number, min_confirmations=3))


# --------------------------------------------------------------------------- ratio
def _ratio_args(a: Dict[str, Any]) -> Tuple[Fraction, Fraction]:
    try:
        x, y = Fraction(a["a"]), Fraction(a["b"])
    except (KeyError, ValueError, ZeroDivisionError) as exc:
        raise ParseError(f"ratio needs two numbers ({exc})")
    if y == 0:
        raise ParseError("ratio needs a nonzero second term")
    return x, y


def _reduce(x: Fraction, y: Fraction) -> Tuple[int, int]:
    scale = abs(x.denominator * y.denominator) // math.gcd(x.denominator, y.denominator)
    ix, iy = int(x * scale), int(y * scale)
    g = math.gcd(ix, iy)
    ix, iy = ix // g, iy // g
    if iy < 0:
        ix, iy = -ix, -iy
    return ix, iy


def _ratio_own(a: Dict[str, Any]) -> Tuple[int, int]:
    return _reduce(*_ratio_args(a))


def _ratio_sympy(a: Dict[str, Any]) -> Tuple[int, int]:
    x, y = _ratio_args(a)
    r = sp.Rational(x.numerator, x.denominator) / sp.Rational(y.numerator, y.denominator)
    return int(r.p), int(r.q)


def _ratio_pair(v: Any) -> Tuple[int, int]:
    r1, r2 = v
    if isinstance(r1, bool) or isinstance(r2, bool) or not isinstance(r1, int) or not isinstance(r2, int):
        raise ParseError("ratio result must be a pair of integers")
    return r1, r2


def _check_ratio_cross(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    r1, r2 = _ratio_pair(v)
    x, y = _ratio_args(a)
    ok = x * r2 == y * r1
    return ok, "reduced ratio cross-multiplies with the input" if ok else "cross-multiplication failed"


def _check_ratio_reduced(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:  # noqa: ARG001
    r1, r2 = _ratio_pair(v)
    ok = r2 > 0 and math.gcd(abs(r1), abs(r2)) == 1
    return ok, "terms are coprime with a positive second term" if ok else "ratio is not fully reduced"


REGISTRY.add(Operation(
    "ratio", "Reduce a ratio a:b to lowest terms",
    [Method("gcd-reduce", "fractions", _ratio_own),
     Method("sympy-rational", "sympy", _ratio_sympy)],
    checks=[Check("cross-multiplication", _check_ratio_cross),
            Check("fully-reduced", _check_ratio_reduced)],
    same=lambda x, y: tuple(x) == tuple(y),
    show=lambda v: f"{v[0]}:{v[1]}", min_confirmations=3))
