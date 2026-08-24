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
    let lastSpawn = 0;
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

    const spawnShooter = () => {
      shooters.push({
        x: Math.random() * width * 0.7,
        y: Math.random() * height * 0.35,
        vx: 220 + Math.random() * 180,
        vy: 90 + Math.random() * 80,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.5,
      });
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

      if (now - lastSpawn > 1700) {
        spawnShooter();
        lastSpawn = now;
      }

      shooters = shooters.filter((s) => s.life < s.maxLife);
      ctx.lineCap = "round";
      for (const s of shooters) {
        s.life += step;
        s.x += s.vx * step;
        s.y += s.vy * step;
        const fade = 1 - s.life / s.maxLife;

        // Tail tapers to nothing via a gradient stroke; the head glow is a
        // radial fill. Both stay crisp at any DPR, unlike ctx.shadowBlur.
        const tailX = s.x - s.vx * 0.15;
        const tailY = s.y - s.vy * 0.15;
        const trail = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        trail.addColorStop(0, "rgba(255,236,179,0)");
        trail.addColorStop(0.55, `rgba(255,240,198,${0.34 * fade})`);
        trail.addColorStop(1, `rgba(255,250,232,${0.95 * fade})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
        halo.addColorStop(0, `rgba(255,255,255,${fade})`);
        halo.addColorStop(0.3, `rgba(255,244,214,${0.5 * fade})`);
        halo.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
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
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 h-lvh w-screen transition-opacity ease-in-out ${
        theme === "dark" ? "opacity-100" : "opacity-0"
      }`}
      style={{
        transitionDuration: "var(--bg-fade)",
        // Painted behind the bitmap, so clearRect reveals it. Keeps the sky out
        // of the frame loop entirely.
        backgroundImage:
          "linear-gradient(to bottom, #070b18 0%, #101b36 45%, #1a2744 75%, #13261c 100%)",
      }}
    />
  );
}
