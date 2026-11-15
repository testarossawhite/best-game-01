// STARFORGE DEFENSE — deterministic screenshot scenes. ?shot=title|play|
// upgrade|victory stages a real frame of the live game (real towers, real
// enemies, real HUD) and freezes the simulation, so screenshots are
// reproducible renders of the game's own code, never edited images.
import { PLOTS, ECONOMY } from './config.js';
import { pathPointAt } from './map.js';
import { createTower, upgradeTower } from './towers.js';
import { spawnEnemy } from './enemies.js';
import { burst, floatText } from './particles.js';

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
  // A lived-in defence: one of each tower, two of them upgraded.
  const plan = [
    { type: 'bolt', plot: 2, level: 1 },
    { type: 'frost', plot: 6, level: 0 },
    { type: 'mortar', plot: 9, level: 1 },
    { type: 'tesla', plot: 10, level: 0 },
    { type: 'bolt', plot: 13, level: 0 },
  ];
  for (const p of plan) {
    const tower = createTower(p.type, p.plot, PLOTS[p.plot]);
    for (let i = 0; i < p.level; i++) upgradeTower(tower);
    tower.angle = -0.6;
    state.towers.push(tower);
  }
  // Enemies mid-march at staggered distances, a few already hurt.
  const march = [
    { type: 'grunt', at: 420, hurt: 0.35 },
    { type: 'runner', at: 560, hurt: 0 },
    { type: 'swarm', at: 640, hurt: 0.5 },
    { type: 'swarm', at: 660, hurt: 0 },
    { type: 'shielded', at: 780, hurt: 0.2 },
    { type: 'tank', at: 900, hurt: 0.45 },
    { type: 'runner', at: 1020, hurt: 0 },
    { type: 'grunt', at: 1150, hurt: 0.6 },
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
  // A shell arcing in and a bolt mid-flight, plus fresh impact sparks.
  state.projectiles.push({
    kind: 'shell', x: 700, y: 210, tx: 800, ty: 430, target: null,
    speed: 300, damage: 58, splash: 78, color: '#f4845f', radius: 7, arc: 0.7,
  });
  state.projectiles.push({
    kind: 'bolt', x: 330, y: 250, target: state.enemies[0],
    speed: 520, damage: 20, splash: 0, color: '#4361ee', radius: 4,
  });
  burst(state.fx, 780, 430, '#ffd166', 10, 90);
  burst(state.fx, 560, 170, '#48cae4', 8, 70);
  floatText(state.fx, 560, 140, '+8g', '#ffd166');
  floatText(state.fx, 900, 400, '+16g', '#ffd166');
}

export function applyShot(state, shot) {
  if (shot === 'title') {
    state.mode = 'title';
    // A quiet defence behind the title so the field reads at a glance.
    const t1 = createTower('bolt', 2, PLOTS[2]);
    const t2 = createTower('frost', 6, PLOTS[6]);
    const t3 = createTower('mortar', 9, PLOTS[9]);
    state.towers.push(t1, t2, t3);
    return;
  }
  if (shot === 'play') {
    stageBattle(state, 7, 342, 18, 1250, 87);
    return;
  }
  if (shot === 'upgrade') {
    stageBattle(state, 8, 268, 17, 1640, 104);
    // Open the upgrade panel on the level-2 Mortar.
    const mortar = state.towers.find((t) => t.type === 'mortar');
    state.selectedTower = mortar;
    state.mouse = { x: 700, y: 260 };
    return;
  }
  if (shot === 'victory') {
    state.mode = 'playing';
    state.wave = ECONOMY.maxWave;
    state.kills = 312;
    state.score = 4860;
    state.lives = 14;
    state.stats.goldEarned = 2840;
    state.mode = 'victory';
    // The winning defence, standing intact behind the results panel.
    for (const p of [
      { type: 'bolt', plot: 2, level: 2 },
      { type: 'frost', plot: 6, level: 1 },
      { type: 'mortar', plot: 9, level: 2 },
      { type: 'tesla', plot: 10, level: 2 },
    ]) {
      const tower = createTower(p.type, p.plot, PLOTS[p.plot]);
      for (let i = 0; i < p.level; i++) upgradeTower(tower);
      state.towers.push(tower);
    }
    return;
  }
}
