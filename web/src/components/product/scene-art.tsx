import Image from "next/image";
export function SceneArt({ scene }: { scene: "handoff" | "inspection" | "renewal" }) {
  return (
    <div className="scene-art" aria-hidden="true">
      <Image
        src={`/art/name-${scene}.png`}
        alt=""
        width={scene === "renewal" ? 1219 : 1536}
        height={scene === "renewal" ? 1290 : 1024}
        sizes="(min-width: 960px) 50vw, 100vw"
        preload={scene === "handoff"}
      />
    </div>
  );
}
