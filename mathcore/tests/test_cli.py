import json

from mathcore.cli import main


def run(capsys, *argv, tmp_path):
    code = main(["--audit", str(tmp_path / "a.jsonl"), *argv])
    return code, capsys.readouterr().out


def test_request_prints_verified_answer(capsys, tmp_path):
    code, out = run(capsys, "solve", "x^2", "-", "4", "=", "0", tmp_path=tmp_path)
    assert code == 0 and out.startswith("VERIFIED") and "x = -2; x = 2" in out


def test_withheld_exit_code(capsys, tmp_path):
    code, out = run(capsys, "evaluate 1/0", tmp_path=tmp_path)
    assert code == 1 and out.startswith("WITHHELD")


def test_json_for_ai(capsys, tmp_path):
    code, out = run(capsys, "--json", "evaluate 6*7", tmp_path=tmp_path)
    body = json.loads(out)
    assert code == 0 and body["all_verified"] and body["results"][0]["value"] == "42"


def test_check_command(capsys, tmp_path):
    code, out = run(capsys, "check", "evaluate 6*7", "41", tmp_path=tmp_path)
    assert code == 1 and "MISMATCH" in out and "42" in out
    code, out = run(capsys, "check", "evaluate 6*7", "42", tmp_path=tmp_path)
    assert code == 0 and out.startswith("MATCH")


def test_ops_and_verify_log(capsys, tmp_path):
    code, out = run(capsys, "ops", tmp_path=tmp_path)
    assert code == 0 and "solve" in out and "integrate" in out
    run(capsys, "evaluate 1+1", tmp_path=tmp_path)
    code, out = run(capsys, "verify-log", tmp_path=tmp_path)
    assert code == 0 and out.startswith("OK")
    p = tmp_path / "a.jsonl"
    p.write_text(p.read_text().replace("evaluate 1+1", "evaluate 2+2"))
    code, out = run(capsys, "verify-log", tmp_path=tmp_path)
    assert code == 2 and out.startswith("TAMPERED")


def test_stdin_request(capsys, tmp_path, monkeypatch):
    import io
    monkeypatch.setattr("sys.stdin", io.StringIO("evaluate 2^10"))
    code, out = run(capsys, tmp_path=tmp_path)
    assert code == 0 and "1024" in out
