'use client';

import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTrekStore } from '@/store/useTrekStore';
import {
  getTerrainHeight,
  clampPlayerPosition,
  START_POSITION,
} from '@/lib/terrain';

const WALK_SPEED = 5.2; // meters/sec
const SPRINT_SPEED = 9.2; // meters/sec
const EYE_HEIGHT = 1.7; // standard eye height

export function PlayerController() {
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof PointerLockControls>>(null);

  // Zustand bindings
  const gameState = useTrekStore((s) => s.gameState);
  const isMobile = useTrekStore((s) => s.isMobile);
  const setIsPointerLocked = useTrekStore((s) => s.setIsPointerLocked);
  const setPlayerPos = useTrekStore((s) => s.setPlayerPos);
  const setPlayerHeading = useTrekStore((s) => s.setPlayerHeading);
  const setIsMoving = useTrekStore((s) => s.setIsMoving);
  const setIsSprinting = useTrekStore((s) => s.setIsSprinting);
  const addDistanceWalked = useTrekStore((s) => s.addDistanceWalked);

  // Keyboard state
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  // Player position vector in horizontal plane
  const playerPosition = useRef(new THREE.Vector3(START_POSITION[0], START_POSITION[1] + EYE_HEIGHT, START_POSITION[2]));
  const bobTimer = useRef(0);
  const currentBob = useRef(0);

  // Mobile look angles (yaw & pitch in radians)
  const mobileYaw = useRef(0);
  const mobilePitch = useRef(0);

  const teleportTarget = useTrekStore((s) => s.teleportTarget);
  const clearTeleport = useTrekStore((s) => s.clearTeleport);

  // Initialize camera position on mount at Nayapul facing along trail
  useEffect(() => {
    const startY = getTerrainHeight(START_POSITION[0], START_POSITION[2]) + EYE_HEIGHT;
    playerPosition.current.set(START_POSITION[0], startY, START_POSITION[2]);
    camera.position.copy(playerPosition.current);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  // Handle waypoint teleportation
  useEffect(() => {
    if (teleportTarget) {
      const targetY = getTerrainHeight(teleportTarget[0], teleportTarget[2]) + EYE_HEIGHT;
      playerPosition.current.set(teleportTarget[0], targetY, teleportTarget[2]);
      camera.position.copy(playerPosition.current);
      clearTeleport();
    }
  }, [teleportTarget, camera, clearTeleport]);

  // Desktop keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Temporary vectors for movement math
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (gameState !== 'trekking') return;

    // Cap delta to prevent huge jumps on tab switch / lag
    const dt = Math.min(delta, 0.08);

    // 1. Mobile touch drag rotation
    if (isMobile) {
      const lookDelta = useTrekStore.getState().mobileLookDelta;
      if (lookDelta.x !== 0 || lookDelta.y !== 0) {
        const sensitivity = 0.0035;
        mobileYaw.current -= lookDelta.x * sensitivity;
        mobilePitch.current -= lookDelta.y * sensitivity;

        // Clamp pitch to avoid gimbal flip (-85° to +85°)
        const maxPitch = (85 * Math.PI) / 180;
        mobilePitch.current = Math.max(-maxPitch, Math.min(maxPitch, mobilePitch.current));

        // Apply Euler rotation to camera: order YXZ
        camera.rotation.set(0, 0, 0);
        camera.rotation.y = mobileYaw.current;
        camera.rotation.x = mobilePitch.current;

        // Reset delta
        useTrekStore.getState().setMobileLookDelta({ x: 0, y: 0 });
      }
    }

    // 2. Compute Movement Inputs (Desktop + Mobile)
    let moveX = 0; // -1 (left) to +1 (right)
    let moveZ = 0; // -1 (backward) to +1 (forward)
    let isSprinting = false;

    if (isMobile) {
      const joystick = useTrekStore.getState().virtualJoystick;
      if (joystick.active) {
        moveX = joystick.x;
        moveZ = -joystick.y; // In joystick: pulling down is positive Y, so push up (-Y) is forward
        const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (magnitude > 0.85) {
          isSprinting = true; // Sprint on deep joystick tilt
        }
      }
    } else {
      if (keys.current.forward) moveZ += 1;
      if (keys.current.backward) moveZ -= 1;
      if (keys.current.left) moveX -= 1;
      if (keys.current.right) moveX += 1;
      isSprinting = keys.current.sprint;
    }

    const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;
    setIsMoving(isMoving);
    setIsSprinting(isSprinting && isMoving);

    // 3. Movement Direction relative to camera orientation
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    moveDirection.current.set(0, 0, 0);
    moveDirection.current.addScaledVector(forward.current, moveZ);
    moveDirection.current.addScaledVector(right.current, moveX);

    if (moveDirection.current.lengthSq() > 1) {
      moveDirection.current.normalize();
    }

    // 4. Update Position
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    if (isMoving) {
      const distance = speed * dt;
      playerPosition.current.x += moveDirection.current.x * distance;
      playerPosition.current.z += moveDirection.current.z * distance;
      addDistanceWalked(distance);

      // Walking head bob
      const bobFreq = isSprinting ? 13 : 9;
      bobTimer.current += dt * bobFreq;
      const targetBob = Math.sin(bobTimer.current) * (isSprinting ? 0.07 : 0.045);
      currentBob.current = THREE.MathUtils.lerp(currentBob.current, targetBob, 0.2);
    } else {
      currentBob.current = THREE.MathUtils.lerp(currentBob.current, 0, 0.1);
    }

    // 5. Keep inside terrain bounds
    const clamped = clampPlayerPosition(playerPosition.current.x, playerPosition.current.z);
    playerPosition.current.x = clamped.x;
    playerPosition.current.z = clamped.z;

    // 6. Terrain Height Adherence (snap smoothly to terrain + eye height + bob)
    const groundY = getTerrainHeight(playerPosition.current.x, playerPosition.current.z);
    const targetCameraY = groundY + EYE_HEIGHT + currentBob.current;
    playerPosition.current.y = THREE.MathUtils.lerp(playerPosition.current.y, targetCameraY, 0.25);

    // Update 3D camera
    camera.position.x = playerPosition.current.x;
    camera.position.y = playerPosition.current.y;
    camera.position.z = playerPosition.current.z;

    // 7. Update Store telemetry
    setPlayerPos([playerPosition.current.x, groundY, playerPosition.current.z]);

    // Compass heading (degrees: 0 = North, 90 = East, 180 = South, 270 = West)
    const headingRad = Math.atan2(forward.current.x, -forward.current.z);
    const headingDeg = Math.round(((headingRad * 180) / Math.PI + 360) % 360);
    setPlayerHeading(headingDeg);
  });

  return (
    <>
      {!isMobile && gameState === 'trekking' && (
        <PointerLockControls
          ref={controlsRef}
          onLock={() => setIsPointerLocked(true)}
          onUnlock={() => setIsPointerLocked(false)}
        />
      )}
    </>
  );
}
