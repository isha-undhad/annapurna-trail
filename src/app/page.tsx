'use client';

import React from 'react';
import { useTrekStore } from '@/store/useTrekStore';
import { LandingScreen } from '@/components/ui/LandingScreen';
import { TrekCanvas } from '@/components/scene/TrekCanvas';
import { TrekHUD } from '@/components/ui/TrekHUD';
import { VirtualJoystick } from '@/components/ui/VirtualJoystick';
import { PauseModal } from '@/components/ui/PauseModal';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function HomePage() {
  const gameState = useTrekStore((s) => s.gameState);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1526]">
      {gameState === 'landing' ? (
        <LandingScreen />
      ) : (
        <>
          <TrekCanvas />
          <TrekHUD />
          <VirtualJoystick />
          <PauseModal />
          <LoadingScreen />
        </>
      )}
    </main>
  );
}
