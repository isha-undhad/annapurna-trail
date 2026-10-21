'use client';

import React from 'react';
import { useTrekStore } from '@/store/useTrekStore';

export function PauseModal() {
  const gameState = useTrekStore((s) => s.gameState);
  const togglePause = useTrekStore((s) => s.togglePause);
  const exitTrek = useTrekStore((s) => s.exitTrek);
  const elevation = useTrekStore((s) => s.elevation);
  const distanceWalked = useTrekStore((s) => s.distanceWalked);

  if (gameState !== 'paused') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/90 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold uppercase tracking-wider">
            <span>🏔️</span>
            <span>Expedition Halted</span>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
            Pause Menu
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Trek Paused
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Catch your breath amidst the Himalayan serenity.
        </p>

        {/* Current Session Summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-950/60 p-4 border border-white/10">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Altitude Reached
            </div>
            <div className="mt-1 text-lg font-black text-sky-300">
              {elevation.toLocaleString()} m
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Distance Covered
            </div>
            <div className="mt-1 text-lg font-black text-emerald-300">
              {distanceWalked} m
            </div>
          </div>
        </div>

        {/* Controls Quick Ref */}
        <div className="mt-6 rounded-2xl bg-slate-800/40 p-3.5 border border-white/5 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-slate-200">Controls Reminder:</div>
          <div>• Desktop: WASD to walk, Shift to sprint, Mouse to look</div>
          <div>• Mobile: Left virtual joystick to walk, Right drag to look</div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={togglePause}
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <span>Resume Trek</span>
          </button>
          <button
            onClick={exitTrek}
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-800/60 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-[0.98]"
          >
            <span>Exit to Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
