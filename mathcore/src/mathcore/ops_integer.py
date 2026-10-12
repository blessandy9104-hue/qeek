"""Integers: primality, factorisation, gcd/lcm, modular power, factorial, binomial."""
from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .safe_expr import NotApplicable, ParseError

MAX_FACTOR_DIGITS = 50
_SMALL_PRIMES = (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41)
_DET_LIMIT = 3_317_044_064_679_887_385_961_981  # first 13 prime bases are exact below this


def _int(a: Dict[str, Any], key: str) -> int:
    v = a[key]
    if isinstance(v, bool) or not isinstance(v, int):
        raise ParseError(f"{key} must be an integer")
    return v


# ---- own Miller-Rabin ------------------------------------------------------------------
def miller_rabin(n: int) -> bool:
    if n < 2:
        return False
    for p in _SMALL_PRIMES:
        if n % p == 0:
            return n == p
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    bases = list(_SMALL_PRIMES)
    if n >= _DET_LIMIT:
        rng = random.Random(n % (2 ** 32))
        bases += [rng.randrange(2, n - 1) for _ in range(24)]
    for a in bases:
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False
    return True


def _trial_prime(n: int) -> bool:
    if n < 10 ** 12:
        if n < 2:
            return False
        if n % 2 == 0:
            return n == 2
        i = 3
        r = math.isqrt(n)
        while i <= r:
            if n % i == 0:
                return False
            i += 2
        return True
    raise NotApplicable("trial division is too slow above 1e12")


REGISTRY.add(Operation(
    "is_prime", "Primality of an integer",
    [Method("miller-rabin", "own", lambda a: miller_rabin(_int(a, "n"))),
     Method("sympy-isprime", "sympy", lambda a: bool(sp.isprime(_int(a, "n")))),
     Method("trial-division", "own", lambda a: _trial_prime(_int(a, "n")))],
    same=lambda x, y: x == y, show=lambda v: "prime" if v else "not prime",
    caveats=lambda a, v: (["above 3.3e24 primality rests on strong probable-prime tests with no known counterexample"]
                          if abs(a["n"]) >= _DET_LIMIT else [])))


# ---- own factorisation -----------------------------------------------------------------
def _rho(n: int) -> int:
    if n % 2 == 0:
        return 2
    rng = random.Random(n % (2 ** 31))
    while True:
        c = rng.randrange(1, n)
        y, r, q, g = rng.randrange(0, n), 1, 1, 1
        m = 128
        x = ys = y
        while g == 1:
            x = y
            for _ in range(r):
                y = (y * y + c) % n
            k = 0
            while k < r and g == 1:
                ys = y
                for _ in range(min(m, r - k)):
                    y = (y * y + c) % n
                    q = q * abs(x - y) % n
                g = math.gcd(q, n)
                k += m
            r *= 2
        if g == n:
            g = 1
            while g == 1:
                ys = (ys * ys + c) % n
                g = math.gcd(abs(x - ys), n)
        if g != n:
            return g


