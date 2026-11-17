// STARFORGE DEFENSE 3D — the world: renderer, deep-space backdrop, the
// floating forge deck, the molten conduit, build pads, deck props, and
// the captured star itself. Pure scene construction + ambient motion;
// gameplay objects (towers, enemies) live in models.js / render.js.
import * as THREE from 'three';
import { CORE, PATH_POINTS, PLOTS, PROPS, toWorld } from './config.js';
import { PATH_LENGTH, pathPointAt } from './map.js';

// Deterministic RNG for textures and dressing, so every load — and
// every screenshot — builds the identical scene.
export function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Brushed deck plating: panel grid, rivets, scratches, warm wear.
export function metalTexture() {
  const rnd = mulberry(1337);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#86a6cf';
    g.fillRect(0, 0, w, h);
    const panel = 128;
    for (let y = 0; y < h; y += panel) {
      for (let x = 0; x < w; x += panel) {
        const tint = 0.9 + rnd() * 0.24;
        g.fillStyle = `rgb(${126 * tint | 0},${156 * tint | 0},${205 * tint | 0})`;
        g.fillRect(x + 2, y + 2, panel - 4, panel - 4);
        g.strokeStyle = 'rgba(52,72,110,0.55)';
        g.lineWidth = 3;
        g.strokeRect(x + 1, y + 1, panel - 2, panel - 2);
        g.fillStyle = 'rgba(255,255,255,0.65)';
        for (const [rx, ry] of [[10, 10], [panel - 10, 10], [10, panel - 10], [panel - 10, panel - 10]]) {
          g.beginPath(); g.arc(x + rx, y + ry, 3, 0, 7); g.fill();
        }
      }
    }
    g.strokeStyle = 'rgba(200,215,255,0.06)';
    for (let i = 0; i < 260; i++) {
      g.beginPath();
      const x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 46, y + (rnd() - 0.5) * 8);
      g.stroke();
    }
  });
}

// The star's skin: granulated fire, bright cells over deep orange.
export function starTexture() {
  const rnd = mulberry(777);
  return canvasTexture(512, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff9a1f');
    grad.addColorStop(0.5, '#ff7b00');
    grad.addColorStop(1, '#ff9a1f');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 4.2;
      const hot = rnd() > 0.42;
      g.fillStyle = hot ? `rgba(255,${190 + rnd() * 60 | 0},60,${0.12 + rnd() * 0.25})`
        : `rgba(160,40,0,${0.10 + rnd() * 0.2})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = `rgba(255,246,200,${0.25 + rnd() * 0.4})`;
      g.beginPath(); g.arc(x, y, 0.8 + rnd() * 1.4, 0, 7); g.fill();
    }
  });
}

function glowTexture(inner, outer) {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, outer);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}



function planetTexture() {
  const rnd = mulberry(42);
  return canvasTexture(256, 128, (g, w, h) => {
    const bands = ['#7ec3ea', '#b39df2', '#6fd3c0', '#ffcf87', '#a58ae0', '#7fd0e0', '#ffb98a'];
    let y = 0;
    for (const b of bands) {
      const bh = 10 + rnd() * 16;
      g.fillStyle = b;
      g.fillRect(0, y, w, bh + 2);
      y += bh;
    }
    g.fillStyle = 'rgba(255,210,150,0.20)';
    g.beginPath(); g.ellipse(w * 0.62, h * 0.42, 26, 8, 0.3, 0, 7); g.fill();
  });
}

function textSprite(text, color, scale = 1) {
  const tex = canvasTexture(512, 64, (g, w, h) => {
    g.font = '700 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(30,50,110,0.9)';
    g.shadowBlur = 8;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(10 * scale, 1.25 * scale, 1);
  return spr;
}

const FRESNEL_VERT = `
varying vec3 vN; varying vec3 vW;
void main(){ vN = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz;
gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FRESNEL_FRAG = `
uniform vec3 uColor; uniform float uPow; uniform float uStrength;
varying vec3 vN; varying vec3 vW;
void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(v, normalize(vN))), uPow);
gl_FragColor = vec4(uColor, 1.0) * f * uStrength; }`;

export function fresnelMaterial(color, pow, strength) {
  return new THREE.ShaderMaterial({
    vertexShader: FRESNEL_VERT,
    fragmentShader: FRESNEL_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: pow }, uStrength: { value: strength } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x63b3ff);

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 900);
  camera.position.set(-2.5, 46, 41);
  camera.lookAt(-2.5, 0, -1.5);

  const world = { renderer, scene, camera, pulses: [], asteroids: [], plots: [], time: 0 };

  // --- light: a bright sky dome bounce, warm sun fill, and the star ---
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0xffe0b3, 1.5));
  scene.add(new THREE.AmbientLight(0xfff2dd, 0.55));
  const fill = new THREE.DirectionalLight(0xfff3d6, 1.6);
  fill.position.set(-30, 60, 50);
  scene.add(fill);

  buildSpace(world);
  buildDeck(world);
  buildConduit(world);
  buildPlots(world);
  buildProps(world);
  buildStar(world);
  buildShowcase(world);
  return world;
}

