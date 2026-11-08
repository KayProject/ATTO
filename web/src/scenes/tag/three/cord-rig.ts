// One cord in 3D: its glowing tube from the tag to the object, the bead inside the glass, and the snap when cut.
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
  type ShaderMaterial,
  type Texture,
} from "three";
import { SNAP_AT, type CordPath } from "../layout";
import { cordMaterial } from "./cord-material";
import type { Roles } from "./roles";
import { bezierLength, makeTube, splitBezier, writeTube } from "./tube";

const CORE = 0.017;
const HALO = 0.07;
const FALL = 0.95;
const FLASH = 0.42;

export type ToLocal = (x: number, y: number) => Vector3;
export type ToWorld = (x: number, y: number) => Vector3;

const anchor = new Vector3();
const reach = new Vector3();

export class CordRig {
  /** Tube and falling half, in world space. */
  readonly outer = new Group();
  /** Bead and vein, inside the glass, moving with the tag. */
  readonly inner = new Group();

  private readonly core: Mesh;
  private readonly halo: Mesh;
  private readonly far = new Group();
  private readonly farCore: Mesh;
  private readonly farHalo: Mesh;
  private readonly flash: Sprite;
  private readonly bead: Mesh;
  private readonly beadGlow: Sprite;
  private readonly vein: Mesh;
  private readonly materials: ShaderMaterial[];

  private readonly anchorLocal: Vector3;
  private readonly reachOffset: Vector3;
  private readonly p2: Vector3;
  private readonly p3: Vector3;
  private readonly lit: Color;
  private readonly dim: Color;
  private cut: boolean;
  private snapAt: number | null = null;
  private pendingSnap = false;
  private readonly pivot = new Vector3();

