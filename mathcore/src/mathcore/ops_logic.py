"""Logic and constraints: satisfiability (``sat``) and validity (``prove``).

Engines: Z3 (two solver configurations), exhaustive truth tables for propositional
formulas, and randomised model search. A reported model is *always* re-evaluated in exact
rational arithmetic by code that shares nothing with Z3.
"""
from __future__ import annotations

import ast
import itertools
import random
from fractions import Fraction
from typing import Any, Dict, List, Optional, Tuple

import z3

from .framework import REGISTRY, Check, Method, Operation
from .safe_expr import (Backend, FractionBackend, NotApplicable, ParseError, interpret, parse_tree)

SOLVER_MS = 10_000
MAX_TRUTH_VARS = 16
BOOL_FUNCS = {"implies", "Implies"}


# --------------------------------------------------------------------------- variable kinds
def classify(tree: ast.Expression, domain: str) -> Dict[str, str]:
    """Decide which names are Boolean and which numeric (``domain`` is 'int' or 'real')."""
    boolish, numeric = set(), set()

    def mark_bool(n: ast.AST) -> None:
        if isinstance(n, ast.Name):
            boolish.add(n.id)

    for node in ast.walk(tree):
        if isinstance(node, ast.BoolOp):
            for v in node.values:
                mark_bool(v)
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            mark_bool(node.operand)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in BOOL_FUNCS:
            for v in node.args:
                mark_bool(v)
        elif isinstance(node, (ast.BinOp, ast.Compare)):
            kids = [node.left] + (list(node.comparators) if isinstance(node, ast.Compare) else [node.right])
            for v in kids:
                if isinstance(v, ast.Name):
                    numeric.add(v.id)
        elif isinstance(node, ast.UnaryOp):
            if isinstance(node.operand, ast.Name):
                numeric.add(node.operand.id)
    if isinstance(tree.body, ast.Name):
        boolish.add(tree.body.id)
    both = boolish & numeric
    if both:
        raise ParseError(f"{sorted(both)[0]} is used as both a truth value and a number")
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    return {n: ("bool" if n in boolish else domain) for n in names}


# --------------------------------------------------------------------------- Z3 backend
class Z3Backend(Backend):
    def __init__(self, kinds: Dict[str, str], domain: str) -> None:
        self.kinds, self.domain = kinds, domain
        self.vars: Dict[str, Any] = {}

    def number(self, text: str) -> Any:
        f = Fraction(text)
        if self.domain == "int":
            if f.denominator != 1:
                raise ParseError("integer domain: decimals and fractions are not allowed")
            return z3.IntVal(f.numerator)
        return z3.RealVal(f"{f.numerator}/{f.denominator}")

    def symbol(self, name: str) -> Any:
        if name in ("pi", "e", "E", "I", "oo"):
            raise ParseError(f"constant {name} is not supported in logic formulas")
        if name not in self.vars:
            kind = self.kinds[name]
            self.vars[name] = (z3.Bool(name) if kind == "bool" else z3.Int(name) if kind == "int" else z3.Real(name))
        return self.vars[name]

    def binop(self, op: str, a: Any, b: Any) -> Any:
        if op == "add": return a + b
        if op == "sub": return a - b
        if op == "mul": return a * b
        if op == "div":
            if self.domain == "int":
                raise ParseError("integer domain: '/' is not allowed")
            return a / b
        if op == "mod":
            if self.domain != "int" or not z3.is_int_value(b) or b.as_long() <= 0:
                raise ParseError("'%' needs the integer domain and a positive literal modulus")
            return a % b
        if op == "pow":
            exp = None
            if z3.is_int_value(b):
                exp = b.as_long()
            elif z3.is_rational_value(b) and b.denominator_as_long() == 1:
                exp = b.numerator_as_long()
            if exp is None or not 0 <= exp <= 16:
                raise ParseError("exponents must be literal integers from 0 to 16")
            out = z3.IntVal(1) if self.domain == "int" else z3.RealVal(1)
            for _ in range(exp):
                out = out * a
            return out
        raise ParseError(f"operator {op} is not supported in logic formulas")

    def unary(self, op: str, a: Any) -> Any:
        return z3.Not(a) if op == "not" else (-a if op == "neg" else a)

    def compare(self, op: str, a: Any, b: Any) -> Any:
        return {"lt": a < b, "le": a <= b, "gt": a > b, "ge": a >= b, "eq": a == b, "ne": a != b}[op]

    def boolop(self, op: str, values: List[Any]) -> Any:
        return z3.And(*values) if op == "and" else z3.Or(*values)

    def call(self, name: str, args: List[Any]) -> Any:
        if name in BOOL_FUNCS:
            return z3.Implies(*args)
        if name in ("abs", "Abs"):
            return z3.If(args[0] >= 0, args[0], -args[0])
        if name in ("min", "Min"):
            return z3.If(args[0] <= args[1], args[0], args[1])
        if name in ("max", "Max"):
            return z3.If(args[0] >= args[1], args[0], args[1])
        raise ParseError(f"function {name} is not supported in logic formulas")


