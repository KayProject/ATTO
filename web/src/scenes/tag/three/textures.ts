// Canvas-drawn textures for the 3D tag: the engraved name, the stamp and a soft glow dot.
import { CanvasTexture, SRGBColorSpace, type Color } from "three";
import { cssOf } from "./roles";

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { el, ctx };
}

function texture(el: HTMLCanvasElement) {
  const tex = new CanvasTexture(el);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The name written across a plane of `units` layout width, using the page's display font. */
export function nameTexture(name: string, fontPx: number, units: { w: number; h: number }, ink: Color, glass: Color) {
  // A faint copy below the letters reads as an engraving.
  const scale = 1024 / units.w;
  const { el, ctx } = canvas(1024, Math.round(units.h * scale));
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  ctx.font = `620 ${fontPx * scale}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${-0.02 * fontPx * scale}px`;
  const x = el.width / 2;
  const y = el.height / 2;
  ctx.fillStyle = cssOf(ink.clone().lerp(glass, 0.5), 0.18);
  ctx.fillText(name, x, y + 3);
  ctx.fillStyle = cssOf(ink, 0.95);
  ctx.fillText(name, x, y);
  return texture(el);
}

/** A round inked stamp reading `word`. */
export function stampTexture(word: string, ink: Color) {
  const { el, ctx } = canvas(256, 256);
  ctx.translate(128, 128);
  ctx.strokeStyle = cssOf(ink, 1);
  ctx.fillStyle = cssOf(ink, 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.setLineDash([9, 12]);
  ctx.beginPath();
  ctx.arc(0, 0, 98, 0, Math.PI * 2);
  ctx.stroke();
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-machine").trim() || "monospace";
  ctx.font = `700 40px ${mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssOf(ink, 1);
  ctx.fillText(word.toUpperCase(), 0, 2, 150);
  return texture(el);
}

/** Soft round falloff used for glows and the snap flash. */
export function glowTexture() {
  const { el, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(el);
}

/** What the glass refracts: the surface colour with soft light pooled behind the tag, like a lit backdrop. */
export function backdropTexture(surface: Color, glass: Color, ink: Color, at: { x: number; y: number }) {
  const { el, ctx } = canvas(500, 300);
  ctx.fillStyle = cssOf(surface, 1);
  ctx.fillRect(0, 0, 500, 300);
  const cx = at.x * 500;
  const cy = at.y * 300;
  const light = surface.clone().lerp(glass, 0.3);
  const pool = ctx.createRadialGradient(cx - 40, cy - 30, 0, cx - 40, cy - 30, 170);
  pool.addColorStop(0, cssOf(light, 0.9));
  pool.addColorStop(1, cssOf(light, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, 500, 300);
  const deep = ctx.createRadialGradient(cx + 60, cy + 70, 0, cx + 60, cy + 70, 120);
  deep.addColorStop(0, cssOf(surface.clone().lerp(ink, 0.12), 0.9));
  deep.addColorStop(1, cssOf(surface, 0));
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, 500, 300);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = cssOf(glass, 0.1);
  for (const [w, dx] of [[26, -70], [10, -20], [44, 60]]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + dx - 80, cy + 120);
    ctx.lineTo(cx + dx + 80, cy - 120);
    ctx.stroke();
  }
  return texture(el);
}
