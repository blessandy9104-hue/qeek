"""Data: descriptive statistics, unit conversion, shortest paths."""
from __future__ import annotations

import heapq
import statistics
from fractions import Fraction
from typing import Any, Dict, List, Optional, Tuple

import mpmath as mp
import networkx as nx
import numpy as np
import pint
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, describe_number, is_exact, to_fraction_exact, to_mp
from .safe_expr import NotApplicable, ParseError

LOOSE = mp.mpf(10) ** -11
MAX_DATA = 100_000


# --------------------------------------------------------------------------- statistics
def _data(a: Dict[str, Any]) -> List[Fraction]:
    d = a["data"]
    if not d or len(d) > MAX_DATA:
        raise ParseError("give between 1 and 100000 numbers")
    return [Fraction(x) for x in d]


def _stat_exact(a: Dict[str, Any]) -> Any:
    d, st, sample = _data(a), a["stat"], bool(a.get("sample", False))
    n = len(d)
    if st == "sum": return sp.Rational(sum(d).numerator, sum(d).denominator)
    if st == "min": return _r(min(d))
    if st == "max": return _r(max(d))
    if st == "mean": return _r(sum(d) / n)
    if st == "median":
        s = sorted(d)
        return _r(s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)
    if n - (1 if sample else 0) <= 0:
        raise ParseError("sample variance needs at least two values")
    mu = sum(d) / n
    var = sum((x - mu) ** 2 for x in d) / (n - 1 if sample else n)
    return _r(var) if st == "variance" else sp.sqrt(_r(var))


def _r(f: Fraction) -> Any:
    return sp.Rational(f.numerator, f.denominator)


def _stat_numpy(a: Dict[str, Any]) -> Any:
    x = np.array([float(v) for v in _data(a)], dtype=np.float64)
    st, ddof = a["stat"], (1 if a.get("sample") else 0)
    if st in ("variance", "stdev") and len(x) - ddof <= 0:
        raise ParseError("sample variance needs at least two values")
    return float({"sum": np.sum, "min": np.min, "max": np.max, "mean": np.mean, "median": np.median,
                  "variance": lambda v: np.var(v, ddof=ddof), "stdev": lambda v: np.std(v, ddof=ddof)}[st](x))


def _stat_stdlib(a: Dict[str, Any]) -> Any:
    d, st, sample = _data(a), a["stat"], bool(a.get("sample", False))
    if st == "variance":
        return _r(statistics.variance(d) if sample else statistics.pvariance(d))
    if st == "stdev":
        return float(statistics.stdev(d) if sample else statistics.pstdev(d))
    return {"sum": lambda: _r(sum(d)), "min": lambda: _r(min(d)), "max": lambda: _r(max(d)),
            "mean": lambda: _r(statistics.mean(d)), "median": lambda: _r(statistics.median(d))}[st]()


def _same_stat(x: Any, y: Any) -> bool:
    if is_exact(x) and is_exact(y):
        return to_fraction_exact(x) == to_fraction_exact(y)
    return close(float(x) if isinstance(x, float) else x, float(y) if isinstance(y, float) else y, LOOSE)


REGISTRY.add(Operation(
    "stat", "Sum, min, max, mean, median, variance or standard deviation of a list of numbers",
    [Method("exact-rational", "fractions", _stat_exact), Method("numpy-float64", "numpy", _stat_numpy),
     Method("python-statistics", "stdlib", _stat_stdlib)],
    same=_same_stat, show=describe_number))


# --------------------------------------------------------------------------- unit conversion
def _f(num: int, den: int = 1) -> Fraction:
    return Fraction(num, den)


