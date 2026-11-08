// Illustrated people: each character is a separate transparent image per pose, so scenes move them as layers.
export type Who = "seller" | "buyer" | "keeper" | "checker" | "crowd";
export type Pose = "stand" | "walk-a" | "walk-b" | "wave" | "sit" | "point" | "carry" | "handover";

export interface CharacterProps {
  who: Who;
  pose?: Pose;
  /** Rendered height in pixels; width follows the image. */
  height?: number;
  /** Mirror horizontally, to face left. */
  flip?: boolean;
  /** Accessible name. Leave empty when the character is decoration. */
  label?: string;
  className?: string;
}

/** Poses drawn so far. A missing pose falls back to the character's first drawn pose. */
const DRAWN: Record<Who, Pose[]> = {
  seller: ["stand"],
  buyer: ["stand"],
  keeper: ["stand"],
  checker: ["stand"],
  crowd: ["sit"],
};

export function characterSrc(who: Who, pose: Pose = "stand") {
  const drawn = DRAWN[who];
  return `/cast/people/${who}-${drawn.includes(pose) ? pose : drawn[0]}.webp`;
}

export function Character({ who, pose = "stand", height = 160, flip = false, label, className = "" }: CharacterProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={characterSrc(who, pose)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      height={height}
      className={`character character-${who} ${className}`}
      data-pose={pose}
      style={{ height, width: "auto", transform: flip ? "scaleX(-1)" : undefined }}
      draggable={false}
      decoding="async"
      loading="lazy"
    />
  );
}
