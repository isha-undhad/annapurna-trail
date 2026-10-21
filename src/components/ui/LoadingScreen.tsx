'use client';

import React from 'react';
import { useProgress } from '@react-three/drei';

export function LoadingScreen() {
  const { active, progress, item } = useProgress();

  if (!active && progress >= 100) return null;

  // Format filename for readable display
  const currentAsset = item
    ? item.split('/').pop() || 'Environment & Textures'
    : 'Himalayan Assets';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b1526] px-6 text-white transition-opacity duration-500">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_65%)]" />

      {/* Central Spinner & Mountain Icon */}
      <div className="relative mb-8 flex items-center justify-center">
        <div className="h-20 w-20 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
        <span className="absolute text-3xl">🏔️</span>
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        Loading Annapurna Sanctuary
      </h2>
      <p className="mt-2 text-xs font-mono text-sky-300/80">
        Streaming PBR textures & 360° Himalayan HDRI
      </p>

      {/* Progress Bar */}
      <div className="mt-8 w-full max-w-xs">
        <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
          <span>Loading Assets</span>
          <span className="font-mono text-sky-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="mt-3 truncate text-center font-mono text-[11px] text-slate-400">
          {currentAsset}
        </div>
      </div>
    </div>
  );
}
