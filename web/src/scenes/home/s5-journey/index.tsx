// Home scene: the sale as a pinned sideways journey. Step words slide past while glass layers act out each step on the path.
/* eslint-disable @next/next/no-img-element -- pre-sized WebP layers that GSAP moves directly */
"use client";

import { useRef } from "react";
import { useLoad } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { formatNear } from "@/lib/atto/format";
import { gsap } from "@/motion/gsap";
import { EASE, SCRUB } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { cordsFor, isDrawnClean } from "@/scenes/tag/cords";
import { GLASS, PENCIL } from "../assets";
import { box, cord, hang, knot, layer, pin, TIE, type Point } from "../glass-rig";
import { DEMO_NAME, useDemoReport } from "../use-demo-report";

const stops = [
  { word: "Review", fact: "The buyer reads the name's report and agrees to the sale." },
  { word: "Pay", fact: "The buyer's payment goes into escrow. If the name doesn't arrive within 48 hours, the buyer can take it back." },
  { word: "Transfer", fact: "The seller transfers the name into escrow." },
  { word: "Remove access", fact: "ATTO removes the previous owner's Intents keys and NFT approvals." },
  { word: "Verify", fact: "ATTO checks on chain that they're gone." },
  { word: "Complete", fact: "The buyer receives the name and the seller receives the payment in the same step." },
];

const REFUSAL = "The previous owner's key tries to withdraw the name's funds, and NEAR Intents refuses it.";

// The name and what hangs from it, in a 400 x 300 box: each cord runs from a tag hole to the object's ring.
const B = { w: 400, h: 300 };
const TAG = layer("tag-cloudy", 0, 130, 280, -8);
const KEY = hang("key", 120, TIE.key, { x: 312, y: 46 });
const NFT = hang("nft-frame", 60, TIE["nft-frame"], { x: 356, y: 120 });
const SEAL = hang("seal", 46, TIE.seal, { x: 340, y: 226 });
const KEY_CORD = cord(pin(TAG, TIE.tagHoles[0]), pin(KEY, TIE.key), 14);
const NFT_CORD = cord(pin(TAG, TIE.tagHoles[1]), pin(NFT, TIE["nft-frame"]), 16);
const SEAL_CORD = cord(pin(TAG, TIE.tagHoles[2]), pin(SEAL, TIE.seal), 18);
// Each cord is knotted through its tag hole and through the object's ring.
const tied = (a: Point, b: Point, sag: number, ra: number, rb: number) => {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
  return [knot(a, mid, ra, 3.5), knot(b, mid, rb, 3.5)];
};
const KEY_KNOTS = tied(pin(TAG, TIE.tagHoles[0]), pin(KEY, TIE.key), 14, 4.5, 6);
const NFT_KNOTS = tied(pin(TAG, TIE.tagHoles[1]), pin(NFT, TIE["nft-frame"]), 16, 4.5, 3);
const SEAL_KNOTS = tied(pin(TAG, TIE.tagHoles[2]), pin(SEAL, TIE.seal), 18, 4.5, 3);
const Knot = ({ k, className }: { k: ReturnType<typeof knot>; className?: string }) => (
  <g className={`journey-knot ${className ?? ""}`}>
    <path d={k.loop} />
    <path d={k.tail} />
    <circle cx={k.bead.x} cy={k.bead.y} r="3.4" />
  </g>
);
const SCISSORS = layer("scissors-open", KEY_CORD.cut.x - 34, KEY_CORD.cut.y - 31, 68);

// Seconds of timeline per walk frame.
const STEP = 0.06;

