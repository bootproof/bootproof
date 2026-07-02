# BootProof

## See BootProof in action

### 1. The “wow” moment: a serious stack, verified locally

BootProof is designed for the moment every developer knows: you find a serious open-source repo, clone it, and then spend the afternoon guessing how to make it run.

This demo shows BootProof treating a Supabase-style stack as something that must be **proved**, not assumed. It infers the stack, identifies the boot path, starts the services, verifies localhost health, and writes a signed attestation.

<p align="center">
  <img src="assets/bootproof-supabase-demo.gif" alt="BootProof demo verifying a Supabase-style stack" width="900">
</p>

**What this proves:** BootProof does not just print a happy message. It only gives the green check after observed health evidence exists.

---

### 2. The agent moment: AI can suggest, BootProof proves

AI coding agents can suggest commands, but they should not be trusted to declare success. This demo shows the BootProof agent loop on a GitLab-style repo: AI suggests a repair, BootProof requires approval, runs one bounded step, reruns verification, and writes a receipt showing what changed.

<p align="center">
  <img src="assets/bootproof-gitlab-agent-demo.gif" alt="BootProof demo showing AI repair suggestions gated by proof" width="900">
</p>

**What this proves:** AI can help move the repo forward, but BootProof refuses to fake a green check. No proof, no green check.

---

### 3. The Living Receipt: proof that travels

Attestations are JSON. That is the right shape for machines and CI, but it is the wrong shape for a human you are trying to convince. The Living Receipt is the same evidence, rendered as a **single self-contained HTML file** you can email, attach, or link from a README badge.

The two receipts in the demo below are **not mock data**. They are real captures from a real `bootproof up` run against two real local repositories — one that boots to a real HTTP 200, and one that installs clean and then segfaults at runtime. The signature, the boot logs, and the observed HTTP response are all real captured evidence, signed with ed25519 and embedded in the file.

Open it anywhere — no install, no network, no account — and four things happen in your browser, with zero external calls:

1. **It re-verifies its own ed25519 signature.** The signed message, the signature, and the public key are all embedded inline. Native WebCrypto Ed25519 is used in Chrome 137+, Firefox, and Safari; on older browsers (~20% of users) the receipt automatically falls back to a pure-JS `@noble/curves` verifier bundled inline. The receipt never fails to verify silently.
2. **It replays the actual boot** — the inferred plan, the real commands that ran, the real captured log timeline, the real observed HTTP response (or the real classified failure) — streaming in an embedded terminal.
3. **If a single byte of the signed message is altered, the verdict collapses with the signature.** The boot stamp flips to `VERDICT UNVERIFIED — SIGNATURE INVALID`, because no claim inside a tampered receipt can be trusted. That is the whole point of the product: a green check that survives tampering would defeat the entire premise.
4. **The trust ladder is documented in the artifact itself.** This receipt is signed at the `local_developer_signed` level — it proves integrity-since-signing, not that the signer's machine was honest. The documented upgrade path is `local_developer_signed` → `ci_oidc_signed` → `neutral_runner_signed` → `transparency_logged`. The same file format and the same wow experience survive every step up the ladder; only the signer's identity climbs.

Try it now — download the Living Receipt and open it in your browser:

```bash
curl -sL https://github.com/bootproof/bootproof/raw/main/assets/living-receipt.html -o proof.bootproof.html
open proof.bootproof.html   # macOS
# or: xdg-open proof.bootproof.html   # Linux
# or: double-click the file in Finder/Explorer
```

Then click **Tamper with signature** to watch the verdict collapse. The self-verification only works when the file is opened locally (`file://`) — GitHub shows the raw source inline, which is why you need to download it first.

<p align="center">
  <a href="https://github.com/bootproof/bootproof/raw/main/assets/living-receipt.html"><img src="https://img.shields.io/badge/download%20the%20Living%20Receipt-%E2%9C%93%20real%20capture%20%C2%B7%20self--verifying-0E9D5B?style=flat-square&labelColor=16181D" alt="Download the Living Receipt"></a>
  <sub>(right-click → Save Link As… → save as <code>.html</code> → double-click to open)</sub>
