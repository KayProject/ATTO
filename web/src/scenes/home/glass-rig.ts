// Places glass images in a scene box by their real holes and rings, so cords start and end on them.
import type { CSSProperties } from "react";
import type { GlassName } from "./assets";

export interface Point {
  x: number;
  y: number;
}

/** Width over height of each glass image. */
const ASPECT: Partial<Record<GlassName, number>> = {
  "tag-cloudy": 1400 / 711,
  key: 700 / 368,
  "nft-frame": 700 / 787,
  seal: 700 / 1042,
  "mode-switch": 700 / 355,
  "subaccount-tag": 700 / 416,
  coin: 700 / 769,
  "scissors-open": 700 / 638,
};

/** Where a cord ties on, as fractions of the image. */
export const TIE = {
  tagHoles: [
    { x: 0.912, y: 0.222 },
    { x: 0.912, y: 0.483 },
    { x: 0.912, y: 0.758 },
  ],
  tagEyelet: { x: 0.115, y: 0.502 },
  key: { x: 0.139, y: 0.541 },
  "nft-frame": { x: 0.478, y: 0.07 },
  seal: { x: 0.46, y: 0.04 },
  "subaccount-tag": { x: 0.107, y: 0.53 },
  "mode-switch": { x: 0.04, y: 0.5 },
} satisfies Record<string, Point | Point[]>;

export interface Layer {
  name: GlassName;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
}

export function layer(name: GlassName, x: number, y: number, w: number, rotate = 0): Layer {
  return { name, x, y, w, h: w / (ASPECT[name] ?? 1), rotate };
}

/** A point on a layer (fractions of its image), in box units, following its rotation about the centre. */
export function pin(l: Layer, at: Point): Point {
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const dx = (at.x - 0.5) * l.w;
  const dy = (at.y - 0.5) * l.h;
  const r = (l.rotate * Math.PI) / 180;
  return { x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) };
}

/** Places an unrotated image so its tie point lands on `target`. */
export function hang(name: GlassName, w: number, tie: Point, target: Point): Layer {
  const l = layer(name, 0, 0, w);
  return { ...l, x: target.x - tie.x * l.w, y: target.y - tie.y * l.h };
}

const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** A hanging cord from a to b, split at `at` into a near half and a far half that can fall away when cut. */
export function cord(a: Point, b: Point, sag: number, at = 0.55) {
  const mid = lerp(a, b, 0.5);
  const c = { x: mid.x, y: mid.y + sag };
  const q0 = lerp(a, c, at);
  const q1 = lerp(c, b, at);
  const cut = lerp(q0, q1, at);
  const f = (n: number) => n.toFixed(1);
  return {
    whole: `M${f(a.x)} ${f(a.y)} Q${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`,
    near: `M${f(a.x)} ${f(a.y)} Q${f(q0.x)} ${f(q0.y)} ${f(cut.x)} ${f(cut.y)}`,
    far: `M${f(cut.x)} ${f(cut.y)} Q${f(q1.x)} ${f(q1.y)} ${f(b.x)} ${f(b.y)}`,
    cut,
  };
}

/** CSS that puts a layer in a box of the given size. */
export function box(l: Layer, size: { w: number; h: number }): CSSProperties {
  return {
    position: "absolute",
    left: `${(l.x / size.w) * 100}%`,
    top: `${(l.y / size.h) * 100}%`,
    width: `${(l.w / size.w) * 100}%`,
    height: `${(l.h / size.h) * 100}%`,
    transform: l.rotate ? `rotate(${l.rotate}deg)` : undefined,
  };
}

/** The tie point of an object image, if it has one. */
export function tieOf(name: GlassName): Point | undefined {
  const t = (TIE as Record<string, Point | Point[]>)[name];
  return t && !Array.isArray(t) ? t : undefined;
}

/**
 * A cord tied through a hole or ring: a loop that passes through the hole, a knot just outside it,
 * and a short loose tail. `toward` is the next point along the cord; `r` is the hole's radius and
 * `rim` the outer radius of the ring around it, so the knot sits just outside the ring.
 */
export function knot(end: Point, toward: Point, r: number, pad = 5, rim = r) {
  const len = Math.hypot(toward.x - end.x, toward.y - end.y) || 1;
  const u = { x: (toward.x - end.x) / len, y: (toward.y - end.y) / len };
  const n = { x: -u.y, y: u.x };
  const bead = { x: end.x + u.x * (rim + pad), y: end.y + u.y * (rim + pad) };
  const side = (s: number) => ({ x: end.x + n.x * r * 0.9 * s + u.x * rim * 0.55, y: end.y + n.y * r * 0.9 * s + u.y * rim * 0.55 });
  const a = side(1);
  const b = side(-1);
  const c = Math.cos(0.65);
  const s = Math.sin(0.65);
  const tailDir = { x: u.x * c - u.y * s, y: u.x * s + u.y * c };
  const tailEnd = { x: bead.x + tailDir.x * (r * 0.9 + pad * 1.2), y: bead.y + tailDir.y * (r * 0.9 + pad * 1.2) };
  const f = (v: number) => v.toFixed(1);
  return {
    loop: `M${f(bead.x)} ${f(bead.y)} Q${f(a.x)} ${f(a.y)} ${f(end.x)} ${f(end.y)} Q${f(b.x)} ${f(b.y)} ${f(bead.x)} ${f(bead.y)}`,
    tail: `M${f(bead.x)} ${f(bead.y)} L${f(tailEnd.x)} ${f(tailEnd.y)}`,
    bead,
  };
}
