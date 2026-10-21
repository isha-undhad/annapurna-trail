'use client';

import React from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useTrekStore } from '@/store/useTrekStore';

export function PostProcessing() {
  const quality = useTrekStore((s) => s.quality);

  // Disabled on Low and Medium to maximize framerate (Requirement 2e)
  if (quality !== 'high') return null;

  return (
    <EffectComposer
      multisampling={0}
      enableNormalPass={false}
    >
      {/* Bloom at reduced resolution (Requirement 2e) */}
      <Bloom
        luminanceThreshold={0.88}
        luminanceSmoothing={0.3}
        intensity={0.35}
        mipmapBlur
        resolutionScale={0.5}
      />
    </EffectComposer>
  );
}
