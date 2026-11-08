"use client";

import { useRef } from "react";
import { PillLink } from "@/components/ui/pill-button";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { CastObject, type CastKind } from "@/scenes/tag/cast";

const verbs: { word: string; caption: string; action: string; href: string; cast: CastKind }[] = [
  { word: "sold clean", caption: "Clear the old keys before the name and payment swap.", action: "List a name", href: "/sale", cast: "key" },
  { word: "bought clean", caption: "Read what stays attached before you buy.", action: "Find a name", href: "/search", cast: "vault" },
  { word: "kept renewed", caption: "Let the name pay its rent from a reserve.", action: "Open Keeper", href: "/owner", cast: "seedling" },
  { word: "checked before you pay", caption: "Find out whether the name changed hands recently.", action: "Check a name", href: "/pay", cast: "stamp" },
];

export function VerbsScene() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (scope) => {
    const media = gsap.matchMedia();
    media.add("(min-width: 48rem) and (min-height: 40rem)", () => {
      const panels = Array.from(scope.querySelectorAll<HTMLElement>(".verbs-item"));
      const choices = Array.from(scope.querySelectorAll<HTMLButtonElement>(".verbs-choice"));
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
        scrollTrigger: { trigger: scope, start: "top top", end: "+=240%", pin: true, pinType: "transform", scrub: SCRUB, invalidateOnRefresh: true },
        onUpdate: () => show(Math.min(3, Math.floor(timeline.time()))),
      });
      panels.forEach((panel, i) => {
        timeline.fromTo(panel, { autoAlpha: 0, filter: "blur(12px)", y: 20 }, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: 0.15, ease: EASE.enter }, i);
        timeline.fromTo(panel.querySelector(".verbs-object"), { x: -120, rotation: -16 }, { x: 160, rotation: 18, duration: 0.9, ease: EASE.scrub }, i);
        if (i < panels.length - 1) timeline.to(panel, { autoAlpha: 0, filter: "blur(12px)", y: -16, duration: 0.15 }, i + 0.85);
      });
      timeline.to({}, { duration: 0.1 });
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
              <div className="verbs-phrase"><h3>{verb.word}</h3><span className="verbs-object" aria-hidden="true"><CastObject kind={verb.cast} size={112} /></span></div>
              <div className="verbs-caption"><p>{verb.caption}</p><PillLink href={verb.href}>{verb.action}</PillLink></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
