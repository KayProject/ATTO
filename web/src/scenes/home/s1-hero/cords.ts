// Live glass cords for the hero: each runs from a hole in the tag to an object, sways, and can be cut.

export interface Point {
  x: number;
  y: number;
}

export interface CordSpec {
  id: string;
  kind: "clears" | "seller";
  from: Point;
  to: Point;
  /** How far the cord hangs below a straight line, in scene units. */
  sag: number;
  /** Where along the cord the scissors cut, 0 to 1. */
  cutAt: number;
}

export interface CordState {
  /** Seconds of idle sway. */
  t: number;
  /** 0 intact, 1 fully separated. */
  cut: number;
  /** Extra offset applied to the far end as the object falls. */
  fall: Point;
}

function lerp(a: Point, b: Point, k: number): Point {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// Quadratic curve point.
function q(a: Point, c: Point, b: Point, k: number): Point {
  return lerp(lerp(a, c, k), lerp(c, b, k), k);
}

/** The two halves of a cord as SVG path data, given its live state. */
export function cordPaths(spec: CordSpec, state: CordState, phase: number): { near: string; far: string } {
  const to = { x: spec.to.x + state.fall.x, y: spec.to.y + state.fall.y };
  const sway = Math.sin(state.t * 1.3 + phase) * 6;
  const mid = lerp(spec.from, to, 0.5);
  const control = { x: mid.x + sway, y: mid.y + spec.sag + Math.cos(state.t * 0.9 + phase) * 4 };
  if (state.cut <= 0) {
    return { near: `M${spec.from.x} ${spec.from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`, far: "" };
  }
  // After the cut each half curls back toward its own end.
  const k = spec.cutAt;
  const split = q(spec.from, control, to, k);
  const recoil = 1 - Math.min(1, state.cut) * 0.55;
  const nearEnd = lerp(spec.from, split, recoil);
  const nearCtrl = lerp(spec.from, { x: control.x, y: control.y + 40 * state.cut }, k * recoil);
  const farStart = lerp(to, split, recoil);
  const farCtrl = lerp(to, { x: control.x, y: control.y + 60 * state.cut }, (1 - k) * recoil);
  return {
    near: `M${spec.from.x} ${spec.from.y} Q${nearCtrl.x} ${nearCtrl.y} ${nearEnd.x} ${nearEnd.y}`,
    far: `M${farStart.x} ${farStart.y} Q${farCtrl.x} ${farCtrl.y} ${to.x} ${to.y}`,
  };
}

/** The point where a cord is cut, for the flash. */
export function cutPoint(spec: CordSpec): Point {
  const mid = lerp(spec.from, spec.to, 0.5);
  return q(spec.from, { x: mid.x, y: mid.y + spec.sag }, spec.to, spec.cutAt);
}
