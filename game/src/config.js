// STARFORGE DEFENSE 3D — data: world mapping, the road, the forge star,
// tower and enemy catalogues, stage rewards and the economy. Every other
// module reads its numbers from here; nothing renders or simulates in
// this file.
//
// Game logic lives on a 1280x720 "table" (the same plane the forge has
// always used); render.js maps table coordinates to 3D world units.

export const TABLE_W = 1280;
export const TABLE_H = 720;
export const WORLD_SCALE = 1 / 20; // table px -> world units

export function toWorld(x, y) {
  return { x: (x - 640) * WORLD_SCALE, z: (y - 340) * WORLD_SCALE };
}

// The captured star the player defends, and the road that leads to it.
export const CORE = { x: 1196, y: 300, r: 30 };

export const PATH_POINTS = [
  { x: -40, y: 170 }, { x: 210, y: 170 }, { x: 210, y: 430 },
  { x: 500, y: 430 }, { x: 500, y: 150 }, { x: 800, y: 150 },
  { x: 800, y: 470 }, { x: 1060, y: 470 }, { x: 1060, y: 300 },
  { x: CORE.x - CORE.r - 6, y: 300 },
];

// Build plots: pads on the deck where towers may stand.
export const PLOTS = [
  { x: 120, y: 270 }, { x: 300, y: 90 }, { x: 300, y: 260 },
  { x: 300, y: 520 }, { x: 410, y: 340 }, { x: 410, y: 540 },
  { x: 590, y: 240 }, { x: 590, y: 520 }, { x: 700, y: 90 },
  { x: 700, y: 260 }, { x: 890, y: 240 }, { x: 890, y: 380 },
  { x: 890, y: 560 }, { x: 970, y: 90 }, { x: 1150, y: 400 },
  { x: 1150, y: 170 },
];

// Deck dressing (render only): sensor mast, cargo pods, power cells…
export const PROPS = [
  { kind: 'sensor', x: 92, y: 96 }, { kind: 'pods', x: 648, y: 378 },
  { kind: 'cells', x: 150, y: 566 }, { kind: 'beacon', x: 1136, y: 104 },
  { kind: 'drums', x: 424, y: 92 }, { kind: 'pods', x: 986, y: 548 },
];

