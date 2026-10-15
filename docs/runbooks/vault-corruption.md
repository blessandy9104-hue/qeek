# Runbook: Memory Store Corruption / Lost Notes

Source of truth is SQLite (`~/.zoveli/memory.db`, or `ZOVELI_MEMORY_DB`);
`knowledge-vault/` is an export mirror, not the data.

## Symptoms
- `memory_read_note` fails on known notes
- `vault_search` returns 0 results for existing content
- Graph shows sudden orphan spike

## Diagnosis
1. Is the DB present and writable? `ls -la ~/.zoveli/memory.db` (or `$ZOVELI_MEMORY_DB`).
2. Is the process using the DB you think? Check `ZOVELI_MEMORY_DB` and `ZOVELI_VAULT_PATH` env.
3. Check disk: `df -h`; check permissions on the DB file and vault dir.
4. Compare with the mirror: `ls knowledge-vault/*.md | head` — files present?

## Resolution
```bash
# 1. Stop writers (CLI/Web/Desktop)
# 2a. Restore the DB from backup (preferred: single file)
cp <backup>/memory.db ~/.zoveli/memory.db
# 2b. No DB backup? Rebuild from the git mirror (one-time import on empty DB)
rm -f ~/.zoveli/memory.db
pnpm start   # imports knowledge-vault/*.md automatically
# 3. Verify
# /tools -> memory_list_tags, vault_search for a known term
```

## Prevention
- Scheduled encrypted backup of `~/.zoveli/memory.db` (single file).
- Keep `knowledge-vault/` export mirror in git (recovery source of last resort).
- Daily encrypted backup to configured remote.
