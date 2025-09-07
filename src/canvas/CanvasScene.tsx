import { Canvas } from "@react-three/fiber";
import { Scroll, ScrollControls } from "@react-three/drei";
import { GridRelief } from "./components/GridRelief";
import { Hero } from "./ui/Hero";

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

