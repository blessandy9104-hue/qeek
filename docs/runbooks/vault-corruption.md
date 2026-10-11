# Runbook: Vault Corruption / Lost Notes

## Symptoms
- `memory_read_note` fails on known notes
- `vault_search` returns 0 results for existing content
- Graph shows sudden orphan spike

## Diagnosis
1. `ls knowledge-vault/*.md | head` — files present?
2. `git -C knowledge-vault status` (if vault is a git repo).
3. Check disk: `df -h`; check permissions: `ls -la knowledge-vault`.

## Resolution
```bash
# 1. Stop writers
# 2. Restore from git backup
git -C knowledge-vault log --oneline -5
git -C knowledge-vault restore --source=HEAD -- .
# 3. Force reindex (search plugin reindexes every 5 min; restart to force)
# 4. Verify
ls knowledge-vault/*.md | wc -l
```

## Prevention
- Keep `knowledge-vault/` as a git repo with auto-commit hook (`.husky/pre-commit`).
- Daily encrypted backup to configured remote.
- `qeek-search` file watcher + integrity re-scan every 5 minutes.
