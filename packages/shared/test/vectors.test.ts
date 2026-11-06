import { describe, expect, it } from "vitest";
import vectors from "../vectors/manifest.json";
import { canonicalBytes, fingerprint, toHex, type Manifest } from "../src/manifest";

describe("manifest vectors shared with Rust", () => {
  for (const [name, v] of Object.entries(vectors as Record<string, { manifest: Manifest; borsh_hex: string; fingerprint: string }>)) {
    it(`${name}: same bytes and fingerprint`, () => {
      expect(toHex(canonicalBytes(v.manifest))).toBe(v.borsh_hex);
      expect(fingerprint(v.manifest)).toBe(v.fingerprint);
    });
  }

  it("covers three vectors", () => {
    expect(Object.keys(vectors)).toHaveLength(3);
  });
});
