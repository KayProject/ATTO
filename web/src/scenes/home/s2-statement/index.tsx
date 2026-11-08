// Home scene: statement. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function StatementScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-statement" aria-label="statement">
      <p>Statement</p>
    </section>
  );
}
