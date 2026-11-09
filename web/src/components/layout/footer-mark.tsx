// The giant atto. wordmark closing every page: drawn stroke by stroke as the footer scrolls in, fading into the ground.
"use client";
import { useRef } from "react";
import { Logo } from "@/components/brand/logo";
import { gsap } from "@/motion/gsap";
import { useScene } from "@/motion/use-scene";

export function FooterMark() {
  const ref = useRef<HTMLDivElement>(null);
  useScene(ref, (scope) => {
    const strokes = ["a", "t1", "t2", "o", "cut"].map((id) => scope.querySelector<SVGPathElement>(`[data-stroke="${id}"]`)!);
    const dot = scope.querySelector<SVGCircleElement>("[data-dot]")!;
    // Each stroke has pathLength 1, so a dash of 1 hides it and an offset of 0 draws it fully.
    gsap.set(strokes, { attr: { "stroke-dasharray": "1 1", "stroke-dashoffset": 1 } });
    gsap.set(dot, { y: -160, autoAlpha: 0, transformOrigin: "50% 50%" });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: scope, start: "top bottom", end: "bottom bottom", scrub: 0.8 },
      defaults: { ease: "power1.inOut" },
    });
    strokes.forEach((s, i) => tl.to(s, { attr: { "stroke-dashoffset": 0 }, duration: 0.5 }, i * 0.28));
    tl.to(dot, { y: 0, autoAlpha: 1, duration: 0.4, ease: "bounce.out" }, ">-0.1")
      // Fully drawn, the strokes drop their dashes so the closed o has no seam.
      .set(strokes, { attr: { "stroke-dasharray": "none" } });
  });
  return (
    <div ref={ref} className="footer-mark" aria-hidden="true">
      <Logo title="" />
    </div>
  );
}
