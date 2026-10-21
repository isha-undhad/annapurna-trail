'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, getDistanceToPath, getTerrainSlope } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';
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
  const timeRef = useRef({ value: 0 });

  const grassColor = useTexture(getTexturePath('grass', 'color.jpg', quality));
  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
    configureTexture(grassColor, true, aniso);
  }, [grassColor, quality]);

  // Crossed-blade tapered grass tuft geometry with vertex color gradient
  const grassGeometry = useMemo(() => {
    // 3 intersecting crossed blades, tapered toward the top
    const bladeCount = 3;
    const vertsPerBlade = 6; // 2 triangles
    const totalVerts = bladeCount * vertsPerBlade;

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const colors = new Float32Array(totalVerts * 3);
    const indices: number[] = [];

    const baseColor = new THREE.Color('#336e29');
    const tipColor = new THREE.Color('#68b84d');

    const widthBase = 0.22;
    const widthTip = 0.06;
    const height = 0.62;

    for (let b = 0; b < bladeCount; b++) {
      const angle = (b * Math.PI) / bladeCount;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const baseIdx = b * 4;
      const vertOffset = b * 4;

      // 4 quad vertices
      // v0: bottom left
      const x0 = -widthBase * cosA;
      const z0 = -widthBase * sinA;
      // v1: bottom right
      const x1 = widthBase * cosA;
      const z1 = widthBase * sinA;
      // v2: top left
      const x2 = -widthTip * cosA + sinA * 0.05;
      const z2 = -widthTip * sinA - cosA * 0.05;
      // v3: top right
      const x3 = widthTip * cosA + sinA * 0.05;
      const z3 = widthTip * sinA - cosA * 0.05;

      const vPos = [
        [x0, 0.0, z0],
        [x1, 0.0, z1],
        [x2, height, z2],
        [x3, height, z3],
      ];

      const vUV = [
        [0, 0],
        [1, 0],
        [0.15, 1],
        [0.85, 1],
      ];

      for (let i = 0; i < 4; i++) {
        const idx = vertOffset + i;
        positions[idx * 3] = vPos[i][0];
        positions[idx * 3 + 1] = vPos[i][1];
        positions[idx * 3 + 2] = vPos[i][2];

        normals[idx * 3] = -sinA;
        normals[idx * 3 + 1] = 0.3;
        normals[idx * 3 + 2] = cosA;

        uvs[idx * 2] = vUV[i][0];
        uvs[idx * 2 + 1] = vUV[i][1];

        const c = i < 2 ? baseColor : tipColor;
        colors[idx * 3] = c.r;
        colors[idx * 3 + 1] = c.g;
        colors[idx * 3 + 2] = c.b;
      }

      // Two triangles (double-sided)
      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx + 2, baseIdx + 1, baseIdx + 3
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

  // Material with wind sway shader
  const grassMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: grassColor,
      vertexColors: true,
      roughness: 0.65,
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
        // Wind wave: displaces grass blade tips proportional to height
        float bladeTip = position.y / 0.65;
        float wave = sin(uTime * 3.2 + position.x * 2.0 + position.z * 1.5) * 0.12 * bladeTip;
        float gust = cos(uTime * 1.8 + position.z * 0.8) * 0.08 * bladeTip;
        transformed.x += wave + gust;
        transformed.z += wave * 0.6;
        `
      );
    };

    return mat;
  }, [grassColor]);

  // Compute instance matrices
  const { count, matrices } = useMemo(() => {
    const random = createSeededRandom(7788);
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    const transforms: THREE.Matrix4[] = [];
    const maxCandidates = quality === 'high' ? 850 : quality === 'medium' ? 500 : 250;

    for (let i = 0; i < maxCandidates; i++) {
      const x = (random() - 0.5) * 160;
      const z = 75 - random() * 320; // from trailhead down to -245

      const distToPath = getDistanceToPath(x, z);
      // Place near trail edges and across meadows
      if (distToPath < 1.8) continue; // Keep center trail clean

      const y = getTerrainHeight(x, z);
      if (y > 20.0) continue; // No grass on snow peaks

      const slope = getTerrainSlope(x, z);
      if (slope > 0.3) continue; // No grass on sheer cliffs

      // Firmly grounded on the terrain height
      position.set(x, y - 0.04, z);
      rotation.set(0, random() * Math.PI * 2, 0);
      quaternion.setFromEuler(rotation);

      const s = 0.85 + random() * 0.45;
      scale.set(s, s * (0.9 + random() * 0.3), s);

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

  if (quality === 'low') return null; // Skip grass tufts on low mobile mode for max FPS

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, grassMaterial, count]}
      receiveShadow
    />
  );
}
