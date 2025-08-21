import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ScrollControls, useScroll, Html } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

/**
 * R3F Scroll-to-Relief Grid
 * --------------------------------------------------
 * What it does
 * - Starts as a flat 2D grid of dots+lines facing the camera (front-view)
 * - As you scroll, it rotates 90° and morphs into a mountain-like relief
 * - The center area stays flat; the relief grows toward the edges
 *
 * How to use
 * 1) Install deps:  npm i @react-three/fiber three @react-three/drei
 * 2) Drop <ReliefScene /> anywhere in your React app
 * 3) Adjust GRID_* and RELIEF_* constants below to taste
 */

// ==== Tunables ====
const GRID_COLS = 80;         // horizontal dots
const GRID_ROWS = 80;          // vertical dots
const GRID_SIZE = 20;           // world size of the grid (X and Y span)
const DOT_SIZE = 0.015;        // size of the dots (in world units)
const LINE_OPACITY = 0.35;     // line transparency
const DOT_OPACITY = 0.9;       // dot transparency

const RELIEF_MAX_HEIGHT = 1.8; // peak height when fully morphed
const RELIEF_FLAT_RADIUS = 2; // radius (0..~0.7) that stays flat in the middle

// Smoothstep utility
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// A simple pseudo-noise using trigs (cheap & good-looking for wire grids)
// Returns 0..1 approximately
function cheapNoise(x: number, y: number) {
  const n =
    Math.sin(x * 3.7) * 0.5 +
    Math.cos(y * 4.1) * 0.35 +
    Math.sin((x + y) * 2.3) * 0.25 +
    Math.sin(Math.hypot(x, y) * 3.0) * 0.2;
  // normalize to ~0..1
  return THREE.MathUtils.clamp(0.5 + n * 0.5, 0, 1);
}

function useGridData() {
  /**
   * Precompute flat positions (x, y, z=0) and target heights for the relief.
   * Positions are centered around (0,0) on X/Y for nicer camera framing.
   */
  return useMemo(() => {
    const count = GRID_COLS * GRID_ROWS;
    const positions2D = new Float32Array(count * 3);
    const heights = new Float32Array(count);

    const halfW = GRID_SIZE / 2;
    const halfH = (GRID_SIZE * (GRID_ROWS / GRID_COLS)) / 2; // keep aspect

    let ptr = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      const v = r / (GRID_ROWS - 1); // 0..1
      for (let c = 0; c < GRID_COLS; c++) {
        const u = c / (GRID_COLS - 1); // 0..1

        // map u,v to world X/Y with aspect compensation
        const x = THREE.MathUtils.lerp(-halfW, halfW, u);
        const y = THREE.MathUtils.lerp(-halfH, halfH, v);
        positions2D[ptr] = x; // X
        positions2D[ptr + 1] = y; // Y
        positions2D[ptr + 2] = 0; // Z flat initially

        // radial distance from center in UV space for the flat zone mask
        const du = u - 0.5;
        const dv = v - 0.5;
        const ruv = Math.hypot(du, dv) * 1.8; // scale radius so edges reach ~1

        // mask that suppresses heights near center, grows toward edges
        const edgeMask = smoothstep(RELIEF_FLAT_RADIUS, 0.9, ruv);

        // Cheap noise in UV space for repeatable peaks/ridges
        const n = cheapNoise(u * 2.0, v * 2.0);
        const ridge = Math.abs(n * 2 - 1); // ridged style

        const h = ridge * RELIEF_MAX_HEIGHT * edgeMask;
        heights[(ptr / 3) | 0] = h;

        ptr += 3;
      }
    }

    // Build line segment indices (connect neighbors horizontally & vertically)
    const segments: number[] = [];
    const idx = (rr: number, cc: number) => rr * GRID_COLS + cc;
    for (let rr = 0; rr < GRID_ROWS; rr++) {
      for (let cc = 0; cc < GRID_COLS; cc++) {
        if (cc < GRID_COLS - 1) {
          segments.push(idx(rr, cc), idx(rr, cc + 1));
        }
        if (rr < GRID_ROWS - 1) {
          segments.push(idx(rr, cc), idx(rr + 1, cc));
        }
      }
    }

    return { positions2D, heights, segments: new Uint32Array(segments) };
  }, []);
}