export function JourneyScene() {
  const ref = useRef<HTMLElement>(null);
  const { data: report, error } = useDemoReport();
  const { data: sales } = useLoad(() => atto.openSales(), []);
  const cords = report ? cordsFor(report) : [];
  const hasKey = cords.some((c) => c.kind === "clears" && c.object === "key");
  const hasNft = cords.some((c) => c.kind === "clears" && c.object === "nft");
  const sellerLeft = cords.some((c) => c.kind !== "clears");
  const total = cords.filter((c) => c.kind === "clears").length;
  const endsClean = report ? isDrawnClean(cordsFor(report, total)) : false;
  const listing = sales?.find((sale) => sale.token_id === report?.name);
  const payment = listing ? `${formatNear(listing.price)} NEAR` : "NEAR";

  useScene(ref, (scope) => {
    if (!report) return;
    const media = gsap.matchMedia();
    media.add("(min-width: 48rem) and (min-height: 40rem)", () => {
      const q = (s: string) => scope.querySelector<HTMLElement>(s);
      const all = (s: string) => Array.from(scope.querySelectorAll<HTMLElement>(s));
      const track = q(".journey-track")!;
      const stage = q(".journey-stage")!;
      const seller = q(".journey-seller")!;
      const buyer = q(".journey-buyer")!;
      const W = () => stage.clientWidth;
      scope.classList.add("journey-motion");

      // Walk frames advance only while someone is moving.
      const walking = (t: number) => t < 1 || (t > 5 && t < 5.6);
      const tl = gsap.timeline({
        scrollTrigger: { trigger: scope, start: "top top", end: "+=520%", pin: true, pinType: "transform", scrub: SCRUB, invalidateOnRefresh: true },
        defaults: { ease: EASE.scrub },
        onUpdate: () => {
          const t = tl.time();
          const frame = walking(t) ? String(Math.floor(t / STEP) % 2) : "0";
          seller.dataset.frame = frame;
          buyer.dataset.frame = frame;
          const stop = Math.min(5, Math.floor(t));
          all(".journey-stop").forEach((el, i) => el.toggleAttribute("data-current", i === stop));
        },
      });

      const stopEls = all(".journey-stop");
      tl.set(track, { x: 0 }, 0);
      stopEls.slice(1).forEach((el, i) => tl.to(track, { x: () => -el.offsetLeft, duration: 0.8 }, i + 0.6));
      tl
        .fromTo(q(".journey-path-progress"), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 6 }, 0)
        // Review: both walk in; the name sits with the seller.
        .fromTo(seller, { x: () => -W() * 0.2 }, { x: 0, duration: 1 }, 0)
        .fromTo(buyer, { x: () => W() * 0.25 }, { x: 0, duration: 1 }, 0)
        .from(q(".journey-bundle"), { autoAlpha: 0, y: 30, duration: 0.4 }, 0.3)
        // Pay: the vault rises, the coin arcs from the buyer into it.
        .from(q(".journey-vault"), { autoAlpha: 0, y: 60, scale: 0.8, duration: 0.4 }, 1)
        .fromTo(q(".journey-coin"), { autoAlpha: 0, x: () => W() * 0.36, y: 0 }, { autoAlpha: 1, x: () => W() * 0.3, y: () => -W() * 0.06, duration: 0.2 }, 1.2)
        .to(q(".journey-coin"), { x: 0, y: 0, scale: 0.6, duration: 0.5 }, 1.4)
        .to(q(".journey-coin"), { autoAlpha: 0, duration: 0.1 }, 1.9)
        // Transfer: the name moves from the seller into escrow.
        .to(q(".journey-bundle"), { x: () => W() * 0.27, y: () => -W() * 0.02, scale: 0.86, duration: 0.8 }, 2.1)
        // Remove access: the scissors close and the clearable cords drop away.
        .from(q(".journey-scissors"), { autoAlpha: 0, x: 60, y: -40, rotate: 20, duration: 0.3 }, 3)
        .set(q(".journey-scissors-open"), { autoAlpha: 0 }, 3.4)
        .set(q(".journey-scissors-closed"), { autoAlpha: 1 }, 3.4)
        .to(all(".journey-cut-end"), { autoAlpha: 0, duration: 0.05 }, 3.4)
        .to(all(".journey-drop"), { y: 260, x: 40, rotate: 60, autoAlpha: 0, duration: 0.45, ease: "power2.in", stagger: 0.08 }, 3.42)
        .to(q(".journey-scissors"), { autoAlpha: 0, x: 80, duration: 0.25 }, 3.75)
        // Verify: the stamp lands; the glass clears when nothing is left for the seller.
        .from(q(".journey-stamp"), { autoAlpha: 0, y: -160, duration: 0.3, ease: "power2.in" }, 4.1)
        .to(q(".journey-stamp"), { y: -14, duration: 0.08, yoyo: true, repeat: 1 }, 4.4)
        .to(q(".journey-stamp"), { autoAlpha: 0, y: -120, duration: 0.25 }, 4.65)
        .to(q(".journey-tag-clean"), { autoAlpha: endsClean ? 1 : 0.45, duration: 0.3 }, 4.4)
        .fromTo(q(".journey-check"), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.2 }, 4.45)
        // Complete: the name goes to the buyer, the payment to the seller.
        .to(q(".journey-bundle"), { x: () => W() * 0.56, y: 0, scale: 1, duration: 0.6 }, 5)
        .fromTo(q(".journey-payout"), { autoAlpha: 0, x: () => W() * 0.3 }, { autoAlpha: 1, x: 0, duration: 0.6 }, 5)
        .set(q(".journey-buyer-walk"), { autoAlpha: 0 }, 5.55)
        .set(q(".journey-buyer-wave"), { autoAlpha: 1 }, 5.55)
        // The old key tries to get back in and bounces off.
        .fromTo(q(".journey-old-key"), { autoAlpha: 0, x: () => -W() * 0.25, y: -80, rotate: -30 }, { autoAlpha: 1, x: () => W() * 0.18, y: 0, rotate: 0, duration: 0.25, ease: "power2.in" }, 5.6)
        .to(q(".journey-old-key"), { x: () => W() * 0.04, y: -60, rotate: -70, autoAlpha: 0.0, duration: 0.3, ease: "power2.out" }, 5.85)
        .from(q(".journey-refusal"), { autoAlpha: 0, y: 16, duration: 0.15 }, 5.8)
        .to({}, { duration: 0.35 });

      return () => {
        scope.classList.remove("journey-motion");
      };
    });
    return () => media.revert();
  }, [report, endsClean]);

  return (
    <section ref={ref} className="scene scene-journey" aria-labelledby="journey-title" data-clean={endsClean || undefined}>
      <div className="journey-top"><h2 id="journey-title">How a sale works.</h2></div>
      {report ? <>
        <ol className="journey-track" aria-label="The six steps of a sale" tabIndex={0}>
          {stops.map((stop, index) => (
            <li className="journey-stop" key={stop.word} data-current={index === 0 || undefined}>
              <span className="journey-num">{String(index + 1).padStart(2, "0")}</span>
              <h3>{stop.word}</h3>
              <p className="journey-fact">{stop.fact}</p>
            </li>
          ))}
        </ol>

        <div className="journey-stage" aria-hidden="true">
          <svg className="journey-path" viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path d="M0 64 C180 64 180 12 360 32 S540 98 720 64 S900 12 1080 32 S1260 98 1440 64" />
            <path className="journey-path-progress" pathLength="100" strokeDasharray="100" d="M0 64 C180 64 180 12 360 32 S540 98 720 64 S900 12 1080 32 S1260 98 1440 64" />
          </svg>

          <span className="journey-person journey-seller" data-frame="0">
            <img src={PENCIL("seller-walk-a")} alt="" draggable={false} />
            <img src={PENCIL("seller-walk-b")} alt="" draggable={false} />
          </span>
          <span className="journey-person journey-buyer" data-frame="0">
            <span className="journey-buyer-walk">
              <img src={PENCIL("buyer-walk-a")} alt="" draggable={false} />
              <img src={PENCIL("buyer-walk-b")} alt="" draggable={false} />
            </span>
            <img className="journey-buyer-wave" src={PENCIL("buyer-wave")} alt="" draggable={false} />
          </span>

          <img className="journey-vault" src={GLASS("vault")} alt="" draggable={false} />
          <img className="journey-coin" src={GLASS("coin")} alt="" draggable={false} />
          <span className="journey-payout">
            <img src={GLASS("coin")} alt="" draggable={false} />
            <span>{payment}</span>
          </span>

          <div className="journey-bundle">
            <svg className="journey-cords" viewBox={`0 0 ${B.w} ${B.h}`}>
              {hasKey && <g className="journey-cord-set"><path className="journey-cord" d={KEY_CORD.near} /><path className="journey-cord journey-cut-end" d={KEY_CORD.far} /><Knot k={KEY_KNOTS[0]} /><Knot k={KEY_KNOTS[1]} className="journey-cut-end" /></g>}
              {hasNft && <g className="journey-cord-set"><path className="journey-cord" d={NFT_CORD.near} /><path className="journey-cord journey-cut-end" d={NFT_CORD.far} /><Knot k={NFT_KNOTS[0]} /><Knot k={NFT_KNOTS[1]} className="journey-cut-end" /></g>}
              {sellerLeft && <g className="journey-cord-set journey-cord-seller"><path className="journey-cord" d={SEAL_CORD.whole} /><Knot k={SEAL_KNOTS[0]} /><Knot k={SEAL_KNOTS[1]} /></g>}
            </svg>
            <span className="journey-tag glass-tag" style={box(TAG, B)}>
              <img src={GLASS("tag-cloudy")} alt="" draggable={false} />
              <img className="journey-tag-clean" src={GLASS("tag-clean")} alt="" draggable={false} />
              <span className="tag-name">{report.name}</span>
            </span>
            {hasKey && <img className="journey-obj journey-key journey-drop" style={box(KEY, B)} src={GLASS("key")} alt="" draggable={false} />}
            {hasNft && <img className="journey-obj journey-nft journey-drop" style={box(NFT, B)} src={GLASS("nft-frame")} alt="" draggable={false} />}
            {sellerLeft && <img className="journey-obj journey-seal" style={box(SEAL, B)} src={GLASS("seal")} alt="" draggable={false} />}
            <span className="journey-scissors" style={box(SCISSORS, B)}>
              <img className="journey-scissors-open" src={GLASS("scissors-open")} alt="" draggable={false} />
              <img className="journey-scissors-closed" src={GLASS("scissors-closed")} alt="" draggable={false} />
            </span>
            <img className="journey-stamp" src={GLASS("stamp")} alt="" draggable={false} />
            <span className="journey-check">Verified on chain</span>
          </div>

          <img className="journey-old-key" src={GLASS("key")} alt="" draggable={false} />
        </div>
        <p className="journey-refusal">{REFUSAL}</p>
      </> : <p className="journey-unavailable" role="status">{error ? "The example report could not load. Search a name to read its report." : report === null ? `No report is available for ${DEMO_NAME}. Search another name.` : "Loading the example report…"}</p>}
    </section>
  );
}
