"""Geometry: areas, volumes and right-triangle solving."""
from __future__ import annotations

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


def _dim(a: Dict[str, Any], key: str, what: str) -> Fraction:
    try:
        v = Fraction(a[key])
    except (KeyError, ValueError, ZeroDivisionError) as exc:
        raise ParseError(f"{what} must be a number ({exc})")
    if v <= 0:
        raise ParseError(f"{what} must be positive")
    return v


def _rat(f: Fraction) -> Any:
    return sp.Rational(f.numerator, f.denominator)


def _mp(f: Fraction) -> Any:
    return mp.mpf(f.numerator) / mp.mpf(f.denominator)


# --------------------------------------------------------------------------- area
def _area_sympy(a: Dict[str, Any]) -> Any:
    s = a.get("shape")
    if s == "circle":
        r = _rat(_dim(a, "radius", "radius"))
        return sp.pi * r ** 2
    if s == "rectangle":
        return _rat(_dim(a, "length", "length")) * _rat(_dim(a, "width", "width"))
    if s == "triangle":
        return _rat(_dim(a, "base", "base")) * _rat(_dim(a, "height", "height")) / 2
    raise ParseError(f"unknown area shape {s!r}")


def _area_mpmath(a: Dict[str, Any]) -> Any:
    s = a.get("shape")
    if s == "circle":
        r = _mp(_dim(a, "radius", "radius"))
        return mp.pi * r ** 2
    if s == "rectangle":
        return _mp(_dim(a, "length", "length")) * _mp(_dim(a, "width", "width"))
    if s == "triangle":
        return _mp(_dim(a, "base", "base")) * _mp(_dim(a, "height", "height")) / 2
    raise ParseError(f"unknown area shape {s!r}")


def _check_area_positive(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    _area_sympy(dict(a))  # revalidates every dimension
    ok = bool(to_mp(v) > 0)
    return ok, "area is positive" if ok else "area must be positive"


def _check_area_numeric(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    ok = _same_close(v, _area_mpmath(dict(a)))
    return ok, "exact and numeric evaluations agree" if ok else "exact and numeric evaluations disagree"


REGISTRY.add(Operation(
    "area", "Area of a circle, rectangle or triangle",
    [Method("sympy-exact", "sympy", _area_sympy),
     Method("mpmath-numeric", "mpmath", _area_mpmath)],
    checks=[Check("positive", _check_area_positive),
            Check("numeric-closeness", _check_area_numeric)],
    same=_same_close, show=describe_number, min_confirmations=3))


# --------------------------------------------------------------------------- volume
def _volume_sympy(a: Dict[str, Any]) -> Any:
    s = a.get("shape")
    if s == "sphere":
        r = _rat(_dim(a, "radius", "radius"))
        return sp.Rational(4, 3) * sp.pi * r ** 3
    if s == "box":
        return (_rat(_dim(a, "length", "length")) * _rat(_dim(a, "width", "width"))
                * _rat(_dim(a, "height", "height")))
    if s == "cylinder":
        r = _rat(_dim(a, "radius", "radius"))
        return sp.pi * r ** 2 * _rat(_dim(a, "height", "height"))
    raise ParseError(f"unknown volume shape {s!r}")


def _volume_mpmath(a: Dict[str, Any]) -> Any:
    s = a.get("shape")
    if s == "sphere":
        r = _mp(_dim(a, "radius", "radius"))
        return mp.mpf(4) / 3 * mp.pi * r ** 3
    if s == "box":
        return (_mp(_dim(a, "length", "length")) * _mp(_dim(a, "width", "width"))
                * _mp(_dim(a, "height", "height")))
    if s == "cylinder":
        r = _mp(_dim(a, "radius", "radius"))
        return mp.pi * r ** 2 * _mp(_dim(a, "height", "height"))
    raise ParseError(f"unknown volume shape {s!r}")


def _check_volume_positive(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    _volume_sympy(dict(a))  # revalidates every dimension
    ok = bool(to_mp(v) > 0)
    return ok, "volume is positive" if ok else "volume must be positive"


def _check_volume_numeric(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    ok = _same_close(v, _volume_mpmath(dict(a)))
    return ok, "exact and numeric evaluations agree" if ok else "exact and numeric evaluations disagree"


REGISTRY.add(Operation(
    "volume", "Volume of a sphere, box or cylinder",
    [Method("sympy-exact", "sympy", _volume_sympy),
     Method("mpmath-numeric", "mpmath", _volume_mpmath)],
    checks=[Check("positive", _check_volume_positive),
            Check("numeric-closeness", _check_volume_numeric)],
    same=_same_close, show=describe_number, min_confirmations=3))


# --------------------------------------------------------------------------- pythagoras
def _pyth_args(a: Dict[str, Any]) -> Tuple[str, Fraction, Fraction]:
    mode = a.get("mode")
    if mode == "legs":
        return mode, _dim(a, "a", "leg"), _dim(a, "b", "leg")
    if mode == "hyp":
        hyp, leg = _dim(a, "hyp", "hypotenuse"), _dim(a, "leg", "leg")
        if hyp <= leg:
            raise ParseError("the hypotenuse must be longer than the given leg")
        return mode, hyp, leg
    raise ParseError(f"unknown pythagoras mode {mode!r}")


def _pyth_sympy(a: Dict[str, Any]) -> Any:
    mode, x, y = _pyth_args(a)
    if mode == "legs":
        return sp.sqrt(_rat(x) ** 2 + _rat(y) ** 2)
    return sp.sqrt(_rat(x) ** 2 - _rat(y) ** 2)


def _pyth_mpmath(a: Dict[str, Any]) -> Any:
    mode, x, y = _pyth_args(a)
    X, Y = _mp(x), _mp(y)
    if mode == "legs":
        return mp.sqrt(X ** 2 + Y ** 2)
    return mp.sqrt(X ** 2 - Y ** 2)


def _check_pyth_positive(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    _pyth_args(dict(a))  # revalidates the sides
    ok = bool(to_mp(v) > 0)
    return ok, "missing side is positive" if ok else "missing side must be positive"


def _check_pyth_identity(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    mode, x, y = _pyth_args(a)
    c = to_mp(v)
    if mode == "legs":
        ok = _same_close(c ** 2, _mp(x) ** 2 + _mp(y) ** 2)
    else:
        ok = _same_close(_mp(y) ** 2 + c ** 2, _mp(x) ** 2)
    return ok, "a^2 + b^2 = c^2 holds" if ok else "Pythagorean identity failed"


REGISTRY.add(Operation(
    "pythagoras", "Missing side of a right triangle (legs or hypotenuse+leg)",
    [Method("sympy-exact", "sympy", _pyth_sympy),
     Method("mpmath-numeric", "mpmath", _pyth_mpmath)],
    checks=[Check("positive", _check_pyth_positive),
            Check("pythagorean-identity", _check_pyth_identity)],
    same=_same_close, show=describe_number, min_confirmations=3))
