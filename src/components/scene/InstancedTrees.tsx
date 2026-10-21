'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';

function createSeededRandom(seed = 54321) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function InstancedTrees() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const quality = useTrekStore((s) => s.quality);
  const timeRef = useRef({ value: 0 });

  // Realistic Himalayan Pine (Deodar / Silver Pine) combined geometry
  const treeGeometry = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Trunk - warm Himalayan cedar/pine bark
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 2.8, 6);
    trunkGeo.translate(0, 1.4, 0);
    const trunkColor = new THREE.Color('#6b4d32');
    const trunkColors = new Float32Array(trunkGeo.attributes.position.count * 3);
    for (let i = 0; i < trunkGeo.attributes.position.count; i++) {
      trunkColors[i * 3] = trunkColor.r;
      trunkColors[i * 3 + 1] = trunkColor.g;
      trunkColors[i * 3 + 2] = trunkColor.b;
    }
    trunkGeo.setAttribute('color', new THREE.BufferAttribute(trunkColors, 3));
    geometries.push(trunkGeo);

    // 4 tiered lush pine canopies in rich Himalayan alpine greens
    const tiers = [
      { radius: 2.1, height: 2.4, y: 3.0, color: new THREE.Color('#2f6634') },
      { radius: 1.7, height: 2.1, y: 4.4, color: new THREE.Color('#3b7a42') },
      { radius: 1.25, height: 1.8, y: 5.7, color: new THREE.Color('#4a9152') },
      { radius: 0.75, height: 1.5, y: 6.8, color: new THREE.Color('#5ca665') },
    ];

    tiers.forEach((tier) => {
      const coneGeo = new THREE.ConeGeometry(tier.radius, tier.height, 7);
      coneGeo.translate(0, tier.y, 0);
      const coneColors = new Float32Array(coneGeo.attributes.position.count * 3);
      for (let i = 0; i < coneGeo.attributes.position.count; i++) {
        coneColors[i * 3] = tier.color.r;
        coneColors[i * 3 + 1] = tier.color.g;
        coneColors[i * 3 + 2] = tier.color.b;
      }
      coneGeo.setAttribute('color', new THREE.BufferAttribute(coneColors, 3));
      geometries.push(coneGeo);
    });

    // Merge into single buffer geometry
    let totalVerts = 0;
    geometries.forEach((g) => (totalVerts += g.attributes.position.count));

    const mergedPositions = new Float32Array(totalVerts * 3);
    const mergedColors = new Float32Array(totalVerts * 3);
    const mergedNormals = new Float32Array(totalVerts * 3);
    const mergedIndices: number[] = [];

    let offset = 0;
    geometries.forEach((g) => {
      const p = g.attributes.position;
      const c = g.attributes.color;
      const idx = g.index;
      g.computeVertexNormals();
      const n = g.attributes.normal;

      for (let i = 0; i < p.count; i++) {
        mergedPositions[(offset + i) * 3] = p.getX(i);
        mergedPositions[(offset + i) * 3 + 1] = p.getY(i);
        mergedPositions[(offset + i) * 3 + 2] = p.getZ(i);

        mergedColors[(offset + i) * 3] = c.getX(i);
        mergedColors[(offset + i) * 3 + 1] = c.getY(i);
        mergedColors[(offset + i) * 3 + 2] = c.getZ(i);

        mergedNormals[(offset + i) * 3] = n.getX(i);
        mergedNormals[(offset + i) * 3 + 1] = n.getY(i);
        mergedNormals[(offset + i) * 3 + 2] = n.getZ(i);
      }

      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          mergedIndices.push(offset + idx.getX(i));
        }
      }

      offset += p.count;
      g.dispose();
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    merged.setIndex(mergedIndices);
    return merged;
  }, []);

  // Material with wind sway shader
  const treeMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.0,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeRef.current;

      shader.vertexShader = `
        uniform float uTime;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Wind sway: amplitude increases towards the canopy top (Y > 2.0)
        float swayFactor = max(0.0, transformed.y - 1.5) * 0.045;
        float windWave = sin(uTime * 1.8 + position.x * 0.3 + position.z * 0.3);
        transformed.x += windWave * swayFactor;
        transformed.z += cos(uTime * 1.4 + position.x * 0.2) * (swayFactor * 0.65);
        `
      );
    };

    return mat;
  }, []);

  // Calculate instance transforms filtered by slope and altitude
  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(6789);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    // Adjust density based on quality setting
    const maxCandidates = quality === 'high' ? 550 : quality === 'medium' ? 380 : 220;

    for (let i = 0; i < maxCandidates; i++) {
      const x = (random() - 0.5) * 220;
      const z = 75 - random() * 320; // from trailhead down to -245

      const distToPath = getDistanceToPath(x, z);
      // Keep walkable trail clear
      if (distToPath < 4.8) continue;

      const y = getTerrainHeight(x, z);
      // Alpine tree line constraint: no trees on high snow peaks
      if (y > 22.5) continue;

      // Slope constraint: no trees on steep cliffs/rock
      const slope = getTerrainSlope(x, z);
      if (slope > 0.38) continue;

      // Natural valley groves clustering
      const clusterFavor = Math.exp(-Math.pow(distToPath - 15, 2) / 450);
      if (distToPath > 24 && random() > clusterFavor && random() > 0.4) continue;

      // Firmly ground trunk base into the terrain
      position.set(x, y - 0.35, z);

      rotation.set(
        (random() - 0.5) * 0.06,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.06
      );
      quaternion.setFromEuler(rotation);

      const s = 0.85 + random() * 0.65;
      scale.set(s, s * (0.95 + random() * 0.2), s);

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

  // THREE.Timer replacement for THREE.Clock
  const timerRef = useRef<THREE.Timer | null>(null);
  if (!timerRef.current) {
    timerRef.current = new THREE.Timer();
  }

  useFrame(() => {
    if (timerRef.current) {
      timerRef.current.update(performance.now());
      timeRef.current.value = timerRef.current.getElapsed();
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[treeGeometry, treeMaterial, count]}
      castShadow={quality !== 'low'}
      receiveShadow={quality !== 'low'}
    />
  );
}
