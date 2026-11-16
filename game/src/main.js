// STARFORGE DEFENSE 3D — main: game state, the stage flow (assault →
// reward → intel → intermission), every player action, and the loop.
// The fiction drives the flow: constructs ride the conduit to drink the
// star; between assaults the forge refines what the star shed.
import * as THREE from 'three';
import { ECONOMY, TOWER_TYPES, TOWER_SPECS, REWARDS, STORY, CORE, PLOTS, toWorld } from './config.js';
import { Sfx } from './audio.js';
import { makeFx, burst, ringBurst, shockRing, floatText, shake, updateFx } from './fx.js';
import { buildWave, wavePreview, waveClearBonus, spawnInterval, debutForStage } from './waves.js';
import { spawnEnemy, updateEnemies, damageEnemy, slowEnemy, burnEnemy } from './enemies.js';
import {
  createTower, upgradeTower, upgradeCost, specCost, applySpec, sellValue,
  updateTowers, updateProjectiles, effectiveStats,
} from './towers.js';
import { createWorld, mulberry } from './world.js';
import { createRenderer, syncRender } from './render.js';
import { createUI } from './ui.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
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

const world = createWorld(canvas);
const R = createRenderer(world);

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
    banner: null,
    endless: false,
    victoryBonusPaid: false,
    pendingSpawns: [],
    starfall: { charge: 0, max: 100, targeting: false },
    starfallEvents: [],
    stats: { goldEarned: 0, leaks: 0, time: 0 },
    buffs: { dmg: {}, rng: {}, rateAll: 1 },
    buffsStamp: 0,
    discountTokens: 0,
    rewardChoices: null,
    lastClearBonus: 0,
    intelType: null,
    intelBoss: false,
    leakFlashT: 0,
    frozen: false,
    rand: mulberry(20240817),
    sfx: new Sfx(),
  };
  state.burst = (x, y, color, count, speed, kind) => burst(state.fx, x, y, color, count, speed, kind);
  state.damageEnemy = (e, amount, kind) => {
    const wasAlive = !e.dead && e.hp > 0;
    damageEnemy(state, e, amount, kind);
    if (wasAlive && amount >= 30 && !e.dead) {
      floatText(state.fx, e.x + (state.rand() - 0.5) * 14, e.y - e.radius - 20, `${Math.round(amount)}`, '#ffffff');
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
    if (p.cluster > 0) {
      for (let i = 0; i < p.cluster; i++) {
        const a = (i / p.cluster) * Math.PI * 2 + state.rand() * 0.7;
        const d = 34 + state.rand() * 26;
        state.projectiles.push({
          kind: 'shell', x: p.tx, y: p.ty, tx: p.tx + Math.cos(a) * d, ty: p.ty + Math.sin(a) * d,
          target: null, speed: 460, damage: Math.round(p.damage * 0.45),
          splash: Math.round(p.splash * 0.45), cluster: 0, burnDps: 0, burnSecs: 0,
          arc: 0, flight: 0.28, t: 0,
        });
      }
    }
  };
  state.onKill = (e) => {
    state.gold += e.gold;
    state.stats.goldEarned += e.gold;
    state.kills += 1;
    state.score += e.score;
    const prev = state.starfall.charge;
    state.starfall.charge = Math.min(state.starfall.max, state.starfall.charge + Math.max(1, Math.round(e.score / 8)));
    if (prev < state.starfall.max && state.starfall.charge >= state.starfall.max) {
      floatText(state.fx, 640, 96, '★ STARFALL READY ★', '#ffd166');
      state.sfx.upgrade();
    }
    floatText(state.fx, e.x, e.y - 18, `+${e.gold}⛃`, '#ffd166');
    burst(state.fx, e.x, e.y, '#80ed99', 8, 110);
    state.sfx.coin();
    if (e.type === 'boss') {
      shake(state.fx, 16, 0.6);
      ringBurst(state.fx, e.x, e.y, '#ff2e6d');
      shockRing(state.fx, e.x, e.y, '#ff2e6d', 150);
      floatText(state.fx, e.x, e.y - 44, 'DREADNOUGHT DOWN! +250⛃', '#ff8fa8');
      state.sfx.bossDie();
    }
  };
  state.onLeak = (e) => {
    state.lives -= e.lives;
    state.stats.leaks += 1;
    state.leakFlashT = 1;
    world.starFlicker = Math.min(1, 0.4 + e.lives * 0.18);
    floatText(state.fx, CORE.x - 60, CORE.y, `-${e.lives} ☀`, '#ef476f');
    burst(state.fx, CORE.x - 20, CORE.y, '#ef476f', 14, 140);
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

function attachActions(s) {
  s.quotePrice = (cost) => (s.discountTokens > 0 ? Math.ceil(cost / 2) : cost);
  s.towerRange = (t) => effectiveStats(t, s.buffs).range;
  const payForging = (cost) => {
    const price = s.quotePrice(cost);
    s.gold -= price;
    if (price < cost) s.discountTokens -= 1;
    return price;
  };

  s.startGame = () => {
    resetGame();
    state.mode = 'playing';
    state.interWave = 8;
    state.sfx.ensure();
    state.sfx.horn();
  };
  s.restart = s.startGame;

  s.callWave = () => {
    if (state.mode !== 'playing' || state.waveActive) return;
    if (!state.endless && state.wave >= ECONOMY.maxStage) return;
    if (state.interWave > 0 && state.wave > 0) {
      const bonus = Math.min(ECONOMY.callEarlyMax, Math.ceil(state.interWave) * ECONOMY.callEarlyPerSecond);
      state.gold += bonus;
      state.stats.goldEarned += bonus;
      floatText(state.fx, 640, 120, `Early call bonus +${bonus}⛃`, '#7df9ff');
    }
    state.wave += 1;
    state.spawnQueue = buildWave(state.wave);
    state.spawnTimer = 0.6;
    state.waveActive = true;
    state.interWave = 0;
    const band = STORY.bands[state.wave];
    const isBoss = ECONOMY.bossStages.includes(state.wave);
    state.banner = {
      title: state.wave > ECONOMY.maxStage ? `STAGE ${state.wave} — ENDLESS` : isBoss ? `STAGE ${state.wave} — DREADNOUGHT` : `STAGE ${state.wave}`,
      sub: band || wavePreview(state.wave),
      life: 1.9, maxLife: 1.9,
    };
    state.sfx.horn();
    statusEl.textContent = `Stage ${state.wave} started`;
  };

  // --- stage rewards: the forge refines what the star shed ---
  s.drawRewards = () => {
    const owned = [...new Set(state.towers.map((t) => t.type))];
    const canUpgrade = state.towers.some((t) => t.level < 2);
    const pool = REWARDS.filter((r) => r.key !== 'freeupgrade' || canUpgrade);
    const picks = [];
    const used = new Set();
    while (picks.length < 3 && used.size < pool.length) {
      const def = pool[Math.floor(state.rand() * pool.length)];
      if (used.has(def.key)) continue;
      used.add(def.key);
      let target = null;
      if (def.key === 'overclock' || def.key === 'longbarrel') {
        const types = owned.length ? owned : ['bolt', 'frost', 'mortar', 'tesla'];
        target = types[Math.floor(state.rand() * types.length)];
      }
      picks.push({ def, target, text: def.desc(state.wave, state.gold, target ? TOWER_TYPES[target].name : '') });
    }
    return picks;
  };

  s.chooseReward = (i) => {
    if (state.mode !== 'reward' || !state.rewardChoices) return;
    const choice = state.rewardChoices[i];
    if (!choice) return;
    const { def, target } = choice;
    if (def.key === 'salvage') {
      const amt = 60 + state.wave * 8;
      state.gold += amt;
      state.stats.goldEarned += amt;
    } else if (def.key === 'reinforce') {
      state.lives = Math.min(ECONOMY.maxLives, state.lives + 2);
    } else if (def.key === 'surge') {
      state.starfall.charge = Math.min(state.starfall.max, state.starfall.charge + 50);
    } else if (def.key === 'interest') {
      const amt = Math.max(15, Math.floor(state.gold * 0.12));
      state.gold += amt;
      state.stats.goldEarned += amt;
    } else if (def.key === 'overclock') {
      state.buffs.dmg[target] = Math.round((state.buffs.dmg[target] || 1) * 1.1 * 1000) / 1000;
      state.buffsStamp += 1;
    } else if (def.key === 'longbarrel') {
      state.buffs.rng[target] = Math.round((state.buffs.rng[target] || 1) * 1.1 * 1000) / 1000;
      state.buffsStamp += 1;
    } else if (def.key === 'discount') {
      state.discountTokens += 1;
    } else if (def.key === 'freeupgrade') {
      const candidates = state.towers.filter((t) => t.level < 2);
      if (candidates.length) {
        const t = candidates[Math.floor(state.rand() * candidates.length)];
        upgradeTower(t);
        burst(state.fx, t.x, t.y, '#ffd166', 20, 150);
      }
    } else if (def.key === 'cycling') {
      state.buffs.rateAll = Math.round(state.buffs.rateAll * 1.08 * 1000) / 1000;
      state.buffsStamp += 1;
    }
    floatText(state.fx, 640, 110, `✦ ${def.name}`, '#ffd166');
    state.rewardChoices = null;
    state.sfx.upgrade();
    proceedToNextStage();
  };

  function proceedToNextStage() {
    const next = state.wave + 1;
    const debut = !state.endless && next <= ECONOMY.maxStage ? debutForStage(next) : null;
    if (debut) {
      state.mode = 'intel';
      state.intelType = debut;
      state.intelBoss = false;
      return;
    }
    if (!state.endless && ECONOMY.bossStages.includes(next)) {
      state.mode = 'intel';
      state.intelType = 'boss';
      state.intelBoss = true;
      return;
    }
    state.mode = 'playing';
    state.interWave = ECONOMY.interWaveSeconds;
  }

  s.dismissIntel = () => {
    if (state.mode !== 'intel') return;
    state.mode = 'playing';
    state.intelType = null;
    state.intelBoss = false;
    state.interWave = ECONOMY.interWaveSeconds;
    state.sfx.click();
  };

  s.chooseSpec = (specKey) => {
    const tower = state.selectedTower;
    if (!tower) return;
    const cost = specCost(tower, specKey);
    if (cost === null || state.gold < state.quotePrice(cost)) {
      if (cost !== null) floatText(state.fx, tower.x, tower.y - 34, 'Not enough shards!', '#ff4d6d');
      return;
    }
    payForging(cost);
    if (applySpec(tower, specKey)) {
      burst(state.fx, tower.x, tower.y, '#ffd166', 22, 150);
      shockRing(state.fx, tower.x, tower.y, '#ffd166', 60);
      state.sfx.upgrade();
    }
  };

  s.startEndless = () => {
    if (state.mode !== 'victory') return;
    state.mode = 'playing';
    state.endless = true;
    state.interWave = ECONOMY.interWaveSeconds;
    state.banner = { title: 'ENDLESS', sub: 'The void will return. Hold the line.', life: 1.9, maxLife: 1.9 };
    state.sfx.horn();
  };

  s.toggleStarfall = () => {
    if (state.mode !== 'playing') return;
    if (state.starfall.charge < state.starfall.max) {
      floatText(state.fx, 640, 120, 'The star is still gathering its fire…', '#ffd166');
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
  s.toggleSpeed = () => { state.speed = state.speed === 1 ? 2 : 1; state.sfx.click(); };
  s.toggleMute = () => { state.sfx.muted = !state.sfx.muted; };

  s.tryPlace = (plotIndex, plot) => {
    const key = state.placingType;
    if (!key) return;
    if (state.towers.some((t) => t.plotIndex === plotIndex)) return;
    const cost = TOWER_TYPES[key].levels[0].cost;
    if (state.gold < cost) {
      floatText(state.fx, plot.x, plot.y - 30, 'Not enough shards!', '#ef476f');
      return;
    }
    state.gold -= cost;
    const tower = createTower(key, plotIndex, plot);
    state.towers.push(tower);
    burst(state.fx, plot.x, plot.y, '#ffd166', 12, 120);
    state.sfx.place();
    state.selectedTower = tower;
    if (state.gold < cost) state.placingType = null;
  };

  s.tryUpgrade = () => {
    const tower = state.selectedTower;
    if (!tower) return;
    const cost = upgradeCost(tower);
    if (cost === null) return;
    if (state.gold < state.quotePrice(cost)) {
      floatText(state.fx, tower.x, tower.y - 34, 'Not enough shards!', '#ef476f');
      return;
    }
    payForging(cost);
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

function onStageCleared() {
  const bonus = waveClearBonus(state.wave);
  state.gold += bonus;
  state.stats.goldEarned += bonus;
  state.lastClearBonus = bonus;
  floatText(state.fx, 640, 120, `Stage ${state.wave} held! +${bonus}⛃`, '#7df9ff');
  if (state.wave >= ECONOMY.maxStage && !state.endless && !state.victoryBonusPaid) {
    state.victoryBonusPaid = true;
    state.score += state.lives * 150;
    state.mode = 'victory';
    state.sfx.victory();
    return;
  }
  state.rewardChoices = state.drawRewards();
  state.mode = 'reward';
}

function update(dt) {
  if (state.frozen) return;
  state.time += dt;
  if (state.banner) {
    state.banner.life -= dt;
    if (state.banner.life <= 0) state.banner = null;
  }
  if (state.mode !== 'playing' || state.paused) {
    updateFx(state.fx, dt);
    return;
  }
  state.stats.time += dt;
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
  if (!state.waveActive && (state.endless || state.wave < ECONOMY.maxStage)) {
    state.interWave -= dt;
    if (state.interWave <= 0) state.callWave();
  }
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
  if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0 && state.mode === 'playing') {
    state.waveActive = false;
    onStageCleared();
  }
}

const ui = createUI(() => state, world);

function resize() {
  world.renderer.setSize(window.innerWidth, window.innerHeight);
  world.camera.aspect = window.innerWidth / window.innerHeight;
  world.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const step = state.mode === 'playing' ? dt * state.speed : dt;
  update(step);
  syncRender(R, state, dt);
  ui.refresh(state, dt);
  requestAnimationFrame(frame);
}

// Test hooks: a deterministic stepper for the scripted playtest, plus a
// table->screen projector so synthetic pointer events can aim at plots.
window.__sim = {
  get state() { return state; },
  data: { PLOTS, TOWER_TYPES, ECONOMY },
  step(seconds) {
    const n = Math.max(1, Math.round(seconds * 30));
    for (let i = 0; i < n; i++) update(1 / 30);
  },
  project(tx, ty) {
    const w = toWorld(tx, ty);
    const v = new THREE.Vector3(w.x, 0.4, w.z).project(world.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  },
};

// Deterministic screenshot scenes (?shot=title|play|upgrade|victory).
const shot = new URLSearchParams(window.location.search).get('shot');
if (shot) {
  applyShot(state, shot, world);
  state.frozen = true;
  window.__shot = shot;
}
requestAnimationFrame(frame);
