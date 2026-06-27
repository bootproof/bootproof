# The First 1,000 Receipts — Launch Playbook

> Distribution is the engine; the moat is its exhaust.

This is the concrete, week-by-week plan for getting BootProof from zero to the first 1,000 Living Receipts in the wild. Every phase has a single success metric. If the metric doesn't hit, the phase isn't done — don't move on, fix why.

---

## The thesis (read this first)

The Living Receipt is not the moat. It is the **distribution weapon** — a viral, self-proving object that floods the gates with users. The moat (workflow lock-in as the merge gate, plus a compounding boot-inference flywheel) is **earned at scale**, not owned on day one.

The slop crisis is real and cresting: curl shut down its bug bounty (January 2026), Jazzband shut down entirely, tldraw auto-closes all external PRs, Ghostty's Mitchell Hashimoto named the exact mechanism BootProof attacks ("running it was the filter"). The demand is assembled and screaming. The audience is not cold — they are posting in GitHub community discussion #185387, literally spec'ing the feature.

The only thing standing between BootProof and 1,000 receipts is the single thing every prior project skipped: **shipping and distributing**. This playbook exists to make that skip impossible.

---

## Phase 0 — Ship the alpha (TODAY, before anything else)

**Goal:** a stranger can `npx bootproof up <repo>` and get a Living Receipt.

**Checklist:**
- [x] Fix the npm package metadata (homepage/repository fields point to the wrong URL — `rossbuckley1990-hash/bootproof` instead of `bootproof/bootproof`). This is a 5-minute fix that has been leaking every visitor. **Fixed in commit on `main` — `repository`, `bugs.url`, and `homepage` now all point to `github.com/bootproof/bootproof`. The published npm package at `0.1.0` still has the old URL until 0.3.0 is published (next item).**
- [ ] Publish `0.3.0` to npm. The published version is `0.1.0`; the repo is three minor versions ahead. The publishing muscle exists — the release cadence is broken. **Requires `npm publish` with npm credentials — run locally, not from a CI/sandbox. The `release:check` script (`npm test && npm run build && npm run pack:check && npm publish --dry-run`) is the pre-flight.**
- [x] The Living Receipt HTML (`assets/living-receipt.html`) is on `main` and reachable via raw.githubusercontent.com.
- [x] The badge template (`assets/bootproof-badge-template.md`) is on `main`.
- [x] The README links to the Living Receipt with a clickable badge.

**Success metric:** `npx bootproof up https://github.com/any-public-repo` works on a fresh machine with Node 20+. No errors. Writes a receipt.

**If this doesn't work, nothing else in this playbook matters.** Do not proceed to Phase 1 until a stranger can run the command and get a receipt.

---

## Phase 1 — Maintainer #1 (Week 1)

**Goal:** one prominent open-source maintainer adopts BootProof as a PR gate.

**Why this first:** the slop-crisis maintainers are the exact audience, they're already gathered, and one public adoption is the equivalent of Slack's "8,000 signups in 24 hours" — but slower, over weeks, because maintainer-to-maintainer viral spread is real but skeptical.

**The target list (in priority order):**

1. **The GitHub community discussion #185387 participants.** This is the single highest-signal list. People who posted in "Exploring Solutions to Tackle Low-Quality Contributions on GitHub" are literally asking for this. Read the thread, identify the most active commenters, DM them with the receipt attached.

2. **The curl orbit.** Daniel Stenberg shut down curl's bug bounty in January 2026 because AI slop reports collapsed the valid-rate from 1-in-6 to 1-in-20. BootProof is the automated version of "did you actually run it?" — exactly the filter he lost. He is reachable on GitHub and Mastodon.

3. **The Ghostty orbit.** Mitchell Hashimoto named the exact mechanism ("running it was the filter") that BootProof re-imposes. He is reachable on GitHub.

4. **The tldraw orbit.** They auto-close all external PRs — the most extreme response to slop. A BootProof gate is the less drastic alternative they haven't tried yet.

5. **The six stargazers.** `serious-angel`, `jon91`, `highway900`, `mkkzkk`, `DoddiC`, `tkersey`. They already raised their hands. They're the warmest leads you have.

**The DM template (3 lines, attach the Living Receipt HTML):**

