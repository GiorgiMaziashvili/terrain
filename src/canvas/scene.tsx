import { Scroll, ScrollControls, useScroll } from "@react-three/drei";
import { animated as a, to, useSpring as useWebSpring } from "@react-spring/web";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
    BufferAttribute,
    BufferGeometry,
    Color,
    Group,
    MathUtils,
    PointsMaterial,
    Uint16BufferAttribute,
} from "three";
import type { LineMaterial } from "three-stdlib";

const GRID_COLS = 140;
const GRID_ROWS = 140;
const GRID_SIZE = 45;
const DOT_SIZE = 3.015;
const LINE_OPACITY = 0.1;
const DOT_OPACITY = 0.2;

const RELIEF_MAX_HEIGHT = 2;
const RELIEF_FLAT_RADIUS = 2;
const MAX_SPEED = 0.05;
let SPEED = 0;

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

const NOISE_FREQ = 1.0;
const NOISE_SPEED = 0.115;

function cheapNoise(x: number, y: number, p: number = 0) {
    const n1 = Math.sin((x + p) * 3.7) * 0.5 + Math.cos((y - p * 0.8) * 4.1) * 0.35;
    const n2 = Math.sin((x + y + p * 0.6) * 2.3) * 0.25 + Math.sin((Math.hypot(x, y) + p * 0.4) * 3.0) * 0.2;

    const n3 = Math.sin(x * 12.3 + p * 2) * 0.1 + Math.cos(y * 11.7 + p * 1.8) * 0.08;
    const n4 = Math.sin((x + y) * 8.5 + p * 1.2) * 0.06;

    const combined = n1 + n2 + n3 + n4;

    return 0.5 + combined * 0.4;
}

function useGridData() {
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

function GridRelief() {
    const scroll = useScroll();
    const { positions2D, segments, edgeMask, gridHeight, halfH, halfW } = useGridData();

    const groupRef = useRef<Group>(null!);
    const lineRef = useRef<LineMaterial>(null!);
    const pointRef = useRef<PointsMaterial>(null!);

    const positionAttr = useMemo(
        () => new BufferAttribute(positions2D.slice(), 3),
        [positions2D]
    );

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
        const t = MathUtils.clamp(scroll.offset, 0, 1);
        const ease = smoothstep(0, 1, t);

        SPEED = MathUtils.clamp(ease, 0, MAX_SPEED);
        const rotX = -Math.PI * 0.3 * ease;
        const posZ = 1 * ease;

        lineRef.current.opacity = LINE_OPACITY + 0.2 * ease;
        pointRef.current.opacity = DOT_OPACITY + 0.7 * ease;

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

            const nx = (x0 * invW) * NOISE_FREQ + seedRef.current;
            const ny = (y * invH) * NOISE_FREQ;
            const n = cheapNoise(nx, ny, phaseRef.current);

            const curve1 = Math.pow(n, 1.8); // Smoother peaks
            const curve2 = Math.pow(1 - n, 2.2); // Smoother valleys
            const blended = curve1 * 0.7 + (1 - curve2) * 0.3;

            const turbulence = Math.sin(nx * 15.3 + phaseRef.current * 3) * 0.05 +
                Math.cos(ny * 13.7 + phaseRef.current * 2.5) * 0.03;

            const finalHeight = (blended + turbulence) * RELIEF_MAX_HEIGHT * edgeMask[i];

            arr[j] = x0;
            arr[j + 1] = y;
            arr[j + 2] = finalHeight * ease;
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
        }
    });

    return (
        <group ref={groupRef}>

            <lineSegments geometry={lineGeom}>
                <lineBasicMaterial
                    ref={lineRef}
                    transparent
                    opacity={LINE_OPACITY}
                    depthWrite={false}
                />
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


export const Hero = () => {
    const scroll = useScroll();
    // Web (DOM) spring for CSS transforms
    const [{ y, scale, opacity }, api] = useWebSpring(() => ({
        y: 0,
        scale: 1,
        opacity: 1,
        config: { tension: 180, friction: 22 },
    }));

    const [paragraph, pApi] = useWebSpring(() => ({
        y: 0,
        scale: 1,
        opacity: 1,
        config: { tension: 180, friction: 22 },
    }));

    const [mouse, mouseApi] = useWebSpring(() => ({
        opacity: 1,
        config: { tension: 180, friction: 22 },
    }));

    useFrame(() => {
        const tIntro = scroll.range(0 / 3, 1 / 3);     // page 0
        const tMid = scroll.range(1 / 3, 1 / 3);     // page 1

        const easeIntro = MathUtils.smoothstep(0, 1, tIntro);

        api.start({
            y: -220 * easeIntro + 120 * tMid,
            scale: 1 - 0.5 * tIntro,
            opacity: 1 - 1.5 * tIntro,
        });

        pApi.start({
            y: 200 * tIntro,
            scale: 1 - 0.5 * tIntro,
            opacity: 1 - 2 * tIntro,
        });

        mouseApi.start({
            opacity: 0.5 - 10 * tIntro,
        });

    });
    return (
        <a.div
            className="hero"
            style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100vw",
                height: "100dvh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
            }}
        >
            <a.h1 style={{
                position: "relative",
                transform: to([y, scale], (yv, sv) => `translate3d(0, ${yv}px, 0) scale(${sv})`),
                opacity
            }}>Inspiring Digital <br /> Products</a.h1>
            <a.p
                style={{
                    position: "relative",
                    transform: to([paragraph.y, paragraph.scale], (yv, sv) => `translate3d(0, ${yv}px, 0) scale(${sv})`),
                    opacity: paragraph.opacity,
                }}
            >We think design & build</a.p>
            <a.div className="mouse" style={{ opacity: mouse.opacity }}>
                <div className="mouse__dot"></div>
            </a.div>
        </a.div>
    )
}

export const CanvasScene = () => {


    return (
        <Canvas gl={{ antialias: true }} dpr={[1, 2]} style={{ width: "100vw", height: "100vh" }}>
            <color attach="background" args={[0x0, 0x0, 0x0]} />
            <ambientLight intensity={0.5} />
            <fogExp2 attach="fog" args={["#000000", 0.15]} />
            <directionalLight position={[3, 5, 6]} intensity={0.8} />

            <ScrollControls pages={3} damping={0.18}>
                <Scroll html>
                    <Hero />
                </Scroll>
                <GridRelief />
            </ScrollControls>
        </Canvas>
    );
};
