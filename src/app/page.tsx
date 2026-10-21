'use client';

import React from 'react';
import { useTrekStore } from '@/store/useTrekStore';
import { LandingScreen } from '@/components/ui/LandingScreen';
import { TrekCanvas } from '@/components/scene/TrekCanvas';
import { TrekHUD } from '@/components/ui/TrekHUD';
import { VirtualJoystick } from '@/components/ui/VirtualJoystick';
import { PauseModal } from '@/components/ui/PauseModal';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DevStatsPanel } from '@/components/scene/DevStatsOverlay';

export default function HomePage() {
  const gameState = useTrekStore((s) => s.gameState);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1526]">
      {gameState === 'landing' ? (
        <LandingScreen />
      ) : (
        <>
          <TrekCanvas />
          {/* Pure CSS Vignette Overlay (Zero GPU shader cost - Requirement 2e) */}
          <div
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 60%, rgba(5, 12, 24, 0.45) 100%)',
            }}
          />
          <TrekHUD />
          <VirtualJoystick />
          <PauseModal />
          <LoadingScreen />
          <DevStatsPanel />
        </>
      )}
    </main>
  );
}