// The backdrop dome: a painted space texture on an inside-out sphere,
// so the sky is rich in every direction the camera can see. (With a
// high-angle camera the visible "sky" sits BELOW deck level at range —
// free-floating sprites placed by intuition kept landing off-frame.)
function backdropTexture() {
  const rnd = mulberry(4242);
  return canvasTexture(1024, 512, (g, w, h) => {
    // Cheerful daytime sky: deep azure up top melting into a warm,
    // hazy horizon, with a soft sun glow and puffy cartoon clouds.
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f7fe0');
    grad.addColorStop(0.45, '#5ea9ff');
    grad.addColorStop(0.75, '#8ec9ff');
    grad.addColorStop(1, '#bfe0ff');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.8, h * 0.16, 4, w * 0.8, h * 0.16, 190);
    sun.addColorStop(0, 'rgba(255,250,215,0.95)');
    sun.addColorStop(0.25, 'rgba(255,240,180,0.5)');
    sun.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    const blobs = [
      ['rgba(255,255,255,0.30)', 0.18, 0.52], ['rgba(255,255,255,0.26)', 0.78, 0.58],
      ['rgba(255,255,255,0.24)', 0.45, 0.66], ['rgba(255,235,250,0.20)', 0.62, 0.44],
      ['rgba(255,255,255,0.22)', 0.3, 0.72], ['rgba(255,244,214,0.22)', 0.9, 0.7],
    ];
    for (const [c, fx, fy] of blobs) {
      for (let i = 0; i < 26; i++) {
        const x = fx * w + (rnd() - 0.5) * 190, y = fy * h + (rnd() - 0.5) * 90;
        const r = 24 + rnd() * 70;
        const rg = g.createRadialGradient(x, y, 1, x, y, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    }
    // Puffy cloud clusters: overlapping white ellipses with soft shade.
    for (let i = 0; i < 34; i++) {
      const cx = rnd() * w, cy = h * (0.22 + rnd() * 0.42), s = 22 + rnd() * 46;
      for (let j = 0; j < 5; j++) {
        const x = cx + (rnd() - 0.5) * s * 1.7, y = cy + (rnd() - 0.5) * s * 0.4;
        g.fillStyle = `rgba(255,255,255,${0.22 + rnd() * 0.22})`;
        g.beginPath(); g.ellipse(x, y, s * (0.5 + rnd() * 0.5), s * 0.36, 0, 0, 7); g.fill();
      }
    }
    // A sparse daytime sparkle of far-off stars near the zenith.
    for (let i = 0; i < 500; i++) {
      const x = rnd() * w, y = rnd() * h * 0.4;
      g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.4})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
  });
}

