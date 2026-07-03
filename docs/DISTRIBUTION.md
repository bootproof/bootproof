# Distribution Kit v2

The first launch was never seen. HN auto-kills link posts from new accounts silently; Reddit automod filters new accounts before humans see them. The market has not said no — it has not been asked yet. This kit is the re-ask, through channels with no bouncer at the door.

**The one metric for the next 30 days: receipts in the wild that you did not generate.** Target: 10. Everything below exists to move that number.

---

## Part 1 — Recover Hacker News

1. Log out of HN (or set `showdead: yes` in your profile) and view the Show HN post. If it shows [dead], it was auto-killed and zero humans saw it.
2. Email the moderators. They are responsive, they vouch legitimate posts from new accounts, and they run a second-chance pool for good posts that sank unfairly.

> To: hn@ycombinator.com
> Subject: New account, Show HN appears auto-killed
>
> Hi — I posted a Show HN for my open-source project (link to the post) from a new account and I believe it was caught by the spam filter. It's a runtime verification tool for AI-generated code (github.com/bootproof/bootproof), genuinely my own work, Apache-2.0 licensed. Would appreciate a look — happy to answer anything. Thanks for what you do.

3. Before any repost: (a) the 60-second GIF exists and is the first thing in the README; (b) spend a week leaving genuinely useful comments on other threads so the account has history. Reposting a no-traction story is explicitly allowed.
4. Repost Tue–Thu, 14:00–16:00 UK (morning US). Title suggestion — note that plain "BootProof" collides in search with a football-boot bag brand, so lead with the claim, not the name:
   "Show HN: Signed receipts proving my AI agent's code actually runs"

---

## Part 2 — Receipt-First Outreach

The mechanic that no other product can copy: the email CONTAINS the proof, about THEIR repo. Process per target, ~20 minutes:

1. `bootproof up <their-repo> --provider local --unsafe-local --receipt`
2. Whatever happens is the opening line:
   - Boots clean → attach Living Receipt: "here's signed proof your repo boots from a fresh clone."
   - Honest refusal (like Airbyte) → even better story: "my tool refused to pretend it could boot your stack — here's the signed refusal."
3. Send. Short. No ask beyond "curious what you think." Never attach to a repo's issue tracker unless their contributing docs invite tooling discussion — email or their stated contact route only.

### Template A — maintainer publicly weary of AI slop

> Subject: Signed proof {repo} boots from a fresh clone (41s) — thought of your AI-slop posts
>
> Hi {name} — your writing about the burden of AI-generated {reports/PRs} is half the reason I built this. BootProof boots a repo under supervision and signs what it observed; no observed health signal, no green check. I ran it against {repo}: {one-sentence honest result}. The receipt is attached — it's a single HTML file that re-verifies its own signature in your browser, and visibly collapses if you tamper with a byte (there's a button).
>
> There's also a CI gate so agent PRs can't merge without an observed boot. If it's useless to you, that's a data point I want too. Either way — thanks for the writing.

### Template B — repo you already tested (Airbyte-class)

> Subject: Your repo, cryptographically refusing to lie about itself
>
> Hi — I built a runtime verifier and {repo} was one of my test cases. It {booted clean in Xs / correctly refused: your documented path needs {abctl/kind/helm}, and my tool declines to pretend a bare command is enough}. Signed receipt attached; it verifies itself offline. Sharing because the result is genuinely about your project, not mine. Would value 60 seconds of your reaction.

### Template C — agent-tool authors (Claude Code hooks, agent frameworks)

> Subject: A Stop-hook that makes agents hand over signed proof their work runs
>
> Hi — I wrote a hook for {tool}: when the agent claims "done," it boots the workspace under supervision and prints a signed verdict before the human reviews anything. Fails closed. One-liner config attached, receipt from a real run attached. If this fits your examples/integrations page, it's MIT — take it. If it's a bad fit, one line saying why helps me more than silence.

### First ten targets

1. Daniel Stenberg (curl) — has documented at length the burden of AI-generated junk reports. Template A.
2. Seth Larson (Python security) — has written publicly about AI-generated security reports. Template A.
3. The Airbyte team — you already have the honest-refusal receipt. Template B.
4–6. Every other repo in your test fixtures with a real maintainer. Template B — these are pre-written by work you already did.
7–8. Authors of the two most active Claude Code hook/plugin collections and awesome-lists (find via github.com/topics/claude-code). Template C.
9–10. Two authors of recent posts/threads complaining about AI PR slop — search "AI generated pull requests" on HN/lobste.rs from the last month; the authors of the top two write-ups. Template A, referencing their specific post.

Ship 2 per evening for a week. Log every send + result in [`OUTREACH_LOG.md`](../OUTREACH_LOG.md) — that log becomes your next Show HN ("What happened when I sent signed proof to 10 maintainers").

---

## Part 3 — Permissionless channels

- **GitHub Actions Marketplace**: publish receipt-gate. A form, not a lottery. Requires: repo public ✅, v1 tag ✅, branding block in action.yml ✅. This is the single highest-leverage hour on this list.
- **Repo topics**: added to both repos (ai-agents, ci, attestation, supply-chain, claude-code, verification, github-actions, sbom, ed25519, runtime-verification).
- **Awesome-list PRs**: awesome-actions, awesome-claude-code, awesome-ai-agents. A PR is a contribution, not a promotion; new accounts are not penalized.
- **dev.to / Hashnode write-up**: "My AI agent now hands me signed receipts" — the launch-kit Show HN body, expanded, GIF embedded. New authors are not filtered; posts rank in Google for months.
- **X/Bluesky without followers**: don't broadcast — quote-reply into active AI-code-slop threads with the tamper-demo GIF. Replies ride the host thread's audience; follower count irrelevant.
- **lobste.rs**: invite-only; one of your Part 2 replies is likely to be a user. Asking a warm contact for an invite is normal there.

---

## Part 4 — The math

A Show HN is one lottery ticket: high variance, one draw, bouncer at the door. Ten receipt-first emails are ten independent draws at a far higher hit rate with zero gatekeeping, and every reply compounds: a user, a quote for the README, a lobste.rs invite, an issue filed by a stranger. The front page is not the start of distribution; it's the victory lap after receipts already exist in the wild.

Rule for the log: a non-reply is `absence_of_signal`, not `rejected`. Fail closed on claims, never on morale.
