// STARFORGE DEFENSE — main: game state, the loop, and every player action
// (start, call wave, place, upgrade, sell, pause, speed). Wires the modules
// together and hands the canvas to render.js.
import { VIEW_W, VIEW_H, ECONOMY, TOWER_TYPES, PLOTS } from './config.js';
import { Sfx } from './audio.js';
import { makeFx, burst, ringBurst, shockRing, floatText, shake, updateFx } from './particles.js';
import { buildWave, wavePreview, waveClearBonus, spawnInterval } from './waves.js';
import { spawnEnemy, updateEnemies, damageEnemy, slowEnemy, burnEnemy } from './enemies.js';
import { createTower, upgradeTower, upgradeCost, specCost, applySpec, sellValue, updateTowers, updateProjectiles } from './towers.js';
import { draw } from './render.js';
import { handleClick, handleKey, handleMouseMove } from './ui.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

// Surface JS errors in the DOM so a headless smoke test can read them.
window.__gameErrors = [];
window.addEventListener('error', (ev) => {
  window.__gameErrors.push(String(ev.message || ev.error || 'unknown error'));
  statusEl.textContent = `errors: ${window.__gameErrors.length}`;
});
window.addEventListener('unhandledrejection', (ev) => {
  window.__gameErrors.push(`rejection: ${String(ev.reason)}`);
});

function freshState() {
  const state = {
    mode: 'title',
    paused: false,
    speed: 1,
    time: 0,
    gold: ECONOMY.startGold,
    lives: ECONOMY.startLives,
    wave: 0,
    score: 0,
    kills: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    fx: makeFx(),
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    interWave: 0,
    placingType: null,
    selectedTower: null,
    hoverPlot: null,
    mouse: null,
    showHelp: false,
    frozen: false,
    banner: null,
    endless: false,
    victoryBonusPaid: false,
    pendingSpawns: [],
    starfall: { charge: 0, max: 100, targeting: false },
    starfallEvents: [],
    stats: { goldEarned: 0, leaks: 0, time: 0 },
    sfx: new Sfx(),
  };
  // Combat callbacks the tower/enemy modules call back into.
  state.burst = (x, y, color, count, speed) => burst(state.fx, x, y, color, count, speed);
  state.damageEnemy = (e, amount, kind) => {
    const wasAlive = !e.dead && e.hp > 0;
    damageEnemy(state, e, amount, kind);
    // Floating damage numbers on the heavy hits only — every peck would
    // bury the field in digits, but a mortar slam should SAY its number.
    if (wasAlive && amount >= 30 && !e.dead) {
      floatText(state.fx, e.x + (Math.random() - 0.5) * 14, e.y - e.radius - 20, `${Math.round(amount)}`, '#ffffff');
    }
  };
  state.slowEnemy = (e, pct, secs) => slowEnemy(e, pct, secs);
  state.burnEnemy = (e, dps, secs) => burnEnemy(e, dps, secs);
  state.splashDamage = (center, amount, radius, kind) => {
    for (const e of state.enemies) {
      if (e.dead || e === center) continue;
      if (Math.hypot(e.x - center.x, e.y - center.y) <= radius) state.damageEnemy(e, amount, kind);
    }
  };
  state.explodeShell = (p) => {
    burst(state.fx, p.tx, p.ty, '#f4845f', 18, 160);
    burst(state.fx, p.tx, p.ty, '#ffd166', 10, 120);
    shockRing(state.fx, p.tx, p.ty, '#ffb35c', Math.max(46, p.splash));
    state.sfx.boom();
    for (const e of [...state.enemies]) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) {
        state.damageEnemy(e, p.damage, 'mortar');
        if (p.burnDps) state.burnEnemy(e, p.burnDps, p.burnSecs);
      }
    }
    // Cluster specialization: the shell splits into bomblets that scatter
    // around the impact point and pop a heartbeat later.
    if (p.cluster > 0) {
      for (let i = 0; i < p.cluster; i++) {
        const a = (i / p.cluster) * Math.PI * 2 + Math.random() * 0.7;
        const d = 34 + Math.random() * 26;
        state.projectiles.push({
          kind: 'shell',
          x: p.tx, y: p.ty - 10,
          tx: p.tx + Math.cos(a) * d,
          ty: p.ty + Math.sin(a) * d,
          target: null,
          speed: 460,
          damage: Math.round(p.damage * 0.45),
          splash: Math.round(p.splash * 0.45),
          color: '#ffb35c',
          radius: 4,
          arc: 0,
          cluster: 0,
          burnDps: 0,
          burnSecs: 0,
          trail: [],
        });
      }
    }
  };
  state.onKill = (e, kind) => {
    state.gold += e.gold;
    state.stats.goldEarned += e.gold;
    state.kills += 1;
    state.score += e.score;
    // Every kill feeds the STARFALL meter: starlight gathered from the
    // fallen, spent in one falling-star strike.
    const prevCharge = state.starfall.charge;
    state.starfall.charge = Math.min(state.starfall.max, state.starfall.charge + Math.max(1, Math.round(e.score / 8)));
    if (prevCharge < state.starfall.max && state.starfall.charge >= state.starfall.max) {
      floatText(state.fx, 640, 96, '★ STARFALL READY ★', '#ffd166');
      state.sfx.upgrade();
    }
    floatText(state.fx, e.x, e.y - 18, `+${e.gold}g`, '#ffd166');
    burst(state.fx, e.x, e.y, '#80ed99', 8, 110);
    state.sfx.coin();
    if (e.type === 'boss') {
      shake(state.fx, 16, 0.6);
      ringBurst(state.fx, e.x, e.y, '#ff0a54');
      shockRing(state.fx, e.x, e.y, '#ff0a54', 150);
      floatText(state.fx, e.x, e.y - 44, 'BOSS DOWN! +250g', '#ff0a54');
      state.sfx.bossDie();
    }
  };
  state.onLeak = (e) => {
    state.lives -= e.lives;
    state.stats.leaks += 1;
    floatText(state.fx, 1160, 300, `-${e.lives} ♥`, '#ef476f');
    burst(state.fx, 1160, 300, '#ef476f', 14, 140);
    shake(state.fx, 6, 0.25);
    state.sfx.leak();
    if (state.lives <= 0) {
      state.lives = 0;
      state.mode = 'defeat';
      state.sfx.defeat();
    }
  };
  return state;
}