```
Hi [name] — I saw your [post/comment about AI slop in PRs]. I built
something that might help: a tool that actually boots a repo and signs
proof of what happened. I attached a Living Receipt — double-click it,
it verifies itself in your browser. If it's useful, I'd value your
honest reaction. If not, tell me why. — Ross
```

**Rules:**
- Do NOT lead with the architecture, the trust ladder, or the moat thesis. Lead with the artifact.
- Do NOT pitch the hosted runner, the enterprise tier, or the roadmap. Pitch the free thing.
- Do NOT send a form letter. Reference something specific they said about slop.
- Attach the Living Receipt HTML. The artifact does the convincing — your words just get them to open it.

**Success metric:** one maintainer runs `npx bootproof up` on a repo they care about and replies with a reaction that isn't "cool, thanks." The reaction you're looking for is "wait, how does this work?" or "can I use this as a PR gate?" — those are buying signals.

**If you don't get a reply from any of the six stargazers in 72 hours:** the problem isn't the message, it's that the artifact doesn't land. Go back and watch someone open it in person. The "what the hell" moment has to be visible on their face. If it isn't, the receipt isn't good enough yet.

---

## Phase 2 — The public launch (Week 2)

**Goal:** 100 receipts in the wild, traced to a single public launch.

**The launch surfaces, in order:**

### 2a. Hacker News (Tuesday or Wednesday, 7–9am Pacific)

