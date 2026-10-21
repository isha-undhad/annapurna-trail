'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTrekStore, QualityLevel, CameraMode } from '@/store/useTrekStore';
import { WAYPOINTS, getTerrainHeight, getNextRouteWaypoint } from '@/lib/terrain';
import { WORLD_SCALE } from '@/lib/constants';

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
  const playerPos = useTrekStore((s) => s.playerPos);
  const isSprinting = useTrekStore((s) => s.isSprinting);
  const isPointerLocked = useTrekStore((s) => s.isPointerLocked);
  const isMobile = useTrekStore((s) => s.isMobile);
  const quality = useTrekStore((s) => s.quality);
  const setQuality = useTrekStore((s) => s.setQuality);
  const togglePause = useTrekStore((s) => s.togglePause);
  const teleportTo = useTrekStore((s) => s.teleportTo);

  const [showWaypointMenu, setShowWaypointMenu] = useState(false);

  // Quick FPS calibration at load (Requirement 2f)
  useEffect(() => {
    // Start at Medium by default
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.__TREK_METRICS__) {
        const measuredFps = window.__TREK_METRICS__.fps;
        if (measuredFps >= 54) {
          setQuality('high');
        } else if (measuredFps < 32) {
          setQuality('low');
        }
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, [setQuality]);

  const cameraMode = useTrekStore((s) => s.cameraMode);
  const cycleCameraMode = useTrekStore((s) => s.cycleCameraMode);

  // Determine "Next Stop" waypoint and distance along route (Requirement 0)
  const nextStop = useMemo(() => {
    const { nextWaypoint, distanceAlongRouteMeters } = getNextRouteWaypoint(playerPos[0], playerPos[2]);
    return {
      name: nextWaypoint.name,
      distance: distanceAlongRouteMeters,
      elevation: nextWaypoint.elevation,
    };
  }, [playerPos]);

  if (gameState !== 'trekking') return null;

  const cardinal = getCompassCardinal(playerHeading);

  const handleWaypointJump = (wp: (typeof WAYPOINTS)[0]) => {
    const y = getTerrainHeight(wp.gameX, wp.gameZ) + 1.7;
    teleportTo([wp.gameX, y, wp.gameZ]);
    setShowWaypointMenu(false);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Bar: Telemetry, Quality Selector, Dev Menu, and Pause */}
      <header className="flex items-start justify-between gap-4">
        {/* Left: Altimeter & Next Stop */}
        <div className="flex flex-col gap-2">
          {/* Elevation Badge */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-2.5 backdrop-blur-md shadow-lg shadow-black/20">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 text-sm">
              ▲
            </span>
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                Altitude (Real DEM)
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

          {/* Next Stop Waypoint Badge */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-slate-950/50 px-3 py-1.5 backdrop-blur-md text-xs text-slate-200 w-fit">
            <span className="text-sky-400">📍</span>
            <span className="text-slate-400">Next stop:</span>
            <span className="font-bold text-white">{nextStop.name}</span>
            <span className="font-mono text-sky-300">({nextStop.distance}m)</span>
          </div>

          {/* Distance Walked */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1 backdrop-blur-md text-xs text-slate-300 w-fit">
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
            Sanctuary Azimuth
          </span>
        </div>

        {/* Right: Camera Mode, Dev Waypoint Jump Menu, Quality Toggle & Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Camera Mode Switcher Button (Requirement 1 & 4) */}
          <button
            onClick={cycleCameraMode}
            type="button"
            className="flex items-center gap-1.5 rounded-2xl border border-sky-400/30 bg-slate-950/70 px-3 py-2 text-xs font-bold text-sky-200 backdrop-blur-md hover:bg-slate-900 transition-all shadow-md group"
            title="Switch Camera View Mode (Press V to cycle)"
          >
            <span className="text-sm">
              {cameraMode === 'first-person' ? '👁️' : cameraMode === 'third-person' ? '🚶' : cameraMode === 'wide' ? '🌄' : '🔄'}
            </span>
            <span className="hidden sm:inline capitalize">
              {cameraMode === 'first-person' ? '1st Person' : cameraMode === 'third-person' ? '3rd Person' : cameraMode === 'wide' ? 'Wide' : 'Orbit'}
            </span>
            <kbd className="hidden md:inline rounded bg-white/10 px-1 py-0.5 text-[9px] text-sky-300 font-mono">V</kbd>
          </button>

          {/* Dev Waypoint Jump Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowWaypointMenu(!showWaypointMenu)}
              type="button"
              className="flex items-center gap-1.5 rounded-2xl border border-amber-400/30 bg-amber-950/50 px-3 py-2 text-xs font-bold text-amber-200 backdrop-blur-md hover:bg-amber-900/60 transition-all shadow-md"
              title="Development Waypoint Teleport Menu"
            >
              <span>🧭</span>
              <span className="hidden md:inline">Jump Waypoint</span>
            </button>

            {/* Dropdown Menu */}
            {showWaypointMenu && (
              <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-2xl border border-white/20 bg-slate-950/95 p-2 backdrop-blur-xl shadow-2xl text-xs z-50">
                <div className="px-3 py-2 border-b border-white/10 font-bold text-slate-300 flex justify-between items-center">
                  <span>Fast Travel (Dev Menu)</span>
                  <span className="text-[10px] text-amber-400">17 Villages</span>
                </div>
                <div className="py-1">
                  {WAYPOINTS.map((wp, i) => (
                    <button
                      key={i}
                      onClick={() => handleWaypointJump(wp)}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-sky-500/20 hover:text-sky-200 text-slate-300 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium truncate">{wp.name}</span>
                      <span className="font-mono text-[11px] text-sky-400 ml-2">
                        {wp.elevation}m
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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

      {/* Mobile Floating Camera Mode Switch Button (Requirement 1 & 4) */}
      {isMobile && (
        <button
          onClick={cycleCameraMode}
          type="button"
          className="pointer-events-auto fixed bottom-24 right-4 z-30 flex h-12 w-12 flex-col items-center justify-center rounded-2xl border border-sky-400/40 bg-slate-950/85 text-sky-300 backdrop-blur-md shadow-2xl active:scale-90 transition-transform"
          title="Cycle Camera Mode (1st Person, 3rd Person, Wide, Orbit)"
        >
          <span className="text-base">
            {cameraMode === 'first-person' ? '👁️' : cameraMode === 'third-person' ? '🚶' : cameraMode === 'wide' ? '🌄' : '🔄'}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-tight">Cam</span>
        </button>
      )}

      {/* Desktop Crosshair & Click-to-look Prompt (Only in first-person mode) */}
      {!isMobile && cameraMode === 'first-person' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-sm" />
            <div className="absolute -left-3 h-0.5 w-2 bg-white/40" />
            <div className="absolute -right-3 h-0.5 w-2 bg-white/40" />
            <div className="absolute -top-3 h-2 w-0.5 bg-white/40" />
            <div className="absolute -bottom-3 h-2 w-0.5 bg-white/40" />
          </div>

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
          <span className="text-sky-400">🏔️</span>
          <span>Annapurna Base Camp Sanctuary Trek (Nayapul 1,035m → ABC 4,077m)</span>
        </div>
      </footer>
    </div>
  );
}
