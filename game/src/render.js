// STARFORGE DEFENSE — rendering: a forge built around a captured star.
// Deep-space starfield, a plated metal deck, a molten conduit, towers of
// shaded forge-tech lit by their own emissives, void-construct enemies,
// and at the end of the conduit the hero of every frame: the star itself,
// granulated, crowned with corona rays and arcing prominences.
// Static richness is pre-rendered in textures.js; this file draws the
// living light on top.
import {
  VIEW_W, VIEW_H, HUD_H, SHOP_H, PALETTE, CORE, PLOTS, PROPS, TOWER_TYPES,
  TOWER_SPECS, TOWER_ORDER, ENEMY_TYPES, ECONOMY, SHOP_CARD_W, SHOP_CARD_H, SHOP_GAP,
} from './config.js';
import { PATH_LENGTH, pathPointAt } from './map.js';
import { effectiveStats, upgradeCost, sellValue, specOptions } from './towers.js';
import { wavePreview, waveClearBonus } from './waves.js';
import { shakeOffset } from './particles.js';
import { background, starFrame, starSurface, drawGlow, grainTile, vignette } from './textures.js';

// --- shared button layout (ui.js hit-tests these same rects) ---
export function shopCardRect(i) {
  return {
    x: 16 + i * (SHOP_CARD_W + SHOP_GAP),
    y: VIEW_H - SHOP_H + 10,
    w: SHOP_CARD_W,
    h: SHOP_CARD_H,
  };
}

export function hudButtons(state) {
  const btns = {};
  const y = 10;
  const h = 36;
  btns.start = { x: 640, y, w: 190, h };
  btns.pause = { x: 842, y, w: 84, h };
  btns.speed = { x: 938, y, w: 84, h };
  btns.sound = { x: 1034, y, w: 84, h };
  btns.help = { x: 1130, y, w: 134, h };
  return btns;
}

// Panel buttons depend on the selected tower: a max-level tower without a
// specialization offers two spec choices instead of the upgrade button.
export function panelButtons(tower) {
  if (tower && tower.level >= 2 && !tower.spec) {
    return {
      spec0: { x: 984, y: 304, w: 264, h: 54 },
      spec1: { x: 984, y: 366, w: 264, h: 54 },
      sell: { x: 984, y: 428, w: 264, h: 36 },
    };
  }
  return {
    upgrade: { x: 984, y: 268, w: 264, h: 40 },
    sell: { x: 984, y: 316, w: 264, h: 40 },
  };
}

export function centerButton() {
  return { x: VIEW_W / 2 - 150, y: 500, w: 300, h: 56 };
}

export function endButtons() {
  return {
    again: centerButton(),
    endless: { x: VIEW_W / 2 - 150, y: 568, w: 300, h: 48 },
  };
}

