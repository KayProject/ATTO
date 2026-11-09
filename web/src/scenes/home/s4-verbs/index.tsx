// Home scene: "Your name," pins while the highlighted phrase swaps through what ATTO offers; the seller and buyer walk across.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers that GSAP moves directly */
"use client";

import { useRef } from "react";
import { PillLink } from "@/components/ui/pill-button";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { GLASS, PENCIL, type GlassName } from "../assets";

const verbs: { word: string; caption: string; action: string; href: string; object: GlassName }[] = [
  { word: "sold clean", caption: "Get paid once the name is transferred and the previous owner's access is removed.", action: "List your name", href: "/sale", object: "key" },
  { word: "bought clean", caption: "Know what you're buying, and take ownership with the previous owner's access removed.", action: "Find a name", href: "/search", object: "vault" },
  { word: "kept renewed", caption: "Set aside funds for renewals. The reserve stays with the name when it's sold.", action: "Open Keeper", href: "/owner", object: "coin" },
  { word: "checked before you pay", caption: "See whether a name recently changed hands before sending funds to it.", action: "Check a name", href: "/pay", object: "stamp" },
];

// Seconds of timeline per walk frame, so steps keep pace with the scroll.
const STEP = 0.07;

export function VerbsScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (scope) => {
    const media = gsap.matchMedia();
    media.add("(min-width: 48rem) and (min-height: 40rem)", () => {
      const panels = Array.from(scope.querySelectorAll<HTMLElement>(".verbs-item"));
      const choices = Array.from(scope.querySelectorAll<HTMLButtonElement>(".verbs-choice"));
      const walkers = Array.from(scope.querySelectorAll<HTMLElement>(".verbs-walker"));
      scope.classList.add("verbs-motion");
      const show = (index: number) => panels.forEach((panel, i) => {
        choices[i]?.setAttribute("aria-pressed", String(i === index));
        panel.inert = i !== index;
        panel.setAttribute("aria-hidden", String(i !== index));
      });
      show(0);
      gsap.from(scope.querySelector(".verbs-surface"), {
        clipPath: "inset(100% 0 0 0)", ease: EASE.scrub,
        scrollTrigger: { trigger: scope, start: "top bottom", end: "top top", scrub: SCRUB },
      });
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: scope, start: "top top", end: "+=260%", pin: true, pinType: "transform", scrub: SCRUB, invalidateOnRefresh: true },
        onUpdate: () => {
          const t = timeline.time();
          show(Math.min(3, Math.floor(t)));
          const frame = Math.floor(t / STEP) % 2;
          walkers.forEach((walker) => (walker.dataset.frame = String(frame)));
        },
      });
      panels.forEach((panel, i) => {
        timeline.fromTo(panel, { autoAlpha: 0, filter: "blur(12px)", y: 20 }, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: 0.15, ease: EASE.enter }, i);
        timeline.fromTo(panel.querySelector(".verbs-object"), { y: 60, rotation: -14, scale: 0.7 }, { y: -20, rotation: 10, scale: 1, duration: 0.9, ease: EASE.scrub }, i);
        if (i < panels.length - 1) timeline.to(panel, { autoAlpha: 0, filter: "blur(12px)", y: -16, duration: 0.15 }, i + 0.85);
      });
      walkers.forEach((walker, i) => {
        timeline.fromTo(walker, { x: () => -walker.offsetWidth - i * 160 }, { x: () => scope.clientWidth + 40 - i * 160, duration: 4, ease: "none" }, 0);
      });
      const handlers = choices.map((choice, index) => {
        const choose = () => {
          const trigger = timeline.scrollTrigger;
          if (trigger) window.scrollTo(0, trigger.start + (trigger.end - trigger.start) * ((index + 0.5) / timeline.duration()));
        };
        choice.addEventListener("click", choose);
        return choose;
      });
      return () => {
        choices.forEach((choice, index) => choice.removeEventListener("click", handlers[index]));
        scope.classList.remove("verbs-motion");
        panels.forEach((panel) => { panel.inert = false; panel.removeAttribute("aria-hidden"); });
      };
    });
    return () => media.revert();
  });
  return (
    <section ref={ref} className="scene scene-verbs" aria-labelledby="verbs-title">
      <div className="verbs-surface">
        <h2 id="verbs-title">Your name,</h2>
        <div className="verbs-choices" role="group" aria-label="Explore what to do with your name">
          {["Sell", "Buy", "Renew", "Check"].map((label) => <button className="verbs-choice" key={label} type="button">{label}</button>)}
        </div>
        <div className="verbs-list">
          {verbs.map((verb) => (
            <article className="verbs-item" key={verb.href}>
              <div className="verbs-phrase">
                <h3>{verb.word}</h3>
                <span className="verbs-object" aria-hidden="true"><img src={GLASS(verb.object)} alt="" draggable={false} /></span>
              </div>
              <div className="verbs-caption"><p>{verb.caption}</p><PillLink href={verb.href}>{verb.action}</PillLink></div>
            </article>
          ))}
        </div>
        <div className="verbs-walkers" aria-hidden="true">
          {(["seller", "buyer"] as const).map((who) => (
            <span key={who} className="verbs-walker" data-frame="0">
              <img src={PENCIL(`${who}-walk-a`)} alt="" draggable={false} />
              <img src={PENCIL(`${who}-walk-b`)} alt="" draggable={false} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
