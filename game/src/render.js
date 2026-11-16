// STARFORGE DEFENSE 3D — the renderer: mirrors game state into the
// three.js scene every frame. Towers and enemies get pooled model views;
// projectiles, beams, arcs, particles, rings and floating texts are
// transient views over the fx/logic state. No game rules live here.
import * as THREE from 'three';
import { CORE, PLOTS, TOWER_TYPES, ENEMY_TYPES, toWorld } from './config.js';
import { buildTowerModel, buildEnemyModel, emissiveMat } from './models.js';
import { animateWorld, mulberry } from './world.js';

function glowSprite(color, scale, opacity = 0.9) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity,
  }));
  spr.scale.set(scale, scale, 1);
  return spr;
}

function starburstSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry(31337);
  g.translate(128, 128);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const len = 60 + rnd() * 62;
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grad.addColorStop(0, 'rgba(255,240,190,0.95)');
    grad.addColorStop(1, 'rgba(255,160,40,0)');
    g.strokeStyle = grad;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  return spr;
}

// Floating combat text: a small pool of canvas sprites, redrawn on use.
class TextPool {
  constructor(scene, n = 14) {
    this.items = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      const tex = new THREE.CanvasTexture(c);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(4.6, 1.15, 1);
      spr.visible = false;
      scene.add(spr);
      this.items.push({ spr, canvas: c, tex, key: '' });
    }
  }
  sync(texts) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const t = texts[i];
      if (!t) { it.spr.visible = false; continue; }
      const key = `${t.text}|${t.color}`;
      if (it.key !== key) {
        it.key = key;
        const g = it.canvas.getContext('2d');
        g.clearRect(0, 0, 256, 64);
        g.font = '700 30px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,0.85)';
        g.shadowBlur = 6;
        g.fillStyle = t.color;
        g.fillText(t.text, 128, 32);
        it.tex.needsUpdate = true;
      }
      const w = toWorld(t.x, t.y);
      it.spr.position.set(w.x, 2.6, w.z);
      it.spr.material.opacity = Math.min(1, t.life / (t.maxLife * 0.5));
      it.spr.visible = true;
    }
  }
}

