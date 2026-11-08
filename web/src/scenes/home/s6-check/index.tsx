// Home scene: check. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function CheckNightScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-check" aria-label="check">
      <p>CheckNight</p>
    </section>
  );
}
