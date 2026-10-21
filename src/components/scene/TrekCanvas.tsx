'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DynamicTrekScene = dynamic(
  () => import('./TrekScene').then((mod) => mod.TrekScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-[#0d1829] text-white">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="absolute text-xl">🏔️</span>
        </div>
        <p className="mt-6 text-lg font-medium tracking-wide text-cyan-100">
          Preparing Annapurna Trail...
        </p>
        <p className="mt-2 text-sm text-cyan-300/70">
          Generating Himalayan terrain & morning sun
        </p>
      </div>
    ),
  }
);

export function TrekCanvas() {
  return <DynamicTrekScene />;
}
