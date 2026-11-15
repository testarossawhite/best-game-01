// STARFORGE DEFENSE — input: mouse clicks and keyboard. Hit-tests the
// same button rects render.js draws, so what you see is what you click.
import { VIEW_W, VIEW_H, TOWER_ORDER, TOWER_TYPES, PLOTS } from './config.js';
import { shopCardRect, hudButtons, panelButtons, centerButton } from './render.js';
import { buildCost, createTower, upgradeCost, upgradeTower, sellValue } from './towers.js';

function inside(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function plotAt(x, y) {
  for (let i = 0; i < PLOTS.length; i++) {
    const p = PLOTS[i];
    if (Math.hypot(x - p.x, y - p.y) <= p.r + 6) return { plot: p, index: i };
  }
  return null;
}

function towerAt(state, x, y) {
  for (const t of state.towers) {
    if (Math.hypot(x - t.x, y - t.y) <= 28) return t;
  }
  return null;
}

export function handleClick(state, x, y) {
  state.sfx.ensure();
  if (state.showHelp) {
    state.showHelp = false;
    return;
  }
  if (state.mode === 'title') {
    state.startGame();
    return;
  }
  if (state.mode === 'victory' || state.mode === 'defeat') {
    const b = centerButton();
    if (inside(x, y, b)) state.restart();
    return;
  }
  // HUD buttons.
  const btns = hudButtons(state);
  if (inside(x, y, btns.start)) {
    state.callWave();
    return;
  }
  if (inside(x, y, btns.pause)) {
    state.togglePause();
    return;
  }
  if (inside(x, y, btns.speed)) {
    state.toggleSpeed();
    return;
  }
  if (inside(x, y, btns.sound)) {
    state.sfx.muted = !state.sfx.muted;
    return;
  }
  if (inside(x, y, btns.help)) {
    state.showHelp = true;
    return;
  }
  // Upgrade panel buttons (only when a tower is selected).
  if (state.selectedTower) {
    const pb = panelButtons();
    if (inside(x, y, pb.upgrade)) {
      state.tryUpgrade();
      return;
    }
    if (inside(x, y, pb.sell)) {
      state.trySell();
      return;
    }
  }
  // Shop cards.
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    if (inside(x, y, shopCardRect(i))) {
      const key = TOWER_ORDER[i];
      state.placingType = state.placingType === key ? null : key;
      state.selectedTower = null;
      state.sfx.click();
      return;
    }
  }
  // Field clicks: place on a plot, or select a tower.
  const hitPlot = plotAt(x, y);
  const hitTower = towerAt(state, x, y);
  if (state.placingType) {
    if (hitPlot) {
      state.tryPlace(hitPlot.index, hitPlot.plot);
    } else {
      state.placingType = null; // clicked empty ground: cancel placement
    }
    return;
  }
  if (hitTower) {
    state.selectedTower = hitTower;
    state.sfx.click();
    return;
  }
  state.selectedTower = null;
}

export function handleKey(state, key) {
  state.sfx.ensure();
  if (key === 'Escape') {
    if (state.showHelp) state.showHelp = false;
    else if (state.placingType) state.placingType = null;
    else state.selectedTower = null;
    return;
  }
  if (state.mode === 'title' && (key === ' ' || key === 'Enter')) {
    state.startGame();
    return;
  }
  if ((state.mode === 'victory' || state.mode === 'defeat') && (key === ' ' || key === 'Enter')) {
    state.restart();
    return;
  }
  if (key === ' ') {
    state.togglePause();
    return;
  }
  if (key === 'f' || key === 'F') {
    state.toggleSpeed();
    return;
  }
  if (key === 'm' || key === 'M') {
    state.sfx.muted = !state.sfx.muted;
    return;
  }
  const idx = ['1', '2', '3', '4'].indexOf(key);
  if (idx !== -1 && state.mode === 'playing') {
    const typeKey = TOWER_ORDER[idx];
    state.placingType = state.placingType === typeKey ? null : typeKey;
    state.selectedTower = null;
    state.sfx.click();
  }
}

export function handleMouseMove(state, x, y) {
  state.mouse = { x, y };
  state.hoverPlot = null;
  if (state.placingType) {
    const hit = plotAt(x, y);
    if (hit) state.hoverPlot = hit.plot;
  }
}
