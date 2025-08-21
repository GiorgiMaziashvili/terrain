// npm i gsap @react-three/fiber @react-three/drei
// (if using Next.js, run this only on the client)

import React, { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function DayNightRig() {
  const skyRef = useRef<any>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const dirRef = useRef<THREE.DirectionalLight>(null!);

  // “Proxy” values GSAP animates (no React re-renders needed)
  const state = useRef({
    sunX: -2,     // start: sun low and left (night-ish)
    sunY: -1.5,   // below horizon -> dark
    sunZ: 2,
    turbidity: 12,
    rayleigh: 0.2,
    mieC: 0.02,
    mieG: 0.95,
    ambient: 0.1,
    dirI: 0.25
  });

  useEffect(() => {
    // Build a scrubbed timeline (night -> golden hour -> daylight)
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#sunset-section",
        start: "top top",
        end: "+=2000",   // length of the effect; tweak as you like
        scrub: 1,
        pin: true
      }
    });

    tl.to(state.current, {
      // climb to horizon (sunrise)
      sunY: 0.0,
      turbidity: 8,
      rayleigh: 1.2,
      mieC: 0.01,
      mieG: 0.9,
      ambient: 0.35,
      dirI: 0.8,
      ease: "none",
      duration: 0.45
    }).to(state.current, {
      // up to “late morning”
      sunX: 3,
      sunY: 4.5,
      sunZ: 4,
      turbidity: 4,
      rayleigh: 3,
      mieC: 0.005,
      mieG: 0.8,
      ambient: 0.7,
      dirI: 1.5,
      ease: "ease",
      duration: 0.55
    });

    return () => tl.scrollTrigger?.kill();
  }, []);

  // Push proxy values into Sky uniforms/lights each frame
  useFrame(() => {
    const s = state.current;
    if (skyRef.current?.material?.uniforms) {
      const u = skyRef.current.material.uniforms;
      u.turbidity.value = s.turbidity;
      u.rayleigh.value = s.rayleigh;
      u.mieCoefficient.value = s.mieC;
      u.mieDirectionalG.value = s.mieG;
      u.sunPosition.value.set(s.sunX, s.sunY, s.sunZ);
    }
    if (ambientRef.current) ambientRef.current.intensity = s.ambient;
    if (dirRef.current) {
      dirRef.current.intensity = s.dirI;
      dirRef.current.position.set(5, 5, 5);
      dirRef.current.target.position.set(0, 0, 0);
      dirRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <Sky
        // distance should be big & positive
        distance={4500}
        ref={skyRef}
        // initial props; they’ll be overridden by uniforms on each frame
        sunPosition={[-2, -1.5, 2]}
        turbidity={12}
        rayleigh={0.2}
        mieCoefficient={0.02}
        mieDirectionalG={0.95}
      />
      <ambientLight ref={ambientRef} intensity={0.1} />
      <directionalLight ref={dirRef} intensity={0.25} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#6db36d" />
      </mesh>
      <OrbitControls />
    </>
  );
}

export function HomeScene() {
  return (
    <div id="sunset-section" style={{ height: "100vh", position: "relative" }}>
      <Canvas
        camera={{ position: [10, 10, 20], fov: 50 }}
        shadows
        style={{ width: "100vw", height: "100vh", position: "sticky", top: 0 }}
        gl={{ antialias: true }}
      >
        <DayNightRig />
      </Canvas>

      {/* Optional copy over the pinned canvas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "end center",
          padding: "24px",
          pointerEvents: "none",
          fontFamily: "system-ui",
          fontSize: 14,
          opacity: 0.75
        }}
      >
        <p>Scroll to move from night → sunrise → day</p>
      </div>
    </div>
  );
}
