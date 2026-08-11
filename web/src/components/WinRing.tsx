import { clamp } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
};

/** Radial win-probability ring. Reads as a gauge, not a percentage badge. */
export function WinRing({ value, size = 56, stroke = 5, label = "win", className }: Props) {
  const v = clamp(value, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={stroke}
          opacity={0.45}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeral text-foreground" style={{ fontSize: size * 0.34 }}>
          {v}
        </span>
        {size >= 56 && (
          <span
            className="font-mono uppercase tracking-widest text-muted-foreground"
            style={{ fontSize: size * 0.12 }}
          >
            {label}
          </span>
        )}
      </div>
      <span className="sr-only">{`Win probability ${v} out of 100`}</span>
    </div>
  );
}
