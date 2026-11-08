// A small glass tag with a smaller child tag hanging from it.
import { Art, Glass, Glow, Shine } from "./parts";

export function SubaccountArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H15" className="c-tie" />
      <path d="M40 38 C42 41 43 42 44.5 44" className="c-tie" />
      <Glass
        p={p}
        rule="evenodd"
        d="M21 16 H44 A5 5 0 0 1 49 21 V33 A5 5 0 0 1 44 38 H21 A6 6 0 0 1 15 32 V22 A6 6 0 0 1 21 16 Z M22 24 A3 3 0 1 0 22 30 A3 3 0 1 0 22 24 Z"
      />
      <path d="M29 24.5 H43 M29 29.5 H38" className="c-ink-line" />
      <Glass
        p={p}
        rule="evenodd"
        d="M43 41.5 H54 A3.5 3.5 0 0 1 57.5 45 V50 A3.5 3.5 0 0 1 54 53.5 H43 A4 4 0 0 1 39 49.5 V45.5 A4 4 0 0 1 43 41.5 Z M44 45.6 A1.9 1.9 0 1 0 44 49.4 A1.9 1.9 0 1 0 44 45.6 Z"
      />
      <Glow p={p} cx={52} cy={47.5} r={5} />
      <circle cx={52} cy={47.5} r={1.8} className="c-core" />
      <Shine d="M18 21.5 A4 4 0 0 1 21.5 18.6 H32" />
    </Art>
  );
}