function buildSpace(world) {
  const { scene, camera } = world;
  const rnd = mulberry(2024);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(470, 32, 20),
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, depthWrite: false, toneMapped: false }),
  );
  scene.add(dome);
  // Star points, kept only where the base camera can actually see them
  // (projected at build time) — a dense field in the real view corridor.
  const layers = [
    { n: 900, size: 2.1, op: 0.9 },
    { n: 480, size: 3.3, op: 1 },
    { n: 200, size: 4.2, op: 1 },
  ];
  world.starLayers = [];
  const probe = new THREE.Vector3();
  for (const L of layers) {
    const pos = [];
    const col = [];
    let guard = 0;
    while (pos.length < L.n * 3 && guard++ < L.n * 30) {
      const x = -190 + rnd() * 380;
      const y = -150 + rnd() * 175;
      const z = -55 - rnd() * 190;
      probe.set(x, y, z).project(camera);
      if (Math.abs(probe.x) > 1.06 || Math.abs(probe.y) > 1.06 || probe.z > 1) continue;
      pos.push(x, y, z);
      const t = rnd();
      const c = t > 0.85 ? [1, 0.85, 0.65] : t > 0.6 ? [0.8, 0.88, 1] : [0.95, 0.96, 1];
      col.push(c[0], c[1], c[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    const mat = new THREE.PointsMaterial({
      size: L.size, sizeAttenuation: false, vertexColors: true,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'),
      transparent: true, opacity: L.op, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    world.starLayers.push(pts);
  }
  // (v4: the old deep-space nebula sprites are gone — they washed the
  // bright sky out to grey. The painted dome carries the clouds now.)
  world.nebulae = [];
  // A distant banded planet, upper left of the frame.
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(13, 40, 28),
    new THREE.MeshBasicMaterial({ map: planetTexture(), color: 0xffffff, toneMapped: false }),
  );
  planet.position.set(-64, -56, -112);
  scene.add(planet);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,255,255,0.35)', 'rgba(190,220,255,0.14)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.position.copy(planet.position);
  halo.scale.set(38, 38, 1);
  scene.add(halo);
  world.planet = planet;
  // Drifting asteroids around the rim.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a8468, roughness: 1, flatShading: true });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 13; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const side = rnd();
    rock.position.set(-58 + rnd() * 116, -13 + rnd() * 13, side < 0.55 ? 27 + rnd() * 20 : -32 - rnd() * 16);
    const s = 0.4 + rnd() * 1.1;
    rock.scale.set(s, s * (0.6 + rnd() * 0.6), s);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.userData.spin = { x: (rnd() - 0.5) * 0.4, y: (rnd() - 0.5) * 0.4 };
    rock.userData.drift = (rnd() - 0.5) * 0.35;
    scene.add(rock);
    world.asteroids.push(rock);
  }
  // Occasional shooting stars cross the margins.
  world.meteors = [];
  const metMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,255,255,0.95)', 'rgba(160,200,255,0.35)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Sprite(metMat.clone());
    m.scale.set(16, 0.8, 1);
    m.visible = false;
    m.userData = { t: -i * 7 - 3, dur: 1.4, from: new THREE.Vector3(), to: new THREE.Vector3() };
    scene.add(m);
    world.meteors.push(m);
  }
  // Sky-island dressing: a warm sunlit glow far below the floating deck
  // and puffy cloud banks hugging its rim, so the forge reads as an
  // arena adrift in a bright sky rather than a slab in the void.
  const groundTex = canvasTexture(256, 256, (g, w, h) => {
    const rg = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,220,150,0.75)');
    rg.addColorStop(0.45, 'rgba(255,190,100,0.25)');
    rg.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(130, 40),
    new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-2.5, -110, 0);
  scene.add(ground);
  // (v4: rim cloud-puff sprites removed too — same grey wash problem;
  // the dome's painted clouds are enough.)
  world.cloudPuffs = [];
}

function buildDeck(world) {
  const { scene } = world;
  const deckTex = metalTexture();
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(3, 1.5);
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.6, metalness: 0.15 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(68, 1.4, 33), deckMat);
  deck.position.set(-2.5, -0.7, 0);
  scene.add(deck);
  // Rim: a glowing amber edge line and a painted blue hull below.
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(66, 1.6, 31),
    new THREE.MeshStandardMaterial({ color: 0x4a6ea8, roughness: 0.7, metalness: 0.2 }),
  );
  hull.position.set(-2.5, -2.2, 0);
  scene.add(hull);
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(68.15, 0.5, 33.15)),
    new THREE.LineBasicMaterial({ color: 0xff9e2c, transparent: true, opacity: 0.9 }),
  );
  rim.position.set(-2.5, -0.25, 0);
  scene.add(rim);
  // Engine glow beneath the hull.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,140,40,0.5)', 'rgba(255,90,20,0.18)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
  }));
  glow.position.set(-2.5, -4.5, 0);
  glow.scale.set(46, 10, 1);
  scene.add(glow);
  world.engineGlow = glow;
}

