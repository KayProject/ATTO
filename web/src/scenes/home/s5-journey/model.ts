import type { Cord } from "@/scenes/tag/cords";

// Only clearable cords advance through the sale's cutting stage.
export function journeyState(progress: number, cords: Cord[]) {
  const position = Math.max(0, Math.min(1, progress)) * 5.8;
  const count = cords.filter((cord) => cord.kind === "clears").length;
  return {
    cleared: Math.floor(Math.max(0, Math.min(1, (position - 2.8) / 0.9)) * count),
    stamped: position >= 4,
    stop: Math.min(5, Math.floor(position)),
  };
}
