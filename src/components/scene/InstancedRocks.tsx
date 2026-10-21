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

    if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.map) {
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        stdMat.map.generateMipmaps = true;
        stdMat.map.anisotropy = quality === 'high' ? 8 : 4;
      }
      if (stdMat.normalMap) {
        stdMat.normalMap.generateMipmaps = true;
      }
      stdMat.roughness = 0.82;
      stdMat.metalness = 0.04;
    }

    return {
      rockGeometry: rockGeo,
      rockMaterial: mat || new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 }),
    };
  }, [scene, quality]);

  // Compute instance matrices with slope filtering and soil embedding
  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(9911);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const maxCandidates = quality === 'high' ? 350 : quality === 'medium' ? 220 : 120;

    for (let i = 0; i < maxCandidates; i++) {
      const x = (random() - 0.5) * 200;
      const z = 75 - random() * 320; // from trailhead down to -245

      const distToPath = getDistanceToPath(x, z);
      // Keep center of walkable trail clear
      if (distToPath < 2.5) continue;

      // Filter out steep cliff slopes to prevent hovering boulders
      const slope = getTerrainSlope(x, z);
      if (slope > 0.35) continue;

      // Favor rocks bordering the dirt trail (2.5 to 8.5) and across meadows
      const isTrailBorder = distToPath >= 2.5 && distToPath <= 8.5;
      if (!isTrailBorder && random() > 0.45) continue;

      const y = getTerrainHeight(x, z);
      const scaleBase = isTrailBorder ? 0.45 + random() * 0.55 : 0.7 + random() * 0.95;

      // Sink boulder firmly into terrain so base is embedded with no hovering gap
      position.set(x, y - scaleBase * 0.22, z);

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

useGLTF.preload('/models/rock_07/rock_07_1k.gltf');
