/* eslint-disable react/no-unknown-property -- react-three-fiber maps three.js
   props (position, args, intensity, …) onto JSX intrinsics; these are not DOM
   attributes and the react plugin can't know them. */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Float,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  Sparkles,
  MeshReflectorMaterial,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * The CCG "growth" hero — a 3D composition of rising bars and an ascending arrow,
 * ported from the public website (cookconstructiongrowth.co.uk) so the app opens
 * on the same animated brand moment. Pure presentation; no app data.
 */

const ACCENT = '#ff7a18';
const ACCENT_2 = '#ffa94d';
const STEEL = '#4d90c9';

const BAR_TONES = ['#ff6a00', '#ff9a3d', '#ffc066'];
const FLOOR_Y = -1.72;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- A bold "growth" bar that builds upward with a settle ---------- */
function Bar({ x, height, delay, tone }) {
  const group = useRef(null);
  const W = 0.72;

  useFrame((state) => {
    if (!group.current) return;
    const t = REDUCED
      ? 1
      : easeOutBack(clamp01((state.clock.elapsedTime - delay) / 0.85));
    group.current.scale.y = Math.max(0.0001, t);
  });

  // Scaling the group keeps the bar planted on the floor while it grows up.
  return (
    <group ref={group} position={[x, 0, 0]}>
      <RoundedBox
        args={[W, height, W]}
        radius={0.1}
        smoothness={5}
        position={[0, height / 2, 0]}
      >
        <meshPhysicalMaterial
          color={tone}
          metalness={1}
          roughness={0.14}
          clearcoat={1}
          clearcoatRoughness={0.14}
          iridescence={0.35}
          iridescenceIOR={1.3}
          emissive={tone}
          emissiveIntensity={0.12}
          envMapIntensity={1.4}
        />
      </RoundedBox>
    </group>
  );
}