function buildConduit(world) {
  const { scene } = world;
  const chanMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.75, metalness: 0.25 });
  const moltenMat = new THREE.MeshStandardMaterial({
    color: 0xffa03c, emissive: 0xff8a1e, emissiveIntensity: 2.6, roughness: 0.6,
  });
  world.moltenMat = moltenMat;
  const chanGeo = new THREE.BoxGeometry(1, 0.14, 1.65);
  const molGeo = new THREE.BoxGeometry(1, 0.1, 0.85);
  const jointGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.14, 20);
  const jointMolGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.16, 20);
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = toWorld(PATH_POINTS[i].x, PATH_POINTS[i].y);
    const b = toWorld(PATH_POINTS[i + 1].x, PATH_POINTS[i + 1].y);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const chan = new THREE.Mesh(chanGeo, chanMat);
    chan.scale.x = len + 1.2;
    chan.position.set(mid.x, 0.05, mid.z);
    chan.rotation.y = -ang;
    scene.add(chan);
    const mol = new THREE.Mesh(molGeo, moltenMat);
    mol.scale.x = len + 0.6;
    mol.position.set(mid.x, 0.1, mid.z);
    mol.rotation.y = -ang;
    scene.add(mol);
    if (i > 0) {
      const j = new THREE.Mesh(jointGeo, chanMat);
      j.position.set(a.x, 0.05, a.z);
      scene.add(j);
      const jm = new THREE.Mesh(jointMolGeo, moltenMat);
      jm.position.set(a.x, 0.1, a.z);
      scene.add(jm);
    }
  }
  // Energy pulses flowing toward the star.
  const pulseMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,220,150,0.95)', 'rgba(255,150,40,0.4)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 22; i++) {
    const spr = new THREE.Sprite(pulseMat);
    spr.scale.set(1.5, 1.5, 1);
    spr.userData.off = (i / 22) * PATH_LENGTH;
    scene.add(spr);
    world.pulses.push(spr);
  }
}

function buildPlots(world) {
  const { scene } = world;
  const padMat = new THREE.MeshStandardMaterial({ color: 0x5f83b8, roughness: 0.55, metalness: 0.3 });
  const padGeo = new THREE.CylinderGeometry(1.35, 1.5, 0.22, 24);
  const ringGeo = new THREE.TorusGeometry(1.35, 0.055, 8, 36);
  PLOTS.forEach((p, i) => {
    const w = toWorld(p.x, p.y);
    const grp = new THREE.Group();
    grp.position.set(w.x, 0, w.z);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.11;
    grp.add(pad);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8ef, emissive: 0x4dd8ff, emissiveIntensity: 0.55, roughness: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.23;
    grp.add(ring);
    grp.userData.plotIndex = i;
    scene.add(grp);
    world.plots.push({ group: grp, ringMat, index: i });
  });
}

function buildProps(world) {
  const { scene } = world;
  const metal = new THREE.MeshStandardMaterial({ color: 0x7d94bd, roughness: 0.45, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x54677f, roughness: 0.7, metalness: 0.3 });
  world.animatedProps = [];
  for (const prop of PROPS) {
    const w = toWorld(prop.x, prop.y);
    const grp = new THREE.Group();
    grp.position.set(w.x, 0, w.z);
    if (prop.kind === 'sensor') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.4, 8), metal);
      pole.position.y = 1.2;
      grp.add(pole);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, 1.1), metal);
      dish.position.y = 2.5;
      dish.rotation.x = -0.7;
      grp.add(dish);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff4444, emissiveIntensity: 2 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), lampMat);
      lamp.position.y = 2.62;
      grp.add(lamp);
      world.animatedProps.push({ kind: 'blink', mat: lampMat });
    } else if (prop.kind === 'pods') {
      for (let i = 0; i < 3; i++) {
        const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), i === 1 ? metal : dark);
        pod.rotation.z = Math.PI / 2;
        pod.position.set((i - 1) * 1.05, 0.45, (i % 2) * 0.5 - 0.25);
        grp.add(pod);
      }
    } else if (prop.kind === 'cells') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.9), dark);
      box.position.y = 0.45;
      grp.add(box);
      const cellMat = new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x4dd8ff, emissiveIntensity: 1.4 });
      for (let i = 0; i < 3; i++) {
        const cell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.06), cellMat);
        cell.position.set(-0.5 + i * 0.5, 0.5, 0.47);
        grp.add(cell);
      }
    } else if (prop.kind === 'beacon') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.9, 8), metal);
      pole.position.y = 0.95;
      grp.add(pole);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x1a0d00, emissive: 0xffb35c, emissiveIntensity: 2.4 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), headMat);
      head.position.y = 2.0;
      grp.add(head);
      world.animatedProps.push({ kind: 'spin', obj: grp });
    } else if (prop.kind === 'drums') {
      for (let i = 0; i < 3; i++) {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12),
          new THREE.MeshStandardMaterial({ color: i === 1 ? 0xe08a2e : 0x7d94bd, roughness: 0.6, metalness: 0.3 }));
        drum.position.set((i - 1) * 0.95, 0.5, (i === 1 ? -0.3 : 0.25));
        grp.add(drum);
      }
    }
    scene.add(grp);
  }
}

