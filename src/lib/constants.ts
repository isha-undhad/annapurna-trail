/**
 * Global World Scale and Trek Configuration Constants
 *
 * WORLD_SCALE is uniform on every axis (X, Y, Z).
 * - Real geographic meters are multiplied by WORLD_SCALE to produce Three.js game units.
 * - Game unit heights are divided by WORLD_SCALE to display real altitude in the HUD.
 */
export const WORLD_SCALE = 0.2; // 1 real meter = 0.2 game units (5 real meters = 1 game unit)

// Real world altitude benchmarks
export const NAYAPUL_START_ELEVATION = 1035; // Real meters at Nayapul trailhead
export const ABC_GOAL_ELEVATION = 4077;       // Real meters at Annapurna Base Camp

// Player constants (human scale in game units)
export const PLAYER_EYE_HEIGHT = 1.7; // 1.7m human eye level
export const PLAYER_WALK_SPEED = 12.0; // Game units per second
export const PLAYER_SPRINT_SPEED = 24.0;
