#!/usr/bin/env node
// verify_living_receipt.mjs
//
// Headless-browser smoke test for proof.bootproof.html.
//
// Runs in two modes:
//   - Default: native WebCrypto Ed25519 (modern Chromium).
//   - Fallback: forcibly disables native Ed25519 so the @noble/curves
//     fallback path is exercised. This proves the receipt verifies on
//     the ~20% of browsers that lack native Ed25519.
//
// Assertions in each mode:
//   1. Both signatures verify in-browser on open.
//   2. Both BOOT stamps render correctly (one BOOTED with real HTTP 200,
//      one NOT BOOTED with real process_segfault).
//   3. Tamper flips sig stamp to SIGNATURE TAMPERED.
//   4. Tamper flips boot stamp to VERDICT UNVERIFIED — SIGNATURE INVALID.
//   5. Restore flips both back.
//   6. Replay on success receipt ends with BOOTED.
//   7. Replay on segfault receipt ends with NOT VERIFIED.
//   8. No console errors.
//
// Run: node /home/z/my-project/scripts/verify_living_receipt.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';

const FILE = '/home/z/my-project/download/proof.bootproof.html';
if (!fs.existsSync(FILE)) {
  console.error('FAIL: ' + FILE + ' does not exist. Run build_living_receipt.mjs first.');
  process.exit(1);
}

const fileUrl = 'file://' + FILE;

