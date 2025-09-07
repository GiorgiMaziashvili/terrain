import { useScroll } from "@react-three/drei";
import { animated as a, to, useSpring as useWebSpring } from "@react-spring/web";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";

export const Hero = () => {
  const scroll = useScroll();
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
    const tIntro = scroll.range(0 / 3, 1 / 3);
    const tMid = scroll.range(1 / 3, 1 / 3);

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
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <a.h1
        style={{
          position: "relative",
          transform: to([y, scale], (yv, sv) => `translate3d(0, ${yv}px, 0) scale(${sv})`),
          opacity,
        }}
      >
        Inspiring Digital <br /> Products
      </a.h1>
      <a.p
        style={{
          position: "relative",
          transform: to([paragraph.y, paragraph.scale], (yv, sv) => `translate3d(0, ${yv}px, 0) scale(${sv})`),
          opacity: paragraph.opacity,
        }}
      >
        We think design & build
      </a.p>
      <a.div className="mouse" style={{ opacity: mouse.opacity }}>
        <div className="mouse__dot"></div>
      </a.div>
    </a.div>
  );
};
