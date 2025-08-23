import { OrbitControls, ScrollControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferGeometry, BufferAttribute, LineSegments, Points } from "three";

function generateGridPoints(gridSize = 8, squareSize = 4) {
    const points = [];
    const totalSize = gridSize * squareSize;
    const halfSize = totalSize / 2;

    // Horizontal lines
    for (let i = 0; i <= gridSize; i++) {
        const y = i * squareSize - halfSize;
        points.push(
            -halfSize, y, 0,  // Start point (left)
            halfSize, y, 0    // End point (right)
        );
    }

    // Vertical lines
    for (let i = 0; i <= gridSize; i++) {
        const x = i * squareSize - halfSize;
        points.push(
            x, -halfSize, 0,  // Start point (bottom)
            x, halfSize, 0    // End point (top)
        );
    }

    return points;
}

function AnimatedLineSegments({ gridSize = 8, squareSize = 4 }) {
    const meshRef = useRef<LineSegments>(null!);
    const geometryRef = useRef<BufferGeometry>(null!);

    const initialPoints = useMemo(() => {
        return generateGridPoints(gridSize, squareSize);
    }, [gridSize, squareSize]);

    const geometry = useMemo(() => {
        const geom = new BufferGeometry();
        const points = new Float32Array(initialPoints);
        geom.setAttribute('position', new BufferAttribute(points, 3));
        geometryRef.current = geom;
        return geom;
    }, [initialPoints]);

    useFrame(({ clock }) => {
        if (!geometryRef.current) return;

        const time = clock.getElapsedTime();
        const speed = 5; // Much faster for debugging
        const totalSize = gridSize * squareSize;
        const halfSize = totalSize / 2;

        // Create animated offset
        const offsetY = (time * speed * squareSize) % squareSize;
        const offsetX = (time * speed * squareSize * 0.7) % squareSize; // Different speed for X

        const points = [];

        // Animated horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            let y = i * squareSize - halfSize - offsetY;

            // Wrap around when line goes below bottom
            if (y < -halfSize) {
                y += totalSize;
            }

            points.push(
                -halfSize, y, 0,  // Start point (left)
                halfSize, y, 0    // End point (right)
            );
        }

        // Animated vertical lines  
        for (let i = 0; i <= gridSize; i++) {
            let x = i * squareSize - halfSize - offsetX;

            // Wrap around when line goes past left edge
            if (x < -halfSize) {
                x += totalSize;
            }

            points.push(
                x, -halfSize, 0,  // Start point (bottom)
                x, halfSize, 0    // End point (top)
            );
        }

        // Update geometry
        const positionAttribute = geometryRef.current.getAttribute('position');

        // Update each point using setXYZ
        for (let i = 0; i < points.length / 3; i++) {
            positionAttribute.setXYZ(
                i,
                points[i * 3],
                points[i * 3 + 1],
                points[i * 3 + 2]
            );
        }

        positionAttribute.needsUpdate = true;
    });

    return (
        <lineSegments ref={meshRef} geometry={geometry}>
            <lineBasicMaterial color="#00ff88" linewidth={1} />
        </lineSegments>
    );
}

function AnimatedPoints({ gridSize = 8, squareSize = 4 }) {
    const meshRef = useRef<Points>(null!);
    const geometryRef = useRef<BufferGeometry>(null!);

    const geometry = useMemo(() => {
        const geom = new BufferGeometry();
        // Create initial points at grid intersections
        const points = [];
        const totalSize = gridSize * squareSize;
        const halfSize = totalSize / 2;

        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                const x = i * squareSize - halfSize;
                const y = j * squareSize - halfSize;
                points.push(x, y, 0);
            }
        }

        const positions = new Float32Array(points);
        geom.setAttribute('position', new BufferAttribute(positions, 3));
        geometryRef.current = geom;
        return geom;
    }, [gridSize, squareSize]);

    useFrame(({ clock }) => {
        if (!geometryRef.current) return;

        const time = clock.getElapsedTime();
        const speed = 0.5;
        const totalSize = gridSize * squareSize;
        const halfSize = totalSize / 2;

        const offsetY = (time * speed * squareSize) % squareSize;
        const offsetX = (time * speed * squareSize * 0.7) % squareSize;

        const points = [];

        // Create animated grid intersection points
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                let x = i * squareSize - halfSize - offsetX;
                let y = j * squareSize - halfSize - offsetY;

                // Wrap around
                if (x < -halfSize) x += totalSize;
                if (y < -halfSize) y += totalSize;

                points.push(x, y, 0);
            }
        }

        const positionAttribute = geometryRef.current.getAttribute('position');
        positionAttribute.array.set(points);
        positionAttribute.needsUpdate = true;
    });

    return (
        <points ref={meshRef} geometry={geometry}>
            <pointsMaterial color="#4444ff" size={0.3} sizeAttenuation={false} />
        </points>
    );
}

export const CanvasScene = () => {
    return (
        <div className="w-full h-screen bg-black">
            {/* Info overlay */}
            <Canvas
                gl={{ antialias: true }}
                dpr={[1, 2]}
                camera={{ position: [20, 20, 20], fov: 60 }}
                style={{ width: "100vw", height: "100vh" }}
            >
                <color attach="background" args={[0x0, 0x0, 0x0]} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[3, 5, 6]} intensity={0.8} />

                <ScrollControls pages={3} damping={0.18}>
                    <AnimatedLineSegments gridSize={8} squareSize={4} />
                    <AnimatedPoints gridSize={8} squareSize={4} />
                </ScrollControls>

                <OrbitControls />
            </Canvas>
        </div>
    );
};