  constructor(
    readonly path: CordPath,
    private readonly index: number,
    roles: Roles,
    glow: Texture,
    toLocal: ToLocal,
    toWorld: ToWorld,
    veinFrom: { start: Vector3; bottomY: number },
  ) {
    const { cord } = path;
    this.lit = (cord.kind === "seller" ? roles.seller : cord.kind === "unread" ? roles.unread : roles.clears).clone();
    this.dim = this.lit.clone().lerp(roles.ink, 0.55);
    this.cut = cord.cut && cord.kind === "clears";

    this.anchorLocal = toLocal(path.p0.x, path.p0.y);
    this.reachOffset = toWorld(path.p1.x, path.p1.y).sub(toWorld(path.p0.x, path.p0.y));
    this.p2 = toWorld(path.p2.x, path.p2.y);
    this.p3 = toWorld(path.p3.x, path.p3.y);

    const coreMat = cordMaterial(false);
    const haloMat = cordMaterial(true);
    const farCoreMat = cordMaterial(false);
    const farHaloMat = cordMaterial(true);
    const veinMat = cordMaterial(false);
    this.materials = [coreMat, haloMat, farCoreMat, farHaloMat, veinMat];
    for (const m of this.materials) m.uniforms.uColor.value.copy(this.lit);
    veinMat.uniforms.uAlpha.value = 0.32;

    if (cord.kind === "unread") {
      const length = bezierLength([toWorld(path.p0.x, path.p0.y), toWorld(path.p1.x, path.p1.y), this.p2, this.p3]);
      for (const m of [coreMat, haloMat]) {
        m.uniforms.uDash.value = 1;
        m.uniforms.uDashCount.value = Math.round(length / 0.2);
        m.uniforms.uFlicker.value = 1;
      }
    }

    this.core = new Mesh(makeTube(), coreMat);
    this.halo = new Mesh(makeTube(), haloMat);
    this.farCore = new Mesh(makeTube(), farCoreMat);
    this.farHalo = new Mesh(makeTube(), farHaloMat);
    this.far.add(this.farCore, this.farHalo);
    this.far.visible = false;
    for (const m of [this.core, this.halo, this.farCore, this.farHalo]) m.frustumCulled = false;

    this.flash = new Sprite(new SpriteMaterial({ map: glow, color: roles.glass, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    this.flash.visible = false;
    this.outer.add(this.core, this.halo, this.far, this.flash);

    const beadAt = toLocal(path.bead.x, path.bead.y);
    this.bead = new Mesh(new SphereGeometry(0.06, 16, 12), new MeshBasicMaterial({ color: this.lit, toneMapped: false }));
    this.bead.position.copy(beadAt);
    this.beadGlow = new Sprite(new SpriteMaterial({ map: glow, color: this.lit, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    this.beadGlow.position.copy(beadAt);
    this.beadGlow.scale.setScalar(0.32);

    const veinPoints = [
      veinFrom.start.clone(),
      veinFrom.start.clone().add(new Vector3(0.4, 0, 0)).setY(veinFrom.bottomY),
      new Vector3(beadAt.x - 1.2, veinFrom.bottomY, 0),
      beadAt.clone(),
    ];
    const veinGeometry = makeTube();
    writeTube(veinGeometry, veinPoints, 0.011);
    this.vein = new Mesh(veinGeometry, veinMat);
    this.inner.add(this.vein, this.bead, this.beadGlow);

    this.applyCutLook(this.cut ? 1 : 0);
  }

  /** Sets the cord's cut state; plays the snap when it turns cut after the first draw. */
  setCut(cut: boolean) {
    const next = cut && this.path.cord.kind === "clears";
    if (next === this.cut) return;
    this.cut = next;
    if (next) this.pendingSnap = true;
    else {
      this.snapAt = null;
      this.far.visible = false;
      this.flash.visible = false;
      this.applyCutLook(0);
    }
  }

  private applyCutLook(k: number) {
    const [core, halo, , , vein] = this.materials;
    core.uniforms.uColor.value.copy(this.lit).lerp(this.dim, k);
    halo.uniforms.uAlpha.value = 1 - k;
    vein.uniforms.uAlpha.value = 0.32 * (1 - k * 0.85);
    (this.bead.material as MeshBasicMaterial).color.copy(this.lit).lerp(this.dim, k);
    (this.beadGlow.material as SpriteMaterial).opacity = 0.6 * (1 - k * 0.9);
  }

  /** Moves the cord with the tag. Returns true while the snap is still playing. */
  update(time: number, tag: Object3D, pulsePeriod: number | null): boolean {
    tag.localToWorld(anchor.copy(this.anchorLocal));
    reach.copy(anchor).add(this.reachOffset);
    const curve = [anchor, reach, this.p2, this.p3];
    for (const m of this.materials) m.uniforms.uTime.value = time;

    if (this.pendingSnap) {
      this.pendingSnap = false;
      this.snapAt = time;
      const [, farPart] = splitBezier(curve, SNAP_AT);
      const pivot = this.pivot.copy(farPart[0]);
      const local = farPart.map((p) => p.clone().sub(pivot));
      writeTube(this.farCore.geometry, local, CORE);
      writeTube(this.farHalo.geometry, local, HALO);
      this.far.position.copy(pivot);
      this.far.rotation.set(0, 0, 0);
      this.far.visible = true;
      this.flash.position.copy(pivot);
      this.flash.visible = true;
    }

    if (!this.cut) {
      writeTube(this.core.geometry, curve, CORE);
      writeTube(this.halo.geometry, curve, HALO);
      const live = pulsePeriod !== null && this.path.cord.kind !== "unread";
      const phase = live ? ((time + this.index * 0.42) % pulsePeriod) / pulsePeriod : 1;
      const pulse = phase < 0.3 ? phase / 0.3 : -1;
      this.materials[0].uniforms.uPulse.value = pulse;
      this.materials[1].uniforms.uPulse.value = pulse;
      return false;
    }

    const [near] = splitBezier(curve, SNAP_AT);
    writeTube(this.core.geometry, near, CORE);
    writeTube(this.halo.geometry, near, HALO);
    this.materials[0].uniforms.uPulse.value = -1;
    if (this.snapAt === null) {
      this.applyCutLook(1);
      return false;
    }

    const elapsed = time - this.snapAt;
    const k = Math.min(elapsed / FALL, 1);
    const fall = k * k;
    this.far.position.set(this.pivot.x + 0.14 * k, this.pivot.y - 2.6 * fall, this.pivot.z);
    this.far.rotation.z = -0.55 * fall;
    const fade = Math.pow(1 - k, 1.4);
    this.materials[2].uniforms.uAlpha.value = fade;
    this.materials[3].uniforms.uAlpha.value = fade;
    this.applyCutLook(Math.min(elapsed / 0.5, 1));

    const f = Math.min(elapsed / FLASH, 1);
    this.flash.scale.setScalar(0.15 + f * 0.9);
    (this.flash.material as SpriteMaterial).opacity = 1 - f;
    if (f >= 1) this.flash.visible = false;

    if (k >= 1) {
      this.far.visible = false;
      this.snapAt = null;
      this.applyCutLook(1);
      return false;
    }
    return true;
  }

  dispose() {
    for (const mesh of [this.core, this.halo, this.farCore, this.farHalo, this.vein, this.bead]) mesh.geometry.dispose();
    for (const m of this.materials) m.dispose();
    (this.bead.material as MeshBasicMaterial).dispose();
    (this.beadGlow.material as SpriteMaterial).dispose();
    (this.flash.material as SpriteMaterial).dispose();
  }
}
