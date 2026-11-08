// Home scene: preloader. See workbench/design/MOTION-PLAN.md.
"use client";
import { useRef } from "react";
import { useScene } from "@/motion/use-scene";

export function PreloaderScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, () => {});
  return (
    <section ref={ref} className="scene scene-preloader" aria-label="preloader">
      <p>Preloader</p>
    </section>
  );
}