</p>

**Reproduce the capture.** The engine that produced these real receipts ships in this repo — both the standalone MVP (`scripts/bootproof_up.mjs`) and the integrated TypeScript CLI:

```bash
# Using the TypeScript CLI (the published npm package) — emits the receipt natively
npx bootproof up <any-repo> --provider local --unsafe-local --install --receipt

# The receipt is written to .bootproof/living-receipt.html

# Or use the standalone MVP engine (for development/testing)
node scripts/bootproof_up.mjs fixtures/real-booting-app --label "real-booting-app"

# Regenerate the Living Receipt HTML from MVP captures
node scripts/build_living_receipt.mjs \
  scripts/records/real-booting-app.json \
  scripts/records/real-slop-app.json \
  --out assets/living-receipt.html

# Run the smoke test (verifies both native and fallback paths)
node scripts/verify_living_receipt.mjs
```

**`--receipt` is now a native flag.** `npx bootproof up <repo> --receipt` runs the real TypeScript CLI, boots the repo for real, observes health for real, signs the attestation with ed25519, and emits the self-verifying Living Receipt HTML — all in one command. The receipt contains the real captured evidence from that run, not mock data.

**What this proves:** the receipt is not a description of a product — it *is* the product, and it runs the moment you open it. It works offline, survives being forwarded, and cannot be forged without breaking the signature. A platform-issued green check dies the moment you leave the platform. A Living Receipt travels.

**The PLG loop is wired in.** Every receipt now carries:
- A first-time visitor banner ("You're holding a Living Receipt — forward it, it verifies itself on the next machine")
- A "Copy markdown badge" button that generates a `[![bootproof](...)](./proof.bootproof.html)` snippet for this specific receipt's verdict
- A "Download this file" button — the file IS the product, one tap to share it
- A page-level CTA: `npx bootproof up <any-repo-url>`

Every receipt is a self-proving advertisement. Every badge in the wild is a link. Every click is a developer asking "what is this?" — and the answer is the product. See [`assets/bootproof-badge-template.md`](assets/bootproof-badge-template.md) for copy-paste badge snippets, and [`docs/LAUNCH_PLAYBOOK.md`](docs/LAUNCH_PLAYBOOK.md) for the "First 1,000 Receipts" distribution sequence.



