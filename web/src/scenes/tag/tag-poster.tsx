// Still drawing of the tag and its cords. Used before the 3D tag loads and for reduced motion.
import { useId, type CSSProperties, type ReactNode } from "react";
import type { GlassTagProps } from "./glass-tag";
import { isDrawnClean, type Cord } from "./cords";
import { CastArt } from "./cast";
import {
  SNAP_AT,
  VIEW,
  cordNote,
  cubicPath,
  layoutFor,
  nameSize,
  splitCubic,
  stampWord,
  tagOutline,
  type TagBox,
} from "./layout";

export interface TagPosterProps extends GlassTagProps {
  /** True once the 3D tag is drawn over the poster; the poster then keeps only objects and chips. */
  live?: boolean;
  /** Layer drawn under the poster, used for the 3D canvas. */
  underlay?: ReactNode;
}

/** Plain sentence describing the drawing for screen readers. */
export function describeTag(name: string, cords: Cord[], stamped: boolean): string {
  if (isDrawnClean(cords)) return `${name}: nothing still holds this name.${stamped ? " Stamped clean." : ""}`;
  const parts = cords.map((cord) => `${cord.label}, ${cordNote(cord).toLowerCase()}`);
  return `${name} is still tied to: ${parts.join("; ")}.${stamped ? " Stamped checked." : ""}`;
}

