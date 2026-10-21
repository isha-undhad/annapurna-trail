'use client';

import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  getTerrainHeight,
  clampPlayerPosition,
  START_POSITION,
  getRealElevationMeters,
} from '@/lib/terrain';
import { useTrekStore, playerTelemetry, CameraMode } from '@/store/useTrekStore';

const WALK_SPEED = 5.2; // meters/sec
const SPRINT_SPEED = 9.2; // meters/sec
const EYE_HEIGHT = 1.7; // standard eye height

export function PlayerController() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof PointerLockControls>>(null);

  // Zustand bindings
  const gameState = useTrekStore((s) => s.gameState);
  const isMobile = useTrekStore((s) => s.isMobile);
  const setIsPointerLocked = useTrekStore((s) => s.setIsPointerLocked);
  const cameraMode = useTrekStore((s) => s.cameraMode);
  const cycleCameraMode = useTrekStore((s) => s.cycleCameraMode);

  // Keyboard state
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  // Player position vector in horizontal plane
  const playerPosition = useRef(
    new THREE.Vector3(START_POSITION[0], START_POSITION[1] + EYE_HEIGHT, START_POSITION[2])
  );
  const trekkerYaw = useRef(0); // Facing angle of trekker in radians

  // Camera angles (yaw and pitch in radians)
  const camYaw = useRef(0);
  const camPitch = useRef(0.12);
  const orbitDistance = useRef(6.5); // Default orbit radius in meters

  // Smooth camera position and look target for blending (Requirement 1)
  const currentCamPos = useRef(
    new THREE.Vector3(START_POSITION[0], START_POSITION[1] + EYE_HEIGHT, START_POSITION[2])
  );
  const currentLookTarget = useRef(
    new THREE.Vector3(START_POSITION[0], START_POSITION[1] + EYE_HEIGHT, START_POSITION[2] + 1)
  );

  const bobTimer = useRef(0);
  const currentBob = useRef(0);
  const hudTimer = useRef(0);
  const distanceAccum = useRef(0);

  // Drag interaction state when pointer is not locked
  const isMouseDown = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const teleportTarget = useTrekStore((s) => s.teleportTarget);
  const clearTeleport = useTrekStore((s) => s.clearTeleport);

  // Initialize camera position on mount at Nayapul
  useEffect(() => {
    const startY = getTerrainHeight(START_POSITION[0], START_POSITION[2]) + EYE_HEIGHT;
    playerPosition.current.set(START_POSITION[0], startY, START_POSITION[2]);
    currentCamPos.current.copy(playerPosition.current);
    camera.position.copy(playerPosition.current);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  // Handle waypoint teleportation
  useEffect(() => {
    if (teleportTarget) {
      const targetY = getTerrainHeight(teleportTarget[0], teleportTarget[2]) + EYE_HEIGHT;
      playerPosition.current.set(teleportTarget[0], targetY, teleportTarget[2]);
      currentCamPos.current.set(teleportTarget[0], targetY, teleportTarget[2]);
      camera.position.copy(currentCamPos.current);

      playerTelemetry.pos[0] = teleportTarget[0];
      playerTelemetry.pos[1] = targetY - EYE_HEIGHT;
      playerTelemetry.pos[2] = teleportTarget[2];
      playerTelemetry.groundY = targetY - EYE_HEIGHT;
      playerTelemetry.elevation = getRealElevationMeters(teleportTarget[0], teleportTarget[2]);
      clearTeleport();
    }
  }, [teleportTarget, camera, clearTeleport]);

  // Desktop keyboard & mouse listeners (Key V, WASD, Wheel Zoom, Drag)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV' && !e.repeat) {
        cycleCameraMode();
        return;
      }

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

    // Scroll wheel zoom for Orbit camera mode
    const handleWheel = (e: WheelEvent) => {
      const zoomFactor = e.deltaY * 0.015;
      orbitDistance.current = Math.max(2.5, Math.min(24.0, orbitDistance.current + zoomFactor));
    };

    // Mouse drag when pointer is not locked
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isMouseDown.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // In pointer lock mode (or mouse drag)
      const isLocked = document.pointerLockElement !== null;
      let dx = 0;
      let dy = 0;

      if (isLocked) {
        dx = e.movementX;
        dy = e.movementY;
      } else if (isMouseDown.current) {
        dx = e.clientX - lastMousePos.current.x;
        dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }

      if (dx !== 0 || dy !== 0) {
        const sens = 0.0032;
        camYaw.current -= dx * sens;
        camPitch.current += dy * sens;

        // Clamp camera pitch angles
        const minPitch = cameraMode === 'orbit' ? -0.25 : -0.35;
        const maxPitch = cameraMode === 'orbit' ? 1.25 : 1.10;
        camPitch.current = Math.max(minPitch, Math.min(maxPitch, camPitch.current));
      }
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [cycleCameraMode, cameraMode]);

  // Temporary vectors for movement & camera math (Reused to prevent per-frame allocations)
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const idealCam = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (gameState !== 'trekking') return;

    // Cap delta to prevent huge jumps on lag spike
    const dt = Math.min(delta, 0.08);

    // 1. Mobile touch drag rotation
    if (isMobile) {
      const lookDelta = useTrekStore.getState().mobileLookDelta;
      if (lookDelta.x !== 0 || lookDelta.y !== 0) {
        const sensitivity = 0.0035;
        camYaw.current -= lookDelta.x * sensitivity;
        camPitch.current += lookDelta.y * sensitivity;

        const maxPitch = 1.2;
        camPitch.current = Math.max(-0.35, Math.min(maxPitch, camPitch.current));
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
        moveZ = -joystick.y; // Push up (-Y) is forward
        const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (magnitude > 0.85) {
          isSprinting = true;
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

    // 3. Movement Direction Relative to Camera Orientation (Requirement 2)
    // Horizontal camera direction vector
    forward.current.set(
      Math.sin(camYaw.current),
      0,
      Math.cos(camYaw.current)
    ).normalize();

    // Right vector perpendicular to camera direction
    right.current.crossVectors(forward.current, camera.up).normalize();

    moveDirection.current.set(0, 0, 0);
    moveDirection.current.addScaledVector(forward.current, moveZ);
    moveDirection.current.addScaledVector(right.current, -moveX);

    if (moveDirection.current.lengthSq() > 1) {
      moveDirection.current.normalize();
    }

    // 4. Update Position & Heading
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    if (isMoving) {
      const distance = speed * dt;
      playerPosition.current.x += moveDirection.current.x * distance;
      playerPosition.current.z += moveDirection.current.z * distance;
      distanceAccum.current += distance;

      // In Third-Person, Wide, and Orbit modes: trekker turns smoothly toward movement direction
      if (cameraMode !== 'first-person') {
        const targetAngle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
        let diff = targetAngle - trekkerYaw.current;
        // Wrap angle difference to [-PI, PI]
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        trekkerYaw.current += diff * Math.min(1.0, dt * 14.0);
      } else {
        trekkerYaw.current = camYaw.current;
      }

      // Walking head bob
      const bobFreq = isSprinting ? 13 : 9;
      bobTimer.current += dt * bobFreq;
      const targetBob = Math.sin(bobTimer.current) * (isSprinting ? 0.07 : 0.045);
      currentBob.current = THREE.MathUtils.lerp(currentBob.current, targetBob, 0.2);
    } else {
      currentBob.current = THREE.MathUtils.lerp(currentBob.current, 0, 0.1);
      if (cameraMode === 'first-person') {
        trekkerYaw.current = camYaw.current;
      }
    }

    // 5. Keep inside terrain bounds
    const clamped = clampPlayerPosition(playerPosition.current.x, playerPosition.current.z);
    playerPosition.current.x = clamped.x;
    playerPosition.current.z = clamped.z;

    // 6. Terrain Ground Height
    const groundY = getTerrainHeight(playerPosition.current.x, playerPosition.current.z);
    playerPosition.current.y = groundY;

    // 7. Multi-Mode Camera Computation & Smooth Damping (Requirement 1 & 2)
    const px = playerPosition.current.x;
    const pz = playerPosition.current.z;

    if (cameraMode === 'first-person') {
      // First-person: eye height with walking bob
      idealCam.current.set(px, groundY + EYE_HEIGHT + currentBob.current, pz);
      targetLook.current.set(
        px + Math.sin(camYaw.current) * Math.cos(camPitch.current) * 10,
        groundY + EYE_HEIGHT - Math.sin(camPitch.current) * 10,
        pz + Math.cos(camYaw.current) * Math.cos(camPitch.current) * 10
      );
    } else if (cameraMode === 'third-person') {
      // Third-person follow: 4.2m behind, 2.0m above, looking slightly ahead
      const dist = 4.2;
      const height = 2.0;
      targetLook.current.set(
        px + Math.sin(camYaw.current) * 1.5,
        groundY + 1.35,
        pz + Math.cos(camYaw.current) * 1.5
      );
      idealCam.current.set(
        px - Math.sin(camYaw.current) * Math.cos(camPitch.current) * dist,
        groundY + height + Math.sin(camPitch.current) * dist,
        pz - Math.cos(camYaw.current) * Math.cos(camPitch.current) * dist
      );
    } else if (cameraMode === 'wide') {
      // Wide cinematic view: 16m back, 9m up, framing trekker against the valley
      const dist = 16.0;
      const height = 9.0;
      targetLook.current.set(px, groundY + 1.2, pz);
      idealCam.current.set(
        px - Math.sin(camYaw.current) * Math.cos(camPitch.current) * dist,
        groundY + height + Math.sin(camPitch.current) * dist,
        pz - Math.cos(camYaw.current) * Math.cos(camPitch.current) * dist
      );
    } else {
      // Orbit view: 360° rotation around trekker with scroll/pinch zoom
      const dist = orbitDistance.current;
      targetLook.current.set(px, groundY + 1.25, pz);
      idealCam.current.set(
        px - Math.sin(camYaw.current) * Math.cos(camPitch.current) * dist,
        groundY + 1.25 + Math.sin(camPitch.current) * dist,
        pz - Math.cos(camYaw.current) * Math.cos(camPitch.current) * dist
      );
    }

    // Smooth camera damping between modes (~0.6s smooth transition)
    const blendRate = 1.0 - Math.exp(-dt / (cameraMode === 'wide' ? 0.35 : 0.18));
    currentCamPos.current.lerp(idealCam.current, blendRate);
    currentLookTarget.current.lerp(targetLook.current, blendRate);

    // Camera Terrain Clearance: Never go below terrain or inside hills
    const terrainAtCam = getTerrainHeight(currentCamPos.current.x, currentCamPos.current.z);
    const minClearance = 1.15;
    if (currentCamPos.current.y < terrainAtCam + minClearance) {
      currentCamPos.current.y = terrainAtCam + minClearance;
    }

    // Anti-Hill Occlusion: Sample along the ray from target to camera to prevent hill clipping
    if (cameraMode !== 'first-person') {
      for (const step of [0.3, 0.6, 0.85]) {
        const sampleX = THREE.MathUtils.lerp(currentLookTarget.current.x, currentCamPos.current.x, step);
        const sampleZ = THREE.MathUtils.lerp(currentLookTarget.current.z, currentCamPos.current.z, step);
        const sampleExpectedY = THREE.MathUtils.lerp(currentLookTarget.current.y, currentCamPos.current.y, step);
        const groundUnderRay = getTerrainHeight(sampleX, sampleZ);

        if (groundUnderRay + 0.85 > sampleExpectedY) {
          const pushUp = groundUnderRay + 0.85 - sampleExpectedY;
          currentCamPos.current.y += pushUp;
        }
      }
    }

    // Apply to Three.js camera
    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookTarget.current);

    // Compass heading (degrees: 0 = North, 90 = East, 180 = South, 270 = West)
    const headingDeg = Math.round(((camYaw.current * 180) / Math.PI + 360) % 360);

    // 8. Fast mutable telemetry ref (Zero React overhead on 60 FPS frames)
    playerTelemetry.pos[0] = px;
    playerTelemetry.pos[1] = groundY;
    playerTelemetry.pos[2] = pz;
    playerTelemetry.groundY = groundY;
    playerTelemetry.elevation = getRealElevationMeters(px, pz);
    playerTelemetry.distanceWalked = Math.round(distanceAccum.current);
    playerTelemetry.heading = headingDeg;
    playerTelemetry.trekkerYaw = trekkerYaw.current;
    playerTelemetry.isMoving = isMoving;
    playerTelemetry.isSprinting = isSprinting && isMoving;

    // 9. Throttled Store Update: sync to React store at ~5 Hz (every 200ms)
    hudTimer.current += dt;
    if (hudTimer.current >= 0.2) {
      hudTimer.current = 0;
      useTrekStore.setState({
        playerPos: [px, groundY, pz],
        elevation: playerTelemetry.elevation,
        distanceWalked: playerTelemetry.distanceWalked,
        playerHeading: headingDeg,
        isMoving,
        isSprinting: isSprinting && isMoving,
      });
    }
  });

  return (
    <>
      {!isMobile && gameState === 'trekking' && cameraMode === 'first-person' && (
        <PointerLockControls
          ref={controlsRef}
          onLock={() => setIsPointerLocked(true)}
          onUnlock={() => setIsPointerLocked(false)}
        />
      )}
    </>
  );
}
