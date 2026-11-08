// A glass escrow vault with a round door and a glowing dial.
import { Art, Glass, Glow, Shine } from "./parts";

export function VaultArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H14" className="c-tie" />
      <path d="M20 52 V56 M48 52 V56" className="c-ink-line" />
      <Glass p={p} d="M22 11 H48 A8 8 0 0 1 56 19 V45 A8 8 0 0 1 48 53 H22 A8 8 0 0 1 14 45 V19 A8 8 0 0 1 22 11 Z" />
      <circle cx={35} cy={32} r={13.5} className="c-pane" />
      <circle cx={35} cy={32} r={13.5} className="c-rim-line" />
      <Glow p={p} cx={35} cy={32} r={10} />
      <path d="M35 22.5 V41.5 M26.8 27.2 L43.2 36.8 M26.8 36.8 L43.2 27.2" className="c-core-line" />
      <circle cx={35} cy={32} r={3.4} className="c-core" />
      <path d="M51 26 V38" className="c-ink-line" />
      <Shine d="M17.4 24 V19.6 A4.6 4.6 0 0 1 22 15 H32" />
    </Art>
  );
}
