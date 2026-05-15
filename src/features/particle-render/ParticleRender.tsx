import {
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import type { ThreeElement } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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
const CLICK_HIT_RADIUS_XY = 3.2;
const DROP_ACCELERATION = 0.09;
const DROP_DAMPING = 0.985;
const VISUAL_PRESET = {
  tubeLayers: 9,
  tubeDepth: 4.2,
  tubeRadius: 0.46,
  dotDensity: 1,
  dotSizeMult: 0.55,
  baseGeometrySize: 0.14,
  brightnessBoost: 2.25,
  tintMix: 0.56,
  tintColor: "#ff9f4a",
  materialColor: 0xff8a2d,
  emissiveColor: 0xff4f00,
  emissiveIntensity: 0.7,
  bloomStrength: 0.42,
  bloomRadius: 0.18,
  bloomThreshold: 0.56,
} as const;

const ParticleSwarm = forwardRef<{ reset: () => void }, object>((_, ref) => {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const viewportWidth = useThree((state) => state.size.width);
  const { camera } = useThree();
  const count = 42000;
  const speedMult = 0.1;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const tintColor = useMemo(() => new THREE.Color(VISUAL_PRESET.tintColor), []);
  const color = pColor; // Alias for user code compatibility
  const clickPos = useRef(new THREE.Vector3(0, 0, 0));
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const velocities = useRef(
    Array.from({ length: count }, () => new THREE.Vector3(0, 0, 0)),
  );
  const droppingParticles = useRef<Set<number>>(new Set());
  const removedParticles = useRef<Set<number>>(new Set());
  const designIds = useMemo(
    () => Object.keys(particleDesigns) as Array<keyof typeof particleDesigns>,
    [],
  );
  const activeDesignRef = useRef(particleDesigns[designIds[0]]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      removedParticles.current.clear();
      droppingParticles.current.clear();
      for (let i = 0; i < count; i++) {
        velocities.current[i].set(0, 0, 0);
      }
    },
  }));

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

  useEffect(() => {
    const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const handleClick = (event: MouseEvent) => {
      const canvasElement = event.currentTarget as HTMLCanvasElement | null;
      if (!canvasElement) return;

      const rect = canvasElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hasIntersection = raycaster.ray.intersectPlane(
        clickPlane,
        clickPos.current,
      );
      if (!hasIntersection) return;

      const hitRadiusSq = CLICK_HIT_RADIUS_XY * CLICK_HIT_RADIUS_XY;
      for (let i = 0; i < count; i++) {
        if (
          removedParticles.current.has(i) ||
          droppingParticles.current.has(i)
        ) {
          continue;
        }

        const dx = positions[i].x - clickPos.current.x;
        const dy = positions[i].y - clickPos.current.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= hitRadiusSq) {
          droppingParticles.current.add(i);
          velocities.current[i].set(0, -0.35, 0);
        }
      }
    };

    const canvasElement = document.querySelector("canvas");
    if (!canvasElement) return;

    canvasElement.addEventListener("click", handleClick);
    return () => canvasElement.removeEventListener("click", handleClick);
  }, [camera, count, positions, raycaster]);

  // Material & Geom
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: VISUAL_PRESET.materialColor,
        roughness: 0.4,
        metalness: 0.12,
        transparent: true,
        opacity: 0.82,
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
      // Check if particle is removed - if so, hide it
      if (removedParticles.current.has(i)) {
        dummy.position.copy(positions[i]);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      if (droppingParticles.current.has(i)) {
        const bottomLimit = -(state.viewport.height * 0.75);
        velocities.current[i].y -= DROP_ACCELERATION;
        velocities.current[i].multiplyScalar(DROP_DAMPING);
        positions[i].add(velocities.current[i]);

        if (positions[i].y <= bottomLimit) {
          droppingParticles.current.delete(i);
          removedParticles.current.add(i);
          dummy.position.copy(positions[i]);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
          continue;
        }

        pColor.setRGB(1, 0.68, 0.32);
        dummy.position.copy(positions[i]);
        const perspectiveScale = THREE.MathUtils.clamp(
          1 + positions[i].z * 0.012,
          0.72,
          1.25,
        );
        dummy.scale.setScalar(
          cubeScale * VISUAL_PRESET.dotSizeMult * perspectiveScale,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, pColor);
        continue;
      }

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

      // Apply velocity
      positions[i].add(velocities.current[i]);

      // Damping - gradually return to zero velocity
      velocities.current[i].multiplyScalar(0.92);

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
});

ParticleSwarm.displayName = "ParticleSwarm";

export default forwardRef<{ reset: () => void }, object>(
  function ParticleRenderComponent(_, ref) {
    const particleSwarmRef = useRef<{ reset: () => void }>(null);
    const isMobileViewport =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;

    useImperativeHandle(ref, () => ({
      reset: () => {
        particleSwarmRef.current?.reset();
      },
    }));

    return (
      <div className="particle-layer">
        <Canvas
          style={{ width: "100%", height: "100%" }}
          dpr={[1.25, 2]}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
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
          <ParticleSwarm ref={particleSwarmRef} />
          <OrbitControls
            autoRotate={true}
            autoRotateSpeed={AUTO_ROTATE_SPEED}
          />
        </Canvas>
      </div>
    );
  },
);
