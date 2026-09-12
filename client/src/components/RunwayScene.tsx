import { Component, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import type { Group } from 'three';
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="scene-fallback" /> : this.props.children;
  }
}
function Platform({ x, index, reduced }: { x: number; index: number; reduced: boolean }) {
  const platform = useRef<Group>(null);
  const started = useRef<number | null>(null);
  const height = [1.15, 1.95, 0.75][index];
  useFrame(({ clock }) => {
    if (!platform.current || reduced) return;
    started.current ??= clock.elapsedTime;
    const progress = Math.max(
      0,
      Math.min(1, (clock.elapsedTime - started.current - [1, 1.7, 0.5][index]) / 0.9),
    );
    platform.current.scale.y = Math.max(0.01, 1 - Math.pow(1 - progress, 3));
  });
  return (
    <group ref={platform} position={[x, 0, 0]} scale={[1, reduced ? 1 : 0.01, 1]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[1.8, height, 1.8]} />
        <meshStandardMaterial
          color={index === 1 ? '#716047' : '#214f4b'}
          metalness={0.75}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, height + 0.015, 0]}>
        <boxGeometry args={[1.84, 0.035, 1.84]} />
        <meshBasicMaterial color={index === 1 ? '#f4d29a' : '#9dffe0'} />
      </mesh>
    </group>
  );
}
function Geometry({ podium, reduced }: { podium: boolean; reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current && !reduced)
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.08;
  });
  return (
    <group ref={group}>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 5, 3]} intensity={40} color={podium ? '#f5d39a' : '#a1ffe2'} />
      <pointLight position={[-4, 2, -2]} intensity={25} color="#589eff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#0b161a" roughness={0.4} metalness={0.8} />
      </mesh>
      <gridHelper args={[18, 18, '#245348', '#142629']} position={[0, 0, 0]} />
      {podium ? (
        [-2.15, 0, 2.15].map((x, i) => <Platform key={i} x={x} index={i} reduced={reduced} />)
      ) : (
        <Float speed={reduced ? 0 : 1} rotationIntensity={0.15} floatIntensity={0.3}>
          <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
            <octahedronGeometry args={[1.1, 0]} />
            <meshStandardMaterial color="#83dbc1" metalness={0.85} roughness={0.2} wireframe />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.015, 8, 64]} />
            <meshBasicMaterial color="#83dbc1" />
          </mesh>
        </Float>
      )}
      {!reduced && (
        <Sparkles
          count={podium ? 50 : 20}
          scale={[8, 4, 5]}
          size={2}
          speed={0.15}
          color={podium ? '#edd6b0' : '#aeffdc'}
          position={[0, 2, 0]}
        />
      )}
    </group>
  );
}
export default function RunwayScene({ podium = false }: { podium?: boolean }) {
  const reduced = !!useReducedMotion();
  return (
    <SceneBoundary>
      <Canvas
        dpr={[1, 1.35]}
        camera={{ position: [0, 4, 8], fov: 40 }}
        frameloop={reduced ? 'demand' : 'always'}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        aria-hidden="true"
      >
        <Geometry podium={podium} reduced={reduced} />
      </Canvas>
    </SceneBoundary>
  );
}
