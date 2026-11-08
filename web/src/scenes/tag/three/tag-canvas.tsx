// The real-time glass tag: a thick transmissive slab with the name on its face and live cords to each object.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei/core/MeshTransmissionMaterial";
import {
  ExtrudeGeometry,
  Path,
  Shape,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type Texture,
} from "three";
import type { Cord } from "../cords";
import { isDrawnClean } from "../cords";
import { VIEW, layoutFor, nameSize, stampWord, type TagBox } from "../layout";
import { CordRig } from "./cord-rig";
import { GlassEnvironment } from "./environment";
import { readRoles, type Roles } from "./roles";
import { backdropTexture, glowTexture, nameTexture, stampTexture } from "./textures";

export interface TagCanvasProps {
  name: string;
  cords: Cord[];
  size: "hero" | "panel" | "inline";
  stamped: boolean;
  /** False pauses rendering, for off-screen or hidden tabs. */
  active: boolean;
  /** The figure the canvas sits in; colours and pointer are read from it. */
  host: HTMLElement;
  onReady: () => void;
}

const UNIT = 0.01;
const FOV = 20;
const DISTANCE = (VIEW.h * UNIT) / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
const DEPTH = 0.3;
const BEVEL = 0.085;
const FACE_Z = DEPTH / 2 + BEVEL;

const MOTION = {
  hero: { float: 0.07, turn: 0.2, tilt: 0.16, pulse: 4.8 },
  panel: { float: 0.035, turn: 0.1, tilt: 0.08, pulse: 6.4 },
  inline: null,
} as const;

const toWorld = (x: number, y: number) => new Vector3((x - VIEW.w / 2) * UNIT, (VIEW.h / 2 - y) * UNIT, 0);

/** Rounded slab with the eyelet hole, sized so its bevelled outline matches the poster. */
function slab(tag: TagBox, local: (x: number, y: number) => Vector3) {
  const w = (tag.w * UNIT) / 2 - BEVEL;
  const h = (tag.h * UNIT) / 2 - BEVEL;
  const r = tag.r * UNIT - BEVEL;
  const shape = new Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - r);
  shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w + r, h);
  shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + r);
  shape.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  const eye = local(tag.eyelet.x, tag.eyelet.y);
  const hole = new Path();
  hole.absarc(eye.x, eye.y, tag.eyeletR * UNIT + BEVEL, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 10,
    curveSegments: 56,
  });
  geometry.translate(0, 0, -DEPTH / 2);
  return geometry;
}

function useRoles(host: HTMLElement): Roles {
  const [roles, setRoles] = useState(() => readRoles(host));
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => setRoles(readRoles(host));
    query.addEventListener("change", refresh);
    return () => query.removeEventListener("change", refresh);
  }, [host]);
  return roles;
}

