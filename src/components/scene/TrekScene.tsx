'use client';

import React, { Suspense, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Mountains } from './Mountains';
import { InstancedTrees } from './InstancedTrees';
import { InstancedGrass } from './InstancedGrass';
import { InstancedRocks } from './InstancedRocks';
import { Cairns } from './Cairns';
import { Signposts } from './Signposts';
import { Trekker } from './Trekker';
import { PlayerController } from './PlayerController';
import { PostProcessing } from './PostProcessing';
import { DevStatsCollector } from './DevStatsOverlay';
import { useTrekStore } from '@/store/useTrekStore';

/**
 * Directional sunlight with localized shadow camera box around the player (Requirement 2d).
 * Frustum is 110 units wide (within 80-120 units requirement).
 * Updates only when player has moved a few meters (> 3.5m) to eliminate per-frame shadow matrix churn.
 */
function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const quality = useTrekStore((s) => s.quality);
  const devToggles = useTrekStore((s) => s.devToggles);
  const playerPos = useTrekStore((s) => s.playerPos);
  const lastPos = useRef({ x: 99999, z: 99999 });

  useFrame(() => {
    if (!lightRef.current) return;
    const px = playerPos[0];
    const py = playerPos[1];
    const pz = playerPos[2];

    const dist = Math.hypot(px - lastPos.current.x, pz - lastPos.current.z);
    if (dist > 3.5) {
      lastPos.current = { x: px, z: pz };
      lightRef.current.position.set(px + 65, py + 105, pz + 75);
      lightRef.current.target.position.set(px, py, pz);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  const isShadowEnabled = quality !== 'low' && devToggles.shadows;
  const shadowMapSize = quality === 'high' ? 2048 : 1024;

  return (
    <directionalLight
      ref={lightRef}
      position={[75, 115, 90]}
      intensity={2.7}
      color="#fff6e0"
      castShadow={isShadowEnabled}
      shadow-mapSize={shadowMapSize}
      shadow-camera-left={-55}
      shadow-camera-right={55}
      shadow-camera-top={55}
      shadow-camera-bottom={-55}
      shadow-camera-near={15}
      shadow-camera-far={260}
      shadow-bias={-0.00015}
    />
  );
}

export function TrekScene() {
  const quality = useTrekStore((s) => s.quality);
  const devToggles = useTrekStore((s) => s.devToggles);

  // Renderer DPR cap (Requirement 2f: 1.5 on High, 1.0 on Medium, 0.75 on Low)
  const maxDpr = quality === 'high' ? 1.5 : quality === 'medium' ? 1.0 : 0.75;
  const [dpr, setDpr] = useState(maxDpr);

  // Sync DPR when quality changes
  React.useEffect(() => {
    setDpr(maxDpr);
  }, [maxDpr]);

  return (
    <Canvas
      shadows={quality !== 'low' && devToggles.shadows ? { type: THREE.PCFShadowMap } : false}
      camera={{ fov: 62, near: 0.2, far: 8000, position: [0, 210, 0] }}
      dpr={dpr}
      gl={{
        antialias: quality === 'high',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.20,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = quality !== 'low' && devToggles.shadows;
        if (gl.shadowMap.enabled) {
          gl.shadowMap.type = THREE.PCFShadowMap;
        }
      }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      {/* Drei stats & WebGL info collector */}
      <DevStatsCollector />

      {/* Dynamic performance monitor adapts pixel ratio if frames drop */}
      <PerformanceMonitor
        onIncline={() => setDpr((prev) => Math.min(maxDpr, prev + 0.1))}
        onDecline={() => setDpr((prev) => Math.max(0.65, prev - 0.15))}
      />

      {/* Atmospheric distance haze fog matching sky horizon (#cce1f4) */}
      <fog attach="fog" args={['#cce1f4', 350, 7500]} />

      {/* Optimized directional sun with localized box and movement threshold */}
      <SunLight />

      {/* Himalayan sky and alpine ground fill bounce */}
      <ambientLight color="#cfe6ff" intensity={0.9} />
      <hemisphereLight color="#dff2ff" groundColor="#6d925e" intensity={0.75} />

      {/* Suspended PBR assets & 360° HDR Environment */}
      <Suspense fallback={null}>
        <Environment files="/hdri/sky.hdr" background environmentIntensity={1.3} />
        {devToggles.terrain && <Terrain />}
        {devToggles.mountains && <Mountains />}
        {devToggles.trees && <InstancedTrees />}
        {devToggles.grass && <InstancedGrass />}
        {devToggles.rocks && <InstancedRocks />}
        <Cairns />
        <Signposts />
      </Suspense>

      {/* Visible Himalayan Trekker Character (Visible in 3rd-person, Wide, Orbit) */}
      <Trekker />

      {/* Multi-mode player and camera controller */}
      <PlayerController />

      {/* Post-processing effects (Reduced resolution Bloom on High only, Requirement 2e) */}
      {devToggles.postprocessing && <PostProcessing />}
    </Canvas>
  );
}
