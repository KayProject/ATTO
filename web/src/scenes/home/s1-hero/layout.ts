// Positions for the hero's glass scene, in a 1000 x 860 box shared by the images and the cord SVG.
import type { CordSpec } from "./cords";

export const BOX = { w: 1000, h: 860 };

export interface Placed {
  x: number;
  y: number;
  w: number;
  /** Height in box units; used for people and puppet parts so their canvases line up. */
  h?: number;
  rotate?: number;
}

export const TAG: Placed & { cx: number; cy: number } = { cx: 470, cy: 430, x: 190, y: 294, w: 560, rotate: -14 };

export const OBJECTS = {
  key: { x: 838, y: 96, w: 200 },
  frame: { x: 852, y: 292, w: 140 },
  seal: { x: 880, y: 470, w: 112 },
} satisfies Record<string, Placed>;

export const PEOPLE = {
  woman: { x: 32, y: 404, w: 267, h: 400 },
  womanArm: { x: 182, y: 341, w: 120, h: 180 },
  man: { x: 588, y: 478, w: 200, h: 300 },
  manArms: { x: 659, y: 443, w: 160, h: 240 },
} satisfies Record<string, Placed>;

export const CORDS: CordSpec[] = [
  { id: "key", kind: "clears", from: { x: 270, y: 482 }, to: { x: 858, y: 152 }, sag: -320, cutAt: 0.16 },
  { id: "frame", kind: "clears", from: { x: 691, y: 373 }, to: { x: 922, y: 298 }, sag: 46, cutAt: 0.45 },
  { id: "seal", kind: "seller", from: { x: 708, y: 441 }, to: { x: 897, y: 518 }, sag: 96, cutAt: 0.5 },
];

export const CARDS = {
  keys: { x: 560, y: 0 },
  nfts: { x: 800, y: 640 },
  seller: { x: 300, y: 650 },
} satisfies Record<string, { x: number; y: number }>;

/** A box-unit rectangle as CSS percentages. */
export function pct(p: Placed) {
  return {
    left: `${(p.x / BOX.w) * 100}%`,
    top: `${(p.y / BOX.h) * 100}%`,
    width: `${(p.w / BOX.w) * 100}%`,
    ...(p.h ? { height: `${(p.h / BOX.h) * 100}%` } : {}),
  };
}
