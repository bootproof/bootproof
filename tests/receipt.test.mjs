import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { buildAttestation } from "../dist/proof.js";
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
