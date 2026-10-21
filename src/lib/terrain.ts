/**
 * Realistic Terrain & Path Generation Library for Annapurna Trail
 * Multi-octave Fractional Brownian Motion (fBm) elevation model.
 */

// Permutation table for CPU-side fast 2D Perlin-style noise
const P = new Uint8Array(512);
let s = 1337;
for (let i = 0; i < 256; i++) {
  s = (s * 16807 + 7) % 2147483647;
  P[i] = s % 256;
  P[i + 256] = P[i];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad2D(hash: number, x: number, z: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : z;
  const v = h < 2 ? z : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise2D(x: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Z = Math.floor(z) & 255;
  const xf = x - Math.floor(x);
  const zf = z - Math.floor(z);

  const u = fade(xf);
  const v = fade(zf);

  const aa = P[P[X] + Z];
  const ab = P[P[X] + Z + 1];
  const ba = P[P[X + 1] + Z];
  const bb = P[P[X + 1] + Z + 1];

  const x1 = (1 - u) * grad2D(aa, xf, zf) + u * grad2D(ba, xf - 1, zf);
  const x2 = (1 - u) * grad2D(ab, xf, zf - 1) + u * grad2D(bb, xf - 1, zf - 1);

  return (1 - v) * x1 + v * x2;
}

/**
 * Multi-octave fractional Brownian motion (fBm)
 */
export function terrainFbm(x: number, z: number, octaves = 5): number {
  let total = 0;
  let frequency = 0.012;
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.48;
    frequency *= 2.05;
  }

  return total / maxValue;
}

// World bounds for the Annapurna Valley region
export const WORLD_BOUNDS = {
  minX: -150,
  maxX: 150,
  minZ: -260,
  maxZ: 100,
};

// Player starting position (trailhead near Nayapul, 1,070m)
export const START_POSITION: [number, number, number] = [0, 2.0, 75];

/**
 * Calculates the X center of the winding dirt trail at coordinate Z.
 */
export function getPathX(z: number): number {
  return (
    Math.sin(z * 0.026) * 18.0 +
    Math.sin(z * 0.062 + 1.1) * 7.0 +
    Math.cos(z * 0.014) * 4.5
  );
}

/**
 * Calculates the horizontal distance from (x, z) to the trail centerline.
 */
export function getDistanceToPath(x: number, z: number): number {
  const pathX = getPathX(z);
  return Math.abs(x - pathX);
}

/**
 * Realistic Himalayan valley heightfield:
 * - Winding valley corridor
 * - Natural rolling alpine foothills via fBm noise
 * - Rising canyon slopes on valley sides
 * - Smooth, walkable dirt trail bed
 */
export function getTerrainHeight(x: number, z: number): number {
  // Gradual uphill climb into the high mountain pass (Z from 80 down to -250)
  const valleyGradient = (75 - z) * 0.075;

  // Layered natural rolling hills from fBm
  const hills = terrainFbm(x, z, 5) * 14.0;

  // Valley canyon walls: terrain rises dramatically as you move away from valley center
  const distFromCenter = Math.abs(x);
  const canyonRise = Math.pow(Math.max(0, distFromCenter - 28) * 0.065, 2.3) * 3.5;

  // Northern massif foothills
  const northMassif = z < -160 ? Math.pow((-160 - z) * 0.07, 1.9) * 2.2 : 0;

  let height = valleyGradient + hills + canyonRise + northMassif;

  // Trail leveling: smoothly carve and flatten the walkable dirt path
  const distToPath = getDistanceToPath(x, z);
  const pathWidth = 4.2;
  if (distToPath < pathWidth) {
    const blend = distToPath / pathWidth;
    // Smoothed cubic Hermite ease
    const smoothFactor = blend * blend * (3 - 2 * blend);
    const trailBedHeight = valleyGradient + Math.sin(z * 0.02) * 1.5;
    height = trailBedHeight * (1 - smoothFactor) + height * smoothFactor;
  }

  return height;
}

/**
 * Slope calculation at (x, z) for vegetation and texture blending.
 * Returns value from 0 (flat) to 1 (steep cliff).
 */
export function getTerrainSlope(x: number, z: number): number {
  const delta = 1.0;
  const hL = getTerrainHeight(x - delta, z);
  const hR = getTerrainHeight(x + delta, z);
  const hD = getTerrainHeight(x, z - delta);
  const hU = getTerrainHeight(x, z + delta);

  const dx = (hR - hL) / (2 * delta);
  const dz = (hU - hD) / (2 * delta);
  const gradient = Math.sqrt(dx * dx + dz * dz);
  return Math.min(1.0, gradient / 1.5);
}

/**
 * Clamps coordinates to keep player strictly within playable valley bounds.
 */
export function clampPlayerPosition(x: number, z: number): { x: number; z: number } {
  const margin = 6;
  const clampedX = Math.max(WORLD_BOUNDS.minX + margin, Math.min(WORLD_BOUNDS.maxX - margin, x));
  const clampedZ = Math.max(WORLD_BOUNDS.minZ + margin, Math.min(WORLD_BOUNDS.maxZ - margin, z));
  return { x: clampedX, z: clampedZ };
}

/**
 * Annapurna Base Camp (ABC) Expedition Elevation Configuration
 * Region: Nepal — Annapurna Sanctuary
 * Start: Nayapul (1,070m) -> Goal: Annapurna Base Camp (4,130m)
 * Milestone checkpoints along the route: Ghorepani, Chhomrong, Deurali, MBC, ABC.
 */
export const ABC_TREK_CONFIG = {
  REGION: 'Nepal - Annapurna Sanctuary',
  START_NAME: 'Nayapul',
  START_ALTITUDE: 1070, // meters
  GOAL_NAME: 'Annapurna Base Camp',
  GOAL_ALTITUDE: 4130, // meters
  TRAILHEAD_Z: 75,
  BASE_CAMP_Z: -250,
  // Single rate constant for altitude gain per meter of northward trail progress (Z-axis)
  // Total climb: 4,130m - 1,070m = 3,060m across 325 units along the trail
  ELEVATION_RATE: (4130 - 1070) / (75 - -250), // ~9.41538 m per unit of Z progress
};

/**
 * Calculates simulated altitude in meters along the Annapurna Base Camp route.
 * Progress is measured as the player advances north along the trail from Nayapul (Z=75)
 * towards Annapurna Base Camp (Z=-250).
 */
export function calculateSimulatedElevation(zOrCoord: number): number {
  const progressZ = Math.max(0, ABC_TREK_CONFIG.TRAILHEAD_Z - zOrCoord);
  const altitude = ABC_TREK_CONFIG.START_ALTITUDE + progressZ * ABC_TREK_CONFIG.ELEVATION_RATE;
  return Math.min(
    ABC_TREK_CONFIG.GOAL_ALTITUDE,
    Math.max(ABC_TREK_CONFIG.START_ALTITUDE, Math.round(altitude))
  );
}
