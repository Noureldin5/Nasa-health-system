import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { RegionKey, Status } from "../api/types";
import { REGION_ORDER, REGIONS } from "../content/regions";
import { StatusIcon, STATUS_WORD } from "./status";

/*
 * 3D body map on NASA's own astronaut model: the EMU spacesuit from NASA 3D
 * Resources (web/public/models/README.md). Physically based lighting with an
 * environment map, a reflective gold visor, a cool rim light, and a slow scan
 * band injected into NASA's materials. The selected region gets a scanner ring.
 * Region hotspots are HTML buttons that follow anchors snapped to the suit, so
 * they stay keyboard and screen-reader accessible. The 2D map is the fallback.
 */

const MODEL_URL = `${import.meta.env.BASE_URL}models/nasa-astronaut-emu.glb`;
/** NASA's model names the helmet visor material "astnt1_2". */
const VISOR_MATERIAL = "astnt1_2";

const SHORT: Record<RegionKey, string> = {
  brain: "Brain and eyes",
  heart: "Heart and vessels",
  blood: "Blood and immune",
  metabolism: "Metabolism",
  bones: "Bones",
  muscles: "Muscles",
};

/** Anchor targets in normalized body space: height 2, feet at y = -1, facing +z, the astronaut's left at +x. */
const TARGETS: Record<RegionKey, { p: [number, number, number]; r: number }> = {
  brain: { p: [0, 0.74, 0.4], r: 0.15 },
  heart: { p: [0.11, 0.36, 0.4], r: 0.12 },
  blood: { p: [-0.52, 0.42, 0.1], r: 0.11 },
  metabolism: { p: [0, 0.05, 0.4], r: 0.15 },
  bones: { p: [-0.13, -0.42, 0.3], r: 0.17 },
  muscles: { p: [0.14, -0.72, 0.3], r: 0.15 },
};

const STATUS_HEX: Record<Status, string> = {
  ok: "#47da84",
  watch: "#fdc707",
  act: "#ff5c52",
  learning: "#b9b9bb",
  nodata: "#959599",
};

