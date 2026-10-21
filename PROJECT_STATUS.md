# 🏔️ Annapurna Trail — Project Status

> **Current Status**: **Annapurna Base Camp (ABC) Expedition Engine — Verified & Production-Ready**  
> **Last Updated**: October 2026  
> **Framework & Engine**: Next.js 16.4.2 (App Router, Turbopack) • React 19.3 • Three.js 0.186 • React Three Fiber 9.8 • Zustand 5.0 • Tailwind CSS 4.3  

---

## 📌 Executive Summary

**Annapurna Trail** is a 3D first-person Himalayan trekking simulation set along Nepal's renowned **Annapurna Base Camp (ABC) route** within the **Annapurna Sanctuary**. The trek begins at the trailhead in **Nayapul (1,070m)** and ascends through terraced Gurung villages, dense bamboo groves, and vibrant rhododendron forests into the glacial amphitheater framed by **Annapurna I (8,091m)**, **Machapuchare (Fishtail Peak, 6,993m)**, **Annapurna South (7,219m)**, and **Hiunchuli (6,441m)**, culminating at **Annapurna Base Camp (4,130m)**.

The game is engineered entirely with procedural code and zero external 3D model dependencies, featuring custom PBR multi-texture heightfield splatting, instanced alpine foliage with dynamic wind vertex shaders, merged Himalayan massifs, soft morning sun lighting, and dual-mode desktop/mobile controls.

---

## 🛠️ Recent Fixes & Improvements