let state = freshState();
window.__game = state;

// All player actions close over the outer `state` binding, so they keep
// working after resetGame() swaps in a fresh state object.
function attachActions(s) {
  s.startGame = () => {
    resetGame();
    state.mode = 'playing';
    state.interWave = ECONOMY.interWaveSeconds;
    state.sfx.ensure();
    state.sfx.horn();
  };
  s.restart = s.startGame;

s.callWave = () => {
  if (state.mode !== 'playing' || state.waveActive) return;
  if (!state.endless && state.wave >= ECONOMY.maxWave) return;
  if (state.interWave > 0 && state.wave > 0) {
    const bonus = Math.min(ECONOMY.callEarlyMax, Math.ceil(state.interWave) * ECONOMY.callEarlyPerSecond);
    state.gold += bonus;
    state.stats.goldEarned += bonus;
    floatText(state.fx, 640, 120, `Early call bonus +${bonus}g`, '#7df9ff');
  }
  state.wave += 1;
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = 0.6;
  state.waveActive = true;
  state.interWave = 0;
  state.banner = {
    title: state.endless && state.wave > ECONOMY.maxWave ? `WAVE ${state.wave} — ENDLESS` : `WAVE ${state.wave}`,
    sub: wavePreview(state.wave),
    life: 1.7,
    maxLife: 1.7,
  };
  state.sfx.horn();
  statusEl.textContent = `Wave ${state.wave} started`;
};

s.chooseSpec = (specKey) => {
  const tower = state.selectedTower;
  if (!tower) return;
  const cost = specCost(tower, specKey);
  if (cost === null) return;
  if (state.gold < cost) {
    floatText(state.fx, tower.x, tower.y - 34, 'Not enough gold!', '#ff4d6d');
    return;
  }
  state.gold -= cost;
  if (applySpec(tower, specKey)) {
    burst(state.fx, tower.x, tower.y, '#ffd166', 22, 150);
    shockRing(state.fx, tower.x, tower.y, '#ffd166', 60);
    state.sfx.upgrade();
  }
};

// After the wave-20 victory: keep the same forge, towers and score, and
// march into endless waves that scale forever.
s.startEndless = () => {
  if (state.mode !== 'victory') return;
  state.mode = 'playing';
  state.endless = true;
  state.interWave = ECONOMY.interWaveSeconds;
  state.banner = { title: 'ENDLESS MODE', sub: 'The forge holds — how long can you?', life: 1.7, maxLife: 1.7 };
  state.sfx.horn();
};

// STARFALL: with a full meter, arm the strike; the next field click calls
// a star fragment down on that spot.
s.toggleStarfall = () => {
  if (state.mode !== 'playing') return;
  if (state.starfall.charge < state.starfall.max) {
    floatText(state.fx, 640, 120, 'Starfall is still charging…', '#ffd166');
    return;
  }
  state.starfall.targeting = !state.starfall.targeting;
  if (state.starfall.targeting) {
    state.placingType = null;
    state.selectedTower = null;
  }
  state.sfx.click();
};

s.launchStarfall = (x, y) => {
  if (!state.starfall.targeting) return;
  state.starfall.targeting = false;
  state.starfall.charge = 0;
  state.starfallEvents.push({ x, y, t: 0, struck: false });
  state.sfx.horn();
};

s.togglePause = () => {
  if (state.mode !== 'playing') return;
  state.paused = !state.paused;
  state.sfx.click();
};

s.toggleSpeed = () => {
  state.speed = state.speed === 1 ? 2 : 1;
  state.sfx.click();
};

s.tryPlace = (plotIndex, plot) => {
  const key = state.placingType;
  if (!key) return;
  if (state.towers.some((t) => t.plotIndex === plotIndex)) return;
  const cost = TOWER_TYPES[key].levels[0].cost;
  if (state.gold < cost) {
    floatText(state.fx, plot.x, plot.y - 30, 'Not enough gold!', '#ef476f');
    return;
  }
  state.gold -= cost;
  const tower = createTower(key, plotIndex, plot);
  state.towers.push(tower);
  burst(state.fx, plot.x, plot.y, TOWER_TYPES[key].color, 12, 120);
  state.sfx.place();
  if (state.gold < cost) state.placingType = null;
};

s.tryUpgrade = () => {
  const tower = state.selectedTower;
  if (!tower) return;
  const cost = upgradeCost(tower);
  if (cost === null) return;
  if (state.gold < cost) {
    floatText(state.fx, tower.x, tower.y - 34, 'Not enough gold!', '#ef476f');
    return;
  }
  state.gold -= cost;
  upgradeTower(tower);
  burst(state.fx, tower.x, tower.y, '#ffd166', 16, 140);
  state.sfx.upgrade();
};

s.trySell = () => {
  const tower = state.selectedTower;
  if (!tower) return;
  state.gold += sellValue(tower);
  state.towers = state.towers.filter((t) => t !== tower);
  burst(state.fx, tower.x, tower.y, '#8d99ae', 10, 100);
  state.sfx.sell();
  state.selectedTower = null;
  };
}

