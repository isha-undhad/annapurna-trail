'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WAYPOINTS, getTerrainHeight } from '@/lib/terrain';

function createSignTexture(name: string, elevation: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Weathered wooden board background
  ctx.fillStyle = '#4a3321';
  ctx.fillRect(0, 0, 512, 160);

  // Border
  ctx.strokeStyle = '#c8a265';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);

  // Text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(name.toUpperCase(), 256, 68);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '28px monospace';
  ctx.fillText(`ALT: ${elevation}m`, 256, 120);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function Signposts() {
  const signpostData = useMemo(() => {
    return WAYPOINTS.map((wp) => {
      const x = wp.gameX + 1.8;
      const z = wp.gameZ;
      const y = getTerrainHeight(x, z);
      return {
        name: wp.name,
        elevation: wp.elevation,
        position: [x, y, z] as [number, number, number],
      };
    });
  }, []);

  return (
    <group>
      {signpostData.map((sign, idx) => (
        <SingleSignpost key={idx} name={sign.name} elevation={sign.elevation} position={sign.position} />
      ))}
    </group>
  );
}

function SingleSignpost({
  name,
  elevation,
  position,
}: {
  name: string;
  elevation: number;
  position: [number, number, number];
}) {
  const signTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return createSignTexture(name, elevation);
  }, [name, elevation]);

  return (
    <group position={position}>
      {/* Wooden Post */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 6]} />
        <meshStandardMaterial color="#543d2b" roughness={0.88} />
      </mesh>

      {/* Sign Board */}
      <mesh position={[0, 1.85, 0]} rotation={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.3, 0.42, 0.08]} />
        <meshStandardMaterial
          color="#ffffff"
          map={signTexture || undefined}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}
