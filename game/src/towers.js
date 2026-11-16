// STARFORGE DEFENSE 3D — towers: build, upgrade, specialize, sell, aim
// and fire. A tower stands on a plot, picks the furthest-along enemy in
// range, and fires projectiles (or instant chain lightning). At level 3
// the player chooses ONE specialization; stage-reward buffs (state.buffs)
// multiply damage / range per type and fire rate globally.
import { TOWER_TYPES, TOWER_SPECS } from './config.js';

let nextTowerId = 1;

export function effectiveStats(tower, buffs) {
  const base = TOWER_TYPES[tower.type].levels[tower.level];
  const stats = {
    damage: base.damage, range: base.range, rate: base.rate,
    splash: base.splash, chain: base.chain,
    slowPct: base.slowPct, slowSecs: base.slowSecs,
    pierce: false, cluster: 0, burnDps: 0, burnSecs: 0, chainJump: 130,
  };
  if (tower.spec) {
    const spec = TOWER_SPECS[tower.type].find((s) => s.key === tower.spec);
    if (spec) {
      for (const [k, v] of Object.entries(spec.mods)) {
        if (k.endsWith('Mul')) stats[k.slice(0, -3)] = Math.round(stats[k.slice(0, -3)] * v * 10) / 10;
        else stats[k] = v;
      }
    }
  }
  if (buffs) {
    stats.damage = Math.round(stats.damage * (buffs.dmg[tower.type] || 1));
    stats.range = Math.round(stats.range * (buffs.rng[tower.type] || 1));
    stats.rate = Math.round(stats.rate * (buffs.rateAll || 1) * 100) / 100;
  }
  return stats;
}

export function specOptions(tower) {
  if (tower.level < 2 || tower.spec) return [];
  return TOWER_SPECS[tower.type];
}

export function specCost(tower, specKey) {
  const spec = TOWER_SPECS[tower.type].find((s) => s.key === specKey);
  return spec ? spec.cost : null;
}

export function applySpec(tower, specKey) {
  if (tower.level < 2 || tower.spec) return false;
  if (!TOWER_SPECS[tower.type].some((s) => s.key === specKey)) return false;
  tower.spec = specKey;
  return true;
}

export function buildCost(typeKey) {
  return TOWER_TYPES[typeKey].levels[0].cost;
}

export function upgradeCost(tower) {
  if (tower.level >= 2) return null;
  return TOWER_TYPES[tower.type].levels[tower.level + 1].cost;
}

export function investedGold(tower) {
  const levels = TOWER_TYPES[tower.type].levels;
  let sum = 0;
  for (let i = 0; i <= tower.level; i++) sum += levels[i].cost;
  if (tower.spec) sum += specCost(tower, tower.spec) || 0;
  return sum;
}

export function sellValue(tower) {
  return Math.floor(investedGold(tower) * 0.7);
}

export function createTower(typeKey, plotIndex, plot) {
  return {
    id: nextTowerId++,
    type: typeKey,
    plotIndex,
    x: plot.x, y: plot.y,
    level: 0, spec: null,
    cooldown: 0, angle: -Math.PI / 2, flash: 0, arcTimer: 0,
  };
}

export function upgradeTower(tower) {
  if (tower.level >= 2) return false;
  tower.level += 1;
  return true;
}

export function pickTarget(tower, enemies, buffs) {
  const stats = effectiveStats(tower, buffs);
  let best = null;
  let bestDist = -1;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= stats.range && e.distance > bestDist) {
      best = e;
      bestDist = e.distance;
    }
  }
  return best;
}

function fireBolt(tower, target, stats, state) {
  const sx = tower.x;
  const sy = tower.y;
  if (stats.pierce) {
    const a = Math.atan2(target.y - sy, target.x - sx);
    state.projectiles.push({
      kind: 'rail', x: sx, y: sy, dx: Math.cos(a), dy: Math.sin(a),
      travelled: 0, maxDist: stats.range + 30, speed: 900,
      damage: stats.damage, hitIds: new Set(),
    });
    return;
  }
  state.projectiles.push({
    kind: 'bolt', x: sx, y: sy, target, speed: 520,
    damage: stats.damage, splash: 0,
  });
}

