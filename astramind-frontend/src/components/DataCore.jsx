import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Environment, Float, Preload } from '@react-three/drei';

const Core = () => {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
      meshRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={1}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[1.5, 128, 128]} />
        <MeshDistortMaterial
          color="#0a1628"
          emissive="#00b4d8"
          emissiveIntensity={0.8}
          envMapIntensity={1.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.6}
          roughness={0.1}
          distort={0.4}
          speed={2}
        />
      </mesh>
    </Float>
  );
};

const OrbitingMonoliths = () => {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z -= delta * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {[...Array(6)].map((_, i) => {
        const radius = 3;
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <Float key={i} speed={1.5} rotationIntensity={2} floatIntensity={0.5}>
            <mesh position={[x, y, 0]} rotation={[i * 0.5, i * 0.3, 0]}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshPhysicalMaterial
                color="#b054ff"
                transmission={0.9}
                metalness={0.8}
                roughness={0}
                ior={1.5}
                thickness={0.5}
                emissive="#b054ff"
                emissiveIntensity={0.8}
                transparent
                opacity={1}
              />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
};

export default function DataCore() {
  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 10, 5]} intensity={2} />
      <pointLight position={[-5, -5, -5]} intensity={1.5} color="#0A84FF" />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#b054ff" />
      <Environment preset="studio" background={false} />
      <Core />
      <OrbitingMonoliths />
      <Preload all />
    </>
  );
}
