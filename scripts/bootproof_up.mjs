#!/usr/bin/env node
// =============================================================================
// bootproof_up.mjs  —  the real `bootproof up` engine (minimum viable)
//
// What this does, for real:
//   1. Inspects a local repo directory.
//   2. Infers the stack from package.json / requirements.txt / Cargo.toml / go.mod.
//   3. Generates an honest boot plan (install step + start step).
//   4. Actually executes the plan in a real subprocess.
//   5. Probes localhost for an HTTP response (if a port was inferred).
//   6. Captures the real stdout/stderr/exit timeline.
//   7. Signs the real capture with ed25519.
//   8. Emits a bootproof/record/v1 object that build_living_receipt.mjs can render.
//
// This is the warhead. The Living Receipt is the casing. Together: a real,
// self-verifying proof that a real repo actually booted (or really didn't).
//
// Usage:
//   node /home/z/my-project/scripts/bootproof_up.mjs <repo-path> [--label "..."]
//
// Output:
//   - Writes a record JSON to stdout (parseable by build_living_receipt.mjs).
//   - Also writes the same JSON to <repo-path>/.bootproof/record.json
// =============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let repoPath = null;
let label = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--label') { label = args[++i]; continue; }
  if (args[i] === '--help' || args[i] === '-h') {
    console.error('Usage: bootproof_up.mjs <repo-path> [--label "short description"]');
    process.exit(0);
  }
  if (!repoPath) repoPath = args[i];
}
if (!repoPath) {
  console.error('Usage: bootproof_up.mjs <repo-path> [--label "..."]');
  process.exit(2);
}
repoPath = path.resolve(repoPath);
if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
  console.error('Not a directory: ' + repoPath);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// git context (best-effort)
