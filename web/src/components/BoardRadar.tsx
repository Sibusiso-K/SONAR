import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Opportunity } from "@/lib/sonar-types";
import { clamp, daysUntil, severityOf, severityToken } from "@/lib/analytics";

const SIZE = 380;
const MAX_DAYS = 120; // beyond this, plotted at the outer ring anyway
const DEFAULT_TILT = { x: 55, z: 0 };

type Blip = {
  o: Opportunity;
  days: number;
  angle: number;
  radiusFrac: number;
};

const SEVERITY_SPEED: Record<ReturnType<typeof severityOf>, string> = {
  critical: "0.85s",
  warning: "1.6s",
  stable: "2.8s",
  none: "4s",
};

function useRadarBlips(opportunities: Opportunity[]) {
  return useMemo(() => {
    const dated = opportunities
      .map((o) => ({ o, days: daysUntil(o.next_date) }))
      .filter((r): r is { o: Opportunity; days: number } => r.days !== null && r.days >= 0)
      .sort((a, b) => a.days - b.days);

    return dated.map((r, i): Blip => {
      // sqrt spacing: near-term entries stay spread out near the center
      // instead of all crushing into a single dot.
      const t = Math.sqrt(Math.min(r.days, MAX_DAYS) / MAX_DAYS);
      return {
        o: r.o,
        days: r.days,
        angle: (i / Math.max(dated.length, 1)) * Math.PI * 2,
        radiusFrac: Math.max(t, 0.08),
      };
    });
  }, [opportunities]);
}

export function BoardRadar({ opportunities }: { opportunities: Opportunity[] }) {
  const blips = useRadarBlips(opportunities);
  const [tilt, setTilt] = useState(DEFAULT_TILT);
  const [hovered, setHovered] = useState<Blip | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; from: typeof tilt } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, from: tilt };
    containerRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTilt({
      x: clamp(dragRef.current.from.x - dy * 0.2, 25, 78),
      z: clamp(dragRef.current.from.z + dx * 0.15, -35, 35),
    });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const jumpTo = (id: string) => {
    document.getElementById(`opp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        className="relative touch-none select-none"
        style={{ width: SIZE, height: SIZE, perspective: 1000 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setTilt(DEFAULT_TILT)}
      >
        <div
          className="absolute inset-0 cursor-grab overflow-hidden rounded-full active:cursor-grabbing"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateZ(${tilt.z}deg)`,
            background: "radial-gradient(circle at 50% 45%, #0f2019 0%, #05100c 68%, #020604 100%)",
            boxShadow: "0 0 0 1px rgba(63,191,164,0.28), 0 34px 60px -22px rgba(0,0,0,0.65)",
          }}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <div
              key={f}
              className="absolute rounded-full border"
              style={{
                left: `${50 - f * 50}%`,
                top: `${50 - f * 50}%`,
                width: `${f * 100}%`,
                height: `${f * 100}%`,
                borderColor: "rgba(63,191,164,0.28)",
              }}
            />
          ))}
          <div
            className="absolute left-0 right-0 top-1/2"
            style={{ height: 1, background: "rgba(63,191,164,0.22)" }}
          />
          <div
            className="absolute bottom-0 top-0 left-1/2"
            style={{ width: 1, background: "rgba(63,191,164,0.22)" }}
          />

          <div
            className="absolute inset-0 animate-[radar-sweep_4s_linear_infinite]"
            style={{
              background: "conic-gradient(from 0deg, rgba(63,191,164,0.55), transparent 55deg)",
            }}
            aria-hidden
          />

          <div
            className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{ boxShadow: "0 0 6px 2px rgba(255,255,255,0.7)" }}
            aria-hidden
          />

          {blips.map((b) => {
            const r = b.radiusFrac * 46;
            const x = 50 + r * Math.cos(b.angle);
            const y = 50 + r * Math.sin(b.angle);
            const color = severityToken[severityOf(b.o)];
            return (
              <button
                key={b.o.id}
                type="button"
                onClick={() => jumpTo(b.o.id)}
                onPointerEnter={() => setHovered(b)}
                onPointerLeave={() => setHovered((v) => (v?.o.id === b.o.id ? null : v))}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-1.5"
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-label={`${b.o.name}, ${b.days} days left`}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: color,
                    boxShadow: `0 0 8px 2px ${color}`,
                    animation: `radar-blip ${SEVERITY_SPEED[severityOf(b.o)]} ease-in-out infinite`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 h-10 text-center">
        {hovered ? (
          <p className="font-mono text-xs text-foreground">
            <span style={{ color: severityToken[severityOf(hovered.o)] }}>{hovered.days}d</span> ·{" "}
            {hovered.o.name}
          </p>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Distance = days to deadline. Drag to tilt, click a blip to jump to it.
          </p>
        )}
      </div>
    </div>
  );
}
