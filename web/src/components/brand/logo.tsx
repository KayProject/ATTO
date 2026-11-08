// The atto. wordmark: monoline letters, one cut bar through the t's, a Coral dot.
import type { SVGProps } from "react";

export const LOGO_PATHS = {
  a: "M203 180A75 75 0 1 1 53 180A75 75 0 1 1 203 180V280",
  t1: "M275 55V222A33 33 0 0 0 308 255H320",
  t2: "M365 55V222A33 33 0 0 0 398 255H410",
  o: "M530 105A75 75 0 1 1 530 255A75 75 0 1 1 530 105Z",
  cut: "M218 180H458",
} as const;

export function Logo({ title = "atto.", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 760 312" fill="none" role="img" aria-label={title} {...props}>
      <defs>
        <clipPath id="logo-a-terminal" clipPathUnits="userSpaceOnUse">
          <path d="M0 0H760V312H178V180H154V312H0Z" />
        </clipPath>
      </defs>
      <g stroke="currentColor" strokeWidth="50" strokeLinecap="butt" strokeLinejoin="round">
        <path data-stroke="a" pathLength={1} clipPath="url(#logo-a-terminal)" d={LOGO_PATHS.a} />
        <path data-stroke="t1" pathLength={1} d={LOGO_PATHS.t1} />
        <path data-stroke="t2" pathLength={1} d={LOGO_PATHS.t2} />
        <path data-stroke="o" pathLength={1} d={LOGO_PATHS.o} />
        <path data-stroke="cut" pathLength={1} d={LOGO_PATHS.cut} />
      </g>
      <circle data-dot cx="704" cy="255" r="25" fill="var(--highlight)" />
    </svg>
  );
}