### 1. Trek Route Alignment: Annapurna Base Camp (ABC)
- **Trek & Region**: Realigned exclusively to **Nepal — Annapurna Sanctuary** (Annapurna Base Camp route). All legacy references to Annapurna Circuit, Lower Pisang, and Thorong La have been excised.
- **Elevation Constants**: Defined `ABC_TREK_CONFIG` in [src/lib/terrain.ts](file:///d:/annapurna-trail/src/lib/terrain.ts):
  - `START_ALTITUDE`: **1,070m** (Nayapul trailhead)
  - `GOAL_ALTITUDE`: **4,130m** (Annapurna Base Camp)
  - `ELEVATION_RATE`: Single rate constant `(4130 - 1070) / (75 - -250)` (~9.415 m/unit) calculating simulated altitude smoothly based on the player's progress along the trail (Z-axis). This single constant will later connect to milestones like Ghorepani, Chhomrong, Deurali, and MBC.
- **HUD Initialization**: [src/store/useTrekStore.ts](file:///d:/annapurna-trail/src/store/useTrekStore.ts) starts HUD elevation at **1,070m** and updates altitude dynamically with trail progress.
- **Landing Screen & HUD**: Rewrote hero copy in [LandingScreen.tsx](file:///d:/annapurna-trail/src/components/ui/LandingScreen.tsx) and [TrekHUD.tsx](file:///d:/annapurna-trail/src/components/ui/TrekHUD.tsx) for a trek through terraced villages, forests, and blooming rhododendron groves towards Annapurna Base Camp.

### 2. Natural Morning Illumination & Lighting Balance
- **Morning Sunlight Angle & Direction**: Repositioned directional sun in [TrekScene.tsx](file:///d:/annapurna-trail/src/components/scene/TrekScene.tsx) to `[75, 115, 90]` with warm color `#fff6e0` at intensity `2.8`. This illuminates the valley floor and casts golden morning light directly onto the south-facing glacial couloirs of Annapurna and Machapuchare.
- **Ambient Fill**: Boosted ambient light to `#cfe6ff` at `0.9` and hemisphere light to `#dff2ff` sky with a lush meadow-green ground bounce `#6d925e` at `0.75` (preventing black shadow drop-off on terrain slopes).
- **Environment Intensity**: Configured `<Environment environmentIntensity={1.3} />` for realistic PBR reflections.
- **Tree Foliage & Trunk Colors**: Replaced near-black hexes in [InstancedTrees.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedTrees.tsx) with rich Himalayan cedar bark (`#6b4d32`) and four-tiered lush alpine pine greens (`#2f6634`, `#3b7a42`, `#4a9152`, `#5ca665`), reducing material roughness to `0.62`.
- **Slopes & Terrain Splatting**: Tuned GLSL splatting shader in [Terrain.tsx](file:///d:/annapurna-trail/src/components/scene/Terrain.tsx) to brighten grass, dirt, and rock tones in direct and ambient light.
- **Post-Processing Softening**: Reduced SSAO intensity from `12` down to `2.0` in [PostProcessing.tsx](file:///d:/annapurna-trail/src/components/scene/PostProcessing.tsx) and softened vignette darkness to `0.22`, eliminating harsh edge clipping.

### 3. Scene Geometry & Instancing Bug Fixes
- **Terrain Coverage Bounds**: Centered the heightfield plane over `centerZ = -80` spanning from Z = -290 to +130 (and X = ±180). This ensures solid terrain exists beneath all objects all the way to the end of the trail (Z = -250), eliminating objects floating in air.
- **Rock Placement & Grounding**: Updated [InstancedRocks.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedRocks.tsx) with slope filtering (`getTerrainSlope(x, z) <= 0.35`) and embedded boulders slightly into the soil (`y - scaleBase * 0.15`), eliminating mid-air rocks.
- **Grass Blade Architecture**: Replaced wide square quads with tapered blade tufts and vertex color gradients (`#336e29` to `#68b84d`) in [InstancedGrass.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedGrass.tsx), completely removing dark rectangular specks in the air.
- **Cairn Embedding**: Anchored milestone cairn base stones firmly in the terrain in [Cairns.tsx](file:///d:/annapurna-trail/src/components/scene/Cairns.tsx) with granite shading.
- **Distant Mountain Sanctuary Panorama**: Redesigned peak layout in [Mountains.tsx](file:///d:/annapurna-trail/src/components/scene/Mountains.tsx):
  - Pushed colossal peaks far into the distance (Z from -510 to -840).
  - Modeled Annapurna I (8,091m), Machapuchare (Fishtail Peak, 6,993m), Annapurna South (7,219m), and Hiunchuli (6,441m).
  - Added an overlapping northern horizon barrier across X = -450 to +450 that removes the sky gap.
  - Set flanking ridges back (X: ±220 to ±250) so the valley opens naturally toward the snow-capped amphitheater.
  - Recomputed vertex normals on the merged buffer geometry and tuned the mountain shader for brilliant snowline cover.

### 4. Console Warnings & Deprecations
- **Shadow Map Type**: Configured `THREE.PCFShadowMap` on the Canvas renderer in [TrekScene.tsx](file:///d:/annapurna-trail/src/components/scene/TrekScene.tsx).
- **THREE.Timer**: Replaced deprecated `THREE.Clock` with `THREE.Timer` in [InstancedTrees.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedTrees.tsx) and [InstancedGrass.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedGrass.tsx).
- **React 19 / Compiler Cleanups**: Used `useLayoutEffect` for texture color space setups and component state for `originPos` in [VirtualJoystick.tsx](file:///d:/annapurna-trail/src/components/ui/VirtualJoystick.tsx).

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **App Framework** | [Next.js 16.4.2](file:///d:/annapurna-trail/package.json) | App Router, Turbopack, React 19.3, SSR-safe dynamic imports |
| **3D Engine** | [Three.js 0.186.1](file:///d:/annapurna-trail/package.json) + [@react-three/fiber 9.8.2](file:///d:/annapurna-trail/package.json) | WebGL2, ACESFilmic, PCFShadowMap, dynamic DPR scaling |
| **3D Ecosystem** | [@react-three/drei 10.7.9](file:///d:/annapurna-trail/package.json) + [postprocessing](file:///d:/annapurna-trail/package.json) | PointerLockControls, Environment, PerformanceMonitor, Bloom, Vignette, SSAO |
| **State Management** | [Zustand 5.0.15](file:///d:/annapurna-trail/src/store/useTrekStore.ts) | Trek lifecycle, player telemetry, mobile input, quality toggle |
| **Styling** | [Tailwind CSS 4.3.3](file:///d:/annapurna-trail/src/app/globals.css) | Responsive mountaineering HUD, landing screen, modals |

---

## 🔍 Validation & Verification

| Check | Status | Result |
|---|---|---|
| **TypeScript Compilation** (`npx tsc --noEmit`) | 🟢 **PASSING** | 0 type errors across all files. |
| **Production Build** (`npm run build`) | 🟢 **PASSING** | Static routes (`/`, `/_not-found`) compile cleanly with Turbopack. |
| **Dev Server** (`npm run dev`) | 🟢 **RUNNING** | Listening and serving on `http://localhost:3000`. |
| **PBR Textures & HDRI** | 🟢 **VERIFIED** | Generated 512×512 PBR textures and 32-bit Radiance RGBE sky dome present. |
| **Console Warnings** | 🟢 **CLEARED** | PCFShadowMap set, THREE.Clock replaced with THREE.Timer. |

---

## 🎯 Next Steps & Future Roadmap

1. **Village & Rest Stops**:
   - Tie the single elevation constant (`ABC_TREK_CONFIG.ELEVATION_RATE`) to village waypoints: Ghorepani (2,860m), Chhomrong (2,170m), Deurali (3,200m), Machapuchare Base Camp / MBC (3,700m), and Annapurna Base Camp / ABC (4,130m).
2. **Audio & Soundscapes**:
   - Alpine morning breeze loop, bamboo grove creaks, and prayer flags fluttering.
   - Surface-aware footstep audio (dirt trail, stone steps, crunchy snow).
3. **Atmospheric FX**:
   - Gentle glacial spindrift snow particles near Annapurna I summit.
