# BootProof Engineering Constitution

This file governs all engineering work in this repository. Every future change
must preserve these principles and boundaries.

## Mission

BootProof is the honest Run Button for GitHub repositories.

- BootProof makes repositories prove they boot.
- No proof, no green check.
- AI can suggest. BootProof proves.
- Failed attestations are valuable evidence, not disposable errors.

## Non-Negotiable Invariants

### `bootproof up` is sacred

`bootproof up` must remain deterministic, zero-AI, and evidence-based. Its
result must follow from observed execution and health evidence, never from an
AI judgment, optimistic inference, or fabricated state.

### Verification must be honest

- Never claim verified boot unless health was actually observed.
- A process starting, a port opening, or a command exiting successfully is not
  sufficient unless it satisfies the declared health contract.
- Preserve failed attestations and report failures clearly.
- Never turn missing, ambiguous, or inconclusive evidence into success.
- Never silently ignore CLI flags. Honor them or fail with a clear error.

### Secrets and environments must be protected

- Never invent secrets, credentials, tokens, or secret-like placeholder values
  and present them as real.
- Never silently mutate protected `.env` files.
- Any permitted environment-file change must be explicit, visible, and
  consented to by the user.
- Redact secrets from attestations, evidence, logs, registry exports, prompts,
  repair receipts, and other persisted or transmitted output.

### Execution requires consent

- Never execute remote or untrusted code without explicit user consent.
- Make the code source and execution implications clear before requesting
  consent.
- Do not broaden granted consent beyond the specific operation authorized.

### Local data stays local by default

- Never upload telemetry, attestations, repair receipts, registry data, or
  derived evidence by default.
- Registry and cloud uploads must be explicit and opt-in.
- Offline operation must remain complete and useful without BootProof Cloud.

## Agent-Loop Architecture

The BootProof agent loop is:

**Diagnose → Classify → Plan → Risk-Classify → Approve → Execute One Step →
Verify → Receipt → Repeat**

This sequence is a safety contract, not merely a suggested workflow.

- BootProof may plan actions.
- BootProof may risk-classify actions.
- BootProof may execute only approved local actions.
- BootProof must execute one step at a time. Approval for one action does not
  authorize later actions, hidden command chaining, or broader mutation.
- BootProof must verify after every action before deciding whether to stop or
  repeat the loop.
- BootProof must save accurate, redacted local receipts for proposed,
  approved, executed, progressed, and verified outcomes.
- Unknown, unsupported, ambiguous, or unsafe steps must stop honestly.
- Agent planning, classification, command completion, or receipt creation must
  never claim success. Only observed verification may establish success.
- External health verification may prove that an application is healthy, but
  it must never claim that BootProof started the application unless BootProof
  actually started and supervised that process.
- `bootproof up` remains sacred: deterministic, zero-AI, and evidence-based.
- Any AI-assisted behavior in OSS must remain optional and BYOK/local, and its
  suggestions must pass through the same deterministic safety, risk,
  approval, one-step execution, verification, and receipt model.
- No telemetry, upload, registry submission, or receipt upload happens by
  default.

## Open-Source Boundary

This public repository contains the local proof engine.

It may contain:

- Deterministic local boot discovery, execution, health checks, and proof.
- Deterministic local repair.
- Optional bring-your-own-key AI repair suggestions.
- Standard local evidence formats, including attestations, repair receipts,
  diff results, and registry export entries.

The OSS repository provides the local brakes and trust layer: deterministic
proof, safety and risk classification, explicit approval, one-step local
execution, verification, redaction, and local receipts.

It must not contain BootProof Cloud or cloud-product capabilities, including:

- SaaS billing.
- Team dashboards.
- Hosted managed AI.
- Shared repair memory.
- Enterprise policy.
- Fleet analytics.
- Cloud governance.

Do not add cloud implementations here behind feature flags, dormant modules, or
"future" abstractions.

## Commercial Boundary

BootProof Cloud lives in a separate private repository. Cloud owns:

- Hosted evidence.
- Managed AI.
- Managed autopilot.
- Shared memory.
- Governance and managed approvals.
- Fleet control.
- Team policy and approval workflows.
- GitHub and GitLab integration history.
- Registry intelligence.
- Dashboards.
- SSO and billing.
- The global data moat.