export function starfallRect() {
  return { x: 1064, y: VIEW_H - SHOP_H + 10, w: 200, h: 76 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 700} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function metalGrad(ctx, x, y0, y1, stops) {
  const g = ctx.createLinearGradient(x, y0, x, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

// ------------------------------------------------------------------
// THE STAR. Layered so a cropped screenshot still reads instantly as a
// star: corona rays, arcing prominences, a granulated rotating surface,
// a white-hot heart and a soft lens-flare cross.
// ------------------------------------------------------------------
export function drawStar(ctx, x, y, r, time, hero) {
  // Corona rays: long tapered blades of light, turning very slowly.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = hero ? 16 : 12;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + time * 0.03;
    const len = r * ((hero ? 1.95 : 1.55) + 0.3 * Math.sin(time * 0.7 + i * 1.93));
    const wdt = r * (i % 2 === 0 ? 0.16 : 0.09);
    const gx = x + Math.cos(a) * len;
    const gy = y + Math.sin(a) * len;
    const grad = ctx.createLinearGradient(x, y, gx, gy);
    grad.addColorStop(0, 'rgba(255,170,60,0.34)');
    grad.addColorStop(1, 'rgba(255,110,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - wdt) * r * 0.92, y + Math.sin(a - wdt) * r * 0.92);
    ctx.lineTo(gx, gy);
    ctx.lineTo(x + Math.cos(a + wdt) * r * 0.92, y + Math.sin(a + wdt) * r * 0.92);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Corona glow.
  drawGlow(ctx, x, y, r * (hero ? 3.1 : 2.6), '#ff8c1a', 0.5 + 0.07 * Math.sin(time * 2.1));
  // Solar prominences: bright arcs leaping off the limb and falling back.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const proms = hero ? 7 : 5;
  for (let i = 0; i < proms; i++) {
    const a0 = i * 1.13 + 0.7 + time * 0.045 + Math.sin(time * 0.11 + i) * 0.14;
    const lift = 0.13 + 0.17 * (0.5 + 0.5 * Math.sin(time * 0.55 + i * 1.71));
    const sx = x + Math.cos(a0 - 0.34) * r;
    const sy = y + Math.sin(a0 - 0.34) * r;
    const ex = x + Math.cos(a0 + 0.34) * r;
    const ey = y + Math.sin(a0 + 0.34) * r;
    const cxp = x + Math.cos(a0) * r * (1 + lift * 2.1);
    const cyp = y + Math.sin(a0) * r * (1 + lift * 2.1);
    ctx.strokeStyle = 'rgba(255,110,20,0.55)';
    ctx.lineWidth = r * 0.075;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cxp, cyp, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,120,0.8)';
    ctx.lineWidth = r * 0.032;
    ctx.stroke();
  }
  ctx.restore();
  // Granulated body: the pre-rendered surface, slowly rotating.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(time * 0.02);
  const surf = starSurface();
  ctx.drawImage(surf, -r, -r, r * 2, r * 2);
  ctx.restore();
  // Limb darkening + hot heart.
  const limb = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(150,35,0,0.38)');
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, x - r * 0.14, y - r * 0.14, r * 0.52, '#fff3b0', 0.62);
  // Lens-flare cross.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fh = ctx.createLinearGradient(x - r * 2.3, y, x + r * 2.3, y);
  fh.addColorStop(0, 'rgba(255,240,200,0)');
  fh.addColorStop(0.5, 'rgba(255,240,200,0.4)');
  fh.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = fh;
  ctx.fillRect(x - r * 2.3, y - r * 0.035, r * 4.6, r * 0.07);
  const fv = ctx.createLinearGradient(x, y - r * 1.5, x, y + r * 1.5);
  fv.addColorStop(0, 'rgba(255,240,200,0)');
  fv.addColorStop(0.5, 'rgba(255,240,200,0.28)');
  fv.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = fv;
  ctx.fillRect(x - r * 0.03, y - r * 1.5, r * 0.06, r * 3);
  ctx.restore();
  // Heat shimmer rings rising off the surface.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    const ph = (time * 0.22 + k * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,170,80,${((1 - ph) * 0.26).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.06 + ph * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Floating embers spiralling off the star.
  for (let i = 0; i < 22; i++) {
    const ang = i * 2.399 + time * 0.05;
    const rise = (time * 0.1 * (1 + (i % 5) * 0.16) + i * 0.618) % 1;
    const rad = r * (1.04 + rise * 0.55);
    const ex = x + Math.cos(ang + rise * 2.4) * rad;
    const ey = y + Math.sin(ang) * rad * 0.92 - rise * r * 0.65;
    ctx.fillStyle = `rgba(255,207,125,${((1 - rise) * 0.85).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.4 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The forge core: the star, held in a containment ring of dark metal.
function drawCore(ctx, state) {
  const pulse = 1 + Math.sin(state.time * 2.2) * 0.045;
  const r = CORE.r * pulse;
  // Light cast across the deck.
  drawGlow(ctx, CORE.x, CORE.y, 190, '#ff8c1a', 0.30);
  drawStar(ctx, CORE.x, CORE.y, r, state.time, false);
  // Containment ring: the forge's grip on its star.
  ctx.strokeStyle = metalGrad(ctx, CORE.x, CORE.y - r - 12, CORE.y + r + 12, [[0, '#4a5878'], [0.5, '#232b40'], [1, '#10141f']]);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, r + 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#39466a';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const cx = CORE.x + Math.cos(a) * (r + 11);
    const cy = CORE.y + Math.sin(a) * (r + 11);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillRect(-5, -8, 10, 16);
    ctx.restore();
    drawGlow(ctx, cx, cy, 9, '#ffb35c', 0.5);
  }
  text(ctx, '★ STARFORGE CORE', CORE.x, CORE.y + r + 26, 12, '#ffcf7d', 800, 'center');
}

// ------------------------------------------------------------------
// Field: pre-rendered deck + living light (twinkle, conduit flow, props)
// ------------------------------------------------------------------
function drawField(ctx, state) {
  ctx.drawImage(background(), 0, 0);
  // Twinkling frame stars over the space margins and HUD glass.
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 1.7);
  ctx.drawImage(starFrame(), 0, 0);
  ctx.restore();
  // Energy pulses flowing along the molten conduit toward the core.
  for (let k = 0; k < 7; k++) {
    const d = (state.time * 150 + (k * PATH_LENGTH) / 7) % PATH_LENGTH;
    const p = pathPointAt(d);
    drawGlow(ctx, p.x, p.y, 17, '#ffcf7d', 0.5);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  drawProps(ctx, state);
  // Starlight power feeds: pulsing beams from the core to every tower —
  // the towers quite literally run on starlight.
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    const a = 0.10 + 0.05 * Math.sin(state.time * 2.4 + i * 1.3);
    ctx.strokeStyle = `rgba(255,180,80,${a.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CORE.x - CORE.r - 8, CORE.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    const ph = (state.time * 0.55 + i * 0.37) % 1;
    const px = CORE.x - CORE.r - 8 + (t.x - (CORE.x - CORE.r - 8)) * ph;
    const py = CORE.y + (t.y - CORE.y) * ph;
    drawGlow(ctx, px, py, 10, '#ffcf7d', 0.65);
  }
  drawCore(ctx, state);
}

function drawProps(ctx, state) {
  for (const p of PROPS) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 14, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'sensor') {
      ctx.fillStyle = metalGrad(ctx, p.x, p.y - 26, p.y + 14, [[0, '#4a5878'], [1, '#171d2c']]);
      ctx.fillRect(p.x - 3, p.y - 26, 6, 40);
      ctx.fillRect(p.x - 14, p.y - 20, 28, 4);
      ctx.beginPath();
      ctx.arc(p.x + 12, p.y - 26, 8, -0.9, 1.5);
      ctx.strokeStyle = '#8fa8d8';
      ctx.lineWidth = 3;
      ctx.stroke();
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 2.4));
      drawGlow(ctx, p.x - 14, p.y - 20, 8, '#4dd8ff', blink);
    } else if (p.kind === 'pods') {
      const cols = ['#2c3a5e', '#374a75'];
      for (let i = 0; i < 2; i++) {
        const px = p.x - 16 + i * 20;
        const py = p.y - 6 + (i % 2) * 8;
        ctx.fillStyle = metalGrad(ctx, px, py - 12, py + 12, [[0, cols[i]], [1, '#12172a']]);
        roundRect(ctx, px - 11, py - 12, 22, 24, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,220,255,0.75)';
        ctx.fillRect(px - 11, py - 2, 22, 3);
      }
    } else if (p.kind === 'cells') {
      for (let i = 0; i < 3; i++) {
        const px = p.x - 18 + i * 18;
        ctx.fillStyle = metalGrad(ctx, px, p.y - 16, p.y + 14, [[0, '#5e4632'], [1, '#241a10']]);
        roundRect(ctx, px - 7, p.y - 16, 14, 30, 6);
        ctx.fill();
        drawGlow(ctx, px, p.y - 2, 7, '#ffb35c', 0.55 + 0.2 * Math.sin(state.time * 3 + i));
      }
    } else if (p.kind === 'beacon') {
      ctx.save();
      ctx.translate(p.x, p.y - 12);
      ctx.rotate(state.time * 0.8);
      const beam = ctx.createLinearGradient(0, 0, 44, 0);
      beam.addColorStop(0, 'rgba(255,190,90,0.4)');
      beam.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(44, -8);
      ctx.lineTo(44, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = metalGrad(ctx, p.x, p.y - 14, p.y + 14, [[0, '#4a5878'], [1, '#171d2c']]);
      ctx.fillRect(p.x - 2.5, p.y - 12, 5, 26);
      drawGlow(ctx, p.x, p.y - 14, 10, '#ffd166', 0.8);
    } else {
      // drums: three coolant barrels with hazard bands.
      for (let i = 0; i < 3; i++) {
        const px = p.x - 18 + i * 18;
        ctx.fillStyle = metalGrad(ctx, px, p.y - 12, p.y + 13, [[0, '#54606e'], [1, '#232a33']]);
        roundRect(ctx, px - 8, p.y - 12, 16, 25, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,180,60,0.8)';
        ctx.fillRect(px - 8, p.y - 3, 16, 4);
      }
    }
  }
}

// ------------------------------------------------------------------
// Towers: forge-tech machinery — shaded metal, emissive accents, and
// visible growth per level and specialization.
// ------------------------------------------------------------------
const SPEC_RING = {
  rail: '#7df9ff', dual: '#7df9ff', deepfreeze: '#dff6ff', shatter: '#aee9ff',
  cluster: '#ffb35c', napalm: '#ff7847', storm: '#c77dff', overcharge: '#e0aaff',
};

function drawTower(ctx, tower, time) {
  const def = TOWER_TYPES[tower.type];
  const stats = effectiveStats(tower);
  const { x, y } = tower;
  const L = tower.level;
  // Drop shadow + starlight feed glow.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y + 17, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, x, y, 34, '#ff9e2c', 0.10);
  // Base: layered metal plinth.
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fillStyle = metalGrad(ctx, x, y - 24, y + 24, [[0, '#46538a'], [0.55, '#232c47'], [1, '#10141f']]);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150,180,230,0.4)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = metalGrad(ctx, x, y - 18, y + 18, [[0, '#2e3a5c'], [1, '#151a2a']]);
  ctx.fill();
  if (tower.spec) {
    ctx.beginPath();
    ctx.arc(x, y, 21.5, 0, Math.PI * 2);
    ctx.strokeStyle = SPEC_RING[tower.spec] || '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, '★', x + 17, y - 17, 13, '#ffd166', 800, 'center');
  }
  const flashTip = (dist, r, color) => {
    if (tower.flash <= 0) return;
    const fx = x + Math.cos(tower.angle) * dist;
    const fy = y + Math.sin(tower.angle) * dist;
    drawGlow(ctx, fx, fy, r + 12, '#ffd166', 0.8);
    drawGlow(ctx, x, y, 52, '#ffb35c', 0.28);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  };

  if (tower.type === 'bolt') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tower.angle);
    const bodyGrad = metalGrad(ctx, 0, -10, 10, [[0, '#6f8dff'], [0.5, '#4361ee'], [1, '#1d2a6e']]);
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, -8, -9 - L, 22, 18 + L * 2, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-6, -8 - L, 18, 3);
    ctx.fillStyle = '#0d1020';
    if (tower.spec === 'rail') {
      ctx.fillRect(10, -2.5, 36, 5);
      ctx.fillStyle = '#7df9ff';
      for (let i = 0; i < 3; i++) ctx.fillRect(16 + i * 9, -5, 3.5, 10);
      ctx.fillRect(10, -1, 36, 2);
    } else if (tower.spec === 'dual' || L === 2) {
      ctx.fillRect(8, -8, 24, 5.5);
      ctx.fillRect(8, 2.5, 24, 5.5);
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(29, -8, 3, 5.5);
      ctx.fillRect(29, 2.5, 3, 5.5);
    } else if (L === 1) {
      ctx.fillRect(8, -3, 26, 6);
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(31, -3, 3, 6);
    } else {
      ctx.fillRect(8, -3, 20, 6);
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(25, -3, 3, 6);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, x, y - 8, y + 8, [[0, '#8fa8ff'], [1, '#2b3a8f']]);
    ctx.fill();
    drawGlow(ctx, x, y, 10, '#7df9ff', 0.55);
    flashTip(tower.spec === 'rail' ? 48 : 34, 7, '#7df9ff');
  } else if (tower.type === 'frost') {
    const h = 24 + L * 5 + (tower.spec === 'deepfreeze' ? 5 : 0);
    const crystal = (cx, cy, ch, cw, tint) => {
      const g = ctx.createLinearGradient(cx - cw, cy, cx + cw, cy);
      g.addColorStop(0, tint[0]);
      g.addColorStop(0.5, tint[1]);
      g.addColorStop(1, tint[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch);
      ctx.lineTo(cx + cw, cy + ch * 0.35);
      ctx.lineTo(cx + cw * 0.4, cy + ch * 0.8);
      ctx.lineTo(cx - cw * 0.4, cy + ch * 0.8);
      ctx.lineTo(cx - cw, cy + ch * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch);
      ctx.lineTo(cx, cy + ch * 0.7);
      ctx.stroke();
    };
    const tint = tower.spec === 'shatter' ? ['#ffffff', '#aee9ff', '#3d8bc2'] : ['#f4fdff', '#8fdcff', '#1d7fa8'];
    if (L >= 1) {
      crystal(x - 12, y + 4, h * 0.55, 6, tint);
      crystal(x + 12, y + 4, h * 0.55, 6, tint);
    }
    crystal(x, y, h, 9 + L * 1.5, tint);
    if (L === 2) {
      for (let i = 0; i < 2; i++) {
        const a = time * 0.9 + i * Math.PI;
        const sx = x + Math.cos(a) * 17;
        const sy = y - 8 + Math.sin(a) * 6;
        ctx.fillStyle = 'rgba(174,233,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 3, sy);
        ctx.lineTo(sx, sy + 5);
        ctx.lineTo(sx - 3, sy);
        ctx.closePath();
        ctx.fill();
      }
    }
    drawGlow(ctx, x, y - h * 0.5, 20 + L * 4, '#aee9ff', 0.4);
    if (tower.flash > 0) drawGlow(ctx, x, y - h, 22, '#dff6ff', 0.7);
  } else if (tower.type === 'mortar') {
    // Furnace dome with an emissive fire slit.
    ctx.beginPath();
    ctx.arc(x, y + 4, 14 + L * 1.5, Math.PI, 0);
    ctx.fillStyle = metalGrad(ctx, x, y - 16, y + 6, [[0, '#c96f4a'], [0.6, '#9c4a2f'], [1, '#571f0e']]);
    ctx.fill();
    ctx.fillStyle = '#ffb35c';
    ctx.fillRect(x - 9, y - 2, 18, 3.5);
    drawGlow(ctx, x, y - 1, 13, '#ff9e2c', 0.65);
    const tube = (tx, wdt, len) => {
      ctx.fillStyle = metalGrad(ctx, tx, y - len, y, [[0, '#3c4454'], [1, '#11141d']]);
      ctx.fillRect(tx - wdt / 2, y - len, wdt, len - 6);
      ctx.fillStyle = '#05070c';
      ctx.beginPath();
      ctx.arc(tx, y - len, wdt / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    if (tower.spec === 'cluster') {
      tube(x - 8, 6, 22);
      tube(x + 8, 6, 22);
      tube(x - 8, 6, 30);
      tube(x + 8, 6, 30);
    } else if (L === 2) {
      tube(x - 7, 8, 27);
      tube(x + 7, 8, 27);
    } else {
      tube(x, 8 + L * 2, 24 + L * 3);
    }
    if (tower.spec === 'napalm') {
      ctx.fillStyle = metalGrad(ctx, x + 14, y - 8, y + 10, [[0, '#8a4b2a'], [1, '#3a1c0c']]);
      roundRect(ctx, x + 11, y - 8, 9, 18, 3);
      ctx.fill();
      drawGlow(ctx, x + 15.5, y + 1, 8, '#ff7847', 0.7);
    }
    if (tower.flash > 0) {
      drawGlow(ctx, x, y - 30, 18, '#ffd166', 0.8);
      drawGlow(ctx, x, y, 52, '#ffb35c', 0.25);
    }
  } else {
    // Tesla: stacked metallic rings and a violet star-orb.
    ctx.fillStyle = metalGrad(ctx, x, y - 6, y + 12, [[0, '#5a4390'], [1, '#241239']]);
    ctx.fillRect(x - 3, y - 8, 6, 20);
    ctx.strokeStyle = '#8d6fd8';
    ctx.lineWidth = 3.5;
    const rings = 3 + L;
    for (let i = 0; i < rings; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y + 9 - i * 6.5, 13 - i * 1.6, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const orbR = (tower.spec === 'overcharge' ? 11 : 8) + (tower.arcTimer > 0 ? 3 : 0);
    const orbY = y - 16 - L * 2;
    drawGlow(ctx, x, orbY, orbR * 2.6, '#9b5de5', 0.65);
    ctx.beginPath();
    ctx.arc(x, orbY, orbR, 0, Math.PI * 2);
    ctx.fillStyle = tower.arcTimer > 0 ? '#ffffff' : '#e0aaff';
    ctx.fill();
    if (tower.spec === 'storm') {
      for (const sx of [-16, 16]) {
        ctx.strokeStyle = '#8d6fd8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x + sx, orbY + 6);
        ctx.stroke();
        drawGlow(ctx, x + sx, orbY + 6, 12, '#9b5de5', 0.55);
        ctx.beginPath();
        ctx.arc(x + sx, orbY + 6, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#e0aaff';
        ctx.fill();
      }
    }
  }
  // Level pips: emissive studs under the base.
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x - 12 + i * 12, y + 27, 4, 0, Math.PI * 2);
    ctx.fillStyle = i <= tower.level ? PALETTE.gold : 'rgba(120,135,170,0.5)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#0a0d18';
    ctx.stroke();
  }
  // Range ring when selected.
  if (tower.selected) {
    ctx.beginPath();
    ctx.arc(x, y, stats.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(125,249,255,0.08)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(125,249,255,0.65)';
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ------------------------------------------------------------------
// Enemies: void constructs — dark armour, glowing cores, rim light
// thrown from the star they march toward.
// ------------------------------------------------------------------
function drawEnemy(ctx, e, time) {
  const def = ENEMY_TYPES[e.type];
  const bob = Math.sin(e.wobble) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.radius * 0.85, e.radius * 0.95, e.radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.type === 'boss') {
    const pulse = 0.5 + 0.18 * Math.sin(time * 3);
    drawGlow(ctx, e.x, e.y, e.radius * 2.6, '#ff0a54', pulse * 0.55);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(time * 0.35);
    ctx.strokeStyle = 'rgba(255,10,84,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }
  ctx.save();
  ctx.translate(e.x, e.y + bob * 0.4);
  const bodyGrad = ctx.createRadialGradient(-e.radius * 0.35, -e.radius * 0.4, 2, 0, 0, e.radius * 1.25);
  bodyGrad.addColorStop(0, '#59637c');
  bodyGrad.addColorStop(0.6, '#272d40');
  bodyGrad.addColorStop(1, '#0a0c14');
  const plate = (pathFn) => {
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    pathFn();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,170,210,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  if (e.type === 'runner') {
    ctx.rotate(e.angle);
    plate(() => {
      ctx.moveTo(e.radius + 5, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.85);
      ctx.lineTo(-e.radius * 0.45, 0);
      ctx.lineTo(-e.radius, e.radius * 0.85);
      ctx.closePath();
    });
    ctx.fillStyle = def.color;
    ctx.fillRect(0, -2, e.radius * 0.7, 4);
  } else if (e.type === 'grunt' || e.type === 'swarm') {
    plate(() => ctx.arc(0, 0, e.radius, 0, Math.PI * 2));
    ctx.strokeStyle = 'rgba(160,190,230,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.62, 0.4, 2.4);
    ctx.stroke();
  } else if (e.type === 'shielded') {
    plate(() => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    });
    if (e.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(230,80,210,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      drawGlow(ctx, 0, 0, e.radius + 12, '#b5179e', 0.3);
    }
  } else if (e.type === 'tank') {
    ctx.rotate(Math.PI / 4);
    plate(() => ctx.rect(-e.radius * 0.78, -e.radius * 0.78, e.radius * 1.56, e.radius * 1.56));
    ctx.strokeStyle = 'rgba(255,120,120,0.35)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-e.radius * 0.5, -e.radius * 0.5, e.radius, e.radius);
    ctx.rotate(-Math.PI / 4);
  } else if (e.type === 'splitter') {
    plate(() => {
      ctx.arc(-e.radius * 0.42, 0, e.radius * 0.72, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.42, 0, e.radius * 0.72, 0, Math.PI * 2);
    });
    ctx.strokeStyle = 'rgba(6,214,160,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius * 0.6);
    ctx.lineTo(0, e.radius * 0.6);
    ctx.stroke();
    drawGlow(ctx, -e.radius * 0.42, 0, 9, def.color, 0.7);
    drawGlow(ctx, e.radius * 0.42, 0, 9, def.color, 0.7);
  } else if (e.type === 'mite') {
    plate(() => {
      ctx.moveTo(e.radius + 2, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.8);
      ctx.lineTo(-e.radius, e.radius * 0.8);
      ctx.closePath();
    });
  } else {
    // Boss: layered dreadnought plating around a great burning core.
    plate(() => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? e.radius + 8 : e.radius - 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    });
    ctx.strokeStyle = 'rgba(255,90,140,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(-13, -e.radius + 2);
    ctx.lineTo(-6, -e.radius - 11);
    ctx.lineTo(0, -e.radius + 2);
    ctx.lineTo(6, -e.radius - 11);
    ctx.lineTo(13, -e.radius + 2);
    ctx.closePath();
    ctx.fill();
  }
  // The glowing heart of the construct (splitter draws its own pair).
  if (e.type !== 'splitter') {
    const coreR = e.type === 'boss' ? 11 : Math.max(3.4, e.radius * 0.36);
    drawGlow(ctx, 0, 0, coreR * 2.9, def.color, 0.85);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hit flash washes the armour white.
  if (e.hitFlash > 0) {
    ctx.globalAlpha = Math.min(1, e.hitFlash / 0.08) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Rim light from the star (the core sits to the right).
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius + 1, -1.05, 1.05);
  ctx.strokeStyle = 'rgba(255,170,80,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Frost slow: a crystalline halo of shards.
  if (e.slowTimer > 0) {
    ctx.strokeStyle = 'rgba(140,225,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,245,255,0.9)';
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + e.id;
      const sx = e.x + Math.cos(a) * (e.radius + 4);
      const sy = e.y + Math.sin(a) * (e.radius + 4);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx + 3, sy + 3);
      ctx.lineTo(sx - 3, sy + 3);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Napalm burn: flickering embers on the hull.
  if (e.burnTimer > 0) {
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(time * 11 + e.id * 7 + i * 2.4) * 0.5 + 0.5;
      const bx = e.x + Math.cos(i * 2.3 + e.id) * e.radius * 0.6;
      const by = e.y + Math.sin(i * 2.3 + e.id) * e.radius * 0.6 - f * 5;
      drawGlow(ctx, bx, by, 6 + f * 5, '#ff7847', 0.5 + f * 0.4);
    }
  }
  // HP bar (and shield bar above it).
  const w = Math.max(28, e.radius * 2);
  const by = e.y - e.radius - 13;
  ctx.fillStyle = 'rgba(4,6,12,0.8)';
  ctx.fillRect(e.x - w / 2, by, w, 5);
  const hpGrad = ctx.createLinearGradient(e.x - w / 2, by, e.x + w / 2, by);
  hpGrad.addColorStop(0, e.type === 'boss' ? '#ff0a54' : '#51ff8e');
  hpGrad.addColorStop(1, e.type === 'boss' ? '#ff7b00' : '#06d6a0');
  ctx.fillStyle = hpGrad;
  ctx.fillRect(e.x - w / 2, by, w * Math.max(0, e.hp / e.maxHp), 5);
  if (e.maxShield > 0 && e.shield > 0) {
    ctx.fillStyle = 'rgba(230,80,210,0.85)';
    ctx.fillRect(e.x - w / 2, by - 5, w * (e.shield / e.maxShield), 3);
  }
}

// ------------------------------------------------------------------
// Projectiles, arcs, particles: starlight in flight.
// ------------------------------------------------------------------
function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    // Trail: fading motes along the recent path.
    if (p.trail) {
      for (let i = 0; i < p.trail.length; i++) {
        const tp = p.trail[i];
        const a = (i / p.trail.length) * 0.32;
        ctx.fillStyle = p.kind === 'shell' ? `rgba(150,140,130,${a.toFixed(2)})` : hexA(p.color, a);
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, p.radius * (0.4 + (i / p.trail.length) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.kind === 'shell') {
      const lift = Math.sin(Math.min(1, p.arc)) * 26;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.radius * 0.85, p.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      const sg = ctx.createRadialGradient(p.x - 2, p.y - lift - 2, 1, p.x, p.y - lift, p.radius + 1);
      sg.addColorStop(0, '#6b7686');
      sg.addColorStop(1, '#14181f');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(p.x, p.y - lift, p.radius, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, p.x, p.y - lift, p.radius * 1.7, '#ff9e2c', 0.55);
    } else if (p.kind === 'rail') {
      const tail = p.trail && p.trail.length > 0 ? p.trail[0] : { x: p.x - p.dx * 60, y: p.y - p.dy * 60 };
      ctx.strokeStyle = 'rgba(125,249,255,0.4)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      drawGlow(ctx, p.x, p.y, 18, '#7df9ff', 0.8);
    } else if (p.kind === 'frost') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.target ? p.target.y - p.y : 1, p.target ? p.target.x - p.x : 0));
      ctx.fillStyle = '#dff6ff';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(0, -4.5);
      ctx.lineTo(-9, 0);
      ctx.lineTo(0, 4.5);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 13, '#aee9ff', 0.6);
      ctx.restore();
    } else {
      // Bolt: a starlight lance — bright elongated shard with a hot heart.
      const ang = p.target ? Math.atan2(p.target.y - p.y, p.target.x - p.x) : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const lg = ctx.createLinearGradient(-10, 0, 10, 0);
      lg.addColorStop(0, 'rgba(125,249,255,0.15)');
      lg.addColorStop(0.6, '#7df9ff');
      lg.addColorStop(1, '#ffffff');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(0, -3.4);
      ctx.lineTo(-11, 0);
      ctx.lineTo(0, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawGlow(ctx, p.x, p.y, 12, '#7df9ff', 0.55);
    }
  }
  // Tesla arcs: jagged lightning with a glow pass.
  for (const a of state.fx.arcs) {
    const alpha = Math.max(0, a.life / a.maxLife);
    for (const [wdt, col] of [[5, `rgba(155,93,229,${(alpha * 0.45).toFixed(2)})`], [2.6, `rgba(199,125,255,${alpha.toFixed(2)})`], [1.2, `rgba(255,255,255,${alpha.toFixed(2)})`]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      for (let i = 0; i < a.points.length; i++) {
        const pt = a.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          const prev = a.points[i - 1];
          const mx = (prev.x + pt.x) / 2 + (Math.random() - 0.5) * 18;
          const my = (prev.y + pt.y) / 2 + (Math.random() - 0.5) * 18;
          ctx.lineTo(mx, my);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    }
  }
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

function drawFx(ctx, state) {
  // Shockwave rings.
  for (const r of state.fx.rings) {
    const a = Math.max(0, r.life / r.maxLife);
    ctx.strokeStyle = hexA(r.color, a * 0.8);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexA(r.color, a * 0.3);
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  for (const p of state.fx.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    if (p.shape === 'shard') {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 1.6);
      ctx.lineTo(p.size, p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const t of state.fx.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    text(ctx, t.text, t.x, t.y, 15, t.color, 800, 'center');
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  // Starfall strikes in flight: the descending fragment and its target ring.
  for (const ev of state.starfallEvents) {
    ctx.strokeStyle = 'rgba(255,209,102,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(ev.x, ev.y, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!ev.struck) {
      const prog = Math.min(1, ev.t / 0.35);
      const hx = ev.x - 130 + 130 * prog;
      const hy = ev.y - 350 + 350 * prog;
      const streak = ctx.createLinearGradient(hx - 90, hy - 245, hx, hy);
      streak.addColorStop(0, 'rgba(255,209,102,0)');
      streak.addColorStop(1, 'rgba(255,246,216,0.95)');
      ctx.strokeStyle = streak;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(hx - 90, hy - 245);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      drawGlow(ctx, hx, hy, 34, '#ffd166', 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawGlow(ctx, ev.x, ev.y, 190, '#ffd166', Math.max(0, (0.8 - ev.t) * 1.4));
    }
  }
}

// ------------------------------------------------------------------
// HUD / shop / panels
// ------------------------------------------------------------------
function drawHud(ctx, state) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = 'rgba(255,158,44,0.5)';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  text(ctx, '★', 24, HUD_H / 2, 24, PALETTE.gold, 800, 'left');
  text(ctx, 'STARFORGE', 52, HUD_H / 2 - 1, 21, '#f4f6ff', 800, 'left');
  const waveLabel = state.wave === 0 ? 'GET READY' : state.endless && state.wave > ECONOMY.maxWave ? `WAVE ${state.wave} ∞` : `WAVE ${state.wave} / ${ECONOMY.maxWave}`;
  text(ctx, waveLabel, 250, HUD_H / 2, 16, PALETTE.text, 800, 'left');
  text(ctx, `◆ ${state.gold}g`, 392, HUD_H / 2, 17, PALETTE.gold, 800, 'left');
  const livesColor = state.lives <= 5 && state.mode === 'playing' ? (Math.sin(state.time * 6) > 0 ? '#ff4d6d' : '#ffb3c1') : '#ff6b81';
  text(ctx, `♥ ${state.lives}`, 492, HUD_H / 2, 17, livesColor, 800, 'left');
  text(ctx, `${state.score}`, 632, HUD_H / 2, 16, PALETTE.text, 800, 'right');
  const b = hudButtons(state);
  const drawBtn = (r, label, enabled, molten) => {
    ctx.fillStyle = !enabled ? 'rgba(60,70,95,0.55)' : molten ? '#8a3c00' : 'rgba(35,44,68,0.95)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    if (molten && enabled) {
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, '#ffb35c');
      g.addColorStop(1, '#e8590c');
      ctx.fillStyle = g;
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.fill();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = enabled ? 'rgba(255,190,100,0.6)' : 'rgba(120,135,170,0.4)';
    ctx.stroke();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, 14, enabled ? '#ffffff' : '#8a94ad', 800, 'center');
  };
  const startEnabled = state.mode === 'playing' && !state.waveActive && (state.endless || state.wave < ECONOMY.maxWave);
  const startLabel = state.waveActive ? '⚔ WAVE INCOMING' : state.wave === 0 ? '▶ START WAVE 1' : `▶ WAVE ${state.wave + 1}${state.interWave > 0 ? ` (${Math.ceil(state.interWave)}s)` : ''}`;
  drawBtn(b.start, startLabel, startEnabled, true);
  drawBtn(b.pause, state.paused ? '▶ RESUME' : '❚❚ PAUSE', state.mode === 'playing');
  drawBtn(b.speed, `${state.speed}× SPEED`, true);
  drawBtn(b.sound, state.muted ? '🔇 MUTED' : '🔊 SOUND', true);
  drawBtn(b.help, '? HELP', true);
  // Next-wave preview strip / boss bar.
  const boss = state.enemies.find((e) => e.type === 'boss' && !e.dead);
  if (boss) {
    const bw = 600;
    const bx = VIEW_W / 2 - bw / 2;
    const by = HUD_H + 10;
    text(ctx, '⚠ STARFORGE DREADNOUGHT', VIEW_W / 2, by - 1, 12, '#ff8fab', 800, 'center');
    ctx.fillStyle = 'rgba(4,6,12,0.85)';
    roundRect(ctx, bx, by + 7, bw, 13, 6);
    ctx.fill();
    const bg = ctx.createLinearGradient(bx, by, bx + bw, by);
    bg.addColorStop(0, '#ff0a54');
    bg.addColorStop(1, '#ff7b00');
    ctx.fillStyle = bg;
    roundRect(ctx, bx, by + 7, bw * Math.max(0, boss.hp / boss.maxHp), 13, 6);
    ctx.fill();
  } else if (state.mode === 'playing' && !state.waveActive && (state.endless || state.wave < ECONOMY.maxWave)) {
    text(ctx, `Next: ${wavePreview(state.wave + 1)}  ·  clear bonus ${waveClearBonus(state.wave + 1)}g`, VIEW_W / 2, HUD_H + 20, 14, '#aeb9d4', 700, 'center');
  }
}

function drawShop(ctx, state) {
  const y0 = VIEW_H - SHOP_H;
  ctx.fillStyle = PALETTE.shopBg;
  ctx.fillRect(0, y0, VIEW_W, SHOP_H);
  ctx.fillStyle = 'rgba(255,158,44,0.5)';
  ctx.fillRect(0, y0, VIEW_W, 2);
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    const key = TOWER_ORDER[i];
    const def = TOWER_TYPES[key];
    const r = shopCardRect(i);
    const selected = state.placingType === key;
    const afford = state.gold >= def.levels[0].cost;
    ctx.fillStyle = metalGrad(ctx, r.x, r.y, r.y + r.h, selected ? [[0, '#4a3a12'], [1, '#241c08']] : [[0, '#232c47'], [1, '#131826']]);
    roundRect(ctx, r.x, r.y, r.w, r.h, 9);
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? PALETTE.gold : afford ? 'rgba(130,155,200,0.5)' : 'rgba(110,120,145,0.35)';
    ctx.stroke();
    const accent = { bolt: '#7df9ff', frost: '#aee9ff', mortar: '#ffb35c', tesla: '#c77dff' }[key];
    drawGlow(ctx, r.x + 22, r.y + 24, 16, accent, afford ? 0.55 : 0.2);
    text(ctx, '✦', r.x + 22, r.y + 24, 20, accent, 800, 'center');
    text(ctx, `${def.name} · ${def.levels[0].cost}g`, r.x + 42, r.y + 24, 15, afford ? '#f4f6ff' : '#8a94ad', 800, 'left');
    text(ctx, def.desc, r.x + 10, r.y + 54, 12.5, '#aeb9d4', 600, 'left');
  }
  const hx = 664;
  text(ctx, 'Click a card (or 1–4), then a lit pad to build.', hx, y0 + 20, 13.5, '#aeb9d4', 600, 'left');
  text(ctx, 'Select a tower to upgrade — L3 picks a specialization.', hx, y0 + 42, 13.5, '#aeb9d4', 600, 'left');
  text(ctx, `Kills ${state.kills} · Gold ${state.stats.goldEarned}g · Leaks ${state.stats.leaks}`, hx, y0 + 68, 13.5, '#7f8cab', 700, 'left');
  // STARFALL button: the star itself, weaponized.
  const sf = starfallRect();
  const ready = state.starfall.charge >= state.starfall.max;
  const frac = state.starfall.charge / state.starfall.max;
  ctx.fillStyle = metalGrad(ctx, sf.x, sf.y, sf.y + sf.h, ready ? [[0, '#5e430a'], [1, '#2c1e04']] : [[0, '#232c47'], [1, '#131826']]);
  roundRect(ctx, sf.x, sf.y, sf.w, sf.h, 10);
  ctx.fill();
  ctx.lineWidth = state.starfall.targeting ? 3 : 2;
  ctx.strokeStyle = state.starfall.targeting ? '#ffffff' : ready ? PALETTE.gold : 'rgba(130,155,200,0.5)';
  ctx.stroke();
  if (ready) drawGlow(ctx, sf.x + 30, sf.y + 30, 26, '#ffd166', 0.55 + 0.25 * Math.sin(state.time * 5));
  text(ctx, '★', sf.x + 30, sf.y + 30, 30, ready ? '#ffd166' : '#8a94ad', 800, 'center');
  text(ctx, 'STARFALL', sf.x + 56, sf.y + 24, 16, ready ? '#ffe9a3' : '#aeb9d4', 800, 'left');
  text(ctx, state.starfall.targeting ? 'CLICK A TARGET!' : ready ? 'READY — fire!' : `charging ${Math.floor(frac * 100)}%`, sf.x + 56, sf.y + 47, 12.5, ready ? '#ffd166' : '#7f8cab', 700, 'left');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(sf.x + 12, sf.y + 62, sf.w - 24, 6);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(sf.x + 12, sf.y + 62, (sf.w - 24) * frac, 6);
}

function drawUpgradePanel(ctx, state) {
  const t = state.selectedTower;
  if (!t) return;
  const def = TOWER_TYPES[t.type];
  const x = 968;
  const y = 66;
  const w = 296;
  const choosing = t.level >= 2 && !t.spec;
  const h = choosing ? 436 : 320;
  ctx.fillStyle = 'rgba(10,13,24,0.94)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,179,92,0.65)';
  ctx.stroke();
  text(ctx, def.name, x + 16, y + 26, 19, '#f4f6ff', 800, 'left');
  text(ctx, t.spec ? `Level 3 · ★ ${specName(t)}` : `Level ${t.level + 1} of 3`, x + 16, y + 52, 14, PALETTE.gold, 800, 'left');
  ctx.strokeStyle = 'rgba(130,155,200,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 66);
  ctx.lineTo(x + w - 16, y + 66);
  ctx.stroke();
  const stats = effectiveStats(t);
  const rows = [['Damage', stats.damage]];
  if (t.type !== 'tesla') rows.push(['Fire rate', `${stats.rate}/s`]);
  rows.push(['Range', stats.range]);
  if (stats.splash) rows.push(['Splash', stats.splash]);
  if (stats.slowPct) rows.push(['Slow', `${Math.round(stats.slowPct * 100)}% · ${stats.slowSecs}s`]);
  if (stats.chain) rows.push(['Chains', stats.chain]);
  if (stats.pierce) rows.push(['Pierce', 'rail line']);
  if (stats.cluster) rows.push(['Cluster', `${stats.cluster} bomblets`]);
  if (stats.burnDps) rows.push(['Burn', `${stats.burnDps}/s · ${stats.burnSecs}s`]);
  rows.slice(0, 6).forEach((row, i) => {
    text(ctx, row[0], x + 16, y + 88 + i * 23, 14, '#aeb9d4', 600, 'left');
    text(ctx, `${row[1]}`, x + w - 16, y + 88 + i * 23, 14, '#f4f6ff', 800, 'right');
  });
  const btns = panelButtons(t);
  if (choosing) {
    text(ctx, 'CHOOSE SPECIALIZATION', x + 16, y + 232, 13, '#ffcf7d', 800, 'left');
    const opts = specOptions(t);
    [btns.spec0, btns.spec1].forEach((r, i) => {
      const opt = opts[i];
      if (!opt) return;
      const afford = state.gold >= opt.cost;
      ctx.fillStyle = afford ? 'rgba(38,32,10,0.95)' : 'rgba(40,46,66,0.8)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 9);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = afford ? PALETTE.gold : 'rgba(120,135,170,0.4)';
      ctx.stroke();
      text(ctx, `${opt.name} · ${opt.cost}g`, r.x + 12, r.y + 17, 14.5, afford ? '#ffe9a3' : '#8a94ad', 800, 'left');
      text(ctx, opt.desc, r.x + 12, r.y + 38, 11.5, '#aeb9d4', 600, 'left');
    });
    ctx.fillStyle = 'rgba(70,30,40,0.9)';
    roundRect(ctx, btns.sell.x, btns.sell.y, btns.sell.w, btns.sell.h, 9);
    ctx.fill();
    text(ctx, `SELL +${sellValue(t)}g`, btns.sell.x + btns.sell.w / 2, btns.sell.y + btns.sell.h / 2 + 1, 13.5, '#ffb3c1', 800, 'center');
  } else {
    if (t.spec) {
      // The specialization banner takes the upgrade button's place.
      const sd = TOWER_SPECS[t.type].find((s) => s.key === t.spec);
      ctx.fillStyle = 'rgba(38,32,10,0.9)';
      roundRect(ctx, x + 16, y + 196, w - 32, 54, 9);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.stroke();
      text(ctx, `★ ${sd.name}`, x + 28, y + 214, 14.5, '#ffd166', 800, 'left');
      text(ctx, sd.desc, x + 28, y + 236, 11.5, '#aeb9d4', 600, 'left');
    }
    if (btns.upgrade && !t.spec) {
      const cost = upgradeCost(t);
      if (cost !== null) {
        const afford = state.gold >= cost;
        ctx.fillStyle = afford ? '#0d5c46' : 'rgba(40,46,66,0.8)';
        roundRect(ctx, btns.upgrade.x, btns.upgrade.y, btns.upgrade.w, btns.upgrade.h, 9);
        ctx.fill();
        text(ctx, `UPGRADE — ${cost}g`, btns.upgrade.x + btns.upgrade.w / 2, btns.upgrade.y + 21, 15, afford ? '#d2ffe9' : '#8a94ad', 800, 'center');
      } else {
        ctx.fillStyle = 'rgba(38,32,10,0.9)';
        roundRect(ctx, btns.upgrade.x, btns.upgrade.y, btns.upgrade.w, btns.upgrade.h, 9);
        ctx.fill();
        text(ctx, '★ MAX LEVEL', btns.upgrade.x + btns.upgrade.w / 2, btns.upgrade.y + 21, 15, '#ffd166', 800, 'center');
      }
    }
    ctx.fillStyle = 'rgba(70,30,40,0.9)';
    roundRect(ctx, btns.sell.x, btns.sell.y, btns.sell.w, btns.sell.h, 9);
    ctx.fill();
    text(ctx, `SELL +${sellValue(t)}g`, btns.sell.x + btns.sell.w / 2, btns.sell.y + btns.sell.h / 2 + 1, 14, '#ffb3c1', 800, 'center');
  }
  text(ctx, 'Esc or click elsewhere to close', x + 16, y + h - 14, 11.5, '#7f8cab', 600, 'left');
}

function specName(t) {
  const sd = t.spec ? TOWER_SPECS[t.type].find((s) => s.key === t.spec) : null;
  return sd ? sd.name : '';
}

function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  const a = Math.min(1, b.life / (b.maxLife * 0.35), (b.maxLife - b.life) / 0.18 + 0.15);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const w = 540;
  const h = 72;
  const x = VIEW_W / 2 - w / 2;
  const y = 108;
  ctx.fillStyle = 'rgba(8,10,20,0.82)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,179,92,0.8)';
  ctx.stroke();
  drawGlow(ctx, x + 36, y + h / 2, 20, '#ffd166', 0.7);
  text(ctx, '★', x + 36, y + h / 2, 24, '#ffd166', 800, 'center');
  text(ctx, b.title, VIEW_W / 2 + 14, y + 24, 23, '#ffffff', 800, 'center');
  text(ctx, b.sub, VIEW_W / 2 + 14, y + 52, 13.5, '#ffcf7d', 700, 'center');
  ctx.restore();
}

function drawGhosts(ctx, state) {
  // STARFALL targeting reticle.
  if (state.starfall.targeting && state.mouse) {
    const { x, y } = state.mouse;
    drawGlow(ctx, x, y, 120, '#ffd166', 0.35 + 0.12 * Math.sin(state.time * 6));
    ctx.strokeStyle = 'rgba(255,209,102,0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(x, y, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,209,102,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, HUD_H);
    ctx.lineTo(x, y - 110);
    ctx.stroke();
    text(ctx, '★ STARFALL — click to strike', x, y - 126, 15, '#ffd166', 800, 'center');
    return;
  }
  if (state.placingType && state.mouse) {
    const { x, y } = state.mouse;
    const def = TOWER_TYPES[state.placingType];
    const range = def.levels[0].range;
    const plot = state.hoverPlot;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(125,249,255,0.07)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(125,249,255,0.5)';
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    drawTower(ctx, { type: state.placingType, level: 0, spec: null, x, y, angle: -Math.PI / 2, flash: 0, arcTimer: 0, selected: false }, state.time);
    ctx.globalAlpha = 1;
    if (!plot) {
      text(ctx, 'Click a glowing pad to build', x, y - range - 12, 14, '#ffffff', 800, 'center');
    }
  }
}

// ------------------------------------------------------------------
// Title / end / help overlays
// ------------------------------------------------------------------
function drawTitle(ctx, state) {
  // The star, enormous, directly behind the name it powers.
  drawStar(ctx, VIEW_W / 2, 222, 84, state.time, true);
  const tg = ctx.createLinearGradient(0, 382, 0, 436);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.45, '#ffd166');
  tg.addColorStop(0.75, '#ff9e2c');
  tg.addColorStop(1, '#b3540a');
  ctx.fillStyle = tg;
  ctx.font = '800 58px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,140,26,0.75)';
  ctx.shadowBlur = 26;
  ctx.fillText('STARFORGE', VIEW_W / 2, 412);
  ctx.shadowBlur = 0;
  text(ctx, 'D E F E N S E', VIEW_W / 2, 454, 25, '#f4f6ff', 800, 'center');
  text(ctx, 'Hold the conduit. Spend the starlight. Do not let the void reach the star.', VIEW_W / 2, 484, 16, '#dbe4ff', 700, 'center');
  const r = { x: VIEW_W / 2 - 150, y: 504, w: 300, h: 56 };
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#ffb35c');
  g.addColorStop(1, '#e8590c');
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  text(ctx, '▶  START GAME', VIEW_W / 2, r.y + r.h / 2 + 1, 21, '#ffffff', 800, 'center');
  text(ctx, 'Build with gold · upgrade to level 3 and specialize · charge STARFALL with kills', VIEW_W / 2, 584, 14.5, '#aeb9d4', 600, 'center');
  text(ctx, '20 waves stand between the void and the star. Survive them all — then go endless.', VIEW_W / 2, 606, 14.5, '#aeb9d4', 600, 'center');
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

function drawEnd(ctx, state) {
  const won = state.mode === 'victory';
  ctx.fillStyle = 'rgba(3,4,10,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Starfield bursts through the dim on every end screen.
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(starFrame(), 0, 0);
  ctx.restore();
  if (won) {
    // Victory starburst: rays radiating behind the panel.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(VIEW_W / 2, 268);
    ctx.rotate(state.time * 0.08);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * 330, Math.sin(a) * 330);
      grad.addColorStop(0, 'rgba(255,180,80,0.20)');
      grad.addColorStop(1, 'rgba(255,140,26,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.09) * 330, Math.sin(a - 0.09) * 330);
      ctx.lineTo(Math.cos(a + 0.09) * 330, Math.sin(a + 0.09) * 330);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    drawStar(ctx, VIEW_W / 2, 94, 34, state.time, false);
  }
  const lines = [
    [`Waves cleared`, state.endless ? `${state.wave} (endless)` : `${Math.min(state.wave, ECONOMY.maxWave)} / ${ECONOMY.maxWave}`],
    ['Enemies destroyed', `${state.kills}`],
    ['Gold earned', `${state.stats.goldEarned}g`],
    ['Leaks', `${state.stats.leaks}`],
    ['Time held', fmtTime(state.stats.time)],
  ];
  if (won) lines.push(['Lives left', `${state.lives}  (+${state.lives * 150} score)`]);
  const panelW = 480;
  const panelH = 150 + lines.length * 30;
  const px = VIEW_W / 2 - panelW / 2;
  const py = 140;
  ctx.fillStyle = 'rgba(10,13,24,0.95)';
  roundRect(ctx, px, py, panelW, panelH, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = won ? 'rgba(255,179,92,0.8)' : 'rgba(255,77,109,0.7)';
  ctx.stroke();
  text(ctx, won ? '★ THE STAR BURNS ON ★' : 'THE STAR GOES DARK', VIEW_W / 2, py + 36, 27, won ? '#ffd166' : '#ff6b81', 800, 'center');
  lines.forEach((row, i) => {
    text(ctx, row[0], px + 36, py + 74 + i * 30, 15.5, '#aeb9d4', 600, 'left');
    text(ctx, row[1], px + panelW - 36, py + 74 + i * 30, 15.5, '#f4f6ff', 800, 'right');
  });
  text(ctx, `FINAL SCORE  ${state.score}`, VIEW_W / 2, py + panelH - 22, 19, PALETTE.gold, 800, 'center');
  const b = endButtons();
  const g = ctx.createLinearGradient(b.again.x, b.again.y, b.again.x, b.again.y + b.again.h);
  g.addColorStop(0, '#12a37c');
  g.addColorStop(1, '#0d5c46');
  ctx.fillStyle = g;
  roundRect(ctx, b.again.x, b.again.y, b.again.w, b.again.h, 12);
  ctx.fill();
  text(ctx, '↻  PLAY AGAIN', VIEW_W / 2, b.again.y + b.again.h / 2 + 1, 20, '#ffffff', 800, 'center');
  if (won) {
    const eg = ctx.createLinearGradient(b.endless.x, b.endless.y, b.endless.x, b.endless.y + b.endless.h);
    eg.addColorStop(0, '#ffb35c');
    eg.addColorStop(1, '#e8590c');
    ctx.fillStyle = eg;
    roundRect(ctx, b.endless.x, b.endless.y, b.endless.w, b.endless.h, 12);
    ctx.fill();
    text(ctx, '∞  ENDLESS MODE', VIEW_W / 2, b.endless.y + b.endless.h / 2 + 1, 18, '#ffffff', 800, 'center');
  }
}

function drawHelp(ctx, state) {
  ctx.fillStyle = 'rgba(3,4,10,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 780;
  const h = 470;
  const x = VIEW_W / 2 - w / 2;
  const y = 110;
  ctx.fillStyle = 'rgba(12,16,28,0.97)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,179,92,0.7)';
  ctx.stroke();
  text(ctx, 'HOW TO PLAY', VIEW_W / 2, y + 38, 26, '#ffd166', 800, 'center');
  const lines = [
    'Void constructs march the molten conduit toward the STARFORGE CORE — your captured star.',
    'Build towers on the lit pads. Enemies that reach the core cost lives; at 0 lives the star dies.',
    '',
    'Bolt Turret — fast starlight lances.   Frost Spire — slows the march.',
    'Mortar — splash shells.   Tesla Coil — lightning that chains between enemies.',
    'Click a tower to upgrade it. At level 3 it chooses a SPECIALIZATION:',
    'Railgun or Dual Bolt · Deep Freeze or Shatter · Cluster or Napalm · Storm or Overcharge.',
    'Splitters burst into Mites when destroyed — splash and chains clean them up.',
    '',
    'Kills charge STARFALL: at full charge, click the STARFALL button, then click a target —',
    'a star fragment falls there. Clear all 20 waves to win, then try ENDLESS mode.',
    '',
    'Keys: 1–4 select a tower card · Space starts the next wave · P pause · F speed',
    'Q fires Starfall targeting · M mute · Esc cancels / closes panels',
  ];
  lines.forEach((line, i) => {
    text(ctx, line, VIEW_W / 2, y + 82 + i * 26, 15, '#dbe4ff', 600, 'center');
  });
  text(ctx, 'Click anywhere to close', VIEW_W / 2, y + h - 24, 13.5, '#7f8cab', 600, 'center');
}

// ------------------------------------------------------------------
// Main draw
// ------------------------------------------------------------------
export function draw(ctx, state) {
  ctx.save();
  const off = shakeOffset(state.fx);
  ctx.translate(off.x, off.y);
  drawField(ctx, state);
  for (const t of state.towers) drawTower(ctx, t, state.time);
  for (const e of state.enemies) drawEnemy(ctx, e, state.time);
  drawProjectiles(ctx, state);
  drawFx(ctx, state);
  drawGhosts(ctx, state);
  ctx.restore();
  // Global vignette + film grain + low-lives alarm pulse.
  ctx.drawImage(vignette(), 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  if (state.mode === 'playing' && state.lives <= 5) {
    const a = 0.10 + 0.07 * Math.sin(state.time * 5);
    const rg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    rg.addColorStop(0, 'rgba(255,30,60,0)');
    rg.addColorStop(1, `rgba(255,30,60,${a.toFixed(3)})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawHud(ctx, state);
  drawShop(ctx, state);
  if (state.selectedTower) drawUpgradePanel(ctx, state);
  drawBanner(ctx, state);
  if (state.mode === 'title') drawTitle(ctx, state);
  if (state.mode === 'victory' || state.mode === 'defeat') drawEnd(ctx, state);
  if (state.showHelp) drawHelp(ctx, state);
  if (state.paused && state.mode === 'playing') {
    ctx.fillStyle = 'rgba(3,4,10,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, '❚❚ PAUSED', VIEW_W / 2, VIEW_H / 2, 44, '#ffffff', 800, 'center');
  }
}