function fireMortar(tower, target, stats, state) {
  state.projectiles.push({
    kind: 'shell', x: tower.x, y: tower.y, tx: target.x, ty: target.y,
    target, speed: 300, damage: stats.damage, splash: stats.splash,
    cluster: stats.cluster, burnDps: stats.burnDps, burnSecs: stats.burnSecs,
    arc: 0, flight: Math.max(0.35, Math.hypot(target.x - tower.x, target.y - tower.y) / 300),
    t: 0,
  });
}

function fireFrost(tower, target, stats, state) {
  state.projectiles.push({
    kind: 'frost', x: tower.x, y: tower.y, target, speed: 420,
    damage: stats.damage, splash: stats.splash,
    slowPct: stats.slowPct, slowSecs: stats.slowSecs,
  });
}

function fireTesla(tower, first, stats, state) {
  const hit = [first];
  let from = first;
  while (hit.length < stats.chain) {
    let next = null;
    let nextD = stats.chainJump;
    for (const e of state.enemies) {
      if (e.dead || hit.includes(e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < nextD) { next = e; nextD = d; }
    }
    if (!next) break;
    hit.push(next);
    from = next;
  }
  let damage = stats.damage;
  for (const e of hit) {
    state.damageEnemy(e, damage, 'tesla');
    damage = Math.max(4, Math.round(damage * 0.8));
  }
  state.fx.arcs.push({
    points: [{ x: tower.x, y: tower.y, top: true }, ...hit.map((e) => ({ x: e.x, y: e.y }))],
    life: 0.14, maxLife: 0.14,
  });
  tower.arcTimer = 0.14;
  state.sfx.zap();
}

export function fireTower(tower, target, stats, state) {
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.flash = 0.09;
  if (tower.type === 'bolt') fireBolt(tower, target, stats, state);
  else if (tower.type === 'mortar') fireMortar(tower, target, stats, state);
  else if (tower.type === 'frost') fireFrost(tower, target, stats, state);
  else if (tower.type === 'tesla') fireTesla(tower, target, stats, state);
}

export function updateTowers(state, dt) {
  for (const tower of state.towers) {
    tower.cooldown -= dt;
    if (tower.flash > 0) tower.flash -= dt;
    if (tower.arcTimer > 0) tower.arcTimer -= dt;
    if (tower.cooldown > 0) continue;
    const stats = effectiveStats(tower, state.buffs);
    const target = pickTarget(tower, state.enemies, state.buffs);
    if (!target) continue;
    tower.cooldown = 1 / stats.rate;
    fireTower(tower, target, stats, state);
    if (tower.type !== 'tesla') state.sfx.shoot(tower.type);
  }
}

export function updateProjectiles(state, dt) {
  for (const p of state.projectiles) {
    if (p.kind === 'rail') {
      const step = p.speed * dt;
      p.x += p.dx * step;
      p.y += p.dy * step;
      p.travelled += step;
      for (const e of state.enemies) {
        if (e.dead || p.hitIds.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + 10) {
          p.hitIds.add(e.id);
          state.damageEnemy(e, p.damage, 'rail');
          state.burst(e.x, e.y, '#7df9ff', 7, 80);
        }
      }
      if (p.travelled >= p.maxDist) p.dead = true;
      continue;
    }
    if (p.kind === 'shell') {
      // Lobbed shell on a fixed flight time, so the renderer can draw a
      // true parabola between the mortar and the target point.
      p.t += dt;
      if (p.t >= p.flight) {
        state.explodeShell(p);
        p.dead = true;
      }
      continue;
    }
    const t = p.target;
    if (!t || t.dead) { p.dead = true; continue; }
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (dist <= step + t.radius * 0.5) {
      if (p.kind === 'frost') {
        state.damageEnemy(t, p.damage, 'frost');
        if (p.slowPct) state.slowEnemy(t, p.slowPct, p.slowSecs);
        if (p.splash > 0) state.splashDamage(t, p.damage * 0.5, p.splash, 'frost');
        state.burst(t.x, t.y, '#6fd3ff', 6, 60);
      } else {
        state.damageEnemy(t, p.damage, 'bolt');
        state.burst(t.x, t.y, '#ffd166', 4, 50);
      }
      p.dead = true;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);
}
