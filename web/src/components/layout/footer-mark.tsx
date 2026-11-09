// The giant atto. wordmark closing every page: drawn stroke by stroke when the footer comes into view, fading out.
"use client";
import { useRef } from "react";
import { Logo } from "@/components/brand/logo";
import { gsap, ScrollTrigger } from "@/motion/gsap";
import { useScene } from "@/motion/use-scene";

export function FooterMark() {
  const ref = useRef<HTMLDivElement>(null);
  useScene(ref, (scope) => {
    const strokes = ["a", "t1", "t2", "o", "cut"].map((id) => scope.querySelector<SVGPathElement>(`[data-stroke="${id}"]`)!);
    const dot = scope.querySelector<SVGCircleElement>("[data-dot]")!;
    // Each stroke has pathLength 1, so a dash of 1 hides it and an offset of 0 draws it fully.
    gsap.set(strokes, { attr: { "stroke-dasharray": "1 1", "stroke-dashoffset": 1 } });
    gsap.set(dot, { y: -160, autoAlpha: 0, transformOrigin: "50% 50%" });
    // Plays once the footer comes into view, so it always finishes, even on pages too short to scroll far.
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power1.inOut" },
    });
    ScrollTrigger.create({ trigger: scope, start: "top 92%", once: true, onEnter: () => tl.play() });
    strokes.forEach((s, i) => tl.to(s, { attr: { "stroke-dashoffset": 0 }, duration: 0.6 }, i * 0.32));
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
