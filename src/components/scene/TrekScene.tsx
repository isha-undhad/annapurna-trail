'use client';

import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Mountains } from './Mountains';
import { InstancedTrees } from './InstancedTrees';
import { InstancedGrass } from './InstancedGrass';
import { InstancedRocks } from './InstancedRocks';
import { Cairns } from './Cairns';
import { PlayerController } from './PlayerController';
import { PostProcessing } from './PostProcessing';
import { useTrekStore } from '@/store/useTrekStore';

export function TrekScene() {
  const quality = useTrekStore((s) => s.quality);
  const [dpr, setDpr] = useState(quality === 'high' ? 1.5 : quality === 'medium' ? 1.2 : 0.9);

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ fov: 65, near: 0.1, far: 1400, position: [0, 3.5, 75] }}
      dpr={dpr}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.22,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = quality !== 'low';
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      {/* Dynamic performance monitor adapts pixel ratio if frames drop */}
      <PerformanceMonitor
        onIncline={() => setDpr((prev) => Math.min(2.0, prev + 0.15))}
        onDecline={() => setDpr((prev) => Math.max(0.75, prev - 0.2))}
      />

      {/* Atmospheric distance haze fog matching sky horizon */}
      <fog attach="fog" args={['#cce1f4', 180, 1100]} />

      {/* Soft directional morning sun illuminating the valley and south mountain faces */}
      <directionalLight
        position={[75, 115, 90]}
        intensity={2.8}
        color="#fff6e0"
        castShadow={quality !== 'low'}
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={10}
        shadow-camera-far={340}
        shadow-bias={-0.0001}
      />

      {/* Himalayan sky and alpine ground fill bounce */}
      <ambientLight color="#cfe6ff" intensity={0.9} />
      <hemisphereLight color="#dff2ff" groundColor="#6d925e" intensity={0.75} />

      {/* Suspended PBR assets & 360° HDR Environment */}
      <Suspense fallback={null}>
        <Environment files="/hdri/sky.hdr" background environmentIntensity={1.3} />
        <Terrain />
        <Mountains />
        <InstancedTrees />
        <InstancedGrass />
        <InstancedRocks />
        <Cairns />
      </Suspense>

      {/* First-person player controller */}
      <PlayerController />

      {/* Post-processing effects (Bloom, Vignette, SSAO) */}
      <PostProcessing />
    </Canvas>
  );
}