// Tower catalogue: levels[i] is the stat block at level i (0-based);
// cost builds level 0 and buys each later level.
export const TOWER_TYPES = {
  bolt: {
    name: 'Bolt Spire', short: 'BOLT', hotkey: '1', color: 0x5f7cff, accent: '#7df9ff',
    desc: 'Fast single shots',
    levels: [
      { cost: 50, damage: 12, range: 115, rate: 2.4, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 45, damage: 20, range: 125, rate: 2.8, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 95, damage: 36, range: 140, rate: 3.4, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
    ],
  },
  frost: {
    name: 'Frost Obelisk', short: 'FROST', hotkey: '2', color: 0x6fd3ff, accent: '#aee9ff',
    desc: 'Slows enemies',
    levels: [
      { cost: 70, damage: 5, range: 105, rate: 1.1, splash: 0, chain: 0, slowPct: 0.45, slowSecs: 1.6 },
      { cost: 60, damage: 9, range: 115, rate: 1.2, splash: 0, chain: 0, slowPct: 0.55, slowSecs: 1.8 },
      { cost: 115, damage: 16, range: 130, rate: 1.4, splash: 55, chain: 0, slowPct: 0.65, slowSecs: 2.2 },
    ],
  },
  mortar: {
    name: 'Mortar Stack', short: 'MORTAR', hotkey: '3', color: 0xff8a5c, accent: '#ffb35c',
    desc: 'Splash damage',
    levels: [
      { cost: 100, damage: 34, range: 165, rate: 0.55, splash: 62, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 90, damage: 58, range: 175, rate: 0.6, splash: 78, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 165, damage: 100, range: 190, rate: 0.7, splash: 100, chain: 0, slowPct: 0, slowSecs: 0 },
    ],
  },
  tesla: {
    name: 'Tesla Mast', short: 'TESLA', hotkey: '4', color: 0xb07dff, accent: '#d0a2ff',
    desc: 'Chain lightning',
    levels: [
      { cost: 130, damage: 17, range: 135, rate: 0.85, splash: 0, chain: 3, slowPct: 0, slowSecs: 0 },
      { cost: 110, damage: 28, range: 145, rate: 0.9, splash: 0, chain: 4, slowPct: 0, slowSecs: 0 },
      { cost: 210, damage: 46, range: 160, rate: 1.0, splash: 0, chain: 6, slowPct: 0, slowSecs: 0 },
    ],
  },
};
export const TOWER_ORDER = ['bolt', 'frost', 'mortar', 'tesla'];

// Level-3 specializations: at max level the player picks ONE branch.
// mods override the level-3 stat block; a key ending in "Mul" multiplies.
export const TOWER_SPECS = {
  bolt: [
    { key: 'rail', name: 'Railgun', desc: 'Piercing line shots, heavy damage', cost: 120, mods: { damage: 58, rate: 1.5, range: 155, pierce: true } },
    { key: 'dual', name: 'Dual Bolt', desc: 'Twin emitters: +90% fire rate', cost: 110, mods: { damage: 30, rateMul: 1.9 } },
  ],
  frost: [
    { key: 'deepfreeze', name: 'Deep Freeze', desc: 'Slow 80% for 3.2s', cost: 130, mods: { slowPct: 0.8, slowSecs: 3.2, damage: 20 } },
    { key: 'shatter', name: 'Shatter', desc: 'Heavy damage, wider burst', cost: 125, mods: { damage: 52, splash: 85 } },
  ],
  mortar: [
    { key: 'cluster', name: 'Cluster', desc: 'Shells split into 3 bomblets', cost: 200, mods: { damage: 80, cluster: 3 } },
    { key: 'napalm', name: 'Napalm', desc: 'Burns targets: 18 dmg/s, 3s', cost: 190, mods: { burnDps: 18, burnSecs: 3 } },
  ],
  tesla: [
    { key: 'storm', name: 'Storm', desc: 'Chains to 10, jumps further', cost: 260, mods: { damage: 40, chain: 10, chainJump: 165 } },
    { key: 'overcharge', name: 'Overcharge', desc: '+115% damage per arc', cost: 240, mods: { damage: 99 } },
  ],
};

// Enemy roster. `debut` is the first stage the type marches on; before
// that stage the player gets a NEW HOSTILE intel card. armour is flat
// damage reduction per hit; shield is an absorb pool; aura marks the
// Shieldbearer's projected shield; regen/mend are the Mender's healing.
export const ENEMY_TYPES = {
  grunt:    { name: 'Grunt', trait: 'A void construct shambling down the conduit to drink the star dry.', color: 0x8fe388, dark: 0x4a8a34, radius: 13, speed: 48, hp: 70, gold: 8, lives: 1, score: 10, debut: 1 },
  runner:   { name: 'Runner', trait: 'A lean sliver of dark that races the light — it wants to be first to the star.', color: 0xffab4a, dark: 0xb06a10, radius: 11, speed: 78, hp: 34, gold: 6, lives: 1, score: 10, debut: 2 },
  swarm:    { name: 'Swarmling', trait: 'Ember-sized void spawn. One is nothing; the swarm is a tide.', color: 0xffe14a, dark: 0xb08d10, radius: 8, speed: 92, hp: 16, gold: 3, lives: 1, score: 5, debut: 3 },
  shielded: { name: 'Shieldbearer', trait: 'It wraps its kin in stolen dark — shields bloom around it as it walks.', color: 0xf06fd8, dark: 0xa02090, radius: 14, speed: 42, hp: 95, shield: 70, aura: true, gold: 13, lives: 1, score: 20, debut: 5 },
  splitter: { name: 'Splitter', trait: 'A swollen sac of unlight. Cut it open and the dark spills out as Mites.', color: 0x3ae0b0, dark: 0x0a7a5c, radius: 15, speed: 40, hp: 130, gold: 10, lives: 1, score: 15, debut: 6 },
  mite:     { name: 'Mite', trait: 'Splitter spawn — a droplet of void, quick and desperate for light.', color: 0xb5e8c8, dark: 0x4a8a68, radius: 7, speed: 108, hp: 12, gold: 2, lives: 1, score: 3, debut: 6 },
  tank:     { name: 'Bulwark', trait: 'A plated brute of compressed night. If it reaches the star it tears out two handfuls of light.', color: 0xff5c5c, dark: 0xb02020, radius: 18, speed: 30, hp: 260, gold: 16, lives: 2, score: 25, debut: 8 },
  boss:     { name: 'Dreadnought', trait: 'A void dreadnought — a fortress of dark come to swallow the star whole.', color: 0xff2e6d, dark: 0xa01048, radius: 30, speed: 24, hp: 2600, gold: 250, lives: 5, score: 500, debut: 10 },
  mender:   { name: 'Mender', trait: 'It knits the void back together — constructs heal in its shadow.', color: 0x7dffce, dark: 0x12805c, radius: 14, speed: 44, hp: 120, regen: 0.03, mend: 7, gold: 14, lives: 1, score: 20, debut: 13 },
  lancer:   { name: 'Lancer', trait: 'An elite splinter of the dark, faster than the light it hunts.', color: 0x6fe8ff, dark: 0x1070a0, radius: 11, speed: 118, hp: 85, gold: 11, lives: 1, score: 18, debut: 17 },
  aegis:    { name: 'Aegis', trait: 'Plate forged from a dead star — every hit lands 6 weaker.', color: 0xc9b8ff, dark: 0x6a54c0, radius: 15, speed: 38, hp: 210, armour: 6, gold: 15, lives: 1, score: 22, debut: 24 },
  lancerprime: { name: 'Lancer Prime', trait: 'The void\'s chosen blade: shielded, faster, and utterly light-hungry.', color: 0x9ff3ff, dark: 0x1090a8, radius: 12, speed: 128, hp: 150, shield: 60, gold: 16, lives: 1, score: 26, debut: 34 },
  tankprime:   { name: 'Bulwark Prime', trait: 'A walking eclipse in fortress plate — hits land 8 weaker on it.', color: 0xff8a7a, dark: 0xb03a20, radius: 20, speed: 27, hp: 520, armour: 8, gold: 24, lives: 2, score: 34, debut: 42 },
};

// Stage-clear reward pool: between assaults the forge refines what the
// star sheds, and the player picks 1 of 3 gifts. Effects are data —
// main.js applies them through applyReward().
export const REWARDS = [
  { key: 'salvage', name: 'Star Shards', desc: (s) => `The star sheds shards — gather +${60 + s * 8}⛃`, icon: '⛃' },
  { key: 'reinforce', name: 'Solar Blessing', desc: () => 'The star\'s light is restored: +2 starlight', icon: '☀' },
  { key: 'surge', name: 'Flare Charge', desc: () => 'Banked flare: STARFALL charge +50%', icon: '★' },
  { key: 'interest', name: 'Shedlight Tithe', desc: (s, g) => `Shed light gathers more: +12% of your ${g}⛃ (min 15)`, icon: '%' },
  { key: 'overclock', name: 'Forge Tempering', desc: (s, g, t) => `Temper the ${t} line in star-fire: +10% damage, forever`, icon: '⚒' },
  { key: 'longbarrel', name: 'Star-Forged Barrels', desc: (s, g, t) => `${t} towers reach further: +10% range, forever`, icon: '◎' },
  { key: 'discount', name: 'Forge Master\'s Mark', desc: () => 'The next forging (upgrade or specialization) costs half', icon: '✦' },
  { key: 'freeupgrade', name: 'Gift of the Forge', desc: () => 'The forge raises a random tower one tier, free', icon: '⬆' },
  { key: 'cycling', name: 'Bellows Rhythm', desc: () => 'The bellows quicken: all towers +8% fire rate, forever', icon: '↻' },
];

// The fiction, in brief DOM text. Lives are the star's remaining light:
// the HUD shows them as starlight integrity, and a leak tears light out.
export const STORY = {
  premise: [
    'The Starforge burns around a captured living star.',
    'Its light runs molten down the conduit — and the void rides',
    'that light home, construct after construct, to drink it dry.',
    'You are the Forge Warden. Build the defences. Nothing reaches the star.',
  ],
  bands: {
    1: 'First shadows on the conduit — the void has found the star\'s light.',
    11: 'The void has tasted starlight — it comes back hungrier.',
    21: 'Deeper dark rides the conduit now. The star burns defiant.',
    31: 'The void sends its elites. It wants this light ended.',
    41: 'The last dark gathers. The star\'s heart is the prize.',
  },
  bossWarning: 'A void dreadnought rides the conduit — it comes to swallow the star whole.',
  finalBoss: 'THE STAR-EATER — the void\'s greatest dreadnought comes for the star\'s heart.',
  starfall: 'STARFALL — the star itself answers: it tears out a fragment of its own fire and hurls it down the conduit.',
  victoryTitle: 'THE FORGE HOLDS',
  victoryText: 'The assault breaks against the conduit. The star burns on — and every light in the dark knows: this one is guarded.',
  defeatTitle: 'THE STAR GOES DARK',
  defeatText: 'The last light is torn out. The forge is cold, the conduit black. The void is fed.',
};

export const ECONOMY = {
  startGold: 220,
  startLives: 20,
  maxLives: 40,
  waveClearBase: 25,
  waveClearPerWave: 5,
  callEarlyPerSecond: 2,
  callEarlyMax: 20,
  interWaveSeconds: 14,
  sellRefund: 0.7,
  maxStage: 50,
  bossStages: [10, 20, 30, 40, 50],
};

// Boss strength per boss stage (the stage-50 Dreadnought is the finale).
export function bossHpMul(stage) {
  if (stage >= 50) return 5.5;
  if (stage >= 40) return 4.2;
  if (stage >= 30) return 3.0;
  if (stage >= 20) return 2.0;
  return 1.0;
}
