'use client';

import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { loadHeightmap, TERRAIN_BOUNDS, ORIGIN_GEO } from '@/lib/terrain';
import { WORLD_SCALE } from '@/lib/constants';

/**
 * Authentic Far-Field Himalayan Mountains
 * Downsampled 256x256 mesh built directly from the real-world 30m DEM (AWS Terrain Tiles).
 * Covers the entire 46km x 51km Annapurna Sanctuary region including:
 * - Annapurna I (8,091m)
 * - Machapuchare / Fishtail Peak (6,993m)
 * - Annapurna South (7,219m)
 * - Hiunchuli (6,441m)
 * - Gangapurna (7,455m)
 *
 * Uses lightweight vertex coloring by elevation & slope with polygon offset to eliminate z-fighting.
 */
export function Mountains() {
  const [heightmap, setHeightmap] = useState<Float32Array | null>(null);

  useEffect(() => {
    loadHeightmap().then((buf) => {
      setHeightmap(buf);
    });
  }, []);

  const mountainGeometry = useMemo(() => {
    if (!heightmap) return null;

    const GRID_SIZE = 256;
    const width = TERRAIN_BOUNDS.width; // 1536
    const height = TERRAIN_BOUNDS.height; // 1536
    const R = 6378137;
    const deg2rad = Math.PI / 180;
    const cosLat = Math.cos(ORIGIN_GEO.lat * deg2rad);

    const totalVerts = GRID_SIZE * GRID_SIZE;
    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);

    // Natural earthy Himalayan mountain colors
    const cValleyGreen = new THREE.Color('#34462b');
    const cForestDark = new THREE.Color('#283622');
    const cScreeRock = new THREE.Color('#4a4d46');
    const cCliffDark = new THREE.Color('#343632');
    const cSnowLedge = new THREE.Color('#cfdbe4');
    const cSnowSummit = new THREE.Color('#f4f8fc');

    const tempColor = new THREE.Color();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const u = c / (GRID_SIZE - 1);
        const v = r / (GRID_SIZE - 1);

        const imgX = Math.round(u * (width - 1));
        const imgY = Math.round(v * (height - 1));
        const elev = heightmap[imgY * width + imgX];

        // Geographic coordinates to local meters
        const lon = TERRAIN_BOUNDS.minLon + u * (TERRAIN_BOUNDS.maxLon - TERRAIN_BOUNDS.minLon);
        const lat = TERRAIN_BOUNDS.maxLat - v * (TERRAIN_BOUNDS.maxLat - TERRAIN_BOUNDS.minLat);

        const xMeters = (lon - ORIGIN_GEO.lon) * deg2rad * (R * cosLat);
        const zMeters = (ORIGIN_GEO.lat - lat) * deg2rad * R;

        const gameX = xMeters * WORLD_SCALE;
        const gameZ = zMeters * WORLD_SCALE;
        // Lower slightly (-0.8 units) to guarantee chunked terrain sits cleanly in front
        const gameY = elev * WORLD_SCALE - 0.8;

        positions[idx * 3] = gameX;
        positions[idx * 3 + 1] = gameY;
        positions[idx * 3 + 2] = gameZ;

        // Approximate slope from horizontal neighbors
        const cLeft = Math.max(0, c - 1);
        const cRight = Math.min(GRID_SIZE - 1, c + 1);
        const rUp = Math.max(0, r - 1);
        const rDown = Math.min(GRID_SIZE - 1, r + 1);

        const hL = heightmap[imgY * width + Math.round((cLeft / (GRID_SIZE - 1)) * (width - 1))];
        const hR = heightmap[imgY * width + Math.round((cRight / (GRID_SIZE - 1)) * (width - 1))];
        const hU = heightmap[Math.round((rUp / (GRID_SIZE - 1)) * (height - 1)) * width + imgX];
        const hD = heightmap[Math.round((rDown / (GRID_SIZE - 1)) * (height - 1)) * width + imgX];

        const slope = Math.min(1.0, (Math.abs(hR - hL) + Math.abs(hD - hU)) / 320.0);

        // Vertex coloring by authentic real elevation and slope
        if (elev < 2000) {
          tempColor.copy(cValleyGreen);
        } else if (elev < 3200) {
          const t = (elev - 2000) / 1200;
          tempColor.copy(cValleyGreen).lerp(cForestDark, t);
        } else if (elev < 4400) {
          const t = (elev - 3200) / 1200;
          tempColor.copy(cForestDark).lerp(cScreeRock, t);
        } else if (elev < 5400) {
          const t = (elev - 4400) / 1000;
          tempColor.copy(cScreeRock).lerp(cSnowLedge, t);
        } else {
          const t = Math.min(1.0, (elev - 5400) / 1400);
          tempColor.copy(cSnowLedge).lerp(cSnowSummit, t);
        }

        // Steep vertical cliffs shed snow and expose dark slate rock
        if (slope > 0.48) {
          const cliffFactor = Math.min(1.0, (slope - 0.48) / 0.35);
          tempColor.lerp(cCliffDark, cliffFactor * 0.85);
        }

        colors[idx * 3] = tempColor.r;
        colors[idx * 3 + 1] = tempColor.g;
        colors[idx * 3 + 2] = tempColor.b;
      }
    }

    // Indices for grid quads
    const indices = new Uint32Array((GRID_SIZE - 1) * (GRID_SIZE - 1) * 6);
    let iOffset = 0;
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      for (let c = 0; c < GRID_SIZE - 1; c++) {
        const topLeft = r * GRID_SIZE + c;
        const topRight = topLeft + 1;
        const bottomLeft = (r + 1) * GRID_SIZE + c;
        const bottomRight = bottomLeft + 1;

        indices[iOffset++] = topLeft;
        indices[iOffset++] = bottomLeft;
        indices[iOffset++] = topRight;

        indices[iOffset++] = topRight;
        indices[iOffset++] = bottomLeft;
        indices[iOffset++] = bottomRight;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    return geo;
  }, [heightmap]);

  const mountainMaterial = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: 4.0,
      polygonOffsetUnits: 4.0,
      fog: true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec3 vWorldPos;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      shader.fragmentShader = `
        varying vec3 vWorldPos;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        // Soft distance fade from camera (Requirement 0):
        // Within 230m, discard far-field mesh completely so it never shows through or clashes near player.
        // From 230m to 320m, apply a soft dither fade.
        float distCam = length(vWorldPos.xz - cameraPosition.xz);
        if (distCam < 230.0) {
          discard;
        } else if (distCam < 320.0) {
          float fade = smoothstep(230.0, 320.0, distCam);
          float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          if (dither > fade) {
            discard;
          }
        }
        `
      );
    };

    return mat;
  }, []);

  if (!mountainGeometry) return null;

  return (
    <mesh
      geometry={mountainGeometry}
      material={mountainMaterial}
      receiveShadow={false}
      castShadow={false}
    />
  );
}
