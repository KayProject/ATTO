// Public interface of the glass name tag. Every scene and screen uses only this component.
"use client";
import type { Cord } from "./cords";
import { TagPoster } from "./tag-poster";

export interface GlassTagProps {
  name: string;
  cords: Cord[];
  /** "hero" is large with idle motion; "inline" is small and still until its scene animates it. */
  size?: "hero" | "panel" | "inline";
  /** Stamp shown on the tag once a sale is verified. */
  stamped?: boolean;
  className?: string;
}

export function GlassTag(props: GlassTagProps) {
  return <TagPoster {...props} />;
}
