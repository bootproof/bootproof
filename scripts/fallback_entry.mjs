// fallback_entry.mjs
// Tiny entry point that exposes only what the receipt needs:
//   verifyEd25519(spkiBase64, sigBase64, msgBytes) -> Promise<boolean>
// SPKI for Ed25519 is 44 bytes: 12-byte DER prefix + 32-byte raw public key.
import { ed25519 } from '@noble/curves/ed25519';

export function extractRawPubKeyFromSpki(spkiDer) {
  if (spkiDer.length < 44) throw new Error('SPKI too short for Ed25519 key');
  return spkiDer.subarray(12, 44);
}

export function verifyEd25519(spkiBase64, sigBase64, msgBytes) {
  const spkiDer = base64ToBytes(spkiBase64);
  const rawPub = extractRawPubKeyFromSpki(spkiDer);
  const sig = base64ToBytes(sigBase64);
  return ed25519.verify(sig, msgBytes, rawPub);
}

function base64ToBytes(s) {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
