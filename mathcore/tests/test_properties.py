"""Property tests: random inputs, answers cross-checked by independent arithmetic in the test itself."""
from fractions import Fraction

import sympy as sp
from hypothesis import HealthCheck, assume, given, settings, strategies as st

from mathcore import Orchestrator, VERIFIED, PARTIAL

S = settings(max_examples=40, deadline=None, suppress_health_check=list(HealthCheck))
O = Orchestrator()
OK = (VERIFIED, PARTIAL)


def run(text):
    return O.ask(text).certificates[0]


@S
@given(st.integers(2, 10 ** 12))
def test_factorisation_multiplies_back(n):
    c = run(f"factor integer {n}")
    assert c.status in OK
    prod = 1
    for p, e in c.raw.items():
        assert sp.isprime(p)
        prod *= p ** e
    assert prod == n


@S
@given(st.integers(-10 ** 9, 10 ** 9), st.integers(-10 ** 9, 10 ** 9))
def test_gcd_lcm_identity(a, b):
    if a == 0 and b == 0:
        return
    g, l = run(f"gcd of {a}, {b}"), run(f"lcm of {a}, {b}")
    assert g.status in OK and l.status in OK
    assert g.raw * l.raw == abs(a * b)


@S
@given(st.integers(0, 10 ** 6), st.integers(0, 10 ** 6), st.integers(1, 10 ** 6))
def test_modpow_matches_python(b, e, m):
    c = run(f"modpow {b} {e} {m}")
    assert c.status in OK and c.raw == pow(b, e, m)


@S
@given(st.integers(-9, 9), st.integers(-9, 9))
def test_quadratic_with_known_roots(r1, r2):
    expr = sp.expand((sp.Symbol("x") - r1) * (sp.Symbol("x") - r2))
    c = run(f"solve {expr} = 0".replace("**", "^"))
    assert c.status in OK
    got = sorted(int(s["x"]) for s in c.raw)
    assert got == sorted({r1, r2})


@S
@given(st.lists(st.integers(-6, 6), min_size=2, max_size=6))
def test_polynomial_derivative_by_hand(coeffs):
    assume(any(coeffs[1:]))  # a constant has no variable to differentiate
    expr = " + ".join(f"{c}*x^{i}" for i, c in enumerate(coeffs))
    c = run(f"derivative of {expr}")
    assert c.status in OK
    x = sp.Symbol("x")
    by_hand = sum(i * co * x ** (i - 1) for i, co in enumerate(coeffs) if i > 0)
    assert sp.expand(c.raw - by_hand) == 0


@S
@given(st.lists(st.lists(st.integers(-5, 5), min_size=3, max_size=3), min_size=3, max_size=3))
def test_inverse_times_matrix_is_identity(rows):
    M = sp.Matrix(rows)
    if M.det() == 0:
        return
    c = run(f"inverse of {rows}")
    assert c.status in OK
    inv = sp.Matrix([[sp.Rational(v.numerator, v.denominator) if isinstance(v, Fraction) else v for v in r]
                     for r in (c.raw.tolist() if isinstance(c.raw, sp.MatrixBase) else c.raw)])
    assert M * inv == sp.eye(3)


@S
@given(st.lists(st.lists(st.integers(-5, 5), min_size=3, max_size=3), min_size=3, max_size=3),
       st.lists(st.integers(-9, 9), min_size=3, max_size=3))
def test_linear_system_recovers_the_hidden_solution(rows, x):
    A = sp.Matrix(rows)
    if A.det() == 0:
        return
    b = list(A * sp.Matrix(x))
    c = run(f"solve linear system {rows} {b}")
    assert c.status in OK
    assert [sp.Rational(v.numerator, v.denominator) if isinstance(v, Fraction) else v for v in c.raw] == x


@S
@given(st.lists(st.integers(-1000, 1000), min_size=1, max_size=20))
def test_mean_is_exact(data):
    c = run("mean of " + ", ".join(map(str, data)))
    assert c.status in OK
    assert Fraction(int(c.raw.p), int(c.raw.q)) == Fraction(sum(data), len(data))


@S
@given(st.integers(-999, 999), st.integers(-999, 999))
def test_claim_audit_agrees_with_python_arithmetic(a, b):
    q = f"evaluate ({a})*({b}) + ({a})"
    truth = a * b + a
    assert O.check(q, str(truth)).verdict == "MATCH"
    assert O.check(q, str(truth + 1)).verdict == "MISMATCH"
