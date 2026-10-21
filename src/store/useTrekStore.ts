import { create } from 'zustand';
import { START_POSITION, getRealElevationMeters } from '@/lib/terrain';

export type GameState = 'landing' | 'trekking' | 'paused';
export type QualityLevel = 'low' | 'medium' | 'high';
export type CameraMode = 'first-person' | 'third-person' | 'wide' | 'orbit';

export interface PlayerTelemetry {
  pos: [number, number, number];
  groundY: number;
  elevation: number;
  distanceWalked: number;
  heading: number;
  trekkerYaw: number;
  isMoving: boolean;
  isSprinting: boolean;
}

export const playerTelemetry: PlayerTelemetry = {
  pos: [...START_POSITION],
  groundY: START_POSITION[1] - 1.7,
  elevation: 1035,
  distanceWalked: 0,
  heading: 0,
  trekkerYaw: 0,
  isMoving: false,
  isSprinting: false,
};

interface VirtualJoystickState {
  x: number;
  y: number;
  active: boolean;
}

interface MobileLookDelta {
  x: number;
  y: number;
}

interface TrekStore {
  // Game lifecycle
  gameState: GameState;
  startTrek: () => void;
  exitTrek: () => void;
  togglePause: () => void;
  setGameState: (state: GameState) => void;

  // Graphics Quality
  quality: QualityLevel;
  setQuality: (quality: QualityLevel) => void;

  // Desktop Pointer Lock
  isPointerLocked: boolean;
  setIsPointerLocked: (locked: boolean) => void;

  // Camera Mode
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;

  // Player telemetry
  playerPos: [number, number, number];
  setPlayerPos: (pos: [number, number, number]) => void;
  playerHeading: number;
  setPlayerHeading: (deg: number) => void;
  isMoving: boolean;
  setIsMoving: (isMoving: boolean) => void;
  isSprinting: boolean;
  setIsSprinting: (isSprinting: boolean) => void;
  distanceWalked: number;
  addDistanceWalked: (dist: number) => void;
  elevation: number;
  setElevation: (elev: number) => void;

  // Teleportation (dev menu)
  teleportTarget: [number, number, number] | null;
  teleportTo: (pos: [number, number, number]) => void;
  clearTeleport: () => void;

  // Mobile virtual inputs
  virtualJoystick: VirtualJoystickState;
  setVirtualJoystick: (val: Partial<VirtualJoystickState>) => void;
  mobileLookDelta: MobileLookDelta;
  setMobileLookDelta: (val: MobileLookDelta) => void;
  isMobile: boolean;
  setIsMobile: (val: boolean) => void;

  // Development Subsystem Toggles (for profiling & isolating costs)
  devToggles: {
    terrain: boolean;
    trees: boolean;
    grass: boolean;
    rocks: boolean;
    shadows: boolean;
    postprocessing: boolean;
    mountains: boolean;
  };
  setDevToggle: (key: 'terrain' | 'trees' | 'grass' | 'rocks' | 'shadows' | 'postprocessing' | 'mountains', val: boolean) => void;
}

export const useTrekStore = create<TrekStore>((set) => ({
  gameState: 'landing',
  startTrek: () =>
    set({
      gameState: 'trekking',
      playerPos: [...START_POSITION],
      elevation: getRealElevationMeters(START_POSITION[0], START_POSITION[2]),
      distanceWalked: 0,
      isMoving: false,
      isSprinting: false,
      teleportTarget: null,
    }),
  exitTrek: () =>
    set({
      gameState: 'landing',
      isPointerLocked: false,
    }),
  togglePause: () =>
    set((state) => ({
      gameState: state.gameState === 'paused' ? 'trekking' : 'paused',
    })),
  setGameState: (gameState) => set({ gameState }),

  // Default quality: Start at Medium by default (Requirement 2f)
  quality: 'medium',
  setQuality: (quality) => set({ quality }),

  isPointerLocked: false,
  setIsPointerLocked: (isPointerLocked) => set({ isPointerLocked }),

  // Camera Mode with localStorage persistence (Requirement 1)
  cameraMode:
    typeof window !== 'undefined' &&
    ['first-person', 'third-person', 'wide', 'orbit'].includes(localStorage.getItem('trek_camera_mode') || '')
      ? (localStorage.getItem('trek_camera_mode') as CameraMode)
      : 'first-person',

  setCameraMode: (mode) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('trek_camera_mode', mode);
      } catch {}
    }
    set({ cameraMode: mode });
  },

  cycleCameraMode: () => {
    const modes: CameraMode[] = ['first-person', 'third-person', 'wide', 'orbit'];
    set((state) => {
      const idx = modes.indexOf(state.cameraMode);
      const nextMode = modes[(idx + 1) % modes.length];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('trek_camera_mode', nextMode);
        } catch {}
      }
      return { cameraMode: nextMode };
    });
  },

  playerPos: [...START_POSITION],
  setPlayerPos: (playerPos) =>
    set({
      playerPos,
      elevation: getRealElevationMeters(playerPos[0], playerPos[2]),
    }),
  playerHeading: 0,
  setPlayerHeading: (playerHeading) => set({ playerHeading }),
  isMoving: false,
  setIsMoving: (isMoving) => set({ isMoving }),
  isSprinting: false,
  setIsSprinting: (isSprinting) => set({ isSprinting }),
  distanceWalked: 0,
  addDistanceWalked: (dist) =>
    set((state) => ({ distanceWalked: Math.round(state.distanceWalked + dist) })),
  elevation: getRealElevationMeters(START_POSITION[0], START_POSITION[2]),
  setElevation: (elevation) => set({ elevation }),

  // Teleportation
  teleportTarget: null,
  teleportTo: (target) =>
    set({
      teleportTarget: target,
      playerPos: target,
      elevation: getRealElevationMeters(target[0], target[2]),
    }),
  clearTeleport: () => set({ teleportTarget: null }),

  virtualJoystick: { x: 0, y: 0, active: false },
  setVirtualJoystick: (val) =>
    set((state) => ({ virtualJoystick: { ...state.virtualJoystick, ...val } })),
  mobileLookDelta: { x: 0, y: 0 },
  setMobileLookDelta: (mobileLookDelta) => set({ mobileLookDelta }),
  isMobile: false,
  setIsMobile: (isMobile) => set({ isMobile }),

  devToggles: {
    terrain: true,
    trees: true,
    grass: true,
    rocks: true,
    shadows: true,
    postprocessing: true,
    mountains: true,
  },
  setDevToggle: (key, val) =>
    set((state) => ({ devToggles: { ...state.devToggles, [key]: val } })),
}));
