// A seedling in a glass pot: the reserve that keeps a name renewed.
import { Art, Glass, Glow, Shine } from "./parts";

export function SeedlingArt({ p }: { p: string }) {
  return (
    <Art>
      <path d="M12 32 H20" className="c-tie" />
      <path d="M35 40 C35 33 34.5 28 35 21" className="c-core-line" />
      <Glow p={p} cx={35} cy={22} r={13} />
      <path d="M35 27 C29 27.5 22.5 24 21 15.5 C28.5 15 34 19 35 27 Z" className="c-leaf" />
      <path d="M35 24 C36.5 15 43 10.5 50.5 11.5 C49.5 19.5 43 24.5 35 24 Z" className="c-leaf" />
      <path d="M24.5 17.5 C28 21 31 23.5 34 26 M47.5 14 C43.5 17 40 20 36 23" className="c-vein" />
      <Glass p={p} d="M21 38 H49 A2 2 0 0 1 51 40 V42 A2 2 0 0 1 49 44 H48 L45.5 54 A2.5 2.5 0 0 1 43 56 H27 A2.5 2.5 0 0 1 24.5 54 L22 44 H21 A2 2 0 0 1 19 42 V40 A2 2 0 0 1 21 38 Z" />
      <Shine d="M24.5 46.5 L26 52" />
    </Art>
  );
}