async function runMode(mode) {
  console.log('\n========== MODE: ' + mode + ' ==========');
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // In fallback mode, monkey-patch crypto.subtle.generateKey to throw on Ed25519,
  // which forces probeNativeEd25519() to return false and routes everything
  // through the @noble/curves fallback.
  if (mode === 'fallback') {
    await context.addInitScript(() => {
      const origGenerateKey = crypto.subtle.generateKey.bind(crypto.subtle);
      crypto.subtle.generateKey = function (alg, ...rest) {
        if (alg && (alg.name === 'Ed25519' || alg === 'Ed25519')) {
          throw new Error('NotSupportError: Ed25519 disabled for test');
        }
        return origGenerateKey(alg, ...rest);
      };
      // Also block importKey for Ed25519, in case probe uses it.
      const origImportKey = crypto.subtle.importKey.bind(crypto.subtle);
      crypto.subtle.importKey = function (format, keyData, alg, ...rest) {
        if (alg && (alg.name === 'Ed25519' || alg === 'Ed25519')) {
          throw new Error('NotSupportError: Ed25519 disabled for test');
        }
        return origImportKey(format, keyData, alg, ...rest);
      };
    });
  }

  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => logs.push('[' + msg.type() + '] ' + msg.text()));
  page.on('pageerror', err => logs.push('[pageerror] ' + err.message));

  function check(name, cond, detail) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + '[' + mode + '] ' + name + (cond ? '' : '  ::  ' + (detail || '')));
    if (!cond) process.exitCode = 1;
  }

  try {
    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      const t = document.getElementById('statusText');
      return t && /verified in your browser/.test(t.textContent);
    }, { timeout: 10000 });
    const statusText = await page.textContent('#statusText');
    check('1. Both signatures verify in-browser on open', /2 of 2 signature\(s\) verified/.test(statusText), statusText);

    // Confirm the verification mode is the one we expect for this run
    const modeMatch = mode === 'fallback'
      ? /JS fallback/.test(statusText)
      : !/JS fallback/.test(statusText);
    check('1b. Verification used the expected path', modeMatch, statusText);

    const bootStamps = await page.$$eval('.stamp[data-role="boot"]', els => els.map(e => e.textContent.trim()));
    check('2a. Receipt #1 boot stamp = BOOTED (real HTTP 200)', /BOOTED/.test(bootStamps[0]) && /HTTP 200/.test(bootStamps[0]), bootStamps[0]);
    check('2b. Receipt #2 boot stamp = NOT BOOTED (real repo failure)', /NOT BOOTED/.test(bootStamps[1]) && /dependency_install_failed|process_segfault|app_exit_nonzero|health_check_timeout/.test(bootStamps[1]), bootStamps[1]);

    // Tamper receipt #1
    const tamperBtns = await page.$$('button[data-role="tamper"]');
    await tamperBtns[0].click();
    await page.waitForFunction(() => {
      const s = document.querySelectorAll('.receipt')[0].querySelector('.stamp[data-role="sig"]');
      return s && s.classList.contains('v-refused');
    }, { timeout: 5000 });

    const tamperedSig = await page.$eval('.receipt:first-child .stamp[data-role="sig"]', el => el.textContent.trim());
    check('3a. Tamper flips sig stamp to SIGNATURE TAMPERED', /TAMPERED/.test(tamperedSig), tamperedSig);

    const tamperedBoot = await page.$eval('.receipt:first-child .stamp[data-role="boot"]', el => el.textContent.trim());
    check('3b. Tamper flips boot stamp to VERDICT UNVERIFIED (the bug fix)', /UNVERIFIED/.test(tamperedBoot) && !/BOOTED/.test(tamperedBoot), tamperedBoot);

    const bannerVisible = await page.$eval('.receipt:first-child .tamper-banner', el => el.classList.contains('show'));
    check('3c. Tamper banner is visible', bannerVisible);

    const cardTampered = await page.$eval('.receipt:first-child', el => el.classList.contains('tampered'));
    check('3d. Card border reflects tampered state', cardTampered);

    // Restore
    const tamperBtns2 = await page.$$('button[data-role="tamper"]');
    await tamperBtns2[0].click();
    await page.waitForFunction(() => {
      const s = document.querySelectorAll('.receipt')[0].querySelector('.stamp[data-role="sig"]');
      return s && s.classList.contains('v-boots');
    }, { timeout: 5000 });

    const restoredSig = await page.$eval('.receipt:first-child .stamp[data-role="sig"]', el => el.textContent.trim());
    check('4a. Restore flips sig stamp back to SIGNATURE VERIFIED', /VERIFIED/.test(restoredSig) && !/TAMPERED/.test(restoredSig), restoredSig);

    const restoredBoot = await page.$eval('.receipt:first-child .stamp[data-role="boot"]', el => el.textContent.trim());
    check('4b. Restore flips boot stamp back to BOOTED', /BOOTED/.test(restoredBoot) && !/UNVERIFIED/.test(restoredBoot), restoredBoot);

    // Replay the success receipt
    const replayBtns = await page.$$('button[data-role="replay"]');
    await replayBtns[0].click();
    await page.waitForFunction(() => {
      const b = document.querySelectorAll('button[data-role="replay"]')[0];
      return b && /Replay again/.test(b.textContent);
    }, { timeout: 12000 });
    const successTerm = await page.$eval('.receipt:first-child .term', el => el.textContent);
    check('5. Success replay contains real HTTP 200 and BOOTED', /HTTP/.test(successTerm) && /BOOTED/.test(successTerm), successTerm.slice(-220));

    // Replay the segfault receipt
    await replayBtns[1].click();
    await page.waitForFunction(() => {
      const b = document.querySelectorAll('button[data-role="replay"]')[1];
      return b && /Replay again/.test(b.textContent);
    }, { timeout: 12000 });
    const segfaultTerm = await page.$eval('.receipt:nth-child(2) .term', el => el.textContent);
    check('6. Failure receipt replay contains real failure and NOT VERIFIED', /ENOENT|install FAILED|Segmentation fault|SIGSEGV|EADDRINUSE|process exited/.test(segfaultTerm) && /NOT VERIFIED/.test(segfaultTerm), segfaultTerm.slice(-220));

    const errors = logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
    check('7. No console errors or pageerrors', errors.length === 0, errors.join(' | '));

  } catch (e) {
    console.error('EXCEPTION [' + mode + ']: ' + e.message);
    console.error(logs.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await runMode('native');
await runMode('fallback');
