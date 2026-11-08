// Home scene: six leftovers rise as coloured frames, settle into cards, and open in place.
"use client";
import { useId, useRef, useState } from "react";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { CastObject } from "@/scenes/tag/cast";
import { Character, type Pose, type Who } from "@/scenes/tag/character";
import { GlassTag } from "@/scenes/tag/glass-tag";
import { cordsFor } from "@/scenes/tag/cords";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";
import { answerCords, answerFor, LEFTOVERS, STAMP_LABEL, tally, type LeftoverId } from "./leftovers";

const ANSWER: Record<ReturnType<typeof answerFor>, string> = {
  cut: "Cut in a Clean Sale.",
  tied: "Still tied. Only the seller can fix it.",
  travels: "Goes to the buyer with the name.",
  none: `${DEMO_NAME} has none.`,
  unread: "ATTO couldn't read this part.",
};

// Who pops up to confirm each answer, and how they stand.
const RESPONDER: Record<ReturnType<typeof answerFor>, { who: Who; pose: Pose }> = {
  cut: { who: "checker", pose: "point" },
  tied: { who: "seller", pose: "stand" },
  travels: { who: "buyer", pose: "carry" },
  none: { who: "checker", pose: "wave" },
  unread: { who: "checker", pose: "stand" },
};

export function LeftoversScene() {
  const ref = useRef<HTMLElement>(null);
  const uid = useId();
  const [openId, setOpenId] = useState<LeftoverId | null>(null);
  const { data: report } = useDemoReport();
  const open = LEFTOVERS.find((item) => item.id === openId) ?? null;
  const cords = report ? cordsFor(report) : [];
  const answer = report && open ? answerFor(report, cords, open) : null;

  useScene(ref, (scope) => {
    const cards = scope.querySelectorAll(".leftover");
    const tl = gsap.timeline({
      scrollTrigger: { trigger: scope.querySelector(".leftovers-grid"), start: "top 95%", end: "top 30%", scrub: SCRUB },
      defaults: { ease: EASE.scrub },
    });
    tl.from(scope.querySelectorAll(".leftovers-head > *"), { y: 60, autoAlpha: 0, duration: 0.4, stagger: 0.1 }, 0)
      .from(cards, { yPercent: 70, scale: 1.18, duration: 0.6, stagger: 0.08 }, 0)
      .fromTo(
        scope.querySelectorAll(".leftover-frame"),
        { autoAlpha: 1, scale: 1 },
        { autoAlpha: 0, scale: 0.9, duration: 0.35, stagger: 0.08 },
        0.45,
      )
      .from(scope.querySelectorAll(".leftover-face"), { autoAlpha: 0, duration: 0.3, stagger: 0.08 }, 0.55)
      .from(scope.querySelector(".leftovers-answer"), { autoAlpha: 0, x: 40, duration: 0.4 }, 0.6);
  });

  return (
    <section ref={ref} className="scene scene-leftovers" aria-labelledby={`${uid}-title`}>
      <div className="leftovers-head">
        <h2 id={`${uid}-title`} className="leftovers-title">
          What a name keeps.
        </h2>
        <p className="leftovers-note">Six leftovers a sale can miss. Open one.</p>
      </div>

      <div className="leftovers-body">
        <ul className="leftovers-grid">
          {LEFTOVERS.map((item, i) => {
            const isOpen = item.id === openId;
            const count = report ? tally(report, item.section) : undefined;
            return (
              <li key={item.id} className={`leftover frame-${i % 3}`} data-open={isOpen || undefined}>
                <div className="leftover-frame" aria-hidden="true" />
                <div className="leftover-face">
                  <button
                    type="button"
                    className="leftover-button"
                    aria-expanded={isOpen}
                    aria-controls={`${uid}-${item.id}`}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                  >
                    <span className="leftover-top">
                      <CastObject kind={item.object} size={52} cut={isOpen && item.stamp === "clears"} />
                      <span className={`leftover-stamp stamp-${item.stamp}`}>{STAMP_LABEL[item.stamp]}</span>
                    </span>
                    <span className="leftover-name">{item.name}</span>
                    <span className="leftover-count">
                      {count === undefined ? `${DEMO_NAME}: ...` : count === null ? `${DEMO_NAME}: couldn't read` : `${DEMO_NAME}: ${count}`}
                    </span>
                  </button>
                  <div id={`${uid}-${item.id}`} className="leftover-more" inert={!isOpen} aria-hidden={!isOpen}>
                    <div>
                      {item.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="leftovers-answer" aria-label={`The ${DEMO_NAME} tag`} data-answer={answer ?? undefined}>
          {report && <GlassTag name={report.name} cords={answerCords(cords, open)} size="inline" />}
          <p className="leftovers-answer-line" aria-live="polite">
            {open && answer ? `${open.name}: ${ANSWER[answer]}` : "Open a leftover to see its cord."}
          </p>
          {open && answer && (
            <div key={open.id} className="leftovers-popper" aria-hidden="true">
              <p className="leftovers-bubble">{ANSWER[answer]}</p>
              <Character who={RESPONDER[answer].who} pose={RESPONDER[answer].pose} height={150} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
