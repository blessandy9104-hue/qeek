"""Validated parsing of mathematical text.

User text is parsed into a Python AST, checked against a node allowlist, and then
interpreted node by node by a *backend* (SymPy, exact Fractions, mpmath, or Z3).
Nothing is passed to ``eval`` or ``exec``, so attribute access, imports, lambdas,
subscripts and strings cannot execute.

Resource limits stop denial-of-service input such as ``9**9**9``.
"""
from __future__ import annotations

import ast
import re
from contextlib import contextmanager
from contextvars import ContextVar
from fractions import Fraction
from typing import Any, Callable, Dict, Iterable, List, Optional

import mpmath as mp
import sympy as sp

MAX_CHARS = 2000
MAX_NODES = 800
MAX_POW_BITS = 200_000
MAX_FACTORIAL = 5000


class ParseError(ValueError):
    """The text is not an acceptable mathematical expression."""


class NotApplicable(Exception):
    """This backend cannot represent the expression (not an error in the input)."""


_KEYWORDS = r"(?:and|or|not|if|else|in|is|for|to|from|as|at|dx|dy|dt)"
_IMPLICIT_NUM = re.compile(
    r"(?<![\w.])(\d+(?:\.\d+)?)(?![eE][+-]?\d)\s*(?=(?!" + _KEYWORDS + r"\b)[A-Za-z_(])"
)
_IMPLICIT_PAREN = re.compile(r"\)\s*(?=(?!" + _KEYWORDS + r"\b)[A-Za-z_(\d])")
_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,15}$")

_BIN_OPS = {
    ast.Add: "add", ast.Sub: "sub", ast.Mult: "mul", ast.Div: "div",
    ast.Pow: "pow", ast.Mod: "mod", ast.FloorDiv: "floordiv",
}
_CMP_OPS = {
    ast.Lt: "lt", ast.LtE: "le", ast.Gt: "gt", ast.GtE: "ge", ast.Eq: "eq", ast.NotEq: "ne",
}
_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name, ast.Call, ast.Load,
    ast.List, ast.Tuple, ast.Compare, ast.BoolOp, ast.keyword,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv,
    ast.USub, ast.UAdd, ast.Not, ast.And, ast.Or,
    ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq,
)


_PLACEHOLDERS: ContextVar[bool] = ContextVar("mathcore_placeholders", default=False)


@contextmanager
def placeholders():
    """While active, ``$1``-style references parse as the number 1. Used only while the command
    parser decides what kind of request it has; values are substituted before anything runs."""
    token = _PLACEHOLDERS.set(True)
    try:
        yield
    finally:
        _PLACEHOLDERS.reset(token)


def prepare(text: str) -> str:
    """Normalise surface syntax (``^``, implicit multiplication) before parsing."""
    if not isinstance(text, str):
        raise ParseError("expression must be text")
    if len(text) > MAX_CHARS:
        raise ParseError(f"expression longer than {MAX_CHARS} characters")
    s = text.strip()
    if _PLACEHOLDERS.get():
        s = re.sub(r"\$\d+", "1", s)
    s = re.sub(r"(?<![\w.])(\d+)\s*!(?!=)", r"factorial(\1)", s)
    s = s.replace("^", "**").replace("\u00d7", "*").replace("\u00f7", "/")
    s = s.replace("\u2212", "-")
    s = _IMPLICIT_NUM.sub(lambda m: m.group(1) + "*", s)
    s = _IMPLICIT_PAREN.sub(")*", s)
    return s


def parse_tree(text: str) -> ast.Expression:
    """Parse and validate; returns the AST (never executes it)."""
    src = prepare(text)
    if not src:
        raise ParseError("empty expression")
    try:
        tree = ast.parse(src, mode="eval")
    except (SyntaxError, ValueError, MemoryError, RecursionError) as exc:
        raise ParseError(f"cannot parse {text!r}: {exc}") from None
    count = 0
    for node in ast.walk(tree):
        count += 1
        if count > MAX_NODES:
            raise ParseError("expression too large")
        if not isinstance(node, _ALLOWED_NODES):
            raise ParseError(f"{type(node).__name__} is not allowed in a mathematical expression")
        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float, bool)):
            raise ParseError("only numeric constants are allowed")
        if isinstance(node, ast.Name) and (node.id.startswith("__") or not _NAME.match(node.id)):
            raise ParseError(f"illegal name {node.id!r}")
        if isinstance(node, ast.Call) and (not isinstance(node.func, ast.Name) or node.keywords):
            raise ParseError("only plain function calls are allowed")
    tree._src = src  # type: ignore[attr-defined]
    return tree


