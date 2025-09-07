import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import type { LineMaterial } from "three-stdlib";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  MathUtils,
  PointsMaterial,
  Uint16BufferAttribute,
} from "three";

import {
  DOT_OPACITY,
  DOT_SIZE,
  LINE_OPACITY,
  MAX_SPEED,
  NOISE_FREQ,
  NOISE_SPEED,
  RELIEF_MAX_HEIGHT,
} from "../utils/constants";
import { cheapNoise, smoothstep } from "../utils/math";
import { useGridData } from "../utils/grid";

export function GridRelief() {
  const scroll = useScroll();
  const { positions2D, segments, edgeMask, gridHeight, halfH, halfW } = useGridData();

  const groupRef = useRef<Group>(null!);
  const lineRef = useRef<LineMaterial>(null!);
  const pointRef = useRef<PointsMaterial>(null!);

  const positionAttr = useMemo(() => new Float32BufferAttribute(positions2D.slice(), 3), [positions2D]);

  const geom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", positionAttr);
    return g;
  }, [positionAttr]);

  const lineGeom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", positionAttr);
    return g;
  }, [positionAttr]);

  const basePositions = useMemo(() => positions2D.slice(), [positions2D]);
  const baseSegments = useMemo(() => segments.slice(), [segments]);

  const yOffsetRef = useRef(0);
  const phaseRef = useRef(0);
  const seedRef = useRef(Math.random() * 1000);

  const filteredIndices = useMemo(() => new Uint16Array(baseSegments.length), [baseSegments]);

  useFrame((_, delta) => {
    const firstPage = scroll.range(0 / 3, 1 / 3);
    const t = MathUtils.clamp(firstPage, 0, 1);
    const ease = smoothstep(0, 1, t);

    const SPEED = MathUtils.clamp(ease, 0, MAX_SPEED);
    const rotX = -Math.PI * 0.5 * ease;
    const posZ = 1 * ease;

    if (lineRef.current) lineRef.current.opacity = LINE_OPACITY + 0.2 * ease;
    if (pointRef.current) pointRef.current.opacity = DOT_OPACITY + 0.7 * ease;

    // advance scroll + noise phase
    yOffsetRef.current += SPEED * delta * gridHeight;
    if (yOffsetRef.current >= gridHeight) yOffsetRef.current -= gridHeight;
    if (yOffsetRef.current < 0) yOffsetRef.current += gridHeight;

    phaseRef.current += NOISE_SPEED * delta;

    const invW = 1 / halfW;
    const invH = 1 / halfH;

    const arr = positionAttr.array as Float32Array;

    const wrappedPoints = new Set<number>();

    for (let i = 0, j = 0; i < edgeMask.length; i++, j += 3) {
      const x0 = basePositions[j];
      const y0 = basePositions[j + 1];

      let y = y0 - yOffsetRef.current;

      if (y > halfH) {
        y -= gridHeight;
        wrappedPoints.add(i);
      } else if (y < -halfH) {
        y += gridHeight;
        wrappedPoints.add(i);
      }

      const nx = x0 * invW * NOISE_FREQ + seedRef.current;
      const ny = y * invH * NOISE_FREQ;
      const n = cheapNoise(nx, ny, phaseRef.current);

      const curve1 = Math.pow(n, 1.8);
      const curve2 = Math.pow(1 - n, 2.2);
      const blended = curve1 * 0.7 + (1 - curve2) * 0.3;

      const turbulence = Math.sin(nx * 15.3 + phaseRef.current * 3) * 0.05 +
        Math.cos(ny * 13.7 + phaseRef.current * 2.5) * 0.03;

      const finalHeight = (blended + turbulence) * RELIEF_MAX_HEIGHT * edgeMask[i];

      let px = x0;
      let py = y;
      let pz = finalHeight * ease;

      if (!Number.isFinite(px)) px = 0;
      if (!Number.isFinite(py)) py = 0;
      if (!Number.isFinite(pz)) pz = 0;

      arr[j] = px;
      arr[j + 1] = py;
      arr[j + 2] = pz;
    }
    positionAttr.needsUpdate = true;

    let filteredCount = 0;
    for (let i = 0; i < baseSegments.length; i += 2) {
      const idx1 = baseSegments[i];
      const idx2 = baseSegments[i + 1];

      const point1Wrapped = wrappedPoints.has(idx1);
      const point2Wrapped = wrappedPoints.has(idx2);

      if (point1Wrapped === point2Wrapped) {
        filteredIndices[filteredCount] = idx1;
        filteredIndices[filteredCount + 1] = idx2;
        filteredCount += 2;
      }
    }

    const indexAttr = new Uint16BufferAttribute(filteredIndices.slice(0, filteredCount), 1);
    lineGeom.setIndex(indexAttr);

    if (groupRef.current) {
      groupRef.current.rotation.x = rotX;
      groupRef.current.position.z = posZ;
      groupRef.current.position.y = -2.5;
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial ref={lineRef} transparent opacity={LINE_OPACITY} depthWrite={false} />
      </lineSegments>
      <points geometry={geom}>
        <pointsMaterial
          ref={pointRef}
          size={DOT_SIZE}
          sizeAttenuation={false}
          transparent
          opacity={DOT_OPACITY}
          toneMapped={false}
          depthWrite={false}
          color={new Color(52.0, 5.0, 52.0)}
        />
      </points>
    </group>
  );
}