# --------------------------------------------------------------------------- exact model evaluation
class ModelBackend(FractionBackend):
    """Evaluate a formula exactly under a model; optional tolerance for approximated irrationals."""

    def __init__(self, env: Dict[str, Any], tol: Fraction = Fraction(0)) -> None:
        self.env, self.tol = env, tol

    def symbol(self, name: str) -> Any:
        if name not in self.env:
            raise NotApplicable(f"model has no value for {name}")
        return self.env[name]

    def compare(self, op: str, a: Any, b: Any) -> Any:
        t = self.tol
        if t:
            return {"lt": a < b, "le": a <= b + t, "gt": a > b, "ge": a >= b - t,
                    "eq": abs(a - b) <= t, "ne": abs(a - b) > t}[op]
        return super().compare(op, a, b)

    def call(self, name: str, args: List[Any]) -> Any:
        if name in BOOL_FUNCS:
            return (not args[0]) or bool(args[1])
        return super().call(name, args)


def _prepare(a: Dict[str, Any]) -> Tuple[ast.Expression, Dict[str, str], str]:
    domain = a.get("domain", "real")
    if domain not in ("int", "real"):
        raise ParseError("domain must be 'int' or 'real'")
    tree = parse_tree(a["formula"])
    return tree, classify(tree, domain), domain


def _formula(a: Dict[str, Any]) -> Tuple[Any, Dict[str, str], str]:
    tree, kinds, domain = _prepare(a)
    backend = Z3Backend(kinds, domain)
    f = interpret(tree, backend)
    if not z3.is_bool(f):
        raise ParseError("the formula must be true or false (use a comparison or and/or/not)")
    return f, kinds, domain


def _model_dict(m: Any, kinds: Dict[str, str]) -> Tuple[Dict[str, Any], bool]:
    out, approx = {}, False
    for name, kind in kinds.items():
        decl = next((d for d in m.decls() if d.name() == name), None)
        if decl is None:  # unconstrained: any value works
            out[name] = False if kind == "bool" else Fraction(0)
            continue
        v = m[decl]
        if kind == "bool":
            out[name] = bool(z3.is_true(v))
        elif z3.is_int_value(v):
            out[name] = Fraction(v.as_long())
        elif z3.is_rational_value(v):
            out[name] = Fraction(v.numerator_as_long(), v.denominator_as_long())
        else:  # algebraic number: approximate to 40 digits
            r = v.approx(40)
            out[name] = Fraction(r.numerator_as_long(), r.denominator_as_long())
            approx = True
    return out, approx


def _z3_check(f: Any, kinds: Dict[str, str], alt: bool) -> Tuple[str, Optional[Tuple[Dict[str, Any], bool]]]:
    s = z3.Then("simplify", "solve-eqs", "smt").solver() if alt else z3.Solver()
    s.set("timeout", SOLVER_MS)
    s.add(f)
    r = s.check()
    if r == z3.sat:
        return "sat", _model_dict(s.model(), kinds)
    if r == z3.unsat:
        return "unsat", None
    raise NotApplicable("solver gave up (unknown)")


def _eval_exact(a: Dict[str, Any], model: Dict[str, Any], approx: bool = False) -> bool:
    tree, _, _ = _prepare(a)
    return bool(interpret(tree, ModelBackend(model, Fraction(1, 10 ** 20) if approx else Fraction(0))))


def _is_propositional(kinds: Dict[str, str]) -> bool:
    return all(k == "bool" for k in kinds.values()) and bool(kinds)


def _truth_table(a: Dict[str, Any], want: bool) -> Tuple[str, Optional[Tuple[Dict[str, Any], bool]]]:
    tree, kinds, _ = _prepare(a)
    if not _is_propositional(kinds) or len(kinds) > MAX_TRUTH_VARS:
        raise NotApplicable("not a small propositional formula")
    names = sorted(kinds)
    for bits in itertools.product([False, True], repeat=len(names)):
        env = dict(zip(names, bits))
        if bool(interpret(tree, ModelBackend(env))) == want:
            return "found", (env, False)
    return "none", None


