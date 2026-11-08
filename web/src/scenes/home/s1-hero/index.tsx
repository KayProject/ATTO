// Home scene: hero. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function HeroScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-hero" aria-label="hero">
      <p>Hero</p>
    </section>
  );
}
