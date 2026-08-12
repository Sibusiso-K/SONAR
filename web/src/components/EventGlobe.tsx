import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import type { Opportunity } from "@/lib/sonar-types";
import { EVENT_LOCATIONS } from "@/lib/eventLocations";
import { clamp, daysUntil, toUsd } from "@/lib/analytics";
import { useContainerWidth } from "@/lib/useContainerWidth";

// three.js parses point colors at the WebGL level, not through the CSS
// cascade — it can't resolve `var(--accent)`, only concrete color values.
// Same three tiers as tierColor(), as plain hex instead.
const TIER_HEX: Record<number, string> = { 1: "#3fbfc4", 2: "#c98a2c", 3: "#8a8580" };
function tierHex(tier: number | null | undefined) {
  return TIER_HEX[tier ?? 3] ?? TIER_HEX[3];
}

// Home base for the "how far, how soon" arcs — the two of you are based in
// Johannesburg, so that's the fixed origin every arc reads from.
const JHB = { lat: -26.2041, lng: 28.0473 };

type GlobeArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  days: number | null;
};

type GlobePoint = {
  id: string;
  name: string;
  organiser: string;
  tier: number;
  city: string;
  country: string;
  kind: "venue" | "hq";
  lat: number;
  lng: number;
  color: string;
  pinHeight: number;
  days: number | null;
};

// react-globe.gl reaches into `window`/WebGL at import time, so it can only
// ever load in the browser — importing it during TanStack Start's SSR pass
// crashes the render. Load it lazily, client-side only, after mount.
type GlobeComponent = ComponentType<Record<string, unknown>>;

function useGlobeLib() {
  const [Globe, setGlobe] = useState<GlobeComponent | null>(null);
  useEffect(() => {
    let live = true;
    import("react-globe.gl").then((mod) => {
      if (live) setGlobe(() => mod.default as GlobeComponent);
    });
    return () => {
      live = false;
    };
  }, []);
  return Globe;
}

/** A tear-drop map pin (not a globe.gl built-in — built as a real DOM/SVG
 * node since htmlElementsData renders whatever element the accessor
 * returns). Height varies with prize pool so bigger opportunities still
 * read as "bigger," without the pole/spike look. */
