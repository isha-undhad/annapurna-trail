'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

interface PeakData {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  segments: number;
  rotationY: number;
}

export function Mountains() {
  const textures = useTexture({
    rockColor: '/textures/rock/color.jpg',
    rockNormal: '/textures/rock/normal.jpg',
    rockRough: '/textures/rock/roughness.jpg',
    snowColor: '/textures/snow/color.jpg',
    snowNormal: '/textures/snow/normal.jpg',
    snowRough: '/textures/snow/roughness.jpg',
  });

  useLayoutEffect(() => {
    Object.values(textures).forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
    });
    textures.rockColor.colorSpace = THREE.SRGBColorSpace;
    textures.snowColor.colorSpace = THREE.SRGBColorSpace;
  }, [textures]);

  const mountainGeometry = useMemo(() => {
    const peaks: PeakData[] = [
      // --- Prominent Distant Annapurna Sanctuary Giants (Framing the Valley) ---
      // Annapurna I (8,091m) - Colossal Central Massif
      { x: 0, y: 80, z: -640, radius: 195, height: 420, segments: 24, rotationY: 0.35 },
      // Annapurna South (7,219m)
      { x: -140, y: 75, z: -590, radius: 165, height: 370, segments: 22, rotationY: 0.9 },
      // Hiunchuli (6,441m)
      { x: -75, y: 65, z: -510, radius: 140, height: 320, segments: 20, rotationY: 1.4 },
      // Machapuchare / Fishtail Peak (6,993m) - Iconic Spire & Couloirs
      { x: 135, y: 75, z: -560, radius: 155, height: 380, segments: 22, rotationY: 2.1 },
      // Annapurna III & Gangapurna
      { x: 230, y: 70, z: -630, radius: 165, height: 350, segments: 20, rotationY: 0.75 },

      // --- Unbroken Far Northern Himalayan Barrier (No Sky Gap!) ---
      { x: -420, y: 55, z: -780, radius: 240, height: 400, segments: 18, rotationY: 0.2 },
      { x: -260, y: 65, z: -810, radius: 260, height: 430, segments: 20, rotationY: 1.1 },
      { x: -80, y: 75, z: -840, radius: 280, height: 460, segments: 22, rotationY: 0.5 },
      { x: 100, y: 75, z: -840, radius: 280, height: 460, segments: 22, rotationY: 1.8 },
      { x: 280, y: 65, z: -810, radius: 260, height: 430, segments: 20, rotationY: 0.9 },
      { x: 440, y: 55, z: -780, radius: 240, height: 400, segments: 18, rotationY: 2.3 },

      // --- Wide Valley Flanking Ridges (Set Well Back to Keep Valley Open) ---
      { x: -220, y: 15, z: -320, radius: 125, height: 190, segments: 18, rotationY: 0.6 },
      { x: -250, y: 10, z: -170, radius: 115, height: 160, segments: 16, rotationY: 1.2 },
      { x: 220, y: 15, z: -330, radius: 125, height: 190, segments: 18, rotationY: 2.0 },
      { x: 250, y: 10, z: -180, radius: 115, height: 160, segments: 16, rotationY: 0.8 },
    ];

    const groupGeometries: THREE.BufferGeometry[] = [];

    peaks.forEach((peak) => {
      const geo = new THREE.ConeGeometry(peak.radius, peak.height, peak.segments, 24, false);
      geo.rotateY(peak.rotationY);

      const pos = geo.attributes.position;
      const count = pos.count;
      const minY = -peak.height / 2;

      // Realistic Himalayan ridgeline noise deformation
      for (let i = 0; i < count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        const normalizedY = (y - minY) / peak.height;
        if (normalizedY < 0.96 && normalizedY > 0.04) {
          const angle = Math.atan2(z, x);
          // Sharp glacial arêtes and couloirs
          const ridge = Math.cos(angle * 4.0) * (peak.radius * 0.16) * Math.sin(normalizedY * Math.PI);
          const detail = Math.sin(y * 0.22 + angle * 2.0) * (peak.radius * 0.06);

          x += (x / (peak.radius || 1)) * (ridge + detail) * (1 - normalizedY * 0.8);
          z += (z / (peak.radius || 1)) * (ridge + detail) * (1 - normalizedY * 0.8);

          pos.setX(i, x);
          pos.setZ(i, z);
        }
      }

      geo.translate(peak.x, peak.y + peak.height / 2, peak.z);
      geo.computeVertexNormals();
      groupGeometries.push(geo);
    });

    // Merge into single buffer geometry for optimal performance
    let totalVerts = 0;
    groupGeometries.forEach((g) => {
      totalVerts += g.attributes.position.count;
    });

    const mergedPos = new Float32Array(totalVerts * 3);
    const mergedNormals = new Float32Array(totalVerts * 3);
    const mergedUVs = new Float32Array(totalVerts * 2);
    const mergedIndices: number[] = [];

    let vOffset = 0;
    groupGeometries.forEach((g) => {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const uv = g.attributes.uv;
      const idx = g.index;

      for (let i = 0; i < p.count; i++) {
        mergedPos[(vOffset + i) * 3] = p.getX(i);
        mergedPos[(vOffset + i) * 3 + 1] = p.getY(i);
        mergedPos[(vOffset + i) * 3 + 2] = p.getZ(i);

        mergedNormals[(vOffset + i) * 3] = n.getX(i);
        mergedNormals[(vOffset + i) * 3 + 1] = n.getY(i);
        mergedNormals[(vOffset + i) * 3 + 2] = n.getZ(i);

        if (uv) {
          mergedUVs[(vOffset + i) * 2] = uv.getX(i);
          mergedUVs[(vOffset + i) * 2 + 1] = uv.getY(i);
        }
      }

      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          mergedIndices.push(vOffset + idx.getX(i));
        }
      }

      vOffset += p.count;
      g.dispose();
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(mergedUVs, 2));
    merged.setIndex(mergedIndices);
    // Recompute vertex normals across merged surface for seamless lighting
    merged.computeVertexNormals();
    return merged;
  }, []);

  const mountainMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.72,
      metalness: 0.02,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRockColor = { value: textures.rockColor };
      shader.uniforms.uRockNormal = { value: textures.rockNormal };
      shader.uniforms.uRockRough = { value: textures.rockRough };
      shader.uniforms.uSnowColor = { value: textures.snowColor };
      shader.uniforms.uSnowNormal = { value: textures.snowNormal };
      shader.uniforms.uSnowRough = { value: textures.snowRough };

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
        uniform sampler2D uRockColor;
        uniform sampler2D uRockNormal;
        uniform sampler2D uRockRough;
        uniform sampler2D uSnowColor;
        uniform sampler2D uSnowNormal;
        uniform sampler2D uSnowRough;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        float slope = 1.0 - abs(normalize(vWorldNorm).y);
        float alt = vWorldPos.y;

        // Altitude snow blanket: begins above 70m, heavily covers upper massifs
        float snowAlt = smoothstep(70.0, 140.0, alt);
        // Snow adheres to ledges and slopes up to ~75 degrees
        float snowSlope = 1.0 - smoothstep(0.58, 0.95, slope);
        // Colossal summits (>150m) are predominantly snow and glacial ice
        float summitSnow = smoothstep(140.0, 260.0, alt) * 0.92;
        float snowFactor = clamp(snowAlt * snowSlope + summitSnow, 0.0, 1.0);

        vec2 uvDense = vWorldPos.xz * 0.02;
        vec2 uvSparse = vWorldPos.xz * 0.004;

        vec4 rockCol = mix(texture2D(uRockColor, uvDense), texture2D(uRockColor, uvSparse), 0.45);
        vec4 snowCol = mix(texture2D(uSnowColor, uvDense), texture2D(uSnowColor, uvSparse), 0.35);

        // Brighten alpine rock in morning sun, prevent black shadowing
        rockCol.rgb = mix(rockCol.rgb, rockCol.rgb * vec3(1.30, 1.30, 1.35), 0.5);
        // Glistening bright white snow
        snowCol.rgb = mix(snowCol.rgb, vec3(1.05, 1.08, 1.12), 0.4);

        vec4 blendedCol = mix(rockCol, snowCol, snowFactor);
        diffuseColor = blendedCol;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        float rRock = texture2D(uRockRough, uvDense).r;
        float rSnow = texture2D(uSnowRough, uvDense).r;
        roughnessFactor = mix(rRock, rSnow, snowFactor) * 0.8;
        `
      );
    };

    return mat;
  }, [textures]);

  return (
    <mesh geometry={mountainGeometry} material={mountainMaterial} castShadow receiveShadow />
  );
}
