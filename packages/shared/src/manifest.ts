// Mirror of contracts/shared/src/lib.rs. Changing one means changing both and
// the vectors in the same commit.
import { sha256 } from "@noble/hashes/sha256";

export interface TokenAmount {
  /** Intents token id, e.g. `nep141:wrap.near`. */
  token_id: string;
  /** Decimal string, as `U128` serializes. */
  amount: string;
}

export interface NftRef {
  contract_id: string;
  token_id: string;
}

export interface Manifest {
  token_id: string;
  intents_keys: string[];
  intents_floor: TokenAmount[];
  nfts: NftRef[];
  needs_seller: string[];
}

class Writer {
  private chunks: Uint8Array[] = [];
  u32(n: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    this.chunks.push(b);
  }
  u128(v: bigint) {
    if (v < 0n || v >= 1n << 128n) throw new Error(`u128 out of range: ${v}`);
    const b = new Uint8Array(16);
    for (let i = 0; i < 16; i++) b[i] = Number((v >> BigInt(8 * i)) & 0xffn);
    this.chunks.push(b);
  }
  string(s: string) {
    const bytes = new TextEncoder().encode(s);
    this.u32(bytes.length);
    this.chunks.push(bytes);
  }
  vec<T>(items: T[], each: (item: T) => void) {
    this.u32(items.length);
    items.forEach(each);
  }
  bytes(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** Borsh bytes of a manifest, field order as in the Rust struct. */
export function canonicalBytes(m: Manifest): Uint8Array {
  const w = new Writer();
  w.string(m.token_id);
  w.vec(m.intents_keys, (k) => w.string(k));
  w.vec(m.intents_floor, (t) => {
    w.string(t.token_id);
    w.u128(BigInt(t.amount));
  });
  w.vec(m.nfts, (n) => {
    w.string(n.contract_id);
    w.string(n.token_id);
  });
  w.vec(m.needs_seller, (s) => w.string(s));
  return w.bytes();
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `sha256(borsh(manifest))` as lowercase hex. */
export function fingerprint(m: Manifest): string {
  return toHex(sha256(canonicalBytes(m)));
}
