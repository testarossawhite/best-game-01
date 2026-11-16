// STARFORGE DEFENSE — enemies: spawn, walk the path, take damage, leak.
// Enemies carry a `distance` (how far along the road) so towers can target
// the furthest-along one, and a shield pool that absorbs damage first.
import { ENEMY_TYPES } from './config.js';
import { PATH_LENGTH, pathPointAt } from './map.js';

let nextEnemyId = 1;

// HP grows with the wave so the same enemy types stay threatening.
export function hpFor(typeKey, wave) {
  const base = ENEMY_TYPES[typeKey].hp;
  const growth = 1 + (wave - 1) * 0.14 + Math.max(0, wave - 10) * 0.05;
  if (typeKey === 'boss') return Math.round(base * (wave >= 20 ? 2.3 + (wave - 20) * 0.6 : 1));
  return Math.round(base * growth);
}

export function spawnEnemy(state, typeKey, atDistance) {
  const def = ENEMY_TYPES[typeKey];
  const startDist = atDistance || 0;
  const pos = pathPointAt(startDist);
  const e = {
    id: nextEnemyId++,
    type: typeKey,
    x: pos.x,
    y: pos.y,
    angle: pos.angle,
    distance: startDist,
    radius: def.radius,
    speed: def.speed * (0.92 + Math.random() * 0.16),
    maxHp: hpFor(typeKey, state.wave),
    hp: hpFor(typeKey, state.wave),
    shield: def.shield ? Math.round(def.shield * (1 + (state.wave - 1) * 0.08)) : 0,
    maxShield: def.shield ? Math.round(def.shield * (1 + (state.wave - 1) * 0.08)) : 0,
    gold: def.gold,
    lives: def.lives,
    score: def.score,
    slowPct: 0,
    slowTimer: 0,
    burnDps: 0,
    burnTimer: 0,
    burnAcc: 0,
    hitFlash: 0,
    dead: false,
    leaked: false,
    wobble: Math.random() * Math.PI * 2,
  };
  state.enemies.push(e);
  return e;
}

export function updateEnemies(state, dt) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.slowTimer > 0) e.slowTimer -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    // Napalm burn: damage over time, applied in small chunks so the hit
    // flash and shield sparks stay readable instead of strobing.
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.burnAcc += e.burnDps * dt;
      if (e.burnAcc >= 3) {
        const chunk = Math.floor(e.burnAcc);
        e.burnAcc -= chunk;
        damageEnemy(state, e, chunk, 'napalm');
        if (e.dead) continue;
      }
    }
    const slow = e.slowTimer > 0 ? 1 - e.slowPct : 1;
    e.distance += e.speed * slow * dt;
    e.wobble += dt * 6;
    if (e.distance >= PATH_LENGTH) {
      e.leaked = true;
      e.dead = true;
      state.onLeak(e);
      continue;
    }
    const pos = pathPointAt(e.distance);
    e.x = pos.x;
    e.y = pos.y;
    e.angle = pos.angle;
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  // Splitter children (and any queued spawns) join after the march update,
  // so the array never changes shape mid-iteration.
  if (state.pendingSpawns && state.pendingSpawns.length > 0) {
    for (const s of state.pendingSpawns) spawnEnemy(state, s.type, s.at);
    state.pendingSpawns.length = 0;
  }
}

// Damage an enemy: shield absorbs first, then HP. Returns true if it died.
export function damageEnemy(state, enemy, amount, kind) {
  if (enemy.dead) return false;
  let left = amount;
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, left);
    enemy.shield -= absorbed;
    left -= absorbed;
    if (absorbed > 0) state.burst(enemy.x, enemy.y, '#b5179e', 3, 40);
  }
  if (left > 0) enemy.hp -= left;
  enemy.hitFlash = 0.08;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    // A Splitter's death is a birth: two Mites spill out just behind it.
    if (enemy.type === 'splitter') {
      if (!state.pendingSpawns) state.pendingSpawns = [];
      state.pendingSpawns.push({ type: 'mite', at: Math.max(0, enemy.distance - 6) });
      state.pendingSpawns.push({ type: 'mite', at: Math.max(0, enemy.distance - 30) });
      state.burst(enemy.x, enemy.y, '#06d6a0', 14, 130);
    }
    state.onKill(enemy, kind);
    return true;
  }
  return false;
}

// Napalm: (re)apply a burn — damage per second for a few seconds.
export function burnEnemy(enemy, dps, secs) {
  enemy.burnDps = Math.max(enemy.burnDps, dps);
  enemy.burnTimer = Math.max(enemy.burnTimer, secs);
}

export function slowEnemy(enemy, pct, secs) {
  if (pct > enemy.slowPct || enemy.slowTimer <= 0) {
    enemy.slowPct = pct;
    enemy.slowTimer = secs;
  } else {
    enemy.slowTimer = Math.max(enemy.slowTimer, secs);
  }
}
