# Distribution Scoreboard

Defined 2026-07-03 after the Marketplace listing went live. The metric this listing feeds is **strangers' workflow files containing `uses: bootproof/receipt-gate@v1`** — searchable on GitHub code search, visible over time in the repo's dependents graph. That number is currently zero, honestly recorded. It's the wild-receipt counter, the only review of this product that can't be flattered.

## Current count

| Date | Count | Evidence |
|------|-------|----------|
| 2026-07-03 | 0 | GitHub code search for `uses: bootproof/receipt-gate@v1` returns zero results from strangers (excluding bootproof org repos) |

## Verification method

```bash
# Search GitHub code for stranger adoption (run periodically)
gh search code "uses: bootproof/receipt-gate@v1" --limit 50
# Exclude results from bootproof/bootproof and bootproof/receipt-gate (self-use)
# Count the remainder
```

Or via the web: https://github.com/search?q=%22uses%3A+bootproof%2Freceipt-gate%40v1%22&type=code

## What moves this number

Every remaining go-to-market move exists to move this off zero:
- The 60-second GIF (keystroke 4) — the hero image of the Marketplace storefront
- The HN recovery email + repost
- The two receipt-bearing emails per evening starting with Airbyte
- Awesome-list PRs (awesome-actions, awesome-claude-code, awesome-ai-agents)
- The dev.to / Hashnode write-up

## Status codes

- `0` — no stranger adoption yet (current state, honestly recorded)
- `1` — one stranger workflow file found (the first wild receipt — infinite improvement over zero)
- `N` — N stranger workflow files found

A non-adoption is `absence_of_signal`, not `rejected`. Fail closed on claims, never on morale.