export function createRenderer(world) {
  const { scene, camera } = world;
  const R = {
    world,
    towerViews: new Map(),
    enemyViews: new Map(),
    projViews: new Map(),
    beams: new Map(),
    arcPool: [],
    ringPool: [],
    texts: new TextPool(scene),
    camBase: camera.position.clone(),
    camTarget: new THREE.Vector3(-2.5, 0, -1.5),
  };
  // Projectile + effect scratch groups.
  R.fxGroup = new THREE.Group();
  scene.add(R.fxGroup);
  // Range indicator (selection / placement).
  R.rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  R.rangeRing.rotation.x = -Math.PI / 2;
  R.rangeRing.position.y = 0.3;
  R.rangeRing.visible = false;
  scene.add(R.rangeRing);
  // Particle points.
  const pGeo = new THREE.BufferGeometry();
  R.pMax = 900;
  R.pPos = new Float32Array(R.pMax * 3);
  R.pCol = new Float32Array(R.pMax * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(R.pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(R.pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.34, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  R.points = new THREE.Points(pGeo, pMat);
  R.points.frustumCulled = false;
  scene.add(R.points);
  // Tesla arc segments: thin glowing boxes, pooled.
  for (let i = 0; i < 42; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xd8b8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    R.arcPool.push(m);
  }
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.32;
    m.visible = false;
    scene.add(m);
    R.ringPool.push(m);
  }
  // Starfall fragment + burst.
  R.starFrag = glowSprite('rgba(255,230,160,0.95)', 3.2);
  R.starFrag.visible = false;
  scene.add(R.starFrag);
  R.starTrail = glowSprite('rgba(255,180,80,0.75)', 6);
  R.starTrail.visible = false;
  scene.add(R.starTrail);
  R.starBurst = starburstSprite();
  R.starBurst.visible = false;
  scene.add(R.starBurst);
  // Showcase model (intel card display).
  R.showcaseView = null;
  R.showcaseType = null;
  return R;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _col = new THREE.Color();

function placeBeam(R, beam, ax, ay, az, bx, by, bz) {
  _v1.set(ax, ay, az);
  _v2.set(bx, by, bz);
  const mid = _v1.clone().add(_v2).multiplyScalar(0.5);
  const dir = _v2.clone().sub(_v1);
  const len = dir.length();
  beam.position.copy(mid);
  beam.scale.set(1, len, 1);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

function syncTowers(R, state) {
  const { scene } = R.world;
  const seen = new Set();
  const starW = toWorld(CORE.x, CORE.y);
  for (const t of state.towers) {
    seen.add(t.id);
    let view = R.towerViews.get(t.id);
    if (!view || view.level !== t.level || view.spec !== t.spec) {
      if (view) { scene.remove(view.model.group); }
      const model = buildTowerModel(t.type, t.level, t.spec);
      const w = toWorld(t.x, t.y);
      model.group.position.set(w.x, 0.22, w.z);
      model.group.scale.setScalar(1.18);
      scene.add(model.group);
      const flash = glowSprite(TOWER_TYPES[t.type].accent === '#7df9ff' ? 'rgba(160,240,255,0.9)' : 'rgba(255,210,140,0.9)', 2.2, 0);
      flash.position.set(w.x, model.topY + 0.3, w.z);
      scene.add(flash);
      view = { model, level: t.level, spec: t.spec, flash, w };
      R.towerViews.set(t.id, view);
      // Starlight feed beam from the star to this tower.
      const old = R.beams.get(t.id);
      if (old) { scene.remove(old.grp); }
      const grp = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      grp.add(cyl);
      const pulses = [];
      for (let i = 0; i < 2; i++) {
        const p = glowSprite('rgba(255,210,130,0.9)', 0.85);
        grp.add(p);
        pulses.push(p);
      }
      scene.add(grp);
      placeBeam(R, cyl, starW.x, 2.2, starW.z, w.x, model.topY * 0.7, w.z);
      R.beams.set(t.id, { grp, cyl, pulses, from: { x: starW.x, y: 2.2, z: starW.z }, to: { x: w.x, y: model.topY * 0.7, z: w.z }, off: (t.id % 7) / 7 });
    }
    view.model.head.rotation.y = -t.angle;
    if (view.model.orbit) view.model.orbit.rotation.y = state.time * 1.4;
    const flashK = t.flash > 0 ? t.flash / 0.09 : 0;
    view.flash.material.opacity = flashK * 0.85;
    view.flash.scale.setScalar(1.6 + flashK * 1.2);
    for (const m of view.model.accentMats) {
      m.emissiveIntensity = 2 + flashK * 5 + (t.arcTimer > 0 ? 2.5 : 0);
    }
  }
  for (const [id, view] of R.towerViews) {
    if (!seen.has(id)) {
      scene.remove(view.model.group);
      scene.remove(view.flash);
      R.towerViews.delete(id);
      const beam = R.beams.get(id);
      if (beam) { scene.remove(beam.grp); R.beams.delete(id); }
    }
  }
  // Beam pulses travel star -> tower.
  for (const beam of R.beams.values()) {
    beam.pulses.forEach((p, i) => {
      const k = (state.time * 0.55 + beam.off + i * 0.5) % 1;
      p.position.set(
        beam.from.x + (beam.to.x - beam.from.x) * k,
        beam.from.y + (beam.to.y - beam.from.y) * k,
        beam.from.z + (beam.to.z - beam.from.z) * k,
      );
    });
  }
  // Plot rings: brighten the hovered / selected plot.
  for (const plot of R.world.plots) {
    const active = state.hoverPlot === plot.index || (state.selectedTower && state.selectedTower.plotIndex === plot.index);
    plot.ringMat.emissiveIntensity = active ? 2.4 : 0.55 + Math.sin(state.time * 2 + plot.index) * 0.12;
  }
}

function syncEnemies(R, state) {
  const { scene } = R.world;
  const seen = new Set();
  for (const e of state.enemies) {
    seen.add(e.id);
    let view = R.enemyViews.get(e.id);
    if (!view) {
      const model = buildEnemyModel(e.type);
      scene.add(model.group);
      const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14060a, transparent: true, opacity: 0.85, depthWrite: false }));
      barBg.scale.set(1.7, 0.2, 1);
      scene.add(barBg);
      const barFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.95, depthWrite: false }));
      barFg.scale.set(1.6, 0.12, 1);
      scene.add(barFg);
      const barSh = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xf06fd8, transparent: true, opacity: 0.9, depthWrite: false }));
      barSh.scale.set(1.6, 0.07, 1);
      barSh.visible = false;
      scene.add(barSh);
      view = { model, barBg, barFg, barSh, baseColor: model.mats.body.color.getHex() };
      R.enemyViews.set(e.id, view);
    }
    const w = toWorld(e.x, e.y);
    const bob = Math.abs(Math.sin(e.wobble)) * 0.09;
    view.model.group.position.set(w.x, bob, w.z);
    view.model.group.rotation.y = -e.angle;
    view.model.group.scale.setScalar(e.scale * 1.15);
    view.model.inner.rotation.x = Math.sin(e.wobble) * 0.045;
    if (e.type === 'splitter') {
      const s = 1 + Math.sin(state.time * 5 + e.id) * 0.06;
      view.model.inner.scale.setScalar(s);
    }
    if (e.type === 'mender') view.model.inner.rotation.y = state.time * 1.2;
    const flashK = e.hitFlash > 0 ? e.hitFlash / 0.08 : 0;
    view.model.mats.body.emissiveIntensity = 0.25 + flashK * 1.8;
    if (e.slowTimer > 0) view.model.mats.body.color.setHex(0x2a5a7a);
    else view.model.mats.body.color.setHex(view.baseColor);
    if (e.burnTimer > 0) view.model.mats.accent.emissiveIntensity = 2.6 + Math.sin(state.time * 31) * 0.8;
    else view.model.mats.accent.emissiveIntensity = 1.9;
    view.model.bubble.visible = e.shield > 0;
    // Bars.
    const frac = Math.max(0, e.hp / e.maxHp);
    const showBar = e.type !== 'boss' && (frac < 1 || e.shield > 0);
    const by = view.model.topY * e.scale + 0.55 + bob;
    view.barBg.visible = showBar;
    view.barFg.visible = showBar;
    view.barSh.visible = showBar && e.shield > 0;
    if (showBar) {
      view.barBg.position.set(w.x, by, w.z);
      view.barFg.position.set(w.x - (1 - frac) * 0.8, by, w.z);
      view.barFg.scale.x = 1.6 * frac;
      view.barFg.material.color.setHex(frac > 0.5 ? 0x7dff6a : frac > 0.25 ? 0xffd166 : 0xff5c5c);
      if (e.shield > 0) {
        const sf = Math.min(1, e.shield / Math.max(1, e.maxShield));
        view.barSh.position.set(w.x - (1 - sf) * 0.8, by + 0.16, w.z);
        view.barSh.scale.x = 1.6 * sf;
      }
    }
  }
  for (const [id, view] of R.enemyViews) {
    if (!seen.has(id)) {
      scene.remove(view.model.group);
      scene.remove(view.barBg);
      scene.remove(view.barFg);
      scene.remove(view.barSh);
      R.enemyViews.delete(id);
    }
  }
}

