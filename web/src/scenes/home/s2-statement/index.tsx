// Home scene: one sentence fills word by word on scroll, with a highlight behind its last phrase.
"use client";
import { useRef } from "react";
import Link from "next/link";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { DEMO_NAME } from "../use-demo-report";

const LEAD = "A rented name changes hands. Its keys don't.";
const MARK = "ATTO finds them.";

export function StatementScene() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, (scope) => {
    const words = scope.querySelectorAll(".statement-word");
    const tl = gsap.timeline({
      scrollTrigger: { trigger: scope, start: "top 75%", end: "bottom bottom", scrub: SCRUB },
      defaults: { ease: EASE.scrub },
    });
    tl.from(scope.querySelector(".statement-text"), { y: "18vh", duration: 0.5 }, 0)
      .fromTo(words, { opacity: 0.14 }, { opacity: 1, duration: 0.12, stagger: 0.07 }, 0.05)
      .from(scope.querySelector(".statement-hl"), { scaleX: 0, duration: 0.25 }, ">-0.05")
      .from(scope.querySelector(".statement-link"), { autoAlpha: 0, y: 16, duration: 0.15 }, ">")
      .to({}, { duration: 0.15 });
  });

  return (
    <section ref={ref} className="scene scene-statement" aria-labelledby="statement-text">
      <div className="statement-stage">
        <h2 id="statement-text" className="statement-text">
          {LEAD.split(" ").map((word, i) => (
            <span key={i} className="statement-word">
              {word}{" "}
            </span>
          ))}
          <span className="statement-mark">
            <span className="statement-hl" aria-hidden="true" />
            {MARK.split(" ").map((word, i) => (
              <span key={i} className="statement-word">
                {i > 0 ? " " : ""}
                {word}
              </span>
            ))}
          </span>
        </h2>
        <Link href={`/names/${DEMO_NAME}`} className="statement-link">
          <span className="statement-dot" aria-hidden="true" />
          See an example report
        </Link>
      </div>
    </section>
  );
}
