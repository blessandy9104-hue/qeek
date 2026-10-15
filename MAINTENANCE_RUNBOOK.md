# One-page maintenance runbook

This runbook is a single-page quick guide for maintainers: who to contact, how to triage, and release steps.

Immediate contacts
- Primary maintainer: Andy (@blessandy9104-hue) — blessandy9104@gmail.com

Triage quick steps
1. Broken CI
   - Check the failing workflow run on the GitHub Actions page.
   - Click the failing job, read the logs, and copy the last 200 lines into the issue/PR comment.
   - If it's a flaky test, re-run the job; if it fails deterministically, assign and label `ci:broken`.
   - If the break is due to dependency updates, open a `deps` issue with the failing stack trace and mark priority.

2. Security alert (Dependabot / Trivy / pip-audit)
   - If Dependabot opens a PR: review, run tests, and merge if safe — otherwise mark `security` and escalate.
   - For critical CVEs: create an issue with `security:critical`, patch immediately, and prepare a hotfix release.
   - Notify stakeholders and record the CVE and remediation steps in the issue.

3. Vulnerable third-party action or image
   - Replace or pin to a fixed-version action/image.
   - Re-run CI and verify no regressions.

Release checklist (for a minor/patch release)
- Merge all PRs destined for the release into main.
- Ensure release-drafter has updated the draft (it runs automatically on merges).
- Run the nightly workflow locally or trigger the release workflow to ensure CI passes.
- Create the release by tagging main (e.g., git tag vX.Y.Z && git push --tags).
- The publication workflow will run (if configured) and publish a GitHub release.
- Announce the release in the project README and close the milestone.

Emergency hotfix
- Create a branch `hotfix/<short-desc>` from main, apply minimal fix, run tests locally.
- Open PR with `hotfix` label and request an expedited review.
- Once merged, tag and push the hotfix release.

Misc
- Add the person who triaged the issue to the issue notifications.
- Keep a one-line daily maintenance log in `MAINTENANCE_LOG.md` (optional).

30/60/90 day prioritized plan

30-day (stabilize & automation)
- Enable Dependabot (this PR) and monitor initial PRs.
- Add CODEOWNERS and MAINTAINERS.md (this commit).
- Run the nightly workflow and fix immediate test/flake failures.
- Identify top 10 plugins/tools by usage and mark core vs optional.

60-day (quality & developer DX)
- Add auto-merge rules for safe patches (minor/patch).
- Provide a reproducible dev environment (devcontainer or Docker compose) for contributors.
- Harden test coverage for core components (mathcore API contracts, plugin host)

90-day (release & adoption)
- Cut v0.1.0 stable release for the core feature set.
- Improve docs, onboarding guide, and a “first-time contributor” issue list.
- Start a small outreach: tweet/announce and gather early users for feedback.
