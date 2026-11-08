// Decides whether this device should draw the real-time 3D tag or keep the poster.
let cached: boolean | null = null;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

function lowPower(): boolean {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return saveData || (touch && cores <= 4);
}

/** True when WebGL works and the device is not a low-power touch device. Reduced motion is checked separately. */
export function canDraw3D(): boolean {
  if (typeof window === "undefined") return false;
  cached ??= hasWebGL() && !lowPower();
  return cached;
}
