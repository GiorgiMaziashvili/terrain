import { MathUtils } from "three";
import {
  GRID_COLS,
  GRID_ROWS,
  GRID_SIZE,
  RELIEF_FLAT_RADIUS,
} from "./constants";
import { smoothstep } from "./math";

export function useGridData() {
  const count = GRID_COLS * GRID_ROWS;
  const positions2D = new Float32Array(count * 3);
  const edgeMask = new Float32Array(count);

  const halfW = GRID_SIZE / 2;
  const halfH = (GRID_SIZE * (GRID_ROWS / GRID_COLS)) / 2;
  const gridHeight = halfH * 2;

  let ptr = 0,
    vidx = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    const v = r / (GRID_ROWS - 1);
    for (let c = 0; c < GRID_COLS; c++) {
      const u = c / (GRID_COLS - 1);

      const x = MathUtils.lerp(-halfW, halfW, u);
      const y = MathUtils.lerp(-halfH, halfH, v);

      positions2D[ptr] = x;
      positions2D[ptr + 1] = y;
      positions2D[ptr + 2] = 0;

      const du = u - 0.5;
      const dv = v - 0.5;
      const ruv = Math.hypot(du, dv) * 1.8;
      edgeMask[vidx] = smoothstep(RELIEF_FLAT_RADIUS, 0.9, ruv);

      ptr += 3;
      vidx++;
    }
  }

  const segments: number[] = [];
  const idx = (rr: number, cc: number) => rr * GRID_COLS + cc;
  for (let rr = 0; rr < GRID_ROWS; rr++) {
    for (let cc = 0; cc < GRID_COLS; cc++) {
      if (cc < GRID_COLS - 1) segments.push(idx(rr, cc), idx(rr, cc + 1));
      if (rr < GRID_ROWS - 1) segments.push(idx(rr, cc), idx(rr + 1, cc));
    }
  }

  return {
    positions2D,
    segments: new Uint16Array(segments),
    edgeMask,
    gridHeight,
    halfH,
    halfW,
  };
}