function GridRelief() {
  const { positions2D, heights, segments } = useGridData();
  const scroll = useScroll();

  // Refs to mutate each frame
  const pointsRef = useRef<THREE.Points>(null!);
  const linesRef = useRef<THREE.LineSegments>(null!);

  // Clone base positions so we can write Z per-frame without touching X/Y
  const workingPositions = useMemo(() => positions2D.slice(), [positions2D]);

  useFrame(() => {
    // 0 → 1 across the scrollable area
    const t = THREE.MathUtils.clamp(scroll.offset, 0, 1);

    // Easing for a slightly snappier finish
    const ease = smoothstep(0, 1, t);

    // Rotate from front view to top-side (90° about X)
    const rotX = -Math.PI * 0.5 * ease;

    // Morph Z from flat (0) to relief height
    for (let i = 0, j = 0; i < heights.length; i++, j += 3) {
      const targetZ = heights[i] * ease; // 0→height
      workingPositions[j] = positions2D[j];
      workingPositions[j + 1] = positions2D[j + 1];
      workingPositions[j + 2] = targetZ;
    }

    // Update Points geometry
    if (pointsRef.current) {
      const g = pointsRef.current.geometry as THREE.BufferGeometry & {
        attributes: { position: THREE.BufferAttribute };
      };
      (g.attributes.position.array as Float32Array).set(workingPositions);
      g.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.x = rotX;
    }

    // Update Lines geometry
    if (linesRef.current) {
      const g = linesRef.current.geometry as THREE.BufferGeometry & {
        attributes: { position: THREE.BufferAttribute };
      };
      (g.attributes.position.array as Float32Array).set(workingPositions);
      g.attributes.position.needsUpdate = true;
      linesRef.current.rotation.x = rotX;
    }
  });

  // Shared BufferGeometry for dots + lines (positions differ by Z only)
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions2D, 3));
    return g;
  }, [positions2D]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions2D.slice(), 3));
    g.setIndex(new THREE.BufferAttribute(segments, 1));
    return g;
  }, [positions2D, segments]);

  return (
    <group>
      {/* Lines */}
      <lineSegments ref={linesRef} geometry={lineGeom}>
        <lineBasicMaterial transparent opacity={LINE_OPACITY} />
      </lineSegments>

      {/* Dots */}
      <points ref={pointsRef} geometry={geom} >
        <pointsMaterial
          size={DOT_SIZE}
          sizeAttenuation={false}
          transparent
          opacity={DOT_OPACITY}
          // toneMapped={false}
          color={new THREE.Color(52.0, 5.0, 52.0)}
        />
      </points>
    </group>
  );
}

function UIOverlay() {
  return (
    <Html
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        padding: "8px 12px",
        background: "rgba(0,0,0,0.45)",
        color: "white",
        borderRadius: 12,
        fontFamily: "ui-sans-serif, system-ui",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.9 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Scroll to morph</div>
        <div>
          2D grid → rotate 90° → mountain-like relief (flat center)
        </div>
      </div>
    </Html>
  );
}

export function HomeScene() {
  /**
   * We use an OrthographicCamera so the "front view" feels like a true 2D projection
   * before rotation. Change to <PerspectiveCamera> if you want perspective.
   */
  return (
    <div className="w-full h-[80vh] bg-black/95 rounded-2xl overflow-hidden">
      <Canvas gl={{ antialias: true }} dpr={[1, 2]} style={{ width: '100vw', height: '100vh' }}>
        <color attach="background" args={[0x0, 0x0, 0x0]} />

        {/* Slight rim lighting so lines/dots pop */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 6]} intensity={0.8} />

        {/* <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={50} /> */}

        <Suspense fallback={null}>
          {/* 2 pages of scroll: the morph completes at the end */}
          <ScrollControls pages={2} damping={0.18}>
            <GridRelief />
            <UIOverlay />
            {/* <EffectComposer>
              <Bloom mipmapBlur luminanceThreshold={1} intensity={1.2} radius={0.6} />
            </EffectComposer> */}
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}
