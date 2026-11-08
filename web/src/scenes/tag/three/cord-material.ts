// Glowing cord shader: a solid core or a soft halo, with dashes, a travelling light pulse and a slow flicker.
import { AdditiveBlending, Color, NormalBlending, ShaderMaterial } from "three";

const vertex = /* glsl */ `
varying vec2 vUv;
varying float vFacing;
void main() {
  vUv = uv;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(dot(n, normalize(-view.xyz)));
  gl_Position = projectionMatrix * view;
}`;

const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uHalo;
uniform float uDash;
uniform float uDashCount;
uniform float uPulse;
uniform float uFlicker;
uniform float uTime;
varying vec2 vUv;
varying float vFacing;
void main() {
  if (uDash > 0.5 && fract(vUv.x * uDashCount) > 0.52) discard;
  float bump = uPulse >= 0.0 ? exp(-pow((vUv.x - uPulse) * 11.0, 2.0)) : 0.0;
  float flick = mix(1.0, 0.6 + 0.4 * sin(uTime * 1.7 + 2.0 * sin(uTime * 0.6)), uFlicker);
  float body = uHalo > 0.5 ? pow(vFacing, 2.4) * 0.32 : 0.55 + 0.45 * vFacing;
  vec3 color = mix(uColor, vec3(1.0), bump * 0.65) * (1.0 + bump * (uHalo > 0.5 ? 2.5 : 1.2));
  float alpha = clamp((body + bump * (uHalo > 0.5 ? 0.55 : 0.6)) * uAlpha * flick, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`;

export function cordMaterial(halo: boolean): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: halo ? AdditiveBlending : NormalBlending,
    uniforms: {
      uColor: { value: new Color() },
      uAlpha: { value: 1 },
      uHalo: { value: halo ? 1 : 0 },
      uDash: { value: 0 },
      uDashCount: { value: 20 },
      uPulse: { value: -1 },
      uFlicker: { value: 0 },
      uTime: { value: 0 },
    },
  });
}
