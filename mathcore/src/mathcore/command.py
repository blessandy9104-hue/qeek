"""Turn user input into typed commands, and authorize exactly those operations.

The user's text is the authorization: only the operations that the text names can run.
Parsing is deterministic (patterns, no model), so it needs no API key and gives the same
answer every time. Each command has a canonical form that is echoed back so a human can
see what was understood.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any, Callable, Dict, FrozenSet, List, Optional, Tuple

from .safe_expr import ParseError, free_names, placeholders, split_equation, to_sympy


@dataclass
class Command:
    op: str
    args: Dict[str, Any]
    canonical: str
    raw: str = ""


@dataclass(frozen=True)
class Authorization:
    ops: FrozenSet[str]
    source: str
    max_seconds: float = 20.0

    def allows(self, op: str) -> bool:
        return op in self.ops


def authorize(commands: List[Command], source: str, max_seconds: float = 20.0) -> Authorization:
    return Authorization(frozenset(c.op for c in commands), source, max_seconds)


# --------------------------------------------------------------------------- helpers
def _clean(text: str) -> str:
    t = text.strip().replace("\u2192", "->").replace("\u221e", "oo").replace("\u2211", "sum")
    t = t.replace("\u221a", "sqrt").replace("\u03c0", "pi").replace("\u222b", "integrate ")
    t = re.sub(r"\s+", " ", t)
    t = t.rstrip("?. ")
    if t.endswith("!") and not re.search(r"[\d)]!$", t):  # keep the factorial sign in "10!"
        t = t.rstrip("! ")
    return t.strip()


def bracket_groups(s: str) -> List[str]:
    """Top-level balanced [...] groups in order of appearance."""
    out, depth, start = [], 0, 0
    for i, ch in enumerate(s):
        if ch == "[":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth < 0:
                raise ParseError("unbalanced brackets")
            if depth == 0:
                out.append(s[start:i + 1])
    if depth != 0:
        raise ParseError("unbalanced brackets")
    return out


_NUM = r"[-+]?(?:\d+/\d+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|\.\d+)"
_INT = re.compile(r"^[-+]?\d+$")


def _numbers(s: str) -> Optional[List[Fraction]]:
    """Parse a list of plain numbers; None if the text contains anything else."""
    rest = re.sub(_NUM, " ", s)
    if re.sub(r"[\s,;\[\]()]|\band\b", "", rest):
        return None
    vals = re.findall(_NUM, s)
    return [Fraction(v) for v in vals] if vals else None


def _int_list(s: str) -> List[int]:
    nums = _numbers(s)
    if nums is None or any(n.denominator != 1 for n in nums):
        raise ParseError("expected whole numbers")
    return [int(n) for n in nums]


def _fmt(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def _one_var(text: str, given: Optional[str], what: str) -> str:
    if given:
        return given
    names = free_names(text)
    if len(names) == 1:
        return names[0]
    if not names:
        raise ParseError(f"{what} needs a variable")
    raise ParseError(f"which variable? {what} has {', '.join(names)}; say 'for <variable>'")


# --------------------------------------------------------------------------- builders
Builder = Callable[[re.Match, str], Command]


def _evaluate(m: re.Match, raw: str) -> Command:
    expr = m.group(m.lastindex)
    return _expression(expr, raw)


def _expression(expr: str, raw: str) -> Command:
    if split_equation(expr) is not None:
        return _solve_text(expr, None, raw)
    names = free_names(expr)
    if _INT.match(expr.strip()):
        pass
    if names:
        return Command("simplify", {"expr": expr}, f"simplify {expr}", raw)
    return Command("evaluate", {"expr": expr}, f"evaluate {expr}", raw)


def _transform(m: re.Match, raw: str) -> Command:
    kind, expr = m.group(1).lower(), m.group(2)
    if kind == "factor" and _INT.match(expr.strip()):
        n = int(expr)
        return Command("factor_int", {"n": n}, f"factor integer {n}", raw)
    return Command(kind, {"expr": expr}, f"{kind} {expr}", raw)


def _solve_text(body: str, vars_text: Optional[str], raw: str) -> Command:
    eqs = [e.strip() for e in re.split(r"\s+and\s+|\s*&\s*", body) if e.strip()]
    if not eqs:
        raise ParseError("nothing to solve")
    if any("'" in e for e in eqs):
        return _dsolve_text(body, raw)
    if vars_text:
        variables = [v for v in re.split(r"[,\s]+|\band\b", vars_text) if v]
    else:
        names: List[str] = []
        for e in eqs:
            for n in free_names(" - ".join(f"({p})" for p in (split_equation(e) or (e,)))):
                if n not in names:
                    names.append(n)
        if not names:
            raise ParseError("no variable to solve for")
        if len(eqs) == 1 and len(names) > 1:
            raise ParseError(f"which variable? the equation has {', '.join(names)}; say 'for <variable>'")
        variables = names
    for v in variables:
        to_sympy(v)  # validates the name
    canon = f"solve {' and '.join(eqs)} for {', '.join(variables)}"
    return Command("solve", {"equations": eqs, "vars": variables}, canon, raw)


def _solve(m: re.Match, raw: str) -> Command:
    return _solve_text(m.group(1), m.group(2), raw)


def _derivative(m: re.Match, raw: str) -> Command:
    order_word = (m.group("order") or "").lower()
    order = {"second": 2, "third": 3, "fourth": 4}.get(order_word, 1)
    expr = m.group("expr").strip()
    var = m.group("var")
    tail = re.match(r"^(.*?)\s+order\s+(\d+)$", expr)
    if tail:
        expr, order = tail.group(1), int(tail.group(2))
    if not 1 <= order <= 10:
        raise ParseError("order must be between 1 and 10")
    var = _one_var(expr, var, "the derivative")
    return Command("derivative", {"expr": expr, "var": var, "order": order},
                   f"derivative of {expr} with respect to {var}" + (f" (order {order})" if order > 1 else ""), raw)


def _integrate(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    lower = upper = None
    rng = re.search(r"\s+from\s+(.+?)\s+to\s+(.+)$", body)
    if rng:
        lower, upper, body = rng.group(1).strip(), rng.group(2).strip(), body[:rng.start()]
    var = None
    dv = re.search(r"\s*\bd([a-zA-Z])$", body)
    if dv and len(body) > len(dv.group(0)):
        var, body = dv.group(1), body[:dv.start()]
    var = _one_var(body, var, "the integral")
    canon = f"integrate {body} d{var}" + (f" from {lower} to {upper}" if lower is not None else "")
    return Command("integrate", {"expr": body, "var": var, "lower": lower, "upper": upper}, canon, raw)


def _limit(m: re.Match, raw: str) -> Command:
    expr, var, point = m.group("expr").strip(), m.group("var"), m.group("point").strip()
    direction = "both"
    side = m.group("side")
    if side:
        direction = "-" if side.lower().startswith("l") else "+"
    sign = re.match(r"^(.*\S)\s*([+-])$", point)
    if sign and re.match(r"^[\w.()/*^ ]+$", sign.group(1)) and not re.search(r"[+-]$", sign.group(1)):
        point, direction = sign.group(1).strip(), sign.group(2)
    return Command("limit", {"expr": expr, "var": var, "point": point, "dir": direction},
                   f"limit of {expr} as {var} -> {point}" + ("" if direction == "both" else f" from {direction}"), raw)


def _matrix_unary(m: re.Match, raw: str) -> Command:
    word = m.group(1).lower()
    op = {"determinant": "determinant", "det": "determinant", "inverse": "inverse", "inv": "inverse",
          "rank": "rank", "eigenvalues": "eigenvalues", "eigenvalue": "eigenvalues", "eigenvals": "eigenvalues"}[word]
    groups = bracket_groups(m.group(2))
    if len(groups) != 1:
        raise ParseError("give exactly one matrix, like [[1,2],[3,4]]")
    return Command(op, {"matrix": groups[0]}, f"{op} of {groups[0]}", raw)


def _linsolve(m: re.Match, raw: str) -> Command:
    groups = bracket_groups(m.group(1))
    if len(groups) != 2:
        raise ParseError("give a matrix and a vector, like [[2,1],[1,3]] [5,10]")
    return Command("linsolve", {"matrix": groups[0], "vector": groups[1]},
                   f"solve linear system {groups[0]} x = {groups[1]}", raw)


def _matmul(m: re.Match, raw: str) -> Command:
    groups = bracket_groups(m.group(1))
    if len(groups) != 2:
        raise ParseError("give two matrices")
    return Command("matmul", {"matrix": groups[0], "matrix2": groups[1]}, f"multiply {groups[0]} by {groups[1]}", raw)


def _is_prime(m: re.Match, raw: str) -> Command:
    n = int(m.group(1))
    return Command("is_prime", {"n": n}, f"is {n} prime", raw)


def _factor_int(m: re.Match, raw: str) -> Command:
    n = int(m.group(1))
    return Command("factor_int", {"n": n}, f"factor integer {n}", raw)


def _gcd_lcm(m: re.Match, raw: str) -> Command:
    op = m.group(1).lower()
    vals = _int_list(m.group(2))
    return Command(op, {"values": vals}, f"{op} of {', '.join(map(str, vals))}", raw)


def _modpow(m: re.Match, raw: str) -> Command:
    b, e, mod = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return Command("modpow", {"base": b, "exp": e, "mod": mod}, f"{b}^{e} mod {mod}", raw)


def _factorial(m: re.Match, raw: str) -> Command:
    n = int(m.group(1))
    return Command("factorial", {"n": n}, f"factorial of {n}", raw)


def _choose(m: re.Match, raw: str) -> Command:
    n, k = int(m.group(1)), int(m.group(2))
    return Command("choose", {"n": n, "k": k}, f"{n} choose {k}", raw)


def _choose_rev(m: re.Match, raw: str) -> Command:
    return _choose(m, raw)


def _logic(m: re.Match, raw: str) -> Command:
    word = m.group("kw").lower()
    dom = (m.group("dom") or "real").lower()
    dom = "int" if dom.startswith("int") else "real"
    formula = m.group("formula").strip()
    op = "prove" if word in ("prove", "show that", "is it always true that", "verify") else "sat"
    return Command(op, {"formula": formula, "domain": dom}, f"{op} [{dom}] {formula}", raw)


_STAT_NAMES = {"mean": "mean", "average": "mean", "avg": "mean", "median": "median", "variance": "variance",
               "var": "variance", "stdev": "stdev", "std": "stdev", "sd": "stdev", "standard deviation": "stdev",
               "sum": "sum", "total": "sum", "min": "min", "minimum": "min", "max": "max", "maximum": "max"}


def _stat(m: re.Match, raw: str) -> Optional[Command]:
    kind = (m.group("kind") or "").lower()
    stat = _STAT_NAMES[m.group("stat").lower()]
    data = _numbers(m.group("data"))
    if data is None:
        return None
    sample = kind == "sample"
    shown = ", ".join(_fmt(d) for d in data)
    return Command("stat", {"stat": stat, "data": [_fmt(d) for d in data], "sample": sample},
                   f"{'sample ' if sample else ''}{stat} of {shown}", raw)


def _convert(m: re.Match, raw: str) -> Command:
    v = Fraction(m.group(1))
    return Command("convert", {"value": _fmt(v), "from": m.group(2), "to": m.group(3)},
                   f"convert {_fmt(v)} {m.group(2)} to {m.group(3)}", raw)


def _path(m: re.Match, raw: str) -> Command:
    s, t, rest = m.group(1), m.group(2), m.group(3)
    edges = []
    for u, arrow, v, w in re.findall(r"(\w+)\s*(->|--|-)\s*(\w+)\s*:\s*(" + _NUM + r")", rest):
        edges.append((u, v, _fmt(Fraction(w)), arrow == "->"))
    if not edges:
        raise ParseError("edges are written like A-B:3, B-C:4 (use A->B:3 for one-way)")
    return Command("shortest_path", {"edges": edges, "source": s, "target": t},
                   f"shortest path from {s} to {t} in " + ", ".join(f"{u}{'->' if d else '-'}{v}:{w}" for u, v, w, d in edges), raw)


def _dsolve_text(body: str, raw: str) -> Command:
    fm = re.search(r"\b([A-Za-z]\w*)'+", body)
    if not fm:
        raise ParseError("write the unknown function with primes, like y'' + y = 0")
    func = fm.group(1)
    vm = re.search(rf"\b{func}'*\(\s*(\w+)\s*\)", body)
    var = vm.group(1) if vm else "x"
    return Command("dsolve", {"equation": body, "func": func, "var": var}, f"solve ODE {body}", raw)


def _dsolve(m: re.Match, raw: str) -> Command:
    return _dsolve_text(m.group(1), raw)


def _frac(text: str, what: str) -> Fraction:
    try:
        return Fraction(text)
    except (ValueError, ZeroDivisionError):
        raise ParseError(f"{what} must be a number, got {text!r}")


def _positive(v: Fraction, what: str) -> Fraction:
    if v <= 0:
        raise ParseError(f"{what} must be positive")
    return v


def _percent(m: re.Match, raw: str) -> Command:
    pct, base = _frac(m.group(1), "percentage"), _frac(m.group(2), "base value")
    return Command("percent", {"pct": _fmt(pct), "base": _fmt(base)},
                   f"percent {_fmt(pct)} of {_fmt(base)}", raw)


def _ratio(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    cm = (re.fullmatch(r"(" + _NUM + r")\s*:\s*(" + _NUM + r")", body)
          or re.fullmatch(r"(" + _NUM + r")\s+to\s+(" + _NUM + r")", body, _I))
    if cm:
        a, b = _frac(cm.group(1), "ratio term"), _frac(cm.group(2), "ratio term")
    else:
        vals = _numbers(body)
        if vals is None or len(vals) != 2:
            raise ParseError("ratio needs two numbers, like 'ratio 2:4' or 'ratio 2 to 4'")
        a, b = vals
    if b == 0:
        raise ParseError("ratio needs a nonzero second term")
    return Command("ratio", {"a": _fmt(a), "b": _fmt(b)}, f"ratio {_fmt(a)}:{_fmt(b)}", raw)


def _area(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    cm = re.fullmatch(r"circle\s+(?:radius\s+|r\s+)?(" + _NUM + r")", body, _I)
    if cm:
        r = _positive(_frac(cm.group(1), "radius"), "radius")
        return Command("area", {"shape": "circle", "radius": _fmt(r)},
                       f"area circle radius {_fmt(r)}", raw)
    cm = re.fullmatch(r"rect(?:angle)?\s+(" + _NUM + r")\s*(?:by|x|\*)\s*(" + _NUM + r")", body, _I)
    if cm:
        length = _positive(_frac(cm.group(1), "length"), "length")
        width = _positive(_frac(cm.group(2), "width"), "width")
        return Command("area", {"shape": "rectangle", "length": _fmt(length), "width": _fmt(width)},
                       f"area rectangle {_fmt(length)} by {_fmt(width)}", raw)
    cm = (re.fullmatch(r"tri(?:angle)?\s+base\s+(" + _NUM + r")\s+height\s+(" + _NUM + r")", body, _I)
          or re.fullmatch(r"tri(?:angle)?\s+(" + _NUM + r")\s*[,\s]\s*(" + _NUM + r")", body, _I))
    if cm:
        base = _positive(_frac(cm.group(1), "base"), "base")
        height = _positive(_frac(cm.group(2), "height"), "height")
        return Command("area", {"shape": "triangle", "base": _fmt(base), "height": _fmt(height)},
                       f"area triangle base {_fmt(base)} height {_fmt(height)}", raw)
    raise ParseError("area needs 'circle radius <r>', 'rectangle <l> by <w>' or 'triangle base <b> height <h>'")


def _volume(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    cm = re.fullmatch(r"sphere\s+(?:radius\s+|r\s+)?(" + _NUM + r")", body, _I)
    if cm:
        r = _positive(_frac(cm.group(1), "radius"), "radius")
        return Command("volume", {"shape": "sphere", "radius": _fmt(r)},
                       f"volume sphere radius {_fmt(r)}", raw)
    cm = re.fullmatch(r"box\s+(" + _NUM + r")\s*(?:by|x|\*)\s*(" + _NUM + r")\s*(?:by|x|\*)\s*(" + _NUM + r")",
                      body, _I)
    if cm:
        dims = [_positive(_frac(cm.group(i), "edge"), "edge") for i in (1, 2, 3)]
        shown = " by ".join(_fmt(d) for d in dims)
        return Command("volume", {"shape": "box", "length": _fmt(dims[0]),
                                  "width": _fmt(dims[1]), "height": _fmt(dims[2])},
                       f"volume box {shown}", raw)
    cm = (re.fullmatch(r"cylinder\s+radius\s+(" + _NUM + r")\s+height\s+(" + _NUM + r")", body, _I)
          or re.fullmatch(r"cylinder\s+(" + _NUM + r")\s*[,\s]\s*(" + _NUM + r")", body, _I))
    if cm:
        r = _positive(_frac(cm.group(1), "radius"), "radius")
        h = _positive(_frac(cm.group(2), "height"), "height")
        return Command("volume", {"shape": "cylinder", "radius": _fmt(r), "height": _fmt(h)},
                       f"volume cylinder radius {_fmt(r)} height {_fmt(h)}", raw)
    raise ParseError("volume needs 'sphere radius <r>', 'box <l> by <w> by <h>' or 'cylinder radius <r> height <h>'")


def _pythagoras(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    cm = re.fullmatch(r"legs?\s+(" + _NUM + r")\s*[,\s]\s*(" + _NUM + r")", body, _I)
    if cm:
        a = _positive(_frac(cm.group(1), "leg"), "leg")
        b = _positive(_frac(cm.group(2), "leg"), "leg")
        return Command("pythagoras", {"mode": "legs", "a": _fmt(a), "b": _fmt(b)},
                       f"pythagoras legs {_fmt(a)} {_fmt(b)}", raw)
    hyp_first = re.fullmatch(r"hyp(?:otenuse)?\s+(" + _NUM + r")\s+leg\s+(" + _NUM + r")", body, _I)
    leg_first = (None if hyp_first is not None
                 else re.fullmatch(r"leg\s+(" + _NUM + r")\s+hyp(?:otenuse)?\s+(" + _NUM + r")", body, _I))
    if hyp_first is not None:
        hyp = _positive(_frac(hyp_first.group(1), "hypotenuse"), "hypotenuse")
        leg = _positive(_frac(hyp_first.group(2), "leg"), "leg")
    elif leg_first is not None:
        leg = _positive(_frac(leg_first.group(1), "leg"), "leg")
        hyp = _positive(_frac(leg_first.group(2), "hypotenuse"), "hypotenuse")
    else:
        raise ParseError("pythagoras needs 'legs <a> <b>' or 'hypotenuse <h> leg <l>'")
    if hyp <= leg:
        raise ParseError("the hypotenuse must be longer than the given leg")
    return Command("pythagoras", {"mode": "hyp", "hyp": _fmt(hyp), "leg": _fmt(leg)},
                   f"pythagoras hypotenuse {_fmt(hyp)} leg {_fmt(leg)}", raw)


def _trig(m: re.Match, raw: str) -> Command:
    func, rest = m.group(1).lower(), m.group(2).strip()
    dm = re.fullmatch(r"(.*?)\s*(?:degrees|degree|deg)\s*", rest, _I)
    if dm and dm.group(1).strip():
        angle_text, unit = dm.group(1).strip(), "degrees"
    else:
        angle_text, unit = rest, "radians"
    if not angle_text:
        raise ParseError("give an angle, like 'trig sin 30 degrees' or 'trig cos pi/3'")
    try:
        to_sympy(angle_text)
    except Exception as exc:
        raise ParseError(f"bad angle: {exc}")
    canon = f"trig {func} {angle_text}" + (" degrees" if unit == "degrees" else "")
    return Command("trig", {"func": func, "angle": angle_text, "unit": unit}, canon, raw)


def _probability(m: re.Match, raw: str) -> Command:
    body = m.group(1).strip()
    bm = re.fullmatch(r"binomial\s+n\s*=?\s*(\d+)\s+k\s*=?\s*(\d+)\s+p\s*=?\s*(" + _NUM + r")", body, _I)
    if bm:
        n, k, p = int(bm.group(1)), int(bm.group(2)), _frac(bm.group(3), "p")
        if n < 0 or n > 100000:
            raise ParseError("n must be between 0 and 100000")
        if not 0 <= k <= n:
            raise ParseError("k must be between 0 and n")
        if not 0 <= p <= 1:
            raise ParseError("p must be between 0 and 1")
        return Command("probability", {"kind": "binomial", "n": n, "k": k, "p": _fmt(p)},
                       f"probability binomial n {n} k {k} p {_fmt(p)}", raw)
    dm = re.fullmatch(r"dice\s+(?:sum\s*(?:of\s*)?)?(\d+)", body, _I)
    if dm:
        total = int(dm.group(1))
        if not 2 <= total <= 12:
            raise ParseError("two dice sum to between 2 and 12")
        return Command("probability", {"kind": "dice", "total": total},
                       f"probability dice sum {total}", raw)
    cm = re.fullmatch(r"coin\s+(\d+)\s+heads?\s+in\s+(\d+)(?:\s+flips?)?", body, _I)
    if cm:
        k, n = int(cm.group(1)), int(cm.group(2))
        if n < 1 or n > 100000:
            raise ParseError("n must be between 1 and 100000")
        if not 0 <= k <= n:
            raise ParseError("k must be between 0 and n")
        return Command("probability", {"kind": "coin", "n": n, "k": k},
                       f"probability coin {k} heads in {n}", raw)
    raise ParseError("probability needs 'binomial n <n> k <k> p <p>', 'dice sum <s>' or 'coin <k> heads in <n>'")


# --------------------------------------------------------------------------- pattern table
_I = re.IGNORECASE
_PATTERNS: List[Tuple[re.Pattern, Builder]] = [
    (re.compile(r"^percent\s+(" + _NUM + r")\s*%?\s+of\s+(" + _NUM + r")$", _I), _percent),
    (re.compile(r"^(" + _NUM + r")\s*%\s+of\s+(" + _NUM + r")$", _I), _percent),
    (re.compile(r"^ratio\s+(.+)$", _I), _ratio),
    (re.compile(r"^area\s+(.+)$", _I), _area),
    (re.compile(r"^volume\s+(.+)$", _I), _volume),
    (re.compile(r"^pythagoras\s+(.+)$", _I), _pythagoras),
    (re.compile(r"^trig\s+(sin|cos|tan)\s+(.+)$", _I), _trig),
    (re.compile(r"^probability\s+(.+)$", _I), _probability),
    (re.compile(r"^(?:dsolve|solve ode|ode)[: ]\s*(.+)$", _I), _dsolve),
    (re.compile(r"^(?P<kw>prove|show that|verify|is it always true that)\s*(?:\[?(?P<dom>int(?:eger)?|real)\]?\s*[:,]?)?\s*(?P<formula>.+)$", _I), _logic),
    (re.compile(r"^(?P<kw>sat|satisfiable|is satisfiable|find values(?: such that)?|constraints?)\s*(?:\[?(?P<dom>int(?:eger)?|real)\]?\s*[:,]?)?\s*(?P<formula>.+)$", _I), _logic),
    (re.compile(r"^(?:solve linear system|linsolve|solve system)\s+(.+)$", _I), _linsolve),
    (re.compile(r"^(?:multiply|matmul|product of)\s+(.+)$", _I), _matmul),
    (re.compile(r"^(determinant|det|inverse|inv|rank|eigenvalues?|eigenvals)(?: of)?\s+(.+)$", _I), _matrix_unary),
    (re.compile(r"^(?:what is |what's |is )?(" + _NUM.replace("[-+]?", "") + r")\s+(?:a\s+)?prime$", _I), _is_prime),
    (re.compile(r"^is\s+(\d+)\s+(?:a\s+)?prime$", _I), _is_prime),
    (re.compile(r"^(?:prime )?factor(?:i[sz]e)?(?: integer| the number)?\s+(\d+)$", _I), _factor_int),
    (re.compile(r"^(gcd|lcm)(?: of)?\s+(.+)$", _I), _gcd_lcm),
    (re.compile(r"^(?:modpow|power mod)\s+(-?\d+)\s+(-?\d+)\s+(\d+)$", _I), _modpow),
    (re.compile(r"^(-?\d+)\s*(?:\^|\*\*)\s*(-?\d+)\s+mod(?:ulo)?\s+(\d+)$", _I), _modpow),
    (re.compile(r"^(?:factorial(?: of)?\s+(\d+)|(\d+)\s*!)$", _I), lambda m, r: _factorial_any(m, r)),
    (re.compile(r"^(?:choose|binomial|comb)\s+(\d+)[ ,]+(\d+)$", _I), _choose),
    (re.compile(r"^(\d+)\s+choose\s+(\d+)$", _I), _choose_rev),
    (re.compile(r"^C\(\s*(\d+)\s*,\s*(\d+)\s*\)$"), _choose),
    (re.compile(r"^shortest path from (\w+) to (\w+)(?: in(?: graph)?)?[: ]\s*(.+)$", _I), _path),
    (re.compile(r"^(?:convert\s+)?(" + _NUM + r")\s*([A-Za-z\u00b0]\w*)\s+(?:to|in|into)\s+([A-Za-z\u00b0]\w*)$", _I), _convert),
    (re.compile(r"^(?:solve|find|roots? of)\s+(.+?)(?:\s+for\s+(.+))?$", _I), _solve),
    (re.compile(r"^(?:the\s+)?(?:(?P<order>second|third|fourth)\s+)?(?:derivative|differentiate|diff)(?:\s+of)?\s+(?P<expr>.+?)(?:\s+(?:with respect to|wrt|w\.r\.t\.?)\s+(?P<var>[A-Za-z]\w*))?$", _I), _derivative),
    (re.compile(r"^(?:integrate|integral(?: of)?)\s+(.+)$", _I), _integrate),
    (re.compile(r"^limit(?:\s+of)?\s+(?P<expr>.+?)\s+as\s+(?P<var>[A-Za-z]\w*)\s*(?:->|to|approaches)\s*(?P<point>.+?)(?:\s+from the (?P<side>left|right))?$", _I), _limit),
    (re.compile(r"^(simplify|expand|factor)\s+(.+)$", _I), _transform),
    (re.compile(r"^(?:evaluate|eval|calculate|compute|what is|what's)\s+(.+)$", _I), _evaluate),
]
_STAT_RE = re.compile(r"^(?:(?P<kind>sample|population)\s+)?(?P<stat>standard deviation|mean|average|avg|median|variance|var|stdev|std|sd|sum|total|minimum|maximum|min|max)(?:\s+of)?\s+(?P<data>.+)$", _I)


def _factorial_any(m: re.Match, raw: str) -> Command:
    n = int(m.group(1) or m.group(2))
    return Command("factorial", {"n": n}, f"factorial of {n}", raw)


def parse_statement(text: str) -> Command:
    t = _clean(text)
    if not t:
        raise ParseError("empty input")
    if t.startswith("{"):
        raise ParseError("structured input is handled by the API, not the text parser")
    sm = _STAT_RE.match(t)
    if sm:
        cmd = _stat(sm, text)
        if cmd:
            return cmd
    for pattern, build in _PATTERNS:
        m = pattern.match(t)
        if m:
            return build(m, text)
    return _expression(t, text)  # a bare expression or equation


def parse(text: str) -> List[Command]:
    """Split on ';' or newlines (outside brackets) and parse each statement."""
    parts, depth, cur = [], 0, []
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch in ";\n" and depth <= 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    statements = [p for p in (s.strip() for s in parts) if p]
    if not statements:
        raise ParseError("empty input")
    if len(statements) > 20:
        raise ParseError("at most 20 statements per request")
    with placeholders():
        return [parse_statement(s) for s in statements]
