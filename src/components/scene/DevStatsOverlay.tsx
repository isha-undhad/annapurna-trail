'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { useTrekStore, QualityLevel } from '@/store/useTrekStore';
import { WAYPOINTS, getTerrainHeight } from '@/lib/terrain';

export interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  lines: number;
  points: number;
  quality: QualityLevel;
  location: string;
}

declare global {
  interface Window {
    __TREK_METRICS__?: PerformanceMetrics;
    __TREK_DEV__?: {
      getMetrics: () => PerformanceMetrics;
      setQuality: (q: QualityLevel) => void;
      jumpTo: (name: 'Nayapul' | 'ABC' | 'Chhomrong') => void;
      setToggle: (subsystem: string, enabled: boolean) => void;
      getToggles: () => Record<string, boolean>;
    };
  }
}

function isDebugEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) return true;
  return false;
}

/**
 * In-Canvas Collector:
 * Hooks into Three.js render loop to accurately measure FPS and WebGL info.
 * Displayed strictly at bottom-left in dev mode or with ?debug in URL (Requirement 0).
 */
export function DevStatsCollector() {
  const { gl } = useThree();
  const quality = useTrekStore((s) => s.quality);
  const playerPos = useTrekStore((s) => s.playerPos);

  const frameTimes = useRef<number[]>([]);
  const lastSample = useRef<number>(performance.now());
  const fpsRef = useRef<number>(60);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDebugEnabled());
  }, []);

  useFrame((_, delta) => {
    const now = performance.now();
    frameTimes.current.push(delta);
    if (frameTimes.current.length > 45) {
      frameTimes.current.shift();
    }

    if (now - lastSample.current >= 200) {
      lastSample.current = now;
      const sum = frameTimes.current.reduce((a, b) => a + b, 0);
      const avgDelta = sum / (frameTimes.current.length || 1);
      fpsRef.current = Math.round(1 / Math.max(0.001, avgDelta));

      let locName = 'Trail';
      const px = playerPos[0];
      const pz = playerPos[2];
      if (Math.hypot(px - WAYPOINTS[0].gameX, pz - WAYPOINTS[0].gameZ) < 80) {
        locName = 'Nayapul';
      } else if (Math.hypot(px - WAYPOINTS[WAYPOINTS.length - 1].gameX, pz - WAYPOINTS[WAYPOINTS.length - 1].gameZ) < 120) {
        locName = 'ABC';
      }

      const metrics: PerformanceMetrics = {
        fps: fpsRef.current,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        lines: gl.info.render.lines,
        points: gl.info.render.points,
        quality,
        location: locName,
      };

      window.__TREK_METRICS__ = metrics;
    }
  });

  if (!enabled) return null;

  return (
    <>
      <Stats className="dev-stats-drei" />
    </>
  );
}

/**
 * DOM Overlay Dashboard:
 * Clean, translucent HUD overlay showing draw calls, triangles, FPS,
 * and individual subsystem toggles for isolating performance bottlenecks.
 */
