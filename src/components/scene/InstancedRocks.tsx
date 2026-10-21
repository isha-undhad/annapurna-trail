'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
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

    const rockGeo: THREE.BufferGeometry = geo ? geo : new THREE.DodecahedronGeometry(1.0, 1);
    rockGeo.computeVertexNormals();
    rockGeo.center();
    if (geo) {
      // Poly Haven rock_07 raw scale is ~0.15m units; normalize so base scale is ~1 meter
      rockGeo.scale(7.2, 7.2, 7.2);
    }

    // Clean PBR material for natural granite/slate rocks
    // Do NOT use ARM texture as metalnessMap (ARM has AO in Red, Roughness in Green)
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
      metalness: 0.0, // Strictly non-metallic
      envMapIntensity: 0.2, // Low environment reflection
    });

    return {
      rockGeometry: rockGeo,
      rockMaterial: cleanMaterial,
    };
  }, [scene, quality]);

  const playerPos = useTrekStore((s) => s.playerPos);

  // Compute instance matrices with slope filtering and soil embedding
  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(9911);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const maxCandidates = quality === 'high' ? 320 : quality === 'medium' ? 200 : 110;
    const px = playerPos[0];
    const pz = playerPos[2];

    for (let i = 0; i < maxCandidates; i++) {
      const radius = 3.0 + random() * 160;
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      const distToPath = getDistanceToPath(x, z);
      // Keep center of walkable trail clear
      if (distToPath < 2.5) continue;

      // Filter out steep cliff slopes to prevent hovering boulders
      const slope = getTerrainSlope(x, z);
      if (slope > 0.38) continue;

      // Favor rocks bordering the dirt trail (2.5 to 8.5) and across meadows/moraine
      const isTrailBorder = distToPath >= 2.5 && distToPath <= 8.5;
      if (!isTrailBorder && random() > 0.45) continue;

      const y = getTerrainHeight(x, z);
      // Human scale: boulders 0.5 to 2.8m
      const scaleBase = isTrailBorder ? 0.45 + random() * 0.55 : 0.65 + random() * 0.95;

      // Sink boulder firmly into terrain so base is embedded with no hovering gap
      position.set(x, y - scaleBase * 0.18, z);

      // Random natural orientation
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

    return { count: transforms.length, matrices: transforms };
  }, [quality, playerPos]);

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

useGLTF.preload('/models/rock_07/rock_07_1k.gltf');
