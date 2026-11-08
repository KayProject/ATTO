// Home scene: leftovers. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function LeftoversScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-leftovers" aria-label="leftovers">
      <p>Leftovers</p>
    </section>
  );
}