/* ---------- The rising arrow: draws itself in, then the arrowhead bursts ---------- */
function Arrow({ delay }) {
  const tip = useRef(null);

  const { geometry, headPos, headQuat } = useMemo(() => {
    const pts = [
      new THREE.Vector3(-1.6, 1.2, 0.55),
      new THREE.Vector3(-0.55, 2.3, 0.55),
      new THREE.Vector3(0.55, 1.9, 0.55),
      // End the climb higher and further right so the arrowhead reads as
      // ascending — the brand's "growth" gesture.
      new THREE.Vector3(2.1, 4.15, 0.55),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const geo = new THREE.TubeGeometry(curve, 110, 0.07, 16, false);
    const head = pts[3];
    const dir = head.clone().sub(pts[2]).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );
    return { geometry: geo, headPos: head, headQuat: quat };
  }, []);

  const totalIndex = geometry.index ? geometry.index.count : 0;

  useFrame((state) => {
    const p = REDUCED
      ? 1
      : easeOutCubic(clamp01((state.clock.elapsedTime - delay) / 1.0));
    geometry.setDrawRange(0, Math.floor(totalIndex * p));

    if (tip.current) {
      const show = REDUCED
        ? 1
        : easeOutBack(clamp01((state.clock.elapsedTime - delay - 0.85) / 0.45));
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.6) * 0.06 * clamp01(show);
      tip.current.scale.setScalar(Math.max(0, show) * pulse);
    }
  });

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#ffffff"
          emissive={ACCENT_2}
          emissiveIntensity={2.6}
          metalness={0.4}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      <group ref={tip} position={headPos} quaternion={headQuat} scale={0}>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.2, 0.46, 28]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={ACCENT_2}
            emissiveIntensity={3.2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- The full 3D logo: bars + arrow, gentle sway & mouse parallax ---------- */
function Logo() {
  const root = useRef(null);
  const pointer = useThree((s) => s.pointer);

  useFrame((state) => {
    if (!root.current) return;
    const sway = REDUCED ? 0 : Math.sin(state.clock.elapsedTime * 0.3) * 0.4;
    root.current.rotation.y = THREE.MathUtils.lerp(
      root.current.rotation.y,
      sway + pointer.x * 0.4,
      0.045
    );
    root.current.rotation.x = THREE.MathUtils.lerp(
      root.current.rotation.x,
      -pointer.y * 0.18,
      0.045
    );
  });

  return (
    <Float
      speed={REDUCED ? 0 : 1.1}
      rotationIntensity={REDUCED ? 0 : 0.12}
      floatIntensity={REDUCED ? 0 : 0.55}
    >
      <group ref={root} position={[0, FLOOR_Y, 0]}>
        <Bar x={-1.05} height={1.5} delay={0.15} tone={BAR_TONES[0]} />
        <Bar x={0} height={2.4} delay={0.32} tone={BAR_TONES[1]} />
        <Bar x={1.05} height={3.4} delay={0.5} tone={BAR_TONES[2]} />
        <Arrow delay={0.7} />
      </group>
    </Float>
  );
}

/* ---------- Fit the whole composition into any viewport (esp. mobile portrait) ----------
   The camera stays fixed (so the framing matches desktop); on narrow/portrait
   screens we scale the whole stage down and centre it so the full bars + ascending
   arrow stay in frame, sitting high in the upper area of the panel. */
const CAM_Z = 9.4;
const CAM_FOV = 42;

function Stage({ children }) {
  const size = useThree((s) => s.size);

  const { scale, position } = useMemo(() => {
    const aspect = size.width / size.height;

    // Local bounds of the composition (bars + arrow), measured from its content.
    const halfW = 1.78;
    const halfH = 2.08;
    const cx = 1.04; // horizontal centre of the content
    const cy = 0.36; // vertical centre of the content

    if (aspect >= 1) {
      // Desktop / landscape: original framing, unchanged.
      return { scale: 1, position: [0.7, 0, 0] };
    }

    // Portrait: compute how much of the world is visible at the content plane
    // and scale the stage to fit, with margin, then lift it up.
    const vfov = (CAM_FOV * Math.PI) / 180;
    const visHalfH = Math.tan(vfov / 2) * CAM_Z;
    const visHalfW = visHalfH * aspect;
    const margin = 0.82;
    const scale = Math.min(
      1,
      (visHalfW * margin) / halfW,
      (visHalfH * margin) / halfH
    );

    // Centre the content horizontally on the camera axis and raise it so the
    // arrow reads in the upper-right of the panel.
    const position = [-cx * scale, -cy * scale + 0.7, 0];
    return { scale, position };
  }, [size.width, size.height]);

  return (
    <group scale={scale} position={position}>
      {children}
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#08090b']} />
      <fog attach="fog" args={['#08090b', 10, 24]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 9, 5]} intensity={1.7} color={ACCENT_2} />
      <pointLight position={[-6, 2, 5]} intensity={55} color={ACCENT} distance={26} />
      <pointLight position={[6, -1, 5]} intensity={26} color={STEEL} distance={22} />
      <spotLight position={[0, 9, 4]} angle={0.5} penumbra={1} intensity={42} color={ACCENT_2} />

      {/* Center-stage; on desktop slightly right, on portrait fit-scaled and lifted. */}
      <Stage>
        <Logo />

        {/* Reflective floor for a premium product-shot feel. */}
        <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]}>
          <planeGeometry args={[42, 42]} />
          <MeshReflectorMaterial
            resolution={512}
            blur={[320, 90]}
            mixBlur={1}
            mixStrength={40}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color="#0a0b0d"
            metalness={0.65}
            roughness={0.85}
            mirror={0.45}
          />
        </mesh>

        <ContactShadows
          position={[0, FLOOR_Y + 0.01, 0]}
          opacity={0.4}
          scale={18}
          blur={3}
          far={7}
          color="#000000"
        />
      </Stage>

      <Sparkles
        count={80}
        scale={[16, 9, 7]}
        size={2.6}
        speed={REDUCED ? 0 : 0.3}
        color={ACCENT_2}
        opacity={0.5}
      />

      {/* Studio reflections built from in-scene light planes — no external HDRI fetch. */}
      <Environment resolution={256}>
        <Lightformer intensity={2.6} position={[0, 5, 3]} scale={[10, 3, 1]} color={ACCENT_2} />
        <Lightformer intensity={1.6} position={[-7, 1, 1]} scale={[3, 8, 1]} color={ACCENT} />
        <Lightformer intensity={1.3} position={[7, -1, 1]} scale={[3, 8, 1]} color={STEEL} />
        <Lightformer intensity={1.8} position={[0, -5, 2]} scale={[14, 2, 1]} color="#ffffff" />
      </Environment>

      <EffectComposer>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <Vignette offset={0.26} darkness={0.85} />
      </EffectComposer>
    </>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.9, 9.4], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene />
    </Canvas>
  );
}
