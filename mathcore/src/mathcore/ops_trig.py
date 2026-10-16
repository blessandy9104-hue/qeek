"""Trigonometry: sin/cos/tan in degrees or radians."""
from __future__ import annotations

from typing import Any, Dict, Tuple

import mpmath as mp
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, describe_number, to_mp
from .safe_expr import ParseError, to_sympy

_TOL = mp.mpf(10) ** -12
_FUNCS = {"sin": (sp.sin, mp.sin), "cos": (sp.cos, mp.cos), "tan": (sp.tan, mp.tan)}


def _same_close(x: Any, y: Any) -> bool:
    try:
        return bool(close(x, y, _TOL))
    except Exception:
        return False


def _angle_rad(a: Dict[str, Any]) -> Tuple[str, Any]:
    func = a.get("func")
    if func not in _FUNCS:
        raise ParseError(f"unknown trig function {func!r}")
    try:
        e = to_sympy(a["angle"])
    except Exception as exc:
        raise ParseError(f"bad angle: {exc}")
    if getattr(e, "free_symbols", None):
        raise ParseError("the angle must be a number, not an expression in variables")
    if e.has(sp.zoo, sp.nan) or e.is_real is False:
        raise ParseError("the angle must be a real number")
    unit = a.get("unit", "radians")
    if unit == "degrees":
        return func, e * sp.pi / 180
    if unit == "radians":
        return func, e
    raise ParseError(f"unknown angle unit {unit!r}")


def _trig_sympy(a: Dict[str, Any]) -> Any:
    func, rad = _angle_rad(a)
    r = _FUNCS[func][0](rad)
    if r.has(sp.zoo, sp.nan):
        raise ValueError(f"{func} is undefined at this angle")
    return r


def _trig_mpmath(a: Dict[str, Any]) -> Any:
    func, rad = _angle_rad(a)
    if func == "tan" and sp.cos(rad) == 0:
        raise ValueError("tan is undefined at this angle (cosine is zero)")
    with mp.workdps(50):
        r = _FUNCS[func][1](to_mp(rad))
    if not mp.isfinite(r):
        raise ValueError(f"{func} is undefined at this angle")
    return r


def _check_trig_defined(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    func, rad = _angle_rad(a)
    m = to_mp(v)
    if func in ("sin", "cos"):
        ok = bool(abs(m) <= 1 + mp.mpf(10) ** -9)
        return ok, "sine/cosine lies in [-1, 1]" if ok else "sine/cosine outside [-1, 1]"
    if sp.cos(rad) == 0:
        return False, "tangent is undefined here (cosine is zero)"
    ok = bool(mp.isfinite(m))
    return ok, "tangent is finite here" if ok else "tangent is undefined here"


def _check_trig_numeric(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    ok = _same_close(v, _trig_mpmath(dict(a)))
    return ok, "exact and numeric evaluations agree" if ok else "exact and numeric evaluations disagree"


REGISTRY.add(Operation(
    "trig", "Sine, cosine or tangent of an angle (degrees or radians)",
    [Method("sympy-exact", "sympy", _trig_sympy),
     Method("mpmath-numeric", "mpmath", _trig_mpmath)],
    checks=[Check("in-range-and-defined", _check_trig_defined),
            Check("numeric-closeness", _check_trig_numeric)],
    same=_same_close, show=describe_number, min_confirmations=3))
