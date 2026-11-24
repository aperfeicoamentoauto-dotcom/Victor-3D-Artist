import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw, Grid, Pause, Play, Eye, EyeOff } from 'lucide-react';
import type { ThreePreset } from '../types';

interface ThreeAssetViewerProps {
  preset: ThreePreset;
  title: string;
  fallbackImage: string;
}

function buildCompositeAsset(preset: ThreePreset): THREE.Group {
  const root = new THREE.Group();

  const stdMat = (color: number, roughness = 0.45, metalness = 0.1) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  if (preset === 'sports_car') {
    const bodyMat = stdMat(0xb9a0e8, 0.25, 0.4);
    const trimMat = stdMat(0x1f1b2e, 0.65, 0.2);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x26293b,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const rimMat = stdMat(0xe8e8f0, 0.2, 0.85);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffe49e,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });

    // Lower chassis
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.48, 4.3), bodyMat);
    lower.position.y = 0.52;
    lower.castShadow = true;
    root.add(lower);

    // Hood slope & Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.45, 2.0), glassMat);
    cabin.position.set(0, 0.96, -0.15);
    cabin.castShadow = true;
    root.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.12, 1.55), bodyMat);
    roof.position.set(0, 1.2, -0.2);
    roof.castShadow = true;
    root.add(roof);

    // Rear spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.34), trimMat);
    wing.position.set(0, 0.96, -1.92);
    root.add(wing);

    [-0.65, 0.65].forEach((x) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.14), trimMat);
      strut.position.set(x, 0.83, -1.9);
      root.add(strut);
    });

    // Front splitter & grille
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.1, 0.35), trimMat);
    splitter.position.set(0, 0.28, 2.05);
    root.add(splitter);

    // Headlights
    [-0.72, 0.72].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), lightMat);
      hl.position.set(x, 0.56, 2.13);
      root.add(hl);
    });

    // 4 wheels with alloy rims
    const wheelPositions: Array<[number, number, number]> = [
      [-1.05, 0.36, 1.32],
      [1.05, 0.36, 1.32],
      [-1.05, 0.36, -1.32],
      [1.05, 0.36, -1.32],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 24), trimMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      tire.castShadow = true;
      root.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.3, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      root.add(rim);
    }
  } else if (preset === 'lowpoly_house') {
    const wallMat = stdMat(0xf4efe8, 0.75, 0.05);
    const roofMat = stdMat(0xd96b43, 0.6, 0.05);
    const woodMat = stdMat(0x7c5132, 0.8, 0.05);
    const grassMat = stdMat(0x79b465, 0.85, 0.0);
    const winMat = stdMat(0x88c5e8, 0.15, 0.2);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.2, 28), grassMat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    root.add(base);

    const walls = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.45, 2.0), wallMat);
    walls.position.set(-0.2, 0.92, 0);
    walls.castShadow = true;
    root.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.15, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-0.2, 2.2, 0);
    roof.castShadow = true;
    root.add(roof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.85, 0.35), stdMat(0x8f8798, 0.8, 0.05));
    chimney.position.set(0.45, 2.35, -0.35);
    chimney.castShadow = true;
    root.add(chimney);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.1), woodMat);
    door.position.set(-0.2, 0.62, 1.01);
    root.add(door);

    [-0.85, 0.45].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.1), winMat);
      win.position.set(wx, 1.05, 1.01);
      root.add(win);
    });

    // Stylized pine tree next to cottage
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.65, 8), woodMat);
    trunk.position.set(1.55, 0.52, 0.45);
    root.add(trunk);

    const foliage1 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.95, 7), stdMat(0x4c914d, 0.75, 0.0));
    foliage1.position.set(1.55, 1.2, 0.45);
    foliage1.castShadow = true;
    root.add(foliage1);

    const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.75, 7), stdMat(0x5da85c, 0.75, 0.0));
    foliage2.position.set(1.55, 1.72, 0.45);
    foliage2.castShadow = true;
    root.add(foliage2);
  } else if (preset === 'city_block') {
    const roadMat = stdMat(0x373445, 0.85, 0.05);
    const bldgMat = stdMat(0xefe9f7, 0.65, 0.05);
    const accentMat = stdMat(0xb9a0e8, 0.4, 0.15);
    const metalMat = stdMat(0x282633, 0.3, 0.8);

    const road = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 4.4), roadMat);
    road.position.y = 0.07;
    road.receiveShadow = true;
    root.add(road);

    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 3.3), stdMat(0xdad5e4, 0.75, 0.0));
    sidewalk.position.set(-0.35, 0.18, -0.35);
    sidewalk.receiveShadow = true;
    root.add(sidewalk);

    const bldg1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.5, 1.75), bldgMat);
    bldg1.position.set(-0.85, 1.5, -0.85);
    bldg1.castShadow = true;
    root.add(bldg1);

    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.18, 1.88), accentMat);
    roofTrim.position.set(-0.85, 2.8, -0.85);
    root.add(roofTrim);

    const bldg2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.65, 1.45), stdMat(0xf5b076, 0.65, 0.05));
    bldg2.position.set(0.75, 1.08, -0.85);
    bldg2.castShadow = true;
    root.add(bldg2);

    // Streetlamp
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 10), metalMat);
    pole.position.set(1.05, 1.1, 0.95);
    pole.castShadow = true;
    root.add(pole);

    const lampHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xfff5cc, emissive: 0xffe484, emissiveIntensity: 0.8 })
    );
    lampHead.position.set(0.92, 1.95, 0.95);
    root.add(lampHead);

    // Fire hydrant
    const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 10), stdMat(0xe14b4b, 0.4, 0.2));
    hydrant.position.set(-1.35, 0.46, 0.95);
    root.add(hydrant);
  } else if (preset === 'ugc_headphones') {
    const orangeMat = stdMat(0xf5842e, 0.35, 0.15);
    const cushionMat = stdMat(0xf8f6fc, 0.78, 0.0);
    const metalMat = stdMat(0x282536, 0.25, 0.85);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xb9a0e8,
      emissive: 0x9976db,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });

    // Headband arch
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 16, 40, Math.PI), orangeMat);
    band.position.y = 1.15;
    band.castShadow = true;
    root.add(band);

    // Fox ears on headband
    [-0.68, 0.68].forEach((x, idx) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.68, 4), orangeMat);
      ear.position.set(x, 2.25, 0);
      ear.rotation.z = idx === 0 ? 0.24 : -0.24;
      ear.rotation.y = Math.PI / 4;
      ear.castShadow = true;
      root.add(ear);

      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.44, 4), metalMat);
      innerEar.position.set(x, 2.21, 0.07);
      innerEar.rotation.z = idx === 0 ? 0.24 : -0.24;
      innerEar.rotation.y = Math.PI / 4;
      root.add(innerEar);
    });

    // Earcups & cushions
    [-1.08, 1.08].forEach((x) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 24), orangeMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(x, 1.0, 0);
      cup.castShadow = true;
      root.add(cup);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 24), glowMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x > 0 ? x + 0.17 : x - 0.17, 1.0, 0);
      root.add(ring);

      const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.13, 14, 24), cushionMat);
      cushion.rotation.y = Math.PI / 2;
      cushion.position.set(x > 0 ? x - 0.17 : x + 0.17, 1.0, 0);
      root.add(cushion);
    });
  } else if (preset === 'glasses') {
    const frameMat = stdMat(0x1f1c2b, 0.22, 0.85);
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0xb9a0e8,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
    });

    [-0.58, 0.58].forEach((x) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 16, 36), frameMat);
      rim.position.set(x, 1.05, 0.5);
      rim.castShadow = true;
      root.add(rim);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.41, 32), lensMat);
      lens.position.set(x, 1.05, 0.5);
      root.add(lens);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.45), frameMat);
      temple.position.set(x > 0 ? x + 0.44 : x - 0.44, 1.08, -0.22);
      root.add(temple);
    });

    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 10, 20, Math.PI), frameMat);
    bridge.position.set(0, 1.07, 0.5);
    root.add(bridge);
  } else if (preset === 'furniture') {
    const woodMat = stdMat(0x8c6244, 0.72, 0.05);
    const metalMat = stdMat(0x23202e, 0.35, 0.75);
    const accentMat = stdMat(0xb9a0e8, 0.45, 0.1);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x201936,
      emissive: 0x5c4099,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });

    // Desk top & legs
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.2), woodMat);
    top.position.set(0, 1.05, -0.2);
    top.castShadow = true;
    root.add(top);

    [-1.15, 1.15].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.08), metalMat);
      leg.position.set(x, 0.5, -0.2);
      leg.castShadow = true;
      root.add(leg);
    });

    // Monitor
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.65, 0.06), screenMat);
    screen.position.set(0, 1.55, -0.48);
    screen.castShadow = true;
    root.add(screen);

    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.25, 0.12), metalMat);
    stand.position.set(0, 1.2, -0.5);
    root.add(stand);

    // Ergonomic chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.72), accentMat);
    seat.position.set(0, 0.62, 0.75);
    seat.castShadow = true;
    root.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.12), accentMat);
    backrest.position.set(0, 1.08, 1.08);
    backrest.castShadow = true;
    root.add(backrest);

    const basePost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 10), metalMat);
    basePost.position.set(0, 0.3, 0.75);
    root.add(basePost);
  } else {
    // crates preset
    const woodMat = stdMat(0xb67e49, 0.75, 0.05);
    const frameMat = stdMat(0x7c502b, 0.8, 0.05);
    const ironMat = stdMat(0x3a3748, 0.35, 0.8);

    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), woodMat);
    crate.position.set(-0.75, 0.58, 0.1);
    crate.castShadow = true;
    root.add(crate);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.14, 1.22), frameMat);
    trim.position.set(-0.75, 1.05, 0.1);
    root.add(trim);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.44, 1.25, 16), woodMat);
    barrel.position.set(0.75, 0.62, -0.15);
    barrel.castShadow = true;
    root.add(barrel);

    [0.25, 1.0].forEach((y) => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 8, 24), ironMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(0.75, y, -0.15);
      root.add(hoop);
    });
  }

  return root;
}

