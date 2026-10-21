# 🏔️ Annapurna Trail — 3D First-Person Himalayan Trek

A 3D first-person trekking game set along Nepal's legendary Annapurna Base Camp (ABC) route in the Annapurna Sanctuary. Follow the winding trail through terraced foothills, pine forests, boulders, and Tibetan prayer cairns climbing from Nayapul (1,070m) towards the snowy amphitheater of Annapurna Base Camp (4,130m).

Built with **Next.js (App Router, TypeScript, Tailwind CSS)**, **Three.js**, **React Three Fiber (@react-three/fiber)**, **@react-three/drei**, and **Zustand**.

---

## ✨ Features

- **Realistic Himalayan Morning Lighting & 360° HDRI**: Clear mountain morning sky (`drakensberg_solitary_mountain_puresky`), directional golden morning sun with soft PCF shadows, and bright ambient alpine bounce.
- **4-Way PBR Terrain Splatting**: Real 2K textures for mountain meadow grass, compacted dirt trail, slate/granite cliff rock, and snow. Features triplanar mapping on steep slopes to eliminate texture stretching, macro color variation noise to hide tiling, and soft organic trail edge blending.
- **Atmospheric Distance Haze & Alpine Massifs**: Realistic Himalayan giants (Annapurna I, Annapurna South, Hiunchuli, Machapuchare) rendered with triplanar rock and snow textures, altitude/slope snowline distribution, and atmospheric distance haze fading to alpine blue.
- **Realistic Instanced Alpha-Card Conifers**: Himalayan silver pines and deodars constructed with real pine bark PBR textures, photo-scanned conifer needle branch cards with alpha testing, mountain wind sway vertex animation, and distance/LOD culling.
- **Photogrammetric Instanced Boulders**: Real 3D rock models (`rock_07`) batched with `<instancedMesh>`, slope filtering, and soil embedding.
- **Adaptive Performance & Quality Tiers**: Dynamic DPR and quality profiles (High: 2K textures, SSAO, PCF shadows, 60 FPS desktop; Low: 1K textures, reduced instances, 30+ FPS mobile).
- **First-Person Mountain Controls**:
  - **Desktop**: `WASD` / Arrow keys to walk, `Shift` to sprint, pointer-locked mouse look (`PointerLockControls`), and natural sinusoidal walking bob.
  - **Mobile**: Left-side virtual analog joystick for omnidirectional movement, right-side touch drag for fluid camera look.
- **Real-Time Mountaineering HUD**: Live altimeter starting from Nayapul (1,070m) climbing toward ABC (4,130m), compass azimuth heading toward the Annapurna Sanctuary, trek distance counter, and pause menu.
- **Asset Streaming Progress**: Dynamic loading screen tracking real-time asset hydration percentage and file streaming.

---

## 🗂️ Project Structure

```
├── components/          # Re-exports for root path imports
│   ├── scene/           # 3D canvas, terrain, mountains, instanced nature, controls
│   └── ui/              # Landing screen, HUD, virtual joystick, pause modal
├── src/
│   ├── app/             # Next.js App Router (layout.tsx, page.tsx, globals.css)
│   ├── components/
│   │   ├── scene/
│   │   │   ├── TrekCanvas.tsx       # Dynamic client component wrapper (ssr: false)
│   │   │   ├── TrekScene.tsx        # R3F Canvas, lights, fog, morning sun
│   │   │   ├── Terrain.tsx          # Procedural valley terrain & winding dirt path
│   │   │   ├── Mountains.tsx        # Merged low-poly Himalayan peaks with snow
│   │   │   ├── InstancedTrees.tsx   # Batched low-poly pine trees
│   │   │   ├── InstancedRocks.tsx   # Batched low-poly alpine boulders
│   │   │   ├── Cairns.tsx           # Trail stone cairns and prayer flags
│   │   │   └── PlayerController.tsx # WASD, pointer lock, mobile dual-touch, walking bob
│   │   └── ui/
│   │       ├── LandingScreen.tsx    # Hero title, "Start Trek", controls guide
│   │       ├── TrekHUD.tsx          # Altimeter, compass, crosshair, distance
│   │       ├── VirtualJoystick.tsx  # Mobile analog joystick & look drag overlay
│   │       └── PauseModal.tsx       # Pause menu with telemetry summary
│   ├── store/
│   │   └── useTrekStore.ts          # Zustand state store (lifecycle, player telemetry)
│   └── lib/
│       └── terrain.ts               # Path curve, terrain height function & bounds
├── public/              # Static assets
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: v18.17+ or v20+ (v24 LTS supported)
- **npm**: v9+

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/isha-undhad/annapurna-trail.git
cd annapurna-trail

npm install --legacy-peer-deps
```

