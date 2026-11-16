import { useEffect, useRef } from "react";
import { fieldStep, type Ripple } from "@/lib/sonar-field";

/**
 * The background: a field of dots behind every panel that behaves like the
 * surface of a sonar display. A ring spreads from wherever the pointer moves
 * or taps, the dots it passes over swell and brighten, and every few seconds
 * the field pings on its own from a corner.
 *
 * It is decoration, so it is built to cost nothing when it should not run:
 * one canvas, drawn only while the tab is visible, capped at 2x pixel density,
 * and completely still (a plain dot grid, drawn once) for anyone who asks
 * their system for reduced motion. It never takes pointer events.
 */
export function SonarField() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 28;
    let width = 0;
    let height = 0;
    let ripples: Ripple[] = [];
    let frame = 0;
    let lastMove = 0;
    let lastAuto = performance.now();
    let rgb = "46 74 158";

    const readTheme = () => {
      rgb =
        getComputedStyle(document.documentElement).getPropertyValue("--field-dot").trim() || rgb;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ripples = fieldStep(ripples, now);
      for (let y = GAP / 2; y < height; y += GAP) {
        for (let x = GAP / 2; x < width; x += GAP) {
          // How strongly the nearest ring edge is passing this dot, 0..1.
          let lift = 0;
          for (const r of ripples) {
            const radius = (now - r.born) * r.speed;
            const off = Math.abs(Math.hypot(x - r.x, y - r.y) - radius);
            if (off < 46)
              lift = Math.max(lift, (1 - off / 46) * r.strength * (1 - (now - r.born) / r.life));
          }
          ctx.fillStyle = `rgb(${rgb} / ${0.13 + lift * 0.6})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + lift * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readTheme();
      if (still) draw(performance.now());
    };

    const loop = (now: number) => {
      if (now - lastAuto > 5200) {
        lastAuto = now;
        ripples.push({
          x: width * 0.84,
          y: height * 0.08,
          born: now,
          speed: 0.34,
          life: 4200,
          strength: 0.8,
        });
      }
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMove < 140) return; // a trail of rings, not a smear
      lastMove = now;
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        born: now,
        speed: 0.22,
        life: 1500,
        strength: 0.55,
      });
    };
    const onDown = (e: PointerEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        born: performance.now(),
        speed: 0.4,
        life: 2400,
        strength: 1,
      });
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!still && !document.hidden) frame = requestAnimationFrame(loop);
    };
    // The theme toggle flips a class on <html>; pick the new dot colour up.
    const themeWatch = new MutationObserver(() => {
      readTheme();
      if (still) draw(performance.now());
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    resize();
    window.addEventListener("resize", resize);
    if (!still) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      themeWatch.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="sonar-field"
      className="pointer-events-none fixed inset-0 -z-10 size-full"
    />
  );
}