function makePinElement(p: GlobePoint, onSelect: (p: GlobePoint) => void) {
  const el = document.createElement("div");
  const h = p.pinHeight;
  const w = h * 0.76;
  el.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 26 34" style="display:block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z"
            fill="${p.color}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" />
      <circle cx="13" cy="13" r="5" fill="rgba(255,255,255,0.95)" />
    </svg>
  `;
  el.style.cursor = "pointer";
  el.style.pointerEvents = "auto";
  el.style.transformOrigin = "bottom center";
  el.style.transform = "translate(-50%, -100%)";
  el.style.transition = "transform 0.15s ease";
  el.onclick = () => onSelect(p);
  el.onmouseenter = () => {
    el.style.transform = "translate(-50%, -100%) scale(1.18)";
  };
  el.onmouseleave = () => {
    el.style.transform = "translate(-50%, -100%) scale(1)";
  };
  return el;
}

/** Pure-CSS space dressing behind the globe: the canvas has a transparent
 * background, so this layer shows through everywhere the sphere isn't
 * drawn. Stars use a box-shadow trick (one element, many dots) so it's
 * cheap; the moon and comets are plain divs animated with CSS. */
function SpaceBackdrop() {
  // Math.random() must never run during SSR — the server and the client
  // would each roll different star positions and React would flag every
  // one as a hydration mismatch. Start empty (matches the server's render)
  // and only roll the field after mount, client-side only.
  const [stars, setStars] = useState<{ small: string; big: string } | null>(null);

  useEffect(() => {
    const layer = (n: number, size: number) =>
      Array.from({ length: n }, () => `${Math.round(Math.random() * 1000)}px ${Math.round(Math.random() * 480)}px 0 ${size === 1 ? "" : size + "px "}rgba(255,255,255,${(0.5 + Math.random() * 0.5).toFixed(2)})`).join(",\n");
    setStars({ small: layer(140, 1), big: layer(50, 0) });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {stars && (
        <>
          <div
            className="absolute inset-0 animate-[twinkle_4s_ease-in-out_infinite]"
            style={{ boxShadow: stars.small, width: 1, height: 1 }}
          />
          <div
            className="absolute inset-0 animate-[twinkle_6s_ease-in-out_infinite_1s]"
            style={{ boxShadow: stars.big, width: 1, height: 1 }}
          />
        </>
      )}

      <div
        className="absolute rounded-full"
        style={{
          top: 28,
          right: 48,
          width: 46,
          height: 46,
          background: "radial-gradient(circle at 35% 32%, #f6f4ee 0%, #e2ddd0 45%, #b9b2a4 75%, #8f8879 100%)",
          boxShadow: "0 0 24px 4px rgba(246,244,238,0.35)",
        }}
      >
        <div className="absolute rounded-full bg-black/10" style={{ top: 10, left: 14, width: 8, height: 8 }} />
        <div className="absolute rounded-full bg-black/10" style={{ top: 22, left: 26, width: 5, height: 5 }} />
        <div className="absolute rounded-full bg-black/10" style={{ top: 28, left: 12, width: 4, height: 4 }} />
      </div>

      {[0, 6, 12].map((delay, i) => (
        <div
          key={i}
          className="absolute h-px w-24 animate-[comet_9s_linear_infinite]"
          style={{
            top: `${10 + i * 25}%`,
            left: -100,
            animationDelay: `${delay}s`,
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 100%)",
            transform: "rotate(-20deg)",
          }}
        />
      ))}
    </div>
  );
}

export function EventGlobe({ opportunities }: { opportunities: Opportunity[] }) {
  const Globe = useGlobeLib();
  const [containerRef, width] = useContainerWidth<HTMLDivElement>();
  const globeRef = useRef<{ pointOfView: (v: object, ms?: number) => void; controls: () => { autoRotate: boolean; autoRotateSpeed: number } } | null>(null);
  const [selected, setSelected] = useState<GlobePoint | null>(null);

  const points = useMemo<GlobePoint[]>(() => {
    return opportunities
      .map((o) => {
        const loc = EVENT_LOCATIONS[o.id];
        if (!loc) return null;
        const prizeUsd = toUsd(o.prize?.pool, o.prize?.currency);
        // "Heat" reads as pin size: bigger prize pool, bigger pin.
        const heat = Math.max(0, Math.min(1, Math.log10(prizeUsd + 10) / 6));
        return {
          id: o.id,
          name: o.name,
          organiser: o.organiser,
          tier: o.tier ?? 3,
          city: loc.city,
          country: loc.country,
          kind: loc.kind,
          lat: loc.lat,
          lng: loc.lng,
          color: tierHex(o.tier),
          pinHeight: 22 + heat * 18,
          days: daysUntil(o.next_date),
        };
      })
      .filter((p): p is GlobePoint => p !== null);
  }, [opportunities]);

  const arcs = useMemo<GlobeArc[]>(() => {
    return points
      // Skip the two Johannesburg-hosted events — an arc from JHB to JHB
      // has no length and would just render as a stray dot.
      .filter((p) => Math.abs(p.lat - JHB.lat) > 0.01 || Math.abs(p.lng - JHB.lng) > 0.01)
      .map((p) => ({
        startLat: JHB.lat,
        startLng: JHB.lng,
        endLat: p.lat,
        endLng: p.lng,
        color: p.color,
        days: p.days,
      }));
  }, [points]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // globeRef.current.controls() is undefined until the WebGL scene has
    // actually initialized, which happens asynchronously after mount —
    // reading it once, synchronously, when this effect first runs (right
    // after Globe finishes loading) is too early and silently no-ops.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getControls = () => globeRef.current?.controls() as any;

    let cancelled = false;
    const initControls = () => {
      const controls = getControls();
      if (!controls) {
        if (!cancelled) requestAnimationFrame(initControls);
        return;
      }
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      // Globe.gl's globe radius is 100 units — minDistance just above
      // that lets you zoom in close to a single pin; the default range
      // was too narrow to feel like it was zooming at all.
      controls.minDistance = 110;
      controls.maxDistance = 1000;
      controls.zoomSpeed = 1.3;
      controls.enableZoom = true;
    };
    initControls();

    // Pins are DOM elements repositioned every animation frame while the
    // globe auto-rotates, so a pin can drift out from under the cursor
    // between mousedown and mouseup — the click lands on empty space, not
    // the pin. Stop auto-rotating the moment the user touches the globe.
    // Resolved fresh on every call (not the closed-over `controls` from
    // initControls) so this works even if it fires before init settles.
    const stopAutoRotate = () => {
      const controls = getControls();
      if (controls) controls.autoRotate = false;
    };
    // The container sits in a normal scrollable page. A wheel event over
    // the globe bubbles up and scrolls the *page* at the same time
    // OrbitControls tries to zoom, so most of the scroll "leaks" away and
    // zooming barely does anything. preventDefault stops the page scroll
    // so the whole gesture goes to the globe — must be a non-passive
    // listener, since preventDefault is a no-op on a passive one.
    const trapWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAutoRotate();
    };
    el.addEventListener("pointerdown", stopAutoRotate);
    el.addEventListener("wheel", trapWheel, { passive: false });
    return () => {
      cancelled = true;
      el.removeEventListener("pointerdown", stopAutoRotate);
      el.removeEventListener("wheel", trapWheel);
    };
  }, [Globe]);

  return (
    <div className="paper-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-display text-xl font-bold">Where it's happening</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drag to rotate, scroll to zoom, click a pin for details.
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground/70" aria-hidden />
            confirmed venue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-foreground/70" aria-hidden />
            online (organiser HQ shown)
          </span>
        </div>
      </div>

      <div ref={containerRef} className="relative" style={{ height: 480, background: "#0a1020" }}>
        <SpaceBackdrop />

        {Globe && width > 0 ? (
          <div className="relative" style={{ zIndex: 1 }}>
            <Globe
              ref={globeRef}
              width={width}
              height={480}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              atmosphereColor="#7fd8dc"
              atmosphereAltitude={0.22}
              arcsData={arcs}
              arcStartLat={(d: object) => (d as GlobeArc).startLat}
              arcStartLng={(d: object) => (d as GlobeArc).startLng}
              arcEndLat={(d: object) => (d as GlobeArc).endLat}
              arcEndLng={(d: object) => (d as GlobeArc).endLng}
              arcColor={(d: object) => (d as GlobeArc).color}
              arcStroke={0.4}
              arcAltitude={0.22}
              arcDashLength={0.4}
              arcDashGap={2}
              arcDashInitialGap={() => Math.random() * 3}
              // Closer deadlines pulse the arc faster — same "urgency reads
              // as motion" idea as the pin heights, just for distance.
              arcDashAnimateTime={(d: object) => {
                const days = (d as GlobeArc).days;
                return days === null ? 3000 : clamp(days * 25, 500, 3500);
              }}
              htmlElementsData={points}
              htmlLat={(d: object) => (d as GlobePoint).lat}
              htmlLng={(d: object) => (d as GlobePoint).lng}
              htmlAltitude={0.015}
              htmlElement={(d: object) => makePinElement(d as GlobePoint, setSelected)}
            />
          </div>
        ) : (
          <div className="relative flex h-full items-center justify-center font-mono text-xs text-white/50" style={{ zIndex: 1 }}>
            Loading globe…
          </div>
        )}

        {selected && (
          <div className="absolute bottom-4 left-4 right-4 z-10 max-w-sm rounded-md border border-white/15 bg-black/80 p-4 backdrop-blur-sm md:right-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: selected.color }}>
                  Tier {selected.tier} · {selected.kind === "venue" ? "confirmed venue" : "online — HQ shown"}
                </p>
                <h4 className="mt-1 text-base font-bold text-white">{selected.name}</h4>
                <p className="mt-0.5 text-xs text-white/60">
                  {selected.organiser} · {selected.city}, {selected.country}
                </p>
                {selected.days !== null && (
                  <p className="mt-1 font-mono text-xs text-white/60">
                    {selected.days >= 0 ? `${selected.days} days left` : "closed"}
                  </p>
                )}
                <Link
                  to="/"
                  hash={`opp-${selected.id}`}
                  className="mt-2 inline-block font-mono text-[11px] uppercase tracking-widest text-white underline underline-offset-2"
                >
                  View on board →
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="shrink-0 text-white/50 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
