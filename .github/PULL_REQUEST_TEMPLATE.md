## What

<!-- One paragraph: what changes and why. -->

## Verification

<!-- Paste or link evidence. CI must be green (badge in README). -->

- [ ] `pnpm install` clean
- [ ] `pnpm run lint` — 0 warnings, 0 errors
- [ ] `pnpm run build` + `pnpm run typecheck` clean (strict)
- [ ] `pnpm test` green (unit)
- [ ] e2e green locally (`pnpm exec playwright test --project=chromium`) if UI/CLI touched

## Checklist

- [ ] No secrets, keys, or private vault notes included
- [ ] Docs updated (`docs/`, README counts, ADRs for decisions)
- [ ] New tools have unit tests + are registered in capability scanner docs where applicable
- [ ] New packages justified (core vs experimental — see `docs/core-plugins.md`)
