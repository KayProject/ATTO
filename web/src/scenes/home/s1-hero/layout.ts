// Positions for the hero's glass scene, in a 1000 x 860 box shared by the images and the cord SVG.
import { layer as glassLayer, pin, TIE } from "../glass-rig";
import { through, type CordSpec, type Point } from "./cords";

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

// Every pencil layer is drawn on a 667 x 1000 canvas. A part is placed so a joint in its own
// pixels lands on the matching joint of the body it belongs to.
const CANVAS = { w: 667, h: 1000 };
function body(x: number, y: number, w: number): Placed {
  return { x, y, w, h: (w / CANVAS.w) * CANVAS.h };
}
function attach(to: Placed, toJoint: Point, w: number, ownJoint: Point): Placed {
  const sTo = to.w / CANVAS.w;
  const s = w / CANVAS.w;
  return { x: to.x + toJoint.x * sTo - ownJoint.x * s, y: to.y + toJoint.y * sTo - ownJoint.y * s, w, h: CANVAS.h * s };
}
/** A pixel of a placed layer, in box units. */
function at(p: Placed, px: Point): Point {
  const s = p.w / CANVAS.w;
  return { x: p.x + px.x * s, y: p.y + px.y * s };
}

// Joints and hands, in layer pixels.
export const JOINT = {
  womanShoulder: { x: 372, y: 262 },
  armShoulder: { x: 40, y: 895 },
  blades: { x: 555, y: 170 },
  manNearShoulder: { x: 233, y: 410 },
  manFarShoulder: { x: 300, y: 390 },
  nearArmShoulder: { x: 100, y: 710 },
  nearFist: { x: 565, y: 470 },
  farArmShoulder: { x: 75, y: 530 },
  farFist: { x: 550, y: 290 },
};

const woman = body(32, 404, 267);
const man = body(588, 478, 200);
const womanArm = attach(woman, JOINT.womanShoulder, 120, JOINT.armShoulder);
const manArmNear = attach(man, JOINT.manNearShoulder, 160, JOINT.nearArmShoulder);
const manArmFar = attach(man, JOINT.manFarShoulder, 160, JOINT.farArmShoulder);

export const PEOPLE = { woman, womanArm, man, manArmNear, manArmFar } satisfies Record<string, Placed>;

/** Rotation origin of a part, as CSS percentages of its own canvas. */
export const origin = (joint: Point) => `${(joint.x / CANVAS.w) * 100}% ${(joint.y / CANVAS.h) * 100}%`;

// Cord ends sit in the tag's real holes and on the objects' real rings (measured on the glass images).
// The tag box has the clear tag's proportions; the cloudy image sits centred inside it at its own width.
const TAG_BOX_H = (TAG.w * 681) / 1400;
const CLOUDY_W = (TAG_BOX_H * 1400) / 711;
export const TAG_LAYER = glassLayer("tag-cloudy", TAG.x + (TAG.w - CLOUDY_W) / 2, TAG.y, CLOUDY_W, TAG.rotate);
export const OBJECT_LAYER = {
  key: glassLayer("key", OBJECTS.key.x, OBJECTS.key.y, OBJECTS.key.w),
  frame: glassLayer("nft-frame", OBJECTS.frame.x, OBJECTS.frame.y, OBJECTS.frame.w),
  seal: glassLayer("seal", OBJECTS.seal.x, OBJECTS.seal.y, OBJECTS.seal.w),
};
const keyFrom = pin(TAG_LAYER, TIE.tagEyelet);
const keyTo = pin(OBJECT_LAYER.key, TIE.key);
const frameFrom = pin(TAG_LAYER, TIE.tagHoles[1]);
const frameTo = pin(OBJECT_LAYER.frame, TIE["nft-frame"]);
const sealFrom = pin(TAG_LAYER, TIE.tagHoles[2]);
const sealTo = pin(OBJECT_LAYER.seal, TIE.seal);

// The key cord runs between the open blades; the seal cord runs through both of the man's fists.
const nearFist = at(manArmNear, JOINT.nearFist);
const farFist = at(manArmFar, JOINT.farFist);
const grip = { x: (nearFist.x + farFist.x) / 2, y: (nearFist.y + farFist.y) / 2 };

/** Radius of the hole or ring each cord is tied through, at the tag end and the object end. */
export const TIE_R: Record<string, { from: number; to: number; fromRim: number; toRim: number }> = {
  key: { from: 20, fromRim: 33, to: 10, toRim: 20 },
  frame: { from: 8, fromRim: 15, to: 4, toRim: 8 },
  seal: { from: 8, fromRim: 15, to: 4, toRim: 4 },
};

export const CORDS: CordSpec[] = [
  { id: "key", kind: "clears", from: keyFrom, to: keyTo, sag: 0, control: through(keyFrom, keyTo, at(womanArm, JOINT.blades), 0.25), cutAt: 0.25 },
  { id: "frame", kind: "clears", from: frameFrom, to: frameTo, sag: 30, cutAt: 0.45 },
  { id: "seal", kind: "seller", from: sealFrom, to: sealTo, sag: 0, control: through(sealFrom, sealTo, grip, 0.4), cutAt: 0.5 },
];

export const CARDS = {
  keys: { x: 560, y: 0 },
  nfts: { x: 800, y: 770 },
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
