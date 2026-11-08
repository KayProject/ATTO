// Home scene: verbs. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function VerbsScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-verbs" aria-label="verbs">
      <p>Verbs</p>
    </section>
  );
}
