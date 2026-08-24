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

    const draw = (now: number) => {
      if (!running) return;
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#070b18");
      grad.addColorStop(0.45, "#101b36");
      grad.addColorStop(0.75, "#1a2744");
      grad.addColorStop(1, "#13261c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      for (const star of stars) {
        const alpha =
          0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * star.twinkle + star.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.arc(star.nx * width, star.ny * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const laser of lasers) {
        laser.t += 1 / 60;
        const y = laser.ny * height;
        const cycle = ((laser.t - laser.delay) * laser.speed) % (width + 200);
        const x = cycle - 100;
        const g = ctx.createLinearGradient(x, y, x + laser.width, y);
        g.addColorStop(0, "rgba(56,189,248,0)");
        g.addColorStop(0.5, "rgba(125,211,252,0.85)");
        g.addColorStop(1, "rgba(56,189,248,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + laser.width, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (now - lastSpawn > 2200) {
        spawnShooter();
        lastSpawn = now;
      }

      shooters = shooters.filter((s) => s.life < s.maxLife);
      for (const s of shooters) {
        s.life += 1 / 60;
        s.x += s.vx / 60;
        s.y += s.vy / 60;
        const fade = 1 - s.life / s.maxLife;
        ctx.strokeStyle = `rgba(255, 236, 179, ${fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${fade})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
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
      style={{ transitionDuration: "var(--bg-fade)" }}
    />
  );
}
