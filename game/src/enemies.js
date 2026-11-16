// STARFORGE DEFENSE 3D — enemies: spawn, march, shields, healing,
// armour and death. An enemy carries its `distance` along the road so
// towers target whoever is furthest toward the star.
import { ENEMY_TYPES, bossHpMul } from './config.js';
import { PATH_LENGTH, pathPointAt } from './map.js';

let nextEnemyId = 1;

// Hit points grow gently through the designed stages (fair, not hard)
// and keep climbing past stage 50 so endless stays dangerous.
export function hpFor(typeKey, stage) {
  const base = ENEMY_TYPES[typeKey].hp;
  if (typeKey === 'boss') {
    return Math.round(base * bossHpMul(stage) * (1 + Math.max(0, stage - 50) * 0.12));
  }
  const growth = 1 + (stage - 1) * 0.11 + Math.max(0, stage - 10) * 0.035
    + Math.max(0, stage - 30) * 0.05 + Math.max(0, stage - 50) * 0.03;
  return Math.round(base * growth);
}

export function shieldFor(typeKey, stage) {
  const def = ENEMY_TYPES[typeKey];
  if (!def.shield) return 0;
  return Math.round(def.shield * (1 + (stage - 1) * 0.08));
}

export function spawnEnemy(state, typeKey, atDistance = 0) {
  const def = ENEMY_TYPES[typeKey];
  const pos = pathPointAt(atDistance);
  const hp = hpFor(typeKey, state.wave);
  const shield = shieldFor(typeKey, state.wave);
  const e = {
    id: nextEnemyId++,
    type: typeKey,
    x: pos.x, y: pos.y, angle: pos.angle,
    distance: atDistance,
    radius: def.radius,
    speed: def.speed * (0.92 + state.rand() * 0.16),
    maxHp: hp, hp,
    shield, maxShield: shield,
    gold: def.gold, lives: def.lives, score: def.score,
    armour: def.armour || 0,
    scale: typeKey === 'boss' && state.wave >= 50 ? 1.3 : 1,
    slowPct: 0, slowTimer: 0,
    burnDps: 0, burnTimer: 0, burnAcc: 0,
    hitFlash: 0, lastHurt: -9, auraTimer: 1 + state.rand() * 2,
    dead: false, leaked: false,
    wobble: state.rand() * Math.PI * 2,
  };
  state.enemies.push(e);
  return e;
}

export function updateEnemies(state, dt) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const def = ENEMY_TYPES[e.type];
    if (e.slowTimer > 0) e.slowTimer -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    // Napalm burn, applied in chunks so shields spark readably.
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
    // Mender: knits itself back together once the shooting stops, and
    // continuously heals the pack around it (never the Dreadnought).
    if (def.regen && state.time - e.lastHurt > 2.5) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.regen * dt);
    }
    if (def.mend) {
      for (const o of state.enemies) {
        if (o === e || o.dead || o.type === 'boss') continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) <= 115) {
          o.hp = Math.min(o.maxHp, o.hp + def.mend * dt);
        }
      }
    }
    // Shieldbearer: every few seconds it re-projects its shield over
    // nearby allies that are running low.
    if (def.aura) {
      e.auraTimer -= dt;
      if (e.auraTimer <= 0) {
        e.auraTimer = 3.5;
        for (const o of state.enemies) {
          if (o === e || o.dead || o.type === 'boss') continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) <= 105 && o.shield < 20) {
            o.shield = Math.min(55, o.shield + 30);
            o.maxShield = Math.max(o.maxShield, o.shield);
            state.burst(o.x, o.y, '#f06fd8', 3, 40);
          }
        }
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
  // Splitter children join after the march, never mid-iteration.
  if (state.pendingSpawns.length > 0) {
    for (const s of state.pendingSpawns) spawnEnemy(state, s.type, s.at);
    state.pendingSpawns.length = 0;
  }
}

// Damage: shield absorbs first, armour blunts what reaches the hull
// (always at least 1). Returns true when the enemy died.
export function damageEnemy(state, enemy, amount, kind) {
  if (enemy.dead) return false;
  let left = amount;
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, left);
    enemy.shield -= absorbed;
    left -= absorbed;
    if (absorbed > 0) state.burst(enemy.x, enemy.y, '#f06fd8', 3, 40);
  }
  if (left > 0) {
    if (enemy.armour > 0) left = Math.max(1, left - enemy.armour);
    enemy.hp -= left;
    enemy.lastHurt = state.time;
  }
  enemy.hitFlash = 0.08;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    if (enemy.type === 'splitter') {
      state.pendingSpawns.push({ type: 'mite', at: Math.max(0, enemy.distance - 6) });
      state.pendingSpawns.push({ type: 'mite', at: Math.max(0, enemy.distance - 30) });
      state.burst(enemy.x, enemy.y, '#3ae0b0', 14, 130);
    }
    state.onKill(enemy, kind);
    return true;
  }
  return false;
}

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