Public interfaces may support explicit interoperability with Cloud, but this
repository must not implement Cloud-owned behavior or require Cloud to operate.

Open-source the brakes.
Charge for the autopilot, memory, governance, and fleet control.

## Data Moat Principle

- OSS generates standard evidence: attestations, repair receipts, diff results,
  and registry export entries.
- Cloud may ingest explicitly opted-in, redacted evidence.
- Cloud builds the canonical registry, the Global Atlas of Broken Environments.
- OSS must always work offline without Cloud.
- Local formats must remain useful without upload or a hosted account.

## AI Boundary

- AI may suggest repairs; deterministic execution and observed health determine
  whether a repair worked.
- AI output is untrusted input and must never be treated as proof.
- BYOK AI support must be optional and must use native `fetch`.
- Do not add OpenAI, Anthropic, or other provider SDKs to the OSS dependency
  graph.
- Redact secrets before constructing or sending prompts.
- AI must never participate in the `bootproof up` proof path.

## AI Evidence Capture

When AI repair suggestions are enabled, the repair receipt is the audit
record. It must be complete enough that an investigator can reconstruct what
the AI proposed, how BootProof classified it, and what was observed — without
trusting the AI's self-reported confidence.

- Capture the redacted failure evidence sent to the AI provider.
- Capture the AI's structured response (per `bootproof/ai-repair-suggestion/v1`):
  suggested action, risk level, `why_this_is_safe`, `what_to_check_after`.
- Store both in the repair receipt, signed under the same ed25519 key as the
  surrounding evidence.
- Redact PII, secrets, and provider inference metadata before persistence.
- Mark the receipt `source: ai_suggested` (distinct from
  `deterministic_playbook`) so an auditor can filter AI-origin repairs.
- The AI prompt and response are evidence of what was *suggested*, never
  evidence of what *worked*. Only the post-action health observation may
  establish success.

This exists to make AI-assisted repairs auditable after the fact. A regulator
asking "what did the agent propose, and was it approved?" must be answerable
from the receipt alone, offline, with no access to the AI provider.

## Compliance Features

These are product correctness requirements, not marketing claims. Each is
enforced by the deterministic engine and preserved in signed evidence.

- **Redaction by default.** Secrets are redacted from attestations, repair
  receipts, logs, registry exports, and AI prompts before persistence or
  transmission. Redaction is not a post-hoc filter; it runs in the evidence
  path.
- **Offline-first.** OSS works without Cloud, without telemetry, without an
  account. Regulated environments can run BootProof on an air-gapped runner
  and produce verifiable evidence.
- **Deterministic failure classification.** Failures are classified into a
  documented taxonomy (`docs/FAILURE_TAXONOMY.md`), not hidden behind a
  generic "build failed". An auditor sees the same class string the engine
  saw.
- **Tamper-evident evidence.** Every attestation is ed25519-signed; any byte
  change invalidates the signature. The Living Receipt re-verifies its own
  signature in a browser with zero network calls.
- **Trust ladder, not trust theater.** The trust level (`local_developer_signed`
  → `ci_oidc_signed` → `neutral_runner_signed` → `transparency_logged`) is
  printed on the receipt. A local receipt proves integrity-since-signing,
  not that the signer was honest — and the receipt says so.
- **Receipt preservation.** Receipts are local files the user controls. CI
  workflows that use Receipt Gate should upload attestations as artifacts
  with long retention (the self-gate and the receipt-gate CI both use 2555
  days / ~7 years) to support audit timelines.

## Implementation Rules

- Prefer small, surgical changes.
- Add tests for every behavior change.
- Keep dependencies minimal and justify each new dependency.
- Use strict JSON schemas for machine interfaces.
- Reject invalid machine input clearly; do not silently coerce away contract
  violations.
- Preserve deterministic behavior in proof, repair, evidence, and export paths.
- Keep evidence and receipts accurate, inspectable, and redacted.
- Treat security, consent, privacy, and truthful verification as product
  correctness requirements.

## Completion Gate

Before completing any engineering task:

1. Confirm the change respects this constitution and the OSS/Cloud boundary.
2. Confirm every behavior change has appropriate tests.
3. Run `npm run build` when available.
4. Run `npm test` when available.
5. Do not report completion while required builds or tests are failing.

When requirements conflict with this constitution, stop and surface the
conflict rather than weakening these guarantees.
