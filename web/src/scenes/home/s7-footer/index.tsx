// Home scene: footer. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function FooterDomeScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-footer" aria-label="footer">
      <p>FooterDome</p>
    </section>
  );
}
