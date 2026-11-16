// STARFORGE DEFENSE — deterministic screenshot scenes. ?shot=title|play|
// upgrade|victory stages a real frame of the live game (real towers, real
// enemies, real HUD) and freezes the simulation, so screenshots are
// reproducible renders of the game's own code, never edited images.
import { PLOTS, ECONOMY } from './config.js';
import { pathPointAt } from './map.js';
import { createTower, upgradeTower, applySpec } from './towers.js';
import { spawnEnemy } from './enemies.js';
import { burst, shockRing, floatText } from './particles.js';

function stageBattle(state, wave, gold, lives, score, kills) {
  // The state is already fresh at load; set it playing directly (startGame
  // would swap in a new object and strand these mutations).
  state.mode = 'playing';
  state.interWave = ECONOMY.interWaveSeconds;
  state.wave = wave;
  state.waveActive = true;
  state.gold = gold;
  state.lives = lives;
  state.score = score;
  state.kills = kills;
  state.stats.goldEarned = 640;
  state.time = 8.5; // a photogenic phase for the star's rotation and flares
  state.starfall.charge = 62; // the meter, mid-charge, in the shop bar
  // A lived-in defence: one of each tower — the Bolt is a maxed Railgun,
  // the Tesla a maxed Storm coil; both specializations show on the field.
  const plan = [
    { type: 'bolt', plot: 2, level: 2, spec: 'rail' },
    { type: 'frost', plot: 6, level: 0 },
    { type: 'mortar', plot: 9, level: 1 },
    { type: 'tesla', plot: 10, level: 2, spec: 'storm' },
    { type: 'bolt', plot: 13, level: 0 },
  ];
  for (const p of plan) {
    const tower = createTower(p.type, p.plot, PLOTS[p.plot]);
    for (let i = 0; i < p.level; i++) upgradeTower(tower);
    if (p.spec) applySpec(tower, p.spec);
    tower.angle = -0.6;
    state.towers.push(tower);
  }
  state.towers[0].flash = 0.09; // railgun muzzle flash, frozen mid-blast
  state.towers[3].arcTimer = 0.1; // storm orb flaring
  // Enemies mid-march at staggered distances, a few already hurt — with a
  // Splitter and its Mites up front and the dreadnought closing on the core.
  const march = [
    { type: 'grunt', at: 420, hurt: 0.35 },
    { type: 'runner', at: 560, hurt: 0 },
    { type: 'splitter', at: 716, hurt: 0.3 },
    { type: 'mite', at: 684, hurt: 0 },
    { type: 'mite', at: 660, hurt: 0 },
    { type: 'shielded', at: 800, hurt: 0.2 },
    { type: 'tank', at: 920, hurt: 0.45 },
    { type: 'runner', at: 1030, hurt: 0 },
    { type: 'boss', at: 1305, hurt: 0.25 },
  ];
  for (const m of march) {
    const e = spawnEnemy(state, m.type);
    e.distance = m.at;
    const pos = pathPointAt(m.at);
    e.x = pos.x;
    e.y = pos.y;
    e.angle = pos.angle;
    e.hp = Math.round(e.maxHp * (1 - m.hurt));
    if (m.type === 'shielded') e.shield = Math.round(e.maxShield * 0.5);
  }
  // A shell arcing in with a smoke trail, a rail lance spearing the line,
  // a tesla arc frozen mid-chain, and a STARFALL fragment mid-descent.
  state.projectiles.push({
    kind: 'shell', x: 665, y: 305, tx: 590, ty: 430, target: null,
    speed: 300, damage: 58, splash: 78, color: '#f4845f', radius: 7, arc: 0.7,
    cluster: 0, burnDps: 0, burnSecs: 0,
    trail: [{ x: 700, y: 268 }, { x: 688, y: 280 }, { x: 676, y: 292 }, { x: 665, y: 305 }],
  });
  state.projectiles.push({
    kind: 'rail', x: 252, y: 208, dx: -0.78, dy: -0.63, travelled: 130, maxDist: 185,
    speed: 900, damage: 58, color: '#7df9ff', radius: 6, hitIds: new Set(),
    trail: [{ x: 307, y: 252 }, { x: 289, y: 237 }, { x: 270, y: 222 }, { x: 252, y: 208 }],
  });
  state.fx.arcs.push({
    points: [{ x: 890, y: 360 }, { x: 865, y: 430 }],
    life: 0.14, maxLife: 0.14,
  });
  state.starfallEvents.push({ x: 865, y: 430, t: 0.17, struck: false });
  burst(state.fx, 600, 420, '#ffd166', 10, 90);
  burst(state.fx, 516, 170, '#48cae4', 8, 70);
  shockRing(state.fx, 600, 420, '#ffb35c', 60);
  floatText(state.fx, 516, 148, '+8g', '#ffd166');
  floatText(state.fx, 872, 372, '+16g', '#ffd166');
  floatText(state.fx, 238, 168, '58', '#ffffff');
}

export function applyShot(state, shot) {
  if (shot === 'title') {
    state.mode = 'title';
    state.time = 3.2;
    // A quiet defence behind the title so the field reads at a glance.
    const t1 = createTower('bolt', 2, PLOTS[2]);
    upgradeTower(t1);
    const t2 = createTower('frost', 6, PLOTS[6]);
    const t3 = createTower('mortar', 9, PLOTS[9]);
    upgradeTower(t3);
    upgradeTower(t3);
    applySpec(t3, 'cluster');
    state.towers.push(t1, t2, t3);
    return;
  }
  if (shot === 'play') {
    stageBattle(state, 7, 342, 18, 1250, 87);
    state.banner = { title: 'WAVE 7', sub: 'Splitters inbound — splash ready', life: 1.15, maxLife: 1.7 };
    return;
  }
  if (shot === 'upgrade') {
    stageBattle(state, 8, 420, 17, 1640, 104);
    // Open the panel on the level-2 Mortar: the specialization choice.
    const mortar = state.towers.find((t) => t.type === 'mortar');
    mortar.level = 2;
    state.selectedTower = mortar;
    state.mouse = { x: 700, y: 260 };
    return;
  }
  if (shot === 'victory') {
    state.mode = 'playing';
    state.wave = ECONOMY.maxWave;
    state.kills = 312;
    state.score = 6950;
    state.lives = 14;
    state.gold = 512;
    state.stats.goldEarned = 2840;
    state.stats.leaks = 3;
    state.stats.time = 754;
    state.time = 5.1;
    state.mode = 'victory';
    // The winning defence, standing intact behind the results panel.
    for (const p of [
      { type: 'bolt', plot: 2, level: 2, spec: 'rail' },
      { type: 'frost', plot: 6, level: 1 },
      { type: 'mortar', plot: 9, level: 2, spec: 'cluster' },
      { type: 'tesla', plot: 10, level: 2, spec: 'storm' },
    ]) {
      const tower = createTower(p.type, p.plot, PLOTS[p.plot]);
      for (let i = 0; i < p.level; i++) upgradeTower(tower);
      if (p.spec) applySpec(tower, p.spec);
      state.towers.push(tower);
    }
    return;
  }
}
