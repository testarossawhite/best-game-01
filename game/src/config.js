// STARFORGE DEFENSE — shared constants: canvas size, palette, layout,
// tower definitions, enemy definitions and economy tuning.
// One job only: hold the numbers every other module reads.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const HUD_H = 56; // top bar height
export const SHOP_H = 96; // bottom tower-shop bar height
export const FIELD_TOP = HUD_H;
export const FIELD_BOTTOM = VIEW_H - SHOP_H;

// Dark premium palette: deep space, gunmetal deck, molten amber light.
// The forge's captured star is the light source; almost everything emissive
// is amber/orange, with cyan/violet reserved for tower-type accents.
export const PALETTE = {
  spaceTop: '#05060f',
  spaceBottom: '#0d0a1e',
  deck: '#232936',
  deckDark: '#171b26',
  deckLine: '#313a4f',
  conduit: '#ff9e2c',
  conduitHot: '#ffd166',
  plot: '#1a2030',
  plotEdge: '#4dd8ff',
  core: '#ffb35c',
  coreGlow: '#ff7b00',
  hudBg: 'rgba(8,10,18,0.88)',
  hudText: '#eef2ff',
  hudAccent: '#ffb35c',
  shopBg: 'rgba(10,12,22,0.92)',
  cardBg: '#171c2a',
  cardEdge: '#3a4a6b',
  danger: '#ff4d6d',
  gold: '#ffd166',
};

// The Starforge core the player defends.
export const CORE = { x: 1196, y: 300, r: 30 };

// The winding road the enemies march along (canvas coordinates).
export const PATH_POINTS = [
  { x: -40, y: 170 },
  { x: 210, y: 170 },
  { x: 210, y: 430 },
  { x: 500, y: 430 },
  { x: 500, y: 150 },
  { x: 800, y: 150 },
  { x: 800, y: 470 },
  { x: 1060, y: 470 },
  { x: 1060, y: 300 },
  { x: CORE.x - CORE.r - 6, y: 300 },
];

// Marked build plots: circles the player can build towers on.
export const PLOTS = [
  { x: 120, y: 270, r: 26 },
  { x: 300, y: 90, r: 26 },
  { x: 300, y: 260, r: 26 },
  { x: 300, y: 520, r: 26 },
  { x: 410, y: 340, r: 26 },
  { x: 410, y: 540, r: 26 },
  { x: 590, y: 240, r: 26 },
  { x: 590, y: 520, r: 26 },
  { x: 700, y: 90, r: 26 },
  { x: 700, y: 260, r: 26 },
  { x: 890, y: 240, r: 26 },
  { x: 890, y: 380, r: 26 },
  { x: 890, y: 560, r: 26 },
  { x: 970, y: 90, r: 26 },
  { x: 1150, y: 400, r: 26 },
  { x: 1150, y: 170, r: 26 },
];

// Decorative deck machinery (starforge dressing): fixed spots chosen to
// sit clear of the conduit and the docking pads. Render-only; no game effect.
export const PROPS = [
  { kind: 'sensor', x: 92, y: 96 },
  { kind: 'pods', x: 648, y: 378 },
  { kind: 'cells', x: 150, y: 566 },
  { kind: 'beacon', x: 1136, y: 104 },
  { kind: 'drums', x: 424, y: 92 },
  { kind: 'pods', x: 986, y: 548 },
];