*(Note: `--legacy-peer-deps` ensures seamless peer dependency resolution across Three.js / React 19 packages).*

### 3. Run Development Server

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Click **Start Trek** to enter the 3D Himalayan scene.

---

## 🎮 Controls

### Desktop
| Action | Key / Input |
|---|---|
| **Move** | `W`, `A`, `S`, `D` or `Arrow Keys` |
| **Sprint** | Hold `Shift` while moving |
| **Look Around** | Click anywhere to lock mouse cursor and look around |
| **Release Cursor** | Press `Esc` |
| **Pause / Menu** | Click the pause icon in the top right |

### Mobile / Touch
| Action | Gesture |
|---|---|
| **Move** | Touch & drag on the **left side** of the screen (Virtual Joystick) |
| **Sprint** | Push the virtual joystick knob toward the outer rim |
| **Look Around** | Swipe / drag anywhere on the **right side** of the screen |
| **Pause** | Tap the pause button in the top right |

---

## ☁️ Deploy to Vercel

### Option A: Via Vercel Web Dashboard (Recommended)

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete Step 1 of Annapurna Trail 3D trekking game"
   git push origin main
   ```
2. Navigate to [vercel.com/new](https://vercel.com/new).
3. Import your `annapurna-trail` repository.
4. Framework preset will automatically be detected as **Next.js**.
5. In **Build & Development Settings**, configure install command if prompted:
   - **Install Command**: `npm install --legacy-peer-deps`
6. Click **Deploy**.

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **3D Engine**: [Three.js](https://threejs.org/)
- **React 3D Bridge**: [@react-three/fiber](https://r3f.docs.pmnd.rs/)
- **3D Helpers & Controls**: [@react-three/drei](https://github.com/pmndrs/drei)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

---

## 🎨 Asset Credits & Licenses

All real-world HDRIs, PBR textures, and 3D photogrammetry models are licensed under **Creative Commons 0 (CC0 / Public Domain)** sourced from **[Poly Haven](https://polyhaven.com/)**:

| Asset Type | Poly Haven Asset Name | Location in Project | License |
|---|---|---|---|
| **HDRI Environment** | `drakensberg_solitary_mountain_puresky` (2K) | `/public/hdri/sky.hdr` | [CC0](https://polyhaven.com/license) |
| **PBR Grass** | `sparse_grass` (2K & 1K: Color, Normal, Roughness, AO) | `/public/textures/grass/` | [CC0](https://polyhaven.com/license) |
| **PBR Trail Dirt** | `rocky_trail` (2K & 1K: Color, Normal, Roughness, AO) | `/public/textures/dirt/` | [CC0](https://polyhaven.com/license) |
| **PBR Mountain Rock** | `cliff_side` (2K & 1K: Color, Normal, Roughness, AO) | `/public/textures/rock/` | [CC0](https://polyhaven.com/license) |
| **PBR Alpine Snow** | `snow_02` (2K & 1K: Color, Normal, Roughness, AO) | `/public/textures/snow/` | [CC0](https://polyhaven.com/license) |
| **PBR Pine Bark** | `pine_bark` (2K & 1K: Color, Normal, Roughness) | `/public/textures/bark/` | [CC0](https://polyhaven.com/license) |
| **Needle Foliage** | `pine_tree_01` (Branch Needle Cutout + Normal) | `/public/textures/foliage/` | [CC0](https://polyhaven.com/license) |
| **3D Rock Model** | `rock_07` (1K GLTF + Bin + Textures) | `/public/models/rock_07/` | [CC0](https://polyhaven.com/license) |

---

## ⚙️ Offline Procedural Fallback Generator

The original procedural asset generator script is preserved at `scripts/generate-assets.js`:
- **Role**: Offline fallback only.
- **Function**: Procedurally generates synthetic 512px canvas texture maps (grass, dirt, rock, snow, sky) in environments where external network access to Poly Haven is unavailable.
- **Usage**: `node scripts/generate-assets.js`
