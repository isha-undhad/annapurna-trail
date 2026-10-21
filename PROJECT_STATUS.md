# 🏔️ Annapurna Trail — Project Status

> **Current Status**: **Realistic Visuals Upgrade & CC0 Poly Haven Engine — Verified & Production-Ready**  
> **Last Updated**: October 2026  
> **Framework & Engine**: Next.js 16.4.2 (App Router, Turbopack) • React 19.3 • Three.js 0.186 • React Three Fiber 9.8 • Zustand 5.0 • Tailwind CSS 4.3  

---

## 📌 Executive Summary

**Annapurna Trail** is a 3D first-person Himalayan trekking simulation set along Nepal's renowned **Annapurna Base Camp (ABC) route** within the **Annapurna Sanctuary**. The trek begins at the trailhead in **Nayapul (1,070m)** and ascends through terraced Gurung villages, dense bamboo groves, and vibrant rhododendron forests into the glacial amphitheater framed by **Annapurna I (8,091m)**, **Machapuchare (Fishtail Peak, 6,993m)**, **Annapurna South (7,219m)**, and **Hiunchuli (6,441m)**, culminating at **Annapurna Base Camp (4,130m)**.

The visuals have been comprehensively upgraded from procedural/low-poly to **realistic PBR rendering** using authentic CC0 photogrammetric assets from [Poly Haven](https://polyhaven.com), featuring triplanar cliff texturing, macro color noise, organic trail blending, alpha-card conifer forests with wind sway, instanced 3D boulders, and atmospheric distance haze.

---

## 🎨 Realistic Visuals Upgrade (Step 1 & Step 2)

### 1. Authentic CC0 Poly Haven Assets (Step 1)
All visual assets were retrieved directly from the Poly Haven API (`https://api.polyhaven.com`) and organized into `/public/`:
- **HDRI Environment**: `drakensberg_solitary_mountain_puresky` (2K `.hdr`, 4.29 MB) -> [public/hdri/sky.hdr](file:///d:/annapurna-trail/public/hdri/sky.hdr).
- **PBR Terrain Textures (2K & 1K variants)**:
  - **Meadow Grass**: `sparse_grass` (Color, Normal GL, Roughness, AO) in [public/textures/grass/](file:///d:/annapurna-trail/public/textures/grass/).
  - **Compacted Trail Dirt**: `rocky_trail` (Color, Normal GL, Roughness, AO) in [public/textures/dirt/](file:///d:/annapurna-trail/public/textures/dirt/).
  - **Mountain Rock / Cliff**: `cliff_side` (Color, Normal GL, Roughness, AO) in [public/textures/rock/](file:///d:/annapurna-trail/public/textures/rock/).
  - **Alpine Glacial Snow**: `snow_02` (Color, Normal GL, Roughness, AO) in [public/textures/snow/](file:///d:/annapurna-trail/public/textures/snow/).
- **Tree Assets**:
  - **Pine Bark**: `pine_bark` (2K & 1K: Color, Normal GL, Roughness) in [public/textures/bark/](file:///d:/annapurna-trail/public/textures/bark/).
  - **Foliage Needles**: `pine_tree_01` (Needle Branch Cutout with Alpha Transparency + Normal GL) in [public/textures/foliage/](file:///d:/annapurna-trail/public/textures/foliage/).
- **3D Photogrammetry Rock Model**:
  - `rock_07` (1K GLTF + BIN + Diffuse, Normal, and ARM Roughness maps) in [public/models/rock_07/](file:///d:/annapurna-trail/public/models/rock_07/).
- **Offline Generator Preserved**: [scripts/generate-assets.js](file:///d:/annapurna-trail/scripts/generate-assets.js) retained as an offline fallback generator and documented in `README.md`.

---

### 2. Terrain Shader: Triplanar Mapping, Macro Variation & Soft Trail Blending
- **Triplanar Rock Mapping**: Implemented triplanar projection in [Terrain.tsx](file:///d:/annapurna-trail/src/components/scene/Terrain.tsx) using normal weights `pow(abs(normalize(vWorldNormal)), vec3(4.0))`. This eliminates texture stretching and tearing along steep canyon walls and rocky crags.
- **Large-Scale Macro Color Variation**: Integrated non-repeating low-frequency noise across the valley (`macroNoise`) blending subtle cool and warm tints to completely hide tiling artifacts across expansive vistas.
- **Organic Soft Trail Blending**: Applied sinusoidal edge perturbation to the trail distance field (`distToPath + trailPerturb`), producing natural, irregular borders where compacted dirt softly transitions into mountain turf.
- **Ambient Occlusion Integration**: Blended PBR AO maps (`grassAO`, `dirtAO`, `rockAO`, `snowAO`) directly into the terrain fragment shader to enhance crevice depth and grounding.

---

### 3. Sky, Lighting & Morning Atmospheric Balance
- **360° Mountain Morning HDRI**: Embedded `<Environment files="/hdri/sky.hdr" background environmentIntensity={1.3} />` in [TrekScene.tsx](file:///d:/annapurna-trail/src/components/scene/TrekScene.tsx).
- **Sun Direction & Color Alignment**: Positioned the main directional light at `[75, 115, 90]` with warm golden morning light (`#fff6e0`, intensity `2.8`) matching the HDRI morning sun angle and casting long, soft PCF shadows down the Annapurna gorge.
- **Fill & Ground Bounce**: Balanced with high-altitude blue ambient light (`#cfe6ff`, `0.9`) and hemisphere sky/ground light (`#dff2ff` sky / `#6d925e` meadow bounce, `0.75`), ensuring shadow areas retain clarity without black shadow crushing.

---

### 4. Realistic Alpha-Card Conifer Forests
- **Trunk & Needle Architecture**: Replaced low-poly cones in [InstancedTrees.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedTrees.tsx) with two batched instanced meshes:
  1. **Trunk**: Tapered cylinder with 2K `pine_bark` PBR textures tiling vertically.
  2. **Foliage**: Multi-tiered planar conifer cards radiating at downward angles (shedding snow) with `pine_branch.png` alpha masking (`alphaTest: 0.35`, `depthWrite: true`, `side: THREE.DoubleSide`).
- **Dynamic Wind Sway**: Vertex shader sway animation displacing branch cards and tips proportional to height in the morning breeze.
- **Natural Tint Jitter**: Random variations of Himalayan pine needle tones (`#385e38`, `#2e4d2f`, `#446942`, `#325234`) applied per instance via `setColorAt`.
- **LOD & Distance Culling**: Density and culling scale with quality settings (High: 450 trees; Medium: 280; Low: 150 with distant instances culled and shadows disabled).

---

### 5. Photogrammetric Instanced Boulders
- **Poly Haven `rock_07`**: Loaded in [InstancedRocks.tsx](file:///d:/annapurna-trail/src/components/scene/InstancedRocks.tsx) via `useGLTF` with full PBR maps (diffuse, normal, ARM roughness).
- **Slope Filtering**: Instances restricted to slopes `getTerrainSlope <= 0.35` so boulders never hover on sheer cliffs.
- **Soil Embedding**: Sunk boulder origins slightly into the ground (`y - scaleBase * 0.22`) for solid contact with the turf.
- **Natural Scattering**: Concentrated along trail borders and meadow outcrops with randomized scale and rotation.

---

### 6. Realistic Mountain Massifs & Atmospheric Distance Haze
- **Triplanar Rock & Glacial Snow**: Implemented triplanar projection in [Mountains.tsx](file:///d:/annapurna-trail/src/components/scene/Mountains.tsx) combining `cliff_side` rock and `snow_02` textures.
- **Altitude & Slope Snow Distribution**: Snow coverage transitions smoothly above 70m altitude on gentler ledges, with permanent glacial ice covering summits (>140m).
- **Atmospheric Distance Haze**: Distant massifs gradually fade into soft alpine blue (`#adcaeb`) over 300m–950m using camera-distance fog weighting (`smoothstep(300.0, 950.0, distToCam)`).

---

### 7. Texture Filtering, Quality Sizing & Mipmapping
- **1K / 2K Dynamic Sizing**: Generated 1K optimized variants of all textures via [scripts/generate-1k-textures.js](file:///d:/annapurna-trail/scripts/generate-1k-textures.js).
- **Texture Manager**: Created [src/lib/textures.ts](file:///d:/annapurna-trail/src/lib/textures.ts) (`getTexturePath` and `configureTexture`):
  - **Low Quality (Mobile)**: Streams 1K textures to preserve VRAM and achieve 30+ FPS.
  - **Medium / High (Desktop)**: Streams full 2K textures for pristine fidelity.
  - **Color Space Standards**: `THREE.SRGBColorSpace` for color/diffuse maps; linear `THREE.NoColorSpace` for normal, roughness, and AO.
  - **Anisotropy & Mipmaps**: Hardware mipmapping enabled; anisotropy scales from 8 (High) to 4 (Medium) to 2 (Low).

---

### 8. Gentle Post-Processing & Performance
- **Post-Processing**: [PostProcessing.tsx](file:///d:/annapurna-trail/src/components/scene/PostProcessing.tsx) configured with subtle Bloom (threshold 0.85, intensity 0.42), gentle mountaineering Vignette (darkness 0.22), and soft contact SSAO (intensity 2.0 on High only, disabled on Low).
- **Target Performance**: 60 FPS on High (Desktop) and 30+ FPS on Low (Mobile) backed by `PerformanceMonitor` dynamic DPR scaling.
- **Asset Streaming Loading Screen**: [LoadingScreen.tsx](file:///d:/annapurna-trail/src/components/ui/LoadingScreen.tsx) monitors `@react-three/drei`'s `useProgress()` to provide real-time asset hydration progress and filename indicators.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **App Framework** | [Next.js 16.4.2](file:///d:/annapurna-trail/package.json) | App Router, Turbopack, React 19.3, SSR-safe dynamic imports |
| **3D Engine** | [Three.js 0.186.1](file:///d:/annapurna-trail/package.json) + [@react-three/fiber 9.8.2](file:///d:/annapurna-trail/package.json) | WebGL2, ACESFilmic, PCFShadowMap, dynamic DPR scaling |
| **3D Ecosystem** | [@react-three/drei 10.7.9](file:///d:/annapurna-trail/package.json) + [postprocessing](file:///d:/annapurna-trail/package.json) | useGLTF, Environment, PerformanceMonitor, Bloom, Vignette, SSAO |
| **State Management** | [Zustand 5.0.15](file:///d:/annapurna-trail/src/store/useTrekStore.ts) | Trek lifecycle, player telemetry, mobile input, quality toggle |
| **Styling** | [Tailwind CSS 4.3.3](file:///d:/annapurna-trail/src/app/globals.css) | Responsive mountaineering HUD, landing screen, modals |

---

## 🔍 Validation & Verification

| Check | Status | Result |
|---|---|---|
| **Poly Haven CC0 Assets** | 🟢 **VERIFIED** | 2K HDRI, 2K/1K PBR sets (grass, dirt, rock, snow, bark, foliage), and rock_07 3D model present in `/public`. |
| **TypeScript Compilation** (`npx tsc --noEmit`) | 🟢 **PASSING** | 0 type errors across the entire codebase. |
| **Production Build** (`npm run build`) | 🟢 **PASSING** | Static routes (`/`, `/_not-found`) compile cleanly with Turbopack. |
| **Dev Server** (`npm run dev`) | 🟢 **RUNNING** | Serving HTTP 200 on `http://localhost:3000`. |
| **Console Warnings** | 🟢 **CLEARED** | PCFShadowMap enabled, THREE.Clock replaced with THREE.Timer, proper texture color spaces. |
| **Asset Credits** | 🟢 **DOCUMENTED** | Full CC0 Poly Haven attribution added to `README.md`. |
