// STARFORGE DEFENSE 3D — UI: DOM HUD, shop, tower panel, stage-reward
// and intel overlays, and all pointer/keyboard input. Picking unprojects
// the pointer onto the deck plane and works in table coordinates, so it
// never depends on mesh bookkeeping.
import * as THREE from 'three';
import {
  PLOTS, TOWER_TYPES, TOWER_ORDER, TOWER_SPECS, ENEMY_TYPES, ECONOMY, STORY, WORLD_SCALE,
} from './config.js';
import { effectiveStats, upgradeCost, specOptions, sellValue } from './towers.js';
import { wavePreview } from './waves.js';

const $ = (id) => document.getElementById(id);

export function createUI(getState, world) {
  const canvas = world.renderer.domElement;
  const els = {
    gold: $('hGold'), lives: $('hLives'), stage: $('hStage'), score: $('hScore'),
    bossbar: $('bossbar'), bossFill: $('bossFill'),
    banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
    waveNext: $('waveNext'), callbtn: $('callbtn'), cards: $('cards'),
    starfallBtn: $('starfallBtn'), starMeter: $('starMeter'),
    towerPanel: $('towerPanel'), choices: $('choices'), choiceTitle: $('choiceTitle'),
    choiceLede: $('choiceLede'), choiceRow: $('choiceRow'),
    intel: $('intelCard'), intelTitle: $('intelTitle'), intelName: $('intelName'), intelTrait: $('intelTrait'),
    title: $('titleScreen'), end: $('endScreen'), endTitle: $('endTitle'), endText: $('endText'),
    endStats: $('endStats'), endlessBtn: $('endlessBtn'),
    leakFlash: $('leakFlash'), lowLight: $('lowLight'), help: $('helpPanel'),
    speedBtn: $('speedBtn'), muteBtn: $('muteBtn'), pauseBtn: $('pauseBtn'),
    status: $('status'),
  };
  $('premiseText').innerHTML = STORY.premise.join('<br>');

  // --- shop cards (built once) ---
  const cardEls = {};
  for (const key of TOWER_ORDER) {
    const def = TOWER_TYPES[key];
    const el = document.createElement('div');
    el.className = 'card glass';
    el.innerHTML = `<span class="key">${def.hotkey}</span><h3 style="color:${def.accent}">${def.name}</h3><p>${def.desc}</p><span class="cost">${def.levels[0].cost}⛃</span>`;
    el.addEventListener('click', () => {
      const s = getState();
      if (s.mode !== 'playing') return;
      s.placingType = s.placingType === key ? null : key;
      s.selectedTower = null;
      s.starfall.targeting = false;
      s.sfx.ensure();
      s.sfx.click();
    });
    els.cards.appendChild(el);
    cardEls[key] = el;
  }

  // --- buttons ---
  $('startBtn').addEventListener('click', () => getState().startGame());
  $('restartBtn').addEventListener('click', () => getState().startGame());
  $('endlessBtn').addEventListener('click', () => getState().startEndless());
  $('intelBtn').addEventListener('click', () => getState().dismissIntel());
  els.callbtn.addEventListener('click', () => getState().callWave());
  els.starfallBtn.addEventListener('click', () => getState().toggleStarfall());
  els.pauseBtn.addEventListener('click', () => getState().togglePause());
  els.speedBtn.addEventListener('click', () => getState().toggleSpeed());
  els.muteBtn.addEventListener('click', () => getState().toggleMute());
  $('helpBtn').addEventListener('click', () => { els.help.style.display = els.help.style.display === 'block' ? 'none' : 'block'; });
  $('helpClose').addEventListener('click', () => { els.help.style.display = 'none'; });

  // --- picking: pointer -> deck plane -> table coordinates ---
  const raycaster = new THREE.Raycaster();
  const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit3 = new THREE.Vector3();
  function pick(ev) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, world.camera);
    if (!raycaster.ray.intersectPlane(deckPlane, hit3)) return null;
    return { x: hit3.x / WORLD_SCALE + 640, y: hit3.z / WORLD_SCALE + 340 };
  }
  function nearestPlot(p, maxD = 36) {
    let best = null;
    let bestD = maxD;
    PLOTS.forEach((plot, i) => {
      const d = Math.hypot(plot.x - p.x, plot.y - p.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener('click', (ev) => {
    const s = getState();
    if (s.mode !== 'playing') return;
    const p = pick(ev);
    if (!p) return;
    s.sfx.ensure();
    if (s.starfall.targeting) {
      s.launchStarfall(p.x, p.y);
      return;
    }
    const plotIdx = nearestPlot(p);
    if (s.placingType) {
      if (plotIdx !== null) s.tryPlace(plotIdx, PLOTS[plotIdx]);
      else s.placingType = null;
      return;
    }
    if (plotIdx !== null) {
      const tower = s.towers.find((t) => t.plotIndex === plotIdx);
      s.selectedTower = tower || null;
      if (tower) s.sfx.click();
      return;
    }
    s.selectedTower = null;
  });
  canvas.addEventListener('pointermove', (ev) => {
    const s = getState();
    const p = pick(ev);
    if (!p) { s.hoverPlot = null; return; }
    s.mouse = p;
    s.hoverPlot = nearestPlot(p);
    canvas.style.cursor = s.starfall.targeting ? 'cell' : s.hoverPlot !== null ? 'pointer' : 'crosshair';
  });
  window.addEventListener('keydown', (ev) => {
    const s = getState();
    if ([' ', 'ArrowUp', 'ArrowDown'].includes(ev.key)) ev.preventDefault();
    if (s.mode === 'title' && (ev.key === 'Enter' || ev.key === ' ')) { s.startGame(); return; }
    if (s.mode !== 'playing') return;
    const k = ev.key.toLowerCase();
    const typeIdx = TOWER_ORDER.findIndex((t) => TOWER_TYPES[t].hotkey === ev.key);
    if (typeIdx >= 0) {
      const key = TOWER_ORDER[typeIdx];
      s.placingType = s.placingType === key ? null : key;
      s.selectedTower = null;
    } else if (k === 'escape') {
      s.placingType = null;
      s.selectedTower = null;
      s.starfall.targeting = false;
    } else if (k === ' ') s.callWave();
    else if (k === 'p') s.togglePause();
    else if (k === 'f') s.toggleStarfall();
    else if (k === 'm') s.toggleMute();
  });

  // --- tower panel (rebuilt when its signature changes) ---
  let panelSig = '';
  function refreshPanel(s) {
    const t = s.selectedTower;
    if (!t || s.mode !== 'playing') {
      if (panelSig !== '') { els.towerPanel.style.display = 'none'; panelSig = ''; }
      return;
    }
    const sig = [t.id, t.level, t.spec, s.gold, s.discountTokens, s.buffsStamp].join('|');
    if (sig === panelSig) return;
    panelSig = sig;
    const def = TOWER_TYPES[t.type];
    const st = effectiveStats(t, s.buffs);
    const stars = '●'.repeat(t.level + 1) + '○'.repeat(2 - t.level);
    let traits = '';
    if (st.splash) traits += ` · splash ${st.splash}`;
    if (st.chain) traits += ` · chains ${st.chain}`;
    if (st.slowPct) traits += ` · slow ${Math.round(st.slowPct * 100)}%`;
    if (st.pierce) traits += ' · piercing';
    if (st.cluster) traits += ` · ${st.cluster} bomblets`;
    if (st.burnDps) traits += ` · burns ${st.burnDps}/s`;
    let html = `<h3 style="color:${def.accent}">${def.name} <span style="color:#ffd166">${stars}</span></h3>`
      + `<p class="sub">${t.spec ? `Specialization: <b style="color:#ffd9a0">${specName(t)}</b> · ` : ''}Forged with star-metal, fed by the star's own light.</p>`
      + `<div class="stats">Damage <b>${st.damage}</b> · Range <b>${st.range}</b> · Rate <b>${st.rate}/s</b>${traits}</div>`;
    const upCost = upgradeCost(t);
    if (upCost !== null) {
      const price = s.quotePrice(upCost);
      html += `<button class="pbtn" data-act="upgrade" ${s.gold < price ? 'disabled' : ''}>⬆ Forge tier ${t.level + 2}<span class="c">${price}⛃${price < upCost ? ' (marked)' : ''}</span><small>Stronger in every way.</small></button>`;
    }
    if (t.level >= 2 && !t.spec) {
      for (const spec of specOptions(t)) {
        const price = s.quotePrice(spec.cost);
        html += `<button class="pbtn" data-act="spec" data-key="${spec.key}" ${s.gold < price ? 'disabled' : ''}>★ ${spec.name}<span class="c">${price}⛃${price < spec.cost ? ' (marked)' : ''}</span><small>${spec.desc}</small></button>`;
      }
    }
    if (t.level >= 2 && t.spec) html += `<p class="sub" style="margin-top:8px;">This tower's path is chosen. It burns at its peak.</p>`;
    html += `<button class="pbtn" data-act="sell">♻ Melt down<span class="c">+${sellValue(t)}⛃</span><small>Refund 70% of the forging.</small></button>`;
    els.towerPanel.innerHTML = html;
    els.towerPanel.style.display = 'block';
  }
  function specName(t) {
    const spec = (TOWER_SPECS[t.type] || []).find((sp) => sp.key === t.spec);
    return spec ? spec.name : t.spec;
  }
  els.towerPanel.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const s = getState();
    if (btn.dataset.act === 'upgrade') s.tryUpgrade();
    else if (btn.dataset.act === 'spec') s.chooseSpec(btn.dataset.key);
    else if (btn.dataset.act === 'sell') s.trySell();
    panelSig = '';
  });

  // --- reward choices (rebuilt when a new set is drawn) ---
  let choiceRef = null;
  function refreshChoices(s) {
    if (s.mode !== 'reward') {
      els.choices.style.display = 'none';
      choiceRef = null;
      return;
    }
    els.choices.style.display = 'flex';
    if (choiceRef === s.rewardChoices) return;
    choiceRef = s.rewardChoices;
    els.choiceTitle.textContent = `STAGE ${s.wave} HELD`;
    els.choiceLede.textContent = `The conduit is quiet — for now. Stage bonus +${s.lastClearBonus}⛃ banked. The forge refines what the star shed: choose one gift.`;
    els.choiceRow.innerHTML = '';
    s.rewardChoices.forEach((choice, i) => {
      const el = document.createElement('div');
      el.className = 'choice glass';
      el.innerHTML = `<div class="icon">${choice.def.icon}</div><h4>${choice.def.name}</h4><p>${choice.text}</p>`;
      el.addEventListener('click', () => getState().chooseReward(i));
      els.choiceRow.appendChild(el);
    });
  }

  // --- per-frame refresh ---
  let lastBanner = null;
  let lastMode = '';
  function refresh(s, dt) {
    els.gold.textContent = `${s.gold}⛃`;
    const pct = Math.max(0, Math.round((s.lives / ECONOMY.startLives) * 100));
    els.lives.textContent = `☀ ${pct}%`;
    els.lives.style.color = pct <= 25 ? '#ff5c5c' : pct <= 50 ? '#ffd166' : '#eef2ff';
    els.stage.textContent = s.endless ? `${s.wave} ∞` : `${Math.max(1, s.wave)} / ${ECONOMY.maxStage}`;
    els.score.textContent = `${s.score}`;
    const boss = s.enemies.find((e) => e.type === 'boss');
    if (boss) {
      els.bossbar.style.display = 'block';
      els.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    } else {
      els.bossbar.style.display = 'none';
    }
    if (s.banner !== lastBanner) {
      lastBanner = s.banner;
      if (s.banner) {
        els.bannerTitle.textContent = s.banner.title;
        els.bannerSub.textContent = s.banner.sub;
      }
    }
    els.banner.style.opacity = s.banner ? String(Math.min(1, s.banner.life / 0.5)) : '0';
    // Shop / wave box.
    for (const key of TOWER_ORDER) {
      cardEls[key].classList.toggle('picked', s.placingType === key);
      cardEls[key].classList.toggle('poor', s.gold < TOWER_TYPES[key].levels[0].cost);
    }
    els.starMeter.style.width = `${(s.starfall.charge / s.starfall.max) * 100}%`;
    els.starfallBtn.classList.toggle('ready', s.starfall.charge >= s.starfall.max);
    els.starfallBtn.classList.toggle('armed', s.starfall.targeting);
    if (s.mode === 'playing' && !s.waveActive) {
      const next = s.wave + 1;
      els.waveNext.innerHTML = s.wave === 0
        ? `<b>Stage 1:</b> ${wavePreview(1)}`
        : `Next — <b>Stage ${next}:</b> ${wavePreview(next)}<br>Auto in ${Math.ceil(s.interWave)}s${s.wave > 0 ? ` · call early for bonus shards` : ''}`;
      els.callbtn.disabled = false;
      els.callbtn.textContent = s.wave === 0 ? 'CALL STAGE 1 ▸' : `CALL STAGE ${next} ▸`;
    } else if (s.waveActive) {
      const left = s.spawnQueue.length + s.enemies.length;
      els.waveNext.innerHTML = `<b>Stage ${s.wave}</b> — ${left} construct${left === 1 ? '' : 's'} on the conduit`;
      els.callbtn.disabled = true;
      els.callbtn.textContent = 'STAGE RUNNING…';
    } else {
      els.callbtn.disabled = true;
    }
    els.speedBtn.textContent = s.speed === 2 ? '⏩ 2×' : '⏩ 1×';
    els.muteBtn.textContent = s.sfx.muted ? '🔇' : '🔊';
    els.pauseBtn.textContent = s.paused ? '▶' : '⏸';
    // Screens.
    els.title.style.display = s.mode === 'title' ? 'flex' : 'none';
    const showEnd = s.mode === 'victory' || s.mode === 'defeat';
    els.end.style.display = showEnd ? 'flex' : 'none';
    if (showEnd && lastMode !== s.mode) {
      const win = s.mode === 'victory';
      els.endTitle.textContent = win ? STORY.victoryTitle : STORY.defeatTitle;
      els.endTitle.style.background = win
        ? 'linear-gradient(180deg,#fff3d6,#ffb35c 55%,#e06f00)'
        : 'linear-gradient(180deg,#cfd8ff,#5f739e 60%,#232a44)';
      els.endTitle.style.webkitBackgroundClip = 'text';
      els.endTitle.style.backgroundClip = 'text';
      els.endTitle.style.color = 'transparent';
      els.endText.textContent = win ? STORY.victoryText : STORY.defeatText;
      const mm = String(Math.floor(s.stats.time / 60)).padStart(2, '0');
      const ss = String(Math.floor(s.stats.time % 60)).padStart(2, '0');
      els.endStats.innerHTML =
        `<div>Stages held <b>${s.wave}</b></div><div>Constructs shattered <b>${s.kills}</b></div>`
        + `<div>Shards earned <b>${s.stats.goldEarned}⛃</b></div><div>Light torn out <b>${s.stats.leaks}</b></div>`
        + `<div>Time held <b>${mm}:${ss}</b></div><div>Final score <b>${s.score}</b></div>`;
      els.endlessBtn.style.display = win ? 'inline-block' : 'none';
    }
    // Intel card.
    const showIntel = s.mode === 'intel';
    els.intel.style.display = showIntel ? 'flex' : 'none';
    if (showIntel && lastMode !== 'intel') {
      if (s.intelBoss) {
        const final = s.wave + 1 >= ECONOMY.maxStage;
        els.intelTitle.textContent = final ? '⚠ THE STAR-EATER ⚠' : '⚠ DREADNOUGHT INBOUND ⚠';
        els.intelName.textContent = final ? 'THE STAR-EATER' : 'DREADNOUGHT';
        els.intelTrait.textContent = final ? STORY.finalBoss : STORY.bossWarning;
      } else if (s.intelType) {
        const def = ENEMY_TYPES[s.intelType];
        els.intelTitle.textContent = '⚠ NEW HOSTILE ⚠';
        els.intelName.textContent = def.name.toUpperCase();
        els.intelTrait.textContent = def.trait;
      }
    }
    lastMode = s.mode;
    refreshPanel(s);
    refreshChoices(s);
    // Atmosphere: the screen itself darkens as the star is drained.
    els.lowLight.style.opacity = s.lives <= 5 ? '0.85' : s.lives <= 10 ? '0.4' : '0';
    if (s.leakFlashT > 0) {
      els.leakFlash.style.opacity = String(Math.min(0.9, s.leakFlashT));
      s.leakFlashT = Math.max(0, s.leakFlashT - dt * 1.4);
    } else {
      els.leakFlash.style.opacity = '0';
    }
  }

  return { refresh, els };
}
