'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getTerrainHeight, getPathX } from '@/lib/terrain';

interface CairnInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
}

export function Cairns() {
  // Checkpoint cairns placed along the trail edge every 40-50 meters
  const cairnLocations = useMemo(() => {
    const list: CairnInstance[] = [];
    const zMilestones = [60, 20, -25, -75, -125, -175, -210];

    zMilestones.forEach((z, i) => {
      const pathX = getPathX(z);
      // Offset slightly to the left or right of the path
      const sideOffset = (i % 2 === 0 ? 1 : -1) * 2.6;
      const x = pathX + sideOffset;
      const y = getTerrainHeight(x, z);
      list.push({ x, y, z, scale: 0.9 + (i % 3) * 0.15 });
    });

    return list;
  }, []);

  return (
    <group>
      {cairnLocations.map((c, idx) => (
        <group key={idx} position={[c.x, c.y, c.z]} scale={c.scale}>
          {/* Base stone */}
          <mesh position={[0, 0.12, 0]} castShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color="#727d88" roughness={0.72} flatShading />
          </mesh>
          {/* Second stone */}
          <mesh position={[0.02, 0.42, 0.01]} castShadow>
            <dodecahedronGeometry args={[0.33, 0]} />
            <meshStandardMaterial color="#86929e" roughness={0.72} flatShading />
          </mesh>
          {/* Third stone */}
          <mesh position={[-0.01, 0.68, 0.02]} castShadow>
            <dodecahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial color="#9ba7b4" roughness={0.72} flatShading />
          </mesh>
          {/* Top balance stone */}
          <mesh position={[0.01, 0.88, -0.01]} castShadow>
            <dodecahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#b0bcc8" roughness={0.72} flatShading />
          </mesh>
          {/* Wooden prayer marker pole */}
          <mesh position={[0.3, 0.8, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 1.8, 4]} />
            <meshStandardMaterial color="#6a4c33" roughness={0.75} />
          </mesh>
          {/* Small prayer flag banner */}
          <mesh position={[0.45, 1.4, 0]} rotation={[0, 0.2, 0.1]}>
            <planeGeometry args={[0.35, 0.22]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? '#d93829' : '#2b6cb0'}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
