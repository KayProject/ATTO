// A small studio of light panels, baked once into an environment map so the glass has something to reflect.
"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { BackSide, BoxGeometry, FrontSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, type Color } from "three";

export function GlassEnvironment({ tint }: { tint: Color }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const studio = new Scene();
    const disposables: { dispose(): void }[] = [];
    const add = (geometry: BoxGeometry | PlaneGeometry, strength: number, place: (m: Mesh) => void, back = false) => {
      const material = new MeshBasicMaterial({ color: tint.clone().multiplyScalar(strength), side: back ? BackSide : FrontSide });
      const mesh = new Mesh(geometry, material);
      place(mesh);
      studio.add(mesh);
      disposables.push(geometry, material);
    };
    add(new BoxGeometry(24, 24, 24), 0.035, () => {}, true);
    add(new PlaneGeometry(10, 5), 4, (m) => {
      m.position.set(0, 9, 2);
      m.rotation.x = Math.PI / 2;
    });
    add(new PlaneGeometry(1.4, 14), 12, (m) => {
      m.position.set(-8, 1, 3);
      m.rotation.y = Math.PI / 2.4;
    });
    add(new PlaneGeometry(0.7, 14), 9, (m) => {
      m.position.set(8, 0, 1);
      m.rotation.y = -Math.PI / 2.2;
    });
    add(new PlaneGeometry(14, 0.6), 6, (m) => {
      m.position.set(0, -3, 9);
      m.rotation.x = Math.PI;
    });
    add(new PlaneGeometry(3, 3), 1.6, (m) => {
      m.position.set(4, 4, 9);
      m.lookAt(0, 0, 0);
    });

    const { scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(studio, 0.035);
    const previous = scene.environment;
    scene.environment = target.texture;
    invalidate();
    return () => {
      scene.environment = previous;
      target.dispose();
      pmrem.dispose();
      for (const d of disposables) d.dispose();
    };
  }, [gl, get, tint, invalidate]);

  return null;
}
