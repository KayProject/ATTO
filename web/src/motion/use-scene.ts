// Builds a scene's timeline only when full motion is allowed, and tears it down with the component.
"use client";
import { type RefObject } from "react";
import { gsap, useGSAP } from "./gsap";
import { FULL } from "./tokens";

export type SceneBuild = (scope: HTMLElement) => void | (() => void);

/**
 * Runs `build` inside a GSAP context scoped to `ref`, under the full-motion media query.
 * With reduced motion the build never runs, so the markup's resting state is what shows.
 */
export function useScene(ref: RefObject<HTMLElement | null>, build: SceneBuild, deps: unknown[] = []) {
  useGSAP(
    () => {
      const scope = ref.current;
      if (!scope) return;
      const mm = gsap.matchMedia();
      mm.add(FULL, () => build(scope));
      return () => mm.revert();
    },
    { scope: ref, dependencies: deps },
  );
}
