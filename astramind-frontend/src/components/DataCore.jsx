import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Environment, Float, Preload } from '@react-three/drei';
import * as THREE from 'three';

const Core = () => {
  const meshRef = useRef();

  useFrame((state, delta) => {
    // Subtle rotation to make it feel alive
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
          color="#000000" 
          emissive="#00b4d8"
          emissiveIntensity={0.2}
          envMapIntensity={2.5} 
          clearcoat={1} 
          clearcoatRoughness={0.1} 
          metalness={1} 
          roughness={0}
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
            <mesh position={[x, y, 0]} rotation={[Math.random(), Math.random(), 0]}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshPhysicalMaterial 
                color="#b054ff" // Purple glow
                transmission={0.9}
                opacity={1}
                metalness={0.8}
                roughness={0}
                ior={1.5}
                thickness={0.5}
                emissive="#b054ff"
                emissiveIntensity={0.5}
                transparent
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
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0A84FF" />
      
      {/* We use an abstract glowing environment */}
      <Environment preset="studio" />
      
      <Core />
      <OrbitingMonoliths />
      <Preload all />
    </>
  );
}
