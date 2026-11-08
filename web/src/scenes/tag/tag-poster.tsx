// Still drawing of the tag and its cords. Used before the 3D tag loads and for reduced motion.
import type { GlassTagProps } from "./glass-tag";

export function TagPoster({ name, cords, size = "panel", stamped = false, className = "" }: GlassTagProps) {
  return (
    <figure className={`tag tag-${size} ${className}`} data-stamped={stamped || undefined}>
      <div className="tag-body">
        <span className="tag-name">{name}</span>
      </div>
      <ul className="tag-cords">
        {cords.map((cord) => (
          <li key={cord.id} className={`tag-cord cord-${cord.kind}`} data-cut={cord.cut || undefined}>
            {cord.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
