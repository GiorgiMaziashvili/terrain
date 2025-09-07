import { MathUtils } from "three";

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// A small, fast pseudo-noise function sufficient for visual displacement
export function cheapNoise(x: number, y: number, p: number = 0) {
  const n1 = Math.sin((x + p) * 3.7) * 0.5 + Math.cos((y - p * 0.8) * 4.1) * 0.35;
  const n2 = Math.sin((x + y + p * 0.6) * 2.3) * 0.25 + Math.sin((Math.hypot(x, y) + p * 0.4) * 3.0) * 0.2;
  const n3 = Math.sin(x * 12.3 + p * 2) * 0.1 + Math.cos(y * 11.7 + p * 1.8) * 0.08;
  const n4 = Math.sin((x + y) * 8.5 + p * 1.2) * 0.06;
  const combined = n1 + n2 + n3 + n4;
  return 0.5 + combined * 0.4;
}

