'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';
import { WORLD_SCALE } from '@/lib/constants';
import { getTexturePath, configureTexture } from '@/lib/textures';

function createSeededRandom(seed = 3344) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function InstancedGrass() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const quality = useTrekStore((s) => s.quality);
  const playerPos = useTrekStore((s) => s.playerPos);
  const timeRef = useRef({ value: 0 });

  const grassColor = useTexture(getTexturePath('grass', 'color.jpg', quality));
  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
    configureTexture(grassColor, true, aniso);
  }, [grassColor, quality]);

  // Small, delicate tapered grass tuft geometry (0.35m - 0.55m height, rooted in ground)
  const grassGeometry = useMemo(() => {
    const bladeCount = 3;
    const totalVerts = bladeCount * 4;

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const colors = new Float32Array(totalVerts * 3);
    const indices: number[] = [];

    const baseColor = new THREE.Color('#386b2d');
    const tipColor = new THREE.Color('#5ea848');

    // Human-scale dimensions: 0.42m high, 0.06m wide base
    const widthBase = 0.06;
    const widthTip = 0.015;
    const height = 0.42;

    for (let b = 0; b < bladeCount; b++) {
      const angle = (b * Math.PI) / bladeCount;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const vertOffset = b * 4;

      const x0 = -widthBase * cosA;
      const z0 = -widthBase * sinA;
      const x1 = widthBase * cosA;
      const z1 = widthBase * sinA;
      const x2 = -widthTip * cosA;
      const z2 = -widthTip * sinA;
      const x3 = widthTip * cosA;
      const z3 = widthTip * sinA;

      const vPos = [
        [x0, 0.0, z0],
        [x1, 0.0, z1],
        [x2, height, z2],
        [x3, height, z3],
      ];

      const vUV = [
        [0, 0],
        [1, 0],
        [0.2, 1],
        [0.8, 1],
      ];

      for (let i = 0; i < 4; i++) {
        const idx = vertOffset + i;
        positions[idx * 3] = vPos[i][0];
        positions[idx * 3 + 1] = vPos[i][1];
        positions[idx * 3 + 2] = vPos[i][2];

        normals[idx * 3] = 0;
        normals[idx * 3 + 1] = 1;
        normals[idx * 3 + 2] = 0;

        uvs[idx * 2] = vUV[i][0];
        uvs[idx * 2 + 1] = vUV[i][1];

        const c = i < 2 ? baseColor : tipColor;
        colors[idx * 3] = c.r;
        colors[idx * 3 + 1] = c.g;
        colors[idx * 3 + 2] = c.b;
      }

      indices.push(
        vertOffset, vertOffset + 1, vertOffset + 2,
        vertOffset + 2, vertOffset + 1, vertOffset + 3
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Material with subtle wind sway shader
  const grassMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: grassColor,
      vertexColors: true,
      roughness: 0.72,
      side: THREE.DoubleSide,
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
        // Displace blade tips proportional to height
        float bladeTip = position.y / 0.45;
        float wave = sin(uTime * 3.0 + position.x * 2.5 + position.z * 2.0) * 0.08 * bladeTip;
        transformed.x += wave;
        transformed.z += wave * 0.5;
        `
      );
    };

    return mat;
  }, [grassColor]);

  // Dynamic instance matrices centered around player
  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(7788);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const maxCandidates = quality === 'high' ? 650 : quality === 'medium' ? 380 : 180;
    const px = playerPos[0];
    const pz = playerPos[2];

    for (let i = 0; i < maxCandidates; i++) {
      const radius = 2.0 + random() * 75; // Within 75m of player
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      const distToPath = getDistanceToPath(x, z);
      if (distToPath < 1.6) continue; // Keep trail clear

      const y = getTerrainHeight(x, z);
      const realAlt = y / WORLD_SCALE;

      // Real elevation zoning:
      // Below 2,000m: dense
      // 2,000 to 3,600m: meadow tufts
      // Above 3,800m: no grass (moraine/snow)
      if (realAlt > 3750) continue;
      if (realAlt > 3200 && random() > 0.4) continue;

      const slope = getTerrainSlope(x, z);
      if (slope > 0.32) continue; // No grass on rocky cliffs

      // Root tuft into the soil so it is never floating
      position.set(x, y - 0.04, z);
      rotation.set(0, random() * Math.PI * 2, 0);
      quaternion.setFromEuler(rotation);

      const s = 0.8 + random() * 0.4;
      scale.set(s, s * (0.85 + random() * 0.3), s);

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

  if (quality === 'low') return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, grassMaterial, count]}
      receiveShadow
    />
  );
}