function syncProjectiles(R, state) {
  const { scene } = R.world;
  const seen = new Set();
  for (const p of state.projectiles) {
    seen.add(p);
    let view = R.projViews.get(p);
    if (!view) {
      let mesh;
      if (p.kind === 'bolt') {
        mesh = glowSprite('rgba(160,240,255,0.95)', 1.15);
      } else if (p.kind === 'frost') {
        mesh = new THREE.Group();
        const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), emissiveMat(0xaee9ff, 2.4));
        mesh.add(cry);
        mesh.add(glowSprite('rgba(150,220,255,0.8)', 1.0));
      } else if (p.kind === 'shell') {
        mesh = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0xff7b00, emissiveIntensity: 1.6, roughness: 0.5 }));
        mesh.add(ball);
        mesh.add(glowSprite('rgba(255,160,70,0.85)', 1.3));
      } else { // rail
        mesh = new THREE.Group();
        const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.09, 0.09),
          new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.position.x = -1.2;
        mesh.add(beam);
        mesh.add(glowSprite('rgba(160,240,255,0.9)', 1.5));
      }
      scene.add(mesh);
      view = { mesh };
      R.projViews.set(p, view);
    }
    if (p.kind === 'shell') {
      const k = Math.min(1, p.t / p.flight);
      const a = toWorld(p.x, p.y);
      const b = toWorld(p.tx, p.ty);
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      view.mesh.position.set(
        a.x + (b.x - a.x) * k,
        2 + Math.sin(k * Math.PI) * (1.2 + dist * 0.16),
        a.z + (b.z - a.z) * k,
      );
    } else if (p.kind === 'rail') {
      const w = toWorld(p.x, p.y);
      view.mesh.position.set(w.x, 2.1, w.z);
      view.mesh.rotation.y = -Math.atan2(p.dy, p.dx);
    } else {
      const w = toWorld(p.x, p.y);
      view.mesh.position.set(w.x, 1.9, w.z);
      view.mesh.rotation.y = state.time * 6;
    }
  }
  for (const [p, view] of R.projViews) {
    if (!seen.has(p)) {
      scene.remove(view.mesh);
      R.projViews.delete(p);
    }
  }
}

