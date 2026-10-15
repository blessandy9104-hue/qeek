# Maintainers and how to reach them

Primary maintainer
- Andy (GitHub: @blessandy9104-hue) — author and primary contact: blessandy9104@gmail.com

Roles
- Code owner / core reviewer: @blessandy9104-hue
- CI and release owner: @blessandy9104-hue
- Security contact: @blessandy9104-hue

Triage process
1. New issue or alert is created (GitHub Issue, Dependabot PR, or CI failure).
2. Owner triages: add label (bug/feature/security/needs-info), assign, and set milestone or priority.
3. If no response within 7 days, the issue is labeled `stale` and pinged in the next maintenance pass.

On-call & escalation
- For broken CI: owner (above) is primary; if unresponsive, open an issue with label `ci:urgent` and assign to a backup maintainer (add here if you want a backup contact).
- For security/vulnerabilities: open a private issue/secret if necessary and follow the security checklist in MAINTENANCE_RUNBOOK.md.

Contribution guidelines for maintainers
- Keep PRs small and focused (one area per PR).
- Document breaking changes in CHANGELOG and in migration notes.
- When deprecating an API or plugin, add a `DEPRECATION.md` note and a 2-release notice.
