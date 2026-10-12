"""Linear algebra: determinant, inverse, rank, eigenvalues, linear solve, product."""
from __future__ import annotations

from fractions import Fraction
from typing import Any, Dict, List, Tuple

import mpmath as mp
import numpy as np
import sympy as sp

from .framework import REGISTRY, Check, Method, Operation
from .numeric import close, describe_number, is_exact, same_number, to_fraction_exact, to_mp
from .safe_expr import NotApplicable, ParseError, to_sympy

MAX_DIM = 12
LOOSE = mp.mpf(10) ** -8  # NumPy works in 64-bit floats


def parse_matrix(text: Any) -> List[List[Any]]:
    rows = to_sympy(text) if isinstance(text, str) else text
    if not isinstance(rows, list) or not rows or not all(isinstance(r, list) and r for r in rows):
        raise ParseError("a matrix is written [[1, 2], [3, 4]]")
    if len(rows) > MAX_DIM or len(rows[0]) > MAX_DIM:
        raise ParseError(f"matrices larger than {MAX_DIM}x{MAX_DIM} are not accepted")
    if len({len(r) for r in rows}) != 1:
        raise ParseError("matrix rows must have equal length")
    for r in rows:
        for v in r:
            if isinstance(v, list) or getattr(v, "free_symbols", None):
                raise ParseError("matrix entries must be numbers")
    return rows


def parse_vector(text: Any) -> List[Any]:
    v = to_sympy(text) if isinstance(text, str) else text
    if v and isinstance(v[0], list):
        if any(len(r) != 1 for r in v):
            raise ParseError("a vector is written [1, 2, 3]")
        v = [r[0] for r in v]
    if not isinstance(v, list) or not v or any(isinstance(x, list) or getattr(x, "free_symbols", None) for x in v):
        raise ParseError("a vector is written [1, 2, 3]")
    return v


def _sym(rows: List[List[Any]]) -> sp.Matrix:
    return sp.Matrix(rows)


def _frac(rows: List[List[Any]]) -> List[List[Fraction]]:
    out = []
    for r in rows:
        row = []
        for v in r:
            if not (isinstance(v, sp.Basic) and v.is_Rational):
                raise NotApplicable("entries are not rational")
            row.append(Fraction(int(v.p), int(v.q)))
        out.append(row)
    return out


def _np(rows: List[List[Any]]) -> np.ndarray:
    return np.array([[complex(sp.N(v, 30)) for v in r] for r in rows], dtype=complex)


def _square(rows) -> None:
    if len(rows) != len(rows[0]):
        raise ParseError("the matrix must be square")


# ---- exact rational elimination (shares no code with SymPy) -----------------------------
def _eliminate(M: List[List[Fraction]]) -> Tuple[List[List[Fraction]], int, int]:
    """Row-reduce a copy; returns (reduced, rank, row-swap parity sign)."""
    M = [r[:] for r in M]
    rows, cols = len(M), len(M[0])
    rank, sign, r = 0, 1, 0
    for c in range(cols):
        piv = next((i for i in range(r, rows) if M[i][c] != 0), None)
        if piv is None:
            continue
        if piv != r:
            M[r], M[piv] = M[piv], M[r]
            sign = -sign
        for i in range(r + 1, rows):
            if M[i][c] != 0:
                f = M[i][c] / M[r][c]
                M[i] = [a - f * b for a, b in zip(M[i], M[r])]
        r += 1
        rank += 1
        if r == rows:
            break
    return M, rank, sign


def _f_det(rows) -> Fraction:
    M, rank, sign = _eliminate(_frac(rows))
    if rank < len(M):
        return Fraction(0)
    d = Fraction(sign)
    for i in range(len(M)):
        d *= M[i][i]
    return d


def _f_rank(rows) -> int:
    return _eliminate(_frac(rows))[1]