# --------------------------------------------------------------------------- backends
class Backend:
    """Interprets validated AST nodes. Subclasses supply the arithmetic."""

    def number(self, text: str) -> Any: raise NotImplementedError
    def symbol(self, name: str) -> Any: raise NotImplementedError
    def binop(self, op: str, a: Any, b: Any) -> Any: raise NotImplementedError
    def unary(self, op: str, a: Any) -> Any: raise NotImplementedError
    def compare(self, op: str, a: Any, b: Any) -> Any: raise NotImplementedError
    def boolop(self, op: str, values: List[Any]) -> Any: raise NotImplementedError
    def call(self, name: str, args: List[Any]) -> Any: raise NotImplementedError
    def sequence(self, items: List[Any]) -> Any: return list(items)


def interpret(tree: ast.Expression, backend: Backend) -> Any:
    src = getattr(tree, "_src", "")

    def ev(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool):
                return backend.number("1" if node.value else "0")
            text = ast.get_source_segment(src, node) or repr(node.value)
            return backend.number(text.replace("_", ""))
        if isinstance(node, ast.Name):
            return backend.symbol(node.id)
        if isinstance(node, ast.BinOp):
            return backend.binop(_BIN_OPS[type(node.op)], ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp):
            op = {ast.USub: "neg", ast.UAdd: "pos", ast.Not: "not"}[type(node.op)]
            return backend.unary(op, ev(node.operand))
        if isinstance(node, ast.Compare):
            values = [ev(node.left)] + [ev(c) for c in node.comparators]
            parts = [backend.compare(_CMP_OPS[type(o)], values[i], values[i + 1])
                     for i, o in enumerate(node.ops)]
            return parts[0] if len(parts) == 1 else backend.boolop("and", parts)
        if isinstance(node, ast.BoolOp):
            return backend.boolop("and" if isinstance(node.op, ast.And) else "or",
                                  [ev(v) for v in node.values])
        if isinstance(node, ast.Call):
            return backend.call(node.func.id, [ev(a) for a in node.args])  # type: ignore[attr-defined]
        if isinstance(node, (ast.List, ast.Tuple)):
            return backend.sequence([ev(e) for e in node.elts])
        raise ParseError(f"unsupported node {type(node).__name__}")  # pragma: no cover

    try:
        return ev(tree)
    except RecursionError:
        raise ParseError("expression nested too deeply") from None


def _check_pow(base_int: Optional[int], exp_int: Optional[int]) -> None:
    if base_int is None or exp_int is None:
        return
    if abs(exp_int) * max(1, abs(base_int).bit_length()) > MAX_POW_BITS:
        raise ParseError("exponentiation result would be too large")


# --------------------------------------------------------------------------- SymPy
_SYMPY_FUNCS: Dict[str, Callable[..., Any]] = {
    "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "cot": sp.cot, "sec": sp.sec, "csc": sp.csc,
    "asin": sp.asin, "acos": sp.acos, "atan": sp.atan, "atan2": sp.atan2,
    "sinh": sp.sinh, "cosh": sp.cosh, "tanh": sp.tanh,
    "exp": sp.exp, "ln": sp.log, "sqrt": sp.sqrt, "abs": sp.Abs, "Abs": sp.Abs,
    "floor": sp.floor, "ceil": sp.ceiling, "ceiling": sp.ceiling, "sign": sp.sign,
    "gamma": sp.gamma, "Min": sp.Min, "Max": sp.Max, "min": sp.Min, "max": sp.Max,
    "implies": sp.Implies, "Implies": sp.Implies, "xor": sp.Xor,
}
_SYMPY_CONSTS = {"pi": sp.pi, "e": sp.E, "E": sp.E, "I": sp.I, "oo": sp.oo}


