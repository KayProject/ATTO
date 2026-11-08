// A glass DAO seal: scalloped disc, inner ring and three council marks.
import { Art, Glass, Glow, Shine } from "./parts";

function scallop(cx: number, cy: number, r: number, bumps: number, depth: number): string {
  const pts: string[] = [];
  const steps = bumps * 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r - depth * (0.5 - 0.5 * Math.cos(a * bumps));
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const DISC = scallop(35, 32, 20, 14, 2.4);

export function SealArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H15.5" className="c-tie" />
      <Glass p={p} d={DISC} />
      <circle cx={35} cy={32} r={12.5} className="c-rim-line" />
      <Glow p={p} cx={35} cy={32} r={11} />
      <circle cx={35} cy={27} r={2.3} className="c-core" />
      <circle cx={30.6} cy={35} r={2.3} className="c-core" />
      <circle cx={39.4} cy={35} r={2.3} className="c-core" />
      <Shine d="M22.5 25 A14 14 0 0 1 30 17.6" />
    </Art>
  );
}
