'use client';

import React from 'react';
import { useTrekStore } from '@/store/useTrekStore';

export function LandingScreen() {
  const startTrek = useTrekStore((s) => s.startTrek);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-[#0b1526] text-white selection:bg-cyan-500 selection:text-white">
      {/* Mountain atmospheric background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.22),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(15,31,56,0.9),transparent_70%)]" />

      {/* Decorative mountain ridge silhouette in the background */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 opacity-25">
        <svg
          viewBox="0 0 1440 320"
          className="absolute bottom-0 w-full h-full preserve-3d"
          preserveAspectRatio="none"
        >
          <path
            fill="#1e3a5f"
            d="M0,224L80,192L160,256L240,160L320,224L400,96L480,160L560,64L640,160L720,128L800,224L880,96L960,192L1040,128L1120,224L1200,96L1280,192L1360,160L1440,256L1440,320L0,320Z"
          />
          <path
            fill="#0f233d"
            d="M0,256L60,240L120,270L180,210L240,260L300,180L360,240L420,150L480,210L540,120L600,200L660,160L720,240L780,180L840,260L900,140L960,220L1020,180L1080,250L1140,170L1200,240L1260,190L1320,260L1380,210L1440,270L1440,320L0,320Z"
          />
        </svg>
      </div>

      {/* Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30">
            🏔️
          </span>
          <div>
            <span className="text-xs font-semibold tracking-widest uppercase text-sky-400">
              Nepal • Annapurna Sanctuary
            </span>
            <div className="text-sm font-light text-slate-300">Annapurna Base Camp (ABC) Trek</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-950/40 px-3.5 py-1 text-xs text-sky-200 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Realtime 3D • 60 FPS</span>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-12 text-center md:px-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-sky-300 backdrop-blur-md">
          <span>🌄 Annapurna Sanctuary Expedition</span>
        </div>

        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="bg-gradient-to-b from-white via-slate-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
            Annapurna Trail
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg md:text-xl font-light leading-relaxed">
          Embark on an unforgettable first-person trek through terraced villages, lush forests,
          and blooming rhododendron groves, climbing towards the colossal snowy amphitheater of
          Annapurna Base Camp (4,130m).
        </p>

        {/* Start Trek Call-to-Action */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={startTrek}
            type="button"
            className="group relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.03] hover:shadow-cyan-500/40 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-sky-400/50"
          >
            <span>Start Trek</span>
            <svg
              className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
          <span className="text-xs text-slate-400">
            No installation or download required • Works on desktop and mobile
          </span>
        </div>

        {/* Controls Info Grid */}
        <div className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
          {/* Desktop Controls */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
              <span>🖥️ Desktop Controls</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                  W A S D
                </kbd>
                <span>Move in 4 directions</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                  Shift
                </kbd>
                <span>Sprint / Walk faster</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                  Mouse Look
                </kbd>
                <span>Click screen to look around</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                  Esc
                </kbd>
                <span>Release mouse cursor</span>
              </li>
            </ul>
          </div>

          {/* Mobile Controls */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <span>📱 Mobile & Touch Controls</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  🕹️
                </span>
                <span>Left virtual joystick to move</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  👆
                </span>
                <span>Drag anywhere on right to look</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  ⚡
                </span>
                <span>Push joystick to outer edge to sprint</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  ⛰️
                </span>
                <span>Auto ground terrain collision</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-slate-400 md:px-12">
        <div>Trailhead: Nayapul (1,070m) • Goal: Annapurna Base Camp (4,130m) • Annapurna Sanctuary</div>
        <div>Built with Next.js, Three.js, React Three Fiber & Zustand</div>
      </footer>
    </div>
  );
}