function buildStar(world) {
  const { scene } = world;
  const w = toWorld(CORE.x, CORE.y);
  const grp = new THREE.Group();
  grp.position.set(w.x, 2.6, w.z);
  scene.add(grp);
  // The star itself: granulated fire, unlit (it IS the light).
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 48, 32),
    new THREE.MeshBasicMaterial({ map: starTexture() }),
  );
  grp.add(core);
  // Fresnel corona shell.
  const corona = new THREE.Mesh(new THREE.SphereGeometry(2.85, 48, 32), fresnelMaterial(0xff8a2a, 2.6, 1.5));
  grp.add(corona);
  // Prominences: bright arcs hugging the limb.
  const promTex = canvasTexture(128, 128, (g) => {
    g.strokeStyle = 'rgba(255,170,60,0.95)';
    g.lineWidth = 7;
    g.shadowColor = 'rgba(255,120,20,0.9)';
    g.shadowBlur = 12;
    g.beginPath(); g.arc(64, 74, 42, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = 'rgba(255,220,150,0.8)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(64, 78, 34, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  });
  const rnd = mulberry(99);
  world.prominences = [];
  for (let i = 0; i < 7; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: promTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
    }));
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.7;
    spr.position.set(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0);
    spr.scale.set(2.6, 2.6, 1);
    spr.material.rotation = a + Math.PI / 2 + (rnd() - 0.5) * 0.6;
    grp.add(spr);
    world.prominences.push(spr);
  }
  // Layered glow + lens-flare cross.
  const glow1 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,190,90,0.85)', 'rgba(255,120,20,0.35)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow1.scale.set(10.5, 10.5, 1);
  grp.add(glow1);
  const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,140,40,0.4)', 'rgba(255,90,10,0.12)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
  }));
  glow2.scale.set(20, 20, 1);
  grp.add(glow2);
  const flareMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,240,200,0.9)', 'rgba(255,180,80,0.25)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55,
  });
  const flareH = new THREE.Sprite(flareMat);
  flareH.scale.set(17, 0.55, 1);
  grp.add(flareH);
  const flareV = new THREE.Sprite(flareMat.clone());
  flareV.scale.set(0.55, 13, 1);
  grp.add(flareV);
  // Containment: two golden gyroscope rings + clamps with emissive tips.
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.35, metalness: 0.6 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.17, 10, 48), ringMat);
  ring1.rotation.x = Math.PI / 2.4;
  grp.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.13, 10, 48), ringMat);
  ring2.rotation.x = Math.PI / 1.7;
  ring2.rotation.y = 0.6;
  grp.add(ring2);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x140a00, emissive: 0xffb35c, emissiveIntensity: 2.2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.9), ringMat);
    clamp.position.set(Math.cos(a) * 3.4, Math.sin(a) * 1.2, Math.sin(a * 2) * 1.4);
    grp.add(clamp);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), tipMat);
    tip.position.copy(clamp.position).multiplyScalar(0.88);
    grp.add(tip);
  }
  const label = textSprite('★ STARFORGE CORE', '#ffd9a0', 0.95);
  label.position.set(0, 5.6, 0);
  grp.add(label);
  // The star lights the whole deck.
  const light = new THREE.PointLight(0xffa040, 900, 0, 1.7);
  light.position.copy(grp.position);
  scene.add(light);
  // A pylon under the star ties it to the deck.
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.2, 10), ringMat);
  pylon.position.set(w.x, 1.1, w.z);
  scene.add(pylon);
  world.star = { group: grp, core, corona, glow1, glow2, flareH, flareV, light, baseIntensity: 900, label };
}

