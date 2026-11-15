// STARFORGE DEFENSE — waves: composition, preview text, spawning and the
// call-early bonus. 20 waves; bosses march at waves 10 and 20.
import { ECONOMY } from './config.js';

// Build the spawn queue for a wave: an ordered list of enemy type keys.
// Composition escalates: runners early, tanks and shielded mid-game, swarms
// in bursts, bosses at 10 and 20.
export function buildWave(n) {
  const q = [];
  const add = (type, count) => {
    for (let i = 0; i < count; i++) q.push(type);
  };
  if (n === 1) { add('grunt', 6); add('runner', 3); }
  else if (n === 2) { add('runner', 8); add('grunt', 6); }
  else if (n === 3) { add('swarm', 12); add('grunt', 6); }
  else if (n === 4) { add('grunt', 10); add('runner', 8); add('shielded', 2); }
  else if (n === 5) { add('swarm', 16); add('runner', 10); add('tank', 1); }
  else if (n === 6) { add('shielded', 5); add('grunt', 10); add('runner', 8); }
  else if (n === 7) { add('tank', 3); add('swarm', 14); add('grunt', 8); }
  else if (n === 8) { add('runner', 16); add('shielded', 6); add('tank', 2); }
  else if (n === 9) { add('swarm', 22); add('tank', 3); add('shielded', 5); }
  else if (n === 10) { add('grunt', 8); add('boss', 1); add('swarm', 10); }
  else if (n === 11) { add('shielded', 8); add('tank', 4); add('runner', 12); }
  else if (n === 12) { add('swarm', 26); add('tank', 4); add('grunt', 10); }
  else if (n === 13) { add('runner', 20); add('shielded', 8); add('tank', 4); }
  else if (n === 14) { add('tank', 6); add('shielded', 8); add('swarm', 18); }
  else if (n === 15) { add('grunt', 16); add('runner', 18); add('tank', 5); add('shielded', 6); }
  else if (n === 16) { add('swarm', 30); add('tank', 6); add('shielded', 8); }
  else if (n === 17) { add('runner', 24); add('tank', 7); add('shielded', 10); }
  else if (n === 18) { add('tank', 8); add('shielded', 10); add('swarm', 24); add('grunt', 12); }
  else if (n === 19) { add('runner', 26); add('tank', 8); add('shielded', 10); add('swarm', 20); }
  else { add('tank', 6); add('shielded', 8); add('boss', 1); add('swarm', 16); add('runner', 14); }
  return q;
}

// One-line preview shown before a wave starts ("Wave 7: 3 Tanks, 14 Swarms…").
export function wavePreview(n) {
  const counts = {};
  for (const t of buildWave(n)) counts[t] = (counts[t] || 0) + 1;
  const names = { runner: 'Runners', grunt: 'Grunts', swarm: 'Swarms', shielded: 'Shielded', tank: 'Tanks', boss: 'BOSS' };
  return Object.entries(counts)
    .map(([t, c]) => `${c} ${names[t]}`)
    .join(' · ');
}

export function waveClearBonus(n) {
  return ECONOMY.waveClearBase + n * ECONOMY.waveClearPerWave;
}

export function spawnInterval(n) {
  // Later waves spawn faster; bosses always arrive alone with a pause.
  return Math.max(0.35, 0.9 - n * 0.03);
}
