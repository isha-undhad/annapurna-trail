# 🏔️ Annapurna Trail — 3D First-Person Himalayan Trek

A 3D first-person trekking game set along Nepal's legendary Annapurna Base Camp (ABC) route in the Annapurna Sanctuary. Follow the winding trail through terraced foothills, pine forests, boulders, and Tibetan prayer cairns climbing from Nayapul (1,070m) towards the snowy amphitheater of Annapurna Base Camp (4,130m).

Built with **Next.js (App Router, TypeScript, Tailwind CSS)**, **Three.js**, **React Three Fiber (@react-three/fiber)**, **@react-three/drei**, and **Zustand**.

---

## ✨ Features

- **Atmospheric Himalayan Morning**: Soft morning sun casting long golden shadows, azure horizon fog, and crisp Himalayan alpine lighting.
- **Procedural Winding Dirt Trail**: A continuous organic path winding through rolling valley foothills and rising toward the high mountain pass.
- **Snow-Capped Peaks**: Low-poly distant Himalayan giants (inspired by Annapurna I and Machapuchare) rendered with snowy crowns and couloirs in a single merged draw call.
- **High-Performance Instancing**: Hundreds of low-poly Himalayan pines and alpine boulders batched with `<instancedMesh>` targeting 60 FPS on mid-range devices.
- **First-Person Mountain Controls**:
  - **Desktop**: `WASD` / Arrow keys to walk, `Shift` to sprint, pointer-locked mouse look (`PointerLockControls`), and natural sinusoidal walking bob.
  - **Mobile**: Left-side virtual analog joystick for omnidirectional movement, right-side touch drag for fluid camera look.
- **Real-Time Mountaineering HUD**: Live altimeter (meters + feet), compass azimuth heading, trek distance counter, and pause menu.
- **Zero External 3D Models**: All geometry is generated entirely from code.

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