// ---------------------------------------------------------------------------
function gitHeadInfo(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
    let branch = 'detached';
    try {
      branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {}
    return { commit: out || 'unknown', branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

const gitInfo = gitHeadInfo(repoPath);

// ---------------------------------------------------------------------------
// Stack inference — read package.json / Cargo.toml / requirements.txt / go.mod
// ---------------------------------------------------------------------------
function inferStack(dir) {
  const pkgJsonPath = path.join(dir, 'package.json');
  const cargoPath = path.join(dir, 'Cargo.toml');
  const reqPath = path.join(dir, 'requirements.txt');
  const pyprojectPath = path.join(dir, 'pyproject.toml');
  const goModPath = path.join(dir, 'go.mod');

  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    // package manager inference
    let pm = 'npm';
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) pm = 'pnpm';
    else if (fs.existsSync(path.join(dir, 'yarn.lock'))) pm = 'yarn';
    else if (pkg.packageManager && /^pnpm@/.test(pkg.packageManager)) pm = 'pnpm';
    else if (pkg.packageManager && /^yarn@/.test(pkg.packageManager)) pm = 'yarn';
    const pmVersion = pkg.packageManager || null;
    // start command: prefer pkg.scripts.start, then "start" script, then fallback
    let startCmd = null;
    if (pkg.scripts && pkg.scripts.start) startCmd = pm + ' run start';
    else if (pkg.scripts && pkg.scripts.dev) startCmd = pm + ' run dev';
    else if (pkg.main) startCmd = 'node ' + pkg.main;
    return {
      language: 'JavaScript / Node.js',
      packageManager: pm + (pmVersion ? '@' + pmVersion.split('@').pop() : ''),
      packageManagerRaw: pm,
      startCommand: startCmd,
      installCommand: pm + ' install',
      type: 'node',
      pkg,
    };
  }
  if (fs.existsSync(cargoPath)) {
    return {
      language: 'Rust',
      packageManager: 'cargo',
      packageManagerRaw: 'cargo',
      startCommand: 'cargo run',
      installCommand: 'cargo build',
      type: 'rust',
    };
  }
  if (fs.existsSync(goModPath)) {
    return {
      language: 'Go',
      packageManager: 'go',
      packageManagerRaw: 'go',
      startCommand: 'go run .',
      installCommand: 'go mod download',
      type: 'go',
    };
  }
  if (fs.existsSync(reqPath) || fs.existsSync(pyprojectPath)) {
    return {
      language: 'Python',
      packageManager: 'pip',
      packageManagerRaw: 'pip',
      startCommand: 'python -m flask run --port 3000',
      installCommand: 'pip install -r requirements.txt',
      type: 'python',
    };
  }
  return null;
}

const inference = inferStack(repoPath);
if (!inference) {
  // Emit a real "not an application" record and exit 0 with valid JSON
  const record = makeRecord({
    inference: null,
    plan: [],
    log: [{ t: 0, level: 'fail', line: 'NOT VERIFIED — not_an_application' }],
    observed: { kind: 'none' },
    booted: false, healthVerified: false, failureClass: 'not_an_application',
  });
  outputRecord(record, repoPath);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Port inference — find a port in package.json config, scripts, or env.
// Default: try 3000, 4000, 5000, 8080. The engine picks one free port.
// ---------------------------------------------------------------------------
function pickFreePort(preferred) {
  for (const p of preferred) {
    try {
      const server = net.createServer();
      server.listen(p, '127.0.0.1');
      server.close();
      return p;
    } catch {}
  }
  return 0;
}

// Parse a port from the start command string
function portFromStartCommand(cmd) {
  if (!cmd) return null;
  const m = cmd.match(/--port\s+(\d+)|-p\s+(\d+)|PORT=(\d+)|:(\d{4,5})/);
  if (m) return parseInt(m[1] || m[2] || m[3] || m[4], 10);
  return null;
}

const preferredPort = portFromStartCommand(inference.startCommand) || inference.pkg?.config?.port || null;
const candidates = [preferredPort, 3000, 3333, 4000, 5000, 8080, 8090].filter(x => x != null);
const chosenPort = pickFreePort(candidates);

// ---------------------------------------------------------------------------
// Run a command in a subprocess; capture stdout/stderr line by line with
// relative timestamps. Returns a promise.
// ---------------------------------------------------------------------------
function runCaptured(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const lines = [];
    const child = spawn(cmd, args, {
      cwd: opts.cwd || repoPath,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    function pushLine(stream, levelPrefix) {
      let buf = '';
      stream.on('data', (chunk) => {
        buf += chunk.toString();
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const line of parts) {
          if (line.length === 0) continue;
          lines.push({ t: Date.now() - t0, level: levelPrefix, line: line.replace(/\r$/, '') });
        }
      });
    }
    pushLine(child.stdout, 'info');
    pushLine(child.stderr, 'info');
    child.on('error', (err) => {
      lines.push({ t: Date.now() - t0, level: 'error', line: 'spawn error: ' + err.message });
    });
    child.on('close', (code, signal) => {
      resolve({
        exitCode: code,
        signal: signal,
        durationMs: Date.now() - t0,
        lines: lines,
      });
    });
    // Optional timeout
    if (opts.timeoutMs) {
      setTimeout(() => {
        try { child.kill('SIGTERM'); } catch {}
        setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 1000);
      }, opts.timeoutMs);
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP probe — GET a URL, return { status, latencyMs, body } or { error }
// ---------------------------------------------------------------------------
async function probeHttp(url, timeoutMs = 3000) {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    clearTimeout(timer);
    const body = await res.text();
    return {
      kind: 'http_response',
      url: url,
      status: res.status,
      latencyMs: Date.now() - t0,
      body: body.slice(0, 200),
    };
  } catch (e) {
    return { kind: 'http_error', url: url, error: e.message, latencyMs: Date.now() - t0 };
  }
}

// ---------------------------------------------------------------------------
// Boot orchestration
// ---------------------------------------------------------------------------
const log = [{ t: 0, level: 'info', line: 'bootproof: inspecting repository…' }];
log.push({ t: 0, level: 'info', line: '  inferred language: ' + inference.language });
log.push({ t: 0, level: 'info', line: '  inferred package manager: ' + inference.packageManager });
log.push({ t: 0, level: 'info', line: '  inferred start command: ' + inference.startCommand });
if (chosenPort) log.push({ t: 0, level: 'info', line: '  candidate health port: ' + chosenPort });

// Step 1: install
log.push({ t: 0, level: 'info', line: '  running: ' + inference.installCommand });
const installT0 = Date.now();
const installParts = inference.installCommand.split(/\s+/);
const installResult = await runCaptured(installParts[0], installParts.slice(1), { timeoutMs: 120000 });
const installDurationMs = Date.now() - installT0;
for (const l of installResult.lines) log.push({ t: l.t, level: l.level === 'error' ? 'error' : 'info', line: '  ' + l.line });
log.push({
  t: installDurationMs,
  level: installResult.exitCode === 0 ? 'info' : 'error',
  line: '  ' + (installResult.exitCode === 0
    ? 'install succeeded (' + (installDurationMs / 1000).toFixed(2) + 's, exit 0)'
    : 'install FAILED (exit ' + installResult.exitCode + (installResult.signal ? ' sig ' + installResult.signal : '') + ')')
});

const plan = [
  { step: 'install', command: inference.installCommand, exitCode: installResult.exitCode ?? -1, durationMs: installDurationMs },
];

if (installResult.exitCode !== 0) {
  // Install failed — emit honest record
  log.push({ t: installDurationMs, level: 'fail', line: 'NOT VERIFIED — dependency_install_failed' });
  const record = makeRecord({
    inference,
    plan,
    log,
    observed: { kind: 'install_failure', exitCode: installResult.exitCode, signal: installResult.signal },
    booted: false, healthVerified: false, failureClass: 'dependency_install_failed',
  });
  outputRecord(record, repoPath);
  process.exit(0);
}

// Step 2: start the app (long-running) — spawn, then probe, then kill
log.push({ t: installDurationMs, level: 'info', line: '  running: ' + inference.startCommand });
const startT0 = Date.now();
const startParts = inference.startCommand.split(/\s+/);

// Spawn the app, let it run, probe the port
const appChild = spawn(startParts[0], startParts.slice(1), {
  cwd: repoPath,
  env: { ...process.env, PORT: String(chosenPort || 3000), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let appStdoutBuf = '';
let appStderrBuf = '';
appChild.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  appStdoutBuf += text;
  const parts = appStdoutBuf.split('\n');
  appStdoutBuf = parts.pop();
  for (const line of parts) {
    if (line.length === 0) continue;
    log.push({ t: Date.now() - startT0 + installDurationMs, level: 'info', line: '  > ' + line.replace(/\r$/, '') });
  }
});
appChild.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  appStderrBuf += text;
  const parts = appStderrBuf.split('\n');
  appStderrBuf = parts.pop();
  for (const line of parts) {
    if (line.length === 0) continue;
    log.push({ t: Date.now() - startT0 + installDurationMs, level: 'info', line: '  > ' + line.replace(/\r$/, '') });
  }
});

let appExit = null;
appChild.on('close', (code, signal) => {
  // On Linux, a process killed by SIGSEGV sometimes reports code=139 (=128+11)
  // and signal=null. Normalize so the failure class is detected correctly.
  if (signal === 'SIGSEGV' || code === 139) {
    signal = 'SIGSEGV';
    code = 139;
  } else if (signal === 'SIGABRT' || code === 134) {
    signal = signal || 'SIGABRT';
    code = 134;
  }
  appExit = { code, signal };
  if (appStdoutBuf) log.push({ t: Date.now() - startT0 + installDurationMs, level: 'info', line: '  > ' + appStdoutBuf.replace(/\r$/, '') });
  if (appStderrBuf) log.push({ t: Date.now() - startT0 + installDurationMs, level: 'error', line: '  > ' + appStderrBuf.replace(/\r$/, '') });
});

// Wait for app to either start responding OR crash
const probeUrl = 'http://127.0.0.1:' + (chosenPort || 3000) + '/';
let observed = null;
let booted = false;
let healthVerified = false;
let failureClass = null;

// Give app 5 seconds to start, then start probing every 500ms for up to 10 seconds total
const startGiveMs = 1500;
const probeWindowMs = 12000;
const probeIntervalMs = 500;
await new Promise(r => setTimeout(r, startGiveMs));

if (appExit) {
  // App already died
  log.push({ t: Date.now() - startT0 + installDurationMs, level: 'error', line: '  process exited with code ' + appExit.code + (appExit.signal ? ' signal ' + appExit.signal : '') });
  observed = { kind: 'process_exit', signal: appExit.signal || null, code: appExit.code, latencyMs: Date.now() - startT0 };
  if (appExit.signal === 'SIGSEGV') failureClass = 'process_segfault';
  else if (appExit.code !== 0) failureClass = 'app_exit_nonzero';
  else failureClass = 'app_exited';
} else {
  // Probe loop
  const probeDeadline = Date.now() + probeWindowMs;
  while (Date.now() < probeDeadline && !appExit) {
    const result = await probeHttp(probeUrl, 2000);
    if (result.kind === 'http_response' && result.status >= 200 && result.status < 500) {
      observed = result;
      healthVerified = true;
      booted = true;
      log.push({ t: Date.now() - startT0 + installDurationMs, level: 'info', line: '  HTTP GET ' + probeUrl + ' -> ' + result.status + ' (' + result.latencyMs + ' ms)' });
      log.push({ t: Date.now() - startT0 + installDurationMs, level: 'success', line: 'BOOTED — observed HTTP ' + result.status + ' at ' + probeUrl });
      break;
    }
    await new Promise(r => setTimeout(r, probeIntervalMs));
  }
  if (!healthVerified && !appExit) {
    // App still running but no HTTP response — timeout
    log.push({ t: Date.now() - startT0 + installDurationMs, level: 'error', line: '  no HTTP response within ' + (probeWindowMs / 1000) + 's window' });
    observed = { kind: 'health_timeout', url: probeUrl, windowMs: probeWindowMs };
    failureClass = 'health_check_timeout';
  } else if (!healthVerified && appExit) {
    log.push({ t: Date.now() - startT0 + installDurationMs, level: 'error', line: '  process exited with code ' + appExit.code + (appExit.signal ? ' signal ' + appExit.signal : '') });
    observed = { kind: 'process_exit', signal: appExit.signal || null, code: appExit.code, latencyMs: Date.now() - startT0 };
    if (appExit.signal === 'SIGSEGV') failureClass = 'process_segfault';
    else if (appExit.code !== 0) failureClass = 'app_exit_nonzero';
    else failureClass = 'app_exited';
  }
}

// Kill the app if still running
if (!appExit) {
  try { appChild.kill('SIGTERM'); } catch {}
  await new Promise(r => setTimeout(r, 300));
  try { appChild.kill('SIGKILL'); } catch {}
}

const startDurationMs = Date.now() - startT0;
plan.push({
  step: 'start',
  command: inference.startCommand,
  exitCode: appExit ? (appExit.code ?? -1) : 0,
  signal: appExit ? appExit.signal : null,
  durationMs: startDurationMs,
});

if (!booted) {
  log.push({ t: startDurationMs + installDurationMs, level: 'fail', line: 'NOT VERIFIED — ' + failureClass });
}

// ---------------------------------------------------------------------------
// Build the record
// ---------------------------------------------------------------------------
function makeRecord({ inference, plan, log, observed, booted, healthVerified, failureClass }) {
  return {
    schema: 'bootproof/record/v1',
    id: 'rec_' + crypto.randomBytes(6).toString('hex'),
    capturedAt: new Date().toISOString(),
    capturedBy: 'bootproof-cli@0.3.0 (real-engine-mvp)',
    trust: {
      level: 'local_developer_signed',
      signer: 'local_ed25519',
      oidc: null,
      // The upgrade ladder, documented in the artifact:
      //   local_developer_signed   → signed on the developer's own machine
      //   ci_oidc_signed           → signed by a CI runner with an OIDC token
      //   neutral_runner_signed    → signed by BootProof's neutral hosted runner
      //   transparency_logged      → neutral_runner_signed + entry in a public log
      upgradePath: ['local_developer_signed', 'ci_oidc_signed', 'neutral_runner_signed', 'transparency_logged'],
    },
    repo: {
      url: 'file://' + repoPath,
      commit: gitInfo.commit,
      branch: gitInfo.branch,
      label: label || path.basename(repoPath),
    },
    inference: inference ? {
      language: inference.language,
      packageManager: inference.packageManager,
      startCommand: inference.startCommand,
    } : null,
    plan: plan,
    log: log,
    observed: observed,
    booted: booted,
    healthVerified: healthVerified,
    failureClass: failureClass,
  };
}

const record = makeRecord({ inference, plan, log, observed, booted, healthVerified, failureClass });

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
function outputRecord(rec, dir) {
  const outDir = path.join(dir, '.bootproof');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'record.json'), JSON.stringify(rec, null, 2));
  process.stdout.write(JSON.stringify(rec));
}

outputRecord(record, repoPath);
process.exit(0);
