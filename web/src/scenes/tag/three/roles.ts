// Reads scene colour roles from the page at runtime, so the 3D tag follows the same palette as the CSS.
import { Color } from "three";

let probeCanvas: CanvasRenderingContext2D | null = null;

/** Turns any CSS colour the browser understands into a three.js Color plus its alpha. */
function toColor(css: string): { color: Color; alpha: number } {
  probeCanvas ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const ctx = probeCanvas;
  if (!ctx) return { color: new Color(0.5, 0.5, 0.5), alpha: 1 };
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const alpha = a / 255;
  const un = (v: number) => (alpha > 0 ? v / alpha / 255 : 0);
  return { color: new Color().setRGB(un(r), un(g), un(b), "srgb"), alpha };
}

/** Resolves a role such as "--cord-clears" as seen from `host`. */
function role(host: HTMLElement, name: string, property: "color" | "background-color" = "color"): Color {
  const probe = document.createElement("span");
  probe.style.setProperty(property, `var(${name})`);
  probe.style.display = "none";
  host.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return toColor(value).color;
}

/** The first solid background behind `host`, which the glass refracts. */
function surface(host: HTMLElement): Color {
  for (let el: HTMLElement | null = host; el; el = el.parentElement) {
    const { color, alpha } = toColor(getComputedStyle(el).backgroundColor);
    if (alpha > 0.5) return color;
  }
  return role(host, "--ground");
}

export interface Roles {
  clears: Color;
  seller: Color;
  unread: Color;
  highlight: Color;
  glass: Color;
  ink: Color;
  surface: Color;
}

export function readRoles(host: HTMLElement): Roles {
  return {
    clears: role(host, "--cord-clears"),
    seller: role(host, "--cord-seller"),
    unread: role(host, "--cord-unread"),
    highlight: role(host, "--highlight"),
    glass: role(host, "--glass-tint"),
    ink: toColor(getComputedStyle(host).color).color,
    surface: surface(host),
  };
}

/** CSS string for a Color, for drawing into 2D canvases. */
export function cssOf(color: Color, alpha = 1): string {
  const c = color.clone().convertLinearToSRGB();
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}