function syncFx(R, state) {
  // Tesla arcs as jittered segment chains.
  let ai = 0;
  for (const arc of state.fx.arcs) {
    const pts = arc.points.map((pt) => {
      const w = toWorld(pt.x, pt.y);
      return { x: w.x, y: pt.top ? 3.4 : 1.3, z: w.z };
    });
    for (let i = 0; i < pts.length - 1 && ai < R.arcPool.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const segs = 2;
      let prev = a;
      for (let sIdx = 1; sIdx <= segs && ai < R.arcPool.length; sIdx++) {
        const k = sIdx / segs;
        const cur = sIdx === segs ? b : {
          x: a.x + (b.x - a.x) * k + (Math.random() - 0.5) * 0.5,
          y: a.y + (b.y - a.y) * k + (Math.random() - 0.5) * 0.5,
          z: a.z + (b.z - a.z) * k + (Math.random() - 0.5) * 0.5,
        };
        const m = R.arcPool[ai++];
        _v1.set(prev.x, prev.y, prev.z);
        _v2.set(cur.x, cur.y, cur.z);
        const len = _v1.distanceTo(_v2);
        m.position.copy(_v1).add(_v2).multiplyScalar(0.5);
        m.scale.set(len, 1, 1);
        m.lookAt(_v2);
        m.rotateY(Math.PI / 2);
        m.material.opacity = 0.9 * (arc.life / arc.maxLife);
        m.visible = true;
        prev = cur;
      }
    }
  }
  for (; ai < R.arcPool.length; ai++) R.arcPool[ai].visible = false;
  // Shockwave rings.
  state.fx.rings.forEach((r, i) => {
    if (i >= R.ringPool.length) return;
    const m = R.ringPool[i];
    const w = toWorld(r.x, r.y);
    m.position.set(w.x, 0.32, w.z);
    m.scale.setScalar(Math.max(0.01, r.r * 0.05));
    m.material.color.set(r.color);
    m.material.opacity = 0.7 * (r.life / r.maxLife);
    m.visible = true;
  });
  for (let i = state.fx.rings.length; i < R.ringPool.length; i++) R.ringPool[i].visible = false;
  // Particles.
  const parts = state.fx.particles;
  const n = Math.min(parts.length, R.pMax);
  for (let i = 0; i < n; i++) {
    const p = parts[i];
    const w = toWorld(p.x, p.y);
    const age = 1 - p.life / p.maxLife;
    R.pPos[i * 3] = w.x;
    R.pPos[i * 3 + 1] = (p.kind === 'shard' ? 0.5 : 0.9) + age * 1.5;
    R.pPos[i * 3 + 2] = w.z;
    _col.set(p.color).multiplyScalar(1 - age * 0.6);
    R.pCol[i * 3] = _col.r;
    R.pCol[i * 3 + 1] = _col.g;
    R.pCol[i * 3 + 2] = _col.b;
  }
  R.points.geometry.setDrawRange(0, n);
  R.points.geometry.attributes.position.needsUpdate = true;
  R.points.geometry.attributes.color.needsUpdate = true;
  R.texts.sync(state.fx.texts);
  // STARFALL: fragment streaks down, then the burst flash.
  const ev = state.starfallEvents[0];
  if (ev) {
    const w = toWorld(ev.x, ev.y);
    if (!ev.struck) {
      const k = Math.min(1, ev.t / 0.35);
      const sx = w.x - 7 * (1 - k);
      const sy = 16 * (1 - k) + 1;
      const sz = w.z - 4 * (1 - k);
      R.starFrag.position.set(sx, sy, sz);
      R.starFrag.visible = true;
      R.starTrail.position.set(sx - 1.8, sy + 2.2, sz - 1);
      R.starTrail.scale.set(9 + k * 5, 2.6, 1);
      R.starTrail.material.rotation = 0.85;
      R.starTrail.visible = true;
      R.starBurst.visible = false;
    } else {
      R.starFrag.visible = false;
      R.starTrail.visible = false;
      const k = Math.min(1, (ev.t - 0.35) / 0.45);
      R.starBurst.position.set(w.x, 1.6, w.z);
      R.starBurst.scale.setScalar(4 + k * 11);
      R.starBurst.material.opacity = (1 - k) * 0.95;
      R.starBurst.material.rotation = k * 0.7;
      R.starBurst.visible = true;
    }
  } else {
    R.starFrag.visible = false;
    R.starTrail.visible = false;
    R.starBurst.visible = false;
  }
}

