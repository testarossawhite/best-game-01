// STARFORGE DEFENSE 3D — model builders: every tower and enemy as a
// small three.js build of primitives with canvas-free materials. Towers
// are rebuilt when their level/spec changes; enemies are pooled by the
// renderer. Each build returns named parts the renderer animates.
import * as THREE from 'three';
import { TOWER_TYPES, ENEMY_TYPES } from './config.js';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const sph = (r, mat, w = 14, h = 10) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
const cone = (r, h, mat, seg = 10) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
const octa = (r, mat) => new THREE.Mesh(new THREE.OctahedronGeometry(r), mat);

export const metalMat = (color, rough = 0.42, metal = 0.35) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
export const emissiveMat = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

// ---------------------------------------------------------------- towers
function towerBase(g, accent) {
  const base = cyl(1.02, 1.22, 0.34, metalMat(0x6480b0, 0.45, 0.4));
  base.position.y = 0.17;
  g.add(base);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 28), emissiveMat(accent, 1.1));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.36;
  g.add(trim);
}

function buildBolt(level, spec) {
  const g = new THREE.Group();
  const def = TOWER_TYPES.bolt;
  towerBase(g, def.color);
  const h = 1.35 + level * 0.34;
  const spire = cyl(0.26, 0.58, h, metalMat(0x7d9cc9, 0.38, 0.45));
  spire.position.y = 0.34 + h / 2;
  g.add(spire);
  for (let i = 0; i <= level; i++) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.44 - i * 0.07, 0.045, 8, 20), emissiveMat(def.color, 0.9));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.6 + i * (h / (level + 1.4));
    g.add(collar);
  }
  const head = new THREE.Group();
  head.position.y = 0.34 + h + 0.18;
  const crystalMat = emissiveMat(0x7df9ff, 2.6);
  if (spec === 'dual') {
    for (const dx of [-0.3, 0.3]) {
      const claw = box(0.16, 0.4, 0.16, metalMat(0x6480b0));
      claw.position.set(dx, -0.1, 0);
      head.add(claw);
      const cry = octa(0.24, crystalMat);
      cry.position.set(dx, 0.22, 0);
      head.add(cry);
    }
  } else if (spec === 'rail') {
    for (const dz of [-0.17, 0.17]) {
      const rail = box(1.7, 0.09, 0.09, metalMat(0x9db8dd, 0.32, 0.5));
      rail.position.set(0.55, 0.05, dz);
      head.add(rail);
    }
    const cry = octa(0.27, crystalMat);
    cry.position.set(0.1, 0.05, 0);
    head.add(cry);
  } else {
    const claw = box(0.2, 0.46, 0.2, metalMat(0x6480b0));
    claw.position.y = -0.08;
    head.add(claw);
    const cry = octa(0.3 + level * 0.04, crystalMat);
    cry.position.y = 0.26;
    head.add(cry);
  }
  g.add(head);
  return { group: g, head, accentMats: [crystalMat], topY: head.position.y + 0.3 };
}

function buildFrost(level, spec) {
  const g = new THREE.Group();
  const def = TOWER_TYPES.frost;
  towerBase(g, def.color);
  const tall = spec === 'deepfreeze' ? 0.55 : 0;
  const h = 1.9 + level * 0.3 + tall;
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xcfeeff, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.94,
    emissive: 0x7cc4ea, emissiveIntensity: 0.35,
  });
  const obelisk = cyl(0.3, spec === 'shatter' ? 0.78 : 0.6, h, iceMat, 4);
  obelisk.position.y = 0.34 + h / 2;
  obelisk.rotation.y = Math.PI / 4;
  g.add(obelisk);
  const head = new THREE.Group();
  head.position.y = 0.34 + h + 0.15;
  const cryMat = emissiveMat(0xaee9ff, 2.4);
  const cry = octa(spec === 'shatter' ? 0.44 : 0.34, cryMat);
  head.add(cry);
  g.add(head);
  let orbit = null;
  if (level >= 2) {
    orbit = new THREE.Group();
    orbit.position.y = 0.34 + h * 0.62;
    for (let i = 0; i < 3; i++) {
      const shard = octa(0.13, cryMat);
      const a = (i / 3) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
      orbit.add(shard);
    }
    g.add(orbit);
  }
  return { group: g, head, accentMats: [cryMat], topY: head.position.y + 0.2, orbit };
}

