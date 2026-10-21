/**
 * Real-World Terrain & Path Library for Annapurna Base Camp (ABC) Trek
 * Sourced from open data:
 * - Elevation: AWS Terrain Tiles (Terrarium, Zoom 12, ~30m DEM)
 * - Route & Villages: OpenStreetMap (Relation 17548991 & Overpass API)
 */

import { WORLD_SCALE, PLAYER_EYE_HEIGHT } from './constants';
import terrainMeta from '../../public/data/terrain-meta.json';

// Elevation grid metadata
export const TERRAIN_BOUNDS = terrainMeta.bounds;
export const ORIGIN_GEO = terrainMeta.origin;

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
  elevation: number; // Real meters
  x: number;         // Local meters from Nayapul
  z: number;         // Local meters from Nayapul
  gameX: number;     // Game units (x * WORLD_SCALE)
  gameZ: number;     // Game units (z * WORLD_SCALE)
  gameY: number;     // Game units (elevation * WORLD_SCALE)
  routeDistanceMeters: number; // Cumulative meters along trail route from Nayapul
}

export interface TrailPoint {
  x: number;         // Local meters
  z: number;         // Local meters
  elevation: number; // Real meters
  gameX: number;     // Game units
  gameZ: number;     // Game units
  gameY: number;     // Game units
}

// Transform trail polyline to game units
export const TRAIL_POLYLINE: TrailPoint[] = terrainMeta.trail.map((p) => ({
  ...p,
  gameX: Math.round(p.x * WORLD_SCALE * 10) / 10,
  gameZ: Math.round(p.z * WORLD_SCALE * 10) / 10,
  gameY: Math.round(p.elevation * WORLD_SCALE * 10) / 10,
}));

// Precalculate cumulative distances along trail polyline in real meters
export const TRAIL_CUMULATIVE_METERS: number[] = new Array(TRAIL_POLYLINE.length);
TRAIL_CUMULATIVE_METERS[0] = 0;
for (let i = 1; i < TRAIL_POLYLINE.length; i++) {
  const dx = TRAIL_POLYLINE[i].x - TRAIL_POLYLINE[i - 1].x;
  const dz = TRAIL_POLYLINE[i].z - TRAIL_POLYLINE[i - 1].z;
  const segDist = Math.hypot(dx, dz);
  TRAIL_CUMULATIVE_METERS[i] = TRAIL_CUMULATIVE_METERS[i - 1] + segDist;
}

/**
 * Calculates current progress along the trail route in real meters from Nayapul
 */
export function getTrailProgressMeters(gameX: number, gameZ: number): number {
  let minDistSq = Infinity;
  let bestProgress = 0;

  for (let i = 0; i < TRAIL_POLYLINE.length - 1; i++) {
    const p1 = TRAIL_POLYLINE[i];
    const p2 = TRAIL_POLYLINE[i + 1];

    const vx = p2.gameX - p1.gameX;
    const vz = p2.gameZ - p1.gameZ;
    const wx = gameX - p1.gameX;
    const wz = gameZ - p1.gameZ;

    const c1 = wx * vx + wz * vz;
    let t = 0;
    if (c1 > 0) {
      const c2 = vx * vx + vz * vz;
      t = c2 > 0 ? Math.min(1.0, c1 / c2) : 0;
    }

    const projX = p1.gameX + t * vx;
    const projZ = p1.gameZ + t * vz;
    const dx = gameX - projX;
    const dz = gameZ - projZ;
    const dSq = dx * dx + dz * dz;

    if (dSq < minDistSq) {
      minDistSq = dSq;
      const segStartM = TRAIL_CUMULATIVE_METERS[i];
      const segEndM = TRAIL_CUMULATIVE_METERS[i + 1];
      bestProgress = segStartM + t * (segEndM - segStartM);
    }
  }

  return bestProgress;
}

// Transform waypoints to game units with route distance
export const WAYPOINTS: Waypoint[] = terrainMeta.waypoints.map((wp) => {
  const gameX = Math.round(wp.x * WORLD_SCALE * 10) / 10;
  const gameZ = Math.round(wp.z * WORLD_SCALE * 10) / 10;
  const gameY = Math.round(wp.elevation * WORLD_SCALE * 10) / 10;
  const routeDistanceMeters = Math.round(getTrailProgressMeters(gameX, gameZ));
  return {
    ...wp,
    gameX,
    gameZ,
    gameY,
    routeDistanceMeters,
  };
});

/**
 * Finds the next upcoming waypoint in chronological route order along the trail,
 * and the remaining distance along the trail route to reach it.
 */
export function getNextRouteWaypoint(gameX: number, gameZ: number): { nextWaypoint: Waypoint; distanceAlongRouteMeters: number } {
  const playerProgress = getTrailProgressMeters(gameX, gameZ);

  // Traverse waypoints strictly in route order (0: Nayapul -> 16: ABC)
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const wp = WAYPOINTS[i];
    // If waypoint is ahead of player by more than 25m along route
    if (wp.routeDistanceMeters > playerProgress + 25) {
      const dist = Math.max(0, Math.round(wp.routeDistanceMeters - playerProgress));
      return { nextWaypoint: wp, distanceAlongRouteMeters: dist };
    }
  }

  // End of trek: Annapurna Base Camp
  const lastWp = WAYPOINTS[WAYPOINTS.length - 1];
  const dist = Math.max(0, Math.round(lastWp.routeDistanceMeters - playerProgress));
  return { nextWaypoint: lastWp, distanceAlongRouteMeters: dist };
}

