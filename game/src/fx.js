// STARFORGE DEFENSE 3D — transient effects state: particle bursts,
// shockwave rings, tesla arcs, floating texts and screen shake. Pure
// data — render.js turns it into sprites and meshes each frame.

export function makeFx() {
  return { particles: [], rings: [], arcs: [], texts: [], shakeAmp: 0, shakeTime: 0 };
}

export function burst(fx, x, y, color, count, speed, kind = 'spark') {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.3, maxLife: 0.6,
      color, size: kind === 'shard' ? 5 : 3.2, kind,
    });
  }
}

export function shockRing(fx, x, y, color, maxR) {
  fx.rings.push({ x, y, color, r: 6, maxR, life: 0.4, maxLife: 0.4 });
}

export function ringBurst(fx, x, y, color) {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    fx.particles.push({
      x, y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
      life: 0.5, maxLife: 0.5, color, size: 4, kind: 'spark',
    });
  }
}

export function floatText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

export function shake(fx, amp, time) {
  fx.shakeAmp = Math.max(fx.shakeAmp, amp);
  fx.shakeTime = Math.max(fx.shakeTime, time);
}

export function updateFx(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const r of fx.rings) {
    r.life -= dt;
    r.r = r.maxR * (1 - r.life / r.maxLife);
  }
  fx.rings = fx.rings.filter((r) => r.life > 0);
  for (const a of fx.arcs) a.life -= dt;
  fx.arcs = fx.arcs.filter((a) => a.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y -= 26 * dt;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  if (fx.shakeTime > 0) {
    fx.shakeTime -= dt;
    if (fx.shakeTime <= 0) fx.shakeAmp = 0;
  }
}
