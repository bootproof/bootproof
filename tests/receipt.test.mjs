import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { buildAttestation, detectOidcEnv, resolveTrust, rotateSigner, verifySignature, writeAttestation } from "../dist/proof.js";
import { emitLivingReceipt, attestationToRecord } from "../dist/receipt.js";

function minimalInference(repoPath) {
  return {
    repoPath,
    isApplication: true,
    stack: ["node-backend"],
    backendMarkers: ["package.json"],
    frontendMarkers: [],
    serviceMarkers: [],
    repoComposeFile: null,
    composeApplicationServices: [],
    composeHealthCandidates: [],
    setupSteps: [],
    packageManager: "npm",
    packageManagerEvidence: "package.json found",
    packageManagerVersion: null,
    installCommand: "npm install",
    preparationCommands: [],
    dependencyInstallRequired: true,
    appCommand: "npm run start",
    appCommandSource: "scripts.start",
    selectedPackageScriptName: "start",
    selectedPackageScriptCommand: "node index.js",
    projectCliCommand: null,
    projectCliReady: null,
    backendCommand: null,
    frontendCommand: null,
    asset_dev_server_command: null,
    workerCommand: null,
    commandScope: "application",
    incompleteAppCommand: false,
    multiAppCommand: false,
    port: 3000,
    portEvidence: "default",
    observedPort: 3000,
    healthCandidateSource: "inferred",
    healthCandidates: ["http://localhost:3000/"],
    services: [],
    requiredEnv: [],
    envWithoutSafeDefault: [],
    engines: {},
    workspaces: [],
    confidence: 0.6,
  };
}

function minimalPlan() {
  return {
    provider: "local",
    steps: [
      { id: "install", kind: "install", command: "npm install", description: "install deps", required: true },
      { id: "start-app", kind: "start-app", command: "npm run start", description: "start app", required: true },
      { id: "health", kind: "health", description: "probe health", required: true },
    ],
    healthUrl: "http://localhost:3000/",
    healthCandidates: ["http://localhost:3000/"],
    observedPort: 3000,
    healthCandidateSource: "observed",
    generatedFiles: [],
  };
}

function minimalObserved() {
  const now = new Date().toISOString();
  return [
    {
      id: "install",
      kind: "install",
      command: "npm install",
      startedAt: now,
      finishedAt: now,
      exitCode: 0,
      ok: true,
      observation: "dependencies installed",
    },
    {
      id: "start-app",
      kind: "start-app",
      command: "npm run start",
      startedAt: now,
      finishedAt: now,
      exitCode: 0,
      ok: true,
      observation: "app process started and was supervised",
    },
    {
      id: "health",
      kind: "health",
      startedAt: now,
      finishedAt: now,
      exitCode: 0,
      ok: true,
      observation: "observed HTTP 200 at http://localhost:3000/",
    },
  ];
}

