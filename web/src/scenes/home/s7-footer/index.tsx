"use client";

import { useRef } from "react";
import { PillLink } from "@/components/ui/pill-button";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { CastObject } from "@/scenes/tag/cast";

export function FooterDomeScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (scope) => {
    const timeline = gsap.timeline({ scrollTrigger: { trigger: scope, start: "top bottom", end: "top 15%", scrub: SCRUB } });
    timeline.from(scope.querySelector(".footer-dome"), { yPercent: 75, scaleX: 1.12, duration: 1, ease: EASE.scrub }, 0)
      .from(scope.querySelector(".footer-cast"), { y: 180, rotation: -5, duration: 1, ease: EASE.scrub }, 0)
      .from(scope.querySelector(".footer-dome-copy"), { y: 100, duration: 0.7, ease: EASE.enter }, 0.3);
  });
  return (
    <section ref={ref} className="scene scene-footer" aria-labelledby="footer-dome-title">
      <div className="footer-dome" aria-hidden="true" />
      <div className="footer-cast" aria-hidden="true"><CastObject kind="key" size={88} cut /><CastObject kind="vault" size={144} /><CastObject kind="seedling" size={112} /><CastObject kind="stamp" size={88} /></div>
      <div className="footer-dome-copy"><h2 id="footer-dome-title">Sell it clean.</h2><div className="footer-dome-actions"><PillLink href="/search">Search a name</PillLink><PillLink href="/sale" tone="secondary">List a name</PillLink></div></div>
    </section>
  );
}