function Stamp({ tag, word }: { tag: TagBox; word: string }) {
  const cx = tag.x + tag.w - 104;
  const cy = tag.y + 66;
  return (
    <g className="tp-stamp" transform={`translate(${cx} ${cy}) rotate(-14)`}>
      <g className="tp-stamp-land">
        <circle r={44} className="tp-stamp-fill" />
        <circle r={44} className="tp-stamp-ring" />
        <circle r={36} className="tp-stamp-ring tp-stamp-thin" />
        <text className="tp-stamp-word" textAnchor="middle" dominantBaseline="central" textLength={word.length > 5 ? 58 : undefined} lengthAdjust="spacingAndGlyphs">
          {word.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

export function TagPoster({
  name,
  cords,
  size = "panel",
  stamped = false,
  className = "",
  live = false,
  underlay,
}: TagPosterProps) {
  const p = `t${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { tag, cords: paths } = layoutFor(cords);
  const outline = tagOutline(tag);
  const bottom = tag.y + tag.h - 26;
  const fontSize = nameSize(name, tag.text.w);
  const clean = isDrawnClean(cords);

  return (
    <figure
      className={`tag tag-${size} ${className}`}
      data-stamped={stamped || undefined}
      data-live={live || undefined}
      data-clean={clean || undefined}
      role="img"
      aria-label={describeTag(name, cords, stamped)}
    >
      <div className="tag-frame">
        {underlay && <div className="tag-underlay">{underlay}</div>}
        <svg className="tag-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden focusable="false">
          <defs>
            <linearGradient id={`${p}-glass`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="tp-stop-hi" />
              <stop offset="0.55" className="tp-stop-lo" />
              <stop offset="1" className="tp-stop-mid" />
            </linearGradient>
            <radialGradient id={`${p}-frost`} cx="0.28" cy="0.18" r="0.9">
              <stop offset="0" className="tp-stop-frost" />
              <stop offset="1" className="tp-stop-clear" />
            </radialGradient>
            <linearGradient id={`${p}-rim`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="tp-stop-rim" />
              <stop offset="0.4" className="tp-stop-clear" />
              <stop offset="0.8" className="tp-stop-clear" />
              <stop offset="1" className="tp-stop-rim-low" />
            </linearGradient>
            <filter id={`${p}-soft`} x="-30%" y="-300%" width="160%" height="700%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id={`${p}-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id={`${p}-haze`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
            <clipPath id={`${p}-clip`}>
              <path d={outline} clipRule="evenodd" />
            </clipPath>
          </defs>

          <g className="tp-ground">
              <ellipse
              cx={tag.x + tag.w / 2}
              cy={tag.y + tag.h + 40}
              rx={tag.w * 0.44}
              ry={20}
              className="tp-shadow"
              filter={`url(#${p}-soft)`}
            />
          </g>
          <g className="tp-body">
            <path d={outline} fillRule="evenodd" fill={`url(#${p}-frost)`} className="tp-frost" />
            <g clipPath={`url(#${p}-clip)`}>
              <g filter={`url(#${p}-haze)`}>
                {paths.map(({ cord, bead }) => (
                  <path
                    key={cord.id}
                    className={`tp-vein cord-${cord.kind}`}
                    data-cut={cord.cut || undefined}
                    d={`M${tag.eyelet.x} ${tag.eyelet.y + tag.eyeletR} C${tag.eyelet.x + 40} ${bottom} ${bead.x - 120} ${bottom} ${bead.x} ${bead.y}`}
                  />
                ))}
              </g>
              {paths.map(({ cord, bead }) => (
                <circle key={cord.id} cx={bead.x} cy={bead.y} r={20} className={`tp-halo cord-${cord.kind}`} data-cut={cord.cut || undefined} filter={`url(#${p}-glow)`} />
              ))}
            </g>
            <path d={outline} fillRule="evenodd" fill={`url(#${p}-glass)`} className="tp-glass" />
            <rect
              x={tag.x + 12}
              y={tag.y + 12}
              width={tag.w - 24}
              height={tag.h - 24}
              rx={tag.r - 12}
              className="tp-bevel"
            />
            <path d={outline} fillRule="evenodd" className="tp-rim" stroke={`url(#${p}-rim)`} />
            <path d={outline} fillRule="evenodd" className="tp-edge" />
            <path
              d={`M${tag.x + 22} ${tag.y + tag.r + 6} A${tag.r - 16} ${tag.r - 16} 0 0 1 ${tag.x + tag.r + 6} ${tag.y + 22} H${tag.x + tag.w * 0.55}`}
              className="tp-shine"
              filter={`url(#${p}-haze)`}
            />
            <circle cx={tag.eyelet.x} cy={tag.eyelet.y} r={tag.eyeletR + 8} className="tp-eyelet" />
            {paths.map(({ cord, bead }) => (
              <circle key={cord.id} cx={bead.x} cy={bead.y} r={6} className={`tp-bead cord-${cord.kind}`} data-cut={cord.cut || undefined} />
            ))}
            <text
              x={tag.text.x + tag.text.w / 2}
              y={tag.text.y}
              className="tp-name"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fontSize }}
            >
              {name}
            </text>
          </g>

          {stamped && <Stamp tag={tag} word={stampWord(clean)} />}

          <g className="tp-cords">
            {paths.map(({ cord, p0, p1, p2, p3 }, i) => {
              const [near, far] = splitCubic(p0, p1, p2, p3, SNAP_AT);
              const whole = cubicPath([p0, p1, p2, p3]);
              return (
                <g
                  key={cord.id}
                  className={`tp-cord cord-${cord.kind}`}
                  data-cut={cord.cut || undefined}
                  style={{ "--i": i } as CSSProperties}
                >
                  <path d={whole} className="tp-cord-halo" filter={`url(#${p}-haze)`} />
                  <path d={cubicPath(near)} className="tp-cord-line" />
                  <path d={cubicPath(far)} className="tp-cord-line tp-far" />
                  {cord.kind !== "unread" && !cord.cut && (
                    <path d={whole} className="tp-pulse" pathLength={1000} />
                  )}
                </g>
              );
            })}
          </g>

          <g className="tp-objects">
            {paths.map(({ cord, end, objectSize }) => (
              <CastArt
                key={cord.id}
                kind={cord.object}
                cut={cord.cut}
                x={end.x - objectSize / 2}
                y={end.y - objectSize / 2}
                width={objectSize}
                height={objectSize}
              />
            ))}
          </g>
        </svg>
      </div>

      <ul className="tag-chips" aria-hidden>
          {paths.map(({ cord, end, objectSize }) => (
            <li
              key={cord.id}
              className={`tag-chip cord-${cord.kind}`}
              data-cut={cord.cut || undefined}
              style={{
                left: `${((end.x + objectSize / 2 + 10) / VIEW.w) * 100}%`,
                top: `${(end.y / VIEW.h) * 100}%`,
              }}
            >
              <span className="tag-chip-note">{cordNote(cord)}</span>
              {cord.label !== cordNote(cord) && <span className="tag-chip-label">{cord.label}</span>}
            </li>
          ))}
      </ul>
    </figure>
  );
}