[![CI](https://github.com/bootproof/bootproof/actions/workflows/ci.yml/badge.svg)](https://github.com/bootproof/bootproof/actions/workflows/ci.yml)
[![Receipt Gate](https://github.com/bootproof/bootproof/actions/workflows/receipt-gate.yml/badge.svg)](https://github.com/bootproof/bootproof/actions/workflows/receipt-gate.yml)

> **The honest run button for GitHub repos. Proof, not vibes.**

BootProof answers one question:

> **Did this repository actually boot?**

Not “did a command run?”  
Not “did Docker say containers are up?”  
Not “did an AI agent say it worked?”  
Not “did the README look plausible?”

BootProof inspects a repo, builds an evidence-based run plan, executes only what it can justify, observes real health, and writes a signed attestation for success or failure.

```text
No proof, no green check.
```

---

## Why BootProof exists

Every developer knows this loop:

```bash
git clone some/repo
npm install
npm run dev
```

Then reality appears.

Wrong Node version. Wrong pnpm version. Missing Java. Missing Clojure. Docker is running but the service is not healthy. Postgres exists but the role does not. Redis is missing. A migration fails. The app starts but nothing responds. A container is “up” but the product is unusable. An AI agent confidently says “done” because a process started.

That is not proof.

BootProof exists because repo onboarding should not depend on hope, terminal archaeology, or fake green checks.

---

## The problem

Modern repositories are no longer simple.

A repo might contain:

- multiple workspaces
- Docker Compose services
- frontend and backend apps
- hidden runtime requirements
- package-manager version constraints
- generated assets
- database migrations
- health endpoints
- undocumented local assumptions

A README can be useful, but it is not proof.

A terminal command can be useful, but it is not proof.

A model response can be useful, but it is not proof.

BootProof turns repo booting into an evidence trail.

---

## The core idea

BootProof separates **activity** from **evidence**.

| Weak signal | What BootProof wants instead |
|---|---|
| command exited | observed health |
| process started | reachable endpoint |
| container running | service actually responds |
| README says it works | repo evidence + runtime proof |
| AI says it is done | signed attestation |
| one workspace responded | selected app/workspace proof |

A failed run is still useful if it tells the truth.

```text
✗ NOT VERIFIED — package_manager_version_mismatch

What happened:
The repository requires pnpm 10.24.0, but this environment has pnpm 9.15.4.

Why BootProof refused:
The dependency install cannot be trusted with the wrong package manager version.

Safe next step:
Run corepack enable && corepack prepare pnpm@10.24.0 --activate, then rerun BootProof.

Evidence:
.bootproof/attestation.json
```

Predictable failure is a feature.

---

## Quick start

Run BootProof against a local repo:

```bash
cd /path/to/repository
npx bootproof up .
```

BootProof will inspect the repo and either prove it booted or explain why it refused.

For CI or agent workflows:

```bash
npx bootproof up . --ci --json
```

For explicit local execution:

```bash
npx bootproof up . --provider local --unsafe-local
```

Run dependency installation only when you intend to:

```bash
npx bootproof up . --provider local --unsafe-local --install
```

Explain or verify an attestation:

```bash
npx bootproof explain .bootproof/attestation.json
npx bootproof verify .bootproof/attestation.json
```

---

## Try it on a public Git repo

BootProof can inspect public HTTPS repositories from GitHub, GitLab, Bitbucket, and Codeberg.

```bash
npx bootproof up https://github.com/dubinc/dub
```

Remote repositories are untrusted code, so BootProof inspects first and refuses execution until you explicitly opt in.

```text
Remote source: https://github.com/dubinc/dub.git
Clone retained at: .bootproof/remotes/github.com/dubinc/dub-*/repo

Inference
  application: yes
  package manager: pnpm
  selected command: pnpm dev

✗ NOT VERIFIED — remote_code_execution_blocked

Why BootProof refused:
Remote repositories are untrusted code and require explicit consent.
```

To run remote code locally, you must say so explicitly:

```bash
npx bootproof up https://github.com/dubinc/dub --provider local --unsafe-local --install
```

BootProof never silently executes remote code.

---

## What a successful run looks like

```text
✓ install: dependencies installed
✓ start-app: app process started and was supervised
✓ health: observed HTTP 200 at http://localhost:3333

✓ BOOTED — HTTP 200 at http://localhost:3333

Evidence:
.bootproof/attestation.json
```

A repository is only marked `BOOTED` when BootProof observes health evidence.

A process start is not enough.  
A successful install is not enough.  
A Docker container is not enough.  
A command exiting is not enough.

---

## What BootProof gives humans

Humans get a readable diagnosis:

```text
NOT VERIFIED — workspace_ambiguous

BootProof detected a root command that starts multiple workspaces in parallel.
Choose a specific application with --workspace <dir>; one responding workspace
is not proof that the whole repository booted.
```

Example:

```bash
npx bootproof up . --workspace apps/studio
```

BootProof is designed to make failures legible.

It should tell you whether the problem is:

- package-manager mismatch
- skipped install
- missing runtime
- ambiguous workspace
- unsupported orchestration
- allocated port
- failed service
- failed app start
- unhealthy endpoint
- health timeout

---

## What BootProof gives machines

`--json` emits exactly one `bootproof/result/v1` object:

```json
{
  "schema": "bootproof/result/v1",
  "booted": false,
  "healthVerified": false,
  "failureClass": "dependency_install_skipped",
  "attestationPath": ".bootproof/attestation.json",
  "inference": {},
  "plan": {},
  "observed": []
}
```

`--ci` disables colour and interactive prompts.

Exit codes are deterministic:

| Exit code | Meaning |
|---:|---|
| `0` | `booted === true` and `healthVerified === true` |
| `1` | refusal, ambiguity, install failure, app failure, service failure, or health failure |

That makes BootProof useful for CI, agent workflows, and repo-quality gates.

---

## Real repo evidence

BootProof has been tested against real repositories, including small apps, monorepos, large platforms, and multi-service stacks.

The point is not to turn every repo green. The point is to produce the correct verdict.

| Repository | Result | What it proved |
|---|---|---|
| `dubinc/dub` | `NOT VERIFIED — remote_code_execution_blocked` | BootProof inspected the repo but refused to execute remote code without explicit consent. |
| `makeplane/plane` | useful monorepo path | BootProof handled a more complex workspace-style repo and produced actionable evidence. |
| `airbytehq/airbyte` | refused direct orchestration, then externally verified | Airbyte required `abctl`, Kind, Helm and a documented local path. BootProof refused to pretend a normal command was enough, then verified the external health endpoint. |
| `gitlabhq/gitlabhq` | manual boot loop exposed hidden environment assumptions | GitLab showed why large repos need evidence trails rather than README optimism. |
| `metabase/metabase` | backend health reached, frontend missing | Metabase showed the difference between “backend is alive” and “full UI booted”. |
| `supabase/supabase` | `workspace_ambiguous`; manual Compose platform boot | BootProof correctly refused a fake monorepo-wide green check. The official Docker Compose path booted core services, proving the need for explicit full-platform compose mode. |

Failure is not hidden or relabelled as support.

Evidence stays evidence.

See [docs/REAL_REPO_EVIDENCE.md](docs/REAL_REPO_EVIDENCE.md).

---

## Supabase example: why honest failure matters

A fresh BootProof run against `supabase/supabase` detected:

```text
stack: make-driven, node-frontend, docker-compose
repo compose: docker/docker-compose.yml
workspaces: apps/studio, apps/www, apps/docs, packages/*
selected command: make dev
```

BootProof refused:

```text
✗ NOT VERIFIED — workspace_ambiguous

The root command starts multiple workspaces in parallel.
One responding workspace would not prove that the whole repository booted.
```

That refusal is correct.

Manual follow-up through Supabase’s official Docker route proved the platform path:

```bash
cd docker
cp .env.example .env
docker compose up -d
```

Core services such as Kong, Studio, DB, Auth, REST and Pooler reported healthy/running, and `localhost:8000` returned Kong/API responses.

The lesson:

> BootProof should not fake a monorepo-wide success just because one endpoint responds.

---

## Airbyte example: external verification

Airbyte correctly exceeded BootProof’s direct orchestration boundary.

BootProof refused instead of pretending a normal Gradle, Make, or Compose command was enough. The documented local path required `abctl`, Kind and Helm. A human followed that runbook and booted the application.

BootProof could then verify the external health endpoint without claiming it started Airbyte.

```bash
bootproof verify-url http://localhost:8001/api/v1/health
```

External verification means:

```text
This endpoint responded.
BootProof did not orchestrate the startup.
```

That distinction matters.

---

## Main commands

### Boot a repo

```bash
npx bootproof up .
```

### Boot a selected workspace

```bash
npx bootproof up . --workspace apps/studio
```

### Run in CI/machine mode

```bash
npx bootproof up . --ci --json
```

### Explicit local host execution

```bash
npx bootproof up . --provider local --unsafe-local
```

### Allow dependency installation

```bash
npx bootproof up . --provider local --unsafe-local --install
```

### Verify an existing service

```bash
npx bootproof verify-url http://localhost:8001/api/v1/health
```

### Attach external health to the current repo

```bash
npx bootproof up . --external-health http://localhost:8001/api/v1/health
```

### Explain an attestation

```bash
npx bootproof explain .bootproof/attestation.json
```

### Verify an attestation

```bash
npx bootproof verify .bootproof/attestation.json
npx bootproof verify . --require-known-signer
```

Signature verification reports one of three local signer tiers:

- `this machine`: the artifact was signed by `~/.bootproof/signer.json`;
- `known`: the signer was explicitly pinned in `~/.bootproof/known_signers.json`;
- `UNKNOWN`: the signature is intact, but it proves integrity only and the signer is not trusted.

Unknown foreign signers are never pinned automatically. To deliberately trust an intact
foreign signer, review the printed SHA-256 SPKI fingerprint and run:

```bash
npx bootproof verify proof.json --trust-signer
```

Use `--require-known-signer` for CI gating. When verification targets a repository directory,
BootProof also compares the attested commit with the repository's current `HEAD`; `--strict`
fails on either an unknown signer or a commit mismatch. A valid signature proves the artifact
was not altered after signing. It does not, by itself, prove who produced it.

### Static infrastructure diff

```bash
npx bootproof diff --base main --head HEAD
npx bootproof diff --base main --head HEAD --json
```

### Export a CycloneDX SBOM

```bash
npx bootproof export-sbom .
npx bootproof export-sbom . --json
```

Reads `package-lock.json` and writes `.bootproof/sbom.cdx.json` in CycloneDX 1.5 JSON format. Each top-level dependency in the lockfile becomes a `library` component with a `pkg:npm/{name}@{version}` purl. The application itself is recorded as the `metadata.component`. No transitive resolution is performed beyond what the lockfile already records, and no code is executed to produce the SBOM. Repositories without a `package-lock.json` are refused. The only supported `--format` value is `cyclonedx-json`.

### Deterministic repair

```bash
npx bootproof fix .
```

### Optional BYOK AI repair suggestion

```bash
OPENAI_API_KEY=... npx bootproof fix . --ai
```

or:

```bash
ANTHROPIC_API_KEY=... BOOTPROOF_AI_PROVIDER=anthropic npx bootproof fix . --ai
```

`bootproof up` remains zero-AI.

---

## The agent-in-the-loop model

BootProof is built for a world where humans and AI agents both touch repositories.

The intended loop is:

```text
Diagnose
→ Classify
→ Plan
→ Risk-classify
→ Approve
→ Execute one step
→ Verify
→ Receipt
→ Repeat
```

AI can suggest.  
Humans can approve.  
BootProof proves.

The complete autonomous loop is not implemented. Today BootProof exposes four honest modes.

### 1. Direct orchestration

```bash
bootproof up .
```

BootProof infers a supported local run path, executes it within the selected safety boundary, observes health, and writes an attestation.

Unsupported or ambiguous orchestration is refused.

### 2. External verification

```bash
bootproof verify-url http://localhost:8001/api/v1/health
```

BootProof observes a service started outside BootProof. Successful evidence is classified as externally verified and never claims BootProof started the app.

### 3. Agent planning

```bash
bootproof plan-agent .
```

BootProof writes a deterministic, risk-classified plan and a redacted local receipt chain. It does not execute candidate actions, and planning never counts as success.

### 4. Deterministic repair

```bash
bootproof fix .
```

BootProof maps exact known failures to deterministic repair actions. Mutating commands and patches require explicit approval. Verification decides whether the failure progressed or the application booted.

See:

- [docs/AGENT_IN_THE_LOOP.md](docs/AGENT_IN_THE_LOOP.md)
- [docs/AGENT_RUN_RECEIPTS.md](docs/AGENT_RUN_RECEIPTS.md)
- [docs/DETERMINISTIC_REPAIR_SAFETY_MODEL.md](docs/DETERMINISTIC_REPAIR_SAFETY_MODEL.md)

---

## Deterministic repair

`bootproof fix` reads the latest signature-valid classified failure and maps exact known failures to deterministic actions.

```bash
bootproof fix .
```

Host and service commands show the exact command, scope and risk. They run only when the user gives explicit approval. JSON and CI modes never approve commands.

Repair receipts distinguish:

- declined
- failed
- progressed
- verified

Machine mode:

```bash
bootproof fix . --json
```

It emits one `bootproof/repair-result/v1` object and exits `0` only when a verified receipt exists.

`fix` never applies file patches directly. To explicitly apply a signature-valid file repair to a local working tree:

```bash
bootproof apply-repair .
```

Application checks the receipt signature, allowed file scope, signed content hashes, and exact current preimages before writing.

See [docs/REPAIR_RECEIPT.md](docs/REPAIR_RECEIPT.md).

---

## Optional BYOK AI

AI suggestions are optional and are only available after no deterministic repair is known.

```bash
OPENAI_API_KEY=... bootproof fix . --ai
```

or:

```bash
ANTHROPIC_API_KEY=... BOOTPROOF_AI_PROVIDER=anthropic bootproof fix . --ai
```

BootProof asks before contacting the provider, sends only redacted structured failure evidence, validates the strict `bootproof/ai-repair-suggestion/v1` response through the shared safety model, and asks again before any command or patch is tested.

AI suggestions are recorded as `ai_suggested`.

They never enter the deterministic registry automatically.

---

## Static infrastructure diff

```bash
bootproof diff --base main --head feature-branch
bootproof diff --base main --head HEAD --json
```

`diff` reads committed Git objects and performs static analysis only.

It does not:

- check out either ref
- execute repository code
- install dependencies
- read protected `.env` contents
- upload data

It reports supported drift in:

- dependency manifests and lockfiles
- Compose services and ports
- environment variable names
- start commands
- package managers
- runtime markers
- detectable health routes

A diff can require fresh proof, but it never claims the head revision boots. Run `bootproof up` against the intended revision to establish that with observed health evidence.

---

## Honesty contract

BootProof is constrained on purpose.

It will not:

- mark a repo `BOOTED` without observed health
- execute remote code without explicit consent
- fall back from Docker to host execution silently
- render skipped steps as success
- invent secrets
- write protected `.env` files
- silently patch project code
- guess a workspace when the repo is ambiguous
- claim generated scaffolding exists unless it was written
- upload telemetry or hidden evidence

It will:

- sign successful attestations
- sign failed attestations
- preserve local evidence
- classify known failures
- refuse unsupported paths clearly

See [docs/HONESTY_CONTRACT.md](docs/HONESTY_CONTRACT.md).

---

## Safety model

### Execution isolation (read this before running on a repo you don't trust)

BootProof's execution model is **honest by default, not isolated by default**. There is no general-purpose container sandbox in the current release. Here is exactly what happens when you run `bootproof up`:

- **Default (`--provider docker`)**: BootProof will only execute inside Docker for **source-built Compose applications** (repos with a `docker-compose.yml` where the app service is built from source). For every other repo — plain Node, Python, Rust, Go — the Docker provider **refuses to run** with `orchestration_not_supported` rather than silently falling back to the host. This is intentional: the default is fail-closed, not silent host execution.
- **`--provider local --unsafe-local`**: runs install and start commands **directly on your host machine** using `spawn(command, { shell: true })`. There is no container, no network restriction, no read-only filesystem. The `--unsafe-local` flag is the explicit consent gate — you are acknowledging that you have reviewed the inferred commands and accept that the repo's code (including `postinstall` scripts, `prestart` hooks, and anything the start command does) will run on your machine with your privileges.
- **Remote repos** (`bootproof up https://github.com/...`): BootProof clones for inspection but **refuses to execute** without `--provider local --unsafe-local`. Inspection is safe; execution requires consent.

**Before running `bootproof up --provider local --unsafe-local` on a repo you didn't write:**
1. Run `bootproof up <repo> --dry-run` first to see the inferred commands without executing them.
2. Read the plan. The install command and start command will run on your host.
3. Only then add `--unsafe-local --install` to actually execute.

This is the current truth. General-purpose Docker isolation for non-Compose repos is on the roadmap but is not in this release. If that's a blocker for your use case, do not use BootProof on untrusted repos yet.

### Repair safety

BootProof treats repair actions as executable risk.

The repair safety model blocks or escalates dangerous commands before they run.

Blocked examples include:

- `sudo`
- shell interpreters
- pipe-to-shell downloads such as `curl | sh`
- inline arbitrary execution such as `node -e`, `python -c`, `ruby -e`
- recursive world-writable chmod
- raw disk writes
- destructive database drops
- protected `.env` writes
- secret exfiltration patterns

High-risk actions require explicit approval and can never be downgraded by AI-provided risk labels.

See [docs/DETERMINISTIC_REPAIR_SAFETY_MODEL.md](docs/DETERMINISTIC_REPAIR_SAFETY_MODEL.md).

---

## Current capabilities

BootProof currently provides:

- Node package-manager and start-command inference
- monorepo candidate ranking
- Docker service dependency detection
- repository Compose detection
- conservative Go main-package execution
- Rails `bin/rails` entrypoint detection
- explicit Make run-target execution
- Python/Flask and Go/Node hybrid detection
- localhost health-candidate discovery from repo evidence and app logs
- classified failures
- signed Ed25519 attestations
- strict JSON and fail-closed CI output
- redacted registry-entry export
- deterministic sandboxed repairs for registered failure classes
- explicit repair application with signature, scope and stale-preimage checks
- static infrastructure diff

Detection is broader than orchestration. BootProof may detect a stack and still refuse to run it if the proof boundary is not safe or clear.

---

## Supported entrypoints

Supported execution paths are deliberately narrow.

| Type | Supported path |
|---|---|
| Node | package manager + selected start/dev script |
| Go | exactly one `main.go` or `cmd/*/main.go` |
| Ruby/Rails | `Gemfile` plus `bin/rails` |
| Make | explicit `run`, `serve`, `server`, `start`, or `dev` target |
| Compose | repository-local build context with published HTTP port |

Each path still requires observed health.

A successful `docker compose up -d`, process spawn, or command exit is not a green result by itself.

---

## Failure taxonomy

Common failure classes include:

- `not_an_application`
- `workspace_ambiguous`
- `dependency_install_skipped`
- `package_manager_version_mismatch`
- `python_flask_setup_required`
- `service_port_allocated`
- `postgres_auth_env_missing`
- `health_http_error`
- `health_check_timeout`
- `remote_code_execution_blocked`
- `unknown_failure`

Unknown failures remain unknown, with evidence preserved for the next detector.

See [docs/FAILURE_TAXONOMY.md](docs/FAILURE_TAXONOMY.md).

---

## Files BootProof may write

Depending on the command and observed plan, BootProof may write:

```text
.bootproof/attestation.json
.bootproof/registry-entry.json
.bootproof/registry/<timestamp>-<hash>.json
.bootproof/runtime/
docker-compose.bootproof.yml
.env.bootproof.example
```

Registry artifacts are written only by explicit export commands.

Protected application env files remain untouched.

---

## Attestation trust

Local attestations (the default) contain:

```json
{
  "trust": {
    "level": "local_developer_signed",
    "signer": "local_ed25519",
    "oidc": null
  }
}
```

The embedded trust value is an attested claim, not an external identity proof. Local
verification separately classifies the signer as this machine, explicitly known, or unknown
foreign. Repair receipts and registry entries use the same signer tiers.

Local attestations are useful evidence. CI/OIDC attestations are stronger supply-chain proof.
Cryptographic authorship binding through keyless/OIDC is intentionally deferred to the
CI/Action work. BootProof does not pretend local laptop proof is enterprise CI proof.

### CI OIDC signing

Inside GitHub Actions with `permissions: id-token: write`, pass `--ci-oidc` to fetch the runner's OIDC token and embed its claims in the attestation:

```bash
bootproof up . --provider local --unsafe-local --ci-oidc
```

The attestation then carries `ci_oidc_signed` trust with the OIDC claims:

```json
{
  "trust": {
    "level": "ci_oidc_signed",
    "signer": "local_ed25519",
    "oidc": {
      "iss": "https://token.actions.githubusercontent.com",
      "sub": "repo:bootproof/bootproof:ref:refs/heads/main",
      "repository": "bootproof/bootproof",
      "run_id": "123456",
      "workflow": "CI",
      "job_workflow_ref": "bootproof/bootproof/.github/workflows/ci.yml@refs/heads/main"
    }
  }
}
```

The ed25519 signature still provides integrity; the OIDC evidence provides CI provenance. A verifier can independently validate both the signature and the OIDC claims. The `neutral_runner_signed` and `transparency_logged` levels remain on the roadmap.

### Key rotation

The local signing key can be rotated without invalidating existing attestations (each carries its public key inline and verifies independently):

```bash
bootproof rotate-keys                    # generate new key, back up old
bootproof rotate-keys --repo . --resign  # also re-sign the latest attestation
```

Old keys are archived to `~/.bootproof/archived-keys/` so existing attestations remain verifiable.

---

## CI and registry

BootProof does not upload attestations.

A project can deliberately export a redacted local registry entry or federated public-candidate receipt and review it before committing it.

```bash
bootproof registry export .
bootproof attest export .
bootproof registry export . --federated
```

Public crawler, private cloud upload, and OIDC-backed trust are future integrations, not deployed services in this repository.

See:

- [docs/CI_ACTION.md](docs/CI_ACTION.md)
- [docs/REGISTRY.md](docs/REGISTRY.md)

---

## Open-source boundary

This repository contains the local trust layer:

- local diagnosis
- local planning
- local receipts
- local approvals
- optional BYOK AI suggestions
- deterministic repair safety
- no telemetry
- no automatic upload

The OSS engine works offline and does not require BootProof Cloud.

---

## Cloud boundary

BootProof Cloud belongs in a separate private repository.

Its boundary includes future hosted capabilities such as:

- hosted AI
- shared registry
- team approval workflows
- GitHub App
- SSO/RBAC
- policy
- fleet dashboards
- audit retention

These are product boundaries, not claims that those services are implemented in this public repository.

No Cloud/SaaS code is included here.

---

## Release packaging

The npm package contains the compiled CLI, license, README and docs.

`dist/` is required at runtime, generated by `npm run build` during `prepack`, and intentionally not committed.

Run:

```bash
npm run pack:check
```

This packs BootProof, installs the tarball in an isolated temporary directory, and exercises the installed CLI.

See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

---

## Development

For contributors working from source:

```bash
git clone https://github.com/bootproof/bootproof.git
cd bootproof
npm ci
npm run build
npm test
npm link
```

Then from another repository:

```bash
bootproof up .
```

Generated files such as `dist/`, `node_modules/`, and `.DS_Store` are ignored and not committed.

---

## What BootProof is not

BootProof is not:

- a deployment platform
- a general CI replacement
- a magic environment fixer
- an AI coding agent
- a guarantee that every repo can be run automatically
- a cloud product hidden inside an OSS repo
- a sandbox or container runtime — `--provider local` runs code on your host; `--provider docker` only isolates source-built Compose apps

BootProof is the honest run button for repos.

It runs what it can, refuses what it cannot prove, signs both success and failure, and gives humans and machines the same evidence.

---

## Status

BootProof is early alpha.

Near-term work includes:

- explicit full-platform Compose mode
- stronger multi-service health modelling
- broader deterministic remediation coverage
- more Python, Go, Ruby and Make entrypoints
- CI/OIDC-backed signing
- proof-linked badges
- verified public evidence index

Unsupported paths should fail clearly, not magically.

---

## License

Apache-2.0
