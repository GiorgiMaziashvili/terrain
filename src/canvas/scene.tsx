import { ScrollControls, useScroll } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, Color, Group, LineSegments, MathUtils, Points } from "three"

const GRID_COLS = 140;
const GRID_ROWS = 140;
const GRID_SIZE = 40;
const DOT_SIZE = 2.015;
const LINE_OPACITY = 0.05;
const DOT_OPACITY = 1;

const RELIEF_MAX_HEIGHT = 1.8; // peak height when fully morphed
const RELIEF_FLAT_RADIUS = 2; // radius (0..~0.7) that stays flat in the middle
const MAX_SPEED = 0.05;
let SPEED = 0;

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
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
    return MathUtils.clamp(0.5 + n * 0.5, 0, 1);
}

function useGridData() {
    const count = GRID_COLS * GRID_ROWS;
    const positions2D = new Float32Array(count * 3) // ??
    const heights = new Float32Array(count); // ??
    const halfW = GRID_SIZE / 2; // ??
    const halfH = (GRID_SIZE * (GRID_ROWS / GRID_COLS)) / 2; // ??
    const gridHeight = halfH * 2;

    let ptr = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
        const v = r / (GRID_ROWS - 1); // 0..1
        for (let c = 0; c < GRID_COLS; c++) {
            const u = c / (GRID_COLS - 1); // 0..1

            // map u,v to world X/Y with aspect compensation
            const x = MathUtils.lerp(-halfW, halfW, u);
            const y = MathUtils.lerp(-halfH, halfH, v);

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

    const segments: number[] = [];
    const idx = (rr: number, cc: number) => rr * GRID_COLS + cc // ??

    for (let rr = 0; rr < GRID_ROWS; rr++) {
        for (let cc = 0; cc < GRID_COLS; cc++) {
            if (cc < GRID_COLS - 1) {
                segments.push(idx(rr, cc), idx(rr, cc + 1)); // ??
            }
            if (rr < GRID_ROWS - 1) {
                segments.push(idx(rr, cc), idx(rr + 1, cc)); // ??
            }
        }
    }
    return {
        positions2D,
        segments: new Uint32Array(segments), // ??
        heights,
        gridHeight,
        halfH,
    }
}

function GridRelief() {
    const scroll = useScroll();
    const { positions2D, segments, heights, gridHeight, halfH } = useGridData();
    const pointsRef = useRef<Points>(null!);
    const linesRef = useRef<LineSegments>(null!);
    const groupRef = useRef<Group>(null!);

    const basePositions = useMemo(() => positions2D.slice(), [positions2D]);

    const geom = useMemo(() => {
        const g = new BufferGeometry() // ??
        g.setAttribute("position", new BufferAttribute(positions2D, 3)) // ??
        return g
    }, [positions2D])

    const lineGeom = useMemo(() => {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(positions2D.slice(), 3));
        g.setIndex(new BufferAttribute(segments, 1))
        return g;
    }, [positions2D, segments])

    const workingPositions = useMemo(() => positions2D.slice(), [positions2D]);
    const yOffsetRef = useRef(0);

    useFrame((_, delta) => {
        const t = MathUtils.clamp(scroll.offset, 0, 1);

        const ease = smoothstep(0, 1, t);
        SPEED = MathUtils.clamp(ease, 0, MAX_SPEED);
        const rotX = -Math.PI * 0.3 * ease;
        const posZ = 1 * ease

        yOffsetRef.current += SPEED * delta * gridHeight;
        if (yOffsetRef.current >= gridHeight) yOffsetRef.current -= gridHeight;
        if (yOffsetRef.current < 0) yOffsetRef.current += gridHeight;

        for (let i = 0, j = 0; i < heights.length; i++, j += 3) {
            const x0 = basePositions[j];
            const y0 = basePositions[j + 1];

            // shift
            let y = y0 - yOffsetRef.current;

            // wrap into [-halfH, halfH]
            // (fast wrap without modulo)
            if (y > halfH) y -= gridHeight;
            else if (y < -halfH) y += gridHeight;

            workingPositions[j] = x0;
            workingPositions[j + 1] = y;
            workingPositions[j + 2] = heights[i] * ease; // your relief morph
        }
        if (groupRef.current) {
            groupRef.current.rotation.x = rotX;
            groupRef.current.position.z = posZ;
        }
        if (pointsRef.current) {
            const g = pointsRef.current.geometry as BufferGeometry & {
                attributes: { position: BufferAttribute };
            };
            (g.attributes.position.array as Float32Array).set(workingPositions);
            g.attributes.position.needsUpdate = true;
        }

        if (linesRef.current) {
            const g = linesRef.current.geometry as BufferGeometry & {
                attributes: { position: BufferAttribute };
            };
            (g.attributes.position.array as Float32Array).set(workingPositions);
            g.attributes.position.needsUpdate = true;


        }
    });

    return (
        <group ref={groupRef}>
            <lineSegments ref={linesRef} geometry={lineGeom}>
                <lineBasicMaterial transparent opacity={LINE_OPACITY} />
            </lineSegments>
            <points ref={pointsRef} geometry={geom}>
                <pointsMaterial
                    size={DOT_SIZE}
                    sizeAttenuation={false}
                    transparent
                    opacity={DOT_OPACITY}
                    toneMapped={false}
                    color={new Color(52.0, 5.0, 52.0)}
                />
            </points>
        </group>
    )
}


export const CanvasScene = () => {
    return (
        <Canvas
            gl={{ antialias: true }}
            dpr={[1, 2]}
            style={{ width: '100vw', height: '100vh' }}
        >
            <color attach="background" args={[0x0, 0x0, 0x0]} />
            <ambientLight intensity={0.5} />
            <fogExp2 attach="fog" args={['#000000', 0.15]} />
            <directionalLight position={[3, 5, 6]} intensity={0.8} />

            <ScrollControls pages={3} damping={0.18}>
                <GridRelief />
            </ScrollControls>
        </Canvas>
    )
}