def factor_own(n: int) -> Dict[int, int]:
    out: Dict[int, int] = {}
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        while n % p == 0:
            out[p] = out.get(p, 0) + 1
            n //= p
    stack = [n] if n > 1 else []
    while stack:
        m = stack.pop()
        if m == 1:
            continue
        if miller_rabin(m):
            out[m] = out.get(m, 0) + 1
            continue
        r = math.isqrt(m)
        if r * r == m:
            stack += [r, r]
            continue
        d = _rho(m)
        stack += [d, m // d]
    return dict(sorted(out.items()))


def _factor_args(a: Dict[str, Any]) -> int:
    n = _int(a, "n")
    if n < 2:
        raise ParseError("factorisation needs an integer of at least 2")
    if len(str(n)) > MAX_FACTOR_DIGITS:
        raise ParseError(f"numbers longer than {MAX_FACTOR_DIGITS} digits are not factored")
    return n


def _check_product(a: Dict[str, Any], f: Dict[int, int]) -> Tuple[bool, str]:
    prod = 1
    for p, e in f.items():
        prod *= p ** e
    return prod == a["n"], "product of prime powers equals n"


def _check_primes(a: Dict[str, Any], f: Dict[int, int]) -> Tuple[bool, str]:
    bad = [p for p in f if not (miller_rabin(p) and sp.isprime(p))]
    return not bad, "every factor is prime (two independent tests)" if not bad else f"not prime: {bad}"


REGISTRY.add(Operation(
    "factor_int", "Prime factorisation of an integer",
    [Method("trial+pollard-rho", "own", lambda a: factor_own(_factor_args(a))),
     Method("sympy-factorint", "sympy", lambda a: {int(k): int(v) for k, v in sp.factorint(_factor_args(a)).items()})],
    checks=[Check("product-equals-n", _check_product), Check("factors-are-prime", _check_primes)],
    same=lambda x, y: x == y,
    show=lambda f: " * ".join(f"{p}^{e}" if e > 1 else str(p) for p, e in f.items())))


# ---- gcd / lcm -------------------------------------------------------------------------
def _ints(a: Dict[str, Any]) -> List[int]:
    vals = a["values"]
    if len(vals) < 2 or any(isinstance(v, bool) or not isinstance(v, int) for v in vals):
        raise ParseError("give at least two integers")
    return vals


def _euclid(x: int, y: int) -> int:
    x, y = abs(x), abs(y)
    while y:
        x, y = y, x % y
    return x


def _ext_gcd(x: int, y: int) -> Tuple[int, int, int]:
    if y == 0:
        return abs(x), (1 if x >= 0 else -1), 0
    g, s, t = _ext_gcd(y, x % y)
    return g, t, s - (x // y) * t


def _gcd_own(a: Dict[str, Any]) -> int:
    g = 0
    for v in _ints(a):
        g = _euclid(g, v)
    return g


def _check_gcd(a: Dict[str, Any], g: int) -> Tuple[bool, str]:
    vals = _ints(a)
    if any(v % g for v in vals) if g else any(vals):
        return False, "result does not divide every input"
    x, y = vals[0], vals[1]
    d, s, t = _ext_gcd(x, y)
    if s * x + t * y != d:
        return False, "Bezout identity failed"
    return True, f"divides all inputs; Bezout: {s}*{x} + {t}*{y} = {d}"


REGISTRY.add(Operation(
    "gcd", "Greatest common divisor",
    [Method("math.gcd", "stdlib", lambda a: math.gcd(*_ints(a))), Method("euclid", "own", _gcd_own),
     Method("sympy-igcd", "sympy", lambda a: int(sp.igcd(*_ints(a))))],
    checks=[Check("divides-all+bezout", _check_gcd)], same=lambda x, y: x == y, show=str))


def _lcm_own(a: Dict[str, Any]) -> int:
    out = 1
    for v in _ints(a):
        out = abs(out * v) // _euclid(out, v) if v else 0
    return out


def _check_lcm(a: Dict[str, Any], l: int) -> Tuple[bool, str]:
    vals = _ints(a)
    if l == 0:
        return any(v == 0 for v in vals), "a zero input forces lcm 0"
    return all(l % v == 0 for v in vals), "divisible by every input"


REGISTRY.add(Operation(
    "lcm", "Least common multiple",
    [Method("math.lcm", "stdlib", lambda a: math.lcm(*_ints(a))), Method("gcd-formula", "own", _lcm_own),
     Method("sympy-ilcm", "sympy", lambda a: int(sp.ilcm(*_ints(a))))],
    checks=[Check("divisible-by-all", _check_lcm)], same=lambda x, y: x == y, show=str))


# ---- modular power ---------------------------------------------------------------------
def _modinv(b: int, m: int) -> int:
    g, s, _ = _ext_gcd(b % m, m)
    if g != 1:
        raise NotApplicable("no modular inverse")
    return s % m


def _modpow_own(a: Dict[str, Any]) -> int:
    b, e, m = _int(a, "base"), _int(a, "exp"), _int(a, "mod")
    if m < 1:
        raise ParseError("modulus must be positive")
    if e < 0:
        b, e = _modinv(b, m), -e
    result, base = 1 % m, b % m
    while e:
        if e & 1:
            result = result * base % m
        base = base * base % m
        e >>= 1
    return result


def _modpow_py(a: Dict[str, Any]) -> int:
    if _int(a, "mod") < 1:
        raise ParseError("modulus must be positive")
    return pow(_int(a, "base"), _int(a, "exp"), _int(a, "mod"))


REGISTRY.add(Operation(
    "modpow", "Modular exponentiation base^exp mod m",
    [Method("builtin-pow", "stdlib", _modpow_py), Method("square-and-multiply", "own", _modpow_own)],
    same=lambda x, y: x == y, show=str))


# ---- factorial / binomial --------------------------------------------------------------
def _n_small(a: Dict[str, Any], key: str = "n", cap: int = 5000) -> int:
    n = _int(a, key)
    if n < 0 or n > cap:
        raise ParseError(f"{key} must be between 0 and {cap}")
    return n


def _fact_loop(a: Dict[str, Any]) -> int:
    out = 1
    for i in range(2, _n_small(a) + 1):
        out *= i
    return out


REGISTRY.add(Operation(
    "factorial", "n!",
    [Method("math.factorial", "stdlib", lambda a: math.factorial(_n_small(a))), Method("product-loop", "own", _fact_loop),
     Method("sympy-factorial", "sympy", lambda a: int(sp.factorial(_n_small(a))))],
    same=lambda x, y: x == y, show=lambda v: str(v) if len(str(v)) <= 80 else f"{str(v)[:30]}...{str(v)[-10:]}  ({len(str(v))} digits)"))


def _choose_own(a: Dict[str, Any]) -> int:
    n, k = _n_small(a, "n", 10 ** 5), _int(a, "k")
    if k < 0 or k > n:
        return 0
    k = min(k, n - k)
    out = 1
    for i in range(1, k + 1):
        out = out * (n - k + i) // i
    return out


REGISTRY.add(Operation(
    "choose", "Binomial coefficient C(n, k)",
    [Method("math.comb", "stdlib", lambda a: math.comb(_n_small(a, "n", 10 ** 5), max(_int(a, "k"), 0)) if 0 <= _int(a, "k") <= _n_small(a, "n", 10 ** 5) else 0),
     Method("multiplicative-formula", "own", _choose_own),
     Method("sympy-binomial", "sympy", lambda a: int(sp.binomial(_n_small(a, "n", 10 ** 5), _int(a, "k"))))],
    same=lambda x, y: x == y, show=str))
