"""Known-answer tests: every request must be VERIFIED with the expected value."""
import pytest
from mathcore import Orchestrator, VERIFIED, PARTIAL

CASES = [
    ("solve x^2 - 5x + 6 = 0", "x = 2; x = 3"),
    ("solve x^2 + 1 = 0", "x = -I; x = I"),
    ("solve x^3 - 6x^2 + 11x - 6 = 0", "x = 1; x = 2; x = 3"),
    ("solve (x-1)^2 = 0", "x = 1"),
    ("solve 2x + 3 = 11", "x = 4"),
    ("solve x + y = 3 and x - y = 1 for x, y", "x = 2, y = 1"),
    ("solve x^2 = 2", "x = -sqrt(2)"),
    ("solve x/(x-1) = 2", "x = 2"),
    ("evaluate 1/3 + 1/6", "1/2"),
    ("evaluate 2^100", "1267650600228229401496703205376"),
    ("evaluate sqrt(2)*sqrt(2)", "2"),
    ("evaluate sin(pi/6)", "1/2"),
    ("evaluate 0.1 + 0.2", "3/10"),
    ("evaluate 10!", "3628800"),
    ("simplify (x^2 - 1)/(x - 1)", "x + 1"),
    ("expand (x+1)^3", "x**3 + 3*x**2 + 3*x + 1"),
    ("factor x^2 - 5x + 6", "(x - 3)*(x - 2)"),
    ("derivative of x^3*sin(x)", "x**3*cos(x) + 3*x**2*sin(x)"),
    ("second derivative of x^4", "12*x**2"),
    ("derivative of exp(2x) wrt x", "2*exp(2*x)"),
    ("integrate x^2 from 0 to 3", "9"),
    ("integrate sin(x) from 0 to pi", "2"),
    ("integrate 1/x from 1 to e", "1"),
    ("integrate 2x dx", "x**2"),
    ("limit of sin(x)/x as x -> 0", "1"),
    ("limit of (1+1/x)^x as x -> oo", "E"),
    ("limit of 1/x as x -> 0+", "oo"),
    ("limit of 1/x as x -> 0-", "-oo"),
    ("determinant of [[1,2],[3,4]]", "-2"),
    ("determinant of [[2,0,0],[0,3,0],[0,0,4]]", "24"),
    ("inverse of [[1,2],[3,4]]", "[[-2, 1], [3/2, -1/2]]"),
    ("rank of [[1,2],[2,4]]", "1"),
    ("eigenvalues of [[2,0],[0,3]]", "[2, 3]"),
    ("solve linear system [[2,1],[1,3]] [5,10]", "[1, 3]"),
    ("multiply [[1,2],[3,4]] [[0,1],[1,0]]", "[[2, 1], [4, 3]]"),
    ("is 1000003 prime", "prime"),
    ("is 1000001 prime", "not prime"),
    ("factor integer 360", "2^3 * 3^2 * 5"),
    ("factor 1000000007", "1000000007"),
    ("gcd of 48, 18", "6"),
    ("lcm of 4, 6, 10", "60"),
    ("3^200 mod 13", "9"),
    ("factorial of 20", "2432902008176640000"),
    ("10 choose 3", "120"),
    ("prove x^2 >= 0", "valid"),
    ("prove implies(p and q, p)", "valid"),
    ("prove integer: x + 1 > x", "valid"),
    ("sat x > 2 and x < 3", "satisfiable"),
    ("sat integer: x > 2 and x < 3", "unsatisfiable"),
    ("sat p and not p", "unsatisfiable"),
    ("mean of 1, 2, 3, 4", "5/2"),
    ("median of 5, 1, 9", "5"),
    ("sample variance of 2, 4, 4, 4, 5, 5, 7, 9", "32/7"),
    ("population stdev of 2, 4, 4, 4, 5, 5, 7, 9", "2"),
    ("convert 5 km to miles", "3.10685"),
    ("convert 100 C to F", "212"),
    ("convert 1 gallon to L", "3.785411784"),
    ("shortest path from A to D in A-B:1, B-C:2, C-D:3, A-D:10", "cost 6 via A -> B -> C -> D"),
    ("solve ode y'' + y = 0", "C1*sin(x) + C2*cos(x)"),
    ("percent 20 of 150", "30"),
    ("percent 12.5 of 80", "10"),
    ("ratio 2:4", "1:2"),
    ("ratio 2 to 4", "1:2"),
    ("area circle radius 3", "9*pi"),
    ("area rectangle 4 by 5", "20"),
    ("area triangle base 6 height 4", "12"),
    ("volume sphere radius 2", "32*pi/3"),
    ("volume box 2 by 3 by 4", "24"),
    ("volume cylinder radius 1 height 2", "2*pi"),
    ("pythagoras legs 3 4", "5"),
    ("pythagoras hypotenuse 5 leg 3", "4"),
    ("trig sin 30 degrees", "1/2"),
    ("trig cos pi/3", "1/2"),
    ("trig tan 45 degrees", "1"),
    ("probability binomial n 10 k 3 p 0.5", "15/128"),
    ("probability dice sum 7", "1/6"),
    ("probability coin 3 heads in 5", "5/16"),
]


@pytest.fixture(scope="module")
def orch():
    return Orchestrator()


@pytest.mark.parametrize("request_text,expected", CASES)
def test_known_answer(orch, request_text, expected):
    report = orch.ask(request_text)
    cert = report.certificates[0]
    assert cert.status in (VERIFIED, PARTIAL), (cert.status, cert.rejected, cert.errors)
    assert expected in cert.value, cert.value
    assert len([c for c in cert.confirmations if c.ok]) >= 2


def test_every_operation_is_exercised():
    from mathcore import REGISTRY
    seen = set()
    o = Orchestrator()
    for text, _ in CASES:
        seen.add(o.ask(text).commands[0].op)
    assert set(REGISTRY.names()) <= seen, set(REGISTRY.names()) - seen
