// NEP-413: checks that a signed message really came from a given public key.
// Not used while personas stand in for wallets. The owner-page gate will also need to
// confirm the key belongs to the account, then read the owner from the registry.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha256";

/** The tag NEP-413 puts first: 2^31 + 413. */
const NEP413_TAG = 2147484061;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface Nep413Payload {
  message: string;
  /** 32 random bytes chosen by the server. */
  nonce: Uint8Array;
  recipient: string;
  callbackUrl?: string;
}

export function base58Decode(text: string): Uint8Array {
  let value = 0n;
  for (const ch of text) {
    const digit = BASE58.indexOf(ch);
    if (digit < 0) throw new Error("not base58");
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  for (const ch of text) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function u32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function borshString(s: string): Uint8Array[] {
  const bytes = new TextEncoder().encode(s);
  return [u32(bytes.length), bytes];
}

/** The hash a wallet signs: sha256(borsh(tag, message, nonce, recipient, callbackUrl)). */
export function nep413Hash(p: Nep413Payload): Uint8Array {
  if (p.nonce.length !== 32) throw new Error("the nonce must be 32 bytes");
  const parts = [
    u32(NEP413_TAG),
    ...borshString(p.message),
    p.nonce,
    ...borshString(p.recipient),
    ...(p.callbackUrl === undefined ? [Uint8Array.of(0)] : [Uint8Array.of(1), ...borshString(p.callbackUrl)]),
  ];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return sha256(out);
}

/** `publicKey` as `ed25519:<base58>`. Returns false for anything malformed. */
export function verifyNep413(payload: Nep413Payload, signature: Uint8Array, publicKey: string): boolean {
  if (!publicKey.startsWith("ed25519:")) return false;
  try {
    return ed25519.verify(signature, nep413Hash(payload), base58Decode(publicKey.slice("ed25519:".length)));
  } catch {
    return false;
  }
}
