// Home scene: night falls; ownership answers fly past at depth through a glass arch, then the name field appears.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers */
"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoad } from "@/components/providers";
import { PillButton } from "@/components/ui/pill-button";
import { atto } from "@/lib/atto/client";
import type { ChangedAnswer } from "@/lib/atto/types";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import Link from "next/link";
import { GLASS, type GlassName } from "../assets";

const DAYS = 30;
const CARD_OBJECT: GlassName[] = ["stamp", "key", "subaccount-tag"];
type CheckExample = { name: string; answer: ChangedAnswer | null; failed: boolean };

async function loadExamples(): Promise<CheckExample[]> {
  const names = await atto.sampleNames();
  return Promise.all([...new Set([...names.slice(0, 2), ...names.slice(-1)])].map(async (name) => {
    try { return { name, answer: await atto.changedOwner(name, DAYS), failed: false }; }
    catch { return { name, answer: null, failed: true }; }
  }));
}

function answerText(example: CheckExample) {
  if (example.failed || example.answer === null) return "Couldn't read this name's owner history.";
  if (!example.answer.changed) return `Same owner for the past ${DAYS} days.`;
  const date = example.answer.at ? new Date(example.answer.at) : null;
  return date && !Number.isNaN(date.getTime())
    ? `New owner since ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.`
    : `Changed owner in the past ${DAYS} days.`;
}

export function CheckNightScene() {
  const ref = useRef<HTMLElement>(null);
  const sceneCleanup = useRef<(() => void) | null>(null);
  const router = useRouter();
  const { data: examples, error, loading } = useLoad(loadExamples, []);
  const [name, setName] = useState("");
  useScene(ref, (scope) => {
    sceneCleanup.current?.();
    sceneCleanup.current = null;
    if (!examples?.length) return;
    const media = gsap.matchMedia();
    media.add("(min-height: 40rem)", () => {
      scope.classList.add("check-motion");
      gsap.from(scope.querySelector(".check-surface"), { clipPath: "inset(100% 0 0 0)", ease: EASE.scrub,
        scrollTrigger: { trigger: scope, start: "top bottom", end: "top top", scrub: SCRUB } });
      const cards = Array.from(scope.querySelectorAll<HTMLElement>(".check-answer"));
      const heading = scope.querySelector("h2");
      const timeline = gsap.timeline({ scrollTrigger: { trigger: scope, start: "top top", end: "+=210%", pin: true, anticipatePin: 1, scrub: SCRUB, invalidateOnRefresh: true } });
      timeline.from(heading, { y: 80, filter: "blur(16px)", autoAlpha: 0, duration: 0.5, ease: EASE.enter }, 0)
        .from(scope.querySelector(".check-arch"), { y: 120, scale: 0.85, autoAlpha: 0, duration: 0.6, ease: EASE.enter }, 0)
        .from(scope.querySelector(".check-sub"), { autoAlpha: 0, y: 20, duration: 0.3 }, 0.35)
        .to([heading, scope.querySelector(".check-sub")], { opacity: 0.3, duration: 0.3 }, 0.6);
      cards.forEach((card, i) => {
        timeline.fromTo(card, { x: () => scope.clientWidth * 1.1, z: i % 2 ? -100 : 100, rotationY: -18, rotationZ: i % 2 ? 9 : -8 },
          { x: () => -scope.clientWidth * 1.1, z: i % 2 ? 40 : -40, rotationY: 18, rotationZ: i % 2 ? -6 : 6, duration: 1.8, ease: EASE.scrub }, 0.7 + i * 0.5);
      });
      timeline.to([heading, scope.querySelector(".check-sub")], { opacity: 1, duration: 0.4 }, 3.2)
        .from(scope.querySelector(".check-form"), { y: 32, opacity: 0, duration: 0.4 }, 3.2)
        .to({}, { duration: 0.4 });
      return () => { scope.classList.remove("check-motion"); };
    });
    const cleanup = () => media.revert();
    sceneCleanup.current = cleanup;
    return cleanup;
  }, [examples]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim().toLowerCase();
    if (value) router.push(`/pay?name=${encodeURIComponent(value)}`);
  }
  return (
    <section ref={ref} className="scene scene-check" aria-labelledby="check-night-title">
      <div className="check-surface">
        <img className="check-arch" src={GLASS("arch")} alt="" aria-hidden="true" draggable={false} />
        <div className="check-head">
          <h2 id="check-night-title">Check a name before sending funds.</h2>
          <p className="check-sub">
            Wallets and apps can ask ATTO whether a NEAR name recently changed owner.{" "}
            <Link href="/developers">Use the Check API</Link>
          </p>
        </div>
        <div className="check-cards" aria-label="Example ownership checks">
          {examples?.map((example, i) => <article className="check-answer" key={example.name} data-answer={example.failed || !example.answer ? "unknown" : example.answer.changed ? "changed" : "unchanged"}>
            <div className="check-card-face"><span className="check-card-label">Owner changes, past {DAYS} days</span><h3>{example.name}</h3><p>{answerText(example)}</p><img className="check-card-object" src={GLASS(CARD_OBJECT[i % CARD_OBJECT.length])} alt="" aria-hidden="true" draggable={false} /></div>
          </article>)}
          {loading && <p className="check-load" role="status">Reading ownership history…</p>}
          {(error || examples?.length === 0) && <p className="check-load" role="status">The examples could not load. Enter a name below to check it.</p>}
        </div>
        <form className="check-form" onSubmit={submit}>
          <label htmlFor="check-night-name">Which name are you sending funds to?</label>
          <div className="check-field"><input id="check-night-name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={examples?.[0]?.name ?? "Enter a NEAR name"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" pattern=".*\S.*" maxLength={64} required /><PillButton type="submit" tone="secondary">Check owner history</PillButton></div>
        </form>
      </div>
    </section>
  );
}
