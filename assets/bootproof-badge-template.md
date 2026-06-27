# BootProof Badge Templates

Copy-paste these into your README. Every badge links to a Living Receipt —
a self-contained HTML file that re-verifies its own signature in the browser
and replays the actual boot. No install, no network, no account.

## The badge (booted)

```markdown
[![bootproof](https://img.shields.io/badge/bootproof-%E2%9C%93%20booted-0E9D5B?style=flat-square&labelColor=16181D)](./proof.bootproof.html)
```

Renders as: [![bootproof](https://img.shields.io/badge/bootproof-%E2%9C%93%20booted-0E9D5B?style=flat-square&labelColor=16181D)](./proof.bootproof.html)

## The badge (not booted — honest failure)

```markdown
[![bootproof](https://img.shields.io/badge/bootproof-%E2%9C%97%20not%20booted-D6453D?style=flat-square&labelColor=16181D)](./proof.bootproof.html)
```

Renders as: [![bootproof](https://img.shields.io/badge/bootproof-%E2%9C%97%20not%20booted-D6453D?style=flat-square&labelColor=16181D)](./proof.bootproof.html)

## How to generate your receipt

```bash
# Install (or use npx — no install required)
npm install -g bootproof

# Boot your repo and generate the receipt
bootproof up .

# The receipt is written to .bootproof/attestation.json
# Render it as a Living Receipt HTML:
node scripts/build_living_receipt.mjs .bootproof/attestation.json --out proof.bootproof.html

# Commit both the receipt and the badge to your repo
git add proof.bootproof.html
git commit -m "Add bootproof Living Receipt"
```

## What the badge proves

When someone clicks your badge, they download `proof.bootproof.html` and open it.
Their browser:

1. **Verifies the ed25519 signature** — proving the receipt hasn't been altered since signing.
2. **Replays the actual boot** — the real commands, the real log, the real HTTP response (or the real failure).
3. **Shows the trust level** — `local_developer_signed` (you ran it) up to `neutral_runner_signed` (BootProof's hosted verifier ran it).

A green check that survives tampering would defeat the entire premise. If a single byte of the signed message is altered, the verdict collapses to `VERDICT UNVERIFIED — SIGNATURE INVALID`.

## The loop

Every badge in the wild is a link. Every receipt is a self-proving advertisement.
Every click is a developer asking "what is this?" — and the answer is the product.

```
badge in README → click → Living Receipt opens → verifies itself →
  "Get your own receipt" → npx bootproof up → new badge in a new README → repeat
```

This is the distribution engine. It is not the moat — the moat is workflow lock-in
(the merge gate) and a compounding boot-inference flywheel, both earned at scale.
The badge is how you get to scale.
