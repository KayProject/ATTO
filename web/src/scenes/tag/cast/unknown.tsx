// A fogged glass disc with a dashed edge: something ATTO couldn't read.
import { Art, Glow } from "./parts";

export function UnknownArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H16" className="c-tie c-tie-dashed" />
      <circle cx={35} cy={32} r={19} fill={`url(#${p}-f)`} className="c-frost c-fog" />
      <circle cx={35} cy={32} r={19} className="c-edge c-edge-dashed" />
      <Glow p={p} cx={35} cy={32} r={12} />
      <circle cx={28} cy={32} r={2.4} className="c-ink-dot" />
      <circle cx={35} cy={32} r={2.4} className="c-ink-dot" />
      <circle cx={42} cy={32} r={2.4} className="c-ink-dot" />
    </Art>
  );
}
