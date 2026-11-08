// Home scene: the glass tag hero, which scrolls out onto the ground's horizon.
"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/pill-button";
import { gsap, ScrollTrigger, SplitText } from "@/motion/gsap";
import { DURATION, EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { Character } from "@/scenes/tag/character";
import { GlassTag } from "@/scenes/tag/glass-tag";
import { cordsFor } from "@/scenes/tag/cords";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";
import { whenPreloaderDone } from "../s0-preloader/signal";
import { heroCounts } from "../s3-leftovers/leftovers";

const GLYPHS = "ATOXNE#/+*<>";

// Plays the headline as a character scramble that settles into the real words.
function scramble(title: HTMLElement) {
  const split = SplitText.create(title, { type: "words,chars" });
  const chars = split.chars as HTMLElement[];
  const finals = chars.map((char) => char.textContent ?? "");
  // Hold each letter's width so stand-in glyphs never reflow the lines.
  const widths = chars.map((char) => char.getBoundingClientRect().width);
  chars.forEach((char, i) => {
    char.style.display = "inline-block";
    char.style.width = `${widths[i]}px`;
    char.style.textAlign = "center";
  });
  const state = { p: 0 };
  return gsap.to(state, {
    p: 1,
    duration: DURATION.reveal,
    ease: "none",
    onUpdate: () => {
      chars.forEach((char, i) => {
        const local = (state.p - (i / chars.length) * 0.7) / 0.3;
        if (local <= 0) char.style.opacity = "0";
        else if (local < 1) {
          char.style.opacity = "1";
          char.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        } else {
          char.style.opacity = "1";
          char.textContent = finals[i];
        }
      });
    },
    onComplete: () => split.revert(),
    onInterrupt: () => split.revert(),
  });
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

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
    const q = (selector: string) => scope.querySelector<HTMLElement>(selector);
    const all = (selector: string) => scope.querySelectorAll<HTMLElement>(selector);
    const stage = q(".hero-stage")!;
    const title = q(".hero-title")!;
    const tag = q(".hero-object")!;
    const ground = q(".hero-ground")!;

    // Entrance, played as the preloader opens.
    const intro = gsap.timeline({ paused: true });
    intro
      .from(q(".hero-horizon"), { yPercent: 40, duration: DURATION.reveal, ease: EASE.enter }, 0)
      .from(q(".hero-tag"), { autoAlpha: 0, y: 60, scale: 0.92, duration: DURATION.reveal, ease: EASE.enter }, 0.1)
      .add(() => {
        gsap.set(title, { autoAlpha: 1 });
        scramble(title);
      }, 0.15)
      .from(all(".hero-rise"), { autoAlpha: 0, y: 24, duration: DURATION.enter, ease: EASE.enter, stagger: 0.12 }, 0.7)
      .from(q(".crowd-left"), { x: -80, y: 120, autoAlpha: 0, duration: DURATION.reveal, ease: EASE.enter }, 0.35)
      .from(all(".crowd-left .crowd-person"), { y: 40, duration: DURATION.enter, ease: EASE.settle, stagger: 0.1 }, 0.45)
      .from(all(".hero-chip-slot"), { autoAlpha: 0, scale: 0.8, duration: DURATION.enter, ease: EASE.settle, stagger: 0.14 }, 0.9);
    gsap.set(title, { autoAlpha: 0 });
    const stopWaiting = whenPreloaderDone(() => intro.play());

    // Idle: chips drift slowly, each on its own beat.
    all(".hero-chip").forEach((chip, i) => {
      gsap.to(chip, { y: i % 2 ? 7 : -7, duration: 2.6 + i * 0.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });

    // Scroll out: headline shrinks and lifts, the ground rises and flattens, the tag settles on the horizon.
    const horizonEnd = () => stage.clientHeight * 0.58;
    const out = gsap.timeline({
      scrollTrigger: { trigger: scope, start: "top top", end: "bottom bottom", scrub: SCRUB, invalidateOnRefresh: true },
      defaults: { ease: EASE.scrub },
    });
    out
      .to(title, { scale: 0.6, y: () => (stage.clientWidth < 832 ? 0 : -stage.clientHeight * 0.1), duration: 1 }, 0)
      .to(all(".hero-fade"), { autoAlpha: 0, y: -40, duration: 0.45 }, 0)
      .to(q(".hero-chips"), { autoAlpha: 0, scale: 1.12, duration: 0.5 }, 0.05)
      .to(ground, { y: () => horizonEnd() - ground.offsetTop, scaleX: 1.9, duration: 1 }, 0)
      .to(all(".hero-crowd-ride"), { y: () => horizonEnd() - ground.offsetTop - stage.clientHeight * 0.03, duration: 1 }, 0)
      .fromTo(q(".crowd-right"), { x: () => stage.clientWidth * 0.45 }, { x: 0, duration: 0.7 }, 0.25)
      .to(
        tag,
        {
          scale: 0.72,
          x: () => (stage.clientWidth / 2 - (tag.offsetLeft + tag.offsetWidth / 2)) * 0.8,
          y: () => horizonEnd() - (tag.offsetTop + tag.offsetHeight / 2) - tag.offsetHeight * 0.3,
          duration: 1,
        },
        0,
      );
    ScrollTrigger.refresh();

    return () => {
      stopWaiting();
      intro.kill();
    };
  });

  return (
    <section ref={ref} className="scene scene-hero" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-horizon" aria-hidden="true">
          <div className="hero-ground" />
        </div>

        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">
            What still holds this name?
          </h1>
          <div className="hero-fade">
            <p className="hero-sub hero-rise">Names keep their old owner&apos;s keys.</p>
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
                Search
              </PillButton>
            </form>
          </div>
        </div>

        <div className="hero-object">
          <div className="hero-tag">
            {report ? (
              <GlassTag name={report.name} cords={cordsFor(report)} size="hero" />
            ) : (
              <div className="hero-tag-wait">{error ? "The example report didn't load." : DEMO_NAME}</div>
            )}
          </div>
          <ul className="hero-chips" aria-label={`Example report for ${DEMO_NAME}`} hidden={Boolean(error)}>
            <li className="hero-chip-slot slot-keys">
              <span className="hero-chip">
                <strong>{counts ? (counts.keys ?? "?") : "–"}</strong>
                {counts?.keys === null ? "Intents keys unread" : plural(counts?.keys ?? 2, "Intents key", "Intents keys")}
              </span>
            </li>
            <li className="hero-chip-slot slot-nfts">
              <span className="hero-chip">
                <strong>{counts ? (counts.nfts ?? "?") : "–"}</strong>
                {counts?.nfts === null ? "NFTs unread" : plural(counts?.nfts ?? 2, "NFT approval", "NFT approvals")}
              </span>
            </li>
            <li className="hero-chip-slot slot-seller">
              <span className="hero-chip chip-seller">
                <strong>{counts ? counts.seller : "–"}</strong>
                {plural(counts?.seller ?? 2, "needs the seller", "need the seller")}
              </span>
            </li>
          </ul>
        </div>

        <div className="hero-crowd-ride crowd-ride-left" aria-hidden="true">
          <div className="hero-crowd crowd-left">
            <span className="crowd-person"><Character who="crowd" pose="sit" height={120} /></span>
            <span className="crowd-person"><Character who="seller" pose="stand" height={132} /></span>
            <span className="crowd-person"><Character who="crowd" pose="point" height={126} /></span>
          </div>
        </div>
        <div className="hero-crowd-ride crowd-ride-right" aria-hidden="true">
          <div className="hero-crowd crowd-right">
            <span className="crowd-person"><Character who="buyer" pose="wave" height={128} flip /></span>
            <span className="crowd-person"><Character who="checker" pose="stand" height={124} flip /></span>
            <span className="crowd-person"><Character who="keeper" pose="sit" height={116} flip /></span>
          </div>
        </div>

        <p className="hero-note hero-fade">
          <span className="hero-rise">Example report: {DEMO_NAME}</span>
        </p>
      </div>
    </section>
  );
}