export function DevStatsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    lines: 0,
    points: 0,
    quality: 'high',
    location: 'Nayapul',
  });

  useEffect(() => {
    setEnabled(isDebugEnabled());
  }, []);

  const quality = useTrekStore((s) => s.quality);
  const setQuality = useTrekStore((s) => s.setQuality);
  const devToggles = useTrekStore((s) => s.devToggles);
  const setDevToggle = useTrekStore((s) => s.setDevToggle);
  const teleportTo = useTrekStore((s) => s.teleportTo);

  // Setup window helper for headless automation
  useEffect(() => {
    window.__TREK_DEV__ = {
      getMetrics: () => window.__TREK_METRICS__ || metrics,
      setQuality: (q) => setQuality(q),
      jumpTo: (name) => {
        const wp = WAYPOINTS.find((w) => w.name.toLowerCase().includes(name.toLowerCase()));
        if (wp) {
          const y = getTerrainHeight(wp.gameX, wp.gameZ) + 1.7;
          teleportTo([wp.gameX, y, wp.gameZ]);
        }
      },
      setToggle: (subsystem, enabled) => {
        setDevToggle(subsystem as any, enabled);
      },
      getToggles: () => useTrekStore.getState().devToggles,
    };
  }, [setQuality, setDevToggle, teleportTo, metrics]);

  // Update DOM metrics at 5 Hz
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.__TREK_METRICS__) {
        setMetrics({ ...window.__TREK_METRICS__ });
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Force Drei Stats DOM to bottom-left (Requirement 0) */}
      <style>{`
        .dev-stats-drei {
          top: auto !important;
          right: auto !important;
          bottom: 12px !important;
          left: 12px !important;
          z-index: 50 !important;
        }
      `}</style>

      <div className="pointer-events-auto fixed bottom-3 left-28 z-40 select-none font-mono">
        {/* Floating Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-sky-300 backdrop-blur-md hover:bg-slate-900 shadow-xl transition-all"
          title="Toggle Performance Diagnostics & Subsystem Controls"
        >
          <span className={`inline-block h-2 w-2 rounded-full ${metrics.fps >= 50 ? 'bg-emerald-400' : metrics.fps >= 30 ? 'bg-amber-400' : 'bg-rose-500'}`} />
          <span>{metrics.fps} FPS</span>
          <span className="text-slate-500">•</span>
          <span>{metrics.drawCalls} DC</span>
          <span className="text-slate-500">•</span>
          <span>{(metrics.triangles / 1000).toFixed(0)}k ▲</span>
        </button>

        {/* Expanded Metrics & Diagnostics Panel (Opens upwards from bottom-left) */}
        {isOpen && (
          <div className="absolute bottom-12 left-0 w-80 rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-xs text-slate-200 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <span className="font-bold text-white text-sm">Renderer Telemetry</span>
            <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 uppercase">
              {metrics.quality}
            </span>
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-white/5 p-2 border border-white/5">
              <div className="text-[10px] text-slate-400">Framerate</div>
              <div className="text-lg font-bold text-emerald-400">{metrics.fps} <span className="text-xs font-normal text-slate-400">FPS</span></div>
            </div>
            <div className="rounded-lg bg-white/5 p-2 border border-white/5">
              <div className="text-[10px] text-slate-400">Draw Calls</div>
              <div className="text-lg font-bold text-sky-400">{metrics.drawCalls}</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2 border border-white/5">
              <div className="text-[10px] text-slate-400">Triangles</div>
              <div className="text-lg font-bold text-amber-300">{metrics.triangles.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2 border border-white/5">
              <div className="text-[10px] text-slate-400">Geometries / Textures</div>
              <div className="text-sm font-bold text-slate-200">{metrics.geometries} / {metrics.textures}</div>
            </div>
          </div>

          {/* Teleport / Location Jump */}
          <div className="mb-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quick Teleport</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => window.__TREK_DEV__?.jumpTo('Nayapul')}
                type="button"
                className="flex-1 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 text-[11px] font-semibold border border-sky-400/20"
              >
                Nayapul
              </button>
              <button
                onClick={() => window.__TREK_DEV__?.jumpTo('Chhomrong')}
                type="button"
                className="flex-1 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 text-[11px] font-semibold border border-sky-400/20"
              >
                Chhomrong
              </button>
              <button
                onClick={() => window.__TREK_DEV__?.jumpTo('ABC')}
                type="button"
                className="flex-1 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 text-[11px] font-semibold border border-sky-400/20"
              >
                ABC
              </button>
            </div>
          </div>

          {/* Quality Switcher */}
          <div className="mb-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Graphics Quality</div>
            <div className="flex gap-1.5">
              {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  type="button"
                  className={`flex-1 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                    quality === q
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Subsystem Isolation Toggles */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              Isolate Subsystems
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['terrain', 'Terrain Chunks'],
                  ['mountains', 'Distant Mountains'],
                  ['trees', 'Pine Trees'],
                  ['grass', 'Grass Tufts'],
                  ['rocks', 'Granite Boulders'],
                  ['shadows', 'Sun Shadows'],
                  ['postprocessing', 'Post-Processing'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={devToggles[key]}
                    onChange={(e) => setDevToggle(key, e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
}
