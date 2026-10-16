"""Probability: binomial, two-dice sums and fair-coin counts."""
from __future__ import annotations

import math
from fractions import Fraction
from typing import Any, Dict, Tuple

import mpmath as mp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, describe_number, to_mp
from .safe_expr import ParseError

_TOL = mp.mpf(10) ** -12


def _same_close(x: Any, y: Any) -> bool:
    try:
        return bool(close(x, y, _TOL))
    except Exception:
        return False


def _int(a: Dict[str, Any], key: str) -> int:
    v = a.get(key)
    if isinstance(v, bool) or not isinstance(v, int):
        raise ParseError(f"{key} must be an integer")
    return v


def _binom_args(a: Dict[str, Any]) -> Tuple[int, int, Fraction]:
    n, k = _int(a, "n"), _int(a, "k")
    try:
        p = Fraction(a["p"])
    except (KeyError, ValueError, ZeroDivisionError) as exc:
        raise ParseError(f"p must be a number ({exc})")
    if n < 0 or n > 100000:
        raise ParseError("n must be between 0 and 100000")
    if not 0 <= k <= n:
        raise ParseError("k must be between 0 and n")
    if not 0 <= p <= 1:
        raise ParseError("p must be between 0 and 1")
    return n, k, p


def _dice_args(a: Dict[str, Any]) -> int:
    total = _int(a, "total")
    if not 2 <= total <= 12:
        raise ParseError("two dice sum to between 2 and 12")
    return total


def _coin_args(a: Dict[str, Any]) -> Tuple[int, int]:
    n, k = _int(a, "n"), _int(a, "k")
    if n < 1 or n > 100000:
        raise ParseError("n must be between 1 and 100000")
    if not 0 <= k <= n:
        raise ParseError("k must be between 0 and n")
    return n, k


def _prob_exact(a: Dict[str, Any]) -> Any:
    kind = a.get("kind")
    if kind == "binomial":
        n, k, p = _binom_args(a)
        return Fraction(math.comb(n, k)) * p ** k * (1 - p) ** (n - k)
    if kind == "dice":
        total = _dice_args(a)
        count = sum(1 for d1 in range(1, 7) for d2 in range(1, 7) if d1 + d2 == total)
        return Fraction(count, 36)
    if kind == "coin":
        n, k = _coin_args(a)
        return Fraction(math.comb(n, k), 2 ** n)
    raise ParseError(f"unknown probability kind {kind!r}")


def _prob_float(a: Dict[str, Any]) -> Any:
    kind = a.get("kind")
    if kind == "binomial":
        n, k, p = _binom_args(a)
        pf = float(p)
        return float(math.comb(n, k)) * (pf ** k) * ((1.0 - pf) ** (n - k))
    if kind == "dice":
        total = _dice_args(a)
        count = sum(1.0 for d1 in range(1, 7) for d2 in range(1, 7) if d1 + d2 == total)
        return count / 36.0
    if kind == "coin":
        n, k = _coin_args(a)
        return float(math.comb(n, k)) / float(2 ** n)
    raise ParseError(f"unknown probability kind {kind!r}")


def _recompute(a: Dict[str, Any]) -> Fraction:
    """Independent recount: factorials instead of math.comb, closed form instead of enumeration."""
    kind = a.get("kind")
    if kind == "binomial":
        n, k, p = _binom_args(a)
        c = Fraction(math.factorial(n), math.factorial(k) * math.factorial(n - k))
        return c * p ** k * (1 - p) ** (n - k)
    if kind == "dice":
        return Fraction(6 - abs(7 - _dice_args(a)), 36)
    if kind == "coin":
        n, k = _coin_args(a)
        c = Fraction(math.factorial(n), math.factorial(k) * math.factorial(n - k))
        return c / 2 ** n
    raise ParseError(f"unknown probability kind {kind!r}")


def _check_prob_valid(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    _recompute(dict(a))  # revalidates every parameter
    m = to_mp(v)
    ok = bool(mp.mpf(0) - _TOL <= m <= 1 + _TOL)
    return ok, "probability lies in [0, 1]" if ok else "probability outside [0, 1]"


def _check_prob_counts(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    ok = _same_close(v, _recompute(dict(a)))
    return ok, "independent recount agrees" if ok else "independent recount disagrees"


REGISTRY.add(Operation(
    "probability", "Binomial, two-dice and fair-coin probabilities",
    [Method("fraction-exact", "fractions", _prob_exact),
     Method("float", "stdlib", _prob_float)],
    checks=[Check("in-unit-interval", _check_prob_valid),
            Check("recount", _check_prob_counts)],
    same=_same_close, show=describe_number, min_confirmations=3))
