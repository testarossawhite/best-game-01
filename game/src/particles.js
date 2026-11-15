// STARFORGE DEFENSE — juice: particles, floating score text, lightning
// arcs and screen shake. All visual, all transient, all cheap.
export function makeFx() {
  return { particles: [], texts: [], arcs: [], shakeTime: 0, shakeMag: 0 };
}

export function burst(fx, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 30,
      life: 0.45 + Math.random() * 0.3,
      maxLife: 0.75,
      color,
      size: 2 + Math.random() * 3.5,
    });
  }
}

export function ringBurst(fx, x, y, color) {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * 240,
      vy: Math.sin(a) * 240,
      life: 0.6,
      maxLife: 0.6,
      color,
      size: 3.5,
    });
  }
}

export function floatText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color: color || '#ffd166', life: 1.0, maxLife: 1.0 });
}

export function shake(fx, mag, secs) {
  fx.shakeTime = Math.max(fx.shakeTime, secs);
  fx.shakeMag = Math.max(fx.shakeMag, mag);
}

export function updateFx(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y -= 34 * dt;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  for (const a of fx.arcs) a.life -= dt;
  fx.arcs = fx.arcs.filter((a) => a.life > 0);
  if (fx.shakeTime > 0) {
    fx.shakeTime -= dt;
    if (fx.shakeTime <= 0) fx.shakeMag = 0;
  }
}

export function shakeOffset(fx) {
  if (fx.shakeTime <= 0) return { x: 0, y: 0 };
  const m = fx.shakeMag * (fx.shakeTime / 0.5);
  return { x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m };
}
