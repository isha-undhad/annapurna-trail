'use client';

import React, { useEffect } from 'react';
import { useTrekStore, QualityLevel } from '@/store/useTrekStore';

function getCompassCardinal(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

export function TrekHUD() {
  const gameState = useTrekStore((s) => s.gameState);
  const elevation = useTrekStore((s) => s.elevation);
  const distanceWalked = useTrekStore((s) => s.distanceWalked);
  const playerHeading = useTrekStore((s) => s.playerHeading);
  const isSprinting = useTrekStore((s) => s.isSprinting);
  const isPointerLocked = useTrekStore((s) => s.isPointerLocked);
  const isMobile = useTrekStore((s) => s.isMobile);
  const quality = useTrekStore((s) => s.quality);
  const setQuality = useTrekStore((s) => s.setQuality);
  const togglePause = useTrekStore((s) => s.togglePause);

  // Auto-choose quality on first load based on hardware capability
  useEffect(() => {
    const isMobileDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 1 ||
      window.innerWidth < 800;

    const cores = navigator.hardwareConcurrency || 4;
    if (isMobileDevice) {
      setQuality(cores > 6 ? 'medium' : 'low');
    } else {
      setQuality(cores >= 8 ? 'high' : 'medium');
    }
  }, [setQuality]);

  if (gameState !== 'trekking') return null;

  const cardinal = getCompassCardinal(playerHeading);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Bar: Telemetry, Quality Selector, and Pause */}
      <header className="flex items-start justify-between gap-4">
        {/* Left: Altimeter & Distance */}
        <div className="flex flex-col gap-2">
          {/* Elevation Badge */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-2.5 backdrop-blur-md shadow-lg shadow-black/20">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 text-sm">
              ▲
            </span>
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                Altitude
              </div>
              <div className="text-xl font-black tracking-tight text-white flex items-baseline gap-1">
                <span>{elevation.toLocaleString()}</span>
                <span className="text-xs font-semibold text-sky-400">m</span>
                <span className="text-[11px] font-normal text-slate-400 ml-1">
                  ({Math.round(elevation * 3.28084).toLocaleString()} ft)
                </span>
              </div>
            </div>
          </div>

          {/* Distance & Pace */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1.5 backdrop-blur-md text-xs text-slate-300 w-fit">
            <span className="text-amber-400">🥾</span>
            <span>Distance:</span>
            <span className="font-bold text-white">{distanceWalked} m</span>
            {isSprinting && (
              <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                SPRINT
              </span>
            )}
          </div>
        </div>

        {/* Center: Compass Heading */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/60 px-4 py-1.5 backdrop-blur-md text-xs font-mono text-slate-200 shadow-md">
            <span className="font-bold text-sky-400">{cardinal}</span>
            <span className="text-slate-500">•</span>
            <span>{playerHeading.toString().padStart(3, '0')}°</span>
          </div>
          <span className="mt-1 text-[10px] tracking-wider text-slate-400 uppercase">
            Sanctuary Heading
          </span>
        </div>

        {/* Right: Quality Toggle & Pause Menu Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Quality Toggle Selector */}
          <div className="flex items-center rounded-2xl border border-white/15 bg-slate-950/60 p-1 backdrop-blur-md shadow-md text-xs">
            {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                type="button"
                className={`rounded-xl px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  quality === q
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {q === 'medium' ? 'Med' : q}
              </button>
            ))}
          </div>

          {/* Pause Button */}
          <button
            onClick={togglePause}
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/60 text-white backdrop-blur-md transition-all hover:bg-slate-900 hover:scale-105 active:scale-95 shadow-lg"
            title="Pause / Menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Desktop Crosshair & Click-to-look Prompt */}
      {!isMobile && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Crosshair */}
          <div className="relative flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-sm" />
            <div className="absolute -left-3 h-0.5 w-2 bg-white/40" />
            <div className="absolute -right-3 h-0.5 w-2 bg-white/40" />
            <div className="absolute -top-3 h-2 w-0.5 bg-white/40" />
            <div className="absolute -bottom-3 h-2 w-0.5 bg-white/40" />
          </div>

          {/* Pointer Lock Notice */}
          {!isPointerLocked && (
            <div className="mt-8 rounded-full border border-sky-400/30 bg-slate-950/80 px-4 py-2 text-xs font-medium text-sky-200 backdrop-blur-md shadow-xl animate-bounce">
              🖱️ Click anywhere to look around (WASD to walk)
            </div>
          )}
        </div>
      )}

      {/* Bottom Trail Guide Banner */}
      <footer className="flex flex-col items-center justify-center pb-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-4 py-1.5 text-xs text-slate-300 backdrop-blur-md shadow-md">
          <span className="text-sky-400">📍</span>
          <span>Follow the trail through rhododendron forests toward Annapurna Base Camp (4,130m)</span>
        </div>
      </footer>
    </div>
  );
}
