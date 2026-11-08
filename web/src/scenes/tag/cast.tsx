// The cast: small objects shared by every scene and screen (key, NFT frame, seal, vault, stamp, seedling).
import { useId, type ComponentType } from "react";
import { CastDefs, Loop, Shadow } from "./cast/parts";
import { KeyArt } from "./cast/key";
import { NftArt } from "./cast/nft";
import { SealArt } from "./cast/seal";
import { SubaccountArt } from "./cast/subaccount";
import { ModeArt } from "./cast/mode";
import { VaultArt } from "./cast/vault";
import { StampArt } from "./cast/stamp";
import { SeedlingArt } from "./cast/seedling";
import { UnknownArt } from "./cast/unknown";

export type CastKind = "key" | "nft" | "seal" | "subaccount" | "mode" | "vault" | "stamp" | "seedling" | "unknown";

export interface CastObjectProps {
  kind: CastKind;
  /** Pixel size of the square the object sits in. */
  size?: number;
  /** Shows the object's cut or spent variant. */
  cut?: boolean;
  /** Accessible name. Leave empty when the object is decoration next to text that says the same. */
  label?: string;
  className?: string;
}

const ART: Record<CastKind, ComponentType<{ p: string }>> = {
  key: KeyArt,
  nft: NftArt,
  seal: SealArt,
  subaccount: SubaccountArt,
  mode: ModeArt,
  vault: VaultArt,
  stamp: StampArt,
  seedling: SeedlingArt,
  unknown: UnknownArt,
};

export const CAST_KINDS = Object.keys(ART) as CastKind[];

/** Objects that hang on the end of a cord and show where it was tied. */
const TIED: ReadonlySet<CastKind> = new Set(["key", "nft", "seal", "subaccount", "mode", "unknown"]);

export interface CastArtProps {
  kind: CastKind;
  cut?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** The drawing alone, as an svg element that can also sit inside another svg. */
export function CastArt({ kind, cut = false, x, y, width, height }: CastArtProps) {
  const p = `c${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const Drawing = ART[kind] ?? UnknownArt;
  return (
    <svg
      className={`cast-art cast-art-${kind}`}
      data-cut={cut || undefined}
      viewBox="0 0 64 64"
      x={x}
      y={y}
      width={width}
      height={height}
      overflow="visible"
      aria-hidden
      focusable="false"
    >
      <CastDefs p={p} />
      <Shadow p={p} />
      <g className="c-whole">
        {TIED.has(kind) && <Loop cut={cut} />}
        <Drawing p={p} />
      </g>
    </svg>
  );
}

export function CastObject({ kind, size = 64, cut = false, label, className = "" }: CastObjectProps) {
  return (
    <span
      className={`cast cast-${kind} ${className}`}
      data-cut={cut || undefined}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <CastArt kind={kind} cut={cut} />
    </span>
  );
}
