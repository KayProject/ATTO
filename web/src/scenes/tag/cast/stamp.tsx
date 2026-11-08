// A glass rubber stamp above the glowing line it leaves.
import { Art, Glass, Glow, Shine } from "./parts";

export function StampArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H16" className="c-tie" />
      <Glow p={p} cx={34} cy={53} r={9} />
      <path d="M20 53 H48" className="c-core-line c-core-thick" />
      <Glass p={p} d="M34 7.5 A7 7 0 0 1 37.5 20.6 V27 H45 A5 5 0 0 1 50 32 V37 H18 V32 A5 5 0 0 1 23 27 H30.5 V20.6 A7 7 0 0 1 34 7.5 Z" />
      <Glass p={p} d="M15 37 H53 A2 2 0 0 1 55 39 V43 A2 2 0 0 1 53 45 H15 A2 2 0 0 1 13 43 V39 A2 2 0 0 1 15 37 Z" />
      <Shine d="M30 11.4 A4.6 4.6 0 0 1 34 10" />
      <Shine d="M21.5 30.5 H30" />
    </Art>
  );
}
