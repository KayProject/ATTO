// A glass picture frame holding a small frosted landscape.
import { Art, Glass, Glow, Shine } from "./parts";

export function NftArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H15" className="c-tie" />
      <path d="M21 19 H48 V46 H21 Z" className="c-pane" />
      <path d="M21 46 L30 34.5 L36 41 L40.5 36 L48 46 Z" className="c-ink-soft" />
      <Glow p={p} cx={41} cy={26} r={7} />
      <circle cx={41} cy={26} r={3.4} className="c-core" />
      <Glass
        p={p}
        rule="evenodd"
        d="M21 12 H48 A6 6 0 0 1 54 18 V47 A6 6 0 0 1 48 53 H21 A6 6 0 0 1 15 47 V18 A6 6 0 0 1 21 12 Z M21 19 V46 H48 V19 Z"
      />
      <Shine d="M18.6 22 V18.5 A3 3 0 0 1 21.6 15.5 H30" />
    </Art>
  );
}
