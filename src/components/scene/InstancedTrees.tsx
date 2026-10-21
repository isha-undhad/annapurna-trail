'use client';

import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { WORLD_SCALE } from '@/lib/constants';
import { useTrekStore, QualityLevel } from '@/store/useTrekStore';
import { getTexturePath, configureTexture } from '@/lib/textures';

function createSeededRandom(seed = 12345) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Builds lightweight conifer foliage cards (Requirement 2g: fewer overdraw-heavy foliage cards).
 * Uses 2-4 clean cross-quad tiers instead of 24 overlapping cards.
 */
function buildFoliageGeometry(quality: QualityLevel) {
  const cards: { y: number; w: number; h: number; pitch: number; yaw: number }[] = [];

  const tierConfigs =
    quality === 'low'
      ? [
          { y: 9.0, w: 7.5, h: 4.8, pitch: -0.22, angles: [0, Math.PI / 2] },
          { y: 16.0, w: 4.5, h: 4.0, pitch: -0.15, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
        ]
      : quality === 'medium'
      ? [
          { y: 7.5, w: 8.5, h: 5.0, pitch: -0.24, angles: [0, Math.PI / 2] },
          { y: 13.0, w: 6.2, h: 4.5, pitch: -0.18, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 18.5, w: 3.8, h: 3.5, pitch: -0.12, angles: [0, Math.PI / 2] },
        ]
      : [
          { y: 7.0, w: 9.2, h: 5.0, pitch: -0.25, angles: [0, Math.PI / 2] },
          { y: 12.0, w: 7.2, h: 4.5, pitch: -0.20, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
          { y: 16.5, w: 5.0, h: 3.8, pitch: -0.15, angles: [0, Math.PI / 2] },
          { y: 20.5, w: 3.2, h: 3.0, pitch: -0.10, angles: [Math.PI / 4, (3 * Math.PI) / 4] },
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

  // Textures: 1K on low/medium, 2K on high
  const barkTextures = useTexture({
    color: getTexturePath('bark', 'color.jpg', quality),
    normal: getTexturePath('bark', 'normal.jpg', quality),
    roughness: getTexturePath('bark', 'roughness.jpg', quality),
  });

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

  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.35, 0.72, 22.0, 6);
    geo.translate(0, 11.0, 0);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trunkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: barkTextures.color,
      normalMap: barkTextures.normal,
      roughnessMap: barkTextures.roughness,
      roughness: 0.88,
      metalness: 0.0,
    });
  }, [barkTextures]);

  const foliageGeometry = useMemo(() => {
    return buildFoliageGeometry(quality);
  }, [quality]);

  // Foliage material: natural conifer pine tint, wind sway strictly for nearby trees
  const foliageMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: foliageTextures.color,
      color: new THREE.Color('#3d6a3c'), // Natural dark Himalayan pine green
      transparent: true,
      alphaTest: 0.25,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: 0.82,
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
        // Wind sway: proximity-faded strictly for nearby trees within 65m
        vec3 wPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float dCam = length(wPos - cameraPosition);
        if (dCam < 65.0) {
          float proximity = 1.0 - dCam / 65.0;
          float swayFactor = max(0.0, transformed.y - 6.0) * 0.02 * proximity;
          float windWave = sin(uTime * 1.8 + position.x * 0.15 + position.z * 0.15);
          transformed.x += windWave * swayFactor;
          transformed.z += cos(uTime * 1.3 + position.x * 0.1) * (swayFactor * 0.7);
        }
        `
      );
    };

    return mat;
  }, [foliageTextures]);

  // Distance culling & thresholded instance generation (Requirement 2g)
  const lastCenterRef = useRef({ x: 99999, z: 99999 });
  const [instances, setInstances] = useState<{ count: number; matrices: THREE.Matrix4[]; tints: THREE.Color[] }>({
    count: 0,
    matrices: [],
    tints: [],
  });

  const px = playerPos[0];
  const pz = playerPos[2];

  useEffect(() => {
    const distFromLast = Math.hypot(px - lastCenterRef.current.x, pz - lastCenterRef.current.z);
    if (distFromLast < 45 && instances.count > 0) {
      return; // Do not recalculate tree transforms on every small step
    }
    lastCenterRef.current = { x: px, z: pz };

    const random = createSeededRandom(6789);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const colorTints: THREE.Color[] = [];

    // Distance culling caps: High: 140, Medium: 80, Low: 40
    const maxCandidates = quality === 'high' ? 140 : quality === 'medium' ? 80 : 40;
    const maxRadius = quality === 'high' ? 180 : quality === 'medium' ? 130 : 85;

    const tintPalette = [
      new THREE.Color('#385e38'),
      new THREE.Color('#2e4d2f'),
      new THREE.Color('#446942'),
      new THREE.Color('#325234'),
    ];

    for (let i = 0; i < maxCandidates; i++) {
      const radius = 18 + random() * (maxRadius - 18);
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      const distToPath = getDistanceToPath(x, z);
      if (distToPath < 6.0) continue; // Keep walkable trail clear

      const y = getTerrainHeight(x, z);
      const realElevation = y / WORLD_SCALE;

      // Real elevation zoning: 1400m to 3750m
      if (realElevation < 1400 || realElevation > 3750) continue;
      if (realElevation > 3200 && random() > 0.35) continue; // Sparse near tree line

      const slope = getTerrainSlope(x, z);
      if (slope > 0.42) continue; // No trees on steep cliffs

      position.set(x, y - 0.4, z);
      rotation.set(0, random() * Math.PI * 2, 0);
      quaternion.setFromEuler(rotation);

      const s = 0.85 + random() * 0.35;
      scale.set(s, s * (0.95 + random() * 0.2), s);

      tempMatrix.compose(position, quaternion, scale);
      transforms.push(tempMatrix.clone());

      const chosenTint = tintPalette[Math.floor(random() * tintPalette.length)].clone();
      chosenTint.multiplyScalar(0.95 + random() * 0.15);
      colorTints.push(chosenTint);
    }

    setInstances({ count: transforms.length, matrices: transforms, tints: colorTints });
  }, [px, pz, quality]);

  useLayoutEffect(() => {
    if (!trunkMeshRef.current || !foliageMeshRef.current) return;

    instances.matrices.forEach((mat, idx) => {
      trunkMeshRef.current.setMatrixAt(idx, mat);
      foliageMeshRef.current.setMatrixAt(idx, mat);
      foliageMeshRef.current.setColorAt(idx, instances.tints[idx]);
    });

    trunkMeshRef.current.count = instances.count;
    foliageMeshRef.current.count = instances.count;

    trunkMeshRef.current.instanceMatrix.needsUpdate = true;
    foliageMeshRef.current.instanceMatrix.needsUpdate = true;
    if (foliageMeshRef.current.instanceColor) {
      foliageMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [instances]);

  const timerRef = useRef<THREE.Timer | null>(null);
  if (!timerRef.current) {
    timerRef.current = new THREE.Timer();
  }

  useFrame(() => {
    if (timerRef.current) {
      timerRef.current.update();
      timeRef.current.value = timerRef.current.getElapsed();
    }
  });

  return (
    <group>
      {/* Trunks: only cast shadows on High quality (Requirement 2d) */}
      <instancedMesh
        ref={trunkMeshRef}
        args={[trunkGeometry, trunkMaterial, 150]}
        castShadow={quality === 'high'}
        receiveShadow
      />
      {/* Foliage: only cast shadows on High quality (Requirement 2d) */}
      <instancedMesh
        ref={foliageMeshRef}
        args={[foliageGeometry, foliageMaterial, 150]}
        castShadow={quality === 'high'}
        receiveShadow
      />
    </group>
  );
}
