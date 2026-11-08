// The cast: small objects shared by every scene and screen (key, NFT frame, seal, vault, stamp, seedling).
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

export function CastObject({ kind, size = 64, cut = false, label, className = "" }: CastObjectProps) {
  return (
    <span
      className={`cast cast-${kind} ${className}`}
      data-cut={cut || undefined}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
