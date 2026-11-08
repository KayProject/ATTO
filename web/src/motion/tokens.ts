// Shared motion values, so every scene moves with the same voice.
export const EASE = {
  enter: "power3.out",
  exit: "power2.in",
  scrub: "none",
  settle: "back.out(1.4)",
} as const;

export const DURATION = {
  tap: 0.16,
  quick: 0.26,
  enter: 0.7,
  reveal: 1.1,
  preloader: 1.2,
} as const;

/** How long a scroll scrub lags behind the scrollbar, in seconds. */
export const SCRUB = 0.6;

export const REDUCED = "(prefers-reduced-motion: reduce)";
export const FULL = "(prefers-reduced-motion: no-preference)";