// Tower catalogue. levels[i] is the stat block at upgrade level i (0-based).
// cost is the build cost for level 0 / the upgrade price for later levels.
// specs are the two level-3 specializations: at max level the player picks
// ONE. mods override level-3 stats; a key ending in "Mul" multiplies the
// stat of the same name instead (rateMul 1.9 = 90% faster fire rate).
export const TOWER_TYPES = {
  bolt: {
    key: 'bolt',
    name: 'Bolt Turret',
    short: 'BOLT',
    hotkey: '1',
    color: '#4361ee',
    dark: '#2b3a8f',
    desc: 'Fast single shots',
    levels: [
      { cost: 50, damage: 12, range: 115, rate: 2.4, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 45, damage: 20, range: 125, rate: 2.8, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 95, damage: 36, range: 140, rate: 3.4, splash: 0, chain: 0, slowPct: 0, slowSecs: 0 },
    ],
  },
  frost: {
    key: 'frost',
    name: 'Frost Spire',
    short: 'FROST',
    hotkey: '2',
    color: '#48cae4',
    dark: '#1d7fa8',
    desc: 'Slows enemies',
    levels: [
      { cost: 70, damage: 5, range: 105, rate: 1.1, splash: 0, chain: 0, slowPct: 0.45, slowSecs: 1.6 },
      { cost: 60, damage: 9, range: 115, rate: 1.2, splash: 0, chain: 0, slowPct: 0.55, slowSecs: 1.8 },
      { cost: 115, damage: 16, range: 130, rate: 1.4, splash: 55, chain: 0, slowPct: 0.65, slowSecs: 2.2 },
    ],
  },
  mortar: {
    key: 'mortar',
    name: 'Mortar',
    short: 'MORTAR',
    hotkey: '3',
    color: '#f4845f',
    dark: '#9c4a2f',
    desc: 'Splash damage',
    levels: [
      { cost: 100, damage: 34, range: 165, rate: 0.55, splash: 62, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 90, damage: 58, range: 175, rate: 0.6, splash: 78, chain: 0, slowPct: 0, slowSecs: 0 },
      { cost: 165, damage: 100, range: 190, rate: 0.7, splash: 100, chain: 0, slowPct: 0, slowSecs: 0 },
    ],
  },
  tesla: {
    key: 'tesla',
    name: 'Tesla Coil',
    short: 'TESLA',
    hotkey: '4',
    color: '#9b5de5',
    dark: '#5a2d91',
    desc: 'Chain lightning',
    levels: [
      { cost: 130, damage: 17, range: 135, rate: 0.85, splash: 0, chain: 3, slowPct: 0, slowSecs: 0 },
      { cost: 110, damage: 28, range: 145, rate: 0.9, splash: 0, chain: 4, slowPct: 0, slowSecs: 0 },
      { cost: 210, damage: 46, range: 160, rate: 1.0, splash: 0, chain: 6, slowPct: 0, slowSecs: 0 },
    ],
  },
};

export const TOWER_ORDER = ['bolt', 'frost', 'mortar', 'tesla'];

// Level-3 specializations: at max level the player picks ONE of two
// branches per tower. mods override the level-3 stat block; a key ending
// in "Mul" multiplies that stat instead. Extra fields the base stats do
// not carry (pierce, cluster, burnDps, chainJump) default in towers.js.
export const TOWER_SPECS = {
  bolt: [
    { key: 'rail', name: 'Railgun', desc: 'Piercing line shots, heavy damage', cost: 120, mods: { damage: 58, rate: 1.5, range: 155, pierce: true } },
    { key: 'dual', name: 'Dual Bolt', desc: 'Twin barrels: +90% fire rate', cost: 110, mods: { damage: 30, rateMul: 1.9 } },
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

// Enemy catalogue. hp scales with the wave (see enemies.js).
export const ENEMY_TYPES = {
  runner: { name: 'Runner', color: '#fb8500', dark: '#9c5200', radius: 11, speed: 78, hp: 34, gold: 6, lives: 1, score: 10 },
  grunt: { name: 'Grunt', color: '#70e000', dark: '#3f7d00', radius: 13, speed: 48, hp: 70, gold: 8, lives: 1, score: 10 },
  swarm: { name: 'Swarmling', color: '#ffd60a', dark: '#a67c00', radius: 8, speed: 92, hp: 16, gold: 3, lives: 1, score: 5 },
  shielded: { name: 'Shielded', color: '#b5179e', dark: '#6d0a5e', radius: 14, speed: 42, hp: 95, shield: 70, gold: 13, lives: 1, score: 20 },
  tank: { name: 'Tank', color: '#d90429', dark: '#7f0218', radius: 18, speed: 30, hp: 260, gold: 16, lives: 2, score: 25 },
  splitter: { name: 'Splitter', color: '#06d6a0', dark: '#04503c', radius: 15, speed: 40, hp: 130, gold: 10, lives: 1, score: 15 },
  mite: { name: 'Mite', color: '#95d5b2', dark: '#2d6a4f', radius: 7, speed: 108, hp: 12, gold: 2, lives: 1, score: 3 },
  boss: { name: 'Starforge Boss', color: '#ff0a54', dark: '#7a0030', radius: 30, speed: 24, hp: 2600, gold: 250, lives: 5, score: 500 },
};

export const ECONOMY = {
  startGold: 220,
  startLives: 20,
  waveClearBase: 25,
  waveClearPerWave: 5,
  callEarlyPerSecond: 2,
  callEarlyMax: 20,
  interWaveSeconds: 14,
  sellRefund: 0.7,
  maxWave: 20,
};

export const SHOP_CARD_W = 148;
export const SHOP_CARD_H = 76;
export const SHOP_GAP = 12;
