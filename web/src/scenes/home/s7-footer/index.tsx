// Home scene: a dome rises out of the night with the crowd sitting on its edge, closing the page where it opened.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers that GSAP moves directly */
"use client";

import { useRef } from "react";
import { PillLink } from "@/components/ui/pill-button";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { GLASS, PENCIL } from "../assets";

export function FooterDomeScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (scope) => {
    const timeline = gsap.timeline({ scrollTrigger: { trigger: scope, start: "top bottom", end: "top 10%", scrub: SCRUB } });
    timeline.from(scope.querySelector(".footer-dome"), { yPercent: 60, scaleX: 1.12, duration: 1, ease: EASE.scrub }, 0)
      .from(scope.querySelector(".footer-cast"), { yPercent: 60, duration: 1, ease: EASE.scrub }, 0)
      .from(scope.querySelectorAll(".footer-prop"), { y: 80, rotate: -20, autoAlpha: 0, duration: 0.6, stagger: 0.1, ease: EASE.scrub }, 0.3)
      .from(scope.querySelector(".footer-dome-copy"), { y: 100, autoAlpha: 0, duration: 0.7, ease: EASE.enter }, 0.3);
    scope.querySelectorAll(".footer-prop").forEach((el, i) =>
      gsap.to(el, { y: -8, rotate: i % 2 ? 5 : -5, duration: 2.4 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 }),
    );
  });
  return (
    <section ref={ref} className="scene scene-footer" aria-labelledby="footer-dome-title">
      <div className="footer-dome" aria-hidden="true" />
      <div className="footer-cast" aria-hidden="true">
        <img className="footer-prop footer-prop-tag" src={GLASS("tag-clean")} alt="" draggable={false} />
        <img className="footer-person footer-seller" src={PENCIL("seller-walk-a")} alt="" draggable={false} />
        <img className="footer-crowd" src={PENCIL("crowd-sit")} alt="" draggable={false} />
        <img className="footer-person footer-buyer" src={PENCIL("buyer-wave")} alt="" draggable={false} />
        <img className="footer-prop footer-prop-coin" src={GLASS("coin")} alt="" draggable={false} />
      </div>
      <div className="footer-dome-copy">
        <h2 id="footer-dome-title">Buy or sell your next NEAR name through ATTO.</h2>
        <div className="footer-dome-actions">
          <PillLink href="/search">Search a name</PillLink>
          <PillLink href="/sale" tone="secondary">List your name</PillLink>
        </div>
      </div>
    </section>
  );
}