export default function BodyMap3D({ statuses, selected, onSelect, onFail }: {
  statuses: Record<RegionKey, { status: Status; reason: string }>;
  selected: RegionKey | null;
  onSelect: (r: RegionKey) => void;
  onFail: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hotRefs = useRef<Partial<Record<RegionKey, HTMLButtonElement | null>>>({});
  const anchorsRef = useRef<Partial<Record<RegionKey, { pos: THREE.Vector3; normal: THREE.Vector3 }>>>({});
  const markerRef = useRef<{ group: THREE.Group; base: number } | null>(null);
  const [ready, setReady] = useState(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (err) {
      console.warn("3D body map: WebGL is not available, showing the 2D map", err);
      failRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "body3d__canvas";
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    // Studio light: warm-neutral key from the front left, cool rim from behind, soft sky fill.
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-2, 3, 4);
    const rim = new THREE.DirectionalLight(0x9fbbe0, 2.4);
    rim.position.set(2.5, 1.5, -3.5);
    const fill = new THREE.HemisphereLight(0xdfe6f0, 0x18181c, 0.4);
    scene.add(key, rim, fill);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0.5, 0.15, 5.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 7;
    controls.minPolarAngle = Math.PI / 2 - 0.45;
    controls.maxPolarAngle = Math.PI / 2 + 0.3;
    controls.target.set(0, 0, 0);
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.55;
    let idleTimer: number | undefined;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      window.clearTimeout(idleTimer);
    });
    controls.addEventListener("end", () => {
      window.clearTimeout(idleTimer);
      if (!reduced) idleTimer = window.setTimeout(() => (controls.autoRotate = true), 8000);
    });

    // Scanner platform under the boots: two thin rings and tick marks.
    const platform = new THREE.Group();
    const ringMat = new THREE.LineBasicMaterial({ color: 0x444447, transparent: true, opacity: 0.9 });
    for (const r of [0.6, 0.8]) {
      const pts = Array.from({ length: 97 }, (_, i) => {
        const a = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * r, -1.0, Math.sin(a) * r);
      });
      platform.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }
    const ticks: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const o = i % 4 ? 0.84 : 0.88;
      ticks.push(new THREE.Vector3(Math.cos(a) * 0.8, -1, Math.sin(a) * 0.8), new THREE.Vector3(Math.cos(a) * o, -1, Math.sin(a) * o));
    }
    platform.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), ringMat));
    scene.add(platform);

    // Scanner ring for the selected region, drawn on top and turned to the camera.
    const marker = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.88, 1, 64);
    const ringMatSel = new THREE.MeshBasicMaterial({ color: 0x5aa2ff, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide });
    const discGeo = new THREE.CircleGeometry(0.88, 48);
    const discMat = new THREE.MeshBasicMaterial({ color: 0x5aa2ff, transparent: true, opacity: 0.12, depthTest: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMatSel);
    const disc = new THREE.Mesh(discGeo, discMat);
    ring.renderOrder = 11;
    disc.renderOrder = 10;
    marker.add(disc, ring);
    marker.visible = false;
    scene.add(marker);
    markerRef.current = { group: marker, base: 0.12 };

    const scanUniforms = { uTime: { value: 0 }, uScan: { value: reduced ? 0 : 1 } };
    const holder = new THREE.Group();
    scene.add(holder);
    let disposed = false;

    // NASA's file is Draco-compressed. The decoder is bundled in public/draco (no CDN, works offline).
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`).setDecoderConfig({ type: "wasm" });
    new GLTFLoader().setDRACOLoader(draco).load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        holder.add(root);
        const meshes: THREE.Mesh[] = [];
        let visor: THREE.Mesh | null = null;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          meshes.push(m);
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.name === VISOR_MATERIAL) {
            // Gold EVA visor: mirror-like, catches the environment.
            visor = m;
            mat.metalness = 0.9;
            mat.roughness = 0.16;
            mat.envMapIntensity = 1.6;
          } else {
            mat.roughness = 0.72;
            mat.envMapIntensity = 0.9;
            // Slow scan band in world height, added to NASA's own material.
            mat.onBeforeCompile = (shader) => {
              shader.uniforms.uTime = scanUniforms.uTime;
              shader.uniforms.uScan = scanUniforms.uScan;
              shader.vertexShader = `varying float vScanY;\n${shader.vertexShader.replace(
                "#include <project_vertex>",
                "#include <project_vertex>\n  vScanY = (modelMatrix * vec4(transformed, 1.0)).y;",
              )}`;
              shader.fragmentShader = `uniform float uTime;\nuniform float uScan;\nvarying float vScanY;\n${shader.fragmentShader.replace(
                "#include <emissivemap_fragment>",
                "#include <emissivemap_fragment>\n  float scanY = sin(uTime * 0.45) * 1.05;\n  float band = exp(-pow((vScanY - scanY) * 10.0, 2.0));\n  totalEmissiveRadiance += vec3(0.35, 0.5, 0.75) * band * 0.3 * uScan;",
              )}`;
            };
          }
        });
        if (!meshes.length) return failRef.current();

        // Normalize: height 2, boots at y = -1, centered, visor toward +z.
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const c = box.getCenter(new THREE.Vector3());
        root.position.set(-c.x, -box.min.y, -c.z);
        holder.scale.setScalar(2 / size.y);
        holder.position.y = -1;
        holder.updateMatrixWorld(true);
        if (visor) {
          const vc = new THREE.Box3().setFromObject(visor).getCenter(new THREE.Vector3());
          holder.rotation.y = -Math.atan2(vc.x, vc.z);
          holder.updateMatrixWorld(true);
        }

        // Snap each region anchor to the nearest point on the suit.
        const tmp = new THREE.Vector3();
        const nMat = new THREE.Matrix3();
        for (const r of REGION_ORDER) {
          const t = new THREE.Vector3(...TARGETS[r].p);
          let bestD = Infinity;
          let bestPos = new THREE.Vector3();
          let bestNormal = new THREE.Vector3(0, 0, 1);
          for (const m of meshes) {
            const pos = m.geometry.getAttribute("position");
            const nrm = m.geometry.getAttribute("normal");
            nMat.getNormalMatrix(m.matrixWorld);
            for (let i = 0; i < pos.count; i++) {
              tmp.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
              const d = tmp.distanceToSquared(t);
              if (d < bestD) {
                bestD = d;
                bestPos = tmp.clone();
                bestNormal = nrm ? new THREE.Vector3().fromBufferAttribute(nrm, i).applyMatrix3(nMat).normalize() : new THREE.Vector3(0, 0, 1);
              }
            }
          }
          anchorsRef.current[r] = { pos: bestPos.addScaledVector(bestNormal, 0.012), normal: bestNormal };
        }
        setReady(true);
      },
      undefined,
      (err) => {
        console.warn("3D body map: model failed to load, showing the 2D map", err);
        failRef.current();
      },
    );

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const clock = new THREE.Clock();
    const proj = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = clock.getElapsedTime();
      scanUniforms.uTime.value = t;
      controls.update();
      const mk = markerRef.current;
      if (mk?.group.visible) {
        mk.group.quaternion.copy(camera.quaternion);
        mk.group.scale.setScalar(mk.base * (1 + (reduced ? 0 : 0.07 * Math.sin(t * 2.4))));
      }
      renderer.render(scene, camera);
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      for (const r of REGION_ORDER) {
        const a = anchorsRef.current[r];
        const el = hotRefs.current[r];
        if (!a || !el) continue;
        proj.copy(a.pos).project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        toCam.copy(camera.position).sub(a.pos).normalize();
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.dataset.behind = a.normal.dot(toCam) > -0.05 ? "false" : "true";
      }
    }
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      ro.disconnect();
      controls.dispose();
      holder.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
      platform.traverse((o) => (o as THREE.Line).geometry?.dispose());
      ringMat.dispose();
      ringGeo.dispose();
      ringMatSel.dispose();
      discGeo.dispose();
      discMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      markerRef.current = null;
    };
  }, []);

  // The scanner ring follows the selected region.
  useEffect(() => {
    const mk = markerRef.current;
    if (!mk) return;
    const a = selected ? anchorsRef.current[selected] : undefined;
    if (a && selected) {
      mk.group.position.copy(a.pos);
      mk.base = TARGETS[selected].r;
      mk.group.visible = true;
    } else {
      mk.group.visible = false;
    }
  }, [selected, ready]);

  return (
    <div className="body3d">
      <div ref={hostRef} className="body3d__stage" role="group" aria-label="3D body map on a NASA astronaut in the EMU spacesuit. Drag to rotate. Select a region to see its status and explainer.">
        {!ready && <div className="body3d__loading micro">Loading NASA astronaut model…</div>}
        {REGION_ORDER.map((r) => {
          const st = statuses[r];
          return (
            <button
              key={r}
              ref={(el) => (hotRefs.current[r] = el)}
              type="button"
              className="hotspot"
              data-behind="false"
              aria-pressed={selected === r}
              aria-label={`${REGIONS[r].label}: ${STATUS_WORD[st.status]}. ${st.reason}.`}
              onClick={() => onSelect(r)}
              style={{ opacity: ready ? undefined : 0, ["--hs-color" as string]: STATUS_HEX[st.status] }}
            >
              <span className="hotspot__dot" aria-hidden="true">
                <StatusIcon status={st.status} size={12} />
              </span>
              <span className="hotspot__label">{SHORT[r]}</span>
            </button>
          );
        })}
        <span className="body3d__hint micro" aria-hidden="true">
          Drag to rotate · scroll to zoom
        </span>
        <span className="body3d__credit micro" aria-hidden="true">
          Model: NASA 3D Resources · EMU spacesuit
        </span>
      </div>
    </div>
  );
}
