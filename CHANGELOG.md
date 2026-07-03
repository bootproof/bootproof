# Changelog

## 0.4.1

### Observed capabilities

- npm keywords replaced with search-relevant terms: `attestation`, `runtime-verification`, `ai-agents`, `claude-code`, `ci`, `signed`, `receipt`, `proof`, `health-check`, `supply-chain`, `provenance`, `verification`. Previous keywords (`devtools`, `onboarding`, `docker`, `run`, `attestation`, `reproducibility`) were generic and unwinnable on npm search.
- `action.yml` description updated to name its sibling: "Advisory: run BootProof in CI, report honest PR verdicts, retain evidence. For merge enforcement, use Receipt Gate." Receipt Gate's description updated inversely: "Hard gate: no merge without observed health. For advisory reporting without blocking, use the BootProof action." The two adjacent Marketplace listings now state their differentiation.
- Release workflow added (`.github/workflows/release.yml`) with `npm publish --provenance` and `id-token: write`. When triggered by a tag push (or manual dispatch with `dry-run: false`), the published npm package carries Sigstore-backed build provenance. The tool that signs runtime proofs is itself published with signed build provenance.

### Fixes

- No code fixes; this is a packaging and distribution release.

## 0.4.0

### Observed capabilities

- `bootproof up` accepts `--health-path <path>` to override the inferred health endpoint path. Resolves the case where an app answers on `/health` but returns 404 at `/`.
- `bootproof up` accepts `--ci-oidc` to fetch a GitHub Actions OIDC token and sign the attestation at the `ci_oidc_signed` trust level. Requires `permissions: id-token: write` on the workflow.
- `bootproof export-sbom <path>` reads `package-lock.json` and writes `.bootproof/sbom.cdx.json` in CycloneDX 1.5 JSON format. Supports lockfile v1 (`dependencies`) and v2/v3 (`packages`). Repositories without a lockfile are refused.
- `bootproof rotate-keys` generates a new ed25519 keypair, archives the old key to `~/.bootproof/archived-keys/`, and optionally re-signs the latest attestation with `--resign`. Existing attestations remain verifiable with their embedded public key.
- `bootproof verify` reports three signer tiers: `self` (this machine's key), `known` (explicitly pinned in `~/.bootproof/known_signers.json`), and `unknown-foreign` (valid signature, untrusted signer). Unknown signers are never auto-pinned.
- `bootproof verify --trust-signer` pins an intact foreign signer. `bootproof verify --require-known-signer` fails on unknown signers. `bootproof verify --strict` also fails on commit mismatch between the attestation and the repository's current `HEAD`.
- `bootproof attest check` uses the same signer tiers for registry entries.
- Repair receipts for `ai_suggested` repairs embed `aiEvidence` containing the redacted AI prompt context and the validated AI suggestion, signed under the same ed25519 key. Deterministic repair receipts omit `aiEvidence`.
- When a supervised process exits before health verification and the failure cannot be classified more specifically, the explanation field surfaces the last ~10 lines of captured process output (stdout and stderr combined, post-redaction).
- A pre-existing responder on the health candidate URL is refused with `health_preoccupied` before the application starts. A health response observed after the supervised process has exited is not attributed to the repository.
- The composite GitHub Action accepts a `ci-oidc` input (default `false`) that passes `--ci-oidc` through to the `bootproof up` invocation.
- Key files (`signer.json`, `known_signers.json`, archived keys) are written with mode `0600`. The `~/.bootproof/` directory and `archived-keys/` subdirectory use mode `0700`.
- The `receipt-gate` self-gate workflow on `bootproof/bootproof` requires `booted=true` and `healthVerified=true` on every PR and push to main. The receipt artifact is retained for 2555 days (~7 years, GitHub's maximum).
- `AGENTS.md` includes an "AI Evidence Capture" section requiring repair receipts to capture the redacted AI prompt and structured response, and a "Compliance Features" section documenting redaction, offline-first, deterministic failure classification, tamper-evidence, and the trust ladder.
- `HONESTY_CONTRACT.md` lists 21 rules. Rule 15: a valid signature proves integrity, not authorship. Rule 21: a health response is attributed only if it could have come from the process BootProof started.

### Tests added

- `--health-path overrides the inferred health endpoint path` (e2e)
- `--health-path rejects a path without a leading slash` (e2e)
- `app_exited_early surfaces captured stderr in the explanation` (e2e)
- `signature trust: full trust-flow integration (foreign → unknown → pin → known → second foreign still fails)` (e2e) — six assertions in one test
- `AI repair receipt captures aiEvidence (prompt context + suggestion) for audit` (unit)
- `deterministic repair receipt omits aiEvidence` (unit)
- `OIDC: detectOidcEnv returns null without GitHub Actions env vars` (receipt)
- `OIDC: resolveTrust returns local_developer_signed without --ci-oidc` (receipt)
- `OIDC: resolveTrust throws on --ci-oidc without env vars` (receipt)
- `OIDC: resolveTrust fetches claims and returns ci_oidc_signed` (receipt)
- `OIDC: buildAttestation embeds ci_oidc_signed trust when provided` (receipt)
- `SBOM: export-sbom produces valid CycloneDX from package-lock.json` (unit)
- `SBOM: export-sbom fails closed without package-lock.json` (unit)
- `SBOM: export-sbom rejects unsupported formats` (unit)
- `rotate-keys: generates a new keypair and backs up the old key` (receipt)
- `rotate-keys: --resign re-signs the latest attestation with the new key` (receipt)
- `key files are written with 0600 permissions and directories with 0700` (receipt)
- `ci-oidc input adds --ci-oidc to the bootproof up invocation` (action)
- `honesty: a pre-existing healthy responder is refused before the app starts` (e2e)
- `signature trust: forged claims re-signed by a fresh key remain unknown until explicitly pinned` (e2e)
- `signature trust: directory verification warns and fails strict mode for a cross-repo replay` (e2e)
- `signature trust: repair receipts and registry entries use the same signer tiers` (e2e)

### Fixes

- Windows CI regex `/500|warming up/` matched port numbers containing "500"; tightened to `/HTTP 500|warming up/`.
- `HONESTY_CONTRACT.md` and `CI_ACTION.md` stated `ci_oidc_signed` was "reserved for future" after `--ci-oidc` was implemented; corrected to describe the implemented behavior.
- Duplicate `rotateSigner` import after PR #31 merge; removed.

## 0.3.0

- Initial public release: `up`, `verify`, `fix`, `apply-repair`, `diff`, `analyze`, `plan`, `plan-agent`, `explain`, `explain-run`, `attest`, `registry`, `verify-url` commands.
- ed25519-signed attestations with redaction at capture.
- Living Receipt self-verifying HTML.
- Deterministic repair playbooks with safety classification.
- BYOK AI repair suggestions (OpenAI, Anthropic) with redacted context.
- Composite GitHub Action with `fail-on-unverified` default.