function resetGame() {
  const sfx = state.sfx;
  const muted = sfx.muted;
  state = freshState();
  state.sfx = sfx;
  state.sfx.muted = muted;
  attachActions(state);
  window.__game = state;
}

attachActions(state);

function update(dt) {
  if (state.frozen) return; // screenshot scenes stay exactly as staged
  if (state.banner) {
    state.banner.life -= dt;
    if (state.banner.life <= 0) state.banner = null;
  }
  if (state.mode !== 'playing' || state.paused) {
    updateFx(state.fx, dt);
    return;
  }
  state.stats.time += dt;
  // STARFALL events: a star fragment streaks down for 0.35s, then strikes.
  for (const ev of state.starfallEvents) {
    ev.t += dt;
    if (!ev.struck && ev.t >= 0.35) {
      ev.struck = true;
      burst(state.fx, ev.x, ev.y, '#ffd166', 30, 240);
      burst(state.fx, ev.x, ev.y, '#fff3b0', 18, 180);
      burst(state.fx, ev.x, ev.y, '#ff9e2c', 14, 140, 'shard');
      shockRing(state.fx, ev.x, ev.y, '#ffd166', 150);
      shake(state.fx, 10, 0.4);
      state.sfx.boom();
      for (const e of [...state.enemies]) {
        if (e.dead) continue;
        if (Math.hypot(e.x - ev.x, e.y - ev.y) <= 110) state.damageEnemy(e, 220, 'starfall');
      }
    }
  }
  state.starfallEvents = state.starfallEvents.filter((ev) => ev.t < 0.8);
  // Inter-wave countdown: auto-starts the next wave at zero.
  if (!state.waveActive && state.wave > 0 && (state.endless || state.wave < ECONOMY.maxWave)) {
    state.interWave -= dt;
    if (state.interWave <= 0) state.callWave();
  }
  // Spawn the queued wave.
  if (state.waveActive && state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const type = state.spawnQueue.shift();
      spawnEnemy(state, type);
      state.spawnTimer = type === 'boss' ? 2.0 : spawnInterval(state.wave);
    }
  }
  updateEnemies(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateFx(state.fx, dt);
  // Wave cleared?
  if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveActive = false;
    const bonus = waveClearBonus(state.wave);
    state.gold += bonus;
    state.stats.goldEarned += bonus;
    floatText(state.fx, 640, 120, `Wave ${state.wave} cleared! +${bonus}g`, '#7df9ff');
    if (state.wave >= ECONOMY.maxWave && !state.endless && !state.victoryBonusPaid) {
      state.mode = 'victory';
      state.victoryBonusPaid = true;
      state.score += state.lives * 150;
      state.sfx.victory();
    } else {
      state.interWave = ECONOMY.interWaveSeconds;
    }
  }
}