function buildMortar(level, spec) {
  const g = new THREE.Group();
  const def = TOWER_TYPES.mortar;
  towerBase(g, def.color);
  const tiers = 2 + (level >= 1 ? 1 : 0);
  let y = 0.34;
  for (let i = 0; i < tiers; i++) {
    const r = 0.78 - i * 0.16;
    const tier = cyl(r, r + 0.1, 0.52, metalMat(i === 0 ? 0xb07a4a : 0xc98f56, 0.55, 0.3));
    tier.position.y = y + 0.26;
    g.add(tier);
    y += 0.52;
  }
  const slit = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 24), emissiveMat(0xff7b00, 2.2));
  slit.rotation.x = Math.PI / 2;
  slit.position.y = 0.62;
  g.add(slit);
  const head = new THREE.Group();
  head.position.y = y + 0.1;
  if (spec === 'cluster') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const tube = cyl(0.11, 0.13, 0.85, metalMat(0x6480b0, 0.38, 0.45), 10);
      tube.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3);
      tube.rotation.z = -0.5;
      tube.rotation.y = -a;
      head.add(tube);
    }
  } else {
    const tube = cyl(0.17, 0.21, 1.05, metalMat(0x6480b0, 0.38, 0.45), 12);
    tube.position.set(0.18, 0.34, 0);
    tube.rotation.z = -0.6;
    head.add(tube);
    if (spec === 'napalm') {
      const tankMat = emissiveMat(0xff9e2c, 1.2);
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 10), metalMat(0xd98a3a, 0.45, 0.3));
      tank.position.set(-0.62, 0.1, 0.35);
      head.add(tank);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 16), tankMat);
      band.rotation.x = Math.PI / 2;
      band.position.copy(tank.position);
      head.add(band);
    }
  }
  g.add(head);
  return { group: g, head, accentMats: [slit.material], topY: head.position.y + 0.6 };
}

function buildTesla(level, spec) {
  const g = new THREE.Group();
  const def = TOWER_TYPES.tesla;
  towerBase(g, def.color);
  const h = 2.0 + level * 0.3;
  const mast = cyl(0.13, 0.2, h, metalMat(0x8a7cc0, 0.4, 0.4));
  mast.position.y = 0.34 + h / 2;
  g.add(mast);
  const ringMat = emissiveMat(0xb07dff, 1.7);
  const rings = 3 + level;
  for (let i = 0; i < rings; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52 - i * 0.07, 0.05, 8, 22), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.75 + i * ((h - 0.5) / rings);
    g.add(ring);
  }
  const head = new THREE.Group();
  head.position.y = 0.34 + h + 0.22;
  const orbMat = emissiveMat(0xd0a2ff, 2.8);
  const orb = sph(spec === 'overcharge' ? 0.46 : 0.33, orbMat, 18, 14);
  head.add(orb);
  if (spec === 'overcharge') {
    const extra = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24), ringMat);
    extra.rotation.x = Math.PI / 2;
    head.add(extra);
  }
  if (spec === 'storm') {
    for (const dz of [-0.85, 0.85]) {
      const arm = box(0.1, 0.1, 0.8, metalMat(0x6480b0));
      arm.position.set(0, 0, dz * 0.55);
      head.add(arm);
      const side = sph(0.2, orbMat, 12, 10);
      side.position.set(0, 0.05, dz);
      head.add(side);
    }
  }
  g.add(head);
  return { group: g, head, accentMats: [orbMat, ringMat], topY: head.position.y + 0.3 };
}

export function buildTowerModel(type, level, spec) {
  if (type === 'bolt') return buildBolt(level, spec);
  if (type === 'frost') return buildFrost(level, spec);
  if (type === 'mortar') return buildMortar(level, spec);
  return buildTesla(level, spec);
}

