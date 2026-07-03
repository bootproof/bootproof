# Outreach Log

Tracking receipt-first outreach per the Distribution Kit. One row per send.

## Distribution milestones (attempt → defined observable → external verification → recorded)

| Date | Step | Observable defined | External verification | Recorded |
|------|------|-------------------|----------------------|----------|
| 2026-06-27 | Show HN post | None defined (skipped) | Not verified (likely auto-killed) | Misrecorded as rejection |
| 2026-07-02 | First Marketplace attempt (description >125 chars) | URL returns 200 | Not verified before claiming success | Misrecorded as success |
| 2026-07-03 | Marketplace listing live | URL `github.com/marketplace/actions/receipt-gate` flips from 404 to 200 | Verified from outside, logged-out, by third party — HTTP 200, title "Receipt Gate · Actions · GitHub Marketplace", owner `bootproof`, categories `continuous-integration` + `security` | Recorded honestly ✅ |
| 2026-07-03 | npm publish with provenance (0.4.1) | `npm view bootproof version` returns `0.4.1` AND `npm view bootproof@0.4.1 dist.attestations` returns a non-null URL | `npm view bootproof version` → `0.4.1`; `npm view bootproof@0.4.1 dist.attestations` → `https://registry.npmjs.org/-/npm/v1/attestations/bootproof@0.4.1` (Sigstore-backed provenance present); release workflow run `28658700043` conclusion=success | Recorded honestly ✅ |
| 2026-07-03 | BootProof advisory action Marketplace listing | `github.com/marketplace/actions/bootproof` flips from 404 to 200 | HTTP 200, title "BootProof", owner `bootproof`. Root cause of prior failure: action.yml had a YAML syntax error (unquoted colon in ci-oidc description) that prevented GitHub from detecting the repo as a valid Action. Fixed in commit `7a9bb66`, v1 tag force-updated, release recreated. | Recorded honestly ✅ |

This last row is the template for every remaining go-to-market step: define the observable before attempting, verify externally after, record honestly regardless of outcome.

## Receipt-first outreach log

| Date | Target | Template | Repo tested | Result (clean boot / honest refusal) | Reply | Outcome |
|------|--------|----------|-------------|--------------------------------------|-------|---------|
| 2026-07-03 | Airbyte (security@airbyte.io) | B | airbytehq/airbyte | Honest refusal: orchestration_not_supported (needs abctl/kind/helm) | sent | awaiting |
| 2026-07-03 | Daniel Stenberg (daniel@haxx.se) | A | curl/curl | Honest refusal: not_an_application (C library, no HTTP health endpoint) | sent | awaiting |

## Status codes

- `sent` — email sent, awaiting reply
- `replied` — human replied
- `no_reply` — no response after 14 days (absence_of_signal, not rejected)
- `adopted` — maintainer displayed the badge or integrated the gate
- `declined` — maintainer explicitly said no

A non-reply is `absence_of_signal`, not `rejected`. Fail closed on claims, never on morale.
