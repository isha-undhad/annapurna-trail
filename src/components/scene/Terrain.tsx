'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, WORLD_BOUNDS } from '@/lib/terrain';
import { useTrekStore } from '@/store/useTrekStore';
import { getTexturePath, configureTexture } from '@/lib/textures';

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const quality = useTrekStore((s) => s.quality);

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

  // Generate dense heightfield mesh centered over full world bounds (X: ±180, Z: -290 to +130)
  const geometry = useMemo(() => {
    const width = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX + 60; // 360
    const depth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ + 60; // 420
    const centerZ = (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2; // -80

    const geo = new THREE.PlaneGeometry(width, depth, 150, 180);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, centerZ);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  // Material with triplanar rock mapping, macro color variation, and soft trail blending
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0.02,
    });

    mat.onBeforeCompile = (shader) => {
      // Pass texture uniforms
      shader.uniforms.uGrassColor = { value: textures.grassColor };
      shader.uniforms.uGrassNormal = { value: textures.grassNormal };
      shader.uniforms.uGrassRough = { value: textures.grassRough };
      shader.uniforms.uGrassAO = { value: textures.grassAO };

      shader.uniforms.uDirtColor = { value: textures.dirtColor };
      shader.uniforms.uDirtNormal = { value: textures.dirtNormal };
      shader.uniforms.uDirtRough = { value: textures.dirtRough };
      shader.uniforms.uDirtAO = { value: textures.dirtAO };

      shader.uniforms.uRockColor = { value: textures.rockColor };
      shader.uniforms.uRockNormal = { value: textures.rockNormal };
      shader.uniforms.uRockRough = { value: textures.rockRough };
      shader.uniforms.uRockAO = { value: textures.rockAO };

      shader.uniforms.uSnowColor = { value: textures.snowColor };
      shader.uniforms.uSnowNormal = { value: textures.snowNormal };
      shader.uniforms.uSnowRough = { value: textures.snowRough };
      shader.uniforms.uSnowAO = { value: textures.snowAO };

      // Vertex shader injections
      shader.vertexShader = `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        `
      );

      // Fragment shader injections
      shader.fragmentShader = `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        uniform sampler2D uGrassColor;
        uniform sampler2D uGrassNormal;
        uniform sampler2D uGrassRough;
        uniform sampler2D uGrassAO;

        uniform sampler2D uDirtColor;
        uniform sampler2D uDirtNormal;
        uniform sampler2D uDirtRough;
        uniform sampler2D uDirtAO;

        uniform sampler2D uRockColor;
        uniform sampler2D uRockNormal;
        uniform sampler2D uRockRough;
        uniform sampler2D uRockAO;

        uniform sampler2D uSnowColor;
        uniform sampler2D uSnowNormal;
        uniform sampler2D uSnowRough;
        uniform sampler2D uSnowAO;

        ${shader.fragmentShader}
      `;

      // Custom color map blending with triplanar rock & macro variation
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        // 1. Trail path calculation in GLSL
        float pathX = sin(vWorldPosition.z * 0.026) * 18.0 +
                      sin(vWorldPosition.z * 0.062 + 1.1) * 7.0 +
                      cos(vWorldPosition.z * 0.014) * 4.5;
        float distToPath = abs(vWorldPosition.x - pathX);

        // Soft organic trail dirt edge perturbation
        float trailPerturb = sin(vWorldPosition.z * 0.28) * 0.35 + cos(vWorldPosition.x * 0.45) * 0.25;
        float organicDist = distToPath + trailPerturb;
        float wDirt = 1.0 - smoothstep(1.3, 4.4, organicDist);

        // 2. Slope & Altitude
        float slope = 1.0 - abs(normalize(vWorldNormal).y);
        float alt = vWorldPosition.y;

        // Rock on steep slopes
        float wRock = smoothstep(0.24, 0.55, slope);
        // Snow at high altitude (above ~22m) on gentle/medium slopes
        float wSnow = smoothstep(21.0, 34.0, alt) * (1.0 - smoothstep(0.48, 0.75, slope));
        // Grass on remaining gentle valley slopes
        float wGrass = max(0.0, 1.0 - (wDirt * 0.92 + wRock + wSnow));

        // Normalize weights
        float totalWeight = wDirt + wRock + wSnow + wGrass + 0.0001;
        wDirt /= totalWeight;
        wRock /= totalWeight;
        wSnow /= totalWeight;
        wGrass /= totalWeight;

        // 3. Large-Scale Macro Color Variation across terrain (hides tiling)
        float macroNoise = sin(vWorldPosition.x * 0.018 + sin(vWorldPosition.z * 0.015) * 2.5) * 0.5 + 0.5;
        vec3 macroTint = mix(vec3(0.96, 1.04, 0.95), vec3(1.04, 0.98, 0.92), macroNoise);

        // 4. Ground textures with dual-scale UV tiling
        vec2 uvDense = vWorldPosition.xz * 0.12;
        vec2 uvSparse = vWorldPosition.xz * 0.022;

        vec4 colGrass = mix(texture2D(uGrassColor, uvDense), texture2D(uGrassColor, uvSparse), 0.35) * vec4(macroTint, 1.0);
        float aoGrass = texture2D(uGrassAO, uvDense).r;

        vec4 colDirt  = mix(texture2D(uDirtColor, uvDense * 1.3), texture2D(uDirtColor, uvSparse), 0.30);
        float aoDirt  = texture2D(uDirtAO, uvDense * 1.3).r;

        vec4 colSnow  = mix(texture2D(uSnowColor, uvDense * 0.8), texture2D(uSnowColor, uvSparse), 0.32);
        float aoSnow  = texture2D(uSnowAO, uvDense * 0.8).r;

        // 5. TRIPLANAR MAPPING FOR ROCK (Eliminates stretching on steep cliff faces)
        vec3 triWeight = pow(abs(normalize(vWorldNormal)), vec3(4.0));
        triWeight /= (triWeight.x + triWeight.y + triWeight.z + 0.0001);

        float rockScale = 0.045;
        vec2 uvRockX = vWorldPosition.zy * rockScale;
        vec2 uvRockY = vWorldPosition.xz * rockScale;
        vec2 uvRockZ = vWorldPosition.xy * rockScale;

        vec4 colRock = texture2D(uRockColor, uvRockX) * triWeight.x +
                       texture2D(uRockColor, uvRockY) * triWeight.y +
                       texture2D(uRockColor, uvRockZ) * triWeight.z;
        float aoRock = texture2D(uRockAO, uvRockX).r * triWeight.x +
                       texture2D(uRockAO, uvRockY).r * triWeight.y +
                       texture2D(uRockAO, uvRockZ).r * triWeight.z;

        // Natural sunlight boost
        colGrass.rgb *= vec3(1.18, 1.28, 1.12);
        colDirt.rgb  *= vec3(1.12, 1.08, 1.04);
        colRock.rgb  *= vec3(1.20, 1.20, 1.24);

        // Splat color & AO integration
        vec4 splatColor = colGrass * wGrass + colDirt * wDirt + colRock * wRock + colSnow * wSnow;
        float blendedAO = aoGrass * wGrass + aoDirt * wDirt + aoRock * wRock + aoSnow * wSnow;
        splatColor.rgb *= mix(0.72, 1.0, blendedAO);

        diffuseColor = splatColor;
        `
      );

      // Custom roughness map blending
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        float rGrass = texture2D(uGrassRough, uvDense).r;
        float rDirt  = texture2D(uDirtRough, uvDense * 1.3).r;
        float rRock  = texture2D(uRockRough, uvRockX).r * triWeight.x +
                       texture2D(uRockRough, uvRockY).r * triWeight.y +
                       texture2D(uRockRough, uvRockZ).r * triWeight.z;
        float rSnow  = texture2D(uSnowRough, uvDense * 0.8).r;

        roughnessFactor = rGrass * wGrass + rDirt * wDirt + rRock * wRock + rSnow * wSnow;
        `
      );
    };

    return mat;
  }, [textures]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow
    />
  );
}
