// Shared glass materials and pieces for every cast object, drawn in a 64 x 64 box.
import type { ReactNode } from "react";

/** Gradients and filters each cast drawing references, prefixed so several can sit on one page. */
export function CastDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="c-stop-hi" />
        <stop offset="0.5" className="c-stop-mid" />
        <stop offset="1" className="c-stop-lo" />
      </linearGradient>
      <radialGradient id={`${p}-f`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" className="c-stop-frost" />
        <stop offset="1" className="c-stop-clear" />
      </radialGradient>
      <radialGradient id={`${p}-k`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" className="c-stop-core" />
        <stop offset="1" className="c-stop-core-out" />
      </radialGradient>
      <filter id={`${p}-s`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <filter id={`${p}-b`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
  );
}

/** A glass shape: frosted fill, glass gradient on top, an edge line and a bright inner rim. */
export function Glass({ p, d, rule }: { p: string; d: string; rule?: "evenodd" }) {
  return (
    <g>
      <path d={d} fill={`url(#${p}-f)`} fillRule={rule} className="c-frost" />
      <path d={d} fill={`url(#${p}-g)`} fillRule={rule} className="c-body" />
      <path d={d} fillRule={rule} className="c-edge" />
    </g>
  );
}

/** Short bright streak where light catches the glass. */
export function Shine({ d }: { d: string }) {
  return <path d={d} className="c-shine" />;
}

/** Soft glow behind a glowing inner part. */
export function Glow({ p, cx, cy, r }: { p: string; cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={`url(#${p}-k)`} className="c-glow" />;
}

/** Shadow under the object. */
export function Shadow({ p, cx = 34, w = 22 }: { p: string; cx?: number; w?: number }) {
  return <ellipse cx={cx} cy={58} rx={w} ry={3.2} className="c-shadow" filter={`url(#${p}-s)`} />;
}

/** The ring a cord ties onto; open when the cord has been cut. */
export function Loop({ cut }: { cut: boolean }) {
  return cut ? (
    <path d="M9.5 28.2 A4.2 4.2 0 1 0 10.6 35.6" className="c-loop c-loop-open" />
  ) : (
    <circle cx={7.8} cy={32} r={4.2} className="c-loop" />
  );
}

export function Art({ children }: { children: ReactNode }) {
  return <g className="c-art">{children}</g>;
}