def _sample_search(a: Dict[str, Any], want: bool) -> Tuple[str, Optional[Tuple[Dict[str, Any], bool]]]:
    tree, kinds, domain = _prepare(a)
    rng = random.Random(7)
    names = sorted(kinds)
    for i in range(4000):
        env: Dict[str, Any] = {}
        for n in names:
            if kinds[n] == "bool":
                env[n] = bool(rng.getrandbits(1))
            elif domain == "int":
                env[n] = Fraction(rng.randint(-30, 30))
            else:
                env[n] = Fraction(rng.randint(-300, 300), rng.randint(1, 12))
        try:
            if bool(interpret(tree, ModelBackend(env))) == want:
                return "found", (env, False)
        except NotApplicable:
            continue
    raise NotApplicable("sampling found no model")


def _show_model(m: Optional[Tuple[Dict[str, Any], bool]]) -> str:
    if not m:
        return ""
    env, approx = m
    items = ", ".join(f"{k} = {('true' if v else 'false') if isinstance(v, bool) else (str(v.numerator) if v.denominator == 1 else f'{v.numerator}/{v.denominator}')}"
                      for k, v in sorted(env.items()))
    return items + (" (approximated)" if approx else "")


# --------------------------------------------------------------------------- sat
def _sat_z3(alt: bool):
    def run(a: Dict[str, Any]) -> Any:
        f, kinds, _ = _formula(a)
        return _z3_check(f, kinds, alt)
    return run


def _sat_table(a: Dict[str, Any]) -> Any:
    r, m = _truth_table(a, True)
    return ("sat", m) if r == "found" else ("unsat", None)


def _sat_sample(a: Dict[str, Any]) -> Any:
    return ("sat", _sample_search(a, True)[1])


def _check_sat_witness(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    verdict, model = v
    if verdict == "unsat":
        return True, "no model to check (unsat is confirmed by independent methods)"
    return _eval_exact(a, model[0], model[1]), "the model satisfies the formula (exact rational evaluation)"


def _sat_caveats(a: Dict[str, Any], v: Any) -> List[str]:
    verdict, model = v
    out = []
    if verdict == "unsat" and not _is_propositional(_prepare(a)[1]):
        out.append("unsatisfiability rests on Z3 (two solver configurations); arithmetic proofs have no independent engine here")
    if model and model[1]:
        out.append("the model contains irrational values, checked to 20 digits")
    return out


REGISTRY.add(Operation(
    "sat", "Is a formula satisfiable? Returns a model (checked exactly) or proves none exists",
    [Method("z3-default", "z3", _sat_z3(False)), Method("z3-alternate-tactics", "z3", _sat_z3(True)),
     Method("truth-table", "own", _sat_table), Method("random-model-search", "own", _sat_sample)],
    checks=[Check("model-witness", _check_sat_witness)],
    same=lambda x, y: x[0] == y[0],
    show=lambda v: ("satisfiable: " + _show_model(v[1])) if v[0] == "sat" else "unsatisfiable (no model exists)",
    caveats=_sat_caveats))


# --------------------------------------------------------------------------- prove
def _prove_z3(alt: bool):
    def run(a: Dict[str, Any]) -> Any:
        f, kinds, _ = _formula(a)
        verdict, model = _z3_check(z3.Not(f), kinds, alt)
        return ("invalid", model) if verdict == "sat" else ("valid", None)
    return run


def _prove_table(a: Dict[str, Any]) -> Any:
    r, m = _truth_table(a, False)
    return ("invalid", m) if r == "found" else ("valid", None)


def _prove_sample(a: Dict[str, Any]) -> Any:
    _, m = _sample_search(a, False)
    return ("invalid", m)


def _check_counterexample(a: Dict[str, Any], v: Any) -> Tuple[bool, str]:
    verdict, model = v
    if verdict == "valid":
        return True, "no counterexample to check"
    return (not _eval_exact(a, model[0], model[1])), "the counterexample makes the formula false (exact rational evaluation)"


def _prove_caveats(a: Dict[str, Any], v: Any) -> List[str]:
    out = []
    if v[0] == "valid" and not _is_propositional(_prepare(a)[1]):
        out.append("validity rests on Z3 (two solver configurations) and a failed counterexample search; "
                   "arithmetic proofs have no independent engine here")
    if v[1] and v[1][1]:
        out.append("the counterexample contains irrational values, checked to 20 digits")
    return out


REGISTRY.add(Operation(
    "prove", "Is a formula true for every value of its variables? Returns a checked counterexample if not",
    [Method("z3-default", "z3", _prove_z3(False)), Method("z3-alternate-tactics", "z3", _prove_z3(True)),
     Method("truth-table", "own", _prove_table), Method("random-counterexample-search", "own", _prove_sample)],
    checks=[Check("counterexample-witness", _check_counterexample)],
    same=lambda x, y: x[0] == y[0],
    show=lambda v: "valid: true for all values" if v[0] == "valid" else "not valid; counterexample: " + _show_model(v[1]),
    caveats=_prove_caveats))