export function ThreeAssetViewer({ preset, title, fallbackImage }: ThreeAssetViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const autoRotateRef = useRef(autoRotate);
  const wireframeRef = useRef(wireframe);
  const resetCamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    wireframeRef.current = wireframe;
  }, [wireframe]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f2fa);
    scene.fog = new THREE.FogExp2(0xf5f2fa, 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 640) / (container.clientHeight || 420),
      0.1,
      100
    );
    camera.position.set(3.8, 2.5, 4.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.85, 0);
    controls.minDistance = 2.2;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;

    // 3-point lighting rig
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xd9d2f5, 0x8f889e, 0.85);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0xcab6f2, 0.7);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Ground turntable disc + subtle grid
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.1, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.05 })
    );
    disc.position.y = -0.04;
    disc.receiveShadow = true;
    scene.add(disc);

    const grid = new THREE.GridHelper(12, 24, 0xd8d0ea, 0xeae5f5);
    grid.position.y = -0.08;
    scene.add(grid);

    const modelGroup = buildCompositeAsset(preset);
    scene.add(modelGroup);

    resetCamRef.current = () => {
      camera.position.set(3.8, 2.5, 4.4);
      controls.target.set(0, 0.85, 0);
      controls.update();
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      if (autoRotateRef.current) {
        modelGroup.rotation.y += delta * 0.45;
      }
      modelGroup.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m: THREE.Material) => {
              if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframeRef.current;
            });
          } else if (mat && 'wireframe' in mat) {
            (mat as THREE.MeshStandardMaterial).wireframe = wireframeRef.current;
          }
        }
      });
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      modelGroup.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: THREE.Material) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [preset]);

  if (contextLost) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E6E2F0] bg-[#F5F2FA]">
        <img
          src={fallbackImage}
          alt={title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-[#161320] shadow-sm">
          3D Preview unavailable on this device — showing studio render
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E6E2F0] bg-[#F5F2FA]">
      <div
        ref={mountRef}
        aria-label={`Interactive 3D preview of ${title}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />
      <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-[#161320] border border-[#E6E2F0]">
        Interactive 3D Viewport · Drag to orbit, scroll to zoom
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-[#161320] border border-[#E6E2F0] hover:bg-[#EFEAF9] transition-colors whitespace-nowrap"
        >
          {controlsOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{controlsOpen ? 'Hide Controls' : 'Show Controls'}</span>
        </button>

        {controlsOpen && (
          <div className="flex items-center gap-1.5 rounded-lg bg-[#161320]/90 px-2.5 py-1.5 text-white border border-white/10">
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{autoRotate ? 'Pause Spin' : 'Auto Spin'}</span>
            </button>
            <button
              type="button"
              onClick={() => setWireframe((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                wireframe ? 'bg-[#B9A0E8] text-[#161320]' : 'hover:bg-white/15 text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Wireframe</span>
            </button>
            <button
              type="button"
              onClick={() => resetCamRef.current?.()}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset View</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
