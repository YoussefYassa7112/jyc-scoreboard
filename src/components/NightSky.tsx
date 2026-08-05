"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";

type Star = {
  x: number;
  y: number;
  r: number;
  twinkle: number;
  phase: number;
};

type Laser = {
  y: number;
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
    let stars: Star[] = [];
    let lasers: Laser[] = [];
    let shooters: Shooter[] = [];
    let raf = 0;
    let lastSpawn = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = d3.range(140).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.78,
        r: Math.random() * 1.6 + 0.4,
        twinkle: 0.6 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
      }));

      lasers = d3.range(4).map((_, i) => ({
        y: height * (0.12 + i * 0.12),
        speed: 280 + Math.random() * 180,
        width: 90 + Math.random() * 70,
        delay: i * 2.2,
        t: -i * 2.2,
      }));
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
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);

      // Deep night wash
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#070b18");
      grad.addColorStop(0.45, "#101b36");
      grad.addColorStop(0.75, "#1a2744");
      grad.addColorStop(1, "#13261c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Soft moon
      ctx.beginPath();
      ctx.fillStyle = "rgba(226, 232, 255, 0.16)";
      ctx.arc(width * 0.82, height * 0.14, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(248, 250, 255, 0.55)";
      ctx.arc(width * 0.82, height * 0.14, 26, 0, Math.PI * 2);
      ctx.fill();

      for (const star of stars) {
        const alpha =
          0.35 +
          0.65 * (0.5 + 0.5 * Math.sin(t * star.twinkle + star.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lasers
      for (const laser of lasers) {
        laser.t += 1 / 60;
        const cycle = ((laser.t - laser.delay) * laser.speed) % (width + 200);
        const x = cycle - 100;
        const g = ctx.createLinearGradient(x, laser.y, x + laser.width, laser.y);
        g.addColorStop(0, "rgba(56,189,248,0)");
        g.addColorStop(0.5, "rgba(125,211,252,0.85)");
        g.addColorStop(1, "rgba(56,189,248,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x, laser.y);
        ctx.lineTo(x + laser.width, laser.y);
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

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [theme]);

  if (theme !== "dark") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
    />
  );
}
