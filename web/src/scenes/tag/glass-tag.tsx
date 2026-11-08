// Public interface of the glass name tag. Every scene and screen uses only this component.
"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Cord } from "./cords";
import { TagPoster } from "./tag-poster";
import { canDraw3D } from "./capability";
import { useReducedMotion } from "@/motion/use-reduced-motion";

export interface GlassTagProps {
  name: string;
  cords: Cord[];
  /** "hero" is large with idle motion; "inline" is small and still until its scene animates it. */
  size?: "hero" | "panel" | "inline";
  /** Stamp shown on the tag once a sale is verified. */
  stamped?: boolean;
  className?: string;
  /** Keeps the still poster even where the 3D tag could run. */
  still?: boolean;
}

const TagCanvas = dynamic(() => import("./three/tag-canvas"), { ssr: false, loading: () => null });

/** Waits for the browser to be idle after first paint. */
function afterPaint(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let idle = 0;
  const frame = requestAnimationFrame(() => {
    idle = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1200 }) : window.setTimeout(run, 200);
  });
  return () => {
    cancelAnimationFrame(frame);
    if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
}

export function GlassTag({ still = false, ...props }: GlassTagProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [wanted, setWanted] = useState(false);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const allowed = !still && !reduced;

  useEffect(() => {
    if (!allowed) return;
    return afterPaint(() => {
      if (!canDraw3D()) return;
      setHost(anchor.current?.closest("figure") ?? null);
      setWanted(true);
    });
  }, [allowed]);

  useEffect(() => {
    if (!host) return;
    const loadAhead = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px 0px" });
    const inView = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "80px 0px" });
    loadAhead.observe(host);
    inView.observe(host);
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      loadAhead.disconnect();
      inView.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [host]);

  const draw = allowed && wanted && near ? host : null;
  const live = Boolean(draw && ready);

  return (
    <TagPoster
      {...props}
      live={live}
      underlay={
        <>
          <span ref={anchor} hidden />
          {draw && (
            <TagCanvas
              name={props.name}
              cords={props.cords}
              size={props.size ?? "panel"}
              stamped={props.stamped ?? false}
              active={onScreen && visible}
              host={draw}
              onReady={() => setReady(true)}
            />
          )}
        </>
      }
    />
  );
}