// ---------------------------------------------------------------- enemies
function enemyMats(def) {
  // Body near the type's own vivid colour so every construct reads as a
  // bright, chunky toy of its hue; the dark tone only shades the mix.
  const mid = new THREE.Color(def.color).lerp(new THREE.Color(def.dark), 0.25);
  const body = new THREE.MeshStandardMaterial({
    color: mid, roughness: 0.55, metalness: 0.1,
    emissive: def.color, emissiveIntensity: 0.32,
  });
  const accent = emissiveMat(def.color, 1.9);
  return { body, accent };
}

function shieldBubble(radius) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf06fd8, transparent: true, opacity: 0.16, roughness: 0.2,
    emissive: 0xb5179e, emissiveIntensity: 0.7, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.078, 18, 14), mat);
  m.visible = false;
  return m;
}

export function buildEnemyModel(type) {
  const def = ENEMY_TYPES[type];
  const { body, accent } = enemyMats(def);
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const R = def.radius * 0.045; // rough body scale in world units
  let topY = 1;
  if (type === 'grunt') {
    const torso = box(1.1, 1.15, 0.7, body); torso.position.y = 1.05; inner.add(torso);
    const head = box(0.55, 0.5, 0.55, body); head.position.y = 1.95; inner.add(head);
    const eyes = box(0.4, 0.09, 0.06, accent); eyes.position.set(0, 2.0, 0.3); inner.add(eyes);
    for (const s of [-1, 1]) {
      const sh = box(0.42, 0.3, 0.8, body); sh.position.set(s * 0.78, 1.5, 0); inner.add(sh);
      const leg = box(0.34, 0.55, 0.4, body); leg.position.set(s * 0.3, 0.28, 0); inner.add(leg);
    }
    const core = sph(0.14, accent, 10, 8); core.position.set(0, 1.1, 0.38); inner.add(core);
    topY = 2.35;
  } else if (type === 'runner' || type === 'lancer' || type === 'lancerprime') {
    const dart = cone(0.42, 1.9, body, 8);
    dart.rotation.z = -Math.PI / 2;
    dart.position.y = 0.62;
    inner.add(dart);
    const stripe = box(1.1, 0.1, 0.12, accent); stripe.position.set(-0.1, 0.86, 0); inner.add(stripe);
    for (const s of [-1, 1]) {
      const fin = box(0.55, 0.06, 0.4, body);
      fin.position.set(-0.6, 0.55, s * 0.35);
      fin.rotation.y = s * 0.5;
      inner.add(fin);
    }
    const eye = sph(0.13, accent, 10, 8); eye.position.set(0.75, 0.68, 0); inner.add(eye);
    topY = 1.25;
  } else if (type === 'swarm' || type === 'mite') {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(type === 'swarm' ? 0.42 : 0.3, 0), body);
    rock.position.y = 0.45;
    inner.add(rock);
    const core = sph(0.14, accent, 8, 8); core.position.y = 0.45; inner.add(core);
    topY = 1.0;
  } else if (type === 'shielded') {
    const torso = box(1.0, 1.3, 0.65, body); torso.position.y = 1.1; inner.add(torso);
    const head = box(0.5, 0.45, 0.5, body); head.position.y = 2.0; inner.add(head);
    const shield = cyl(0.85, 0.85, 0.14, accent, 22);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0, 1.15, 0.62);
    inner.add(shield);
    const legL = box(0.32, 0.5, 0.38, body); legL.position.set(-0.28, 0.25, 0); inner.add(legL);
    const legR = legL.clone(); legR.position.x = 0.28; inner.add(legR);
    topY = 2.4;
  } else if (type === 'splitter') {
    const sac = sph(0.95, new THREE.MeshStandardMaterial({
      color: def.color, roughness: 0.35, metalness: 0.1, emissive: def.color, emissiveIntensity: 0.3,
    }), 20, 16);
    sac.position.y = 1.0;
    sac.name = 'sac';
    inner.add(sac);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const wart = sph(0.2, accent, 8, 8);
      wart.position.set(Math.cos(a) * 0.8, 1.0 + Math.sin(a * 2) * 0.4, Math.sin(a) * 0.8);
      inner.add(wart);
    }
    const eye = sph(0.16, accent, 10, 8); eye.position.set(0, 1.35, 0.85); inner.add(eye);
    topY = 2.2;
  } else if (type === 'tank' || type === 'tankprime') {
    const big = type === 'tankprime' ? 1.22 : 1;
    const hull = box(1.7 * big, 1.1 * big, 1.15 * big, body); hull.position.y = 0.95 * big; inner.add(hull);
    const plate = box(0.25, 1.0 * big, 1.3 * big, accent); plate.position.set(0.95 * big, 0.95 * big, 0); inner.add(plate);
    const top = box(1.1 * big, 0.5 * big, 0.9 * big, body); top.position.y = 1.75 * big; inner.add(top);
    const dome = sph(0.42 * big, body, 14, 10); dome.position.y = 2.1 * big; inner.add(dome);
    const core = sph(0.2 * big, accent, 10, 8); core.position.set(0.4, 1.05 * big, 0.61 * big); inner.add(core);
    for (const s of [-1, 1]) {
      const tread = box(1.9 * big, 0.55, 0.4, body);
      tread.position.set(0, 0.28, s * 0.78 * big);
      inner.add(tread);
      const sh = box(0.7 * big, 0.35, 0.3, body);
      sh.position.set(0.3, 1.6 * big, s * 0.72 * big);
      inner.add(sh);
    }
    if (type === 'tankprime') {
      const band = box(1.76 * big, 0.22, 1.2 * big, accent);
      band.position.y = 0.5 * big;
      inner.add(band);
    }
    topY = 2.6 * big;
  } else if (type === 'mender') {
    const core = octa(0.62, accent);
    core.position.y = 1.35;
    core.name = 'core';
    inner.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 26), body);
    ring.rotation.x = Math.PI / 2.3;
    ring.position.y = 1.35;
    ring.name = 'ring';
    inner.add(ring);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const orb = sph(0.16, accent, 8, 8);
      orb.position.set(Math.cos(a) * 1.05, 0.95, Math.sin(a) * 1.05);
      inner.add(orb);
    }
    topY = 2.3;
  } else if (type === 'aegis') {
    const torso = box(1.15, 1.35, 0.8, body); torso.position.y = 1.1; inner.add(torso);
    const plateF = box(0.18, 1.5, 1.25, accent);
    plateF.position.set(0.62, 1.1, 0);
    plateF.rotation.z = -0.12;
    inner.add(plateF);
    for (const s of [-1, 1]) {
      const plate = box(0.9, 1.1, 0.16, body);
      plate.position.set(0, 1.15, s * 0.5);
      inner.add(plate);
      const leg = box(0.34, 0.5, 0.4, body);
      leg.position.set(s * 0.3, 0.25, 0);
      inner.add(leg);
    }
    const head = box(0.5, 0.4, 0.5, body); head.position.y = 2.05; inner.add(head);
    const eye = box(0.34, 0.08, 0.06, accent); eye.position.set(0.2, 2.08, 0.26); inner.add(eye);
    topY = 2.45;
  } else if (type === 'boss') {
    const hull = cyl(1.5, 1.9, 2.2, body, 6);
    hull.position.y = 1.5;
    inner.add(hull);
    const deck2 = box(3.4, 0.6, 2.6, body); deck2.position.y = 2.8; inner.add(deck2);
    for (const s of [-1, 1]) {
      const pod = box(1.5, 1.1, 0.9, body);
      pod.position.set(-0.4, 1.1, s * 1.75);
      inner.add(pod);
      const spike = cone(0.3, 1.3, accent, 6);
      spike.position.set(0.6, 3.6, s * 0.9);
      inner.add(spike);
    }
    for (let i = 0; i < 3; i++) {
      const core = sph(0.34 - i * 0.06, accent, 12, 10);
      core.position.set(1.35 - i * 0.25, 1.6 + i * 0.55, 0);
      inner.add(core);
    }
    const crown = cone(0.5, 1.1, accent, 6);
    crown.position.y = 3.75;
    inner.add(crown);
    topY = 4.5;
  }
  const bubble = shieldBubble(def.radius);
  bubble.position.y = topY * 0.5;
  g.add(bubble);
  return { group: g, inner, mats: { body, accent }, bubble, topY };
}