// Playable world bounds in game units (covering the whole ABC sanctuary route)
export const WORLD_BOUNDS = {
  minX: Math.min(...WAYPOINTS.map((w) => w.gameX)) - 800,
  maxX: Math.max(...WAYPOINTS.map((w) => w.gameX)) + 800,
  minZ: Math.min(...WAYPOINTS.map((w) => w.gameZ)) - 600,
  maxZ: Math.max(...WAYPOINTS.map((w) => w.gameZ)) + 600,
};

// Player start position at Nayapul trailhead (game units)
// Nayapul is at (0, 0), real elevation 1035m -> gameY = 207.0
export const START_POSITION: [number, number, number] = [
  0,
  WAYPOINTS[0].gameY + PLAYER_EYE_HEIGHT,
  0,
];

// In-memory Float32Array heightmap
let heightmapBuffer: Float32Array | null = null;
let heightmapLoadPromise: Promise<Float32Array> | null = null;

/**
 * Loads the 1536x1536 Float32Array heightmap binary (9 MB).
 * Safe to call multiple times; caches result in memory.
 */
export async function loadHeightmap(): Promise<Float32Array> {
  if (heightmapBuffer) return heightmapBuffer;
  if (heightmapLoadPromise) return heightmapLoadPromise;

  if (typeof window === 'undefined') {
    // In SSR, return empty array to prevent build failures
    return new Float32Array(TERRAIN_BOUNDS.width * TERRAIN_BOUNDS.height);
  }

  heightmapLoadPromise = (async () => {
    try {
      console.log('Loading baked real-world heightmap (9 MB)...');
      const res = await fetch('/data/heightmap.bin');
      if (!res.ok) throw new Error(`Heightmap fetch failed: ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      heightmapBuffer = new Float32Array(arrayBuf);
      console.log('Real-world heightmap loaded and ready in memory.');
      return heightmapBuffer;
    } catch (err) {
      console.error('Failed to load heightmap binary:', err);
      heightmapBuffer = new Float32Array(TERRAIN_BOUNDS.width * TERRAIN_BOUNDS.height);
      return heightmapBuffer;
    }
  })();

  return heightmapLoadPromise;
}

export function isHeightmapLoaded(): boolean {
  return heightmapBuffer !== null;
}

// Auto-trigger load on client immediately
if (typeof window !== 'undefined') {
  loadHeightmap();
}

/**
 * Fast 2D procedural noise for fine micro-detail on top of 30m DEM
 */
function hash2D(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fz * fz * (3.0 - 2.0 * fz);

  const a = hash2D(i, j);
  const b = hash2D(i + 1, j);
  const c = hash2D(i, j + 1);
  const d = hash2D(i + 1, j + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/**
 * Bilinear sampling of the 1536x1536 real-world DEM heightmap.
 * Converts local meters back to geographic lat/lon to sample the grid.
 */
export function sampleDEM(xMeters: number, zMeters: number): number {
  if (!heightmapBuffer) {
    // Fallback before binary finishes loading: interpolate between nearest trail points
    return sampleTrailElevation(xMeters, zMeters);
  }

  const R = 6378137;
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const cosLat = Math.cos(ORIGIN_GEO.lat * deg2rad);

  const lat = ORIGIN_GEO.lat - (zMeters / R) * rad2deg;
  const lon = ORIGIN_GEO.lon + (xMeters / (R * cosLat)) * rad2deg;

  const u = (lon - TERRAIN_BOUNDS.minLon) / (TERRAIN_BOUNDS.maxLon - TERRAIN_BOUNDS.minLon);
  const v = (TERRAIN_BOUNDS.maxLat - lat) / (TERRAIN_BOUNDS.maxLat - TERRAIN_BOUNDS.minLat);

  const width = TERRAIN_BOUNDS.width;
  const height = TERRAIN_BOUNDS.height;

  const fx = Math.max(0, Math.min(width - 1.001, u * (width - 1)));
  const fy = Math.max(0, Math.min(height - 1.001, v * (height - 1)));

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);

  const tx = fx - x0;
  const ty = fy - y0;

  const h00 = heightmapBuffer[y0 * width + x0];
  const h10 = heightmapBuffer[y0 * width + x1];
  const h01 = heightmapBuffer[y1 * width + x0];
  const h11 = heightmapBuffer[y1 * width + x1];

  return (1 - ty) * ((1 - tx) * h00 + tx * h10) + ty * ((1 - tx) * h01 + tx * h11);
}

/**
 * Fast interpolation of trail elevation if heightmap binary is still downloading
 */
function sampleTrailElevation(xMeters: number, zMeters: number): number {
  let closestDistSq = Infinity;
  let closestElev = 1035;

  for (let i = 0; i < TRAIL_POLYLINE.length; i++) {
    const tp = TRAIL_POLYLINE[i];
    const dx = xMeters - tp.x;
    const dz = zMeters - tp.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < closestDistSq) {
      closestDistSq = dSq;
      closestElev = tp.elevation;
    }
  }

  // Rising valley slope away from path
  const dist = Math.sqrt(closestDistSq);
  return closestElev + Math.min(dist * 0.15, 1200);
}

/**
 * Calculates horizontal distance from game coordinate (x, z) to closest trail polyline point
 */
export function getDistanceToPath(gameX: number, gameZ: number): number {
  let minDistSq = Infinity;

  // Polyline search (366 points)
  for (let i = 0; i < TRAIL_POLYLINE.length - 1; i++) {
    const p1 = TRAIL_POLYLINE[i];
    const p2 = TRAIL_POLYLINE[i + 1];

    const vx = p2.gameX - p1.gameX;
    const vz = p2.gameZ - p1.gameZ;
    const wx = gameX - p1.gameX;
    const wz = gameZ - p1.gameZ;

    const c1 = wx * vx + wz * vz;
    let t = 0;
    if (c1 > 0) {
      const c2 = vx * vx + vz * vz;
      t = c2 > 0 ? Math.min(1.0, c1 / c2) : 0;
    }

    const projX = p1.gameX + t * vx;
    const projZ = p1.gameZ + t * vz;

    const dx = gameX - projX;
    const dz = gameZ - projZ;
    const dSq = dx * dx + dz * dz;

    if (dSq < minDistSq) {
      minDistSq = dSq;
    }
  }

  return Math.sqrt(minDistSq);
}

/**
 * Closest trail point's gameX for coordinate gameZ (replacement for legacy getPathX)
 */
export function getPathX(gameZ: number): number {
  let closestDiff = Infinity;
  let bestX = 0;

  for (let i = 0; i < TRAIL_POLYLINE.length; i++) {
    const diff = Math.abs(TRAIL_POLYLINE[i].gameZ - gameZ);
    if (diff < closestDiff) {
      closestDiff = diff;
      bestX = TRAIL_POLYLINE[i].gameX;
    }
  }

  return bestX;
}

/**
 * Primary terrain height function in game units.
 * Converts game (x, z) to local meters, samples real 30m DEM elevation,
 * adds natural micro-detail, carves/smooths the trail bed, and scales by WORLD_SCALE.
 */
export function getTerrainHeight(gameX: number, gameZ: number): number {
  const xMeters = gameX / WORLD_SCALE;
  const zMeters = gameZ / WORLD_SCALE;

  // 1. Sample real-world 30m DEM elevation in meters
  let realElev = sampleDEM(xMeters, zMeters);

  // 2. Trail Carving & Flattening: smooth falloff along OSM trail polyline
  const distToPath = getDistanceToPath(gameX, gameZ);
  const pathWidth = 3.6; // Game units (~18 real meters)

  if (distToPath < pathWidth) {
    const blend = distToPath / pathWidth;
    const smooth = blend * blend * (3.0 - 2.0 * blend); // smoothstep ease
    // Find closest trail elevation
    const trailElevMeters = sampleTrailElevation(xMeters, zMeters);
    realElev = trailElevMeters * (1.0 - smooth) + realElev * smooth;
  }

  // 3. Fine detail: high-frequency noise so ground feels natural at eye level
  const microScale = 0.35;
  const microNoise = (smoothNoise(gameX * microScale, gameZ * microScale) - 0.5) * 0.45;

  // 4. Convert real meters to game units
  return (realElev * WORLD_SCALE) + microNoise;
}

/**
 * Real elevation in meters at (gameX, gameZ)
 */
export function getRealElevationMeters(gameX: number, gameZ: number): number {
  return Math.round(getTerrainHeight(gameX, gameZ) / WORLD_SCALE);
}

/**
 * Slope calculation at (gameX, gameZ) for vegetation and texture splatting.
 * Returns 0 (flat) to 1.0 (sheer cliff).
 */
export function getTerrainSlope(gameX: number, gameZ: number): number {
  const delta = 1.0;
  const hL = getTerrainHeight(gameX - delta, gameZ);
  const hR = getTerrainHeight(gameX + delta, gameZ);
  const hD = getTerrainHeight(gameX, gameZ - delta);
  const hU = getTerrainHeight(gameX, gameZ + delta);

  const dx = (hR - hL) / (2 * delta);
  const dz = (hU - hD) / (2 * delta);
  const grad = Math.sqrt(dx * dx + dz * dz);
  return Math.min(1.0, grad / 1.5);
}

/**
 * Clamps coordinates to keep player strictly within playable world bounds.
 */
export function clampPlayerPosition(x: number, z: number): { x: number; z: number } {
  const margin = 20;
  const clampedX = Math.max(WORLD_BOUNDS.minX + margin, Math.min(WORLD_BOUNDS.maxX - margin, x));
  const clampedZ = Math.max(WORLD_BOUNDS.minZ + margin, Math.min(WORLD_BOUNDS.maxZ - margin, z));
  return { x: clampedX, z: clampedZ };
}
