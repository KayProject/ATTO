// A glass message card carrying a glowing signature: signed-messages mode.
import { Art, Glass, Glow, Shine } from "./parts";

export function ModeArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H15" className="c-tie" />
      <Glass p={p} d="M21 14 H49 A6 6 0 0 1 55 20 V40 A6 6 0 0 1 49 46 H30 L22 53 V46 H21 A6 6 0 0 1 15 40 V20 A6 6 0 0 1 21 14 Z" />
      <Glow p={p} cx={35} cy={30} r={12} />
      <path d="M21.5 33 C24 25 27 24 27.5 28.5 C28 33 30.5 33 32.5 27 C34 23 35.5 26 35.5 30 C35.5 33 38 33 40 29.5 C41.5 27 43.5 27.5 47 31" className="c-core-line" />
      <path d="M22 38.5 H48" className="c-ink-line" />
      <Shine d="M18.4 24 V20 A3 3 0 0 1 21.4 17 H31" />
    </Art>
  );
}
