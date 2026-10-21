'use client';

import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
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
  const playerPos = useTrekStore((s) => s.playerPos);

  // Load the CC0 Poly Haven photogrammetric rock model
  const { scene } = useGLTF('/models/rock_07/rock_07_1k.gltf');

  // Extract geometry and PBR material from loaded GLTF
  const { rockGeometry, rockMaterial } = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.Material | null = null;

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !geo) {
        const mesh = child as THREE.Mesh;
        geo = mesh.geometry.clone();
        mat = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
      }
    });

    // Optimized natural Himalayan granite boulder geometry (240 triangles instead of 14,844)
    const rockGeo = new THREE.DodecahedronGeometry(1.3, 2);
    const pos = rockGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const displacement = (Math.sin(vx * 3.2 + vy * 2.1) + Math.cos(vz * 2.8 + vx * 1.5)) * 0.12;
      pos.setXYZ(i, vx * (1 + displacement), vy * (0.8 + displacement), vz * (1 + displacement));
    }
    rockGeo.computeVertexNormals();

    let rockDiffMap: THREE.Texture | null = null;
    let rockNorMap: THREE.Texture | null = null;

    if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      rockDiffMap = stdMat.map;
      rockNorMap = stdMat.normalMap;
    }

    if (rockDiffMap) {
      rockDiffMap.colorSpace = THREE.SRGBColorSpace;
      rockDiffMap.generateMipmaps = true;
      rockDiffMap.anisotropy = quality === 'high' ? 8 : 4;
    }
    if (rockNorMap) {
      rockNorMap.generateMipmaps = true;
    }

    const cleanMaterial = new THREE.MeshStandardMaterial({
      map: rockDiffMap,
      normalMap: rockNorMap,
      color: new THREE.Color('#8e928d'), // Natural Himalayan granite / slate tone
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.2,
    });

    return {
      rockGeometry: rockGeo,
      rockMaterial: cleanMaterial,
    };
  }, [scene, quality]);

  // Thresholded instance generation (Requirement 2a: No per-frame recalculations)
  const lastCenterRef = useRef({ x: 99999, z: 99999 });
  const [instances, setInstances] = useState<{ count: number; matrices: THREE.Matrix4[] }>({
    count: 0,
    matrices: [],
  });

  const px = playerPos[0];
  const pz = playerPos[2];

  useEffect(() => {
    const distFromLast = Math.hypot(px - lastCenterRef.current.x, pz - lastCenterRef.current.z);
    if (distFromLast < 35 && instances.count > 0) {
      return;
    }
    lastCenterRef.current = { x: px, z: pz };

    const random = createSeededRandom(9911);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    // Capped rock counts: High: 65, Medium: 35, Low: 15
    const maxCandidates = quality === 'high' ? 65 : quality === 'medium' ? 35 : 15;
    const maxRadius = quality === 'high' ? 110 : 75;

    for (let i = 0; i < maxCandidates; i++) {
      const radius = 3.0 + random() * maxRadius;
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      const distToPath = getDistanceToPath(x, z);
      if (distToPath < 2.5) continue; // Keep center of walkable trail clear

      const slope = getTerrainSlope(x, z);
      if (slope > 0.38) continue; // Filter out steep cliff slopes

      const isTrailBorder = distToPath >= 2.5 && distToPath <= 8.5;
      if (!isTrailBorder && random() > 0.45) continue;

      const y = getTerrainHeight(x, z);
      const scaleBase = isTrailBorder ? 0.45 + random() * 0.55 : 0.65 + random() * 0.95;

      position.set(x, y - scaleBase * 0.18, z);
      rotation.set(
        (random() - 0.5) * 0.35,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.35
      );
      quaternion.setFromEuler(rotation);

      scale.set(
        scaleBase * (0.85 + random() * 0.35),
        scaleBase * (0.75 + random() * 0.35),
        scaleBase * (0.85 + random() * 0.35)
      );

      tempMatrix.compose(position, quaternion, scale);
      transforms.push(tempMatrix.clone());
    }

    setInstances({ count: transforms.length, matrices: transforms });
  }, [px, pz, quality]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    instances.matrices.forEach((mat, idx) => {
      meshRef.current.setMatrixAt(idx, mat);
    });
    meshRef.current.count = instances.count;
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances]);

  if (instances.count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[rockGeometry, rockMaterial, 80]}
      receiveShadow
      castShadow={quality === 'high'}
    />
  );
}