def _f_inverse(rows) -> List[List[Fraction]]:
    A = _frac(rows)
    n = len(A)
    aug = [A[i] + [Fraction(int(i == j)) for j in range(n)] for i in range(n)]
    for c in range(n):
        piv = next((i for i in range(c, n) if aug[i][c] != 0), None)
        if piv is None:
            raise NotApplicable("matrix is singular")
        aug[c], aug[piv] = aug[piv], aug[c]
        aug[c] = [v / aug[c][c] for v in aug[c]]
        for i in range(n):
            if i != c and aug[i][c] != 0:
                f = aug[i][c]
                aug[i] = [a - f * b for a, b in zip(aug[i], aug[c])]
    return [r[n:] for r in aug]


def _f_solve(rows, vec) -> List[Fraction]:
    A = _frac(rows)
    b = _frac([[v] for v in vec])
    n = len(A)
    if len(b) != n:
        raise ParseError("vector length must equal the number of rows")
    aug = [A[i] + [b[i][0]] for i in range(n)]
    for c in range(n):
        piv = next((i for i in range(c, n) if aug[i][c] != 0), None)
        if piv is None:
            raise NotApplicable("matrix is singular: no unique solution")
        aug[c], aug[piv] = aug[piv], aug[c]
        aug[c] = [v / aug[c][c] for v in aug[c]]
        for i in range(n):
            if i != c and aug[i][c] != 0:
                f = aug[i][c]
                aug[i] = [a - f * bb for a, bb in zip(aug[i], aug[c])]
    return [aug[i][n] for i in range(n)]


