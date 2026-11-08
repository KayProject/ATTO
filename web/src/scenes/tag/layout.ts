// Shared geometry of the tag scene, in a 1000 x 600 box, used by both the poster and the 3D tag.
import type { Cord } from "./cords";

export const VIEW = { w: 1000, h: 600 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface TagBox {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** Centre of the eyelet hole the cords are gathered from. */
  eyelet: Point;
  eyeletR: number;
  /** Area the name is written in. */
  text: { x: number; y: number; w: number };
}

export interface CordPath {
  cord: Cord;
  /** Glowing bead inside the glass where the cord is fixed. */
  bead: Point;
  /** Cubic bezier from the tag edge to the object. */
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  /** Centre and size of the cast object at the far end. */
  end: Point;
  objectSize: number;
}

export interface TagLayout {
  tag: TagBox;
  cords: CordPath[];
}

/** Where along a cord it snaps when cut. */
export const SNAP_AT = 0.16;

export function layoutFor(cords: Cord[]): TagLayout {
  const lone = cords.length === 0;
  const w = 440;
  const h = 268;
  const x = lone ? (VIEW.w - w) / 2 : 70;
  const y = (VIEW.h - h) / 2;
  const tag: TagBox = {
    x,
    y,
    w,
    h,
    r: 58,
    eyelet: { x: x + 66, y: y + h / 2 },
    eyeletR: 22,
    text: { x: x + 118, y: y + h / 2, w: w - 170 },
  };

  const n = cords.length;
  const spread = n > 1 ? Math.min(124, 470 / (n - 1)) : 0;
  const objectSize = n > 5 ? Math.max(48, spread * 0.78) : 84;
  const anchorSpread = n > 1 ? Math.min(46, (h - 92) / (n - 1)) : 0;
  const endX = 712;

  const paths = cords.map((cord, i): CordPath => {
    const offset = i - (n - 1) / 2;
    const ay = y + h / 2 + offset * anchorSpread;
    const ey = VIEW.h / 2 + offset * spread;
    const p0 = { x: x + w - 6, y: ay };
    const p3 = { x: endX - objectSize * 0.46, y: ey };
    const reach = (p3.x - p0.x) * 0.48;
    const sag = 26 + Math.abs(offset) * 6;
    return {
      cord,
      bead: { x: x + w - 34, y: ay },
      p0,
      p1: { x: p0.x + reach, y: ay + sag },
      p2: { x: p3.x - reach, y: ey + sag },
      p3,
      end: { x: endX, y: ey },
      objectSize,
    };
  });
  return { tag, cords: paths };
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Splits a cubic bezier at t into its near and far halves. */
export function splitCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): [Point[], Point[]] {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}

export function cubicPath([p0, p1, p2, p3]: Point[]): string {
  const f = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  return `M${f(p0)} C${f(p1)} ${f(p2)} ${f(p3)}`;
}

/** Rounded rectangle with the eyelet cut out, as one even-odd SVG path. */
export function tagOutline(tag: TagBox): string {
  const { x, y, w, h, r, eyelet, eyeletR } = tag;
  const outer = `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  const hole = `M${eyelet.x - eyeletR} ${eyelet.y} a${eyeletR} ${eyeletR} 0 1 0 ${eyeletR * 2} 0 a${eyeletR} ${eyeletR} 0 1 0 ${-eyeletR * 2} 0 Z`;
  return `${outer} ${hole}`;
}

/** Font size that fits the name in the tag's text area, at roughly 0.56 em per character. */
export function nameSize(name: string, width: number): number {
  return Math.min(64, width / Math.max(name.length * 0.56, 1));
}

/** One short line telling what a cord means. */
export function cordNote(cord: Cord): string {
  if (cord.kind === "unread") return "Couldn't read";
  if (cord.kind === "seller") return "Needs the seller";
  return cord.cut ? "Cut" : "ATTO clears";
}

/** The word on the stamp. Only a tag drawn clean says Clean. */
export function stampWord(clean: boolean): string {
  return clean ? "Clean" : "Checked";
}
