'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTrekStore } from '@/store/useTrekStore';

export function VirtualJoystick() {
  const isMobile = useTrekStore((s) => s.isMobile);
  const setIsMobile = useTrekStore((s) => s.setIsMobile);
  const setVirtualJoystick = useTrekStore((s) => s.setVirtualJoystick);
  const setMobileLookDelta = useTrekStore((s) => s.setMobileLookDelta);

  // Left joystick touch state
  const joystickTouchId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [originPos, setOriginPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);

  // Right look touch state
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto-detect touch capability
  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 840;
      setIsMobile(hasTouch);
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, [setIsMobile]);

  // Touch handlers for the left half (Movement Joystick)
  const handleLeftTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;

    // Use touch position as origin
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    joystickOrigin.current = { x, y };
    setOriginPos({ x, y });
    setKnobPos({ x: 0, y: 0 });
    setIsJoystickActive(true);
    setVirtualJoystick({ x: 0, y: 0, active: true });
  };

  const handleLeftTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;

        const dx = currentX - joystickOrigin.current.x;
        const dy = currentY - joystickOrigin.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = 50;

        let clampedX = dx;
        let clampedY = dy;
        if (dist > maxRadius) {
          clampedX = (dx / dist) * maxRadius;
          clampedY = (dy / dist) * maxRadius;
        }

        setKnobPos({ x: clampedX, y: clampedY });
        setVirtualJoystick({
          x: clampedX / maxRadius,
          y: clampedY / maxRadius,
          active: true,
        });
        break;
      }
    }
  };

  const handleLeftTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setKnobPos({ x: 0, y: 0 });
        setIsJoystickActive(false);
        setVirtualJoystick({ x: 0, y: 0, active: false });
        break;
      }
    }
  };

  // Touch handlers for the right half (Camera Look Drag)
  const handleRightTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleRightTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };

        setMobileLookDelta({ x: dx, y: dy });
        break;
      }
    }
  };

  const handleRightTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        setMobileLookDelta({ x: 0, y: 0 });
        break;
      }
    }
  };

  if (!isMobile) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none touch-none">
      {/* Left Touch Zone for Virtual Joystick */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-3/5 w-1/2 touch-none select-none"
        onTouchStart={handleLeftTouchStart}
        onTouchMove={handleLeftTouchMove}
        onTouchEnd={handleLeftTouchEnd}
        onTouchCancel={handleLeftTouchEnd}
      >
        {/* Joystick Visual Indicator */}
        <div
          className={`absolute transition-opacity duration-200 ${
            isJoystickActive ? 'opacity-90' : 'opacity-40'
          }`}
          style={{
            left: isJoystickActive
              ? `${originPos.x}px`
              : '80px',
            top: isJoystickActive
              ? `${originPos.y}px`
              : 'auto',
            bottom: isJoystickActive ? 'auto' : '80px',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer Ring */}
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/30 bg-slate-900/40 backdrop-blur-sm shadow-lg shadow-black/40">
            <div className="absolute inset-2 rounded-full border border-sky-400/20" />
            {/* Center Thumb Knob */}
            <div
              className="h-12 w-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 shadow-md shadow-sky-500/50 flex items-center justify-center"
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: isJoystickActive ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <div className="h-4 w-4 rounded-full bg-white/60" />
            </div>
          </div>
          <span className="mt-2 block text-center text-[10px] tracking-wider text-slate-300 font-semibold uppercase">
            Move
          </span>
        </div>
      </div>

      {/* Right Touch Zone for Drag-to-Look */}
      <div
        className="pointer-events-auto absolute bottom-0 right-0 h-3/5 w-1/2 touch-none select-none"
        onTouchStart={handleRightTouchStart}
        onTouchMove={handleRightTouchMove}
        onTouchEnd={handleRightTouchEnd}
        onTouchCancel={handleRightTouchEnd}
      >
        <div className="absolute bottom-8 right-8 flex items-center gap-2 rounded-full bg-slate-900/30 px-3 py-1.5 backdrop-blur-sm text-[11px] text-slate-300 border border-white/10 opacity-60">
          <span>👆 Drag to Look</span>
        </div>
      </div>
    </div>
  );
}
