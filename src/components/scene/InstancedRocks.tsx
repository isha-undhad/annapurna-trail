'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';

function createSeededRandom(seed = 11223) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function InstancedRocks() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const quality = useTrekStore((s) => s.quality);

  const rockTextures = useTexture({
    map: '/textures/rock/color.jpg',
    normalMap: '/textures/rock/normal.jpg',
    roughnessMap: '/textures/rock/roughness.jpg',
  });

  useLayoutEffect(() => {
    Object.values(rockTextures).forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
    });
    rockTextures.map.colorSpace = THREE.SRGBColorSpace;
  }, [rockTextures]);

  const rockGeometry = useMemo(() => {
    // Detailed faceted alpine boulder with natural vertex displacement
    const geo = new THREE.DodecahedronGeometry(1.0, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const d = Math.sin(x * 3.5) * Math.cos(y * 3.0) * Math.sin(z * 3.5) * 0.18;
      x *= 1.0 + d;
      y *= 0.8 + d; // Flatter profile
      z *= 1.05 + d;

      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const rockMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: rockTextures.map,
      normalMap: rockTextures.normalMap,
      roughnessMap: rockTextures.roughnessMap,
      roughness: 0.72,
      metalness: 0.02,
    });
  }, [rockTextures]);

  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(9911);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const maxCandidates = quality === 'high' ? 360 : quality === 'medium' ? 240 : 140;

    for (let i = 0; i < maxCandidates; i++) {
      const x = (random() - 0.5) * 200;
      const z = 75 - random() * 320; // from trailhead down to -245

      const distToPath = getDistanceToPath(x, z);
      // Keep center of trail clear
      if (distToPath < 2.5) continue;

      // Filter out steep cliff slopes to prevent hovering boulders
      const slope = getTerrainSlope(x, z);
      if (slope > 0.35) continue;

      // Favor rocks bordering the dirt trail (2.5 to 8.0)
      const isTrailBorder = distToPath >= 2.5 && distToPath <= 7.5;
      if (!isTrailBorder && random() > 0.45) continue;

      const y = getTerrainHeight(x, z);
      const scaleBase = isTrailBorder ? 0.4 + random() * 0.5 : 0.6 + random() * 0.9;

      // Sink boulder firmly into terrain so base is embedded with no hovering
      position.set(x, y - scaleBase * 0.15, z);
      rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI);
      quaternion.setFromEuler(rotation);

      scale.set(
        scaleBase * (0.8 + random() * 0.4),
        scaleBase * (0.6 + random() * 0.4),
        scaleBase * (0.8 + random() * 0.4)
      );

      tempMatrix.compose(position, quaternion, scale);
      transforms.push(tempMatrix.clone());
    }

    return { count: transforms.length, matrices: transforms };
  }, [quality]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((mat, idx) => {
      meshRef.current.setMatrixAt(idx, mat);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[rockGeometry, rockMaterial, count]}
      castShadow={quality !== 'low'}
      receiveShadow
    />
  );
}
