import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const COLORS = [
  "#FFD700", // gold
  "#FF6B6B",
  "#4ECDC4",
  "#A78BFA",
  "#34D399",
  "#FB923C",
  "#F472B6",
];

export function Fireworks({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    function burst(x: number, y: number) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = 60 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 60 + Math.random() * 30,
          color,
          size: 2 + Math.random() * 2,
        });
      }
    }

    let frame = 0;
    let stopped = false;
    const totalFrames = 240; // ~4s at 60fps

    function tick() {
      if (stopped) return;
      ctx!.clearRect(0, 0, W(), H());

      // Launch new bursts periodically during the first ~3s
      if (frame < 180 && frame % 20 === 0) {
        const x = W() * (0.15 + Math.random() * 0.7);
        const y = H() * (0.25 + Math.random() * 0.4);
        burst(x, y);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.vx *= 0.99;
        p.vy *= 0.99;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }
      ctx!.globalAlpha = 1;

      frame++;
      if (frame < totalFrames || particles.length > 0) {
        requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    }
    requestAnimationFrame(tick);

    return () => {
      stopped = true;
      window.removeEventListener("resize", resize);
    };
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}