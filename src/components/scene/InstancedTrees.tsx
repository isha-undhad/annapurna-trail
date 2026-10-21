'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';
import { getTexturePath, configureTexture, QualityLevel } from '@/lib/textures';

function createSeededRandom(seed = 54321) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Builds multi-tiered alpha-card conifer foliage geometry.
 * Intersecting planar branch cards radiate around the trunk,
 * angled downward to shed snow as in Himalayan firs and deodars.
 */
function buildFoliageGeometry(quality: QualityLevel) {
  const cards: { y: number; w: number; h: number; pitch: number; yaw: number }[] = [];

  const tierConfigs =
    quality === 'low'
      ? [
          { y: 2.6, w: 4.2, h: 2.0, pitch: -0.26, angles: [0, Math.PI / 2] },
          { y: 4.2, w: 3.4, h: 1.8, pitch: -0.22, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 5.8, w: 2.6, h: 1.6, pitch: -0.18, angles: [0, Math.PI / 2] },
          { y: 7.2, w: 1.7, h: 1.4, pitch: -0.14, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 8.2, w: 1.1, h: 1.5, pitch: 0, angles: [0, Math.PI / 2] },
        ]
      : [
          { y: 2.3, w: 4.5, h: 2.1, pitch: -0.28, angles: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4] },
          { y: 3.7, w: 3.8, h: 1.9, pitch: -0.24, angles: [Math.PI / 8, (3 * Math.PI) / 8, (5 * Math.PI) / 8, (7 * Math.PI) / 8] },
          { y: 5.1, w: 3.1, h: 1.7, pitch: -0.20, angles: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4] },
          { y: 6.4, w: 2.3, h: 1.5, pitch: -0.16, angles: [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] },
          { y: 7.5, w: 1.6, h: 1.3, pitch: -0.12, angles: [0, Math.PI / 3, (2 * Math.PI) / 3] },
          { y: 8.4, w: 1.1, h: 1.6, pitch: 0, angles: [0, Math.PI / 2] },
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
  const timeRef = useRef({ value: 0 });

  // Load realistic CC0 Poly Haven pine bark PBR textures
  const barkTextures = useTexture({
    color: getTexturePath('bark', 'color.jpg', quality),
    normal: getTexturePath('bark', 'normal.jpg', quality),
    roughness: getTexturePath('bark', 'roughness.jpg', quality),
  });

  // Load realistic CC0 Poly Haven conifer needle branch textures with alpha
  const foliageTextures = useTexture({
    color: getTexturePath('foliage', 'pine_branch.png', quality),
    normal: getTexturePath('foliage', 'pine_branch_normal.png', quality),
  });

  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;

    configureTexture(barkTextures.color, true, aniso, 1, 4);
    configureTexture(barkTextures.normal, false, aniso, 1, 4);
    configureTexture(barkTextures.roughness, false, aniso, 1, 4);

    configureTexture(foliageTextures.color, true, aniso, 1, 1);
    configureTexture(foliageTextures.normal, false, aniso, 1, 1);
  }, [barkTextures, foliageTextures, quality]);

  // Tapered trunk cylinder geometry
  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.18, 0.44, 8.5, 7);
    geo.translate(0, 4.25, 0); // Ground base at Y=0
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Trunk PBR material
  const trunkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: barkTextures.color,
      normalMap: barkTextures.normal,
      roughnessMap: barkTextures.roughness,
      roughness: 0.88,
      metalness: 0.02,
    });
  }, [barkTextures]);

  // Foliage alpha-card geometry
  const foliageGeometry = useMemo(() => {
    return buildFoliageGeometry(quality);
  }, [quality]);

  // Foliage material with wind sway vertex shader and alpha testing
  const foliageMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: foliageTextures.color,
      normalMap: foliageTextures.normal,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: 0.65,
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
        // Mountain wind sway: amplitude increases towards the canopy apex (Y > 1.8)
        float swayFactor = max(0.0, transformed.y - 1.8) * 0.045;
        float windWave = sin(uTime * 1.8 + position.x * 0.25 + position.z * 0.25);
        transformed.x += windWave * swayFactor;
        transformed.z += cos(uTime * 1.3 + position.x * 0.15) * (swayFactor * 0.65);
        `
      );
    };

    return mat;
  }, [foliageTextures]);

  // Instance transforms and natural tinting
  const { count, matrices, tints } = useMemo(() => {
    const random = createSeededRandom(6789);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const colorTints: THREE.Color[] = [];

    // Quality-based density & distance culling
    const maxCandidates = quality === 'high' ? 450 : quality === 'medium' ? 280 : 150;
    const maxZDistance = quality === 'low' ? -190 : -245;

    // Palette of Himalayan pine needle tones
    const tintPalette = [
      new THREE.Color('#385e38'),
      new THREE.Color('#2e4d2f'),
      new THREE.Color('#446942'),
      new THREE.Color('#325234'),
      new THREE.Color('#4c734a'),
    ];

    for (let i = 0; i < maxCandidates; i++) {
      const x = (random() - 0.5) * 220;
      const z = 75 - random() * (75 - maxZDistance);

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

      // Ground trunk base firmly into the terrain
      position.set(x, y - 0.35, z);

      rotation.set(
        (random() - 0.5) * 0.05,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.05
      );
      quaternion.setFromEuler(rotation);

      const s = 0.85 + random() * 0.65;
      scale.set(s, s * (0.95 + random() * 0.2), s);

      tempMatrix.compose(position, quaternion, scale);
      transforms.push(tempMatrix.clone());

      const chosenTint = tintPalette[Math.floor(random() * tintPalette.length)].clone();
      // Slight brightness jitter
      chosenTint.multiplyScalar(0.92 + random() * 0.16);
      colorTints.push(chosenTint);
    }

    return { count: transforms.length, matrices: transforms, tints: colorTints };
  }, [quality]);

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
