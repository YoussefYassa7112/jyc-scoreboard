"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";

type Star = {
  nx: number;
  ny: number;
  r: number;
  twinkle: number;
  phase: number;
};

type Laser = {
  ny: number;
  speed: number;
  width: number;
  delay: number;
  t: number;
};

type Shooter = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Fraction of life spent brightening — timed to when it reaches the sky. */
  riseAt: number;
  /** Seconds of travel the trail covers, so tails vary in length. */
  tail: number;
  /** Peak brightness — most meteors are faint, a few are bright. */
  bright: number;
  /** Head radius in px. */
  size: number;
};

function seedStars(count: number): Star[] {
  return d3.range(count).map(() => ({
    nx: Math.random(),
    ny: Math.random() * 0.78,
    r: Math.random() * 1.6 + 0.4,
    twinkle: 0.6 + Math.random() * 2.2,
    phase: Math.random() * Math.PI * 2,
  }));
}

function seedLasers(): Laser[] {
  return d3.range(4).map((_, i) => ({
    ny: 0.12 + i * 0.12,
    speed: 280 + Math.random() * 180,
    width: 90 + Math.random() * 70,
    delay: i * 2.2,
    t: -i * 2.2,
  }));
}

export function NightSky() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "dark") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const stars = seedStars(mobile ? 70 : 120);
    const lasers = seedLasers();
    let shooters: Shooter[] = [];
    let raf = 0;
    let nextSpawnAt = 0;
    let running = true;
    let lastDraw = 0;

    const measure = () => {
      const nextW = window.innerWidth;
      const lvh = window.visualViewport
        ? Math.max(window.innerHeight, window.visualViewport.height)
        : window.innerHeight;
      const nextH = Math.max(lvh, document.documentElement.clientHeight || 0);
      return { nextW, nextH };
    };

    const applySize = (nextW: number, nextH: number) => {
      width = nextW;
      height = nextH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const { nextW, nextH } = measure();
      const widthChanged = Math.abs(nextW - width) > 8;
      const heightGrew = nextH > height + 80;
      if (width === 0 || height === 0) {
        applySize(nextW, nextH);
        return;
      }
      if (widthChanged || heightGrew) {
        applySize(widthChanged ? nextW : width, heightGrew ? nextH : height);
      }
    };

    // No two meteors share a slope, speed, length or brightness, and each one is
    // aimed through a point in the visible upper sky so none are wasted just
    // outside the frame.
    const spawnShooter = () => {
      if (shooters.length >= 3) return;
      const rightward = Math.random() > 0.3;
      const speed = 150 + Math.random() * 230;
      const angle = (14 + Math.random() * 34) * (Math.PI / 180);
      const dx = Math.cos(angle) * (rightward ? 1 : -1);
      const dy = Math.sin(angle);
      // Aimed at this point, then walked backwards along its own path, so it
      // either flies in from off-frame or swells up out of the dark — never
      // blinks into existence at full brightness where you're looking.
      const entryX =
        width * (rightward ? 0.06 + Math.random() * 0.4 : 0.54 + Math.random() * 0.4);
      const entryY = height * (0.04 + Math.random() * 0.26);
      const lead = 0.2 + Math.random() * 0.35;
      const maxLife = lead + (width * (0.5 + Math.random() * 0.65)) / speed;
      shooters.push({
        x: entryX - dx * speed * lead,
        y: entryY - dy * speed * lead,
        vx: dx * speed,
        vy: dy * speed,
        life: 0,
        maxLife,
        riseAt: lead / maxLife,
        tail: 0.1 + Math.random() * 0.12,
        bright: 0.5 + Math.random() * 0.5,
        size: 4.5 + Math.random() * 4.5,
      });
    };

    const scheduleShooter = (now: number) => {
      // Real meteors arrive in uneven clusters, so a streak occasionally brings
      // a companion; otherwise the sky goes quiet for several seconds.
      const cluster = Math.random() < 0.18;
      nextSpawnAt =
        now +
        (cluster ? 350 + Math.random() * 900 : 4500 + Math.random() * 8500);
    };

    // Every frame, at the display's rate — the shooting stars are the point, and
    // anything less reads as stepping. The sky gradient is a CSS background on
    // the canvas instead of a per-frame full-viewport fill, so a frame is now
    // just the stars, four beams and the odd shooter.
    const draw = (now: number) => {
      if (!running) return;
      const step = lastDraw === 0 ? 1 / 60 : Math.min(0.05, (now - lastDraw) / 1000);
      lastDraw = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        const alpha =
          0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * star.twinkle + star.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.arc(star.nx * width, star.ny * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // The glow is a second wide translucent pass rather than ctx.shadowBlur,
      // which would blur-rasterise four strokes on every single frame.
      for (const laser of lasers) {
        laser.t += step;
        const y = laser.ny * height;
        const cycle = ((laser.t - laser.delay) * laser.speed) % (width + 200);
        const x = cycle - 100;
        const g = ctx.createLinearGradient(x, y, x + laser.width, y);
        g.addColorStop(0, "rgba(56,189,248,0)");
        g.addColorStop(0.5, "rgba(125,211,252,0.85)");
        g.addColorStop(1, "rgba(56,189,248,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 7;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + laser.width, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + laser.width, y);
        ctx.stroke();
      }

      if (nextSpawnAt === 0) {
        nextSpawnAt = now + 800 + Math.random() * 2400;
      } else if (now >= nextSpawnAt) {
        spawnShooter();
        scheduleShooter(now);
      }

      shooters = shooters.filter((s) => s.life < s.maxLife);
      ctx.lineCap = "round";
      for (const s of shooters) {
        s.life += step;
        s.x += s.vx * step;
        s.y += s.vy * step;

        // Smoothstep in, long ease out. Starting at full brightness is what made
        // the old streaks pop into frame; here they swell up out of the dark and
        // die away, and the tail grows with them instead of arriving full length.
        // Clamped: life can overshoot maxLife inside the frame it dies on, and a
        // negative base in the pow below would make env NaN and kill the loop.
        const p = Math.min(1, s.life / s.maxLife);
        const rise = Math.min(1, p / s.riseAt);
        const env =
          rise * rise * (3 - 2 * rise) * Math.pow(1 - p, 1.6) * s.bright;
        if (env < 0.004) continue;

        // Tail tapers to nothing via a gradient stroke; the head glow is a
        // radial fill. Both stay crisp at any DPR, unlike ctx.shadowBlur.
        const span = s.tail * (0.35 + 0.65 * rise);
        const tailX = s.x - s.vx * span;
        const tailY = s.y - s.vy * span;
        const trail = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        trail.addColorStop(0, "rgba(255,236,179,0)");
        trail.addColorStop(0.55, `rgba(255,240,198,${0.32 * env})`);
        trail.addColorStop(1, `rgba(255,250,232,${0.92 * env})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
        halo.addColorStop(0, `rgba(255,255,255,${env})`);
        halo.addColorStop(0.3, `rgba(255,244,214,${0.5 * env})`);
        halo.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }
      if (!running) {
        running = true;
        lastDraw = 0;
        raf = requestAnimationFrame(draw);
      }
    };

    applySize(measure().nextW, measure().nextH);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);

  return (
    // Shown and hidden entirely from CSS, off `html.dark`, the same way
    // .sky-floaters is — so the layer is taken out of paint when it is not the
    // active sky instead of merely being made transparent. `w-screen` is gone
    // with it: 100vw counts the scrollbar, which made this 15px wider than the
    // page it covers. The insets give it the right width.
    <canvas ref={canvasRef} aria-hidden className="night-sky pointer-events-none fixed inset-0 z-0 h-lvh" />
  );
}
