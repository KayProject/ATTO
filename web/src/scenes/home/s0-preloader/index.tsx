// Home scene: the ATTO mark draws itself, then zooms through the camera to open onto the hero.
"use client";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { gsap } from "@/motion/gsap";
import { DURATION } from "@/motion/tokens";
import { useScene } from "@/motion/use-scene";
import { markPreloaderDone, resetPreloader } from "./signal";

const SEEN_KEY = "atto-preloaded";

// The mark: a name tag with its punched hole, centred in a 1000 x 1000 box.
const TAG = "M440 466 L466 438 H552 a12 12 0 0 1 12 12 V550 a12 12 0 0 1 -12 12 H466 L440 534 Z";
const HOLE = { cx: 470, cy: 500, r: 9 };
const CORD = "M461 500 C 440 500, 425 520, 404 512";

const noSubscribe = () => () => {};

function seenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the preloader simply plays again next time.
  }
}

export function PreloaderScene() {
  const ref = useRef<HTMLDivElement>(null);
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);

  useScene(ref, (scope) => {
    if (seenThisSession()) {
      scope.dataset.done = "";
      markPreloaderDone();
      return;
    }
    resetPreloader();
    const zoom = scope.querySelectorAll(".preloader-zoom");
    const strokes = scope.querySelectorAll(".preloader-stroke");
    const tl = gsap.timeline({
      onComplete: () => {
        scope.dataset.done = "";
        rememberSeen();
      },
    });
    tl.fromTo(strokes, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut", stagger: 0.08 })
      .set(scope.querySelector(".preloader-window"), { attr: { opacity: 1 } }, ">")
      .add(markPreloaderDone, "<")
      .to(zoom, { scale: 34, svgOrigin: "500 500", duration: DURATION.preloader - 0.62, ease: "power3.in" }, "<")
      .to(scope, { autoAlpha: 0, duration: 0.12, ease: "none" }, "-=0.12");
    return () => {
      tl.kill();
    };
  }, [onClient]);

  // Before hydration a plain cover holds the page; after, the veil sits on the body so nothing can offset it.
  if (!onClient) return <div className="preloader-cover" aria-hidden="true" />;

  return createPortal(
    <div ref={ref} className="scene-preloader" aria-hidden="true">
      <svg className="preloader-veil" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="atto-preloader-mask" maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="40000" height="40000">
            <rect x="-20000" y="-20000" width="40000" height="40000" fill="white" />
            <g className="preloader-zoom preloader-window" opacity="0">
              <path d={TAG} fill="black" />
              <circle {...HOLE} fill="white" />
            </g>
          </mask>
        </defs>
        <rect className="preloader-ground" x="-20000" y="-20000" width="40000" height="40000" mask="url(#atto-preloader-mask)" />
        <g className="preloader-zoom">
          <path className="preloader-stroke" d={TAG} pathLength={1} />
          <circle className="preloader-stroke" {...HOLE} pathLength={1} />
          <path className="preloader-stroke" d={CORD} pathLength={1} />
        </g>
      </svg>
    </div>,
    document.body,
  );
}