export function syncRender(R, state, dt) {
  const world = R.world;
  syncTowers(R, state);
  syncEnemies(R, state);
  syncProjectiles(R, state);
  syncFx(R, state);
  // Range ring for selection / placement hover.
  const ringFor = state.selectedTower
    ? { x: state.selectedTower.x, y: state.selectedTower.y, type: state.selectedTower.type, tower: state.selectedTower }
    : state.placingType && state.hoverPlot !== null
      ? { x: PLOTS[state.hoverPlot].x, y: PLOTS[state.hoverPlot].y, type: state.placingType, tower: null }
      : null;
  if (ringFor) {
    const range = ringFor.tower
      ? (state.towerRange ? state.towerRange(ringFor.tower) : 120)
      : (TOWER_TYPES[ringFor.type].levels[0].range);
    const w = toWorld(ringFor.x, ringFor.y);
    R.rangeRing.position.set(w.x, 0.3, w.z);
    R.rangeRing.scale.setScalar(range * 0.05);
    R.rangeRing.visible = true;
  } else {
    R.rangeRing.visible = false;
  }
  // Showcase: the intel card's hostile, turning on its pedestal.
  if (state.intelType) {
    if (R.showcaseType !== state.intelType) {
      if (R.showcaseView) world.showcase.anchor.remove(R.showcaseView.group);
      R.showcaseView = buildEnemyModel(state.intelType);
      R.showcaseView.group.scale.setScalar(state.intelType === 'boss' ? 0.62 : 1.15);
      world.showcase.anchor.add(R.showcaseView.group);
      R.showcaseType = state.intelType;
    }
  } else if (R.showcaseView) {
    world.showcase.anchor.remove(R.showcaseView.group);
    R.showcaseView = null;
    R.showcaseType = null;
  }
  // Star health = remaining starlight; the star dims as it is drained.
  const health = Math.max(0, state.lives) / 20;
  animateWorld(world, dt, state.time, Math.min(1, health));
  // Camera: gentle idle drift + impact shake.
  const t = state.time;
  let sx = 0, sy = 0;
  if (state.fx.shakeAmp > 0) {
    sx = (Math.random() - 0.5) * state.fx.shakeAmp * 0.05;
    sy = (Math.random() - 0.5) * state.fx.shakeAmp * 0.05;
  }
  world.camera.position.set(
    R.camBase.x + Math.sin(t * 0.1) * 0.8 + sx,
    R.camBase.y + Math.sin(t * 0.073) * 0.5 + sy,
    R.camBase.z,
  );
  world.camera.lookAt(R.camTarget);
  world.renderer.render(world.scene, world.camera);
}
