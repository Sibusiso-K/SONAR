import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "tr";
};

/** Scroll-triggered reveal. Restrained: fade + short rise, once, then done. */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(shown ? "reveal-in" : "reveal-init", className)}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
    >
      {children}
    </Tag>
  );
}

/** Word-by-word reveal for editorial headlines. */
export function RevealWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref} className={cn("inline", className)}>
      {text.split(" ").map((word, i) => (
        // The line-height of display type is below 1, so a bare overflow-hidden
        // box crops descenders (the y and g in "Everything ... getting"). Pad
        // the mask vertically and cancel it with an equal negative margin so
        // nothing is clipped and the layout does not move.
        <span
          key={`${word}-${i}`}
          className="-mb-[0.16em] -mt-[0.08em] inline-block overflow-hidden pb-[0.16em] pt-[0.08em] align-bottom"
        >
          <span
            className="inline-block will-change-transform"
            style={{
              transform: shown ? "none" : "translateY(1.2em)",
              opacity: shown ? 1 : 0,
              transition: `transform 0.75s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms, opacity 0.5s ease ${i * 45}ms`,
            }}
          >
            {word}
          </span>
          {"\u00A0"}
        </span>
      ))}
    </span>
  );
}
