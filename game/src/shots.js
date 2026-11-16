// STARFORGE DEFENSE 3D — deterministic screenshot scenes. Each ?shot=
// stages a real state of the live game (real towers, real enemies, real
// HUD and panels) and freezes the simulation, so the screenshots are
// reproducible renders of the game's own code, never edited images.
//   title   -> the title screen over a quiet defence
//   intel   -> mid-battle, the NEW HOSTILE card for the Bulwark's debut
//   upgrade -> mid-battle, the specialization panel open on a Mortar
//   victory -> the results screen after stage 50, defence intact
import { PLOTS, ECONOMY } from './config.js';
import { pathPointAt } from './map.js';
import { createTower, upgradeTower, applySpec } from './towers.js';
import { spawnEnemy } from './enemies.js';
import { burst, shockRing, floatText } from './fx.js';

function placeTower(state, type, plot, level, spec) {
  const tower = createTower(type, plot, PLOTS[plot]);
  for (let i = 0; i < level; i++) upgradeTower(tower);
  if (spec) applySpec(tower, spec);
  tower.angle = -0.6;
  state.towers.push(tower);
  return tower;
}

function marcher(state, type, at, hurt = 0) {
  const e = spawnEnemy(state, type, at);
  const pos = pathPointAt(at);
  e.x = pos.x;
  e.y = pos.y;
  e.angle = pos.angle;
  if (hurt) e.hp = Math.round(e.maxHp * (1 - hurt));
  return e;
}

function stageBattle(state, wave, gold, lives, score, kills) {
  state.mode = 'playing';
  state.wave = wave;
  state.waveActive = true;
  state.gold = gold;
  state.lives = lives;
  state.score = score;
  state.kills = kills;
  state.stats.goldEarned = 640;
  state.time = 8.5; // a photogenic phase of the star's rotation
  state.starfall.charge = 62;
  const bolt = placeTower(state, 'bolt', 2, 2, 'rail');
  placeTower(state, 'frost', 6, 0, null);
  const mortar = placeTower(state, 'mortar', 9, 1, null);
  placeTower(state, 'tesla', 10, 2, 'storm');
  placeTower(state, 'bolt', 13, 0, null);
  // Constructs mid-march: a Splitter and its Mites up front, a
  // Shieldbearer glowing, the Dreadnought closing on the star.
  marcher(state, 'grunt', 420, 0.35);
  marcher(state, 'runner', 560);
  marcher(state, 'splitter', 716, 0.3);
  marcher(state, 'mite', 684);
  marcher(state, 'mite', 660);
  const shielded = marcher(state, 'shielded', 800, 0.2);
  shielded.shield = Math.round(shielded.maxShield * 0.6);
  marcher(state, 'tank', 920, 0.45);
  marcher(state, 'runner', 1030);
  marcher(state, 'boss', 1305, 0.25);
  // A shell arcing in, a rail lance on its line, a tesla arc mid-chain,
  // and a STARFALL fragment streaking down.
  state.projectiles.push({
    kind: 'shell', x: mortar.x, y: mortar.y, tx: 590, ty: 430, target: null,
    speed: 300, damage: 58, splash: 78, cluster: 0, burnDps: 0, burnSecs: 0,
    arc: 0, flight: 0.62, t: 0.3,
  });
  const target = state.enemies[0];
  const a = Math.atan2(target.y - bolt.y, target.x - bolt.x);
  state.projectiles.push({
    kind: 'rail', x: bolt.x + Math.cos(a) * 60, y: bolt.y + Math.sin(a) * 60,
    dx: Math.cos(a), dy: Math.sin(a), travelled: 60, maxDist: 185,
    speed: 900, damage: 58, hitIds: new Set(),
  });
  const tesla = state.towers[3];
  state.fx.arcs.push({
    points: [{ x: tesla.x, y: tesla.y, top: true }, { x: shielded.x, y: shielded.y }],
    life: 0.14, maxLife: 0.14,
  });
  state.starfallEvents.push({ x: shielded.x, y: shielded.y, t: 0.17, struck: false });
  burst(state.fx, 600, 420, '#ffd166', 10, 90);
  burst(state.fx, 516, 170, '#48cae4', 8, 70);
  shockRing(state.fx, 600, 420, '#ffb35c', 60);
  floatText(state.fx, 516, 148, '+8⛃', '#ffd166');
  floatText(state.fx, 872, 372, '+16⛃', '#ffd166');
  floatText(state.fx, 238, 168, '58', '#ffffff');
  return { bolt, mortar, tesla };
}

export function applyShot(state, shot) {
  if (shot === 'title') {
    state.mode = 'title';
    state.time = 3.2;
    const t1 = placeTower(state, 'bolt', 2, 1, null);
    t1.angle = -1.1;
    placeTower(state, 'frost', 6, 0, null);
    placeTower(state, 'mortar', 9, 2, 'cluster');
    return;
  }
  if (shot === 'intel') {
    stageBattle(state, 7, 342, 18, 1250, 87);
    state.waveActive = false;
    state.mode = 'intel';
    state.intelType = 'tank';
    state.intelBoss = false;
    return;
  }
  if (shot === 'upgrade') {
    const { mortar } = stageBattle(state, 8, 420, 17, 1640, 104);
    mortar.level = 2;
    state.selectedTower = mortar;
    state.banner = { title: 'STAGE 8', sub: 'Bulwarks on the conduit — splash ready', life: 1.15, maxLife: 1.7 };
    return;
  }
  if (shot === 'victory') {
    state.wave = ECONOMY.maxStage;
    state.kills = 812;
    state.score = 24850;
    state.lives = 14;
    state.gold = 512;
    state.stats.goldEarned = 6840;
    state.stats.leaks = 3;
    state.stats.time = 2310;
    state.time = 5.1;
    state.mode = 'victory';
    placeTower(state, 'bolt', 2, 2, 'rail');
    placeTower(state, 'frost', 6, 1, null);
    placeTower(state, 'mortar', 9, 2, 'cluster');
    placeTower(state, 'tesla', 10, 2, 'storm');
    return;
  }
}