function TagScene({ name, cords, size, stamped, host, onReady, roles }: TagCanvasProps & { roles: Roles }) {
  const invalidate = useThree((s) => s.invalidate);
  const motion = MOTION[size];
  const shape = cords.map((c) => `${c.id}:${c.kind}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutFor(cords), [shape]);
  const { tag } = layout;
  const centre = useMemo(() => ({ x: tag.x + tag.w / 2, y: tag.y + tag.h / 2 }), [tag]);
  const local = useMemo(
    () => (x: number, y: number) => new Vector3((x - centre.x) * UNIT, (centre.y - y) * UNIT, 0),
    [centre],
  );
  const base = useMemo(() => toWorld(centre.x, centre.y), [centre]);
  const geometry = useMemo(() => slab(tag, local), [tag, local]);
  const glow = useMemo(() => glowTexture(), []);
  const backdrop = useMemo(
    () => backdropTexture(roles.surface, roles.glass, roles.ink, { x: centre.x / VIEW.w, y: centre.y / VIEW.h }),
    [roles, centre],
  );
  const tintDeep = useMemo(() => roles.glass.clone().lerp(roles.ink, 0.18), [roles]);
  useEffect(() => () => backdrop.dispose(), [backdrop]);

  const rigs = useMemo(() => {
    const start = local(tag.eyelet.x, tag.eyelet.y + tag.eyeletR);
    const bottomY = local(0, tag.y + tag.h - 26).y;
    return layout.cords.map((path, i) => new CordRig(path, i, roles, glow, local, toWorld, { start, bottomY }));
  }, [layout, roles, glow, local, tag]);
  useEffect(() => () => rigs.forEach((rig) => rig.dispose()), [rigs]);

  const cutKey = cords.map((c) => (c.cut ? 1 : 0)).join("");
  useEffect(() => {
    rigs.forEach((rig, i) => rig.setCut(cords[i]?.cut ?? false));
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutKey, rigs, invalidate]);

  const textArea = { w: tag.text.w + 40, h: 120 };
  const [nameMap, setNameMap] = useState<Texture | null>(null);
  useEffect(() => {
    let live = true;
    let made: Texture | null = null;
    void document.fonts.ready.then(() => {
      if (!live) return;
      made = nameTexture(name, nameSize(name, tag.text.w), textArea, roles.ink, roles.glass);
      setNameMap(made);
      invalidate();
    });
    return () => {
      live = false;
      made?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, roles, tag, invalidate]);

  const clean = isDrawnClean(cords);
  const stampMap = useMemo(() => stampTexture(stampWord(clean), roles.highlight.clone().lerp(roles.ink, 0.4)), [clean, roles]);
  useEffect(() => () => stampMap.dispose(), [stampMap]);
  const stampRef = useRef<Mesh>(null);
  const stampState = useRef({ shown: stamped, landAt: null as number | null, pending: false });
  useEffect(() => {
    const s = stampState.current;
    if (stamped && !s.shown) s.pending = true;
    if (!stamped) s.landAt = null;
    s.shown = stamped;
    invalidate();
  }, [stamped, invalidate]);

  const group = useRef<Group>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  useEffect(() => {
    if (!motion) return;
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const p = pointer.current;
      p.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      p.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [host, motion]);

  const frames = useRef(0);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    if (motion) {
      const p = pointer.current;
      const ease = 1 - Math.exp(-delta * 3);
      p.x += (p.tx - p.x) * ease;
      p.y += (p.ty - p.y) * ease;
      g.position.set(base.x, base.y + motion.float * Math.sin(t * 0.9), 0);
      g.rotation.set(0.035 * Math.sin(t * 0.5) + p.y * motion.tilt * 0.6, motion.turn * Math.sin(t * 0.35) + p.x * motion.tilt, 0.012 * Math.sin(t * 0.6));
    }
    g.updateMatrixWorld();

    let busy = false;
    for (const rig of rigs) busy = rig.update(t, g, motion ? motion.pulse : null) || busy;

    const s = stampState.current;
    const mesh = stampRef.current;
    if (mesh) {
      if (s.pending) {
        s.pending = false;
        s.landAt = t;
      }
      const k = s.landAt === null ? 1 : Math.min((t - s.landAt) / 0.5, 1);
      const back = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
      mesh.scale.setScalar(1.7 - 0.7 * back);
      (mesh.material as MeshBasicMaterial).opacity = Math.min(k * 1.6, 1) * 0.92;
      if (k < 1) busy = true;
      else s.landAt = null;
    }

    frames.current += 1;
    if (frames.current === 3) onReady();
    if (frames.current < 3 || busy) state.invalidate();
  });

  const textCentre = local(tag.text.x + tag.text.w / 2, tag.text.y);
  const stampAt = local(tag.x + tag.w - 104, tag.y + 66);
  const eye = local(tag.eyelet.x, tag.eyelet.y);
  const hero = size === "hero";

  return (
    <>
      <group ref={group} position={base}>
        <mesh geometry={geometry}>
          <MeshTransmissionMaterial
            background={backdrop}
            color={roles.glass}
            samples={hero ? 6 : 4}
            resolution={hero ? 768 : 384}
            backside={hero}
            backsideThickness={0.25}
            thickness={0.5}
            roughness={0.06}
            ior={1.42}
            chromaticAberration={0.06}
            anisotropicBlur={0.12}
            distortion={0.08}
            distortionScale={0.35}
            temporalDistortion={motion ? 0.03 : 0}
            clearcoat={1}
            clearcoatRoughness={0.06}
            attenuationDistance={1}
            attenuationColor={tintDeep}
            envMapIntensity={1.6}
          />
        </mesh>
        <mesh position={[eye.x, eye.y, 0]}>
          <torusGeometry args={[tag.eyeletR * UNIT + BEVEL + 0.1, 0.014, 8, 64]} />
          <meshBasicMaterial color={roles.highlight} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        {rigs.map((rig) => (
          <primitive key={rig.path.cord.id} object={rig.inner} />
        ))}
        {nameMap && (
          <mesh position={[textCentre.x, textCentre.y, FACE_Z + 0.004]} renderOrder={2}>
            <planeGeometry args={[textArea.w * UNIT, textArea.h * UNIT]} />
            <meshBasicMaterial map={nameMap} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )}
        {stamped && (
          <mesh ref={stampRef} position={[stampAt.x, stampAt.y, FACE_Z + 0.008]} rotation={[0, 0, (14 * Math.PI) / 180]} renderOrder={3}>
            <planeGeometry args={[0.92, 0.92]} />
            <meshBasicMaterial map={stampMap} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      </group>
      {rigs.map((rig) => (
        <primitive key={rig.path.cord.id} object={rig.outer} />
      ))}
    </>
  );
}

export default function TagCanvas(props: TagCanvasProps) {
  const roles = useRoles(props.host);
  const frameloop = !props.active ? "never" : MOTION[props.size] ? "always" : "demand";
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={frameloop}
      camera={{ fov: FOV, position: [0, 0, DISTANCE], near: DISTANCE - 6, far: DISTANCE + 6 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <GlassEnvironment tint={roles.glass} />
      <TagScene {...props} roles={roles} />
    </Canvas>
  );
}
