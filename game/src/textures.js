// STARFORGE DEFENSE — pre-rendered textures. The rich static art (nebula,
// plated deck, conduit channel, docking pads, grain, vignette) is painted
// ONCE into offscreen canvases at load, so the per-frame cost stays tiny
// and the field can afford layered gradients everywhere. A small LCG keeps
// every star and scratch deterministic — same forge on every load.
import { VIEW_W, VIEW_H, HUD_H, SHOP_H, PATH_POINTS, PLOTS } from './config.js';

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Soft radial glow dot, tinted per colour and cached — the building block
// for coronas, emissive lights, explosions and muzzle glows.
const glowCache = new Map();
export function glowSprite(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

export function drawGlow(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  const s = glowSprite(color);
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

let bgCache = null;

// The full static scene behind the action: space, nebula, starfield, the
// metal deck with its seams and wear, the molten conduit channel and the
// lit docking pads.
export function background() {
  if (bgCache) return bgCache;
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const rnd = lcg(1337);

  // --- deep space + nebula ---
  const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#04050d');
  sky.addColorStop(0.55, '#0a0819');
  sky.addColorStop(1, '#120a24');
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const nebulae = [
    [180, 90, 340, 'rgba(88,40,160,0.20)'],
    [1120, 640, 380, 'rgba(160,60,20,0.16)'],
    [700, 60, 260, 'rgba(20,90,140,0.14)'],
    [300, 660, 300, 'rgba(30,40,140,0.15)'],
    [1240, 120, 220, 'rgba(200,90,30,0.12)'],
  ];
  for (const [x, y, r, col] of nebulae) {
    const ng = g.createRadialGradient(x, y, 10, x, y, r);
    ng.addColorStop(0, col);
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ng;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Milky-way band: a soft diagonal river of light across the whole sky,
  // visible in the space frame around the deck and through the HUD glass.
  g.save();
  g.translate(VIEW_W / 2, VIEW_H / 2);
  g.rotate(-0.42);
  const mw = g.createLinearGradient(0, -150, 0, 150);
  mw.addColorStop(0, 'rgba(160,180,255,0)');
  mw.addColorStop(0.5, 'rgba(170,190,255,0.13)');
  mw.addColorStop(1, 'rgba(160,180,255,0)');
  g.fillStyle = mw;
  g.fillRect(-900, -150, 1800, 300);
  for (let i = 0; i < 700; i++) {
    const x = (rnd() - 0.5) * 1700;
    const y = (rnd() - 0.5) * 260 * (0.4 + rnd() * 0.6);
    g.fillStyle = `rgba(255,255,255,${(0.15 + rnd() * 0.5).toFixed(2)})`;
    g.fillRect(x, y, 1.3, 1.3);
  }
  g.restore();
  // Starfield: dense everywhere — hundreds of stars, varied size and
  // brightness, a few heroes with cross sparkles. Stars over the deck are
  // dimmer (they will sit behind plating), the frame blazes.
  for (let i = 0; i < 950; i++) {
    const x = rnd() * VIEW_W;
    const y = rnd() * VIEW_H;
    const onDeck = y > HUD_H && y < VIEW_H - SHOP_H;
    const edge = Math.min(x, VIEW_W - x, y, VIEW_H - y) < 130;
    const a = onDeck && !edge ? 0.25 + rnd() * 0.3 : 0.55 + rnd() * 0.45;
    const r = rnd() < 0.06 ? 2 : rnd() < 0.3 ? 1.4 : 1;
    g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Bright sparkle stars: a cross flare through a hot core.
  for (let i = 0; i < 16; i++) {
    const x = 30 + rnd() * (VIEW_W - 60);
    const y = 26 + rnd() * (VIEW_H - 52);
    const L = 9 + rnd() * 13;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x - L, y);
    g.lineTo(x + L, y);
    g.moveTo(x, y - L);
    g.lineTo(x, y + L);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x, y, 2, 0, Math.PI * 2);
    g.fill();
  }

  // --- the metal deck: an inset plate floating in space, rim-lit ---
  const deckY = HUD_H + 6;
  const deckH = VIEW_H - HUD_H - SHOP_H - 12;
  g.save();
  g.beginPath();
  g.rect(8, deckY, VIEW_W - 16, deckH);
  g.clip();
  const deckGrad = g.createLinearGradient(0, deckY, 0, deckY + deckH);
  deckGrad.addColorStop(0, '#262d3f');
  deckGrad.addColorStop(0.5, '#1d2331');
  deckGrad.addColorStop(1, '#161a26');
  g.fillStyle = deckGrad;
  g.fillRect(0, deckY, VIEW_W, deckH);
  // Brushed plating: large panels with seams, rivets and per-panel tint.
  const panel = 106;
  for (let px = 0; px < VIEW_W / panel; px++) {
    for (let py = 0; py < deckH / panel; py++) {
      const x = px * panel;
      const y = deckY + py * panel;
      const tint = (rnd() - 0.5) * 0.05;
      g.fillStyle = tint > 0 ? `rgba(255,255,255,${tint.toFixed(3)})` : `rgba(0,0,0,${(-tint).toFixed(3)})`;
      g.fillRect(x + 1, y + 1, panel - 2, panel - 2);
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, panel - 2, panel - 2);
      g.strokeStyle = 'rgba(140,170,220,0.10)';
      g.lineWidth = 1;
      g.strokeRect(x + 2.5, y + 2.5, panel - 5, panel - 5);
      // Rivets at panel corners.
      g.fillStyle = 'rgba(160,180,210,0.5)';
      for (const [rx, ry] of [[8, 8], [panel - 8, 8], [8, panel - 8], [panel - 8, panel - 8]]) {
        g.beginPath();
        g.arc(x + rx, y + ry, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // Wear: scratches and scuffs.
  g.lineWidth = 1;
  for (let i = 0; i < 46; i++) {
    const x = rnd() * VIEW_W;
    const y = deckY + rnd() * deckH;
    const len = 12 + rnd() * 46;
    const a = rnd() * Math.PI;
    g.strokeStyle = `rgba(200,215,240,${(0.03 + rnd() * 0.06).toFixed(2)})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // Warm light wash spilling from the core side of the deck.
  const wash = g.createRadialGradient(1196, 300, 60, 1196, 300, 620);
  wash.addColorStop(0, 'rgba(255,140,40,0.20)');
  wash.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = wash;
  g.fillRect(0, deckY, VIEW_W, deckH);
  g.restore();
  // Deck rim: a bright top edge and a deep shadow edge, so the plate reads
  // as a physical slab floating in the starfield.
  g.strokeStyle = 'rgba(150,180,230,0.35)';
  g.lineWidth = 2;
  g.strokeRect(8, deckY, VIEW_W - 16, deckH);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 5;
  g.strokeRect(5, deckY - 3, VIEW_W - 10, deckH + 6);

  // --- the molten conduit channel (the path) ---
  const tracePath = (ctx2) => {
    ctx2.beginPath();
    ctx2.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (const p of PATH_POINTS.slice(1)) ctx2.lineTo(p.x, p.y);
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Outer glow, channel walls, molten fill, hot centre line.
  g.strokeStyle = 'rgba(255,110,0,0.20)';
  g.lineWidth = 58;
  tracePath(g);
  g.stroke();
  g.strokeStyle = '#0c0906';
  g.lineWidth = 46;
  tracePath(g);
  g.stroke();
  g.strokeStyle = 'rgba(255,190,90,0.28)';
  g.lineWidth = 42;
  tracePath(g);
  g.stroke();
  const molten = g.createLinearGradient(0, 0, VIEW_W, 0);
  molten.addColorStop(0, '#c1440e');
  molten.addColorStop(0.45, '#f76707');
  molten.addColorStop(0.8, '#ff9e2c');
  molten.addColorStop(1, '#ffc94d');
  g.strokeStyle = molten;
  g.lineWidth = 32;
  tracePath(g);
  g.stroke();
  g.strokeStyle = 'rgba(255,236,180,0.75)';
  g.lineWidth = 9;
  tracePath(g);
  g.stroke();
  // Channel wall rivets / clamps along both edges.
  g.fillStyle = 'rgba(190,205,230,0.55)';
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.floor(len / 52);
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    for (let sIdx = 0; sIdx <= steps; sIdx++) {
      const t = steps === 0 ? 0 : sIdx / steps;
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(cx + nx * 25 * side, cy + ny * 25 * side, 2.4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // --- docking pads (build plots) ---
  for (const p of PLOTS) {
    const pg = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r + 8);
    pg.addColorStop(0, '#232c42');
    pg.addColorStop(0.8, '#141926');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(120,200,255,0.85)';
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(120,200,255,0.35)';
    g.beginPath();
    g.arc(p.x, p.y, p.r - 6, 0, Math.PI * 2);
    g.stroke();
    // Pad cross + bolts.
    g.strokeStyle = 'rgba(160,200,240,0.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(p.x - 7, p.y);
    g.lineTo(p.x + 7, p.y);
    g.moveTo(p.x, p.y - 7);
    g.lineTo(p.x, p.y + 7);
    g.stroke();
  }

  bgCache = c;
  return c;
}

// The captured star's surface: a granulated fireball texture — layered
// radial heat (white-hot heart, amber body, deep-orange rim) churned with
// thousands of bright and dark granules, like solar granulation. The
// renderer rotates it slowly inside the core's circular clip.
let starCache = null;
export function starSurface() {
  if (starCache) return starCache;
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const rnd = lcg(9001);
  const base = g.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
  base.addColorStop(0, '#fffbe8');
  base.addColorStop(0.35, '#ffe9a3');
  base.addColorStop(0.62, '#ffb35c');
  base.addColorStop(0.85, '#ff7b00');
  base.addColorStop(1, '#d9480f');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // Granulation: bright cells and dark lanes, denser toward the rim.
  for (let i = 0; i < 5200; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * S * 0.48;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const r = 0.8 + rnd() * 2.6;
    const bright = rnd() < 0.55;
    g.fillStyle = bright
      ? `rgba(255,246,200,${(0.05 + rnd() * 0.16).toFixed(2)})`
      : `rgba(160,50,0,${(0.05 + rnd() * 0.15).toFixed(2)})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // A few large hot spots / cooler patches for slow-rotating features.
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * S * 0.3;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const r = 14 + rnd() * 26;
    const hot = rnd() < 0.6;
    const fg = g.createRadialGradient(x, y, 2, x, y, r);
    fg.addColorStop(0, hot ? 'rgba(255,252,225,0.5)' : 'rgba(190,60,0,0.35)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  starCache = c;
  return c;
}

// A transparent overlay of extra stars living ONLY in the space frame
// around the deck (and over the HUD/shop glass). The renderer pulses its
// alpha so the frame twinkles while the deck stays solid.
let frameCache = null;
export function starFrame() {
  if (frameCache) return frameCache;
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const rnd = lcg(777);
  const deckTop = HUD_H + 6;
  const deckBottom = VIEW_H - SHOP_H - 6;
  for (let i = 0; i < 260; i++) {
    let x = rnd() * VIEW_W;
    let y = rnd() * VIEW_H;
    // Keep frame stars out of the deck's interior.
    if (y > deckTop + 4 && y < deckBottom - 4 && x > 12 && x < VIEW_W - 12) {
      y = rnd() < 0.5 ? rnd() * deckTop : deckBottom + rnd() * (VIEW_H - deckBottom);
    }
    const r = rnd() < 0.12 ? 2 : 1.2;
    g.fillStyle = `rgba(255,255,255,${(0.5 + rnd() * 0.5).toFixed(2)})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (rnd() < 0.1) {
      const L = 7 + rnd() * 8;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x - L, y);
      g.lineTo(x + L, y);
      g.moveTo(x, y - L);
      g.lineTo(x, y + L);
      g.stroke();
    }
  }
  frameCache = c;
  return c;
}

let grainCache = null;
export function grainTile() {
  if (grainCache) return grainCache;
  // Generated small and upscaled with smoothing: soft mottling instead of
  // per-pixel static — kinder to the eye and to PNG compression alike.
  const small = makeCanvas(48, 48);
  const sg = small.getContext('2d');
  const img = sg.createImageData(48, 48);
  const rnd = lcg(4242);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 108 + Math.floor(rnd() * 40);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 16;
  }
  sg.putImageData(img, 0, 0);
  const c = makeCanvas(192, 192);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(small, 0, 0, 192, 192);
  grainCache = c;
  return c;
}

let vigCache = null;
export function vignette() {
  if (vigCache) return vigCache;
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.52)');
  g.fillStyle = grad;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  vigCache = c;
  return c;
}
