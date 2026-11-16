// STARFORGE DEFENSE 3D — stage compositions. Stages 1-20 are set-piece
// waves; 21-50 are generated per stage from a seeded LCG (so the preview
// always matches the march) with band-weighted mixes that only ever use
// enemy types whose debut stage has arrived. 51+ is endless generation.
import { ECONOMY, ENEMY_TYPES } from './config.js';

function handcrafted(n) {
  const q = [];
  const add = (t, c) => { for (let i = 0; i < c; i++) q.push(t); };
  if (n === 1) { add('grunt', 6); add('runner', 3); }
  else if (n === 2) { add('runner', 8); add('grunt', 6); }
  else if (n === 3) { add('swarm', 12); add('grunt', 6); }
  else if (n === 4) { add('grunt', 10); add('runner', 8); }
  else if (n === 5) { add('swarm', 14); add('shielded', 3); add('grunt', 8); }
  else if (n === 6) { add('shielded', 4); add('grunt', 10); add('splitter', 3); }
  else if (n === 7) { add('runner', 14); add('swarm', 14); add('splitter', 2); }
  else if (n === 8) { add('tank', 3); add('swarm', 14); add('grunt', 8); }
  else if (n === 9) { add('swarm', 22); add('tank', 2); add('shielded', 4); add('splitter', 3); }
  else if (n === 10) { add('grunt', 8); add('boss', 1); add('swarm', 10); }
  else if (n === 11) { add('shielded', 7); add('tank', 3); add('runner', 12); add('splitter', 4); }
  else if (n === 12) { add('swarm', 26); add('tank', 4); add('grunt', 10); add('splitter', 4); }
  else if (n === 13) { add('mender', 2); add('tank', 3); add('grunt', 12); add('runner', 10); }
  else if (n === 14) { add('tank', 5); add('shielded', 7); add('swarm', 18); add('splitter', 5); add('mender', 2); }
  else if (n === 15) { add('grunt', 16); add('runner', 18); add('tank', 4); add('shielded', 6); }
  else if (n === 16) { add('swarm', 30); add('tank', 5); add('shielded', 7); add('splitter', 5); }
  else if (n === 17) { add('lancer', 8); add('runner', 16); add('tank', 4); add('shielded', 6); }
  else if (n === 18) { add('tank', 7); add('shielded', 9); add('swarm', 24); add('grunt', 12); add('splitter', 6); add('mender', 3); }
  else if (n === 19) { add('lancer', 10); add('runner', 18); add('tank', 6); add('shielded', 8); add('swarm', 16); }
  else if (n === 20) { add('tank', 6); add('shielded', 8); add('boss', 1); add('swarm', 16); add('runner', 14); }
  return q.length ? q : null;
}

function lcg(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Weighted group plan for generated stages: each entry is
// [type, baseCount, growthPerStage] — jittered ±20% by the seeded RNG.
function generated(n) {
  const rnd = lcg(n);
  const depth = n - 20;
  const plan = [
    ['grunt', 14, 0.55], ['runner', 14, 0.6], ['swarm', 20, 0.9],
    ['shielded', 6, 0.28], ['splitter', 4, 0.2], ['tank', 5, 0.3],
    ['mender', 2, 0.1], ['lancer', 8, 0.35], ['aegis', 0, 0.3],
    ['lancerprime', 0, 0.22], ['tankprime', 0, 0.16],
  ];
  const groups = [];
  for (const [type, base, growth] of plan) {
    if (ENEMY_TYPES[type].debut > n) continue;
    const raw = base + growth * depth;
    if (raw < 1.5) continue;
    const count = Math.max(1, Math.round(raw * (0.85 + rnd() * 0.35)));
    groups.push([type, count]);
  }
  // Deterministic shuffle of group order so stages do not march in the
  // same sequence, then flatten.
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [groups[i], groups[j]] = [groups[j], groups[i]];
  }
  const q = [];
  for (const [type, count] of groups) for (let i = 0; i < count; i++) q.push(type);
  if (ECONOMY.bossStages.includes(n)) {
    // The Dreadnought marches mid-stage with an honour guard around it.
    const at = Math.floor(q.length * 0.45);
    q.splice(at, 0, 'tank', 'boss', 'tank');
  }
  return q;
}

export function buildWave(n) {
  if (n <= 20) return handcrafted(n);
  return generated(n);
}

const PLURALS = {
  grunt: 'Grunts', runner: 'Runners', swarm: 'Swarms', shielded: 'Shieldbearers',
  splitter: 'Splitters', mite: 'Mites', tank: 'Bulwarks', boss: 'DREADNOUGHT',
  mender: 'Menders', lancer: 'Lancers', aegis: 'Aegis', lancerprime: 'Lancer Primes',
  tankprime: 'Bulwark Primes',
};

export function wavePreview(n) {
  const counts = {};
  for (const t of buildWave(n)) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).map(([t, c]) => `${c} ${PLURALS[t]}`).join(' · ');
}

// The first stage each type appears in a stage's composition (boss
// stages count for the Dreadnought) — drives the intel cards.
export function debutForStage(n) {
  if (n === 1) return null; // the run opens with Grunts; no card needed
  const present = new Set(buildWave(n));
  for (const t of present) if (ENEMY_TYPES[t].debut === n) return t;
  return null;
}

export function waveClearBonus(n) {
  return ECONOMY.waveClearBase + n * ECONOMY.waveClearPerWave;
}

export function spawnInterval(n) {
  return Math.max(0.32, 0.9 - n * 0.012);
}
