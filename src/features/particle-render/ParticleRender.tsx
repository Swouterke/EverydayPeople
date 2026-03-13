import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import type { ThreeElement } from "@react-three/fiber";
import { OrbitControls, Effects } from "@react-three/drei";
import { UnrealBloomPass } from "three-stdlib";
import * as THREE from "three";
import { particleDesigns } from "./designs";

declare module "@react-three/fiber" {
  interface ThreeElements {
    unrealBloomPass: ThreeElement<typeof UnrealBloomPass>;
  }
}

extend({ UnrealBloomPass });

const AUTO_ROTATE_SPEED = 2;
const ROTATION_CYCLE_SECONDS = 60 / AUTO_ROTATE_SPEED;
const PULSE_MIN = 0.33;
const PULSE_MAX = 0.88;
const VISUAL_PRESET = {
  tubeLayers: 9,
  tubeDepth: 4.2,
  tubeRadius: 0.46,
  dotDensity: 1,
  dotSizeMult: 0.55,
  baseGeometrySize: 0.14,
  brightnessBoost: 1.98,
  tintMix: 0.78,
  tintColor: "#d6f3ff",
  materialColor: 0xc7efff,
  emissiveColor: 0x4fa6cc,
  emissiveIntensity: 0.34,
  bloomStrength: 0.42,
  bloomRadius: 0.18,
  bloomThreshold: 0.56,
} as const;

const ParticleSwarm = () => {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const viewportWidth = useThree((state) => state.size.width);
  const count = 42000;
  const speedMult = 0.1;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const tintColor = useMemo(() => new THREE.Color(VISUAL_PRESET.tintColor), []);
  const color = pColor; // Alias for user code compatibility
  const designIds = useMemo(
    () => Object.keys(particleDesigns) as Array<keyof typeof particleDesigns>,
    [],
  );
  const activeDesignRef = useRef(particleDesigns[designIds[0]]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * designIds.length);
    activeDesignRef.current = particleDesigns[designIds[randomIndex]];
  }, [designIds]);

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const positions = useMemo(() => {
    const pos: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      pos.push(
        new THREE.Vector3(
          (seededRandom(i * 3 + 1) - 0.5) * 100,
          (seededRandom(i * 3 + 2) - 0.5) * 100,
          (seededRandom(i * 3 + 3) - 0.5) * 100,
        ),
      );
    }
    return pos;
  }, []);

  // Material & Geom
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: VISUAL_PRESET.materialColor,
        roughness: 0.4,
        metalness: 0.12,
        emissive: VISUAL_PRESET.emissiveColor,
        emissiveIntensity: VISUAL_PRESET.emissiveIntensity,
      }),
    [],
  );
  const geometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        VISUAL_PRESET.baseGeometrySize,
        VISUAL_PRESET.baseGeometrySize,
        VISUAL_PRESET.baseGeometrySize,
      ),
    [],
  );
  const cubeScale =
    viewportWidth < 480
      ? 0.5
      : viewportWidth < 768
        ? 0.62
        : viewportWidth < 1024
          ? 0.8
          : 1;

  useFrame((state) => {
    if (!meshRef.current) return;

    const pulsePhase =
      (state.clock.elapsedTime / ROTATION_CYCLE_SECONDS) * Math.PI * 2 -
      Math.PI / 2;
    const pulseNormalized = (Math.sin(pulsePhase) + 1) * 0.5;
    const pulseStrength = THREE.MathUtils.lerp(
      PULSE_MIN,
      PULSE_MAX,
      pulseNormalized,
    );

    for (let i = 0; i < count; i++) {
      // USER CODE START
      // STATIC FORMATION EXPORT
      const POS_DATA = activeDesignRef.current.positions;
      const COL_DATA = activeDesignRef.current.colors;
      const sourceCount = Math.min(
        Math.floor(POS_DATA.length / 3),
        Math.floor(COL_DATA.length / 3),
      );
      const activeCount = Math.min(
        count,
        sourceCount * VISUAL_PRESET.tubeLayers,
      );
      const shouldRenderDot =
        i < activeCount &&
        seededRandom((i % Math.max(1, sourceCount)) * 17.13 + 2.1) <
          VISUAL_PRESET.dotDensity;
      if (!shouldRenderDot) {
        // Keep unused instances effectively invisible while preserving stable indices.
        dummy.position.copy(positions[i]);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const baseIndex = i % sourceCount;
      const layerIndex = Math.floor(i / sourceCount);
      const idx = baseIndex * 3;
      const x = POS_DATA[idx];
      const y = POS_DATA[idx + 1];
      const z = POS_DATA[idx + 2];
      const angle =
        seededRandom(baseIndex * 23.17 + layerIndex * 7.31) * Math.PI * 2;
      const radialJitter =
        0.75 + 0.5 * seededRandom(baseIndex * 11.5 + layerIndex * 3.1);
      const layerOffset =
        VISUAL_PRESET.tubeLayers <= 1
          ? 0
          : layerIndex / (VISUAL_PRESET.tubeLayers - 1) - 0.5;
      const depth = z + layerOffset * VISUAL_PRESET.tubeDepth;
      target.set(
        x + Math.cos(angle) * VISUAL_PRESET.tubeRadius * radialJitter,
        y + Math.sin(angle) * VISUAL_PRESET.tubeRadius * radialJitter,
        depth,
      );
      color.setRGB(
        COL_DATA[idx] / 255,
        COL_DATA[idx + 1] / 255,
        COL_DATA[idx + 2] / 255,
      );
      color.lerp(tintColor, VISUAL_PRESET.tintMix);
      const depthLight = THREE.MathUtils.clamp(1 + depth * 0.006, 0.86, 1.14);
      color.multiplyScalar(
        pulseStrength * depthLight * VISUAL_PRESET.brightnessBoost,
      );
      // USER CODE END

      positions[i].lerp(target, speedMult);
      dummy.position.copy(positions[i]);
      const perspectiveScale = THREE.MathUtils.clamp(
        1 + positions[i].z * 0.012,
        0.72,
        1.25,
      );
      dummy.scale.setScalar(
        cubeScale * VISUAL_PRESET.dotSizeMult * perspectiveScale,
      );
      const tilt = THREE.MathUtils.clamp(positions[i].z * 0.015, -0.22, 0.22);
      dummy.rotation.set(tilt * 0.7, -tilt, tilt * 0.45);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />;
};

export default function ParticleRender() {
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;

  return (
    <div className="particle-layer">
      <Canvas
        style={{ width: "100%", height: "100%" }}
        dpr={[1.25, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{
          position: [0, 0, isMobileViewport ? 105 : 82],
          fov: isMobileViewport ? 68 : 60,
        }}
      >
        <fog attach="fog" args={["#dff4ff", 16, 155]} />
        <ambientLight intensity={0.95} color="#e8f8ff" />
        <directionalLight
          position={[35, 44, 38]}
          intensity={1.15}
          color="#e7f8ff"
        />
        <directionalLight
          position={[-28, -22, 25]}
          intensity={0.78}
          color="#bfe9ff"
        />
        <ParticleSwarm />
        <OrbitControls autoRotate={true} autoRotateSpeed={AUTO_ROTATE_SPEED} />
        <Effects disableGamma>
          <unrealBloomPass
            args={[
              new THREE.Vector2(1024, 1024),
              VISUAL_PRESET.bloomStrength,
              VISUAL_PRESET.bloomRadius,
              VISUAL_PRESET.bloomThreshold,
            ]}
          />
        </Effects>
      </Canvas>
    </div>
  );
}
