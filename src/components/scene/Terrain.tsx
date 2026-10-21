'use client';

import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, isHeightmapLoaded, WAYPOINTS } from '@/lib/terrain';
import { WORLD_SCALE } from '@/lib/constants';
import { useTrekStore } from '@/store/useTrekStore';
import { getTexturePath, configureTexture } from '@/lib/textures';

// Chunk size in game units (~500 real meters per chunk)
const CHUNK_SIZE = 120;
// Render chunk radius around player
const CHUNK_RADIUS = 3; // 7x7 grid = 49 chunks around player

interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
  lod: 'high' | 'medium' | 'low';
}

function getChunkLOD(distSq: number): 'high' | 'medium' | 'low' {
  if (distSq <= 1.5 * 1.5) return 'high';
  if (distSq <= 2.8 * 2.8) return 'medium';
  return 'low';
}

function createChunkGeometry(cx: number, cz: number, lod: 'high' | 'medium' | 'low') {
  const segments = lod === 'high' ? 36 : lod === 'medium' ? 18 : 10;
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const worldOffsetX = cx * CHUNK_SIZE;
  const worldOffsetZ = cz * CHUNK_SIZE;
  geo.translate(worldOffsetX, 0, worldOffsetZ);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);
  }

  geo.computeVertexNormals();
  return geo;
}