function buildShowcase(world) {
  const { scene } = world;
  const w = toWorld(88, 472);
  const grp = new THREE.Group();
  grp.position.set(w.x, 0, w.z);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.95, 0.5, 28),
    new THREE.MeshStandardMaterial({ color: 0x5f83b8, roughness: 0.5, metalness: 0.3 }),
  );
  base.position.y = 0.25;
  grp.add(base);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.06, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x140a00, emissive: 0xffb35c, emissiveIntensity: 1.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.52;
  grp.add(ring);
  scene.add(grp);
  world.showcase = { group: grp, anchor: new THREE.Group() };
  world.showcase.anchor.position.set(w.x, 0.5, w.z);
  scene.add(world.showcase.anchor);
}

// Ambient life: star rotation and pulse, flowing conduit energy,
// drifting rocks, blinking lamps, meteors. Called every frame.
export function animateWorld(world, dt, t, starHealth = 1) {
  world.time = t;
  const s = world.star;
  s.core.rotation.y = t * 0.05;
  const flicker = world.starFlicker > 0 ? 1 - world.starFlicker * 0.45 : 1;
  const pulse = 1 + Math.sin(t * 2.1) * 0.03;
  const healthScale = 0.72 + 0.28 * starHealth;
  s.group.scale.setScalar(pulse * healthScale);
  s.light.intensity = s.baseIntensity * healthScale * flicker * (1 + Math.sin(t * 2.1) * 0.05);
  s.glow1.material.opacity = 0.95 * healthScale * flicker;
  s.glow2.material.opacity = 0.8 * healthScale * flicker;
  const flarePulse = (0.45 + 0.2 * Math.sin(t * 0.7)) * healthScale * flicker;
  s.flareH.material.opacity = flarePulse;
  s.flareV.material.opacity = flarePulse * 0.8;
  if (world.starFlicker > 0) world.starFlicker = Math.max(0, world.starFlicker - dt * 1.6);
  world.moltenMat.emissiveIntensity = 2.45 + Math.sin(t * 3.2) * 0.35;
  for (const p of world.pulses) {
    const d = (p.userData.off + t * 130) % PATH_LENGTH;
    const pt = pathPointAt(d);
    const w = toWorld(pt.x, pt.y);
    p.position.set(w.x, 0.55, w.z);
  }
  for (const rock of world.asteroids) {
    rock.rotation.x += rock.userData.spin.x * dt;
    rock.rotation.y += rock.userData.spin.y * dt;
    rock.position.x += rock.userData.drift * dt;
    if (rock.position.x > 70) rock.position.x = -70;
    if (rock.position.x < -70) rock.position.x = 70;
  }
  if (world.cloudPuffs) {
    for (const puff of world.cloudPuffs) {
      puff.position.x += puff.userData.drift * dt;
      if (puff.position.x > 78) puff.position.x = -82;
    }
  }
  for (const prop of world.animatedProps) {
    if (prop.kind === 'blink') prop.mat.emissiveIntensity = (Math.sin(t * 2.4) > 0.2 ? 2.2 : 0.15);
    if (prop.kind === 'spin') prop.obj.rotation.y = t * 0.5;
  }
  world.planet.rotation.y = t * 0.004;
  world.engineGlow.material.opacity = 0.42 + Math.sin(t * 5.1) * 0.08;
  // Meteors: brief bright streaks across the upper margins.
  const rnd = mulberry(5000 + Math.floor(t / 9));
  for (const m of world.meteors) {
    const lt = (t + m.userData.t * -1) % 11;
    if (lt < m.userData.dur) {
      const k = lt / m.userData.dur;
      if (!m.userData.active) {
        m.userData.active = true;
        m.userData.from.set(-72 + rnd() * 115, -32 - rnd() * 26, -120);
        m.userData.to.copy(m.userData.from).add(new THREE.Vector3(48 + rnd() * 42, -7 - rnd() * 9, 0));
      }
      m.visible = true;
      m.position.lerpVectors(m.userData.from, m.userData.to, k);
      m.material.opacity = Math.sin(k * Math.PI) * 0.9;
      m.material.rotation = Math.atan2(-(m.userData.to.y - m.userData.from.y), m.userData.to.x - m.userData.from.x);
    } else {
      m.visible = false;
      m.userData.active = false;
    }
  }
  if (world.showcase) world.showcase.anchor.rotation.y = t * 0.7;
}