_GAL = _f(3785411784, 10 ** 9)
# unit -> (dimension, factor to the base unit). Base units: m, kg, s, L, J. All factors are exact (NIST).
UNITS: Dict[str, Tuple[str, Fraction]] = {
    "m": ("length", _f(1)), "km": ("length", _f(1000)), "cm": ("length", _f(1, 100)), "mm": ("length", _f(1, 1000)),
    "in": ("length", _f(254, 10000)), "ft": ("length", _f(3048, 10000)), "yd": ("length", _f(9144, 10000)),
    "mi": ("length", _f(1609344, 1000)), "nmi": ("length", _f(1852)),
    "kg": ("mass", _f(1)), "g": ("mass", _f(1, 1000)), "mg": ("mass", _f(1, 10 ** 6)),
    "lb": ("mass", _f(45359237, 10 ** 8)), "oz": ("mass", _f(45359237, 16 * 10 ** 8)), "t": ("mass", _f(1000)),
    "s": ("time", _f(1)), "ms": ("time", _f(1, 1000)), "min": ("time", _f(60)), "h": ("time", _f(3600)),
    "day": ("time", _f(86400)), "week": ("time", _f(604800)),
    "L": ("volume", _f(1)), "mL": ("volume", _f(1, 1000)), "m3": ("volume", _f(1000)),
    "gal": ("volume", _GAL), "qt": ("volume", _GAL / 4), "pt": ("volume", _GAL / 8),
    "cup": ("volume", _GAL / 16), "floz": ("volume", _GAL / 128),
    "J": ("energy", _f(1)), "kJ": ("energy", _f(1000)), "cal": ("energy", _f(4184, 1000)),
    "kcal": ("energy", _f(4184)), "Wh": ("energy", _f(3600)), "kWh": ("energy", _f(3600000)),
    "C": ("temperature", _f(1)), "F": ("temperature", _f(1)), "K": ("temperature", _f(1)),
}
ALIASES = {
    "meter": "m", "meters": "m", "metre": "m", "metres": "m", "kilometer": "km", "kilometers": "km", "kilometre": "km",
    "kilometres": "km", "centimeter": "cm", "centimeters": "cm", "millimeter": "mm", "millimeters": "mm",
    "inch": "in", "inches": "in", "foot": "ft", "feet": "ft", "yard": "yd", "yards": "yd", "mile": "mi", "miles": "mi",
    "kilogram": "kg", "kilograms": "kg", "gram": "g", "grams": "g", "pound": "lb", "pounds": "lb", "lbs": "lb",
    "ounce": "oz", "ounces": "oz", "tonne": "t", "second": "s", "seconds": "s", "sec": "s", "minute": "min",
    "minutes": "min", "hour": "h", "hours": "h", "hr": "h", "days": "day", "weeks": "week",
    "liter": "L", "liters": "L", "litre": "L", "litres": "L", "l": "L", "milliliter": "mL", "milliliters": "mL",
    "gallon": "gal", "gallons": "gal", "quart": "qt", "pint": "pt", "cups": "cup", "joule": "J", "joules": "J",
    "calorie": "cal", "calories": "cal", "kilocalorie": "kcal", "celsius": "C", "fahrenheit": "F", "kelvin": "K",
    "degC": "C", "degF": "F",
}
PINT = {"m": "meter", "km": "kilometer", "cm": "centimeter", "mm": "millimeter", "in": "inch", "ft": "foot",
        "yd": "yard", "mi": "mile", "nmi": "nautical_mile", "kg": "kilogram", "g": "gram", "mg": "milligram",
        "lb": "pound", "oz": "ounce", "t": "metric_ton", "s": "second", "ms": "millisecond", "min": "minute",
        "h": "hour", "day": "day", "week": "week", "L": "liter", "mL": "milliliter", "m3": "meter**3",
        "gal": "gallon", "qt": "quart", "pt": "pint", "cup": "cup", "floz": "floz", "J": "joule", "kJ": "kilojoule",
        "cal": "thermochemical_calorie", "kcal": "thermochemical_kilocalorie", "Wh": "watt_hour",
        "kWh": "kilowatt_hour", "C": "degC", "F": "degF", "K": "kelvin"}
_ureg = pint.UnitRegistry()


def canon_unit(u: str) -> str:
    u = u.strip()
    u = ALIASES.get(u, ALIASES.get(u.lower(), u))
    if u not in UNITS:
        raise ParseError(f"unknown unit {u!r}")
    return u


def _units(a: Dict[str, Any]) -> Tuple[Fraction, str, str]:
    src, dst = canon_unit(a["from"]), canon_unit(a["to"])
    if UNITS[src][0] != UNITS[dst][0]:
        raise ParseError(f"cannot convert {UNITS[src][0]} to {UNITS[dst][0]}")
    return Fraction(a["value"]), src, dst


def _temp_to_k(v: Fraction, u: str) -> Fraction:
    return v + Fraction(27315, 100) if u == "C" else (v - 32) * 5 / 9 + Fraction(27315, 100) if u == "F" else v


def _k_to(v: Fraction, u: str) -> Fraction:
    return v - Fraction(27315, 100) if u == "C" else (v - Fraction(27315, 100)) * 9 / 5 + 32 if u == "F" else v


def _convert_own(a: Dict[str, Any]) -> Fraction:
    v, s, d = _units(a)
    if UNITS[s][0] == "temperature":
        return _k_to(_temp_to_k(v, s), d)
    return v * UNITS[s][1] / UNITS[d][1]


def _convert_pint(a: Dict[str, Any]) -> float:
    v, s, d = _units(a)
    q = _ureg.Quantity(float(v), PINT[s])
    return float(q.to(PINT[d]).magnitude)


def _check_roundtrip(a: Dict[str, Any], out: Any) -> Tuple[bool, str]:
    v, s, d = _units(a)
    if not isinstance(out, Fraction):
        return True, "numeric result: exact round trip skipped"
    back = _convert_own({"value": out, "from": d, "to": s})
    return back == v, "converting back reproduces the input exactly"


def _same_conv(x: Any, y: Any) -> bool:
    return close(to_mp(x) if not isinstance(x, float) else mp.mpf(x), to_mp(y) if not isinstance(y, float) else mp.mpf(y), mp.mpf(10) ** -9)


