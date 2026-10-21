'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { getTerrainHeight, WORLD_BOUNDS } from '@/lib/terrain';

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Load the 4 PBR texture sets from /public/textures
  const textures = useTexture({
    grassColor: '/textures/grass/color.jpg',
    grassNormal: '/textures/grass/normal.jpg',
    grassRough: '/textures/grass/roughness.jpg',

    dirtColor: '/textures/dirt/color.jpg',
    dirtNormal: '/textures/dirt/normal.jpg',
    dirtRough: '/textures/dirt/roughness.jpg',

    rockColor: '/textures/rock/color.jpg',
    rockNormal: '/textures/rock/normal.jpg',
    rockRough: '/textures/rock/roughness.jpg',

    snowColor: '/textures/snow/color.jpg',
    snowNormal: '/textures/snow/normal.jpg',
    snowRough: '/textures/snow/roughness.jpg',
  });

  // Configure wrapping, mipmaps, and anisotropy
  useLayoutEffect(() => {
    Object.values(textures).forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
    });

    textures.grassColor.colorSpace = THREE.SRGBColorSpace;
    textures.dirtColor.colorSpace = THREE.SRGBColorSpace;
    textures.rockColor.colorSpace = THREE.SRGBColorSpace;
    textures.snowColor.colorSpace = THREE.SRGBColorSpace;
  }, [textures]);

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

  // Material with custom shader blending the 4 PBR textures by height & slope
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.02,
    });

    mat.onBeforeCompile = (shader) => {
      // Pass texture uniforms
      shader.uniforms.uGrassColor = { value: textures.grassColor };
      shader.uniforms.uGrassNormal = { value: textures.grassNormal };
      shader.uniforms.uGrassRough = { value: textures.grassRough };

      shader.uniforms.uDirtColor = { value: textures.dirtColor };
      shader.uniforms.uDirtNormal = { value: textures.dirtNormal };
      shader.uniforms.uDirtRough = { value: textures.dirtRough };

      shader.uniforms.uRockColor = { value: textures.rockColor };
      shader.uniforms.uRockNormal = { value: textures.rockNormal };
      shader.uniforms.uRockRough = { value: textures.rockRough };

      shader.uniforms.uSnowColor = { value: textures.snowColor };
      shader.uniforms.uSnowNormal = { value: textures.snowNormal };
      shader.uniforms.uSnowRough = { value: textures.snowRough };

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

        uniform sampler2D uDirtColor;
        uniform sampler2D uDirtNormal;
        uniform sampler2D uDirtRough;

        uniform sampler2D uRockColor;
        uniform sampler2D uRockNormal;
        uniform sampler2D uRockRough;

        uniform sampler2D uSnowColor;
        uniform sampler2D uSnowNormal;
        uniform sampler2D uSnowRough;

        ${shader.fragmentShader}
      `;

      // Custom color map blending
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        // 1. Trail path calculation in GLSL
        float pathX = sin(vWorldPosition.z * 0.026) * 18.0 +
                      sin(vWorldPosition.z * 0.062 + 1.1) * 7.0 +
                      cos(vWorldPosition.z * 0.014) * 4.5;
        float distToPath = abs(vWorldPosition.x - pathX);

        // 2. Slope & Altitude
        float slope = 1.0 - abs(normalize(vWorldNormal).y);
        float alt = vWorldPosition.y;

        // 3. Multi-layer weights
        // Trail dirt along path center
        float wDirt = 1.0 - smoothstep(1.6, 4.2, distToPath);
        // Rock on steep slopes
        float wRock = smoothstep(0.24, 0.58, slope);
        // Snow at high altitude (above ~23m) on gentle/medium slopes
        float wSnow = smoothstep(21.0, 34.0, alt) * (1.0 - smoothstep(0.48, 0.75, slope));
        // Grass on remaining gentle valley slopes
        float wGrass = max(0.0, 1.0 - (wDirt * 0.9 + wRock + wSnow));

        // Normalize weights
        float totalWeight = wDirt + wRock + wSnow + wGrass + 0.0001;
        wDirt /= totalWeight;
        wRock /= totalWeight;
        wSnow /= totalWeight;
        wGrass /= totalWeight;

        // 4. Dual-scale UV tiling to eliminate obvious tiling repetition
        vec2 uvDense = vWorldPosition.xz * 0.14;
        vec2 uvSparse = vWorldPosition.xz * 0.038;

        vec4 colGrass = mix(texture2D(uGrassColor, uvDense), texture2D(uGrassColor, uvSparse), 0.38);
        vec4 colDirt  = mix(texture2D(uDirtColor, uvDense), texture2D(uDirtColor, uvSparse), 0.35);
        vec4 colRock  = mix(texture2D(uRockColor, uvDense), texture2D(uRockColor, uvSparse), 0.42);
        vec4 colSnow  = mix(texture2D(uSnowColor, uvDense), texture2D(uSnowColor, uvSparse), 0.32);

        // Boost meadow greens, trail dirt, and rock tones for crisp morning sunlight
        colGrass.rgb = mix(colGrass.rgb, colGrass.rgb * vec3(1.22, 1.35, 1.15), 0.65);
        colDirt.rgb  = mix(colDirt.rgb, colDirt.rgb * vec3(1.15, 1.10, 1.05), 0.5);
        colRock.rgb  = mix(colRock.rgb, colRock.rgb * vec3(1.25, 1.25, 1.30), 0.45);
        colSnow.rgb  = mix(colSnow.rgb, colSnow.rgb * vec3(1.08, 1.12, 1.18), 0.5);

        vec4 splatColor = colGrass * wGrass + colDirt * wDirt + colRock * wRock + colSnow * wSnow;
        diffuseColor = splatColor;
        `
      );

      // Custom roughness map blending
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        float rGrass = texture2D(uGrassRough, uvDense).r;
        float rDirt  = texture2D(uDirtRough, uvDense).r;
        float rRock  = texture2D(uRockRough, uvDense).r;
        float rSnow  = texture2D(uSnowRough, uvDense).r;

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