def _f_matmul(a, b) -> List[List[Fraction]]:
    A, B = _frac(a), _frac(b)
    if len(A[0]) != len(B):
        raise ParseError("inner dimensions differ")
    return [[sum(A[i][k] * B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]


# ---- comparison / display -------------------------------------------------------------
def _same_scalar(x: Any, y: Any) -> bool:
    if is_exact(x) and is_exact(y):
        return to_fraction_exact(x) == to_fraction_exact(y)
    if isinstance(x, (np.generic, float, complex)) or isinstance(y, (np.generic, float, complex)):
        return close(complex(x) if not isinstance(x, sp.Basic) else to_mp(x),
                     complex(y) if not isinstance(y, sp.Basic) else to_mp(y), LOOSE)
    return close(x, y, LOOSE)


def _cells(m: Any) -> List[List[Any]]:
    if isinstance(m, sp.MatrixBase):
        return [[m[i, j] for j in range(m.cols)] for i in range(m.rows)]
    if isinstance(m, np.ndarray):
        return [[complex(v) for v in row] for row in np.atleast_2d(m)]
    return m


def _same_matrix(x: Any, y: Any) -> bool:
    X, Y = _cells(x), _cells(y)
    if len(X) != len(Y) or len(X[0]) != len(Y[0]):
        return False
    return all(_same_scalar(a, b) for r, s in zip(X, Y) for a, b in zip(r, s))


def _show_matrix(m: Any) -> str:
    rows = _cells(m)
    return "[" + ", ".join("[" + ", ".join(describe_number(v, 12).split("  ")[0] for v in r) + "]" for r in rows) + "]"


def _a(a: Dict[str, Any]) -> List[List[Any]]:
    return parse_matrix(a["matrix"])


# --------------------------------------------------------------------------- determinant
def _det_checks_square(a):  # noqa: ANN001
    _square(_a(a))


def _det_sympy(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    return sp.simplify(_sym(rows).det())


def _det_frac(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    return _f_det(rows)


def _det_np(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    return complex(np.linalg.det(_np(rows)))


REGISTRY.add(Operation(
    "determinant", "Determinant of a square matrix",
    [Method("sympy-det", "sympy", _det_sympy), Method("rational-elimination", "fractions", _det_frac),
     Method("numpy-lu", "numpy", _det_np)],
    same=_same_scalar, show=describe_number))


# --------------------------------------------------------------------------- rank
def _rank_sympy(a):  # noqa: ANN001
    return _sym(_a(a)).rank()


def _rank_frac(a):  # noqa: ANN001
    return _f_rank(_a(a))


def _rank_np(a):  # noqa: ANN001
    return int(np.linalg.matrix_rank(_np(_a(a))))


REGISTRY.add(Operation(
    "rank", "Rank of a matrix",
    [Method("sympy-rank", "sympy", _rank_sympy), Method("rational-elimination", "fractions", _rank_frac),
     Method("numpy-svd", "numpy", _rank_np)], same=lambda x, y: int(x) == int(y), show=str))


# --------------------------------------------------------------------------- inverse
def _inv_sympy(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    M = _sym(rows)
    if M.det() == 0:
        raise NotApplicable("matrix is singular")
    return M.inv().applyfunc(sp.simplify)


def _inv_frac(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    return _f_inverse(rows)


def _inv_np(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    return np.linalg.inv(_np(rows))


def _check_inverse(a: Dict[str, Any], inv: Any) -> Tuple[bool, str]:
    M = _sym(_a(a))
    I = sp.Matrix(_cells(inv)) if not isinstance(inv, sp.MatrixBase) else inv
    if any(isinstance(v, complex) for v in I):
        return True, "numeric inverse: product check skipped"
    P = (M * I).applyfunc(sp.simplify)
    ok = P == sp.eye(M.rows)
    return ok, "A * inverse = identity (exact)"


def _inverse_caveat(a: Dict[str, Any], v: Any) -> List[str]:
    return []


REGISTRY.add(Operation(
    "inverse", "Inverse of a square matrix",
    [Method("sympy-inverse", "sympy", _inv_sympy), Method("rational-gauss-jordan", "fractions", _inv_frac),
     Method("numpy-inverse", "numpy", _inv_np)],
    checks=[Check("product-is-identity", _check_inverse)],
    same=_same_matrix, show=_show_matrix))


# --------------------------------------------------------------------------- eigenvalues
def _eig_sympy(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    ev = _sym(rows).eigenvals()
    flat = [v for k, m in ev.items() for v in [k] * int(m)]
    return sorted(flat, key=lambda z: (float(sp.re(sp.N(z))), float(sp.im(sp.N(z)))))


def _eig_np(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    vals = np.linalg.eigvals(_np(rows))
    return sorted(vals.tolist(), key=lambda z: (z.real, z.imag))


def _same_eigs(x: List[Any], y: List[Any]) -> bool:
    if len(x) != len(y):
        return False
    left = list(y)
    for v in x:
        for w in left:
            if close(to_mp(v) if not isinstance(v, complex) else mp.mpc(v), to_mp(w) if not isinstance(w, complex) else mp.mpc(w), mp.mpf(10) ** -6):
                left.remove(w)
                break
        else:
            return False
    return True


def _check_eig_det(a: Dict[str, Any], ev: List[Any]) -> Tuple[bool, str]:
    M = _sym(_a(a))
    lam = sp.Symbol("lam")
    charpoly = (M - lam * sp.eye(M.rows)).det()
    for v in set(ev):
        val = sp.sympify(v) if not isinstance(v, complex) else sp.Float(v.real, 30) + sp.I * sp.Float(v.imag, 30)
        r = charpoly.subs(lam, val)
        if sp.simplify(r) != 0 and abs(complex(sp.N(r, 30))) > 1e-6 * max(1, abs(complex(sp.N(val, 30)))) ** M.rows:
            return False, f"det(A - lam I) is not zero at lam = {v}"
    return True, "det(A - lam*I) = 0 for every eigenvalue"


def _check_eig_trace(a: Dict[str, Any], ev: List[Any]) -> Tuple[bool, str]:
    M = _sym(_a(a))
    tot = sum((to_mp(v) if not isinstance(v, complex) else mp.mpc(v)) for v in ev)
    return close(tot, to_mp(M.trace()), mp.mpf(10) ** -6), "sum of eigenvalues equals the trace"


REGISTRY.add(Operation(
    "eigenvalues", "Eigenvalues with multiplicity",
    [Method("sympy-eigenvals", "sympy", _eig_sympy), Method("numpy-eig", "numpy", _eig_np)],
    checks=[Check("characteristic-polynomial", _check_eig_det), Check("trace", _check_eig_trace)],
    same=_same_eigs, show=lambda v: "[" + ", ".join(describe_number(x if not isinstance(x, complex) else mp.mpc(x), 12) for x in v) + "]"))


# --------------------------------------------------------------------------- linear solve
def _ls_args(a):  # noqa: ANN001
    rows = _a(a); _square(rows)
    vec = parse_vector(a["vector"])
    if len(vec) != len(rows):
        raise ParseError("vector length must equal the number of rows")
    return rows, vec


def _ls_sympy(a):  # noqa: ANN001
    rows, vec = _ls_args(a)
    M = _sym(rows)
    if M.det() == 0:
        raise NotApplicable("singular matrix: no unique solution")
    return list(M.LUsolve(sp.Matrix(vec)))


def _ls_frac(a):  # noqa: ANN001
    rows, vec = _ls_args(a)
    return _f_solve(rows, vec)


def _ls_np(a):  # noqa: ANN001
    rows, vec = _ls_args(a)
    return np.linalg.solve(_np(rows), np.array([complex(sp.N(v, 30)) for v in vec])).tolist()


def _same_vec(x: List[Any], y: List[Any]) -> bool:
    return len(x) == len(y) and all(_same_scalar(p, q) for p, q in zip(x, y))


def _check_ls(a: Dict[str, Any], x: List[Any]) -> Tuple[bool, str]:
    rows, vec = _ls_args(a)
    if any(isinstance(v, complex) for v in x):
        return True, "numeric solution: exact residual skipped"
    xs = [sp.Rational(v.numerator, v.denominator) if isinstance(v, Fraction) else v for v in x]
    res = (sp.Matrix(rows) * sp.Matrix(xs) - sp.Matrix(vec)).applyfunc(sp.simplify)
    return all(r == 0 for r in res), "A * x = b holds exactly"


REGISTRY.add(Operation(
    "linsolve", "Solve A x = b for a square, non-singular A",
    [Method("sympy-lu", "sympy", _ls_sympy), Method("rational-gauss-jordan", "fractions", _ls_frac),
     Method("numpy-solve", "numpy", _ls_np)],
    checks=[Check("residual-is-zero", _check_ls)],
    same=_same_vec,
    show=lambda v: "[" + ", ".join(describe_number(x if not isinstance(x, complex) else mp.mpc(x), 12) for x in v) + "]"))


# --------------------------------------------------------------------------- product
def _mm_sympy(a):  # noqa: ANN001
    A, B = parse_matrix(a["matrix"]), parse_matrix(a["matrix2"])
    if len(A[0]) != len(B):
        raise ParseError("inner dimensions differ")
    return (_sym(A) * _sym(B)).applyfunc(sp.simplify)


def _mm_frac(a):  # noqa: ANN001
    return _f_matmul(parse_matrix(a["matrix"]), parse_matrix(a["matrix2"]))


def _mm_np(a):  # noqa: ANN001
    A, B = parse_matrix(a["matrix"]), parse_matrix(a["matrix2"])
    if len(A[0]) != len(B):
        raise ParseError("inner dimensions differ")
    return _np(A) @ _np(B)


REGISTRY.add(Operation(
    "matmul", "Matrix product A * B",
    [Method("sympy-product", "sympy", _mm_sympy), Method("rational-product", "fractions", _mm_frac),
     Method("numpy-product", "numpy", _mm_np)],
    same=_same_matrix, show=_show_matrix))
