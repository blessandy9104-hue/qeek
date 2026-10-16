# test-vault

Scratch Obsidian vault used by the Playwright e2e suite
(`ZOVELI_VAULT_PATH=./test-vault` in `playwright.config.ts`).

It exists in the repo so the vault watcher never logs ENOENT noise.
E2E runs may create and delete notes here; nothing in this directory is
meaningful — do not store real data in it.