REGISTRY.add(Operation(
    "convert", "Convert between units (length, mass, time, volume, energy, temperature)",
    [Method("exact-nist-table", "fractions", _convert_own), Method("pint", "pint", _convert_pint)],
    checks=[Check("exact-round-trip", _check_roundtrip)],
    same=_same_conv,
    show=lambda v: describe_number(sp.Rational(v.numerator, v.denominator) if isinstance(v, Fraction) else v, 15)))


# --------------------------------------------------------------------------- shortest path
Edge = Tuple[str, str, Fraction, bool]


def _graph(a: Dict[str, Any]) -> Tuple[List[Edge], str, str]:
    edges = [(u, v, Fraction(w), bool(dr)) for u, v, w, dr in a["edges"]]
    if not edges or len(edges) > 5000:
        raise ParseError("give between 1 and 5000 edges")
    if any(w < 0 for _, _, w, _ in edges):
        raise ParseError("negative edge weights are not supported")
    nodes = {n for u, v, _, _ in edges for n in (u, v)}
    if a["source"] not in nodes or a["target"] not in nodes:
        raise ParseError("source and target must appear in the edge list")
    return edges, a["source"], a["target"]


def _adj(edges: List[Edge]) -> Dict[str, List[Tuple[str, Fraction]]]:
    adj: Dict[str, List[Tuple[str, Fraction]]] = {}
    for u, v, w, directed in edges:
        adj.setdefault(u, []).append((v, w))
        adj.setdefault(v, [])
        if not directed:
            adj[v].append((u, w))
    return adj


def _dijkstra(a: Dict[str, Any]) -> Any:
    edges, s, t = _graph(a)
    adj = _adj(edges)
    dist: Dict[str, Fraction] = {s: Fraction(0)}
    prev: Dict[str, str] = {}
    heap = [(Fraction(0), s)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, d):
            continue
        for v, w in adj[u]:
            nd = d + w
            if v not in dist or nd < dist[v]:
                dist[v], prev[v] = nd, u
                heapq.heappush(heap, (nd, v))
    if t not in dist:
        return (None, None)
    path, cur = [t], t
    while cur != s:
        cur = prev[cur]
        path.append(cur)
    return (dist[t], path[::-1])


def _bellman_ford(a: Dict[str, Any]) -> Any:
    edges, s, t = _graph(a)
    arcs = []
    for u, v, w, directed in edges:
        arcs.append((u, v, w))
        if not directed:
            arcs.append((v, u, w))
    nodes = {n for u, v, _ in arcs for n in (u, v)}
    dist: Dict[str, Optional[Fraction]] = {n: None for n in nodes}
    dist[s] = Fraction(0)
    prev: Dict[str, str] = {}
    for _ in range(len(nodes) - 1):
        changed = False
        for u, v, w in arcs:
            if dist[u] is not None and (dist[v] is None or dist[u] + w < dist[v]):
                dist[v], prev[v], changed = dist[u] + w, u, True
        if not changed:
            break
    if dist[t] is None:
        return (None, None)
    path, cur = [t], t
    while cur != s:
        cur = prev[cur]
        path.append(cur)
    return (dist[t], path[::-1])


def _networkx(a: Dict[str, Any]) -> Any:
    edges, s, t = _graph(a)
    G = nx.MultiDiGraph()
    for u, v, w, directed in edges:
        G.add_edge(u, v, weight=w)
        if not directed:
            G.add_edge(v, u, weight=w)
    try:
        cost = nx.dijkstra_path_length(G, s, t, weight="weight")
        return (Fraction(cost), nx.dijkstra_path(G, s, t, weight="weight"))
    except nx.NetworkXNoPath:
        return (None, None)


def _check_path(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    cost, path = v
    edges, s, t = _graph(a)
    if cost is None:
        return True, "no path: confirmed by independent searches"
    if path[0] != s or path[-1] != t:
        return False, "path endpoints are wrong"
    total = Fraction(0)
    for x, y in zip(path, path[1:]):
        w = min((w for u, v2, w, dr in edges if (u, v2) == (x, y) or (not dr and (v2, u) == (x, y))), default=None)
        if w is None:
            return False, f"no edge {x} -> {y}"
        total += w
    return total == cost, "the path exists and its edge weights sum to the cost"


REGISTRY.add(Operation(
    "shortest_path", "Cheapest path between two nodes of a weighted graph",
    [Method("dijkstra", "own", _dijkstra), Method("bellman-ford", "own", _bellman_ford),
     Method("networkx-dijkstra", "networkx", _networkx)],
    checks=[Check("path-is-real-and-sums", _check_path)],
    same=lambda x, y: x[0] == y[0],
    show=lambda v: "unreachable" if v[0] is None else f"cost {describe_number(sp.Rational(v[0].numerator, v[0].denominator))} via " + " -> ".join(v[1])))
