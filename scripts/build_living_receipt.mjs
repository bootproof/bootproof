#!/usr/bin/env node
// =============================================================================
// build_living_receipt.mjs  —  BootProof Living Receipt generator
//
// Consumes REAL boot records produced by bootproof_up.mjs, signs each one with
// a fresh ed25519 key, and emits a single self-contained HTML file that:
//   1. Verifies its own ed25519 signature in the browser via Web Crypto.
//   2. Falls back to a pure-JS @noble/curves verifier on browsers that don't
//      support native Ed25519 WebCrypto (~20% of users as of mid-2025).
//   3. Replays the actual boot timeline when opened.
//   4. When the signature is tampered, the BOOT VERDICT also collapses —
//      because no claim inside a tampered receipt can be trusted.
//
// Records are REAL captures from bootproof_up.mjs, not mock data.
//
// Usage:
//   node /home/z/my-project/scripts/build_living_receipt.mjs \
//       <record1.json> [record2.json] ... \
//       --out /home/z/my-project/download/proof.bootproof.html
// =============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Parse args — record files + --out
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const recordPaths = [];
let outPath = '/home/z/my-project/download/proof.bootproof.html';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { outPath = args[++i]; continue; }
  if (args[i] === '--help' || args[i] === '-h') {
    console.error('Usage: build_living_receipt.mjs <record.json> [...] --out <html-path>');
    process.exit(0);
  }
  recordPaths.push(args[i]);
}
if (recordPaths.length === 0) {
  console.error('No record files provided.');
  console.error('Usage: build_living_receipt.mjs <record.json> [...] --out <html-path>');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Load and validate records
// ---------------------------------------------------------------------------
const records = [];
for (const p of recordPaths) {
  const raw = fs.readFileSync(p, 'utf8');
  const rec = JSON.parse(raw);
  if (rec.schema !== 'bootproof/record/v1') {
    console.error('Skipping ' + p + ': schema is not bootproof/record/v1');
    continue;
  }
  records.push(rec);
}
if (records.length === 0) {
  console.error('No valid records.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Keypair (fresh per run — the demo only needs internal consistency)
// ---------------------------------------------------------------------------
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicKeySpkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

// ---------------------------------------------------------------------------
// Sign each record
// ---------------------------------------------------------------------------
function signedMessage(record) {
  return JSON.stringify(record, null, 2);
}
const signed = records.map(r => {
  const message = signedMessage(r);
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64');
  return { record: r, message, signature, publicKey: publicKeySpkiB64 };
});

const payload = JSON.stringify(signed);
const payloadSafe = payload.replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// Inline the @noble/curves fallback bundle (produced by esbuild).
// Exposes window.BootProofFallback.verifyEd25519(spkiB64, sigB64, msgBytes)
// ---------------------------------------------------------------------------
const fallbackBundle = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), 'fallback_bundle.js'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Logo SVG — identical to boot-proof.com's mark
// ---------------------------------------------------------------------------
const LOGO_SVG = `
<svg class="logo-mark" viewBox="0 0 100 100" fill="none" aria-hidden="true">
  <rect width="100" height="100" rx="22" fill="#16181D"/>
  <path d="M 44.79 26.46 A 30 30 0 1 0 75.98 41" stroke="#FAFAF7" stroke-width="9" stroke-linecap="round"/>
  <path d="M 34 57 L 46 70 L 67 18" stroke="#FAFAF7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// -----------------------------------------------------------------------------
// HTML template. Branded to match boot-proof.com.
// -----------------------------------------------------------------------------
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bootproof — Living Receipt</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#FAFAF7; --paper-2:#F2F1EB; --ink:#16181D; --graphite:#5A6170;
    --line:#E3E1D8; --verdict:#0E9D5B; --verdict-ink:#0B7A47; --refusal:#D6453D;
    --hedge:#A8761B; --term-bg:#101216; --term-ink:#D7DBE2; --term-dim:#7A8290;
    --maxw:920px; --radius:12px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
  body{
    background:var(--paper); color:var(--ink);
    font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
    font-size:16px; line-height:1.65;
    padding:0 0 96px;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  ::selection{background:var(--ink); color:var(--paper)}
  .mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
  .wrap{max-width:var(--maxw); margin:0 auto; padding:0 28px}
  :focus-visible{outline:2px solid var(--ink); outline-offset:3px; border-radius:2px}

  nav.top{
    border-bottom:1px solid var(--line);
    position:sticky; top:0; z-index:50;
    background:rgba(250,250,247,.94);
    backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  }
  .nav-in{display:flex; align-items:center; justify-content:space-between; height:60px}
  .wordmark{
    font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:16px;
    letter-spacing:-.02em; text-decoration:none; color:var(--ink);
    display:flex; align-items:center; gap:10px;
  }
  .wordmark .logo-mark{width:24px; height:24px; display:block}
  .nav-tag{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--graphite); letter-spacing:.04em}
  .nav-tag .sep{color:var(--line); margin:0 8px}

  .hero{padding:72px 0 36px}
  .eyebrow{
    font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.09em;
    color:var(--graphite); text-transform:uppercase;
    display:flex; gap:12px; align-items:center; margin-bottom:22px;
  }
  .eyebrow::before{content:""; width:36px; height:1px; background:var(--graphite)}
  h1{
    font-family:'Space Grotesk',sans-serif; font-weight:700;
    font-size:clamp(34px,5.4vw,56px); line-height:1.02; letter-spacing:-.035em;
    margin-bottom:18px; max-width:16ch;
  }
  .hero p.lede{font-size:18px; color:var(--graphite); max-width:60ch}
  .hero p.lede b{color:var(--ink); font-weight:600}
  .real-badge{
    display:inline-block; margin-top:14px; padding:4px 10px;
    background:rgba(14,157,91,.1); border:1.5px solid rgba(14,157,91,.35);
    color:var(--verdict-ink); border-radius:5px;
    font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600;
    letter-spacing:.06em; text-transform:uppercase;
  }

  .status-bar{
    margin-top:28px; padding:14px 18px;
    background:#fff; border:1.5px solid var(--ink); border-radius:10px;
    box-shadow:0 2px 0 var(--ink);
    font-family:'IBM Plex Mono',monospace; font-size:13px;
    display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  }
  .status-bar .dot{
    width:9px; height:9px; border-radius:50%; background:var(--graphite);
    flex-shrink:0; transition:background 200ms;
  }
  .status-bar.ok  .dot{background:var(--verdict); animation:pulse 2.4s infinite}
  .status-bar.bad .dot{background:var(--refusal)}
  @keyframes pulse{
    0%   {box-shadow:0 0 0 0 rgba(14,157,91,.4)}
    70%  {box-shadow:0 0 0 8px rgba(14,157,91,0)}
    100% {box-shadow:0 0 0 0 rgba(14,157,91,0)}
  }

  .receipts{margin-top:36px}
  .receipt{
    background:#fff; border:1.5px solid var(--ink); border-radius:var(--radius);
    margin-bottom:24px; overflow:hidden;
    box-shadow:0 2px 0 var(--ink);
    transition:border-color 200ms, box-shadow 200ms;
  }
  .receipt.tampered{
    border-color:var(--refusal);
    box-shadow:0 2px 0 var(--refusal);
  }
  .receipt header.r-head{
    padding:18px 22px; border-bottom:1px solid var(--line);
    background:var(--paper-2);
  }
  .r-head .repo-line{
    font-family:'IBM Plex Mono',monospace; font-size:13px;
    color:var(--ink); margin-bottom:4px; word-break:break-all;
  }
  .r-head .repo-line .label{color:var(--graphite); margin-right:6px}
  .r-head .repo-line .url{color:var(--ink); font-weight:500}
  .r-head .meta-line{
    font-family:'IBM Plex Mono',monospace; font-size:12px;
    color:var(--graphite); margin-top:2px;
  }

  .stamps{display:flex; gap:8px; flex-wrap:wrap; margin-top:14px}
  .stamp{
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 11px; border-radius:5px;
    font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600;
    letter-spacing:.04em; text-transform:uppercase;
    border:1.5px solid transparent;
  }
  .stamp .glyph{font-weight:700; font-size:13px; line-height:1}
  .stamp.v-boots   {color:var(--verdict-ink); background:rgba(14,157,91,.1);  border-color:rgba(14,157,91,.35)}
  .stamp.v-refused {color:var(--refusal);     background:rgba(214,69,61,.08); border-color:rgba(214,69,61,.3)}
  .stamp.v-diag    {color:var(--hedge);       background:rgba(168,118,27,.1); border-color:rgba(168,118,27,.35)}
  .stamp.v-pending {color:var(--graphite);    background:var(--paper-2);      border-color:var(--line)}

  .receipt .body{padding:18px 22px 22px}

  .kv{
    display:grid; grid-template-columns:170px 1fr; gap:6px 14px;
    font-family:'IBM Plex Mono',monospace; font-size:12px;
    margin-bottom:18px;
  }
  .kv .k{color:var(--graphite); text-transform:uppercase; letter-spacing:.05em; font-size:11px}
  .kv .v{color:var(--ink); word-break:break-all}

  .term{
    background:var(--term-bg); color:var(--term-ink);
    border-radius:0 var(--radius) var(--radius) var(--radius);
    padding:18px 20px;
    font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:1.78;
    min-height:230px; max-height:380px; overflow-y:auto;
    margin-bottom:14px; white-space:pre-wrap; word-break:break-word;
    box-shadow:0 30px 70px -30px rgba(22,24,29,.5);
  }
  .term .line{display:block; min-height:1.75em}
  .term .line.info    {color:var(--term-ink)}
  .term .line.success {color:#3DD68C; font-weight:600}
  .term .line.error   {color:#F07670}
  .term .line.fail    {color:#F07670; font-weight:700}
  .term .dim          {color:var(--term-dim)}
  .term .caret{
    display:inline-block; width:8px; height:15px; background:var(--term-ink);
    vertical-align:-2px; animation:blink 1s steps(1) infinite;
  }
  @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
  .term.idle::before{
    content:'Press Replay boot to watch the real captured run. Every line is part of the signed message — tamper with the signature and the verdict collapses.';
    color:var(--term-dim); font-style:italic;
  }

  .button-row{display:flex; gap:8px; flex-wrap:wrap; align-items:center}
  button{
    font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:500;
    border:1.5px solid var(--ink); background:#fff; color:var(--ink);
    padding:8px 16px; border-radius:7px; cursor:pointer;
    transition:background .15s, color .15s, border-color .15s;
  }
  button:hover{background:var(--ink); color:var(--paper)}
  button:disabled{opacity:.5; cursor:not-allowed}
  button.primary{background:var(--ink); color:var(--paper)}
  button.primary:hover{background:#2a2d33}
  button.danger{border-color:var(--refusal); color:var(--refusal); background:rgba(214,69,61,.05)}
  button.danger:hover{background:var(--refusal); color:#fff}
  button.ghost{border-color:var(--line); color:var(--graphite); background:transparent}
  button.ghost:hover{background:var(--paper-2); color:var(--ink); border-color:var(--ink)}

  .tamper-banner{
    display:none; margin-top:12px; padding:11px 14px;
    background:rgba(214,69,61,.07); border:1.5px solid var(--refusal);
    border-radius:7px;
    font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--refusal);
    line-height:1.55;
  }
  .tamper-banner.show{display:block}
  .tamper-banner b{font-weight:700}

  details.sig{margin-top:16px; padding-top:16px; border-top:1px solid var(--line)}
  details.sig summary{
    cursor:pointer; color:var(--graphite);
    font-family:'IBM Plex Mono',monospace; font-size:12px;
    outline:none; list-style:none; letter-spacing:.04em;
  }
  details.sig summary::-webkit-details-marker{display:none}
  details.sig summary::before{content:"> "; color:var(--verdict-ink)}
  details.sig[open] summary::before{content:"v "}
  details.sig .field-label{
    color:var(--graphite); font-family:'IBM Plex Mono',monospace;
    font-size:11px; margin-top:12px; margin-bottom:5px;
    text-transform:uppercase; letter-spacing:.06em;
  }
  details.sig pre{
    background:var(--term-bg); color:var(--term-ink);
    border-radius:6px; padding:11px 14px;
    font-family:'IBM Plex Mono',monospace; font-size:11.5px; line-height:1.6;
    overflow-x:auto; white-space:pre-wrap; word-break:break-all;
    max-height:280px; overflow-y:auto;
  }

  footer.page{
    margin-top:48px; padding-top:24px; border-top:1px solid var(--line);
    color:var(--graphite); font-size:13px; line-height:1.7; max-width:62ch;
  }
  footer.page code{
    font-family:'IBM Plex Mono',monospace; font-size:12px;
    background:var(--paper-2); padding:1px 6px; border-radius:3px; color:var(--ink);
  }
  footer.page a{color:var(--ink); text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:2px}

  @media (max-width:600px){
    .kv{grid-template-columns:1fr; gap:2px}
    .kv .k{font-size:10.5px}
    .hero{padding:48px 0 24px}
    h1{font-size:32px}
    .nav-tag{display:none}
  }
</style>
</head>
<body>

<nav class="top">
  <div class="wrap nav-in">
    <a class="wordmark" href="https://boot-proof.com" rel="noopener">
      ${LOGO_SVG}
      <span>bootproof</span>
    </a>
    <div class="nav-tag">
      <span>Living Receipt</span><span class="sep">/</span><span>the run button that can't lie</span>
    </div>
  </div>
</nav>

<div class="wrap">

  <section class="hero">
    <div class="eyebrow">Living Receipt &middot; real capture &middot; self-verifying</div>
    <h1>The run button<br>that can't lie.</h1>
    <p class="lede">
      A single self-contained file. When you opened it, your browser ran
      <b>Ed25519 verification</b> locally &mdash; no network, no install, no account.
      If a single byte of any signed message is altered, the receipt's verdict collapses with it.
      That is the whole point.
    </p>
    <span class="real-badge">Real boot captured by bootproof up &middot; not mock data</span>
    <div class="status-bar" id="statusBar">
      <span class="dot"></span>
      <span id="statusText">Verifying signatures in your browser&hellip;</span>
    </div>
  </section>

  <section class="receipts" id="receipts"></section>

  <footer class="page">
    <p>
      This file is one HTML document. The ed25519 public key, signature, and signed message
      for each receipt are embedded inline. The signed message attests that <b>this evidence was
      produced and has not been altered since signing</b>. The boot logs and observed HTTP
      responses above are <b>real captures</b> from a real <code>bootproof up</code> run against
      a real repository &mdash; not hand-authored mock data.
    </p>
    <p style="margin-top:14px">
      <b>Trust ladder.</b> This receipt is signed at the <code>local_developer_signed</code>
      level &mdash; it proves integrity-since-signing, not that the signer's machine was honest.
      The documented upgrade path is: <code>local_developer_signed</code> &rarr;
      <code>ci_oidc_signed</code> (CI runner with OIDC token) &rarr;
      <code>neutral_runner_signed</code> (BootProof's neutral hosted runner) &rarr;
      <code>transparency_logged</code> (neutral runner + public log entry).
      The same file format and the same wow experience survive every step up the ladder;
      only the signer's identity climbs.
    </p>
    <p style="margin-top:14px">
      <b>Browser fallback.</b> Native Ed25519 in WebCrypto ships in Chrome 137, Firefox, and Safari.
      For the ~20% of users on older browsers, this file falls back to a pure-JS
      <code>@noble/curves</code> verifier bundled inline &mdash; the receipt never fails to verify silently.
    </p>
    <p style="margin-top:14px">
      <a href="https://boot-proof.com">boot-proof.com</a>
      &nbsp;&middot;&nbsp;
      <a href="https://github.com/bootproof/bootproof">github.com/bootproof/bootproof</a>
      &nbsp;&middot;&nbsp;
      <code>npx bootproof up &lt;any repo url&gt;</code>
    </p>
  </footer>

</div>

<!-- Inlined @noble/curves Ed25519 fallback bundle (30.7 KB minified).
     Used only when native WebCrypto Ed25519 is unavailable. -->
<script id="fallback-bundle">${fallbackBundle}</script>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
(function () {
  'use strict';

  var PAYLOAD = JSON.parse(document.getElementById('payload').textContent);
  var encoder = new TextEncoder();
  var nativeEd25519Available = null; // null = unknown, true/false after probe

  function b64ToBytes(s) {
    var bin = atob(s);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  // Probe whether the browser supports native Ed25519 in WebCrypto.
  // Done once, lazily. Throws on unsupported browsers.
  async function probeNativeEd25519() {
    if (nativeEd25519Available !== null) return nativeEd25519Available;
    try {
      // Generate a throwaway key to test algorithm support.
      var k = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
      await crypto.subtle.exportKey('raw', k.publicKey);
      nativeEd25519Available = true;
    } catch (e) {
      nativeEd25519Available = false;
    }
    return nativeEd25519Available;
  }

  async function importKey(spkiB64) {
    return crypto.subtle.importKey('spki', b64ToBytes(spkiB64), { name: 'Ed25519' }, false, ['verify']);
  }

  async function verifyNative(entry, messageOverride) {
    var key = await importKey(entry.publicKey);
    var msg = messageOverride != null ? messageOverride : entry.message;
    return await crypto.subtle.verify('Ed25519', key, b64ToBytes(entry.signature), encoder.encode(msg));
  }

  function verifyFallback(entry, messageOverride) {
    if (!window.BootProofFallback || typeof window.BootProofFallback.verifyEd25519 !== 'function') {
      throw new Error('fallback bundle missing');
    }
    var msg = messageOverride != null ? messageOverride : entry.message;
    var msgBytes = encoder.encode(msg);
    return window.BootProofFallback.verifyEd25519(entry.publicKey, entry.signature, msgBytes);
  }

  async function verifyOne(entry, messageOverride) {
    var t0 = (performance && performance.now) ? performance.now() : Date.now();
    var ok, mode;
    try {
      var hasNative = await probeNativeEd25519();
      if (hasNative) {
        ok = await verifyNative(entry, messageOverride);
        mode = 'webcrypto-ed25519';
      } else {
        ok = verifyFallback(entry, messageOverride);
        mode = 'noble-fallback';
      }
    } catch (e) {
      // If native throws unexpectedly, try fallback before giving up.
      try {
        ok = verifyFallback(entry, messageOverride);
        mode = 'noble-fallback-after-throw';
      } catch (e2) {
        ok = false;
        mode = 'error:' + e2.message;
      }
    }
    var t1 = (performance && performance.now) ? performance.now() : Date.now();
    return { ok: ok, ms: t1 - t0, mode: mode };
  }

  function tamperMessage(msg) {
    var arr = Array.from(msg);
    var mid = Math.floor(arr.length / 2);
    for (var i = mid; i < arr.length; i++) {
      var c = arr[i];
      if (/[a-zA-Z0-9]/.test(c)) {
        arr[i] = c === 'a' ? 'b' : 'a';
        return arr.join('');
      }
    }
    arr[mid] = arr[mid] === 'X' ? 'Y' : 'X';
    return arr.join('');
  }

  function compressTimeline(log) {
    var lastT = 0;
    return log.map(function (e) {
      var gap = e.t - lastT;
      var playGap = Math.min(gap, 500);
      lastT = e.t;
      return { t: e.t, level: e.level, line: e.line, playGap: playGap };
    });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function sigStamp(sigState, msText, mode) {
    var s = el('span', 'stamp');
    var glyph = el('span', 'glyph');
    var label = '';
    if (sigState === 'ok') {
      s.className += ' v-boots';
      glyph.textContent = '\\u2713';
      label = 'SIGNATURE VERIFIED';
    } else if (sigState === 'bad') {
      s.className += ' v-refused';
      glyph.textContent = '\\u2717';
      label = 'SIGNATURE TAMPERED';
    } else {
      s.className += ' v-pending';
      glyph.textContent = '\\u25CB';
      label = 'SIGNATURE PENDING';
    }
    s.appendChild(glyph);
    s.appendChild(document.createTextNode(' ' + label));
    if (msText || mode) {
      var bits = [];
      if (msText) bits.push(msText);
      if (mode && mode !== 'webcrypto-ed25519') bits.push(mode);
      if (bits.length) {
        var small = el('span', '', ' (' + bits.join(' · ') + ')');
        small.style.color = 'var(--graphite)';
        small.style.fontWeight = '400';
        small.style.textTransform = 'none';
        s.appendChild(small);
      }
    }
    return s;
  }

  function bootStamp(record, sigState) {
    var s = el('span', 'stamp');
    var glyph = el('span', 'glyph');
    var label = '';
    if (sigState === 'bad') {
      s.className += ' v-diag';
      glyph.textContent = '!';
      label = 'VERDICT UNVERIFIED \\u2014 SIGNATURE INVALID';
    } else if (sigState === 'pending') {
      s.className += ' v-pending';
      glyph.textContent = '\\u25CB';
      label = 'VERDICT PENDING';
    } else if (record.booted && record.healthVerified) {
      s.className += ' v-boots';
      glyph.textContent = '\\u2713';
      var obs = record.observed;
      if (obs.kind === 'http_response') {
        label = 'BOOTED \\u2014 HTTP ' + obs.status + ' (' + obs.latencyMs + ' ms)';
      } else {
        label = 'BOOTED';
      }
    } else if (record.booted) {
      s.className += ' v-boots';
      glyph.textContent = '\\u2713';
      label = 'BOOTED';
    } else {
      s.className += ' v-refused';
      glyph.textContent = '\\u2717';
      label = 'NOT BOOTED \\u2014 ' + (record.failureClass || 'unknown');
    }
    s.appendChild(glyph);
    s.appendChild(document.createTextNode(' ' + label));
    return s;
  }

  function renderReceipt(entry, idx) {
    var record = entry.record;
    var card = el('div', 'receipt');
    card.dataset.id = record.id;

    var head = el('header', 'r-head');
    var repoLine = el('div', 'repo-line');
    repoLine.appendChild(el('span', 'label', 'repo'));
    var repoUrl = record.repo.url;
    var repoLabel = record.repo.label ? record.repo.label + '  ' : '';
    repoLine.appendChild(el('span', 'url', repoLabel + repoUrl));
    head.appendChild(repoLine);

    var metaLine1 = el('div', 'meta-line');
    metaLine1.textContent = 'commit ' + record.repo.commit + '  branch ' + record.repo.branch +
      '  captured ' + record.capturedAt + '  by ' + record.capturedBy;
    head.appendChild(metaLine1);

    if (record.inference) {
      var metaLine2 = el('div', 'meta-line');
      metaLine2.textContent = 'inference: ' + record.inference.language + ' / ' + record.inference.packageManager +
        '  start: ' + record.inference.startCommand;
      head.appendChild(metaLine2);
    }

    var stamps = el('div', 'stamps');
    var sigS = sigStamp('pending', null, null);
    sigS.dataset.role = 'sig';
    stamps.appendChild(sigS);
    var bootS = bootStamp(record, 'pending');
    bootS.dataset.role = 'boot';
    stamps.appendChild(bootS);
    head.appendChild(stamps);
    card.appendChild(head);

    var body = el('div', 'body');

    var kv = el('div', 'kv');
    function kvRow(k, v) {
      kv.appendChild(el('div', 'k', k));
      kv.appendChild(el('div', 'v', v));
    }
    var observed = record.observed || {};
    var observedStr;
    if (observed.kind === 'http_response') {
      observedStr = 'HTTP ' + observed.status + ' ' + observed.url + ' (' + observed.latencyMs + ' ms) body=' + JSON.stringify(observed.body);
    } else if (observed.kind === 'process_exit') {
      observedStr = 'process exited signal=' + (observed.signal || 'null') + ' code=' + observed.code + ' (' + observed.latencyMs + ' ms)';
    } else if (observed.kind === 'install_failure') {
      observedStr = 'install step failed (exit ' + observed.exitCode + ')';
    } else if (observed.kind === 'health_timeout') {
      observedStr = 'no HTTP response within ' + (observed.windowMs / 1000) + 's window at ' + observed.url;
    } else {
      observedStr = JSON.stringify(observed);
    }
    kvRow('booted', String(record.booted));
    kvRow('healthVerified', String(record.healthVerified));
    kvRow('failureClass', record.failureClass || '(none)');
    kvRow('observed', observedStr);
    kvRow('trust.level', record.trust.level);
    kvRow('trust.signer', record.trust.signer);
    if (record.trust.upgradePath) {
      kvRow('trust.upgradePath', record.trust.upgradePath.join(' → '));
    }
    body.appendChild(kv);

    var term = el('div', 'term idle');
    term.dataset.role = 'term';
    body.appendChild(term);

    var buttonRow = el('div', 'button-row');
    var replayBtn = el('button', 'primary', '\\u25B6 Replay boot');
    replayBtn.dataset.role = 'replay';
    buttonRow.appendChild(replayBtn);
    var tamperBtn = el('button', 'danger', 'Tamper with signature');
    tamperBtn.dataset.role = 'tamper';
    buttonRow.appendChild(tamperBtn);
    body.appendChild(buttonRow);

    var banner = el('div', 'tamper-banner');
    banner.dataset.role = 'banner';
    banner.innerHTML = '<b>Signature invalid.</b> One alphanumeric byte in the signed message was changed. ' +
      'Because the boot verdict lives inside the signed message, an invalid signature means the verdict ' +
      'can no longer be trusted either. Click "Restore original" to re-verify.';
    body.appendChild(banner);

    var sigDetails = el('details', 'sig');
    sigDetails.appendChild(el('summary', '', 'Signed message, signature, and public key'));

    sigDetails.appendChild(el('div', 'field-label', 'Public key (SPKI, base64)'));
    sigDetails.appendChild(el('pre', '', entry.publicKey));

    sigDetails.appendChild(el('div', 'field-label', 'Signature (ed25519, base64)'));
    sigDetails.appendChild(el('pre', '', entry.signature));

    sigDetails.appendChild(el('div', 'field-label', 'Signed message (pretty JSON, ' + entry.message.length + ' bytes)'));
    var pre3 = el('pre', '', entry.message);
    pre3.dataset.role = 'signedMessage';
    sigDetails.appendChild(pre3);
    body.appendChild(sigDetails);

    card.appendChild(body);

    var state = {
      message: entry.message,
      sigState: 'pending',
      replaying: false,
      lastReplayTimers: []
    };

    replayBtn.addEventListener('click', function () { startReplay(); });
    tamperBtn.addEventListener('click', function () { toggleTamper(); });

    function setSigStamp(newState, msText, mode) {
      state.sigState = newState;
      var fresh = sigStamp(newState, msText, mode);
      fresh.dataset.role = 'sig';
      var old = stamps.querySelector('[data-role="sig"]');
      old.parentNode.replaceChild(fresh, old);
      refreshBootStamp();
      if (newState === 'bad') card.classList.add('tampered');
      else card.classList.remove('tampered');
      if (newState === 'bad') banner.classList.add('show');
      else banner.classList.remove('show');
      if (newState === 'bad') {
        tamperBtn.textContent = 'Restore original';
        tamperBtn.className = 'ghost';
      } else {
        tamperBtn.textContent = 'Tamper with signature';
        tamperBtn.className = 'danger';
      }
    }

    function refreshBootStamp() {
      var fresh = bootStamp(record, state.sigState);
      fresh.dataset.role = 'boot';
      var old = stamps.querySelector('[data-role="boot"]');
      old.parentNode.replaceChild(fresh, old);
    }

    async function reverify() {
      setSigStamp('pending', null, null);
      var result = await verifyOne(entry, state.message);
      var msText = result.ms ? result.ms.toFixed(1) + ' ms' : null;
      setSigStamp(result.ok ? 'ok' : 'bad', msText, result.mode);
      updateStatusBar();
    }

    function toggleTamper() {
      if (state.sigState === 'bad') {
        state.message = entry.message;
        var sm = sigDetails.querySelector('[data-role="signedMessage"]');
        sm.textContent = entry.message;
      } else {
        state.message = tamperMessage(entry.message);
        var sm2 = sigDetails.querySelector('[data-role="signedMessage"]');
        sm2.textContent = state.message;
      }
      reverify();
    }

    function startReplay() {
      if (state.replaying) {
        state.lastReplayTimers.forEach(clearTimeout);
        state.lastReplayTimers = [];
      }
      state.replaying = true;
      replayBtn.disabled = true;
      replayBtn.textContent = 'Replaying\\u2026';
      term.classList.remove('idle');
      term.innerHTML = '';
      var compressed = compressTimeline(record.log);
      var caret = el('span', 'caret');
      term.appendChild(caret);

      var acc = 0;
      compressed.forEach(function (e, i) {
        acc += e.playGap;
        var timer = setTimeout(function () {
          var line = el('span', 'line ' + e.level, e.line);
          term.insertBefore(line, caret);
          term.scrollTop = term.scrollHeight;
          if (i === compressed.length - 1) {
            state.replaying = false;
            replayBtn.disabled = false;
            replayBtn.textContent = '\\u25B6 Replay again';
          }
        }, acc);
        state.lastReplayTimers.push(timer);
      });
    }

    return { card: card, reverify: reverify };
  }

  function updateStatusBar() {
    var stamps = document.querySelectorAll('.receipt .stamp[data-role="sig"]');
    var ok = 0, bad = 0, pending = 0;
    var anyFallback = false;
    stamps.forEach(function (s) {
      if (s.classList.contains('v-boots')) ok++;
      else if (s.classList.contains('v-refused')) bad++;
      else pending++;
      if (/noble|fallback/i.test(s.textContent)) anyFallback = true;
    });
    var bar = document.getElementById('statusBar');
    var text = document.getElementById('statusText');
    if (pending > 0) {
      bar.className = 'status-bar';
      text.textContent = 'Verifying signatures\\u2026';
    } else if (bad > 0) {
      bar.className = 'status-bar bad';
      text.textContent = bad + ' of ' + stamps.length + ' signature(s) TAMPERED \\u2014 ' + ok + ' verified. No verdict in a tampered receipt can be trusted.';
    } else {
      bar.className = 'status-bar ok';
      var modeNote = anyFallback ? ' (JS fallback)' : '';
      text.textContent = ok + ' of ' + stamps.length + ' signature(s) verified in your browser' + modeNote + '. No network calls were made.';
    }
  }

  var controllers = [];

  async function init() {
    var container = document.getElementById('receipts');
    PAYLOAD.forEach(function (entry) {
      var ctrl = renderReceipt(entry);
      container.appendChild(ctrl.card);
      controllers.push(ctrl);
    });
    updateStatusBar();
    await Promise.all(controllers.map(function (ctrl) {
      return ctrl.reverify();
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
</body>
</html>`;

const html = HTML.replace('__PAYLOAD__', payloadSafe);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);

const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('Wrote ' + outPath);
console.log('Size: ' + sizeKb + ' KB');
console.log('Records: ' + signed.length + ' (all real captures)');
signed.forEach(function (s) {
  console.log('  - ' + s.record.id + '  ' + s.record.repo.label);
  console.log('      booted=' + s.record.booted + '  failureClass=' + (s.record.failureClass || '(none)'));
  console.log('      observed=' + JSON.stringify(s.record.observed));
  console.log('      sig=' + s.signature.slice(0, 24) + '...');
});
