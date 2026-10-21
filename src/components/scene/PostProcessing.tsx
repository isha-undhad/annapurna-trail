'use client';

import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useTrekStore } from '@/store/useTrekStore';

export function PostProcessing() {
  const quality = useTrekStore((s) => s.quality);

  // Disable on low quality for maximum mobile frame rate
  if (quality === 'low') return null;

  return (
    <EffectComposer
      multisampling={quality === 'high' ? 4 : 0}
      enableNormalPass={false}
    >
      {/* Subtle bloom on sunrise highlights and snowy peaks */}
      <Bloom
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        intensity={0.42}
        mipmapBlur
      />

      {/* Gentle, natural morning mountaineering vignette */}
      <Vignette
        eskil={false}
        offset={0.38}
        darkness={0.22}
      />
    </EffectComposer>
  );
}
