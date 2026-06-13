import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type {
  Attestation,
  AttestationTrust,
  ObservedStep,
  RunPlan,
  FailureClass,
  HealthEvidence,
  VerificationMode,
  ExternalVerificationClassification,
} from "./types.js";
import { buildExecutionEnv } from "./exec.js";
import { redactJsonValue } from "./redact.js";

export const TOOL_ID = "bootproof@0.3.0";
export type { AttestationTrust } from "./types.js";

export type SignerTrustTier = "invalid" | "self" | "known" | "unknown-foreign";

export interface SignatureTrustResult {
  integrityValid: boolean;
  tier: SignerTrustTier;
  fingerprint: string | null;
  label: string | null;
}

interface KnownSignerRecord {
  firstSeenAt: string;
  label?: string;
}

interface KnownSignerStore {
  schema: "bootproof/known-signers/v1";
  signers: Record<string, KnownSignerRecord>;
}

export function gitInfo(repo: string): Attestation["repo"] {
  const git = (...args: string[]) => {
    try { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", env: buildExecutionEnv() }).trim(); } catch { return null; }
  };
  if (!fs.existsSync(path.join(repo, ".git"))) return { path: repo, remote: null, commit: null, dirty: null };
  const status = git("status", "--porcelain");
  return {
    path: repo,
    remote: git("config", "--get", "remote.origin.url"),
    commit: git("rev-parse", "HEAD"),
    dirty: status === null ? null : status.length > 0,
  };
}

function signerKeyPath(): string {
  return path.join(os.homedir(), ".bootproof", "signer.json");
}

export function knownSignersPath(): string {
  return path.join(os.homedir(), ".bootproof", "known_signers.json");
}

function loadOrCreateSigner(): { privateKey: crypto.KeyObject; publicKeyPem: string } {
  const p = signerKeyPath();
  if (fs.existsSync(p)) {
    const saved = JSON.parse(fs.readFileSync(p, "utf8"));
    return { privateKey: crypto.createPrivateKey(saved.privateKeyPem), publicKeyPem: saved.publicKeyPem };
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify({ privateKeyPem, publicKeyPem }), { mode: 0o600 });
  return { privateKey: crypto.createPrivateKey(privateKeyPem), publicKeyPem };
}

export interface RotationResult {
  schema: "bootproof/key-rotation/v1";
  rotatedAt: string;
  oldPublicKey: string;
  newPublicKey: string;
  backedUpTo: string | null;
  reSignedAttestation: boolean;
}

/**
 * Rotate the local ed25519 signing key. The old key's public key is archived
 * (so existing attestations remain independently verifiable), a new keypair is
 * generated, and the latest attestation in the given repo is optionally
 * re-signed with the new key.
 *
 * Rotation does NOT invalidate existing attestations — they still carry the
 * old public key inline and verify with it. Rotation only affects what key
 * future attestations will be signed with.
 */
export function rotateSigner(opts: {
  repo?: string;
  resignAttestation?: boolean;
  backup?: boolean;
} = {}): RotationResult {
  const p = signerKeyPath();
  const oldKey = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  const oldPublicKeyPem = oldKey?.publicKeyPem ?? null;

  // Generate the new keypair.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const newPrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const newPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  // Back up the old key before overwriting (unless explicitly skipped).
  let backedUpTo: string | null = null;
  if (opts.backup !== false && oldKey) {
    const backupDir = path.join(os.homedir(), ".bootproof", "archived-keys");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupName = `signer-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    backedUpTo = path.join(backupDir, backupName);
    fs.writeFileSync(backedUpTo, JSON.stringify(oldKey, null, 2), { mode: 0o600 });
  }

  // Write the new key.
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify({ privateKeyPem: newPrivateKeyPem, publicKeyPem: newPublicKeyPem }), { mode: 0o600 });

  // Optionally re-sign the latest attestation with the new key.
  let reSigned = false;
  if (opts.resignAttestation && opts.repo) {
    const attPath = attestationPath(opts.repo);
    if (fs.existsSync(attPath)) {
      const att = JSON.parse(fs.readFileSync(attPath, "utf8")) as Attestation;
      // Re-sign: the canonical body excludes signature and signer fields.
      const body = canonicalBody(att);
      const newPrivateKey = crypto.createPrivateKey(newPrivateKeyPem);
      att.signature = crypto.sign(null, body, newPrivateKey).toString("base64");
      att.signer = { publicKey: newPublicKeyPem, algorithm: "ed25519" };
      fs.writeFileSync(attPath, JSON.stringify(att, null, 2) + "\n");
      reSigned = true;
    }
  }

  return {
    schema: "bootproof/key-rotation/v1",
    rotatedAt: new Date().toISOString(),
    oldPublicKey: oldPublicKeyPem ?? "(no prior key existed)",
    newPublicKey: newPublicKeyPem,
    backedUpTo,
    reSignedAttestation: reSigned,
  };
}

function localSignerPublicKey(): string | null {
  const p = signerKeyPath();
  if (!fs.existsSync(p)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(p, "utf8")) as { publicKeyPem?: unknown };
    return typeof saved.publicKeyPem === "string" ? saved.publicKeyPem : null;
  } catch {
    return null;
  }
}

function emptyKnownSignerStore(): KnownSignerStore {
  return { schema: "bootproof/known-signers/v1", signers: {} };
}

function readKnownSignerStore(): KnownSignerStore {
  const p = knownSignersPath();
  if (!fs.existsSync(p)) return emptyKnownSignerStore();
  try {
    const value = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<KnownSignerStore>;
    if (value.schema !== "bootproof/known-signers/v1" || !value.signers || typeof value.signers !== "object") {
      return emptyKnownSignerStore();
    }
    return { schema: value.schema, signers: value.signers };
  } catch {
    return emptyKnownSignerStore();
  }
}

export function signerFingerprint(publicKeyPem: string): string {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const spki = publicKey.export({ type: "spki", format: "der" });
  return `sha256:${crypto.createHash("sha256").update(spki).digest("hex")}`;
}

export function trustSigner(publicKeyPem: string, label?: string): {
  fingerprint: string;
  firstSeenAt: string;
  label: string | null;
} {
  const fingerprint = signerFingerprint(publicKeyPem);
  const store = readKnownSignerStore();
  const existing = store.signers[fingerprint];
  const record: KnownSignerRecord = existing ?? {
    firstSeenAt: new Date().toISOString(),
    ...(label ? { label } : {}),
  };
  if (label) record.label = label;
  store.signers[fingerprint] = record;
  const p = knownSignersPath();
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  return {
    fingerprint,
    firstSeenAt: record.firstSeenAt,
    label: record.label ?? null,
  };
}

function signerTrust(publicKeyPem: string): Omit<SignatureTrustResult, "integrityValid"> {
  let fingerprint: string;
  try {
    fingerprint = signerFingerprint(publicKeyPem);
  } catch {
    return { tier: "invalid", fingerprint: null, label: null };
  }
  const localPublicKey = localSignerPublicKey();
  if (localPublicKey) {
    try {
      if (signerFingerprint(localPublicKey) === fingerprint) {
        return { tier: "self", fingerprint, label: null };
      }
    } catch {
      // A malformed local signer cannot establish trust in a foreign artifact.
    }
  }
  const known = readKnownSignerStore().signers[fingerprint];
  if (known) return { tier: "known", fingerprint, label: known.label ?? null };
  return { tier: "unknown-foreign", fingerprint, label: null };
}

export function evaluateDetachedSignature(
  body: Buffer,
  signature: string | null | undefined,
  publicKeyPem: string | null | undefined,
): SignatureTrustResult {
  if (!signature || !publicKeyPem || !verifyDetached(body, signature, publicKeyPem)) {
    return { integrityValid: false, tier: "invalid", fingerprint: null, label: null };
  }
  return { integrityValid: true, ...signerTrust(publicKeyPem) };
}

function canonicalBody(att: Attestation): Buffer {
  const { signature: _s, signer: _k, ...body } = att;
  return Buffer.from(JSON.stringify(body));
}

export function buildAttestation(input: {
  repo: string; plan: RunPlan; observed: ObservedStep[]; startedAt: string;
  booted: boolean; healthVerified: boolean; healthObservation: string | null;
  healthEvidence?: HealthEvidence | null;
  observedHealthCandidates?: string[];
  failureClass: FailureClass | null; failureEvidence: string | null; explanation: string;
  verificationMode?: VerificationMode;
  bootproofOrchestrated?: boolean;
  externalHealthUrl?: string | null;
  observedStatus?: number | null;
  observedFinalUrl?: string | null;
  observedAt?: string | null;
  responseSnippet?: string;
  classification?: ExternalVerificationClassification | null;
  trust?: AttestationTrust;
}): Attestation {
  const verificationMode = input.verificationMode ?? "bootproof-orchestrated";
  const bootproofOrchestrated = verificationMode === "external-health"
    ? false
    : input.bootproofOrchestrated ?? true;
  const redactionsApplied = new Set<string>();
  const redact = <T>(value: T): T => {
    const redacted = redactJsonValue(value);
    for (const rule of redacted.applied) redactionsApplied.add(rule);
    return redacted.value as T;
  };
  const repo = gitInfo(input.repo);
  const persistedRepo = {
    ...repo,
    remote: redact(repo.remote),
  };
  const persistedPlan = redact(input.plan);
  const persistedObserved = redact(input.observed);
  const persistedHealthObservation = redact(input.healthObservation);
  const persistedHealthEvidence = redact(input.healthEvidence ?? null);
  const persistedObservedHealthCandidates = redact(input.observedHealthCandidates ?? []);
  const persistedFailureEvidence = redact(input.failureEvidence);
  const persistedExplanation = redact(input.explanation);
  const persistedExternalHealthUrl = redact(input.externalHealthUrl ?? null);
  const persistedObservedFinalUrl = redact(input.observedFinalUrl ?? null);
  const persistedResponseSnippet = redact(input.responseSnippet ?? "");
  const att: Attestation = {
    schema: "bootproof/attestation/v1",
    tool: TOOL_ID,
    verificationMode,
    bootproofOrchestrated,
    externalHealthUrl: persistedExternalHealthUrl,
    observedStatus: input.observedStatus ?? null,
    observedFinalUrl: persistedObservedFinalUrl,
    observedAt: input.observedAt ?? null,
    responseSnippet: persistedResponseSnippet,
    classification: input.classification ?? null,
    redactionsApplied: [...redactionsApplied].sort(),
    repo: persistedRepo,
    environment: { os: `${os.platform()} ${os.release()}`, arch: os.arch(), node: process.version },
    trust: input.trust ?? { level: "local_developer_signed", signer: "local_ed25519", oidc: null },
    plan: persistedPlan,
    observed: persistedObserved,
    result: {
      booted: input.booted,
      healthVerified: input.healthVerified,
      healthObservation: persistedHealthObservation,
      healthEvidence: persistedHealthEvidence,
      observedHealthCandidates: persistedObservedHealthCandidates,
      observedPort: persistedPlan.observedPort ?? null,
      healthCandidateSource: persistedPlan.healthCandidateSource ?? "inferred",
      failureClass: input.failureClass,
      failureEvidence: persistedFailureEvidence,
      explanation: persistedExplanation,
    },
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    signer: null,
    signature: null,
  };
  const { privateKey, publicKeyPem } = loadOrCreateSigner();
  att.signature = crypto.sign(null, canonicalBody(att), privateKey).toString("base64");
  att.signer = { publicKey: publicKeyPem, algorithm: "ed25519" };
  return att;
}

/**
 * Detect GitHub Actions OIDC environment. Present only when the workflow has
 * `permissions: id-token: write`. The presence of these env vars IS the consent —
 * the workflow author explicitly granted the OIDC scope.
 */
export function detectOidcEnv(env: NodeJS.ProcessEnv = process.env): { requestUrl: string; requestToken: string } | null {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
  const token = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
  if (!url || !token) return null;
  return { requestUrl: url, requestToken: token };
}

/**
 * Fetch the OIDC JWT from GitHub Actions and decode its claims (without verification —
 * verification is the receiver's job, not the signer's). Returns a compact record of
 * claims suitable for embedding in the attestation trust block.
 */
export async function fetchOidcClaims(
  requestUrl: string,
  requestToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, string>> {
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "bootproof.dev");
  const response = await fetchImpl(url.toString(), {
    headers: { authorization: `bearer ${requestToken}` },
  });
  if (!response.ok) {
    throw new Error(`OIDC token request failed with HTTP ${response.status}`);
  }
  const body = await response.json() as { value?: string };
  if (!body.value || typeof body.value !== "string") {
    throw new Error("OIDC token response did not contain a 'value' field");
  }
  // Decode the JWT payload (middle segment). No verification — the receiver verifies.
  const parts = body.value.split(".");
  if (parts.length !== 3) throw new Error("OIDC token is not a valid JWT");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  // Extract the claims that matter for provenance. Stringify everything for the schema.
  const claims: Record<string, string> = {};
  for (const key of ["iss", "sub", "aud", "ref", "repository", "repository_owner", "run_id", "run_attempt", "event_name", "workflow", "job_workflow_ref"]) {
    if (payload[key] !== undefined && payload[key] !== null) {
      claims[key] = String(payload[key]);
    }
  }
  return claims;
}

/**
 * Resolve the trust block for an attestation. When `--ci-oidc` is requested and
 * the GitHub Actions OIDC environment is present, fetch the OIDC token and return
 * a ci_oidc_signed trust block. Otherwise return local_developer_signed.
 */
export async function resolveTrust(opts: {
  ciOidc?: boolean;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
} = {}): Promise<AttestationTrust> {
  if (!opts.ciOidc) {
    return { level: "local_developer_signed", signer: "local_ed25519", oidc: null };
  }
  const oidcEnv = detectOidcEnv(opts.env);
  if (!oidcEnv) {
    throw new Error(
      "--ci-oidc was requested but ACTIONS_ID_TOKEN_REQUEST_URL/ACTIONS_ID_TOKEN_REQUEST_TOKEN are not set. "
      + "Ensure the workflow has `permissions: id-token: write`.",
    );
  }
  const claims = await fetchOidcClaims(oidcEnv.requestUrl, oidcEnv.requestToken, opts.fetchImpl);
  return { level: "ci_oidc_signed", signer: "local_ed25519", oidc: claims };
}

export function signDetached(body: Buffer): { signature: string; publicKeyPem: string } {
  const { privateKey, publicKeyPem } = loadOrCreateSigner();
  return { signature: crypto.sign(null, body, privateKey).toString("base64"), publicKeyPem };
}

export function verifyDetached(body: Buffer, signature: string, publicKeyPem: string): boolean {
  try { return crypto.verify(null, body, crypto.createPublicKey(publicKeyPem), Buffer.from(signature, "base64")); } catch { return false; }
}

export function verifySignature(att: Attestation): boolean {
  if (!att.signature || !att.signer) return false;
  return verifyDetached(canonicalBody(att), att.signature, att.signer.publicKey);
}

export function evaluateAttestationSignature(att: Attestation): SignatureTrustResult {
  return evaluateDetachedSignature(canonicalBody(att), att.signature, att.signer?.publicKey);
}

export function currentGitHead(repo: string): string | null {
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
      encoding: "utf8",
      env: buildExecutionEnv(),
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function attestationPath(repo: string): string {
  return path.join(repo, ".bootproof", "attestation.json");
}

export function writeAttestation(repo: string, att: Attestation): string {
  const p = attestationPath(repo);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(att, null, 2) + "\n");
  return p;
}
