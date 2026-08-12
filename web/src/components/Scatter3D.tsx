import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Opportunity } from "@/lib/sonar-types";
import { useContainerWidth } from "@/lib/useContainerWidth";
import { clamp } from "@/lib/analytics";
import {
  COLOR_SCHEMES,
  METRICS,
  colorSchemeById,
  metricById,
  type ColorScheme,
  type Metric,
} from "@/lib/scatterMetrics";
import { cn } from "@/lib/utils";

const HALF = 40; // scatter box half-extent, in three.js scene units
const HEIGHT = 520;

const AXIS_LABEL_KEYS = [
  "x-title",
  "x-min",
  "x-max",
  "y-title",
  "y-min",
  "y-max",
  "z-title",
  "z-min",
  "z-max",
] as const;

// Fixed to three edges of the bounding box (front-bottom, back-left,
// right-bottom) so the three axes never share a corner and their labels
// never collide with each other, regardless of what's plotted.
const AXIS_ANCHORS: Record<(typeof AXIS_LABEL_KEYS)[number], THREE.Vector3> = {
  "x-title": new THREE.Vector3(HALF + 16, -HALF, HALF),
  "x-min": new THREE.Vector3(-HALF, -HALF - 10, HALF),
  "x-max": new THREE.Vector3(HALF, -HALF - 10, HALF),
  "y-title": new THREE.Vector3(-HALF - 16, HALF, -HALF),
  "y-min": new THREE.Vector3(-HALF - 12, -HALF, -HALF),
  "y-max": new THREE.Vector3(-HALF - 12, HALF, -HALF),
  "z-title": new THREE.Vector3(HALF, -HALF, HALF + 16),
  "z-min": new THREE.Vector3(HALF + 10, -HALF, -HALF),
  "z-max": new THREE.Vector3(HALF + 10, -HALF, HALF),
};

type ScatterPoint = {
  o: Opportunity;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  xVal: number;
  yVal: number;
  zVal: number;
};

type Domain = { rawMin: number; rawMax: number; min: number; max: number };

type SceneObjects = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  group: THREE.Group;
  sphereGeo: THREE.SphereGeometry;
  meshes: THREE.Mesh[];
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function tooltipHtml(p: ScatterPoint, x: Metric, y: Metric, z: Metric) {
  return `
    <div class="font-mono text-[10px] uppercase tracking-widest" style="color:${p.color}">Tier ${p.o.tier ?? "?"} · ${escapeHtml(p.o.kind ?? "")}</div>
    <div class="mt-1 text-sm font-bold text-white">${escapeHtml(p.o.name)}</div>
    <div class="mt-0.5 text-[11px] text-white/60">${escapeHtml(p.o.organiser ?? "")}</div>
    <div class="mt-2 space-y-0.5 font-mono text-[11px] text-white/70">
      <div>${x.axisLabel} ${escapeHtml(x.format(p.xVal))}</div>
      <div>${y.axisLabel} ${escapeHtml(y.format(p.yVal))}</div>
      <div>${z.axisLabel} ${escapeHtml(z.format(p.zVal))}</div>
    </div>
  `;
}

function domainOf(metric: Metric, raws: number[]): Domain | null {
  if (raws.length === 0) return null;
  const rawMin = Math.min(...raws);
  const rawMax = Math.max(...raws);
  const t = (v: number) => (metric.log ? Math.log10(Math.max(v, 1)) : v);
  return { rawMin, rawMax, min: t(rawMin), max: t(rawMax) };
}

function fracOf(v: number, metric: Metric, domain: Domain | null) {
  if (!domain) return 0.5;
  const t = metric.log ? Math.log10(Math.max(v, 1)) : v;
  return domain.max === domain.min ? 0.5 : (t - domain.min) / (domain.max - domain.min);
}