test("emitLivingReceipt writes a self-contained HTML file with embedded signature", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bootproof-receipt-test-"));
  try {
    // Build a minimal attestation with a real git repo (the tmp dir has no .git,
    // but gitInfo handles that gracefully)
    const repoPath = tmpDir;
    // init a git repo so gitInfo returns a commit
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoPath, stdio: "pipe" });
    fs.writeFileSync(path.join(repoPath, "README.md"), "# test\n");
    execFileSync("git", ["add", "."], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: repoPath, stdio: "pipe" });

    const inf = minimalInference(repoPath);
    const plan = minimalPlan();
    const observed = minimalObserved();
    const att = buildAttestation({
      repo: repoPath,
      plan,
      observed,
      startedAt: new Date().toISOString(),
      booted: true,
      healthVerified: true,
      healthObservation: "HTTP 200 at http://localhost:3000/",
      healthEvidence: {
        requestedUrl: "http://localhost:3000/",
        statusCode: 200,
        statusText: "OK",
        headers: {},
        redirectLocation: null,
        bodyExcerpt: "OK",
        timestamp: new Date().toISOString(),
        acceptedAsHealthy: true,
        connectionError: null,
      },
      failureClass: null,
      failureEvidence: null,
      explanation: "Verified: HTTP 200 observed.",
    });

    const outPath = path.join(tmpDir, "living-receipt.html");
    emitLivingReceipt(att, outPath);

    // File exists and is non-trivial
    assert.ok(fs.existsSync(outPath), "receipt file should exist");
    const html = fs.readFileSync(outPath, "utf8");
    assert.ok(html.length > 10000, `receipt should be >10KB, got ${html.length}`);

    // Contains the key structural elements
    assert.ok(html.includes("Bootproof"), "should contain brand name");
    assert.ok(html.includes("Living Receipt"), "should contain 'Living Receipt'");
    assert.ok(html.includes("the run button that can't lie"), "should contain tagline");
    assert.ok(html.includes("BOOTED"), "should contain BOOTED verdict");
    assert.ok(html.includes("HTTP 200"), "should contain HTTP 200 evidence");
    assert.ok(html.includes("Ed25519"), "should mention Ed25519");
    assert.ok(html.includes("BootProofFallback"), "should contain fallback verifier bundle");
    assert.ok(html.toLowerCase().includes("trust ladder"), "should document the trust ladder");

    // Contains a valid-looking signature (base64, long enough)
    const sigMatch = html.match(/"signature":"([A-Za-z0-9+/=]{80,})"/);
    assert.ok(sigMatch, "should contain a base64 signature of sufficient length");

    // Contains a valid-looking public key (SPKI base64)
    const keyMatch = html.match(/"publicKey":"([A-Za-z0-9+/=]{60,})"/);
    assert.ok(keyMatch, "should contain a base64 public key");

    // No external script dependencies (self-contained)
    assert.ok(!html.includes('src="http'), "should not load external scripts");
    assert.ok(!html.match(/<script[^>]*src=["']https?:\/\//), "should not have external script src");

    // The record conversion preserves the verdict
    const record = attestationToRecord(att);
    assert.equal(record.booted, true, "record should preserve booted=true");
    assert.equal(record.healthVerified, true, "record should preserve healthVerified=true");
    assert.equal(record.failureClass, null, "record should preserve failureClass=null");
    assert.ok(record.log.length > 0, "record should have log entries");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("emitLivingReceipt preserves honest failure verdicts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bootproof-receipt-fail-"));
  try {
    const repoPath = tmpDir;
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoPath, stdio: "pipe" });
    fs.writeFileSync(path.join(repoPath, "README.md"), "# test\n");
    execFileSync("git", ["add", "."], { cwd: repoPath, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: repoPath, stdio: "pipe" });

    const inf = minimalInference(repoPath);
    const plan = minimalPlan();
    const observed = [
      {
        id: "install",
        kind: "install",
        command: "pnpm install",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: -2,
        ok: false,
        observation: "spawn pnpm ENOENT",
        firstErrorLine: "Error: spawn pnpm ENOENT",
      },
    ];

    const att = buildAttestation({
      repo: repoPath,
      plan,
      observed,
      startedAt: new Date().toISOString(),
      booted: false,
      healthVerified: false,
      healthObservation: null,
      failureClass: "install_failed",
      failureEvidence: "spawn pnpm ENOENT",
      explanation: "pnpm is not installed.",
    });

    const outPath = path.join(tmpDir, "living-receipt.html");
    emitLivingReceipt(att, outPath);

    const html = fs.readFileSync(outPath, "utf8");
    assert.ok(html.includes("NOT BOOTED"), "should contain NOT BOOTED verdict");
    assert.ok(html.includes("install_failed"), "should contain failure class");
    assert.ok(html.includes("ENOENT"), "should contain real error evidence");

    const record = attestationToRecord(att);
    assert.equal(record.booted, false);
    assert.equal(record.failureClass, "install_failed");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("OIDC: detectOidcEnv returns null without GitHub Actions env vars", () => {
  assert.equal(detectOidcEnv({}), null);
  assert.equal(detectOidcEnv({ ACTIONS_ID_TOKEN_REQUEST_URL: "only-url" }), null);
  assert.equal(detectOidcEnv({ ACTIONS_ID_TOKEN_REQUEST_TOKEN: "only-token" }), null);
  assert.ok(detectOidcEnv({
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/example",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "abc123",
  }));
});

test("OIDC: resolveTrust returns local_developer_signed without --ci-oidc", async () => {
  const trust = await resolveTrust({ ciOidc: false });
  assert.equal(trust.level, "local_developer_signed");
  assert.equal(trust.signer, "local_ed25519");
  assert.equal(trust.oidc, null);
});

test("OIDC: resolveTrust throws on --ci-oidc without env vars", async () => {
  await assert.rejects(
    resolveTrust({ ciOidc: true, env: {} }),
    /--ci-oidc was requested but ACTIONS_ID_TOKEN_REQUEST_URL/,
  );
});

test("OIDC: resolveTrust fetches claims and returns ci_oidc_signed", async () => {
  // Construct a fake JWT payload with GitHub Actions claims.
  const payload = {
    iss: "https://token.actions.githubusercontent.com",
    sub: "repo:bootproof/bootproof:ref:refs/heads/main",
    aud: "bootproof.dev",
    ref: "refs/heads/main",
    repository: "bootproof/bootproof",
    repository_owner: "bootproof",
    run_id: "123456",
    run_attempt: "1",
    event_name: "push",
    workflow: "CI",
    job_workflow_ref: "bootproof/bootproof/.github/workflows/ci.yml@refs/heads/main",
  };
  const fakeJwt = `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
  const trust = await resolveTrust({
    ciOidc: true,
    env: {
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/example",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "abc123",
    },
    fetchImpl: async (url) => {
      assert.ok(url.includes("audience=bootproof.dev"), "must request the bootproof.dev audience");
      return new Response(JSON.stringify({ value: fakeJwt }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(trust.level, "ci_oidc_signed");
  assert.equal(trust.signer, "local_ed25519");
  assert.equal(trust.oidc.iss, "https://token.actions.githubusercontent.com");
  assert.equal(trust.oidc.sub, "repo:bootproof/bootproof:ref:refs/heads/main");
  assert.equal(trust.oidc.repository, "bootproof/bootproof");
  assert.equal(trust.oidc.run_id, "123456");
});

test("OIDC: buildAttestation embeds ci_oidc_signed trust when provided", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "bp-oidc-"));
  try {
    const trust = {
      level: "ci_oidc_signed",
      signer: "local_ed25519",
      oidc: { iss: "https://token.actions.githubusercontent.com", sub: "repo:test:ref:main" },
    };
    const att = buildAttestation({
      repo: tmpDir,
      plan: minimalPlan(),
      observed: minimalObserved(),
      startedAt: new Date().toISOString(),
      booted: true,
      healthVerified: true,
      healthObservation: "HTTP 200 at http://localhost:3000/",
      failureClass: null,
      failureEvidence: null,
      explanation: "test",
      trust,
    });
    assert.equal(att.trust.level, "ci_oidc_signed");
    assert.equal(att.trust.oidc.iss, "https://token.actions.githubusercontent.com");
    assert.equal(att.trust.oidc.sub, "repo:test:ref:main");
    // The signature must still verify with the ci_oidc_signed trust embedded.
    const { verifySignature } = await import("../dist/proof.js");
    assert.ok(verifySignature(att), "ci_oidc_signed attestation must verify");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("rotate-keys: generates a new keypair and backs up the old key", () => {
  const homeBackup = process.env.HOME;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "bp-rotate-home-"));
  try {
    process.env.HOME = tmpHome;
    // First, create an initial key by building an attestation.
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "bp-rotate-repo-"));
    try {
      const att1 = buildAttestation({
        repo: tmpRepo,
        plan: minimalPlan(),
        observed: minimalObserved(),
        startedAt: new Date().toISOString(),
        booted: true,
        healthVerified: true,
        healthObservation: "HTTP 200",
        failureClass: null,
        failureEvidence: null,
        explanation: "test",
      });
      const oldPublicKey = att1.signer.publicKey;

      // Rotate.
      const result = rotateSigner({ backup: true });
      assert.equal(result.schema, "bootproof/key-rotation/v1");
      assert.ok(result.oldPublicKey.includes("BEGIN PUBLIC KEY"));
      assert.ok(result.newPublicKey.includes("BEGIN PUBLIC KEY"));
      assert.notEqual(result.oldPublicKey, result.newPublicKey, "new key must differ from old");
      assert.ok(result.backedUpTo, "old key must be backed up");
      assert.ok(fs.existsSync(result.backedUpTo), "backup file must exist");

      // Build a second attestation — it must use the NEW key.
      const att2 = buildAttestation({
        repo: tmpRepo,
        plan: minimalPlan(),
        observed: minimalObserved(),
        startedAt: new Date().toISOString(),
        booted: true,
        healthVerified: true,
        healthObservation: "HTTP 200",
        failureClass: null,
        failureEvidence: null,
        explanation: "test after rotation",
      });
      assert.notEqual(att2.signer.publicKey, oldPublicKey, "new attestation must use the new key");
      assert.equal(att2.signer.publicKey, result.newPublicKey, "new attestation key must match rotation result");
      assert.ok(verifySignature(att2), "new attestation must verify");

      // The OLD attestation must STILL verify with its embedded (old) public key.
      assert.ok(verifySignature(att1), "old attestation must still verify after rotation");
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  } finally {
    process.env.HOME = homeBackup;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test("rotate-keys: --resign re-signs the latest attestation with the new key", () => {
  const homeBackup = process.env.HOME;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "bp-resign-home-"));
  try {
    process.env.HOME = tmpHome;
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "bp-resign-repo-"));
    try {
      // Write an attestation with the old key.
      const att = buildAttestation({
        repo: tmpRepo,
        plan: minimalPlan(),
        observed: minimalObserved(),
        startedAt: new Date().toISOString(),
        booted: true,
        healthVerified: true,
        healthObservation: "HTTP 200",
        failureClass: null,
        failureEvidence: null,
        explanation: "before rotation",
      });
      writeAttestation(tmpRepo, att);
      const oldPublicKey = att.signer.publicKey;
      const oldSignature = att.signature;

      // Rotate with --resign.
      const result = rotateSigner({ repo: tmpRepo, resignAttestation: true, backup: false });
      assert.equal(result.reSignedAttestation, true);
      assert.notEqual(result.newPublicKey, oldPublicKey);

      // Read the re-signed attestation.
      const reSigned = JSON.parse(fs.readFileSync(path.join(tmpRepo, ".bootproof", "attestation.json"), "utf8"));
      assert.notEqual(reSigned.signature, oldSignature, "signature must change after re-signing");
      assert.equal(reSigned.signer.publicKey, result.newPublicKey, "attestation must carry the new public key");
      assert.ok(verifySignature(reSigned), "re-signed attestation must verify with the new key");
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  } finally {
    process.env.HOME = homeBackup;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test("key files are written with 0600 permissions and directories with 0700", () => {
  const homeBackup = process.env.HOME;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "bp-perms-"));
  try {
    process.env.HOME = tmpHome;
    buildAttestation({
      repo: tmpHome,
      plan: minimalPlan(),
      observed: minimalObserved(),
      startedAt: new Date().toISOString(),
      booted: true,
      healthVerified: true,
      healthObservation: "HTTP 200",
      failureClass: null,
      failureEvidence: null,
      explanation: "test",
    });
    const signerPath = path.join(tmpHome, ".bootproof", "signer.json");
    assert.ok(fs.existsSync(signerPath), "signer.json must exist");
    const signerMode = fs.statSync(signerPath).mode & 0o777;
    assert.equal(signerMode, 0o600, `signer.json must be 0600, got ${signerMode.toString(8)}`);
    const bootproofDir = path.join(tmpHome, ".bootproof");
    const dirMode = fs.statSync(bootproofDir).mode & 0o777;
    assert.equal(dirMode, 0o700, `~/.bootproof must be 0700, got ${dirMode.toString(8)}`);
  } finally {
    process.env.HOME = homeBackup;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});
