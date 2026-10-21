'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope, TRAIL_POLYLINE } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';
import { WORLD_SCALE } from '@/lib/constants';
import { getTexturePath, configureTexture, QualityLevel } from '@/lib/textures';

function createSeededRandom(seed = 54321) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Builds multi-tiered alpha-card conifer foliage geometry for 18-25m Himalayan pines.
 * Intersecting branch cards radiate around the trunk, angled downward to shed snow.
 */
function buildFoliageGeometry(quality: QualityLevel) {
  const cards: { y: number; w: number; h: number; pitch: number; yaw: number }[] = [];

  const tierConfigs =
    quality === 'low'
      ? [
          { y: 7.0, w: 10.5, h: 5.0, pitch: -0.26, angles: [0, Math.PI / 2] },
          { y: 12.0, w: 8.5, h: 4.5, pitch: -0.22, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 16.5, w: 6.5, h: 4.0, pitch: -0.18, angles: [0, Math.PI / 2] },
          { y: 20.5, w: 4.5, h: 3.2, pitch: -0.14, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 23.0, w: 2.5, h: 3.5, pitch: 0, angles: [0, Math.PI / 2] },
        ]
      : [
          { y: 6.5, w: 11.5, h: 5.2, pitch: -0.28, angles: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4] },
          { y: 10.5, w: 9.5, h: 4.8, pitch: -0.24, angles: [Math.PI / 8, (3 * Math.PI) / 8, (5 * Math.PI) / 8, (7 * Math.PI) / 8] },
          { y: 14.5, w: 7.5, h: 4.2, pitch: -0.20, angles: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4] },
          { y: 18.0, w: 5.5, h: 3.6, pitch: -0.16, angles: [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] },
          { y: 21.0, w: 3.8, h: 3.0, pitch: -0.12, angles: [0, Math.PI / 3, (2 * Math.PI) / 3] },
          { y: 23.2, w: 2.4, h: 3.5, pitch: 0, angles: [0, Math.PI / 2] },
        ];

  tierConfigs.forEach((tier) => {
    tier.angles.forEach((angle) => {
      cards.push({
        y: tier.y,
        w: tier.w,
        h: tier.h,
        pitch: tier.pitch,
        yaw: angle,
      });
    });
  });

  const numCards = cards.length;
  const numVerts = numCards * 4;
  const positions = new Float32Array(numVerts * 3);
  const normals = new Float32Array(numVerts * 3);
  const uvs = new Float32Array(numVerts * 2);
  const indices: number[] = [];

  cards.forEach((card, idx) => {
    const vOffset = idx * 4;
    const hw = card.w * 0.5;
    const hh = card.h * 0.5;

    const localCorners = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
    ];

    const rotEuler = new THREE.Euler(card.pitch, card.yaw, 0, 'YXZ');
    const rotQuat = new THREE.Quaternion().setFromEuler(rotEuler);

    localCorners.forEach((v, cIdx) => {
      v.applyQuaternion(rotQuat);
      v.y += card.y;

      const i = vOffset + cIdx;
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      const norm = new THREE.Vector3(0, 0.4, 1).applyQuaternion(rotQuat).normalize();
      normals[i * 3] = norm.x;
      normals[i * 3 + 1] = norm.y;
      normals[i * 3 + 2] = norm.z;
    });

    uvs[(vOffset + 0) * 2] = 0;
    uvs[(vOffset + 0) * 2 + 1] = 0;

    uvs[(vOffset + 1) * 2] = 1;
    uvs[(vOffset + 1) * 2 + 1] = 0;

    uvs[(vOffset + 2) * 2] = 1;
    uvs[(vOffset + 2) * 2 + 1] = 1;

    uvs[(vOffset + 3) * 2] = 0;
    uvs[(vOffset + 3) * 2 + 1] = 1;

    indices.push(
      vOffset, vOffset + 1, vOffset + 2,
      vOffset, vOffset + 2, vOffset + 3
    );
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function InstancedTrees() {
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null!);
  const foliageMeshRef = useRef<THREE.InstancedMesh>(null!);
  const quality = useTrekStore((s) => s.quality);
  const playerPos = useTrekStore((s) => s.playerPos);
  const timeRef = useRef({ value: 0 });

  // 2K pine bark textures strictly for trunks
  const barkTextures = useTexture({
    color: getTexturePath('bark', 'color.jpg', quality),
    normal: getTexturePath('bark', 'normal.jpg', quality),
    roughness: getTexturePath('bark', 'roughness.jpg', quality),
  });

  // Conifer needle branch textures with alpha strictly for foliage cards
  const foliageTextures = useTexture({
    color: getTexturePath('foliage', 'pine_branch.png', quality),
    normal: getTexturePath('foliage', 'pine_branch_normal.png', quality),
  });

  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;

    configureTexture(barkTextures.color, true, aniso, 1, 6);
    configureTexture(barkTextures.normal, false, aniso, 1, 6);
    configureTexture(barkTextures.roughness, false, aniso, 1, 6);

    configureTexture(foliageTextures.color, true, aniso, 1, 1);
    configureTexture(foliageTextures.normal, false, aniso, 1, 1);
  }, [barkTextures, foliageTextures, quality]);

  // Trunk geometry: ~22m tall with base width 0.7m, top width 0.35m
  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.35, 0.72, 22.0, 8);
    geo.translate(0, 11.0, 0); // Root base at Y=0
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Trunk PBR material (bark only)
  const trunkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: barkTextures.color,
      normalMap: barkTextures.normal,
      roughnessMap: barkTextures.roughness,
      roughness: 0.88,
      metalness: 0.0,
    });
  }, [barkTextures]);

  // Foliage alpha-card geometry
  const foliageGeometry = useMemo(() => {
    return buildFoliageGeometry(quality);
  }, [quality]);

  // Foliage PBR material: lush green base tint, alpha testing, wind sway
  const foliageMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: foliageTextures.color,
      color: new THREE.Color('#4e8f4c'), // Vibrant Himalayan pine green base tint
      transparent: true,
      alphaTest: 0.22,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: 0.78,
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
        // Wind sway: increases towards the canopy top (Y > 6.0)
        float swayFactor = max(0.0, transformed.y - 6.0) * 0.025;
        float windWave = sin(uTime * 1.8 + position.x * 0.15 + position.z * 0.15);
        transformed.x += windWave * swayFactor;
        transformed.z += cos(uTime * 1.3 + position.x * 0.1) * (swayFactor * 0.7);
        `
      );
    };

    return mat;
  }, [foliageTextures]);

  // Instance transforms and zoning by REAL elevation around player
  const { count, matrices, tints } = useMemo(() => {
    const random = createSeededRandom(6789);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const colorTints: THREE.Color[] = [];

    const maxCandidates = quality === 'high' ? 450 : quality === 'medium' ? 280 : 150;
    const px = playerPos[0];
    const pz = playerPos[2];

    const tintPalette = [
      new THREE.Color('#385e38'),
      new THREE.Color('#2e4d2f'),
      new THREE.Color('#446942'),
      new THREE.Color('#325234'),
      new THREE.Color('#4c734a'),
    ];

    // Spawn trees within 350m of player along the valley slopes
    for (let i = 0; i < maxCandidates; i++) {
      const radius = 25 + random() * 320;
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      const distToPath = getDistanceToPath(x, z);
      if (distToPath < 5.0) continue; // Keep walkable trail clear

      const y = getTerrainHeight(x, z);
      const realElevation = y / WORLD_SCALE;

      // Real elevation zoning:
      // - 2,000 to 3,200m: dense forest
      // - 3,200 to 3,800m: sparse alpine trees
      // - Above 3,800m: NO trees (tree line)
      if (realElevation < 1400 || realElevation > 3750) continue;
      if (realElevation > 3200 && random() > 0.35) continue; // Sparse near tree line

      const slope = getTerrainSlope(x, z);
      if (slope > 0.42) continue; // No trees on steep cliffs

      // Root trunk firmly into terrain
      position.set(x, y - 0.4, z);

      rotation.set(
        (random() - 0.5) * 0.04,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.04
      );
      quaternion.setFromEuler(rotation);

      const s = 0.85 + random() * 0.35; // ~19m to 26m
      scale.set(s, s * (0.95 + random() * 0.2), s);

      tempMatrix.compose(position, quaternion, scale);
      transforms.push(tempMatrix.clone());

      const chosenTint = tintPalette[Math.floor(random() * tintPalette.length)].clone();
      chosenTint.multiplyScalar(0.95 + random() * 0.15);
      colorTints.push(chosenTint);
    }

    return { count: transforms.length, matrices: transforms, tints: colorTints };
  }, [quality, playerPos]);

  useLayoutEffect(() => {
    if (!trunkMeshRef.current || !foliageMeshRef.current) return;

    matrices.forEach((mat, idx) => {
      trunkMeshRef.current.setMatrixAt(idx, mat);
      foliageMeshRef.current.setMatrixAt(idx, mat);
      foliageMeshRef.current.setColorAt(idx, tints[idx]);
    });

    trunkMeshRef.current.instanceMatrix.needsUpdate = true;
    foliageMeshRef.current.instanceMatrix.needsUpdate = true;
    if (foliageMeshRef.current.instanceColor) {
      foliageMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [matrices, tints]);

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
    <group>
      {/* Instanced Pine Trunks with 2K Bark PBR */}
      <instancedMesh
        ref={trunkMeshRef}
        args={[trunkGeometry, trunkMaterial, count]}
        castShadow={quality !== 'low'}
        receiveShadow={quality !== 'low'}
      />
      {/* Instanced Conifer Alpha-Card Foliage with Real Needle Textures & Wind Sway */}
      <instancedMesh
        ref={foliageMeshRef}
        args={[foliageGeometry, foliageMaterial, count]}
        castShadow={quality !== 'low'}
        receiveShadow={quality !== 'low'}
      />
    </group>
  );
}
