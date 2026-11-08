// A tube whose vertices are rewritten in place each frame, so cords can follow the moving tag without new allocations.
import { BufferAttribute, BufferGeometry, Vector3 } from "three";

export const SEGMENTS = 48;
const RADIAL = 8;

export function makeTube(): BufferGeometry {
  const geometry = new BufferGeometry();
  const count = (SEGMENTS + 1) * (RADIAL + 1);
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(count * 3), 3));
  const uv = new Float32Array(count * 2);
  const index: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    for (let j = 0; j <= RADIAL; j++) {
      const k = i * (RADIAL + 1) + j;
      uv[k * 2] = i / SEGMENTS;
      uv[k * 2 + 1] = j / RADIAL;
      if (i < SEGMENTS && j < RADIAL) {
        const a = k;
        const b = k + RADIAL + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

/** Cubic bezier through four points, evaluated into `out`. */
export function bezier(p: Vector3[], t: number, out: Vector3): Vector3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return out.set(
    a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
    a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
    a * p[0].z + b * p[1].z + c * p[2].z + d * p[3].z,
  );
}

/** Splits a cubic bezier at t into near and far control points. */
export function splitBezier(p: Vector3[], t: number): [Vector3[], Vector3[]] {
  const l = (a: Vector3, b: Vector3) => a.clone().lerp(b, t);
  const a = l(p[0], p[1]);
  const b = l(p[1], p[2]);
  const c = l(p[2], p[3]);
  const d = l(a, b);
  const e = l(b, c);
  const f = l(d, e);
  return [
    [p[0].clone(), a, d, f],
    [f.clone(), e, c, p[3].clone()],
  ];
}

const pt = new Vector3();
const next = new Vector3();
const tangent = new Vector3();
const normal = new Vector3();
const binormal = new Vector3();
const Z = new Vector3(0, 0, 1);
const Y = new Vector3(0, 1, 0);

/** Writes a tube of `radius` along the bezier `p` into `geometry`. */
export function writeTube(geometry: BufferGeometry, p: Vector3[], radius: number) {
  const pos = geometry.getAttribute("position") as BufferAttribute;
  const nor = geometry.getAttribute("normal") as BufferAttribute;
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    bezier(p, t, pt);
    bezier(p, Math.min(t + 0.01, 1), next);
    if (t >= 0.99) bezier(p, t - 0.01, tangent).subVectors(pt, tangent);
    else tangent.subVectors(next, pt);
    tangent.normalize();
    normal.crossVectors(tangent, Math.abs(tangent.z) > 0.9 ? Y : Z).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    for (let j = 0; j <= 8; j++) {
      const v = (j / 8) * Math.PI * 2;
      const s = Math.sin(v);
      const c = -Math.cos(v);
      const nx = c * normal.x + s * binormal.x;
      const ny = c * normal.y + s * binormal.y;
      const nz = c * normal.z + s * binormal.z;
      const k = i * 9 + j;
      nor.setXYZ(k, nx, ny, nz);
      pos.setXYZ(k, pt.x + radius * nx, pt.y + radius * ny, pt.z + radius * nz);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  geometry.computeBoundingSphere();
}

/** Rough length of the bezier, for spacing dashes. */
export function bezierLength(p: Vector3[]): number {
  let length = 0;
  const a = new Vector3();
  const b = new Vector3();
  bezier(p, 0, a);
  for (let i = 1; i <= 24; i++) {
    bezier(p, i / 24, b);
    length += a.distanceTo(b);
    a.copy(b);
  }
  return length;
}