export function Scatter3D({ opportunities }: { opportunities: Opportunity[] }) {
  const [containerRef, width] = useContainerWidth<HTMLDivElement>();
  const [xId, setXId] = useState("winnability");
  const [yId, setYId] = useState("prize_usd");
  const [zId, setZId] = useState("career_leverage");
  const [sizeId, setSizeId] = useState("expected_value");
  const [colorId, setColorId] = useState("tier");
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const xMetric = metricById(xId);
  const yMetric = metricById(yId);
  const zMetric = metricById(zId);
  const sizeMetric = metricById(sizeId);
  const colorScheme: ColorScheme = colorSchemeById(colorId);

  const { points, excluded, domains } = useMemo(() => {
    const rows = opportunities.map((o) => ({
      o,
      xRaw: xMetric.get(o),
      yRaw: yMetric.get(o),
      zRaw: zMetric.get(o),
      sizeRaw: sizeMetric.get(o),
    }));
    const included = rows.filter(
      (
        r,
      ): r is {
        o: Opportunity;
        xRaw: number;
        yRaw: number;
        zRaw: number;
        sizeRaw: number | null;
      } => r.xRaw != null && r.yRaw != null && r.zRaw != null,
    );

    const xDomain = domainOf(
      xMetric,
      included.map((r) => r.xRaw),
    );
    const yDomain = domainOf(
      yMetric,
      included.map((r) => r.yRaw),
    );
    const zDomain = domainOf(
      zMetric,
      included.map((r) => r.zRaw),
    );
    const sizeDomain = domainOf(
      sizeMetric,
      included.map((r) => r.sizeRaw).filter((v): v is number => v != null),
    );

    const toAxis = (v: number, metric: Metric, domain: Domain | null) =>
      (fracOf(v, metric, domain) - 0.5) * 2 * HALF;

    const points: ScatterPoint[] = included.map((r) => {
      const sizeFrac = r.sizeRaw != null ? fracOf(r.sizeRaw, sizeMetric, sizeDomain) : 0.5;
      return {
        o: r.o,
        x: toAxis(r.xRaw, xMetric, xDomain),
        y: toAxis(r.yRaw, yMetric, yDomain),
        z: toAxis(r.zRaw, zMetric, zDomain),
        radius: 2.6 + Math.sqrt(clamp(sizeFrac, 0, 1)) * 4.6,
        color: colorScheme.colorOf(r.o),
        xVal: r.xRaw,
        yVal: r.yRaw,
        zVal: r.zRaw,
      };
    });

    return {
      points,
      excluded: opportunities.length - included.length,
      domains: { x: xDomain, y: yDomain, z: zDomain },
    };
  }, [opportunities, xMetric, yMetric, zMetric, sizeMetric, colorScheme]);

  const selected = selectedId ? (points.find((p) => p.o.id === selectedId) ?? null) : null;

  // Event handlers set up once in the mount effect close over whatever the
  // axis/metric selects were at that instant — stale after any later
  // change. Reading through this ref instead of the closed-over variables
  // keeps hover/click always seeing the current selection.
  const liveRef = useRef({ points, xMetric, yMetric, zMetric });
  liveRef.current = { points, xMetric, yMetric, zMetric };

  const objsRef = useRef<SceneObjects | null>(null);
  const labelElsRef = useRef<
    Partial<Record<(typeof AXIS_LABEL_KEYS)[number], HTMLDivElement | null>>
  >({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef<number | null>(null);

  // Mount three.js once. Renderer/scene/camera/controls persist for the
  // component's lifetime; only the points inside them get rebuilt below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width0 = el.clientWidth || 600;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d1016, 140, 420);

    const camera = new THREE.PerspectiveCamera(42, width0 / HEIGHT, 0.1, 2000);
    camera.position.set(100, 78, 100);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width0, HEIGHT);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 70;
    controls.maxDistance = 320;
    controls.zoomSpeed = 1.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1d24, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(60, 90, 40);
    scene.add(dir);

    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)),
      new THREE.LineBasicMaterial({ color: 0x3a4150, transparent: true, opacity: 0.35 }),
    );
    scene.add(box);

    const grid = new THREE.GridHelper(HALF * 2, 8, 0x333a46, 0x262b34);
    grid.position.y = -HALF;
    scene.add(grid);

    const axisMat = new THREE.LineBasicMaterial({
      color: 0x7a8290,
      transparent: true,
      opacity: 0.85,
    });
    const axisLines: THREE.Line[] = [
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-HALF, -HALF, HALF),
          new THREE.Vector3(HALF, -HALF, HALF),
        ]),
        axisMat,
      ),
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-HALF, -HALF, -HALF),
          new THREE.Vector3(-HALF, HALF, -HALF),
        ]),
        axisMat,
      ),
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(HALF, -HALF, -HALF),
          new THREE.Vector3(HALF, -HALF, HALF),
        ]),
        axisMat,
      ),
    ];
    for (const line of axisLines) scene.add(line);

    const group = new THREE.Group();
    scene.add(group);

    const sphereGeo = new THREE.SphereGeometry(1, 22, 18);

    const objs: SceneObjects = { scene, camera, renderer, controls, group, sphereGeo, meshes: [] };
    objsRef.current = objs;

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const setHover = (index: number | null) => {
      if (hoveredRef.current === index) return;
      const prev = hoveredRef.current;
      if (prev != null && objs.meshes[prev]) {
        objs.meshes[prev].scale.setScalar(liveRef.current.points[prev]?.radius ?? 1);
      }
      hoveredRef.current = index;
      if (index != null && objs.meshes[index]) {
        objs.meshes[index].scale.setScalar((liveRef.current.points[index]?.radius ?? 1) * 1.25);
        const p = liveRef.current.points[index];
        if (p && tooltipRef.current) {
          tooltipRef.current.innerHTML = tooltipHtml(
            p,
            liveRef.current.xMetric,
            liveRef.current.yMetric,
            liveRef.current.zMetric,
          );
        }
      }
      renderer.domElement.style.cursor = index != null ? "pointer" : "grab";
    };

    const onMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(objs.meshes, false);
      const first = hits[0];
      setHover(first ? (first.object.userData["index"] as number) : null);
    };
    const onClick = () => {
      const hi = hoveredRef.current;
      if (hi != null && liveRef.current.points[hi]) {
        setSelectedId(liveRef.current.points[hi].o.id);
      }
    };
    const onDown = () => {
      controls.autoRotate = false;
      setAutoRotate(false);
    };
    const onWheel = (e: WheelEvent) => {
      // Container sits in a scrollable page; without this the page scrolls
      // instead of (or as well as) the camera zooming.
      e.preventDefault();
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("click", onClick);
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);

      const rect = el.getBoundingClientRect();
      for (const key of AXIS_LABEL_KEYS) {
        const node = labelElsRef.current[key];
        if (!node) continue;
        const p = AXIS_ANCHORS[key].clone().project(camera);
        node.style.display = p.z < 1 ? "block" : "none";
        node.style.transform = `translate(${((p.x * 0.5 + 0.5) * rect.width).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * rect.height).toFixed(1)}px)`;
      }

      const hi = hoveredRef.current;
      const tip = tooltipRef.current;
      if (tip) {
        if (hi != null && objs.meshes[hi]) {
          const p = objs.meshes[hi].position.clone().project(camera);
          if (p.z < 1) {
            tip.style.display = "block";
            tip.style.transform = `translate(${((p.x * 0.5 + 0.5) * rect.width + 14).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * rect.height - 10).toFixed(1)}px)`;
          } else {
            tip.style.display = "none";
          }
        } else {
          tip.style.display = "none";
        }
      }

      frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("click", onClick);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("wheel", onWheel);
      controls.dispose();
      for (const m of objs.meshes) (m.material as THREE.Material).dispose();
      sphereGeo.dispose();
      box.geometry.dispose();
      (box.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      for (const line of axisLines) line.geometry.dispose();
      axisMat.dispose();
      renderer.dispose();
      if (dom.parentNode === el) el.removeChild(dom);
      objsRef.current = null;
    };
    // Mount once: renderer/scene/controls are long-lived, rebuilt data
    // flows in through liveRef and the effect below instead of re-running this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the point meshes whenever the plotted data or axis/color/size
  // selection changes. Geometry is shared (sphereGeo); only per-point
  // materials get created and disposed here.
  useEffect(() => {
    const objs = objsRef.current;
    if (!objs) return;
    for (const m of objs.meshes) {
      objs.group.remove(m);
      (m.material as THREE.Material).dispose();
    }
    objs.meshes = points.map((p, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.42,
        metalness: 0.08,
        transparent: true,
        opacity: 0.94,
      });
      const mesh = new THREE.Mesh(objs.sphereGeo, mat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(p.radius);
      mesh.userData["index"] = i;
      objs.group.add(mesh);
      return mesh;
    });
    hoveredRef.current = null;
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
  }, [points]);

  // Axis tick text — cheap, so a plain effect (not the per-frame loop) is fine.
  useEffect(() => {
    const set = (key: (typeof AXIS_LABEL_KEYS)[number], text: string) => {
      const n = labelElsRef.current[key];
      if (n) n.textContent = text;
    };
    set("x-title", xMetric.axisLabel);
    set("x-min", domains.x ? xMetric.format(domains.x.rawMin) : "—");
    set("x-max", domains.x ? xMetric.format(domains.x.rawMax) : "—");
    set("y-title", yMetric.axisLabel);
    set("y-min", domains.y ? yMetric.format(domains.y.rawMin) : "—");
    set("y-max", domains.y ? yMetric.format(domains.y.rawMax) : "—");
    set("z-title", zMetric.axisLabel);
    set("z-min", domains.z ? zMetric.format(domains.z.rawMin) : "—");
    set("z-max", domains.z ? zMetric.format(domains.z.rawMax) : "—");
  }, [xMetric, yMetric, zMetric, domains]);

  // Keep controls.autoRotate in sync with the toggle button, including
  // when the mount effect's own pointerdown handler flips it off.
  useEffect(() => {
    if (objsRef.current) objsRef.current.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  // Resize: canvas is sized directly from clientWidth on mount; this
  // effect only handles later container width changes.
  useEffect(() => {
    const objs = objsRef.current;
    if (!objs || width <= 0) return;
    objs.camera.aspect = width / HEIGHT;
    objs.camera.updateProjectionMatrix();
    objs.renderer.setSize(width, HEIGHT);
  }, [width]);

  return (
    <div className="paper-panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold">
              Worth our weekend, or a lottery ticket.
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag to rotate, scroll to zoom, hover a point for detail. Bubble size:{" "}
              {sizeMetric.label.toLowerCase()}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={cn(
              "label-caps shrink-0 border px-3 py-1.5 transition-colors",
              autoRotate
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            {autoRotate ? "Auto-rotate: on" : "Auto-rotate: off"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <AxisSelect label="X" value={xId} onChange={setXId} />
          <AxisSelect label="Y" value={yId} onChange={setYId} />
          <AxisSelect label="Z" value={zId} onChange={setZId} />
          <AxisSelect label="Size" value={sizeId} onChange={setSizeId} />
          <ColorSelect value={colorId} onChange={setColorId} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {colorScheme.legend(opportunities).map((l) => (
            <span
              key={l.label}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: l.color }}
                aria-hidden
              />
              {l.label}
            </span>
          ))}
          {excluded > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {excluded} without data for the selected axes, not shown
            </span>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: HEIGHT, background: "#0d1016" }}
      >
        {AXIS_LABEL_KEYS.map((key) => (
          <div
            key={key}
            ref={(node) => {
              labelElsRef.current[key] = node;
            }}
            className={cn(
              "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-mono",
              key.endsWith("title")
                ? "text-[10px] uppercase tracking-widest text-white/85"
                : "text-[10px] text-white/55",
            )}
          />
        ))}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 hidden w-56 rounded-md border border-white/15 bg-black/85 p-3 backdrop-blur-sm"
          style={{ display: "none" }}
        />
      </div>

      {selected && (
        <div className="border-t border-border bg-paper p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps" style={{ color: selected.color }}>
                Tier {selected.o.tier} · {selected.o.kind}
              </p>
              <h4 className="mt-1 text-base font-bold">{selected.o.name}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">{selected.o.organiser}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-4 font-mono text-xs">
            <div>
              <dt className="label-caps">{xMetric.axisLabel}</dt>
              <dd className="mt-0.5">{xMetric.format(selected.xVal)}</dd>
            </div>
            <div>
              <dt className="label-caps">{yMetric.axisLabel}</dt>
              <dd className="mt-0.5">{yMetric.format(selected.yVal)}</dd>
            </div>
            <div>
              <dt className="label-caps">{zMetric.axisLabel}</dt>
              <dd className="mt-0.5">{zMetric.format(selected.zVal)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function AxisSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="label-caps">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer border border-border bg-transparent px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-foreground focus:outline-none"
      >
        {METRICS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="label-caps">Color</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer border border-border bg-transparent px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-foreground focus:outline-none"
      >
        {COLOR_SCHEMES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
