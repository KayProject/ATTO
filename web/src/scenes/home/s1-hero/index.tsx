// Home scene: the glass name tag tied to what the previous owner still holds; scrolling cuts the cords ATTO clears.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers that GSAP moves directly */
"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/pill-button";
import { gsap, ScrollTrigger, SplitText } from "@/motion/gsap";
import { DURATION, EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";
import { whenPreloaderDone } from "../s0-preloader/signal";
import { heroCounts } from "../s3-leftovers/leftovers";
import { cordPaths, cutPoint, type CordState } from "./cords";
import { knot } from "../glass-rig";
import { BOX, CARDS, CORDS, JOINT, OBJECT_LAYER, OBJECTS, PEOPLE, TAG, TAG_LAYER, TIE_R, origin, pct } from "./layout";

import { GLASS as IMG, PENCIL as PERSON } from "../assets";

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

const CARD_PHOTO = { keys: "intents", nfts: "nft", seller: "seller" } as const;

// Resting cord shapes, so the first paint and reduced motion show the full scene.
const REST = CORDS.map((spec, i) => cordPaths(spec, { t: 0, cut: 0, fall: { x: 0, y: 0 } }, i * 1.7));

export function HeroScene() {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: report, error } = useDemoReport();
  const counts = report ? heroCounts(report) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = query.trim().toLowerCase();
    if (name) router.push(`/names/${encodeURIComponent(name)}`);
  }

  useScene(ref, (scope) => {
    const q = (s: string) => scope.querySelector<HTMLElement>(s)!;
    const all = (s: string) => Array.from(scope.querySelectorAll<HTMLElement>(s));
    const stage = q(".hero-stage");
    const box = q(".gh-box");
    const tag = q(".gh-tag");

    // Cord state is animated as plain numbers; a ticker redraws the paths every frame.
    const states: CordState[] = CORDS.map(() => ({ t: 0, cut: 0, fall: { x: 0, y: 0 } }));
    const nears = CORDS.map((c) => all(`[data-cord="${c.id}"] .gh-cord-near`));
    const fars = CORDS.map((c) => all(`[data-cord="${c.id}"] .gh-cord-far`));
    // Cord ends follow the tag's float and each object's bob, so they never leave their hole or ring.
    const tagCentre = { x: TAG_LAYER.x + TAG_LAYER.w / 2, y: TAG_LAYER.y + TAG_LAYER.h / 2 };
    const bobs = CORDS.map((c) => q(`[data-object="${c.id}"] .gh-object-bob`));
    const boxScale = () => box.clientWidth / BOX.w || 1;
    const turn = (p: { x: number; y: number }, c: { x: number; y: number }, deg: number, dy: number) => {
      const r = (deg * Math.PI) / 180;
      const dx = p.x - c.x;
      const dyy = p.y - c.y;
      return { x: c.x + dx * Math.cos(r) - dyy * Math.sin(r), y: c.y + dx * Math.sin(r) + dyy * Math.cos(r) + dy };
    };
    const knots = CORDS.map((c) =>
      [0, 1].map((e) => {
        const g = q(`[data-cord="${c.id}"] [data-knot="${e}"]`);
        return {
          loops: Array.from(g.querySelectorAll<SVGPathElement>(".gh-knot-loop")),
          tails: Array.from(g.querySelectorAll<SVGPathElement>(".gh-knot-tail")),
          beads: Array.from(g.querySelectorAll<SVGCircleElement>(".gh-knot-bead")),
        };
      }),
    );
    const draw = (time: number) => {
      const k = boxScale();
      const tagTurn = (gsap.getProperty(tag, "rotation") as number) - TAG.rotate!;
      const tagLift = (gsap.getProperty(tag, "y") as number) / k;
      CORDS.forEach((spec, i) => {
        states[i].t = time;
        const obj = OBJECT_LAYER[spec.id as keyof typeof OBJECT_LAYER];
        const objCentre = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };
        const from = turn(spec.from, tagCentre, tagTurn, tagLift);
        const to = turn(spec.to, objCentre, gsap.getProperty(bobs[i], "rotation") as number, (gsap.getProperty(bobs[i], "y") as number) / k);
        const shift = { x: (from.x - spec.from.x + to.x - spec.to.x) / 2, y: (from.y - spec.from.y + to.y - spec.to.y) / 2 };
        const live = { ...spec, from, to, control: spec.control && { x: spec.control.x + shift.x, y: spec.control.y + shift.y } };
        const { near, far } = cordPaths(live, states[i], i * 1.7);
        // Knots: tied through the tag hole, and through the object's ring (which falls with the object once cut).
        const ctrl = live.control ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + spec.sag };
        const fallen = { x: to.x + states[i].fall.x, y: to.y + states[i].fall.y };
        const t = TIE_R[spec.id];
        const ends = [knot(from, ctrl, t.from, 2, t.fromRim), knot(fallen, ctrl, t.to, 2, t.toRim)];
        ends.forEach((k, e) => {
          knots[i][e].loops.forEach((p) => p.setAttribute("d", k.loop));
          knots[i][e].tails.forEach((p) => p.setAttribute("d", k.tail));
          knots[i][e].beads.forEach((b, bi) => {
            b.setAttribute("cx", String(bi === 1 ? k.bead.x - 1 : k.bead.x));
            b.setAttribute("cy", String(bi === 1 ? k.bead.y - 1 : k.bead.y));
          });
        });
        nears[i].forEach((p) => p.setAttribute("d", near));
        fars[i].forEach((p) => p.setAttribute("d", far));
      });
    };
    // Redraw only while the hero is on screen; past it, the loop would cost frames in every other scene.
    const onScreen = ScrollTrigger.create({
      trigger: scope,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (self.isActive ? gsap.ticker.add(draw) : gsap.ticker.remove(draw)),
    });
    if (onScreen.isActive) gsap.ticker.add(draw);

    // Entrance as the preloader opens.
    const title = q(".hero-title");
    const split = SplitText.create(title, { type: "lines,words", mask: "lines" });
    const intro = gsap.timeline({ paused: true });
    intro
      .from(split.words, { yPercent: 110, duration: DURATION.reveal, ease: EASE.enter, stagger: 0.06 }, 0)
      .from(tag, { y: 80, rotate: -24, autoAlpha: 0, duration: 1.2, ease: EASE.enter }, 0.1)
      .from(all(".gh-object"), { y: -60, autoAlpha: 0, duration: 0.9, ease: EASE.settle, stagger: 0.1 }, 0.4)
      .from(all(".gh-cord"), { autoAlpha: 0, duration: 0.6 }, 0.5)
      // Each person's drawings rise together. The rise moves the images, not their layers: the wrappers stay untransformed
      // so every part joins the box's layer stack, and limb rotations never share a transform with the rise.
      .from(all(".gh-figure-woman img"), { y: 60, autoAlpha: 0, duration: 0.9, ease: EASE.enter }, 0.5)
      .from(all(".gh-figure-man img"), { y: 60, autoAlpha: 0, duration: 0.9, ease: EASE.enter }, 0.62)
      .from(all(".gh-card"), { scale: 0.85, autoAlpha: 0, duration: 0.7, ease: EASE.settle, stagger: 0.12 }, 0.9)
      .from(all(".hero-rise"), { y: 24, autoAlpha: 0, duration: DURATION.enter, ease: EASE.enter, stagger: 0.1 }, 0.6);
    const stopWaiting = whenPreloaderDone(() => intro.play());

    // Idle life: the tag floats, objects bob, cards drift, light sweeps across the glass, the man tugs his cord.
    // The float starts once the entrance has settled, so it swings around the resting pose and nowhere else.
    let float: gsap.core.Tween | null = null;
    intro.eventCallback("onComplete", () => {
      float = gsap.fromTo(tag, { y: 0, rotate: TAG.rotate! }, { y: -6, rotate: TAG.rotate! + 0.6, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    all(".gh-object-bob").forEach((el, i) =>
      gsap.to(el, { y: 8, rotate: i % 2 ? 4 : -4, duration: 2.4 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 }),
    );
    all(".gh-card-drift").forEach((el, i) =>
      gsap.to(el, { y: i % 2 ? 8 : -8, duration: 2.8 + i * 0.5, ease: "sine.inOut", yoyo: true, repeat: -1 }),
    );
    gsap.fromTo(
      all(".gh-shine"),
      { "--shine": "-40%" },
      { "--shine": "140%", duration: 1.6, ease: "power2.inOut", repeat: -1, repeatDelay: 3.4, stagger: 0.25 },
    );
    gsap.to(all(".gh-man-arm"), { rotate: -2.5, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 });

    // Pointer tilt: the glass leans toward the cursor.
    const tiltX = gsap.quickTo(box, "rotateY", { duration: 0.8, ease: "power3.out" });
    const tiltY = gsap.quickTo(box, "rotateX", { duration: 0.8, ease: "power3.out" });
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      tiltX(((e.clientX - r.left) / r.width - 0.5) * 8);
      tiltY(-((e.clientY - r.top) / r.height - 0.5) * 6);
    };
    stage.addEventListener("pointermove", onMove);

    // Scroll: the scissors close on the key cord, the NFT cord snaps, the glass clears; then the scene hands over.
    const fall = (i: number, target: HTMLElement, at: number, tl: gsap.core.Timeline) => {
      tl.to(states[i], { cut: 1, duration: 0.12, ease: "power2.out" }, at)
        .fromTo(q(`[data-flash="${CORDS[i].id}"]`), { scale: 0, autoAlpha: 1 }, { scale: 1.6, autoAlpha: 0, duration: 0.1 }, at)
        .to(states[i].fall, { y: 420, x: 30, duration: 0.22, ease: "power2.in" }, at + 0.02)
        .to(target, { y: 420, x: 30, rotate: 50, autoAlpha: 0, duration: 0.22, ease: "power2.in" }, at + 0.02);
    };
    const story = gsap.timeline({
      scrollTrigger: { trigger: scope, start: "top top", end: "bottom bottom", scrub: SCRUB, invalidateOnRefresh: true },
      defaults: { ease: EASE.scrub },
    });
    story
      .fromTo(q(".gh-woman-arm"), { rotate: 0 }, { rotate: 3, duration: 0.04 }, 0.2)
      .to(q(".gh-woman-arm"), { rotate: 0, duration: 0.05 }, 0.25);
    fall(0, q('[data-object="key"]'), 0.24, story);
    fall(1, q('[data-object="frame"]'), 0.36, story);
    story
      .to(q(".gh-tag-clean"), { autoAlpha: 1, duration: 0.14 }, 0.44)
      .to(all('[data-card="keys"] .gh-card-before, [data-card="nfts"] .gh-card-before'), { autoAlpha: 0, y: -8, duration: 0.06 }, 0.3)
      .fromTo(all(".gh-card-after"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.34)
      .to(q('[data-card="seller"]'), { scale: 1.06, duration: 0.06, yoyo: true, repeat: 1 }, 0.5)
      .to(title, { scale: 0.62, y: () => -stage.clientHeight * 0.08, duration: 0.3 }, 0.66)
      .to(all(".hero-fade"), { autoAlpha: 0, y: -30, duration: 0.18 }, 0.66)
      .to(q(".hero-ground"), { yPercent: -62, scaleX: 1.6, duration: 0.34 }, 0.66)
      .to(box, { y: () => -stage.clientHeight * 0.18, scale: 0.86, duration: 0.34 }, 0.66);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(draw);
      onScreen.kill();
      stage.removeEventListener("pointermove", onMove);
      stopWaiting();
      float?.kill();
      intro.kill();
      split.revert();
    };
  });

  // Pinned photo cards: what the tag is still tied to, shown as a real picture with its count underneath.
  const card = (key: "keys" | "nfts" | "seller", before: React.ReactNode, after?: React.ReactNode) => (
    <div className="gh-card" data-card={key} style={{ left: `${(CARDS[key].x / BOX.w) * 100}%`, top: `${(CARDS[key].y / BOX.h) * 100}%` }}>
      <div className="gh-card-drift">
        <figure className="gh-card-photo">
          <img className="gh-card-pin" src="/cards/pin.webp" alt="" draggable={false} />
          <span className="gh-card-shot">
            <img src={`/cards/${CARD_PHOTO[key]}.webp`} alt="" draggable={false} />
            {key === "keys" ? (
              <span className="gh-card-badge">
                <img src="/cards/near-intents.svg" alt="NEAR Intents" draggable={false} />
              </span>
            ) : null}
          </span>
          <figcaption className="gh-card-caption">
            <span className="gh-card-before">{before}</span>
            {after ? <span className="gh-card-after">{after}</span> : null}
          </figcaption>
        </figure>
      </div>
    </div>
  );

  return (
    <section ref={ref} className="scene scene-hero" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-plate" aria-hidden="true" />
        <div className="hero-ground" aria-hidden="true" />

        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">
            A safer way to buy and sell NEAR names.
          </h1>
          <div className="hero-fade">
            <p className="hero-sub hero-rise">
              ATTO holds the payment, transfers the name, and removes the previous owner&apos;s access before the sale
              completes.
            </p>
            <form role="search" className="hero-search hero-rise" onSubmit={submit}>
              <label className="sr-only" htmlFor="hero-name">
                NEAR name
              </label>
              <input
                id="hero-name"
                type="search"
                placeholder={DEMO_NAME}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <PillButton type="submit" beckon disabled={!query.trim()}>
                Search a name
              </PillButton>
            </form>
          </div>
        </div>

        <div className="gh-wrap">
          <div className="gh-box" aria-hidden="true">
            <div className="gh-giant">{report?.name ?? DEMO_NAME}</div>

            <div className="gh-tag" style={{ ...pct(TAG), transform: `rotate(${TAG.rotate}deg)` }}>
              <img className="gh-tag-img gh-tag-cloudy" src={IMG("tag-cloudy")} alt="" draggable={false} />
              <img className="gh-tag-img gh-tag-clean" src={IMG("tag-clean")} alt="" draggable={false} />
              <span className="gh-shine" style={{ maskImage: `url(${IMG("tag-clean")})` }} />
              <span className="tag-name">{report?.name ?? DEMO_NAME}</span>
            </div>

            <svg className="gh-cords" viewBox={`0 0 ${BOX.w} ${BOX.h}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="gh-cord-coral" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffb3a8" />
                  <stop offset="0.5" stopColor="#f95c4b" />
                  <stop offset="1" stopColor="#c8402f" />
                </linearGradient>
                <filter id="gh-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>
              {CORDS.map((spec, i) => (
                <g key={spec.id} className={`gh-cord cord-${spec.kind}`} data-cord={spec.id}>
                  {(["halo", "glow", "body", "shine"] as const).map((layer) => (
                    <g key={layer} className={`gh-cord-${layer}`}>
                      <path className="gh-cord-near" d={REST[i].near} />
                      <path className="gh-cord-far" d={REST[i].far} />
                    </g>
                  ))}
                  {[0, 1].map((e) => (
                    <g key={e} className="gh-knot" data-knot={e}>
                      <g className="gh-knot-glow">
                        <path className="gh-knot-loop" />
                      </g>
                      <g className="gh-knot-body">
                        <path className="gh-knot-loop" />
                        <path className="gh-knot-tail" />
                        <circle className="gh-knot-bead" r="5" />
                      </g>
                      <g className="gh-knot-shine">
                        <path className="gh-knot-loop" />
                        <path className="gh-knot-tail" />
                        <circle className="gh-knot-bead" r="2.2" />
                      </g>
                    </g>
                  ))}
                  <circle
                    className="gh-flash"
                    data-flash={spec.id}
                    cx={cutPoint(spec).x}
                    cy={cutPoint(spec).y}
                    r="28"
                  />
                </g>
              ))}
            </svg>

            {(Object.keys(OBJECTS) as (keyof typeof OBJECTS)[]).map((name) => (
              <div key={name} className="gh-object" data-object={name} style={pct(OBJECTS[name])}>
                <div className="gh-object-bob">
                  <img src={IMG(name === "frame" ? "nft-frame" : name)} alt="" draggable={false} />
                </div>
              </div>
            ))}

            <div className="gh-figure gh-figure-woman">
              <div className="gh-person gh-woman-arm" style={{ ...pct(PEOPLE.womanArm), transformOrigin: origin(JOINT.armShoulder) }}>
                <img src={PERSON("woman-arm-scissors")} alt="" draggable={false} />
              </div>
              <div className="gh-person gh-woman-body" style={pct(PEOPLE.woman)}>
                <img src={PERSON("woman-body")} alt="" draggable={false} />
              </div>
            </div>
            <div className="gh-figure gh-figure-man">
            <div className="gh-person gh-man-arm gh-man-arm-far" style={{ ...pct(PEOPLE.manArmFar), transformOrigin: origin(JOINT.farArmShoulder) }}>
              <img src={PERSON("man-arms")} alt="" draggable={false} />
            </div>
            <div className="gh-person gh-man-body" style={pct(PEOPLE.man)}>
              <img src={PERSON("man-body")} alt="" draggable={false} />
            </div>
            <div className="gh-person gh-man-arm gh-man-arm-near" style={{ ...pct(PEOPLE.manArmNear), transformOrigin: origin(JOINT.nearArmShoulder) }}>
              <img src={PERSON("man-arms")} alt="" draggable={false} />
            </div>
            </div>

            {card(
              "keys",
              <>
                <strong>{counts?.keys ?? "–"}</strong> {plural(counts?.keys ?? 1, "Intents key", "Intents keys")}
              </>,
              <>
                <strong>Removed</strong> in the sale
              </>,
            )}
            {card(
              "nfts",
              <>
                <strong>{counts?.nfts ?? "–"}</strong> {plural(counts?.nfts ?? 1, "NFT approval", "NFT approvals")}
              </>,
              <>
                <strong>Removed</strong> in the sale
              </>,
            )}
            {card(
              "seller",
              <>
                <strong>{counts?.seller ?? "–"}</strong> {plural(counts?.seller ?? 1, "for the seller", "for the seller")}
              </>,
            )}
          </div>
          {error ? <p className="hero-note">The example report didn&apos;t load.</p> : null}
        </div>
      </div>
    </section>
  );
}
