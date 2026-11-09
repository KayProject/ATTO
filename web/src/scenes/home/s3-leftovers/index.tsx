// Home scene: six things a name can carry, hung as album posters; opening one lifts it out under a picture light.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers */
"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "@/motion/gsap";
import { EASE, REDUCED, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { cordsFor } from "@/scenes/tag/cords";
import { GLASS, PENCIL, type GlassName, type PencilName } from "../assets";
import { box, cord, hang, knot, layer, pin, tieOf, TIE } from "../glass-rig";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";
import { answerFor, CREDITS, LEFTOVERS, STAMP_LABEL, tally, type Leftover, type LeftoverId } from "./leftovers";

type Answer = ReturnType<typeof answerFor>;

const ANSWER: Record<Answer, string> = {
  cut: "ATTO removes this during the sale.",
  tied: "The seller handles this. The buyer sees it on the report.",
  travels: "This goes to the buyer with the name.",
  none: `${DEMO_NAME} has none.`,
  unread: "ATTO couldn't read this part.",
};

// Who pops up to answer: the buyer for good news, the seller for what the seller handles.
const RESPONDER: Record<Answer, PencilName> = {
  cut: "buyer-wave",
  tied: "seller-walk-a",
  travels: "buyer-wave",
  none: "buyer-wave",
  unread: "woman-body",
};

// The answer panel: the tag on the left, the open item hanging from its top hole.
const STAGE = { w: 280, h: 200 };
const TAG = layer("tag-cloudy", 4, 84, 196, -10);
const HOLE = pin(TAG, TIE.tagHoles[0]);
const TARGET = { x: 236, y: 34 };
const OBJECT_W: Partial<Record<GlassName, number>> = { key: 78, "nft-frame": 50, seal: 40, "subaccount-tag": 66, "mode-switch": 74, coin: 52 };

function answerRig(name: GlassName) {
  const w = OBJECT_W[name] ?? 56;
  const tie = tieOf(name);
  const object = tie ? hang(name, w, tie, TARGET) : layer(name, TARGET.x - w / 2, TARGET.y - 10, w);
  const line = cord(HOLE, tie ? TARGET : HOLE, 22);
  const mid = { x: (HOLE.x + TARGET.x) / 2, y: (HOLE.y + TARGET.y) / 2 + 22 };
  return { object, line, knots: [knot(HOLE, mid, 3.2, 3), knot(TARGET, mid, 3, 3)] };
}

/** One poster's artwork. The small and the open poster share it, so growing one into the other is a pure scale. */
function PosterArt({ item, count }: { item: Leftover; count: string }) {
  const credits = CREDITS[item.stamp];
  return (
    <>
      <span className={`poster-cover cover-${item.stamp}`}>
        <span className="poster-cover-glow" />
        <img className="poster-object" src={GLASS(item.object)} alt="" draggable={false} />
      </span>
      <span className="poster-title">{item.name}</span>
      <span className="poster-head">
        <span className={`poster-artist stamp-${item.stamp}`}>{STAMP_LABEL[item.stamp]}</span>
        <span className="poster-sign">{count}</span>
      </span>
      <span className="poster-rule" />
      <span className="poster-tracks">
        <span className="poster-list">
          {item.lines.map((line, i) => (
            <span key={line} className="poster-track">
              <span className="poster-track-no">{i + 1}.</span> {line}
            </span>
          ))}
        </span>
        <span className="poster-credits">
          <span className="poster-credit">
            <b>Handled by</b> {credits.by}
          </span>
          <span className="poster-credit">
            <b>When</b> {credits.when}
          </span>
        </span>
      </span>
      <span className="poster-mark">atto.</span>
    </>
  );
}

export function LeftoversScene() {
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const closing = useRef(false);
  const uid = useId();
  const [openId, setOpenId] = useState<LeftoverId | null>(null);
  const { data: report } = useDemoReport();
  const open = LEFTOVERS.find((item) => item.id === openId) ?? null;
  const answer = report && open ? answerFor(report, cordsFor(report), open) : null;
  const rig = open ? answerRig(open.object) : null;

  const countOf = (item: Leftover) => {
    const count = report ? tally(report, item.section) : undefined;
    return count === undefined ? `${DEMO_NAME}: ...` : count === null ? `${DEMO_NAME}: couldn't read` : `${DEMO_NAME}: ${count}`;
  };

  // Decode the pencil people up front, so the first answer never stalls a frame.
  useEffect(() => {
    new Set(Object.values(RESPONDER)).forEach((name) => {
      const img = new Image();
      img.src = PENCIL(name);
      void img.decode().catch(() => {});
    });
  }, []);

  const cardOf = useCallback((id: LeftoverId) => wallRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`) ?? null, []);

  // Open: the poster grows from its place on the wall to the open size, then the lamp drops and switches on.
  // Everything moves by transform and opacity, so the page never reflows while it plays.
  useLayoutEffect(() => {
    const el = openRef.current;
    const wall = wallRef.current;
    if (!openId || !el || !wall) return;
    closing.current = false;
    const card = cardOf(openId);
    const poster = el.querySelector<HTMLElement>(".poster-open-frame")!;
    const others = Array.from(wall.querySelectorAll<HTMLElement>(".poster-card")).filter((c) => c !== card);
    closeRef.current?.focus({ preventScroll: true });
    if (!card || window.matchMedia(REDUCED).matches) {
      gsap.set(card, { autoAlpha: 0 });
      return () => {
        gsap.set(card, { clearProps: "opacity,visibility" });
      };
    }
    // Hang the open poster in the middle of the screen, kept within the wall, leaving room for the lamp.
    const wallTop = wall.getBoundingClientRect().top;
    const h = poster.offsetHeight;
    const lamp = poster.offsetWidth * 0.09;
    const mid = window.innerHeight / 2 + 24 - wallTop - h / 2;
    poster.style.top = `${Math.max(lamp, Math.min(mid, wall.offsetHeight - h))}px`;
    const from = card.querySelector<HTMLElement>(".poster-frame")!.getBoundingClientRect();
    const to = poster.getBoundingClientRect();
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.set(card, { autoAlpha: 0 }, 0)
      .fromTo(
        poster,
        { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width, transformOrigin: "0 0", force3D: true },
        { x: 0, y: 0, scale: 1, duration: 0.85 },
        0,
      )
      .fromTo(el.querySelector(".poster-room"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, 0)
      .to(others, { autoAlpha: 0.22, duration: 0.5, ease: "power2.out" }, 0)
      .fromTo(el.querySelector(".poster-lamp"), { y: -28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" }, 0.45)
      .fromTo(el.querySelectorAll(".poster-light"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, ease: "power2.inOut" }, 0.8)
      .fromTo(closeRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.7);
    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      gsap.set([card, ...others], { clearProps: "opacity,visibility" });
    };
  }, [openId, cardOf]);

  // Close: the light goes out first, then the poster shrinks back into its place on the wall.
  const close = useCallback(() => {
    const tl = tlRef.current;
    const id = openId;
    if (!id || closing.current) return;
    closing.current = true;
    const done = () => {
      setOpenId(null);
      cardOf(id)?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    };
    if (!tl) return done();
    tl.eventCallback("onReverseComplete", done);
    tl.timeScale(1.6).reverse();
  }, [openId, cardOf]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  useScene(ref, (scope) => {
    // Posters slide up onto the wall as the section arrives. Moves only, no scaling, so the type stays sharp.
    const tl = gsap.timeline({
      scrollTrigger: { trigger: scope.querySelector(".leftovers-grid"), start: "top 95%", end: "top 35%", scrub: SCRUB },
      defaults: { ease: EASE.scrub },
    });
    tl.from(scope.querySelectorAll(".leftovers-head > *"), { y: 60, autoAlpha: 0, duration: 0.4, stagger: 0.1 }, 0)
      .from(scope.querySelectorAll(".poster-hang"), { y: 120, autoAlpha: 0, duration: 0.6, stagger: 0.08, force3D: true }, 0)
      .from(scope.querySelector(".leftovers-answer"), { autoAlpha: 0, x: 40, duration: 0.4 }, 0.5);
  });

  return (
    <section ref={ref} className="scene scene-leftovers" aria-labelledby={`${uid}-title`}>
      <div className="leftovers-head">
        <h2 id={`${uid}-title`} className="leftovers-title">
          Know what comes with the name before you buy it.
        </h2>
        <p className="leftovers-note">
          Every name gets a report of what it holds and who can still act on it. Each item is marked as one of three
          things: ATTO clears it, the seller fixes it, or it goes to the buyer with the name.
        </p>
      </div>

      <div className="leftovers-body">
        <div ref={wallRef} className="leftovers-wall" data-open={openId ?? undefined}>
          <ul className="leftovers-grid">
            {LEFTOVERS.map((item) => (
              <li key={item.id} className="poster-card" data-id={item.id}>
                <div className="poster-hang">
                  <button
                    type="button"
                    className="poster-frame"
                    aria-expanded={item.id === openId}
                    aria-controls={`${uid}-open`}
                    onClick={() => (item.id === openId ? close() : setOpenId(item.id))}
                  >
                    <span className="sr-only">
                      {item.name}, {STAMP_LABEL[item.stamp]}, {countOf(item)}
                    </span>
                    <span className="poster-mat" aria-hidden="true">
                      <PosterArt item={item} count={countOf(item)} />
                    </span>
                    <span className="poster-glaze" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {open && (
            <div ref={openRef} id={`${uid}-open`} className="poster-open" role="region" aria-label={open.name}>
              <div className="poster-room" onClick={close} aria-hidden="true" />
              <div className="poster-open-frame">
                <div className="poster-lamp" aria-hidden="true">
                  <span className="poster-lamp-arm" />
                  <span className="poster-lamp-bar">
                    <span className="poster-light poster-lamp-led" />
                  </span>
                </div>
                <div className="poster-frame is-open">
                  <span className="poster-mat">
                    <PosterArt item={open} count={countOf(open)} />
                  </span>
                  <span className="poster-glaze" aria-hidden="true" />
                  <span className="poster-light poster-wash" aria-hidden="true" />
                </div>
                <span className="poster-light poster-wall-wash" aria-hidden="true" />
                <button ref={closeRef} type="button" className="poster-close" onClick={close}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="leftovers-answer" aria-label={`The ${DEMO_NAME} tag`} data-answer={answer ?? undefined}>
          <div className="answer-stage" aria-hidden="true">
            {rig && (
              <svg className="answer-cord" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}>
                <path className="answer-cord-a" d={rig.line.near} />
                <path className="answer-cord-b" d={rig.line.far} />
                {rig.knots.map((k, e) => (
                  <g key={e} className={e ? "answer-knot answer-cord-b" : "answer-knot"}>
                    <path d={k.loop} />
                    <path d={k.tail} />
                    <circle cx={k.bead.x} cy={k.bead.y} r="2.6" />
                  </g>
                ))}
              </svg>
            )}
            <div className="answer-tag" style={box(TAG, STAGE)}>
              <img src={GLASS(answer === "cut" ? "tag-clean" : "tag-cloudy")} alt="" draggable={false} />
              <span className="answer-tag-name">{report?.name ?? DEMO_NAME}</span>
            </div>
            {open && rig && (
              <span key={open.id} className="answer-object" style={box(rig.object, STAGE)}>
                <img src={GLASS(open.object)} alt="" draggable={false} />
              </span>
            )}
          </div>
          <p className="leftovers-answer-line" aria-live="polite">
            {open && answer ? `${open.name}: ${ANSWER[answer]}` : "Open a poster to see what happens to it."}
          </p>
          {open && answer && (
            <div key={open.id} className="leftovers-popper" aria-hidden="true">
              <p className="leftovers-bubble">{ANSWER[answer]}</p>
              <img className="leftovers-person" src={PENCIL(RESPONDER[answer])} alt="" draggable={false} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
