// STARFORGE DEFENSE — towers: build, upgrade, sell, aim and fire.
// A tower lives on a plot, picks the furthest-along enemy in range, and
// fires projectiles (or instant chain lightning) on its cooldown.
import { TOWER_TYPES } from './config.js';

let nextTowerId = 1;

export function towerStats(typeKey, level) {
  return TOWER_TYPES[typeKey].levels[level];
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
    x: plot.x,
    y: plot.y,
    level: 0,
    cooldown: 0,
    angle: -Math.PI / 2,
    flash: 0,
    arcTimer: 0,
  };
}

export function upgradeTower(tower) {
  if (tower.level >= 2) return false;
  tower.level += 1;
  return true;
}

// Furthest-along enemy inside the tower's range, or null.
export function pickTarget(tower, enemies) {
  const stats = towerStats(tower.type, tower.level);
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
  state.projectiles.push({
    kind: 'bolt',
    x: tower.x,
    y: tower.y - 14,
    target,
    speed: 520,
    damage: stats.damage,
    splash: 0,
    color: '#4361ee',
    radius: 4,
  });
}

function fireMortar(tower, target, stats, state) {
  state.projectiles.push({
    kind: 'shell',
    x: tower.x,
    y: tower.y - 16,
    tx: target.x,
    ty: target.y,
    target,
    speed: 300,
    damage: stats.damage,
    splash: stats.splash,
    color: '#f4845f',
    radius: 7,
    arc: 0,
  });
}

function fireFrost(tower, target, stats, state) {
  state.projectiles.push({
    kind: 'frost',
    x: tower.x,
    y: tower.y - 14,
    target,
    speed: 420,
    damage: stats.damage,
    splash: stats.splash,
    color: '#48cae4',
    radius: 5,
    slowPct: stats.slowPct,
    slowSecs: stats.slowSecs,
  });
}

// Tesla lightning hits instantly and chains to nearby enemies.
function fireTesla(tower, first, stats, state) {
  const hit = [first];
  let from = first;
  let damage = stats.damage;
  while (hit.length < stats.chain) {
    let next = null;
    let nextD = 130;
    for (const e of state.enemies) {
      if (e.dead || hit.includes(e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < nextD) {
        next = e;
        nextD = d;
      }
    }
    if (!next) break;
    hit.push(next);
    from = next;
  }
  for (const e of hit) {
    state.damageEnemy(e, damage, 'tesla');
    damage = Math.max(4, Math.round(damage * 0.8));
  }
  state.arcs.push({ points: [ { x: tower.x, y: tower.y - 18 }, ...hit.map((e) => ({ x: e.x, y: e.y })) ], life: 0.14, maxLife: 0.14 });
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
    const stats = towerStats(tower.type, tower.level);
    const target = pickTarget(tower, state.enemies);
    if (!target) continue;
    tower.cooldown = 1 / stats.rate;
    fireTower(tower, target, stats, state);
    if (tower.type !== 'tesla') state.sfx.shoot(tower.type);
  }
}

// Move projectiles, apply hits when they reach their target.
export function updateProjectiles(state, dt) {
  for (const p of state.projectiles) {
    if (p.kind === 'shell') {
      // Lobbed shell: flies to the spot the target stood on, arcs upward.
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      p.arc += dt * 3;
      if (dist <= step + 4) {
        state.explodeShell(p);
        p.dead = true;
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
      continue;
    }
    const t = p.target;
    if (!t || t.dead) {
      p.dead = true;
      continue;
    }
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (dist <= step + t.radius * 0.5) {
      if (p.kind === 'frost') {
        state.damageEnemy(t, p.damage, 'frost');
        if (p.slowPct) state.slowEnemy(t, p.slowPct, p.slowSecs);
        if (p.splash > 0) state.splashDamage(t, p.damage * 0.5, p.splash, 'frost');
        state.burst(t.x, t.y, '#48cae4', 6, 60);
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
