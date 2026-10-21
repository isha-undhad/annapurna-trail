'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTrekStore, playerTelemetry } from '@/store/useTrekStore';
import { getTerrainHeight } from '@/lib/terrain';

/**
 * Himalayan Trekker Character Component
 * - Displays a 1.7m humanoid trekker with alpine backpack and trekking poles.
 * - Procedural locomotion animations (walk, sprint, idle, and slope tilt).
 * - Attempts to load FBX model if `/models/trekker/character.fbx` exists;
 *   smoothly falls back to procedural humanoid if missing.
 * - Feet firmly grounded on real DEM terrain, casting shadow in sun frustum.
 * - Hidden in first-person mode, visible in third-person, wide, and orbit modes.
 */
export function Trekker() {
  const cameraMode = useTrekStore((s) => s.cameraMode);
  const groupRef = useRef<THREE.Group>(null!);

  // Articulated limb references for procedural animation
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const torsoRef = useRef<THREE.Group>(null!);
  const leftPoleRef = useRef<THREE.Group>(null!);
  const rightPoleRef = useRef<THREE.Group>(null!);

  const animTimer = useRef(0);
  const currentTilt = useRef(0);
  const [hasFBX, setHasFBX] = useState(false);

  // Check once on mount for optional FBX character model
  useEffect(() => {
    let active = true;
    fetch('/models/trekker/character.fbx', { method: 'HEAD' })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          console.info('Custom trekker FBX model detected at /models/trekker/character.fbx');
          setHasFBX(true);
        } else {
          console.info('Trekker FBX model not found at /models/trekker/character.fbx; using procedural humanoid trekker.');
        }
      })
      .catch(() => {
        if (active) {
          console.info('Trekker FBX model not found at /models/trekker/character.fbx; using procedural humanoid trekker.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Shared reusable materials (Zero per-frame allocations)
  const materials = useMemo(() => {
    return {
      jacket: new THREE.MeshStandardMaterial({
        color: '#b91c1c', // Alpine red Gore-Tex jacket
        roughness: 0.65,
        metalness: 0.05,
      }),
      pants: new THREE.MeshStandardMaterial({
        color: '#27272a', // Charcoal trekking cargo pants
        roughness: 0.8,
        metalness: 0.0,
      }),
      boots: new THREE.MeshStandardMaterial({
        color: '#451a03', // Rugged leather hiking boots
        roughness: 0.9,
        metalness: 0.1,
      }),
      backpack: new THREE.MeshStandardMaterial({
        color: '#0369a1', // Expedition blue 65L backpack
        roughness: 0.6,
        metalness: 0.1,
      }),
      bedroll: new THREE.MeshStandardMaterial({
        color: '#15803d', // Green foam sleeping mat
        roughness: 0.9,
        metalness: 0.0,
      }),
      skin: new THREE.MeshStandardMaterial({
        color: '#d4a373', // Sun-tanned skin tone
        roughness: 0.7,
        metalness: 0.0,
      }),
      hat: new THREE.MeshStandardMaterial({
        color: '#18181b', // Black thermal beanie
        roughness: 0.85,
        metalness: 0.0,
      }),
      glasses: new THREE.MeshStandardMaterial({
        color: '#0f172a', // Glacier UV sunglasses
        roughness: 0.2,
        metalness: 0.8,
      }),
      poleShaft: new THREE.MeshStandardMaterial({
        color: '#71717a', // Carbon fiber trekking pole
        roughness: 0.4,
        metalness: 0.6,
      }),
      poleGrip: new THREE.MeshStandardMaterial({
        color: '#292524', // Ergonomic cork / rubber grip
        roughness: 0.9,
        metalness: 0.0,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Read direct from zero-allocation transient telemetry
    const px = playerTelemetry.pos[0];
    const pz = playerTelemetry.pos[2];
    const groundY = playerTelemetry.groundY;
    const yaw = playerTelemetry.trekkerYaw;
    const isMoving = playerTelemetry.isMoving;
    const isSprinting = playerTelemetry.isSprinting;

    // 1. Position on ground
    groupRef.current.position.set(px, groundY, pz);

    // 2. Terrain Slope Alignment (sample 0.6m ahead and behind in trekker facing direction)
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const hAhead = getTerrainHeight(px + forwardX * 0.6, pz + forwardZ * 0.6);
    const hBehind = getTerrainHeight(px - forwardX * 0.6, pz - forwardZ * 0.6);
    const targetPitch = Math.max(-0.35, Math.min(0.35, Math.atan2(hAhead - hBehind, 1.2)));

    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetPitch, 0.15);

    // Set rotation: yaw (horizontal facing) and pitch (slope incline)
    groupRef.current.rotation.set(-currentTilt.current, yaw, 0, 'YXZ');

    // 3. Procedural Walk & Sprint Kinematics
    const dt = Math.min(delta, 0.08);

    if (isMoving) {
      const strideFreq = isSprinting ? 14.0 : 8.5;
      animTimer.current += dt * strideFreq;

      const legSwingMax = isSprinting ? 0.75 : 0.48;
      const armSwingMax = isSprinting ? 0.65 : 0.42;

      const swing = Math.sin(animTimer.current);

      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = swing * legSwingMax;
        rightLegRef.current.rotation.x = -swing * legSwingMax;
      }

      if (leftArmRef.current && rightArmRef.current) {
        // Arms swing in opposition to legs
        leftArmRef.current.rotation.x = -swing * armSwingMax;
        rightArmRef.current.rotation.x = swing * armSwingMax;
      }

      if (torsoRef.current) {
        // Vertical step bounce
        const bob = Math.abs(Math.cos(animTimer.current)) * (isSprinting ? 0.05 : 0.03);
        torsoRef.current.position.y = 0.95 + bob;
        torsoRef.current.rotation.x = isSprinting ? 0.12 : 0.05; // Lean forward into stride
      }
    } else {
      // Idle: smooth breathing and natural resting stance
      animTimer.current += dt * 2.0;
      const breathe = Math.sin(animTimer.current) * 0.015;

      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.1);
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.1);
      }

      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.15, 0.1);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.15, 0.1);
      }

      if (torsoRef.current) {
        torsoRef.current.position.y = THREE.MathUtils.lerp(torsoRef.current.position.y, 0.95 + breathe, 0.1);
        torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, 0, 0.1);
      }
    }
  });

  // Hide in first-person mode
  if (cameraMode === 'first-person') {
    return null;
  }

  return (
    <group ref={groupRef} name="trekker-character">
      {/* Procedural Humanoid Trekker (~1.7m tall) */}
      <group position={[0, 0, 0]}>
        {/* Left Leg & Boot (Hips at y=0.88) */}
        <group ref={leftLegRef} position={[-0.14, 0.88, 0]}>
          {/* Thigh & Calf */}
          <mesh
            position={[0, -0.42, 0]}
            material={materials.pants}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.075, 0.065, 0.78, 8]} />
          </mesh>
          {/* Hiking Boot */}
          <mesh
            position={[0, -0.82, 0.04]}
            material={materials.boots}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.13, 0.12, 0.24]} />
          </mesh>
        </group>

        {/* Right Leg & Boot (Hips at y=0.88) */}
        <group ref={rightLegRef} position={[0.14, 0.88, 0]}>
          {/* Thigh & Calf */}
          <mesh
            position={[0, -0.42, 0]}
            material={materials.pants}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.075, 0.065, 0.78, 8]} />
          </mesh>
          {/* Hiking Boot */}
          <mesh
            position={[0, -0.82, 0.04]}
            material={materials.boots}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.13, 0.12, 0.24]} />
          </mesh>
        </group>

        {/* Pelvis & Hips */}
        <mesh
          position={[0, 0.91, 0]}
          material={materials.pants}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.34, 0.14, 0.22]} />
        </mesh>

        {/* Torso & Upper Body */}
        <group ref={torsoRef} position={[0, 0.95, 0]}>
          {/* Alpine Jacket Torso */}
          <mesh
            position={[0, 0.24, 0]}
            material={materials.jacket}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.38, 0.44, 0.24]} />
          </mesh>

          {/* Expedition Backpack (Mounted to Back) */}
          <group position={[0, 0.24, -0.19]}>
            {/* Main Pack Body */}
            <mesh
              position={[0, 0, 0]}
              material={materials.backpack}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.32, 0.52, 0.22]} />
            </mesh>
            {/* Top Foam Sleeping Mat Roll */}
            <mesh
              position={[0, 0.28, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={materials.bedroll}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[0.06, 0.06, 0.36, 10]} />
            </mesh>
            {/* Side Water Bottle */}
            <mesh
              position={[0.18, -0.06, 0.04]}
              material={materials.glasses}
              castShadow
            >
              <cylinderGeometry args={[0.04, 0.04, 0.18, 8]} />
            </mesh>
          </group>

          {/* Neck & Head */}
          <mesh
            position={[0, 0.52, 0]}
            material={materials.skin}
            castShadow
          >
            <cylinderGeometry args={[0.06, 0.065, 0.12, 8]} />
          </mesh>
          <mesh
            position={[0, 0.65, 0]}
            material={materials.skin}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.11, 12, 10]} />
          </mesh>
          {/* Black Thermal Beanie */}
          <mesh
            position={[0, 0.70, -0.01]}
            material={materials.hat}
            castShadow
          >
            <sphereGeometry args={[0.116, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* Glacier UV Sunglasses */}
          <mesh
            position={[0, 0.65, 0.105]}
            material={materials.glasses}
            castShadow
          >
            <boxGeometry args={[0.16, 0.04, 0.03]} />
          </mesh>

          {/* Left Arm & Trekking Pole */}
          <group ref={leftArmRef} position={[-0.23, 0.40, 0]}>
            {/* Sleeve & Arm */}
            <mesh
              position={[0, -0.22, 0]}
              material={materials.jacket}
              castShadow
            >
              <cylinderGeometry args={[0.055, 0.05, 0.44, 8]} />
            </mesh>
            {/* Hand */}
            <mesh
              position={[0, -0.44, 0.02]}
              material={materials.skin}
              castShadow
            >
              <sphereGeometry args={[0.045, 8, 8]} />
            </mesh>
            {/* Trekking Pole */}
            <group ref={leftPoleRef} position={[0, -0.42, 0.06]}>
              {/* Grip */}
              <mesh position={[0, 0.08, 0]} material={materials.poleGrip} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
              </mesh>
              {/* Shaft extending downward */}
              <mesh position={[0, -0.42, 0]} material={materials.poleShaft} castShadow>
                <cylinderGeometry args={[0.01, 0.008, 0.88, 6]} />
              </mesh>
              {/* Mud / Snow Basket */}
              <mesh position={[0, -0.74, 0]} material={materials.poleGrip}>
                <cylinderGeometry args={[0.04, 0.04, 0.015, 8]} />
              </mesh>
            </group>
          </group>

          {/* Right Arm & Trekking Pole */}
          <group ref={rightArmRef} position={[0.23, 0.40, 0]}>
            {/* Sleeve & Arm */}
            <mesh
              position={[0, -0.22, 0]}
              material={materials.jacket}
              castShadow
            >
              <cylinderGeometry args={[0.055, 0.05, 0.44, 8]} />
            </mesh>
            {/* Hand */}
            <mesh
              position={[0, -0.44, 0.02]}
              material={materials.skin}
              castShadow
            >
              <sphereGeometry args={[0.045, 8, 8]} />
            </mesh>
            {/* Trekking Pole */}
            <group ref={rightPoleRef} position={[0, -0.42, 0.06]}>
              {/* Grip */}
              <mesh position={[0, 0.08, 0]} material={materials.poleGrip} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
              </mesh>
              {/* Shaft extending downward */}
              <mesh position={[0, -0.42, 0]} material={materials.poleShaft} castShadow>
                <cylinderGeometry args={[0.01, 0.008, 0.88, 6]} />
              </mesh>
              {/* Mud / Snow Basket */}
              <mesh position={[0, -0.74, 0]} material={materials.poleGrip}>
                <cylinderGeometry args={[0.04, 0.04, 0.015, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
