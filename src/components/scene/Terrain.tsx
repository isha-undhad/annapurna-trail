'use client';

import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight } from '@/lib/terrain';
import { WORLD_SCALE } from '@/lib/constants';
import { useTrekStore } from '@/store/useTrekStore';
import { getTexturePath, configureTexture } from '@/lib/textures';

// Chunk size in game units (~600 real meters per chunk)
const CHUNK_SIZE = 120;
// 5x5 grid = 25 chunks around player (600m coverage; far-field DEM covers beyond)
const CHUNK_RADIUS = 2;

interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
  lod: 'high' | 'medium' | 'low';
}

function getChunkLOD(distSq: number): 'high' | 'medium' | 'low' {
  if (distSq <= 1.2) return 'high';
  if (distSq <= 2.5) return 'medium';
  return 'low';
}

// Persistent geometry cache to prevent rebuilding chunks across boundaries
const chunkGeometryCache = new Map<string, THREE.BufferGeometry>();

function createChunkGeometry(cx: number, cz: number, lod: 'high' | 'medium' | 'low') {
  const key = `${cx}_${cz}_${lod}`;
  if (chunkGeometryCache.has(key)) {
    return chunkGeometryCache.get(key)!;
  }

  // Capped vertex counts per LOD level (Requirement 2c)
  // High: 16 (256 quads), Medium: 8 (64 quads), Low: 4 (16 quads)
  const segments = lod === 'high' ? 16 : lod === 'medium' ? 8 : 4;
  const numVertsX = segments + 1;
  const numVertsZ = segments + 1;
  const planeVertsCount = numVertsX * numVertsZ;

  const halfSize = CHUNK_SIZE / 2;
  const step = CHUNK_SIZE / segments;
  const worldOffsetX = cx * CHUNK_SIZE;
  const worldOffsetZ = cz * CHUNK_SIZE;

  // 4 perimeter borders with skirt quads to eliminate LOD seams (Requirement 0)
  const perimeterEdges = segments * 4;
  const skirtVertsCount = perimeterEdges * 2;
  const totalVerts = planeVertsCount + skirtVertsCount;

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  // 1. Fill ground grid vertices
  for (let iz = 0; iz <= segments; iz++) {
    const localZ = -halfSize + iz * step;
    const worldZ = worldOffsetZ + localZ;
    for (let ix = 0; ix <= segments; ix++) {
      const localX = -halfSize + ix * step;
      const worldX = worldOffsetX + localX;
      const worldY = getTerrainHeight(worldX, worldZ);
      const idx = iz * numVertsX + ix;

      positions[idx * 3] = worldX;
      positions[idx * 3 + 1] = worldY;
      positions[idx * 3 + 2] = worldZ;

      uvs[idx * 2] = ix / segments;
      uvs[idx * 2 + 1] = 1 - iz / segments;
    }
  }

  // 2. Grid triangles
  const planeIndicesCount = segments * segments * 6;
  const skirtIndicesCount = perimeterEdges * 6;
  const indices = new Uint32Array(planeIndicesCount + skirtIndicesCount);

  let iOffset = 0;
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * numVertsX + ix;
      const b = a + 1;
      const c = (iz + 1) * numVertsX + ix;
      const d = c + 1;

      indices[iOffset++] = a;
      indices[iOffset++] = c;
      indices[iOffset++] = b;

      indices[iOffset++] = b;
      indices[iOffset++] = c;
      indices[iOffset++] = d;
    }
  }

  // 3. Perimeter Skirts: Drop 25m down to seamlessly bridge any LOD height differences
  const skirtDepth = 25.0;
  let sVertIdx = planeVertsCount;

  const addSkirtSegment = (topIdxA: number, topIdxB: number) => {
    const bA = sVertIdx++;
    const bB = sVertIdx++;

    // Dropped bottom vertices
    positions[bA * 3] = positions[topIdxA * 3];
    positions[bA * 3 + 1] = positions[topIdxA * 3 + 1] - skirtDepth;
    positions[bA * 3 + 2] = positions[topIdxA * 3 + 2];

    positions[bB * 3] = positions[topIdxB * 3];
    positions[bB * 3 + 1] = positions[topIdxB * 3 + 1] - skirtDepth;
    positions[bB * 3 + 2] = positions[topIdxB * 3 + 2];

    uvs[bA * 2] = uvs[topIdxA * 2];
    uvs[bA * 2 + 1] = uvs[topIdxA * 2 + 1];
    uvs[bB * 2] = uvs[topIdxB * 2];
    uvs[bB * 2 + 1] = uvs[topIdxB * 2 + 1];

    indices[iOffset++] = topIdxA;
    indices[iOffset++] = bA;
    indices[iOffset++] = topIdxB;

    indices[iOffset++] = topIdxB;
    indices[iOffset++] = bA;
    indices[iOffset++] = bB;
  };

  // North border (iz = 0)
  for (let ix = 0; ix < segments; ix++) {
    const topA = ix;
    const topB = ix + 1;
    addSkirtSegment(topB, topA);
  }

  // South border (iz = segments)
  for (let ix = 0; ix < segments; ix++) {
    const topA = segments * numVertsX + ix;
    const topB = topA + 1;
    addSkirtSegment(topA, topB);
  }

  // West border (ix = 0)
  for (let iz = 0; iz < segments; iz++) {
    const topA = iz * numVertsX;
    const topB = (iz + 1) * numVertsX;
    addSkirtSegment(topA, topB);
  }

  // East border (ix = segments)
  for (let iz = 0; iz < segments; iz++) {
    const topA = iz * numVertsX + segments;
    const topB = (iz + 1) * numVertsX + segments;
    addSkirtSegment(topB, topA);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  chunkGeometryCache.set(key, geo);
  return geo;
}

