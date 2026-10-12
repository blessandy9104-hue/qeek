"""Command line: mathcore "solve x^2 - 5x + 6 = 0"   (no network, no API key)."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .orchestrator import Orchestrator
from .framework import REGISTRY

DEFAULT_AUDIT = Path(os.environ.get("MATHCORE_AUDIT", Path.home() / ".mathcore" / "audit.jsonl"))


def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        prog="mathcore",
        description="Verified local mathematics. Nothing is released unless independent checks agree.",
        epilog="commands: check <question> <claimed answer> | ops | verify-log | repl | mcp   (anything else is a request)")
    p.add_argument("rest", nargs="*", help="a request such as \"derivative of x^3 sin(x)\", or a command")
    p.add_argument("--json", action="store_true", help="structured output for programs and AI agents")
    p.add_argument("--audit", default=str(DEFAULT_AUDIT), help="audit log path (hash chained)")
    p.add_argument("--seconds", type=float, default=20.0, help="time budget per method")
    args = p.parse_args(argv)
    commands = {"check", "ops", "verify-log", "repl", "mcp"}
    args.cmd = args.rest[0] if args.rest and args.rest[0] in commands else None
    args.request = args.rest if args.cmd is None else []
    orch = Orchestrator(args.audit, args.seconds)
    if args.cmd == "check":
        if len(args.rest) != 3:
            p.error("usage: mathcore check <question> <claimed answer>")
        args.question, args.claimed = args.rest[1], args.rest[2]

    if args.cmd == "ops":
        for name, doc in REGISTRY.describe().items():
            print(f"{name:14} {doc}")
        return 0
    if args.cmd == "verify-log":
        ok, msg = orch.audit.verify()
        print(("OK: " if ok else "TAMPERED: ") + msg)
        return 0 if ok else 2
    if args.cmd == "mcp":
        from .mcp_server import main as serve
        return serve()
    if args.cmd == "check":
        v = orch.check(args.question, args.claimed)
        print(json.dumps(vars(v), indent=2) if args.json else f"{v.verdict}: {v.detail}" + (f"\n    verified answer: {v.verified_answer}" if v.verified_answer else ""))
        return 0 if v.verdict == "MATCH" else 1
    if args.cmd == "repl" or not args.request:
        if not sys.stdin.isatty() and not args.request and args.cmd != "repl":
            text = sys.stdin.read()
            print(orch.answer(text))
            return 0
        print("mathcore - type a request, blank line to quit")
        while True:
            try:
                line = input("> ").strip()
            except EOFError:
                return 0
            if not line:
                return 0
            print(orch.answer(line), "\n")
    text = " ".join(args.request)
    if args.json:
        print(json.dumps(orch.for_ai(text), indent=2))
        return 0
    out = orch.answer(text)
    print(out)
    return 0 if not out.startswith("WITHHELD") else 1


if __name__ == "__main__":
    raise SystemExit(main())
