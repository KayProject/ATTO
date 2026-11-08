// Home scene: the atto. logo writes itself, the cut draws through the t's, the dot drops, then the dot opens onto the page.
"use client";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { gsap } from "@/motion/gsap";
import { useScene } from "@/motion/use-scene";
import { markPreloaderDone, resetPreloader } from "./signal";

const SEEN_KEY = "atto-preloaded";
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
    const q = (s: string) => scope.querySelector<SVGElement>(s)!;
    const letters = ["a", "t1", "t2", "o"].map((id) => q(`[data-stroke="${id}"]`));
    const cut = q('[data-stroke="cut"]');
    const dot = q("[data-dot]");
    gsap.set([...letters, cut], { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(dot, { y: -220, scale: 0.6, transformOrigin: "50% 50%", autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        scope.dataset.done = "";
        rememberSeen();
      },
    });
    tl.to(letters, { strokeDashoffset: 0, duration: 0.42, ease: "power2.inOut", stagger: 0.16 })
      .to(cut, { strokeDashoffset: 0, duration: 0.38, ease: "power3.inOut" }, "+=0.05")
      .to(dot, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "bounce.out" }, "-=0.05")
      .add(markPreloaderDone, "+=0.15")
      .to(scope.querySelector(".preloader-logo"), { autoAlpha: 0, duration: 0.18 }, "<")
      .fromTo(
        scope.querySelector(".preloader-burst"),
        { scale: 0, autoAlpha: 1 },
        { scale: 1, duration: 0.55, ease: "power3.in" },
        "<",
      )
      .to(scope, { autoAlpha: 0, duration: 0.35, ease: "power1.out" });
    return () => {
      tl.kill();
    };
  }, [onClient]);

  // Before hydration a plain cover holds the page; after, the veil sits on the body so nothing can offset it.
  if (!onClient) return <div className="preloader-cover" aria-hidden="true" />;

  return createPortal(
    <div ref={ref} className="scene-preloader" aria-hidden="true">
      <Logo className="preloader-logo" title="" />
      <span className="preloader-burst" />
    </div>,
    document.body,
  );
}
