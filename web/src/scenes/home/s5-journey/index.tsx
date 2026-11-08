"use client";

import { useRef, useState } from "react";
import { useLoad } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { formatNear } from "@/lib/atto/format";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { CastObject } from "@/scenes/tag/cast";
import { cordsFor, isDrawnClean } from "@/scenes/tag/cords";
import { GlassTag } from "@/scenes/tag/glass-tag";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";
import { journeyState } from "./model";

const stops = [
  { word: "Listed", fact: "The buyer reads and accepts the report." },
  { word: "Paid", fact: "48 h buyer reclaim if the name never arrives." },
  { word: "Handed over", fact: "The escrow holds the name and payment." },
  { word: "Cut", fact: "Intents keys and NFT approvals are removed." },
  { word: "Checked", fact: "Full reversal if the check fails." },
  { word: "Swapped", fact: "Name to buyer. NEAR to seller. In the same step." },
];

export function JourneyScene() {
  const ref = useRef<HTMLElement>(null);
  const sceneCleanup = useRef<(() => void) | null>(null);
  const { data: report, error } = useDemoReport();
  const { data: sales } = useLoad(() => atto.openSales(), []);
  const [progress, setProgress] = useState({ cleared: 0, stamped: false, stop: 0 });
  const initialCords = report ? cordsFor(report) : [];
  const liveCords = report ? cordsFor(report, progress.cleared) : [];
  const total = initialCords.filter((cord) => cord.kind === "clears").length;
  const listing = sales?.find((sale) => sale.token_id === report?.name);
  const payment = listing ? `${formatNear(listing.price)} NEAR` : "NEAR payment";

  useScene(ref, (scope) => {
    sceneCleanup.current?.();
    sceneCleanup.current = null;
    if (!report) return;
    const media = gsap.matchMedia();
    media.add("(min-width: 48rem) and (min-height: 40rem)", () => {
      const track = scope.querySelector<HTMLElement>(".journey-track")!;
      const traveler = scope.querySelector(".journey-traveler");
      scope.classList.add("journey-motion");
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: scope, start: "top top", end: "+=440%", pin: true, pinType: "transform", scrub: SCRUB, invalidateOnRefresh: true },
      });
      const cursor = { progress: 0 };
      timeline.to(track, { x: () => -(track.scrollWidth - scope.clientWidth), duration: 5.8, ease: EASE.scrub }, 0);
      timeline.to(cursor, { progress: 1, duration: 5.8, ease: EASE.scrub, onUpdate: () => {
        const next = journeyState(cursor.progress, initialCords);
        setProgress((old) => old.cleared === next.cleared && old.stamped === next.stamped && old.stop === next.stop ? old : next);
      } }, 0);
      timeline.fromTo(scope.querySelector(".journey-path-progress"), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 5.8, ease: EASE.scrub }, 0);
      timeline.fromTo(traveler, { x: 0, y: 16, rotation: -4 }, { x: () => scope.clientWidth * 0.12, y: -20, rotation: 3, duration: 4.8, ease: EASE.scrub }, 0);
      timeline.to(traveler, { x: () => -scope.clientWidth * 0.12, rotation: -5, duration: 0.5 }, 4.8);
      timeline.fromTo(scope.querySelector(".journey-payment"), { x: -160, autoAlpha: 0 }, { x: 160, autoAlpha: 1, duration: 0.5 }, 4.8);
      timeline.fromTo(scope.querySelector(".journey-refusal"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 5.3);
      timeline.fromTo(scope.querySelector(".journey-old-key"), { x: 180, rotation: -25 }, { x: 0, rotation: 0, duration: 0.15 }, 5.3)
        .to(scope.querySelector(".journey-old-key"), { x: 70, rotation: 25, duration: 0.25, ease: EASE.enter }, 5.45);
      return () => { scope.classList.remove("journey-motion"); };
    });
    const cleanup = () => media.revert();
    sceneCleanup.current = cleanup;
    return cleanup;
  }, [report]);

  return (
    <section ref={ref} className="scene scene-journey" aria-labelledby="journey-title">
      <div className="journey-top"><h2 id="journey-title">A Clean Sale, step by step.</h2><span>Sale walkthrough</span></div>
      {report ? <>
        <ol className="journey-track" aria-label="The six steps of a Clean Sale" tabIndex={0}>
          {stops.map((stop, index) => {
            const cords = cordsFor(report, index >= 3 ? total : 0);
            return <li className="journey-stop" key={stop.word}>
              <h3>{stop.word}</h3><p className="journey-fact">{stop.fact}</p>
              <div className="journey-still-tag"><GlassTag name={report.name} cords={cords} size="panel" stamped={index >= 4} /></div>
              {index === 5 && <div className="journey-still-end"><span>{payment}</span>{initialCords.some((cord) => cord.object === "key" && cord.kind === "clears") && <p>The old Intents key can no longer withdraw.</p>}</div>}
            </li>;
          })}
        </ol>
        <div className="journey-moving" aria-hidden="true">
          <div className="journey-traveler"><GlassTag name={report.name} cords={liveCords} size="panel" stamped={progress.stamped} /></div>
          <span className="journey-payment">{payment}</span>
          <div className="journey-refusal"><span className="journey-old-key"><CastObject kind="key" size={88} cut /></span><p>The old Intents key can no longer withdraw.</p></div>
        </div>
        <svg className="journey-path" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 64 C180 64 180 12 360 32 S540 98 720 64 S900 12 1080 32 S1260 98 1440 64" /><path className="journey-path-progress" pathLength="100" strokeDasharray="100" d="M0 64 C180 64 180 12 360 32 S540 98 720 64 S900 12 1080 32 S1260 98 1440 64" /></svg>
        <p className="journey-honesty">{isDrawnClean(cordsFor(report, total)) ? "All reported connections can be cleared." : "Seller-only connections stay attached; unreadable sections stay marked."}</p>
      </> : <p className="journey-unavailable" role="status">{error ? "The example report could not load. Search a name to read its report." : report === null ? `No report is available for ${DEMO_NAME}. Search another name.` : "Loading the example report…"}</p>}
    </section>
  );
}