class SympyBackend(Backend):
    def __init__(self, undefined_functions: bool = False) -> None:
        self.undefined_functions = undefined_functions

    def number(self, text: str) -> Any:
        try:
            f = Fraction(text)
        except ValueError:
            raise ParseError(f"bad number {text!r}") from None
        return sp.Rational(f.numerator, f.denominator)

    def symbol(self, name: str) -> Any:
        return _SYMPY_CONSTS[name] if name in _SYMPY_CONSTS else sp.Symbol(name)

    def binop(self, op: str, a: Any, b: Any) -> Any:
        if isinstance(a, list) or isinstance(b, list):
            raise ParseError("lists cannot be used in arithmetic")
        if op == "add": return a + b
        if op == "sub": return a - b
        if op == "mul": return a * b
        if op in ("div", "floordiv", "mod"):
            if b == 0:
                raise ParseError("division by zero")
            if op == "div": return a / b
            if op == "floordiv": return sp.floor(a / b)
            return sp.Mod(a, b)
        if op == "pow":
            _check_pow(int(a) if getattr(a, "is_Integer", False) else None,
                       int(b) if getattr(b, "is_Integer", False) else None)
            if a == 0 and getattr(b, "is_negative", False):
                raise ParseError("division by zero")
            return a ** b
        raise ParseError(f"operator {op}")  # pragma: no cover

    def unary(self, op: str, a: Any) -> Any:
        return {"neg": lambda: -a, "pos": lambda: a, "not": lambda: sp.Not(a)}[op]()

    def compare(self, op: str, a: Any, b: Any) -> Any:
        return {"lt": sp.Lt, "le": sp.Le, "gt": sp.Gt, "ge": sp.Ge, "eq": sp.Eq, "ne": sp.Ne}[op](a, b)

    def boolop(self, op: str, values: List[Any]) -> Any:
        return sp.And(*values) if op == "and" else sp.Or(*values)

    def call(self, name: str, args: List[Any]) -> Any:
        if name == "log":
            return sp.log(*args)
        if name == "factorial":
            if args[0].is_Integer and int(args[0]) > MAX_FACTORIAL:
                raise ParseError("factorial argument too large")
            return sp.factorial(args[0])
        if name == "binomial":
            if any(a.is_Integer and abs(int(a)) > 10 ** 6 for a in args):
                raise ParseError("binomial argument too large")
            return sp.binomial(*args)
        if name in _SYMPY_FUNCS:
            return _SYMPY_FUNCS[name](*args)
        if self.undefined_functions:
            return sp.Function(name)(*args)
        raise ParseError(f"unknown function {name!r}")


def to_sympy(text: str, undefined_functions: bool = False) -> Any:
    return interpret(parse_tree(text), SympyBackend(undefined_functions))


