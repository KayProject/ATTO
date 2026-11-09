// Home scene: the problem in one sentence that fills word by word on scroll, a highlight behind its key phrase, then the explanation.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers that GSAP moves directly */
"use client";
import { useRef } from "react";
import Link from "next/link";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { GLASS } from "../assets";
import { DEMO_NAME } from "../use-demo-report";

const BEFORE = "Buying a name doesn't always give you";
const MARK = "full control";
const AFTER = "of it.";

const words = (text: string) =>
  text.split(" ").map((word, i) => (
    <span key={i} className="statement-word">
      {word}{" "}
    </span>
  ));

export function StatementScene() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, (scope) => {
    const q = (s: string) => scope.querySelector<HTMLElement>(s)!;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: scope, start: "top 75%", end: "bottom bottom", scrub: SCRUB },
      defaults: { ease: EASE.scrub },
    });
    tl.from(q(".statement-text"), { y: "16vh", duration: 0.45 }, 0)
      .fromTo(scope.querySelectorAll(".statement-word"), { opacity: 0.14 }, { opacity: 1, duration: 0.1, stagger: 0.05 }, 0.05)
      .from(q(".statement-hl"), { scaleX: 0, duration: 0.2 }, ">-0.12")
      .fromTo(q(".statement-key"), { x: "18vw", y: -40, rotate: 30, autoAlpha: 0 }, { x: 0, y: 0, rotate: -12, autoAlpha: 1, duration: 0.35 }, 0.25)
      .from(q(".statement-body"), { autoAlpha: 0, y: 24, duration: 0.15 }, ">-0.05")
      .from(q(".statement-link"), { autoAlpha: 0, y: 16, duration: 0.12 }, ">")
      .to({}, { duration: 0.15 });
    gsap.to(q(".statement-key img"), { y: 10, rotate: 4, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
  });

  return (
    <section ref={ref} className="scene scene-statement" aria-labelledby="statement-text">
      <div className="statement-stage">
        <span className="statement-key" aria-hidden="true">
          <img src={GLASS("key")} alt="" draggable={false} />
        </span>
        <h2 id="statement-text" className="statement-text">
          {words(BEFORE)}
          <span className="statement-mark">
            <span className="statement-hl" aria-hidden="true" />
            {MARK.split(" ").map((word, i) => (
              <span key={i} className="statement-word">
                {i > 0 ? " " : ""}
                {word}
              </span>
            ))}
          </span>{" "}
          {words(AFTER)}
        </h2>
        <p className="statement-body">
          A NEAR name is also an account. The previous owner can keep access through other apps. For example, a signing
          key in NEAR Intents can still move the name&apos;s funds. ATTO removes that access before the sale completes.
        </p>
        <Link href={`/names/${DEMO_NAME}`} className="statement-link">
          <span className="statement-dot" aria-hidden="true" />
          See an example report
        </Link>
      </div>
    </section>
  );
}