export function Terrain() {
  const quality = useTrekStore((s) => s.quality);
  const playerPos = useTrekStore((s) => s.playerPos);
  const [activeChunks, setActiveChunks] = useState<ChunkInfo[]>([]);
  const lastChunkRef = useRef({ cx: 9999, cz: 9999 });

  // Load the 4 PBR texture sets (1K on low & medium, 2K on high)
  const textures = useTexture({
    grassColor: getTexturePath('grass', 'color.jpg', quality),
    grassAO: getTexturePath('grass', 'ao.jpg', quality),

    dirtColor: getTexturePath('dirt', 'color.jpg', quality),
    dirtAO: getTexturePath('dirt', 'ao.jpg', quality),

    rockColor: getTexturePath('rock', 'color.jpg', quality),
    rockAO: getTexturePath('rock', 'ao.jpg', quality),

    snowColor: getTexturePath('snow', 'color.jpg', quality),
    snowAO: getTexturePath('snow', 'ao.jpg', quality),
  });

  // Configure wrapping, mipmaps, and anisotropy
  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;

    configureTexture(textures.grassColor, true, aniso);
    configureTexture(textures.grassAO, false, aniso);

    configureTexture(textures.dirtColor, true, aniso);
    configureTexture(textures.dirtAO, false, aniso);

    configureTexture(textures.rockColor, true, aniso);
    configureTexture(textures.rockAO, false, aniso);

    configureTexture(textures.snowColor, true, aniso);
    configureTexture(textures.snowAO, false, aniso);
  }, [textures, quality]);

  // Dynamic chunk management: only re-evaluate on discrete chunk coordinate change
  const px = playerPos[0];
  const pz = playerPos[2];
  const curCx = Math.round(px / CHUNK_SIZE);
  const curCz = Math.round(pz / CHUNK_SIZE);

  useEffect(() => {
    if (curCx === lastChunkRef.current.cx && curCz === lastChunkRef.current.cz && activeChunks.length > 0) {
      return;
    }
    lastChunkRef.current = { cx: curCx, cz: curCz };

    const newChunks: ChunkInfo[] = [];

    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
      for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
        const cx = curCx + dx;
        const cz = curCz + dz;
        const distSq = dx * dx + dz * dz;
        const lod = getChunkLOD(distSq);
        const key = `${cx}_${cz}_${lod}`;

        createChunkGeometry(cx, cz, lod);
        newChunks.push({ key, cx, cz, lod });
      }
    }

    // Dispose distant geometries beyond range to free GPU memory
    for (const [key, geo] of chunkGeometryCache.entries()) {
      const parts = key.split('_');
      const cx = parseInt(parts[0], 10);
      const cz = parseInt(parts[1], 10);
      if (Math.abs(cx - curCx) > CHUNK_RADIUS + 2 || Math.abs(cz - curCz) > CHUNK_RADIUS + 2) {
        geo.dispose();
        chunkGeometryCache.delete(key);
      }
    }

    setActiveChunks(newChunks);
  }, [curCx, curCz, activeChunks.length]);

  // Optimized lightweight PBR splat material
  const terrainMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.FrontSide,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassColor = { value: textures.grassColor };
      shader.uniforms.uGrassAO = { value: textures.grassAO };
      shader.uniforms.uDirtColor = { value: textures.dirtColor };
      shader.uniforms.uDirtAO = { value: textures.dirtAO };
      shader.uniforms.uRockColor = { value: textures.rockColor };
      shader.uniforms.uRockAO = { value: textures.rockAO };
      shader.uniforms.uSnowColor = { value: textures.snowColor };
      shader.uniforms.uSnowAO = { value: textures.snowAO };
      shader.uniforms.uWorldScale = { value: WORLD_SCALE };

      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNorm = normalize(mat3(modelMatrix) * normal);
        `
      );

      shader.fragmentShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;

        uniform sampler2D uGrassColor;
        uniform sampler2D uGrassAO;
        uniform sampler2D uDirtColor;
        uniform sampler2D uDirtAO;
        uniform sampler2D uRockColor;
        uniform sampler2D uRockAO;
        uniform sampler2D uSnowColor;
        uniform sampler2D uSnowAO;
        uniform float uWorldScale;

        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float realAlt = vWorldPos.y / max(0.001, uWorldScale);
        float slope = 1.0 - abs(normalize(vWorldNorm).y);

        // Elevation and slope zoning
        float wSnow = smoothstep(3600.0, 4800.0, realAlt) * (1.0 - smoothstep(0.45, 0.75, slope));
        float wRock = smoothstep(0.26, 0.52, slope);

        if (realAlt > 4600.0) {
          wSnow = max(wSnow, smoothstep(4600.0, 5800.0, realAlt));
        }

        float wDirt = smoothstep(1800.0, 3200.0, realAlt) * (1.0 - wRock) * 0.35;
        float wGrass = max(0.0, (1.0 - smoothstep(3200.0, 3850.0, realAlt)) * (1.0 - (wRock + wSnow)));

        float totalW = wGrass + wDirt + wRock + wSnow + 0.0001;
        wGrass /= totalW;
        wDirt /= totalW;
        wRock /= totalW;
        wSnow /= totalW;

        // Distance culling for fine AO and secondary lookups (Drop beyond 45m)
        float distToCam = length(vWorldPos - cameraPosition);
        bool sampleAO = distToCam < 45.0;

        // Macro tint variation
        float macroNoise = sin(vWorldPos.x * 0.015 + sin(vWorldPos.z * 0.012) * 2.5) * 0.5 + 0.5;
        vec3 macroTint = mix(vec3(0.96, 1.04, 0.95), vec3(1.04, 0.98, 0.92), macroNoise);

        vec2 uvGround = vWorldPos.xz * 0.08;

        // Skip texture lookups for layers whose blend weight is near zero (< 0.02)
        vec4 colGrass = vec4(0.0);
        float aoGrass = 1.0;
        if (wGrass > 0.02) {
          colGrass = texture2D(uGrassColor, uvGround) * vec4(macroTint, 1.0);
          colGrass.rgb *= vec3(1.15, 1.25, 1.10);
          if (sampleAO) aoGrass = texture2D(uGrassAO, uvGround).r;
        }

        vec4 colDirt = vec4(0.0);
        float aoDirt = 1.0;
        if (wDirt > 0.02) {
          colDirt = texture2D(uDirtColor, uvGround * 1.3);
          colDirt.rgb *= vec3(1.10, 1.06, 1.02);
          if (sampleAO) aoDirt = texture2D(uDirtAO, uvGround * 1.3).r;
        }

        vec4 colSnow = vec4(0.0);
        float aoSnow = 1.0;
        if (wSnow > 0.02) {
          colSnow = texture2D(uSnowColor, uvGround * 0.8);
          colSnow.rgb *= vec3(1.08, 1.10, 1.14);
          if (sampleAO) aoSnow = texture2D(uSnowAO, uvGround * 0.8).r;
        }

        vec4 colRock = vec4(0.0);
        float aoRock = 1.0;
        if (wRock > 0.02) {
          float rockScale = 0.045;
          // Use triplanar only on steep slopes (> 0.65), cheaper planar elsewhere
          if (slope > 0.65) {
            vec3 triWeight = pow(abs(normalize(vWorldNorm)), vec3(4.0));
            triWeight /= (triWeight.x + triWeight.y + triWeight.z + 0.0001);
            colRock = texture2D(uRockColor, vWorldPos.zy * rockScale) * triWeight.x +
                      texture2D(uRockColor, vWorldPos.xz * rockScale) * triWeight.y +
                      texture2D(uRockColor, vWorldPos.xy * rockScale) * triWeight.z;
            if (sampleAO) {
              aoRock = texture2D(uRockAO, vWorldPos.zy * rockScale).r * triWeight.x +
                       texture2D(uRockAO, vWorldPos.xz * rockScale).r * triWeight.y +
                       texture2D(uRockAO, vWorldPos.xy * rockScale).r * triWeight.z;
            }
          } else {
            colRock = texture2D(uRockColor, vWorldPos.xz * rockScale);
            if (sampleAO) aoRock = texture2D(uRockAO, vWorldPos.xz * rockScale).r;
          }
          colRock.rgb *= vec3(1.18, 1.18, 1.22);
        }

        vec4 splatColor = colGrass * wGrass + colDirt * wDirt + colRock * wRock + colSnow * wSnow;
        if (sampleAO) {
          float blendedAO = aoGrass * wGrass + aoDirt * wDirt + aoRock * wRock + aoSnow * wSnow;
          splatColor.rgb *= mix(0.75, 1.0, blendedAO);
        }

        diffuseColor = splatColor;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = 0.82;
        `
      );
    };

    return mat;
  }, [textures]);

  return (
    <group>
      {activeChunks.map((chunk) => (
        <ChunkMesh
          key={chunk.key}
          cx={chunk.cx}
          cz={chunk.cz}
          lod={chunk.lod}
          material={terrainMaterial}
        />
      ))}
    </group>
  );
}

interface ChunkMeshProps {
  cx: number;
  cz: number;
  lod: 'high' | 'medium' | 'low';
  material: THREE.Material;
}

function ChunkMesh({ cx, cz, lod, material }: ChunkMeshProps) {
  const key = `${cx}_${cz}_${lod}`;
  const geometry = chunkGeometryCache.get(key);

  if (!geometry) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow={false}
    />
  );
}