**Title (use exactly this — it's been pressure-tested against the HN aesthetic):**

> Show HN: BootProof — the run button that can't lie (boots any repo, signs proof)

**First comment (yours, posted immediately):**

```
I built this because AI-generated PRs that merge clean but don't actually
boot are drowning maintainers. curl shut down its bug bounty over this.
tldraw auto-closes all external PRs. The filter that used to exist —
"you had to actually run the code to contribute" — is gone.

BootProof re-imposes it. Point it at any repo, it infers how to run,
boots it, observes whether localhost actually responds, and signs a
receipt. The receipt is a single HTML file that re-verifies its own
signature in your browser. Tamper with one byte and the verdict collapses.

Two real captures in the repo: one that boots to HTTP 200, one that
builds clean and segfaults at runtime. Both are real, not mock.

Free, open source, Apache 2.0. I'm looking for maintainers who want
to try it as a PR gate. — Ross
```

**Rules:**
- Do NOT post on Monday (low traffic) or Friday (weekend death).
- Do NOT post on the hour — post at :07 or :12 to avoid the submission queue.
- Do NOT use a link shortener. HN penalizes them.
- Respond to every comment within 15 minutes for the first 4 hours. The first hour determines whether it hits the front page.
- When someone says "why not just use CI?" — answer: "CI tells you the script exited 0. BootProof tells you localhost responded. Green CI, dead app is the entire slop archetype. Here's a receipt: [link]."

### 2b. r/programming (same day, 2 hours after HN)

Cross-post the HN link. Title: "BootProof — a run button that actually verifies your repo boots (signed proof, not green CI)".

### 2c. r/devops, r/node, r/rust, r/python (staggered over Week 2)

One post per subreddit, tailored to the language. For r/rust, lead with the segfault receipt. For r/node, lead with the HTTP 200 receipt. For r/devops, lead with the CI-gate angle.

### 2d. The agent-integration communities

Post in the Cursor Discord, the Claude Code community, the Devin Slack. The pitch: "your agent emits a Living Receipt when it finishes — the human verifies it actually booted before merging." This is the "App Store moment" distribution surface.

**Success metric:** 100 Living Receipts downloaded from the repo (track via GitHub raw file download analytics), 50 npm installs, 10 badges appearing in public READMEs (search GitHub for `bootproof` in README files).

**If HN doesn't hit the front page:** the title or the first comment didn't land. The most common failure mode is leading with the technology instead of the pain. Rewrite the first comment to lead with curl/tldraw, not with ed25519.

---

## Phase 3 — The agent integrations (Week 3)

**Goal:** BootProof is the default "does-it-boot" check in at least one agent ecosystem.

**The targets:**

1. **A Claude Code skill** — `bootproof-verify` — that an agent can invoke after writing code. The skill runs `bootproof up` on the changed workspace and attaches the Living Receipt to the PR. This is the highest-leverage integration because Claude Code users are the exact audience generating slop.

2. **A Cursor rule** — `.cursorrules` snippet that tells Cursor to run BootProof before declaring a task complete. Distribute as a copy-paste snippet in the README.

3. **A GitHub Action** — `bootproof/bootproof-action@v1` — that runs on every PR, boots the repo, and posts the Living Receipt as a comment. This is the merge-gate moat in its earliest form. Get it into the GitHub Actions marketplace. Be the top result for "boot" and "verify" and "run".

4. **A Devin integration** — reach out to the Devin team. Their agents produce code; BootProof proves it runs. Co-marketing opportunity.

**The pitch to agent builders:**

```
Your agent writes code and says "done." The human has to trust it.
BootProof makes the agent prove it — runs the repo, observes health,
signs a receipt. The human clicks the receipt, it verifies itself,
they see the actual boot. No more "the agent said it worked" — now
it's "the agent proved it boots."
```

**Success metric:** one agent integration shipped and used by at least 10 developers. The Claude Code skill is the most reachable — it's a single file.

---

## Phase 4 — The "Green CI, Dead App" gallery (Week 4+)

**Goal:** a public, indexed gallery of real slop PRs that pass CI but don't boot, each with its Living Receipt.

**This is the content engine.** Every entry is simultaneously:
- Proof (a real receipt)
- Propaganda (the contrast with GitHub's green check)
- Distribution (every receipt links home)

**How to build it:**

1. Find public PRs that pass CI but are reported as "doesn't work" in comments. Search GitHub for `"doesn't work"`, `"won't run"`, `"broken"` in PR comments on popular repos.
2. Run `bootproof up` on the PR's branch.
3. Generate a Living Receipt.
4. Post it to `gallery/` in the repo, with a one-line description: "PR #1234 on repo X — green CI, dead app, BootProof says NOT BOOTED with classified failure Y."
5. Each gallery entry has its own badge that links to its receipt.

**The viral loop:**

```
gallery entry → HN/Reddit/Twitter → click → Living Receipt →
  "Get your own receipt" → npx bootproof up → new receipt →
  new badge in a new README → new gallery entry → repeat
```

**Success metric:** 50 gallery entries, each one a real public slop PR with a real receipt. The gallery itself becomes a destination — "the slop museum."

---

## The loop that ties it all together

```
Phase 1: maintainer #1 (credibility)
   ↓
Phase 2: public launch (100 receipts in the wild)
   ↓
Phase 3: agent integrations (default-status in one ecosystem)
   ↓
Phase 4: gallery (compounding content engine)
   ↓
Each receipt → badge in a README → click → new user → new receipt → repeat
   ↓
Workflow lock-in (the merge gate) + boot-inference flywheel (each run makes the next inference better)
   ↓
The moat. Earned, not built.
```

---

## What NOT to do (the trap list)

1. **Do not build the hosted runner before Phase 4.** The `neutral_runner_signed` trust level is the cash-cow path, but it's premature. The free local-signed receipt is the distribution weapon. Build the hosted runner when you have 1,000 receipts and someone offers to pay for it.

2. **Do not build the failure-taxonomy dashboard before Phase 4.** The corpus becomes a moat only if each run feeds back into measurably better inference that users feel. Ship the inference improvement first; dashboard it later.

3. **Do not write a blog post about the architecture.** Write a blog post about curl shutting down its bug bounty. The architecture is not the story — the pain is.

4. **Do not rename anything.** "BootProof" is fine. "Living Receipt" is fine. The urge to rename is the cathedral instinct sneaking back in.

5. **Do not wait for the engine to be perfect before launching.** The engine in `scripts/bootproof_up.mjs` is MVP — it handles Node, Rust, Go, Python. That's enough for the first 1,000 receipts. Ship it. Add more stacks based on what users actually ask for.

6. **Do not skip the DM step.** The temptation is to go straight to HN and skip the maintainer-by-maintainer grind. That's the exact skip that has cost every prior launch. The DMs are where you learn whether the artifact lands. HN is where you scale what already works.

---

## The honest gate

None of this is real until **maintainer #1** runs it on a repo they care about and reacts. The Living Receipt in `assets/living-receipt.html` is the artifact. The DM template in Phase 1 is the message. The six stargazers are the warmest leads.

Open the receipt yourself first. Feel the "what the hell" moment. Then attach it to the first DM.

That's the move. Everything else in this playbook is downstream of it.