# --------------------------------------------------------------------------- Fractions
class FractionBackend(Backend):
    """Exact rational arithmetic that shares no code with SymPy."""

    def number(self, text: str) -> Any:
        try:
            return Fraction(text)
        except ValueError:
            raise ParseError(f"bad number {text!r}") from None

    def symbol(self, name: str) -> Any:
        raise NotApplicable(f"symbol {name} is not a rational number")

    def binop(self, op: str, a: Any, b: Any) -> Any:
        if isinstance(a, list) or isinstance(b, list):
            raise NotApplicable("lists")
        if op == "add": return a + b
        if op == "sub": return a - b
        if op == "mul": return a * b
        if op in ("div", "floordiv", "mod"):
            if b == 0:
                raise ParseError("division by zero")
            if op == "div": return a / b
            if op == "floordiv": return Fraction(a // b)
            return a % b
        if op == "pow":
            if b.denominator != 1:
                raise NotApplicable("non-integer exponent")
            if a == 0 and b < 0:
                raise ParseError("division by zero")
            _check_pow(a.numerator if a.denominator == 1 else max(abs(a.numerator), a.denominator),
                       int(b))
            return a ** int(b)
        raise ParseError(f"operator {op}")  # pragma: no cover

    def unary(self, op: str, a: Any) -> Any:
        if op == "neg": return -a
        if op == "pos": return a
        return not a

    def compare(self, op: str, a: Any, b: Any) -> Any:
        return {"lt": a < b, "le": a <= b, "gt": a > b, "ge": a >= b, "eq": a == b, "ne": a != b}[op]

    def boolop(self, op: str, values: List[Any]) -> Any:
        return all(values) if op == "and" else any(values)

    def call(self, name: str, args: List[Any]) -> Any:
        import math
        if name in ("abs", "Abs"): return abs(args[0])
        if name == "sqrt":
            a = args[0]
            if a < 0:
                raise NotApplicable("negative square root")
            n, d = a.numerator, a.denominator
            rn, rd = math.isqrt(n), math.isqrt(d)
            if rn * rn == n and rd * rd == d:
                return Fraction(rn, rd)
            raise NotApplicable("irrational square root")
        if name == "factorial":
            if args[0].denominator != 1 or args[0] < 0 or args[0] > MAX_FACTORIAL:
                raise NotApplicable("factorial argument")
            return Fraction(math.factorial(int(args[0])))
        if name == "binomial":
            n, k = args
            if n.denominator != 1 or k.denominator != 1 or n < 0 or n > 10 ** 6:
                raise NotApplicable("binomial arguments")
            return Fraction(math.comb(int(n), int(k))) if k >= 0 else Fraction(0)
        if name in ("min", "Min"): return min(args)
        if name in ("max", "Max"): return max(args)
        if name == "floor": return Fraction(math.floor(args[0]))
        if name in ("ceil", "ceiling"): return Fraction(math.ceil(args[0]))
        if name == "sign": return Fraction((args[0] > 0) - (args[0] < 0))
        raise NotApplicable(f"function {name} is not rational")


def to_fraction(text: str) -> Any:
    return interpret(parse_tree(text), FractionBackend())


# --------------------------------------------------------------------------- mpmath
_MP_FUNCS: Dict[str, Callable[..., Any]] = {
    "sin": mp.sin, "cos": mp.cos, "tan": mp.tan, "cot": mp.cot, "sec": mp.sec, "csc": mp.csc,
    "asin": mp.asin, "acos": mp.acos, "atan": mp.atan, "atan2": mp.atan2,
    "sinh": mp.sinh, "cosh": mp.cosh, "tanh": mp.tanh,
    "exp": mp.exp, "ln": mp.log, "log": mp.log, "sqrt": mp.sqrt, "abs": abs, "Abs": abs,
    "floor": mp.floor, "ceil": mp.ceil, "ceiling": mp.ceil, "sign": mp.sign,
    "gamma": mp.gamma, "factorial": mp.factorial, "binomial": mp.binomial,
    "min": min, "max": max, "Min": min, "Max": max,
}


class MpBackend(Backend):
    """High-precision numeric evaluation (mpmath) with variable bindings."""

    def __init__(self, env: Optional[Dict[str, Any]] = None) -> None:
        self.env = env or {}

    def number(self, text: str) -> Any:
        f = Fraction(text)
        return mp.mpf(f.numerator) / mp.mpf(f.denominator)

    def symbol(self, name: str) -> Any:
        if name in self.env:
            return self.env[name]
        if name == "pi": return mp.pi
        if name in ("e", "E"): return mp.e
        if name == "I": return mp.mpc(0, 1)
        raise NotApplicable(f"unbound symbol {name}")

    def binop(self, op: str, a: Any, b: Any) -> Any:
        if op == "add": return a + b
        if op == "sub": return a - b
        if op == "mul": return a * b
        if op in ("div", "floordiv", "mod"):
            if b == 0:
                raise ParseError("division by zero")
            return a / b if op == "div" else (mp.floor(a / b) if op == "floordiv" else a % b)
        if op == "pow":
            if mp.isint(a) and mp.isint(b):
                _check_pow(int(a), int(b))
            return a ** b
        raise ParseError(f"operator {op}")  # pragma: no cover

    def unary(self, op: str, a: Any) -> Any:
        return -a if op == "neg" else (a if op == "pos" else (not a))

    def compare(self, op: str, a: Any, b: Any) -> Any:
        return {"lt": a < b, "le": a <= b, "gt": a > b, "ge": a >= b, "eq": a == b, "ne": a != b}[op]

    def boolop(self, op: str, values: List[Any]) -> Any:
        return all(values) if op == "and" else any(values)

    def call(self, name: str, args: List[Any]) -> Any:
        if name in ("factorial",) and mp.isint(args[0]) and int(args[0]) > MAX_FACTORIAL:
            raise ParseError("factorial argument too large")
        if name in _MP_FUNCS:
            return _MP_FUNCS[name](*args)
        raise NotApplicable(f"function {name}")


def to_mpmath(text: str, env: Optional[Dict[str, Any]] = None) -> Any:
    return interpret(parse_tree(text), MpBackend(env))


def free_names(text: str) -> List[str]:
    """Sorted free variable names in an expression (constants excluded)."""
    expr = to_sympy(text)
    if isinstance(expr, list):
        syms = set().union(*[getattr(e, "free_symbols", set()) for e in expr]) if expr else set()
    else:
        syms = getattr(expr, "free_symbols", set())
    return sorted(str(s) for s in syms)


def split_equation(text: str) -> Optional[tuple]:
    """Split ``lhs = rhs`` on a single ``=`` (not ``==``, ``<=``, ``>=``, ``!=``)."""
    parts = re.split(r"(?<![<>=!])=(?!=)", text)
    if len(parts) == 1:
        return None
    if len(parts) != 2:
        raise ParseError("an equation has exactly one '='")
    return parts[0].strip(), parts[1].strip()
