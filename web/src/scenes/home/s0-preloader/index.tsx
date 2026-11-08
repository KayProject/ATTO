// Home scene, on every load: the atto. logo writes itself, the cut draws through the t's, the dot drops, then the dot opens onto the page.
"use client";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { gsap } from "@/motion/gsap";
import { useScene } from "@/motion/use-scene";
import { markPreloaderDone, resetPreloader } from "./signal";

const noSubscribe = () => () => {};

export function PreloaderScene() {
  const ref = useRef<HTMLDivElement>(null);
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);

  useScene(ref, (scope) => {
    resetPreloader();
    const q = (s: string) => scope.querySelector<SVGElement>(s)!;
    const letters = ["a", "t1", "t2", "o"].map((id) => q(`[data-stroke="${id}"]`));
    const cut = q('[data-stroke="cut"]');
    const dot = q("[data-dot]");
    // Dash each stroke by its real length so it draws as a line from start to end.
    [...letters, cut].forEach((path) => {
      const length = (path as SVGPathElement).getTotalLength();
      path.removeAttribute("pathLength");
      path.setAttribute("stroke-dasharray", `${length} ${length}`);
      path.setAttribute("stroke-dashoffset", `${length}`);
      path.style.visibility = "hidden";
    });
    gsap.set(dot, { y: -220, scale: 0.6, transformOrigin: "50% 50%", autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        scope.dataset.done = "";
      },
    });
    letters.forEach((letter, i) => {
      tl.set(letter, { visibility: "visible" }, i * 0.42).to(
        letter,
        { attr: { "stroke-dashoffset": 0 }, duration: 0.55, ease: "power1.inOut" },
        i * 0.42,
      );
    });
    tl.set(cut, { visibility: "visible" }, ">+0.08")
      .to(cut, { attr: { "stroke-dashoffset": 0 }, duration: 0.45, ease: "power2.inOut" }, "<")
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
