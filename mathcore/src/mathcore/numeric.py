"""Shared numeric helpers: conversion to mpmath, tolerant equality, sample points."""
from __future__ import annotations

import random
from fractions import Fraction
from typing import Any, Dict, List, Sequence

import mpmath as mp
import sympy as sp

mp.mp.dps = 60

TOL = mp.mpf(10) ** -30


def is_exact(v: Any) -> bool:
    return isinstance(v, (int, Fraction)) or (isinstance(v, sp.Basic) and v.is_Rational)


def to_fraction_exact(v: Any) -> Fraction:
    if isinstance(v, Fraction):
        return v
    if isinstance(v, int):
        return Fraction(v)
    return Fraction(int(v.p), int(v.q))


def to_mp(v: Any) -> Any:
    """Convert int / Fraction / SymPy / mpmath values to an mpmath number (60 digits)."""
    if isinstance(v, (mp.mpf, mp.mpc)):
        return v
    if isinstance(v, bool):
        return mp.mpf(int(v))
    if isinstance(v, int):
        return mp.mpf(v)
    if isinstance(v, Fraction):
        return mp.mpf(v.numerator) / mp.mpf(v.denominator)
    if isinstance(v, float):
        return mp.mpf(v)
    v = sp.sympify(v)
    if v == sp.oo:
        return mp.inf
    if v == -sp.oo:
        return -mp.inf
    if v.has(sp.zoo, sp.nan):
        raise ValueError("undefined value")
    re_, im_ = sp.N(v, 70).as_real_imag()
    r, i = mp.mpf(str(re_)), mp.mpf(str(im_))
    return mp.mpc(r, i) if i != 0 else r


def close(a: Any, b: Any, tol: Any = TOL) -> bool:
    a, b = to_mp(a), to_mp(b)
    if mp.isinf(a) or mp.isinf(b):
        return mp.isinf(a) and mp.isinf(b) and mp.sign(a) == mp.sign(b)
    return abs(a - b) <= tol * max(1, abs(a), abs(b))


def same_number(a: Any, b: Any) -> bool:
    """Exact equality when both are rational, otherwise agreement to 30 digits."""
    if is_exact(a) and is_exact(b):
        return to_fraction_exact(a) == to_fraction_exact(b)
    return close(a, b)


def fmt_mp(m: Any, digits: int = 30) -> str:
    """Plain decimal text for an mpmath real or complex number."""
    m = to_mp(m)
    if isinstance(m, mp.mpc):
        re_, im_ = mp.nstr(m.real, digits), mp.nstr(abs(m.imag), digits)
        sign = "-" if m.imag < 0 else "+"
        return f"{re_} {sign} {im_}*I" if m.real != 0 else f"{'-' if m.imag < 0 else ''}{im_}*I"
    return mp.nstr(m, digits)


def describe_number(v: Any, digits: int = 30) -> str:
    """Exact form first, then a decimal approximation when it adds information."""
    if isinstance(v, complex):
        v = mp.mpc(v)
    if isinstance(v, (mp.mpf, mp.mpc)):
        return "\u2248 " + fmt_mp(v, digits)
    if isinstance(v, Fraction):
        v = sp.Rational(v.numerator, v.denominator)
    s = str(v)
    if getattr(v, "is_Integer", False):
        return s
    try:
        re_, im_ = sp.sympify(v).as_real_imag()
        if im_ != 0 and re_.is_Rational and im_.is_Rational:
            return s  # exact Gaussian rational: nothing to approximate
        approx = to_mp(v)
    except Exception:
        return s
    txt = fmt_mp(approx, digits)
    return s if txt == s else f"{s}  (\u2248 {txt})"


def sample_points(names: Sequence[str], count: int = 8, seed: int = 20260101) -> List[Dict[str, Fraction]]:
    """Deterministic rational sample points (reproducible certificates)."""
    rng = random.Random(seed)
    pts: List[Dict[str, Fraction]] = []
    seen = set()
    guard = 0
    while len(pts) < count and guard < 500:
        guard += 1
        pt = {n: Fraction(rng.randint(-60, 60), rng.randint(1, 7)) / 10 for n in names}
        key = tuple(sorted(pt.items()))
        if key in seen:
            continue
        seen.add(key)
        pts.append(pt)
    return pts


def mp_env(point: Dict[str, Fraction]) -> Dict[str, Any]:
    return {k: to_mp(v) for k, v in point.items()}
