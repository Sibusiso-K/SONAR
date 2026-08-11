import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { Opportunity } from "@/lib/sonar-types";
import { EVENT_LOCATIONS } from "@/lib/eventLocations";
import { daysUntil, toUsd } from "@/lib/analytics";

// three.js parses point colors at the WebGL level, not through the CSS
// cascade — it can't resolve `var(--accent)`, only concrete color values.
// Same three tiers as tierColor(), as plain hex instead.
const TIER_HEX: Record<number, string> = { 1: "#3fbfc4", 2: "#c98a2c", 3: "#8a8580" };
function tierHex(tier: number | null | undefined) {
  return TIER_HEX[tier ?? 3] ?? TIER_HEX[3];
}

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
  altitude: number;
  radius: number;
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

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
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
          // "Heat" reads as height: bigger prize pool, taller spike.
          altitude: Math.max(0.02, Math.min(0.35, Math.log10(prizeUsd + 10) / 22)),
          radius: loc.kind === "venue" ? 0.55 : 0.4,
          days: daysUntil(o.next_date),
        };
      })
      .filter((p): p is GlobePoint => p !== null);
  }, [opportunities]);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
    }
  }, [Globe]);

  return (
    <div className="paper-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-display text-xl font-bold">Where it's happening</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drag to rotate, scroll to zoom, click a marker for details.
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

      <div ref={containerRef} className="relative" style={{ height: 480, background: "#05080d" }}>
        {Globe && width > 0 ? (
          <Globe
            ref={globeRef}
            width={width}
            height={480}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            atmosphereColor="#3fbfc4"
            atmosphereAltitude={0.18}
            pointsData={points}
            pointLat={(d: object) => (d as GlobePoint).lat}
            pointLng={(d: object) => (d as GlobePoint).lng}
            pointColor={(d: object) => (d as GlobePoint).color}
            pointAltitude={(d: object) => (d as GlobePoint).altitude}
            pointRadius={(d: object) => (d as GlobePoint).radius}
            pointResolution={12}
            pointLabel={() => ""}
            onPointClick={(p: object) => setSelected(p as GlobePoint)}
            onPointHover={(p: object | null) => {
              if (containerRef.current) {
                containerRef.current.style.cursor = p ? "pointer" : "grab";
              }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs text-white/50">
            Loading globe…
          </div>
        )}

        {selected && (
          <div className="absolute bottom-4 left-4 right-4 max-w-sm rounded-md border border-white/15 bg-black/80 p-4 backdrop-blur-sm md:right-auto">
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