// --- canvas sizing: letterboxed 1280x720, crisp on any window ---
let viewScale = 1;
let viewOffX = 0;
let viewOffY = 0;
let viewDpr = 1;

function resize() {
  viewDpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * viewDpr);
  canvas.height = Math.round(window.innerHeight * viewDpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  viewScale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  viewOffX = (window.innerWidth - VIEW_W * viewScale) / 2;
  viewOffY = (window.innerHeight - VIEW_H * viewScale) / 2;
}
window.addEventListener('resize', resize);
resize();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - viewOffX) / viewScale,
    y: (clientY - rect.top - viewOffY) / viewScale,
  };
}

canvas.addEventListener('click', (ev) => {
  const p = toLogical(ev.clientX, ev.clientY);
  handleClick(state, p.x, p.y);
});
canvas.addEventListener('mousemove', (ev) => {
  const p = toLogical(ev.clientX, ev.clientY);
  handleMouseMove(state, p.x, p.y);
});
window.addEventListener('keydown', (ev) => {
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(ev.key)) ev.preventDefault();
  handleKey(state, ev.key);
});

// --- the loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.frozen) state.time += dt;
  update(dt * state.speed);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewDpr * viewScale, 0, 0, viewDpr * viewScale, viewDpr * viewOffX, viewDpr * viewOffY);
  draw(ctx, state);
  requestAnimationFrame(frame);
}

// Deterministic screenshot scenes (?shot=title|play|upgrade|victory).
const shot = new URLSearchParams(window.location.search).get('shot');
if (shot) {
  applyShot(state, shot);
  state.frozen = true;
  window.__shot = shot;
}
requestAnimationFrame(frame);
