// A glass key: round bow with a glowing ring, shaft and teeth.
import { Art, Glass, Glow, Shine } from "./parts";

export function KeyArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H14" className="c-tie" />
      <Glass
        p={p}
        rule="evenodd"
        d="M24 20.5 A11.5 11.5 0 0 1 34.9 28.6 H54 A3.4 3.4 0 0 1 57.4 32 A3.4 3.4 0 0 1 54 35.4 H53 V41.5 A1.5 1.5 0 0 1 51.5 43 H49 A1.5 1.5 0 0 1 47.5 41.5 V35.4 H45 V39 A1.5 1.5 0 0 1 43.5 40.5 H41.5 A1.5 1.5 0 0 1 40 39 V35.4 H34.9 A11.5 11.5 0 1 1 24 20.5 Z M24 27 A5 5 0 1 0 24 37 A5 5 0 1 0 24 27 Z"
      />
      <Glow p={p} cx={24} cy={32} r={9} />
      <circle cx={24} cy={32} r={6.6} className="c-core-line" />
      <Shine d="M16.5 26 A9 9 0 0 1 22 22.2" />
      <Shine d="M38 30.4 H51" />
    </Art>
  );
}