export function Terrain() {
  const quality = useTrekStore((s) => s.quality);
  const playerPos = useTrekStore((s) => s.playerPos);
  const [activeChunks, setActiveChunks] = useState<ChunkInfo[]>([]);
  const lastChunkRef = useRef({ cx: 9999, cz: 9999 });

  // Load the 4 PBR texture sets from /public/textures (1K on low, 2K on medium/high)
  const textures = useTexture({
    grassColor: getTexturePath('grass', 'color.jpg', quality),
    grassNormal: getTexturePath('grass', 'normal.jpg', quality),
    grassRough: getTexturePath('grass', 'roughness.jpg', quality),
    grassAO: getTexturePath('grass', 'ao.jpg', quality),

    dirtColor: getTexturePath('dirt', 'color.jpg', quality),
    dirtNormal: getTexturePath('dirt', 'normal.jpg', quality),
    dirtRough: getTexturePath('dirt', 'roughness.jpg', quality),
    dirtAO: getTexturePath('dirt', 'ao.jpg', quality),

    rockColor: getTexturePath('rock', 'color.jpg', quality),
    rockNormal: getTexturePath('rock', 'normal.jpg', quality),
    rockRough: getTexturePath('rock', 'roughness.jpg', quality),
    rockAO: getTexturePath('rock', 'ao.jpg', quality),

    snowColor: getTexturePath('snow', 'color.jpg', quality),
    snowNormal: getTexturePath('snow', 'normal.jpg', quality),
    snowRough: getTexturePath('snow', 'roughness.jpg', quality),
    snowAO: getTexturePath('snow', 'ao.jpg', quality),
  });

  // Configure wrapping, mipmaps, and anisotropy
  useLayoutEffect(() => {
    const aniso = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;

    configureTexture(textures.grassColor, true, aniso);
    configureTexture(textures.grassNormal, false, aniso);
    configureTexture(textures.grassRough, false, aniso);
    configureTexture(textures.grassAO, false, aniso);

    configureTexture(textures.dirtColor, true, aniso);
    configureTexture(textures.dirtNormal, false, aniso);
    configureTexture(textures.dirtRough, false, aniso);
    configureTexture(textures.dirtAO, false, aniso);

    configureTexture(textures.rockColor, true, aniso);
    configureTexture(textures.rockNormal, false, aniso);
    configureTexture(textures.rockRough, false, aniso);
    configureTexture(textures.rockAO, false, aniso);

    configureTexture(textures.snowColor, true, aniso);
    configureTexture(textures.snowNormal, false, aniso);
    configureTexture(textures.snowRough, false, aniso);
    configureTexture(textures.snowAO, false, aniso);
  }, [textures, quality]);

  // Dynamic chunk management centered on player
  useEffect(() => {
    const px = playerPos[0];
    const pz = playerPos[2];
    const curCx = Math.round(px / CHUNK_SIZE);
    const curCz = Math.round(pz / CHUNK_SIZE);

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
        newChunks.push({
          key: `${cx}_${cz}_${lod}`,
          cx,
          cz,
          lod,
        });
      }
    }
    setActiveChunks(newChunks);
  }, [playerPos, activeChunks.length]);

  // Robust PBR splat material with triplanar rock, macro variation, and real elevation zoning
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
        // 1. REAL ELEVATION & SLOPE ZONING
        float realAlt = vWorldPos.y / max(0.001, uWorldScale);
        float slope = 1.0 - abs(normalize(vWorldNorm).y);

        // Zone 1: below 2,000m: green farmland and meadow
        // Zone 2: 2,000 to 3,200m: dense forest floor & trail dirt
        // Zone 3: 3,200 to 3,800m: alpine meadow & rock moraine
        // Zone 4: above 3,800m: barren rock, moraine, snow patches
        // Zone 5: high peaks (>4,800m): permanent snow and glacial ice

        float wSnow = smoothstep(3600.0, 4800.0, realAlt) * (1.0 - smoothstep(0.45, 0.75, slope));
        float wRock = smoothstep(0.26, 0.52, slope);

        // High peaks permanent snow
        if (realAlt > 4600.0) {
          wSnow = max(wSnow, smoothstep(4600.0, 5800.0, realAlt));
        }

        // Dirt trail along valley floor
        float wDirt = smoothstep(1800.0, 3200.0, realAlt) * (1.0 - wRock) * 0.35;

        // Meadow grass on remaining slopes below 3,800m
        float wGrass = max(0.0, (1.0 - smoothstep(3200.0, 3850.0, realAlt)) * (1.0 - (wRock + wSnow)));

        float totalW = wGrass + wDirt + wRock + wSnow + 0.0001;
        wGrass /= totalW;
        wDirt /= totalW;
        wRock /= totalW;
        wSnow /= totalW;

        // 2. Macro color variation noise across valley (hides repetition)
        float macroNoise = sin(vWorldPos.x * 0.015 + sin(vWorldPos.z * 0.012) * 2.5) * 0.5 + 0.5;
        vec3 macroTint = mix(vec3(0.96, 1.04, 0.95), vec3(1.04, 0.98, 0.92), macroNoise);

        // 3. Ground texture sampling with dual UV scaling
        vec2 uvDense = vWorldPos.xz * 0.12;
        vec2 uvSparse = vWorldPos.xz * 0.022;

        vec4 colGrass = mix(texture2D(uGrassColor, uvDense), texture2D(uGrassColor, uvSparse), 0.35) * vec4(macroTint, 1.0);
        float aoGrass = texture2D(uGrassAO, uvDense).r;

        vec4 colDirt  = mix(texture2D(uDirtColor, uvDense * 1.3), texture2D(uDirtColor, uvSparse), 0.30);
        float aoDirt  = texture2D(uDirtAO, uvDense * 1.3).r;

        vec4 colSnow  = mix(texture2D(uSnowColor, uvDense * 0.8), texture2D(uSnowColor, uvSparse), 0.32);
        float aoSnow  = texture2D(uSnowAO, uvDense * 0.8).r;

        // 4. Triplanar mapping for steep rock cliff faces (zero stretching)
        vec3 triWeight = pow(abs(normalize(vWorldNorm)), vec3(4.0));
        triWeight /= (triWeight.x + triWeight.y + triWeight.z + 0.0001);

        float rockScale = 0.045;
        vec4 colRock = texture2D(uRockColor, vWorldPos.zy * rockScale) * triWeight.x +
                       texture2D(uRockColor, vWorldPos.xz * rockScale) * triWeight.y +
                       texture2D(uRockColor, vWorldPos.xy * rockScale) * triWeight.z;
        float aoRock = texture2D(uRockAO, vWorldPos.zy * rockScale).r * triWeight.x +
                       texture2D(uRockAO, vWorldPos.xz * rockScale).r * triWeight.y +
                       texture2D(uRockAO, vWorldPos.xy * rockScale).r * triWeight.z;

        // Natural sunlight boost
        colGrass.rgb *= vec3(1.15, 1.25, 1.10);
        colDirt.rgb  *= vec3(1.10, 1.06, 1.02);
        colRock.rgb  *= vec3(1.18, 1.18, 1.22);
        colSnow.rgb  *= vec3(1.08, 1.10, 1.14);

        // Blended PBR color and AO
        vec4 splatColor = colGrass * wGrass + colDirt * wDirt + colRock * wRock + colSnow * wSnow;
        float blendedAO = aoGrass * wGrass + aoDirt * wDirt + aoRock * wRock + aoSnow * wSnow;
        splatColor.rgb *= mix(0.75, 1.0, blendedAO);

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
  const meshRef = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(() => {
    return createChunkGeometry(cx, cz, lod);
  }, [cx, cz, lod]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow={lod === 'high'}
    />
  );
}
