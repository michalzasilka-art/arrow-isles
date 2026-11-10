// Arrow Isles: a blocky 3D archer game for phones. Move to dodge, stand still and your hero shoots the nearest enemy.
// Clear 10 rooms per island (a big enemy in room 5, a boss in room 10), level up and pick skills, win trophies.
// Trophies unlock the three islands. Everything is made of simple boxes (three.js), no pictures.
// English: every level-up and every treasure chest asks a gap-fill sentence from the Fugio question packages (3 choices).
import * as THREE from './lib/three.module.min.js';

const $ = (id) => document.getElementById(id);
const R = Math.random, rand = (a, b) => a + R() * (b - a), pick = (a) => a[(R() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const ease = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; // back-out

/* ---------- save ---------- */
const SAVE = 'fugio-arrow-isles';
const save = { trophies: 0, hero: 'foxino', isle: 0, best: [0, 0, 0], cleared: [0, 0, 0], packs: [] };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) {}
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) {} };

/* ---------- sound ---------- */
let AC;
function tone(f, d = .1, type = 'square', vol = .05, slide = 0) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
const gemCombo = { n: 0, t: 0 };
// short buzzes on phones that can (Android); nothing elsewhere
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
// game feel: a tiny freeze on big hits (hit-stop) and a moment of slow motion when a room is cleared
const FEEL = { stop: 0, slow: 0 };
const hitStop = (s) => { FEEL.stop = Math.max(FEEL.stop, s); };
const seq = (fs, gap, d, type = 'triangle', vol = .05) => fs.forEach((f, i) => setTimeout(() => tone(f, d, type, vol), i * gap));
const sfx = {
  shoot: () => { tone(820 + R() * 160, .07, 'triangle', .025, .45); tone(180, .05, 'sine', .03, .5); },
  crit: () => { tone(1500, .06, 'square', .03, .5); tone(300, .12, 'sawtooth', .03, .4); },
  combo: (n) => tone(880 * Math.pow(2, Math.min(n, 14) / 12), .07, 'sine', .035),
  streak: (n) => tone(420 * Math.pow(2, Math.min(n, 10) / 12), .14, 'square', .03, 2),
  clear: () => seq([659, 784, 988, 1318], 70, .16, 'triangle', .06),
  hit: () => tone(240, .05, 'square', .02, .6),
  pop: () => tone(520, .12, 'square', .035, 2.2),
  hurt: () => tone(170, .25, 'sawtooth', .06, .4),
  gem: () => { const n = gemCombo.n = performance.now() - gemCombo.t < 380 ? gemCombo.n + 1 : 0; gemCombo.t = performance.now(); tone(1046 * Math.pow(2, Math.min(n, 18) / 12), .06, 'sine', .028); },
  lvl: () => seq([523, 659, 784, 1046], 80, .15),
  door: () => seq([392, 523, 659], 90, .18, 'sine'),
  boom: () => tone(90, .35, 'sawtooth', .06, .3),
  win: () => seq([523, 659, 784, 1046, 1318], 110, .22, 'triangle', .06),
  lose: () => seq([392, 330, 262, 196], 160, .26),
  click: () => tone(660, .05, 'square', .03),
};

/* ---------- pixel textures (16×16, Minecraft style) ---------- */
// The block pictures come from ChatGPT (Foxino/Arrow Isles/Textures, shrunk to 16×16 into tex/). If one is missing it is drawn in code.
function texFrom(c, rep) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const tex = (w, h, draw, rep) => texFrom(canvas(w, h, draw), rep);
function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function speckle(x, base, v = .1, X = 0, Y = 0, w = 16, h = 16) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { x.fillStyle = tint(base, (R() - .5) * 2 * v); x.fillRect(X + i, Y + j, 1, 1); }
}
const dots = (x, col, n, w = 1, h = 1) => { x.fillStyle = col; for (let k = 0; k < n; k++) x.fillRect(R() * 16 | 0, R() * 16 | 0, w, h); };
const px = (x, col, pts) => { x.fillStyle = col; for (const [a, b, w = 1, h = 1] of pts) x.fillRect(a, b, w, h); };
const BT = {
  grass: (x) => { speckle(x, '#62b843', .14); dots(x, '#7fd05a', 8); },
  grassSide: (x) => { x.drawImage(src('dirt'), 0, 0, 16, 16); x.drawImage(src('grass'), 0, 0, 16, 3, 0, 0, 16, 3); for (let i = 0; i < 16; i++) if (R() < .5) x.drawImage(src('grass'), i, 3, 1, 1 + (R() * 2 | 0), i, 3, 1, 1 + (R() * 2 | 0)); },
  dirt: (x) => { speckle(x, '#8b5a33', .14); dots(x, '#6d4426', 6); },
  stone: (x) => { speckle(x, '#8d8f94', .1); x.fillStyle = '#6b6d72'; for (let k = 0; k < 6; k++) x.fillRect(R() * 14 | 0, R() * 14 | 0, 2 + (R() * 3 | 0), 1); },
  cobble: (x) => { speckle(x, '#85878c', .09); px(x, '#55575c', [[0, 5, 16], [0, 11, 16], [5, 0, 1, 5], [11, 5, 1, 6], [3, 11, 1, 5], [9, 11, 1, 5], [0, 0, 16]]); },
  sand: (x) => { speckle(x, '#ead18c', .07); dots(x, '#d4b56a', 6); },
  sandstone: (x) => { speckle(x, '#e2c47e', .06); px(x, '#c9a862', [[0, 4, 16], [0, 11, 16]]); px(x, '#f2dc9e', [[0, 0, 16]]); },
  snow: (x) => { speckle(x, '#f2f7ff', .04); dots(x, '#dbe6f7', 6); },
  snowSide: (x) => { x.drawImage(src('dirt'), 0, 0, 16, 16); x.drawImage(src('snow'), 0, 0, 16, 4, 0, 0, 16, 4); for (let i = 0; i < 16; i++) if (R() < .45) x.drawImage(src('snow'), i, 4, 1, 2, i, 4, 1, 1 + (R() * 2 | 0)); },
  ice: (x) => { speckle(x, '#9fd6ff', .07); px(x, '#e4f5ff', [[3, 3, 5], [3, 3, 1, 3], [9, 10, 4]]); },
  log: (x) => { speckle(x, '#6e4a2a', .12); x.fillStyle = '#4e321b'; [2, 6, 10, 13].forEach((i) => x.fillRect(i, 0, 1, 16)); },
  logTop: (x) => { speckle(x, '#b78a55', .06); x.strokeStyle = '#8a6438'; x.strokeRect(3.5, 3.5, 9, 9); x.strokeRect(6.5, 6.5, 3, 3); px(x, '#6e4a2a', [[0, 0, 16], [0, 15, 16], [0, 0, 1, 16], [15, 0, 1, 16]]); },
  leaves: (x) => { speckle(x, '#3c8f34', .22); dots(x, '#2a6a24', 12); dots(x, '#5cbf4a', 6); },
  planks: (x) => { speckle(x, '#b07c45', .08); px(x, '#7d5530', [[0, 3, 16], [0, 7, 16], [0, 11, 16], [0, 15, 16], [5, 0, 1, 4], [12, 4, 1, 4], [3, 8, 1, 4], [9, 12, 1, 4]]); },
  crate: (x) => { x.drawImage(src('planks'), 0, 0); px(x, '#5e3e20', [[0, 0, 16, 2], [0, 14, 16, 2], [0, 0, 2, 16], [14, 0, 2, 16]]); for (let i = 2; i < 14; i++) px(x, '#5e3e20', [[i, i, 2]]); },
  water: (x) => { speckle(x, '#3a8fe0', .07); x.fillStyle = '#86ccff'; for (let k = 0; k < 5; k++) x.fillRect(R() * 12 | 0, R() * 16 | 0, 3 + (R() * 3 | 0), 1); },
  gold: (x) => { speckle(x, '#f5c531', .08); px(x, '#fff3a0', [[2, 2, 4], [2, 2, 1, 3]]); px(x, '#c99a17', [[0, 15, 16], [15, 0, 1, 16]]); },
  white: (x) => { speckle(x, '#eeece6', .03); px(x, '#cfccc4', [[0, 15, 16], [15, 0, 1, 16]]); px(x, '#ffffff', [[0, 0, 16], [0, 0, 1, 16]]); },
  mossy: (x) => { x.drawImage(src('white'), 0, 0); x.fillStyle = '#4f9a3a'; for (let k = 0; k < 40; k++) { const i = R() * 16 | 0, j = R() * 16 | 0; if (j < 6 || R() < .3) x.fillRect(i, j, 1, 1); } },
  portal: (x) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = Math.sin(i * .8 + j * .4) + Math.cos(j * .9 - i * .3); x.fillStyle = v > .8 ? '#e070ff' : v > -.2 ? '#9a3cf0' : '#5a1aa8'; x.fillRect(i, j, 1, 1); } dots(x, '#ffffff', 4); },
  cactus: (x) => { speckle(x, '#3f9a3a', .1); px(x, '#2c7a2a', [[2, 0, 1, 16], [7, 0, 1, 16], [12, 0, 1, 16]]); dots(x, '#e8f0c0', 5); },
  glow: (x) => { speckle(x, '#ffd86a', .15); dots(x, '#fff6c0', 10); px(x, '#c9922a', [[0, 0, 16], [0, 15, 16], [0, 0, 1, 16], [15, 0, 1, 16]]); },
  // sprites (transparent)
  vines: (x) => { x.fillStyle = '#3f8f2f'; for (const i of [1, 4, 6, 9, 12, 14]) { const l = 6 + (R() * 10 | 0); x.fillRect(i, 0, 1, l); if (R() < .7) x.fillRect(i - 1, (R() * l) | 0, 2, 1); } },
  flowerRed: (x) => { px(x, '#3f8f2f', [[7, 8, 1, 8], [5, 11, 2, 1], [8, 13, 2, 1]]); px(x, '#e8322a', [[6, 4, 3, 3], [5, 5, 5, 1]]); px(x, '#ffe14a', [[7, 5]]); },
  flowerYellow: (x) => { px(x, '#3f8f2f', [[7, 9, 1, 7], [8, 12, 2, 1]]); px(x, '#ffd23a', [[6, 6, 3, 3], [7, 5, 1, 5], [5, 7, 5, 1]]); px(x, '#c98a10', [[7, 7]]); },
  tallGrass: (x) => { x.fillStyle = '#5aa83a'; for (const [i, h] of [[2, 6], [4, 10], [6, 7], [8, 12], [10, 8], [12, 11], [14, 6]]) x.fillRect(i, 16 - h, 1, h); },
  mushroom: (x) => { px(x, '#f0e2c0', [[7, 10, 2, 6]]); px(x, '#d8322a', [[4, 7, 8, 3], [5, 6, 6, 1]]); px(x, '#ffffff', [[5, 8], [9, 7], [10, 9]]); },
};
const FILES = ['grass', 'grassSide', 'dirt', 'stone', 'cobble', 'log', 'logTop', 'leaves', 'planks', 'sand', 'sandstone', 'snow', 'ice', 'water', 'white', 'mossy', 'portal', 'vines', 'flowerRed', 'flowerYellow', 'tallGrass', 'mushroom'];
const IMG = {}, srcCache = {};
function loadTextures() {
  const one = (k) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[k] = canvas(im.width, im.height, (x) => x.drawImage(im, 0, 0)); res(); };
    im.onerror = () => res(); im.src = `tex/${k}.png?v=1`;
  });
  return Promise.race([Promise.all(FILES.map(one)), new Promise((r) => setTimeout(r, 6000))]);
}
const src = (k) => IMG[k] || srcCache[k] || (srcCache[k] = canvas(16, 16, BT[k]));
const texCache = {};
const BTex = (k) => texCache[k] || (texCache[k] = texFrom(src(k)));
const blockMats = {};
const GRASS = 0x4aa83a; // plain green for grass tops; the 3D blades on top give the texture
function blockMat(top, side = top, bottom = side, extra) {
  const key = top + '|' + side + '|' + bottom + JSON.stringify(extra || {});
  if (blockMats[key]) return blockMats[key];
  const m = (t) => new THREE.MeshLambertMaterial(t === 'grass' ? { color: GRASS, ...extra } : { map: BTex(t), ...extra });
  const s = m(side), tp = top === side ? s : m(top), b = bottom === side ? s : bottom === top ? tp : m(bottom);
  return (blockMats[key] = [s, s, tp, b, s, s]);
}
const spriteMats = {};
// "shader" touches: plants and leaves sway in the wind, characters get a soft rim light
const U = { time: { value: 0 } };
function windy(m, amount, base) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = modelMatrix[3].xyz;
      #endif
      float h = max(position.y + ${base.toFixed(2)}, 0.0);
      float sw = sin(uTime * 2.1 + ip.x * .7 + ip.z * .45) + .4 * sin(uTime * 3.7 + ip.z * 1.3);
      transformed.x += sw * ${amount.toFixed(3)} * h; transformed.z += sw * ${(amount * .5).toFixed(3)} * h;`);
  };
  m.customProgramCacheKey = () => 'wind' + amount + base; return m;
}
const spriteMat = (k, color = 0xffffff, still) => spriteMats[k + color + !!still] || (spriteMats[k + color + !!still] = (still ? (m) => m : (m) => windy(m, .09, 0))(new THREE.MeshLambertMaterial({ map: BTex(k), color, alphaTest: .5, side: THREE.DoubleSide })));
const rimCache = new Map();
function rimify(m) {
  if (Array.isArray(m)) return m.map(rimify);
  if (!m || !m.isMeshLambertMaterial) return m;
  if (rimCache.has(m)) return rimCache.get(m);
  const r = m.clone(); if (m.shut) r.shut = rimify(m.shut);
  r.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
      outgoingLight += vec3(.7, .85, 1.2) * pow(rimF, 1.4) * .32;
      #include <opaque_fragment>`);
  };
  r.customProgramCacheKey = () => 'rim'; rimCache.set(m, r); return r;
}
const rimModel = (g) => { g.traverse((o) => { if (o.isMesh && !o.userData.noRim) o.material = rimify(o.material); }); return g; };
// every coloured box gets a faint pixel noise, so characters and props look like blocks too
let NOISE = null;
const noise = () => NOISE || (NOISE = tex(8, 8, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = 215 + (R() * 40 | 0); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, j, 1, 1); } }));

/* ---------- boxes ---------- */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const lam = {};
const M = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return lam[k] || (lam[k] = new THREE.MeshLambertMaterial({ color: c, map: noise(), ...o })); };
const GLOW = (c) => M(c, { emissive: c, emissiveIntensity: .85 });
const darker = (c, k = .6) => new THREE.Color(c).multiplyScalar(k).getHex();
function cube(p, w, h, d, x, y, z, m, sh = true) {
  const o = new THREE.Mesh(BOX, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = sh; p.add(o); return o;
}
let VC = null;
const vcMat = () => VC || (VC = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise() }));
// many coloured boxes glued into one mesh: [w,h,d, x,y,z, colour, turnY, tiltZ]
function joinBoxes(parts) {
  const pos = [], nor = [], col = [], idx = []; let off = 0; const c = new THREE.Color();
  for (const [w, h, d, x, y, z, hex, ry = 0, rz = 0] of parts) {
    const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); c.set(hex);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
    for (const i of g.index.array) idx.push(i + off);
    off += P.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); return g;
}
function face(draw, base) {
  return new THREE.MeshLambertMaterial({ map: tex(16, 16, (x) => { x.fillStyle = base; x.fillRect(0, 0, 16, 16); draw((X, Y, W, H, c) => { x.fillStyle = c; x.fillRect(X, Y, W, H); }); }) });
}
const sixFaces = (base, front, top) => { const s = M(base); return [s, s, top || s, s, front, s]; };
// a face plus a twin with closed eyes, for blinking
function blinkFace(draw, base, eyes, lid) {
  const open = face(draw, base), shut = face((r) => { draw(r); for (const [x, y, w, h] of eyes) { r(x, y, w, h, lid); r(x, y + h - 2, w, 1, '#2a1a2a'); } }, base);
  open.shut = shut; return open;
}

/* ---------- the crew (blocky versions of the original characters) ---------- */
const HEROES = {
  foxino: { name: 'Foxino', perk: 'Captain: good at everything', mod: () => {} },
  stella: { name: 'Stella', perk: 'Navigator: moves 15% faster', mod: (p) => { p.speed *= 1.15; } },
  pix: { name: 'Pix', perk: 'Engineer: +20% damage', mod: (p) => { p.dmg *= 1.2; } },
  rob: { name: 'Rob', perk: 'Robot: +30% HP', mod: (p) => { p.maxHp = p.hp = Math.round(p.maxHp * 1.3); } },
  gummy: { name: 'Gummy', perk: 'Lookout: shoots 20% faster', mod: (p) => { p.atkInt *= .83; } },
  charlie: { name: 'Charlie', perk: 'Ghost: arrows fly through 1 enemy', mod: (p) => { p.pierce += 1; } },
};

// Body: legs on the hips, and an upper body (p.up) that leans, bobs and breathes, with arms, head, hands, belt and a quiver.
// The bow sits in the left hand, always upright; its limbs bend and its string pulls back while the hero draws.
function rig(o) {
  const { legH = .32, legW = .17, gap = .11, legM, shoeM = M('#3a2a20'), bodyW = .48, bodyH = .48, bodyD = .28, bodyM, armW = .14, armH = .46, armM, handM, headS = .58, headM, noLegs, beltM = M('#5a3a1e') } = o;
  const g = new THREE.Group(), p = { g, legH, bodyH, bodyD, headS, armH };
  const leg = (x) => { const v = new THREE.Group(); v.position.set(x, legH, 0); g.add(v); cube(v, legW, legH, legW * 1.1, 0, -legH / 2, 0, legM); cube(v, legW + .02, .08, legW * 1.1 + .05, 0, -legH + .04, .02, shoeM); return v; };
  if (!noLegs) { p.legL = leg(-gap); p.legR = leg(gap); }
  const up = new THREE.Group(); up.position.y = legH; g.add(up); p.up = up;
  p.body = cube(up, bodyW, bodyH, bodyD, 0, bodyH / 2, 0, bodyM);
  if (beltM && !o.noBelt) { cube(up, bodyW + .03, .06, bodyD + .03, 0, .05, 0, beltM); cube(up, .08, .07, .02, 0, .05, bodyD / 2 + .02, M(0xffcc33)); }
  const arm = (x) => {
    const v = new THREE.Group(); v.rotation.order = 'YXZ'; v.position.set(x, bodyH - .05, 0); up.add(v);
    cube(v, armW, armH, armW, 0, -armH / 2 + .05, 0, armM); cube(v, armW + .01, .1, armW + .01, 0, -armH + .07, 0, handM || armM); return v;
  };
  p.armL = arm(-(bodyW / 2 + armW / 2)); p.armR = arm(bodyW / 2 + armW / 2);
  p.head = new THREE.Group(); p.head.position.set(0, bodyH, 0); up.add(p.head);
  p.headMesh = cube(p.head, headS, headS, headS, 0, headS / 2, 0, headM);
  p.top = legH + bodyH + headS;
  // quiver on the back with three arrows
  const qv = new THREE.Group(); qv.position.set(.1, bodyH * .55, -bodyD / 2 - .07); qv.rotation.z = -.45; up.add(qv);
  cube(qv, .13, .4, .12, 0, 0, 0, M('#8a5a2b')); cube(qv, .15, .05, .14, 0, .18, 0, M('#5a3a1e'));
  [[-.03, 0xff4a4a], [.03, 0xffffff], [0, 0xffcc33]].forEach(([x, c], i) => { cube(qv, .02, .14, .02, x, .27, (i - 1) * .03, M('#6e4a2a')); cube(qv, .06, .06, .02, x, .33, (i - 1) * .03, M(c)); });
  // the bow (bow space: z up the bow, −y forward, +y towards the archer)
  const bow = new THREE.Group(); bow.position.set(0, -armH + .07, .03); bow.scale.setScalar(1.3); p.armL.add(bow); p.bow = bow;
  const wood = M('#e0a050', { emissive: 0x3a2000 }), dark = M('#7a4a20');
  cube(bow, .08, .08, .15, 0, 0, 0, dark);
  p.limbs = [0, 1, 2, 3].map(() => cube(bow, 1, 1, 1, 0, 0, 0, wood));
  p.str = [0, 1].map(() => cube(bow, 1, 1, 1, 0, 0, 0, M(0xffffff, { emissive: 0x888888 }), false));
  p.nock = new THREE.Mesh(ARROW_GEO, VCS); p.nock.rotation.x = Math.PI / 2; bow.add(p.nock);
  bowPose(p, 0, 0);
  return p;
}
const ZV = new THREE.Vector3(0, 0, 1), V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
function seg(m, ax, ay, az, bx, by, bz, th) {
  V1.set(bx - ax, by - ay, bz - az); const len = V1.length();
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.scale.set(th, th, len); m.quaternion.setFromUnitVectors(ZV, V1.divideScalar(len));
}
function bowPose(p, k, rel) {
  const ty = .07 + k * .07, tz = .37 - k * .04, ny = .07 + k * .3 + (rel > 0 ? Math.sin(rel * 70) * .05 * rel : 0);
  seg(p.limbs[0], 0, -.03, .06, 0, -.02, .22, .08); seg(p.limbs[1], 0, -.02, .22, 0, ty, tz, .07);
  seg(p.limbs[2], 0, -.03, -.06, 0, -.02, -.22, .08); seg(p.limbs[3], 0, -.02, -.22, 0, ty, -tz, .07);
  seg(p.str[0], 0, ty, tz, 0, ny, 0, .025); seg(p.str[1], 0, ty, -tz, 0, ny, 0, .025);
  p.nock.visible = k > .03; p.nock.position.set(0, ny - .31, 0);
}
// st: { moving, aim (0/1), draw 0…1, rel (release wobble), hurt }
function animHero(p, t, st) {
  const mv = st.moving ? 1 : 0, w = Math.sin(t * 12), aim = st.aim && !mv;
  if (p.legL) { p.legL.rotation.x = w * .85 * mv; p.legR.rotation.x = -w * .85 * mv; }
  p.up.position.y = p.legH + mv * Math.abs(Math.cos(t * 12)) * .05;
  p.up.rotation.set(mv * .16 + (aim ? .04 : 0) - (st.hurt || 0) * .6, 0, mv * w * .05);
  p.up.scale.y = mv ? 1 : 1 + Math.sin(t * 2.6) * .014;
  if (aim) {
    const k = st.draw || 0;
    p.armL.rotation.set(-1.68, -.38, 0);
    p.armR.rotation.set(-1.5 + k * .1, -.62 - k * .3, 0);
    p.head.rotation.set(.04, 0, 0);
  } else {
    p.armL.rotation.set(-w * .65 * mv + (mv ? 0 : Math.sin(t * 2.6) * .04), 0, .06);
    p.armR.rotation.set(w * .65 * mv - (mv ? 0 : Math.sin(t * 2.6) * .04), 0, -.06);
    p.head.rotation.set(0, mv ? 0 : Math.sin(t * .9) * .18, 0);
  }
  p.bow.rotation.set(-p.armL.rotation.x - Math.PI / 2, aim ? -.35 : 0, aim ? -p.armL.rotation.y : 0);
  bowPose(p, aim ? st.draw || 0 : 0, st.rel || 0);
  if (p.tail) p.tail.rotation.y = Math.sin(t * (mv ? 12 : 5)) * .35;
  // blink every few seconds (Pix has no eyes to blink)
  const fm = p.headMesh.material;
  if (Array.isArray(fm)) { const o = p.faceOpen || (p.faceOpen = fm[4].shut ? fm[4] : null); if (o) fm[4] = ((t + p.g.id) % 3.7) < .13 ? o.shut : o; }
}
const ears = (p, c, inner, y = 0) => { for (const s of [-1, 1]) { cube(p.head, .17, .24, .1, s * .2, p.headS + .1 + y, -.04, M(c)); cube(p.head, .09, .14, .04, s * .2, p.headS + .07 + y, .02, M(inner)); } };
function tail(p, cols, y) {
  const t = new THREE.Group(); t.position.set(0, y ?? p.legH + .08, -p.bodyD / 2); p.g.add(t);
  cube(t, .17, .17, .22, 0, 0, -.1, M(cols[0])); cube(t, .22, .22, .24, 0, .08, -.31, M(cols[1])); cube(t, .17, .17, .14, 0, .17, -.5, M(cols[2]));
  p.tail = t;
}

function mHero(id) {
  let p;
  if (id === 'foxino') {
    const fur = '#8e55d6', org = '#ff8c2e';
    p = rig({ legM: M(fur), bodyM: M('#ffd23f'), armM: M(fur), handM: M('#f8ead6'), headM: sixFaces(fur, blinkFace((r) => {
      r(5, 0, 6, 3, org); r(0, 8, 3, 5, org); r(13, 8, 3, 5, org); r(4, 9, 8, 7, '#f8ead6'); r(3, 11, 10, 5, '#f8ead6');
      r(3, 5, 4, 4, '#fff'); r(9, 5, 4, 4, '#fff'); r(4, 6, 3, 3, '#2fae5f'); r(9, 6, 3, 3, '#2fae5f'); r(5, 7, 1, 2, '#111'); r(10, 7, 1, 2, '#111');
      r(7, 10, 2, 2, '#1a1020'); r(6, 13, 4, 1, '#5a2a3a');
    }, fur, [[3, 5, 4, 4], [9, 5, 4, 4]], fur)) });
    for (const L of [p.legL, p.legR]) cube(L, .19, .15, .2, 0, -.07, 0, M(org));
    for (const A of [p.armL, p.armR]) cube(A, .16, .12, .16, 0, -.0, 0, M('#ffd23f'));
    ears(p, fur, org); cube(p.head, .3, .1, .3, 0, .66, .06, M(org));
    tail(p, [fur, org, '#ffffff']);
  } else if (id === 'stella') {
    const fur = '#f07b23', purple = '#8e44c9';
    const over = face((r) => { r(3, 6, 10, 10, '#3c6fd8'); r(3, 0, 2, 6, '#3c6fd8'); r(11, 0, 2, 6, '#3c6fd8'); r(7, 8, 2, 5, '#ffd23a'); r(5, 10, 6, 1, '#ffd23a'); r(6, 9, 4, 3, '#ffd23a'); }, '#ffffff');
    p = rig({ legM: M('#3c6fd8'), shoeM: M('#fff6ea'), bodyM: [M('#3c6fd8'), M('#3c6fd8'), M('#ffffff'), M('#3c6fd8'), over, M('#3c6fd8')], armM: M(fur), handM: M('#fff6ea'), noBelt: true, headM: sixFaces(fur, blinkFace((r) => {
      r(2, 0, 4, 4, purple); r(3, 4, 2, 1, purple); r(4, 9, 8, 7, '#fff6ea'); r(3, 11, 10, 5, '#fff6ea');
      r(2, 5, 5, 5, '#fff'); r(9, 5, 5, 5, '#fff'); r(3, 6, 4, 4, '#1fb5b0'); r(9, 6, 4, 4, '#1fb5b0'); r(4, 7, 2, 2, '#0b2b30'); r(10, 7, 2, 2, '#0b2b30');
      r(3, 6, 1, 1, '#fff'); r(9, 6, 1, 1, '#fff'); r(2, 4, 1, 1, '#222'); r(13, 4, 1, 1, '#222');
      r(7, 10, 2, 2, '#3a1a10'); r(6, 13, 4, 1, '#8a2a2a'); r(7, 14, 2, 1, '#ff7a8a');
    }, fur, [[2, 5, 5, 5], [9, 5, 5, 5]], fur)) });
    for (const A of [p.armL, p.armR]) cube(A, .16, .12, .16, 0, 0, 0, M('#ffffff'));
    ears(p, fur, '#3a2010');
    cube(p.head, .2, .2, .64, -.22, .62, 0, M(purple)); // streak
    for (let k = 0; k < 4; k++) cube(p.head, .14, .14, .14, -.36, .42 - k * .15, .12, M(k % 2 ? purple : fur)); // side braid
    tail(p, [fur, fur, '#ffffff']);
  } else if (id === 'pix') {
    const skin = '#7cc85a', hair = '#b8e33a';
    const top = face((r) => { r(0, 0, 16, 16, '#7b3fc4'); r(3, 0, 10, 9, '#f4f4f4'); r(3, 9, 10, 3, skin); r(0, 12, 16, 3, '#8a5a2b'); r(10, 12, 4, 2, '#c8c8c8'); }, '#7b3fc4');
    p = rig({ legW: .2, legM: M('#7d7f86'), bodyM: [M('#7b3fc4'), M('#7b3fc4'), M('#7b3fc4'), M('#7b3fc4'), top, M('#7b3fc4')], armM: M('#7b3fc4'), handM: M(skin), noBelt: true, headM: sixFaces(skin, face((r) => {
      // Pix's eyes are always hidden under her bangs: the face has no eyes at all
      r(0, 0, 16, 9, hair); for (let i = 0; i < 16; i += 2) r(i, 9, 1, 1, hair);
      r(3, 1, 1, 7, '#9ccc2a'); r(8, 2, 1, 7, '#9ccc2a'); r(12, 1, 1, 7, '#9ccc2a');
      r(7, 11, 2, 1, '#5ea844'); r(6, 13, 4, 1, '#3d6b2c'); r(5, 12, 1, 1, '#3d6b2c'); r(10, 12, 1, 1, '#3d6b2c');
    }, skin), M(hair)) });
    for (const L of [p.legL, p.legR]) cube(L, .22, .1, .06, 0, -.14, .11, M('#6a3fa8')); // knee pads
    cube(p.head, .66, .3, .1, 0, .5, .3, M(hair)); // bangs in front of the face, over the eyes
    cube(p.head, .66, .7, .16, 0, .32, -.32, M(hair)); // long hair down the back
    for (const s of [-1, 1]) { cube(p.head, .1, .5, .3, s * .33, .38, -.08, M(hair)); cube(p.head, .26, .1, .1, s * .42, .4, 0, M(skin)).rotation.z = s * .5; } // side hair, pointed ears
    cube(p.head, .68, .14, .68, 0, .69, 0, M('#6a3fa8')); cube(p.head, .5, .05, .26, 0, .64, .44, M('#ff8c2e')); // cap and brim
  } else if (id === 'rob') {
    const cy = '#36c3ea';
    p = rig({ legH: .26, legW: .2, gap: .14, legM: M(cy), shoeM: M('#1d2a44'), bodyW: .64, bodyH: .52, bodyD: .46, bodyM: M(cy), armW: .16, armM: M(cy), handM: M('#5a3fae'), noBelt: true, headS: .58, headM: sixFaces(cy, blinkFace((r) => {
      r(1, 2, 14, 12, '#0e1726'); const e = '#7ff3ff';
      r(3, 6, 1, 1, e); r(4, 5, 2, 1, e); r(6, 6, 1, 1, e); r(9, 6, 1, 1, e); r(10, 5, 2, 1, e); r(12, 6, 1, 1, e);
      r(6, 10, 4, 1, e); r(5, 9, 1, 1, e); r(10, 9, 1, 1, e);
    }, cy, [[3, 5, 4, 3], [9, 5, 4, 3]], '#0e1726')) });
    const glowM = (c, k) => M(c, { emissive: c, emissiveIntensity: k });
    cube(p.up, .34, .3, .04, 0, .25, .24, glowM(0xff8a1e, 1.4), false).userData.noRim = true; cube(p.up, .16, .18, .05, 0, .25, .245, glowM(0xffd04a, 2.2), false).userData.noRim = true; // battery window
    for (const s of [-1, 1]) cube(p.head, .08, .2, .2, s * .32, .3, 0, M('#ff8c2e'));
    cube(p.head, .04, .22, .04, 0, .72, 0, M('#334')); cube(p.head, .1, .08, .06, -.04, .86, 0, M(0xff3355)); cube(p.head, .1, .08, .06, .04, .86, 0, M(0xff3355)); cube(p.head, .08, .06, .06, 0, .81, 0, M(0xff3355));
  } else if (id === 'gummy') {
    const pink = '#ff5db1', blue = '#5aa8ff';
    p = rig({ legH: .5, legW: .12, gap: .09, legM: M(pink), shoeM: M(blue), bodyW: .32, bodyH: .46, bodyD: .24, bodyM: M(pink), armW: .1, armH: .5, armM: M(pink), handM: M(blue), noBelt: true, headS: .56, headM: sixFaces(pink, blinkFace((r) => {
      r(0, 12, 5, 2, blue); r(12, 1, 4, 2, blue);
      r(2, 3, 5, 6, '#fff'); r(9, 3, 5, 6, '#fff'); r(3, 4, 4, 4, '#7a3cc8'); r(9, 4, 4, 4, '#7a3cc8'); r(4, 5, 2, 2, '#1a0a2a'); r(10, 5, 2, 2, '#1a0a2a'); r(3, 4, 1, 1, '#fff'); r(9, 4, 1, 1, '#fff');
      r(4, 11, 8, 2, '#7a1440'); r(6, 11, 2, 3, '#fff'); r(8, 11, 2, 3, '#fff');
    }, pink, [[2, 3, 5, 6], [9, 3, 5, 6]], pink)) });
    cube(p.up, .34, .08, .26, 0, .2, 0, M(blue)); cube(p.up, .34, .06, .26, 0, .36, 0, M(blue));
    for (const s of [-1, 1]) { cube(p.head, .05, .26, .05, s * .14, .68, 0, M(pink)); cube(p.head, .14, .05, .05, s * .19, .82, 0, M(blue)); cube(p.head, .05, .1, .05, s * .25, .76, 0, M(blue)); }
  } else {
    const lav = '#cdbdf0', hood = '#1f1f26';
    const skull = face((r) => { r(5, 4, 6, 5, '#eeeeee'); r(6, 6, 1, 1, hood); r(9, 6, 1, 1, hood); r(6, 9, 4, 2, '#eeeeee'); r(7, 10, 1, 1, hood); r(9, 10, 1, 1, hood); r(5, 0, 1, 4, '#dddddd'); r(10, 0, 1, 4, '#dddddd'); }, hood);
    p = rig({ noLegs: true, legH: .34, bodyM: [M(hood), M(hood), M(hood), M(hood), skull, M(hood)], armM: M(hood), handM: M(lav), noBelt: true, headM: sixFaces(lav, blinkFace((r) => {
      r(0, 0, 16, 4, '#5b3a9a'); r(1, 4, 2, 1, '#5b3a9a'); r(5, 4, 3, 2, '#5b3a9a'); r(10, 4, 2, 1, '#5b3a9a'); r(13, 4, 2, 2, '#5b3a9a');
      r(3, 7, 4, 2, '#a28fd8'); r(9, 7, 4, 2, '#a28fd8'); r(3, 9, 4, 1, '#f4f0ff'); r(9, 9, 4, 1, '#f4f0ff'); r(4, 9, 2, 1, '#2a2340'); r(10, 9, 2, 1, '#2a2340');
      r(6, 12, 4, 1, '#6a5a90');
    }, lav, [[3, 7, 4, 3], [9, 7, 4, 3]], '#a28fd8'), M('#5b3a9a')) });
    const wisp = new THREE.Group(); p.g.add(wisp); p.tail = wisp;
    cube(wisp, .42, .2, .3, 0, .26, 0, M(lav)); cube(wisp, .28, .16, .22, 0, .12, -.06, M(lav)); cube(wisp, .14, .12, .14, 0, .03, -.16, M(lav));
    cube(p.head, .7, .16, .7, 0, .68, 0, M('#5b3a9a')); cube(p.head, .2, .12, .2, .18, .8, .1, M('#5b3a9a')); cube(p.head, .2, .14, .2, -.2, .78, -.12, M('#5b3a9a'));
    const xf = face((r) => { r(0, 0, 16, 16, '#111'); r(4, 4, 2, 2, '#ff8c2e'); r(10, 4, 2, 2, '#ff8c2e'); r(6, 6, 4, 4, '#ff8c2e'); r(4, 10, 2, 2, '#ff8c2e'); r(10, 10, 2, 2, '#ff8c2e'); }, '#111');
    for (const s of [-1, 1]) cube(p.head, .1, .26, .26, s * .36, .32, 0, [xf, xf, M('#111'), M('#111'), M('#111'), M('#111')]);
    cube(p.head, .76, .07, .1, 0, .7, 0, M('#111'));
  }
  rimModel(p.g);
  return p;
}
/* ---------- enemies: soft, round cartoon monsters ---------- */
const shine = (p, x, y, z, s) => part(p, SPH, S(0xffffff, { transparent: true, opacity: .55, emissive: 0xffffff, emissiveIntensity: .3 }), s, s * .6, s * .4, x, y, z, -.4, 0, 0, false);
function mSlime(col, s = 1, crown) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  part(b, SPH, S(col, { transparent: true, opacity: .93, emissive: col, emissiveIntensity: .12 }), .46 * s, .4 * s, .46 * s, 0, .4 * s, 0);
  part(b, SPH, S(darker(col, .7)), .3 * s, .1 * s, .3 * s, 0, .04 * s, 0, 0, 0, 0, false);
  shine(b, -.16 * s, .62 * s, .22 * s, .12 * s);
  eyes(b, 0, .46 * s, .36 * s, .1 * s, .14 * s);
  part(b, SPH, S(0x2a1020), .07 * s, .035 * s, .03 * s, 0, .3 * s, .43 * s, 0, 0, 0, false);
  if (crown) {
    const gold = S(0xffcc33, { emissive: 0x664400 });
    part(b, CYL, gold, .26 * s, .1 * s, .26 * s, 0, .8 * s, 0);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; part(b, CONE, gold, .06 * s, .18 * s, .06 * s, Math.cos(a) * .22 * s, .93 * s, Math.sin(a) * .22 * s); }
    part(b, SPH, S(0xff3355, { emissive: 0xff3355, emissiveIntensity: .8 }), .05 * s, .05 * s, .04 * s, 0, .8 * s, .26 * s);
  }
  return { g, body: b, r: .42 * s, h: (.8 + (crown ? .3 : 0)) * s, col };
}
function mShroom() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  part(b, CapsuleGeo(), S(0xf6ead2), .2, .36, .2, 0, .26, 0);
  eyes(b, 0, .3, .17, .06, .08); part(b, SPH, S(0x2a1020), .04, .02, .02, 0, .2, .2, 0, 0, 0, false);
  const capM = S(0xe8403a);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 12, 0, TAU, 0, Math.PI / 2), capM); cap.scale.set(.46, .32, .46); cap.position.y = .5; cap.castShadow = true; b.add(cap);
  for (const [a, h] of [[0, .3], [1.3, .55], [2.6, .4], [3.9, .6], [5.2, .35], [0, .95]]) { const r = Math.cos(h * Math.PI / 2) * .44, y = .5 + Math.sin(h * Math.PI / 2) * .3; part(b, SPH, S(0xffffff), .07, .03, .07, Math.cos(a) * r, y, Math.sin(a) * r, 0, 0, 0, false).lookAt(0, -2, 0); }
  return { g, body: b, r: .4, h: .9, col: 0xe8403a };
}
function mBee() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); b.position.y = .85;
  part(b, SPH, S(0xffcc2a), .26, .24, .32, 0, 0, 0);
  for (const z of [-.02, -.16]) part(b, CYL, S(0x2a2030), .25, .06, .25, 0, 0, z, Math.PI / 2);
  part(b, CONE, S(0x2a2030), .05, .14, .05, 0, -.02, -.36, -Math.PI / 2);
  eyes(b, 0, .06, .25, .07, .09);
  for (const x of [-.08, .08]) { part(b, CYL, S(0x2a2030), .012, .16, .012, x, .27, .14, -.4); part(b, SPH, S(0x2a2030), .03, .03, .03, x, .34, .2); }
  const wm = S(0xffffff, { transparent: true, opacity: .65 }), wl = new THREE.Group(), wr = new THREE.Group();
  wl.position.set(-.1, .2, 0); wr.position.set(.1, .2, 0); b.add(wl, wr);
  part(wl, SPH, wm, .2, .02, .12, -.18, 0, 0, 0, 0, 0, false); part(wr, SPH, wm, .2, .02, .12, .18, 0, 0, 0, 0, 0, false);
  return { g, body: b, r: .34, h: 1.3, col: 0xffcc2a, anim: (t) => { wl.rotation.z = Math.sin(t * 40) * .5; wr.rotation.z = -wl.rotation.z; } };
}
const WING = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(.5, .18); sh.quadraticCurveTo(.48, .02, .42, -.02); sh.quadraticCurveTo(.36, -.1, .28, -.06); sh.quadraticCurveTo(.2, -.14, .12, -.06); sh.lineTo(0, -.04); return new THREE.ShapeGeometry(sh, 6).rotateX(-Math.PI / 2); })();
function mBat(col) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); b.position.y = .95;
  part(b, SPH, S(col), .22, .2, .2, 0, 0, 0);
  for (const x of [-.1, .1]) part(b, CONE, S(col), .06, .14, .05, x, .22, 0, 0, 0, -x * 2);
  for (const x of [-.07, .07]) part(b, SPH, S(0xffd040, { emissive: 0xffa020, emissiveIntensity: 1.5 }), .045, .045, .03, x, .04, .18, 0, 0, 0, false);
  part(b, CONE, S(0xffffff), .02, .05, .02, -.03, -.08, .18, Math.PI); part(b, CONE, S(0xffffff), .02, .05, .02, .03, -.08, .18, Math.PI);
  const wm = new THREE.MeshLambertMaterial({ color: darker(col, .8), side: THREE.DoubleSide }), wl = new THREE.Group(), wr = new THREE.Group();
  wl.position.x = -.15; wr.position.x = .15; b.add(wl, wr);
  const a = new THREE.Mesh(WING, wm); a.scale.set(-1.1, 1, 1.1); wl.add(a); const c = new THREE.Mesh(WING, wm); c.scale.set(1.1, 1, 1.1); wr.add(c);
  return { g, body: b, r: .36, h: 1.35, col, anim: (t) => { wl.rotation.z = Math.sin(t * 16) * .7; wr.rotation.z = -wl.rotation.z; } };
}
function mScorp() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); const c = S(0xe0883a), d = S(0xb0602a);
  part(b, SPH, c, .32, .18, .4, 0, .22, 0); part(b, SPH, c, .24, .16, .2, 0, .25, .38);
  eyes(b, 0, .34, .52, .06, .08);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) part(b, CYL, d, .025, .36, .025, s * .32, .12, -.18 + k * .17, 0, 0, s * 1.1);
    part(b, CapsuleGeo(), d, .06, .26, .06, s * .26, .2, .55, Math.PI / 2, 0, 0); part(b, SPH, c, .13, .09, .12, s * .3, .2, .78);
    part(b, CONE, d, .05, .14, .04, s * .36, .2, .9, Math.PI / 2, 0, s * .3);
  }
  const t = new THREE.Group(); t.position.set(0, .3, -.32); b.add(t);
  [[0, .05, -.14, .12], [0, .26, -.3, .11], [0, .5, -.26, .1], [0, .66, -.08, .09]].forEach(([x, y, z, r]) => part(t, SPH, c, r, r, r, x, y, z));
  part(t, CONE, S(0xff3b2f, { emissive: 0xff3b2f, emissiveIntensity: .5 }), .06, .2, .06, 0, .7, .08, Math.PI * .7);
  return { g, body: b, r: .46, h: 1.0, col: 0xe0883a, anim: (tt) => { t.rotation.x = Math.sin(tt * 5) * .18; } };
}
function mCactus() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); const c = S(0x4fb04a);
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.26, 0], [.32, .22], [.3, .26], [0, .26]].map(([a, y]) => new THREE.Vector2(a, y)), 18), S(0xd0784a)); pot.castShadow = true; b.add(pot);
  part(b, CapsuleGeo(), c, .26, .75, .26, 0, .7, 0);
  part(b, CapsuleGeo(), c, .1, .3, .1, -.3, .78, 0, 0, 0, .9); part(b, CapsuleGeo(), c, .1, .24, .1, .3, .62, 0, 0, 0, -.9);
  part(b, SPH, S(0xff6aa0), .12, .08, .12, 0, 1.12, 0); part(b, SPH, S(0xffe14a), .05, .04, .05, 0, 1.18, 0);
  eyes(b, 0, .82, .22, .07, .09); part(b, SPH, S(0x2a1020), .06, .03, .02, 0, .66, .25, 0, 0, 0, false);
  return { g, body: b, r: .36, h: 1.2, col: 0x4fb04a };
}
function mSnow() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); b.position.y = .4;
  part(b, SPH, S(0xf6faff), .4, .4, .4, 0, 0, 0);
  eyes(b, 0, .1, .34, .07, .1, 0x202838);
  part(b, CONE, S(0xff8a1e), .05, .22, .05, 0, -.02, .48, Math.PI / 2);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 8, 20), S(0xe83a4a)); sc.rotation.x = Math.PI / 2; sc.position.y = .24; b.add(sc);
  return { g, body: b, r: .4, h: .9, col: 0xdfe9ff, roll: true };
}
function mWizard(col) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); const robe = S(col), dk = S(darker(col, .7));
  part(b, CONE, robe, .38, .85, .38, 0, .42, 0); part(b, CYL, dk, .39, .08, .39, 0, .05, 0);
  part(b, SPH, S(0xf6d0a8), .19, .19, .18, 0, .9, 0);
  part(b, SPH, S(0xffffff), .17, .2, .1, 0, .76, .12);
  eyes(b, 0, .95, .15, .05, .07);
  const hat = part(b, CONE, robe, .26, .55, .26, 0, 1.3, -.03, -.25); part(b, CYL, robe, .3, .05, .3, 0, 1.06, 0);
  part(b, SPH, S(0xffe14a, { emissive: 0xffc020 }), .05, .05, .05, 0, 1.55, -.18);
  part(b, CYL, S(0x8a5a34), .03, 1.1, .03, .36, .58, .1);
  part(b, OCT, S(0x9ff0ff, { emissive: 0x4fd8ff, emissiveIntensity: 1.6 }), .1, .14, .1, .36, 1.2, .1);
  return { g, body: b, r: .36, h: 1.65, col };
}
function mBrute(kind) { // the sand golem or the yeti
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const golem = kind === 'golem', skin = golem ? S(0xe0b878, { flatShading: true }) : S(0xf6f8ff), dark = golem ? S(0xb08a50, { flatShading: true }) : S(0xd8e2f0);
  const geo = golem ? ROCK : BUSH;
  const legs = [-.32, .32].map((x) => { const v = new THREE.Group(); v.position.set(x, .62, 0); b.add(v); part(v, geo, dark, .24, .34, .24, 0, -.32, 0); return v; });
  part(b, geo, skin, .68, .58, .5, 0, 1.15, 0);
  if (golem) { for (const [x, y] of [[-.3, 1.3], [.25, .95], [.1, 1.45]]) part(b, CYL, S(0xffa030, { emissive: 0xff8a10, emissiveIntensity: 1.5 }), .03, .25, .03, x, y, .48, 0, 0, R() - .5, false); }
  const head = new THREE.Group(); head.position.set(0, 1.85, .08); b.add(head);
  part(head, geo, skin, .36, .32, .32, 0, 0, 0);
  if (golem) for (const x of [-.13, .13]) part(head, SPH, S(0xffc040, { emissive: 0xff9a10, emissiveIntensity: 2 }), .07, .05, .03, x, .03, .3, 0, 0, 0, false);
  else { part(head, SPH, S(0x8ab4e8), .26, .22, .1, 0, -.02, .26); eyes(head, 0, .05, .33, .06, .1); part(head, SPH, S(0x2a2a40), .1, .04, .03, 0, -.12, .35, 0, 0, 0, false); for (const x of [-1, 1]) part(head, CONE, S(0xd0d4e0), .07, .3, .07, x * .3, .3, 0, 0, 0, -x * .5); }
  const arms = [-1, 1].map((x) => { const v = new THREE.Group(); v.position.set(x * .78, 1.45, 0); b.add(v); part(v, geo, skin, .22, .5, .24, 0, -.42, 0); part(v, geo, dark, .26, .2, .27, 0, -.95, 0); return v; });
  return { g, body: b, r: .9, h: 2.4, col: golem ? 0xe0b878 : 0xf6f8ff, anim: (t, e) => { const m = e.vx || e.vz ? Math.sin(t * 9) * .5 : 0; legs[0].rotation.x = m; legs[1].rotation.x = -m; arms[0].rotation.x = -m * .6 - (e.tele > 0 ? 1.2 : 0); arms[1].rotation.x = m * .6 - (e.tele > 0 ? 1.2 : 0); } };
}

// hp/dmg are for the first island; islands and later rooms make them stronger
const E = {
  slime: { hp: 34, dmg: 12, speed: 1.6, xp: 2, ai: 'hopper', model: () => mSlime(0x5cc8ff) },
  shroom: { hp: 30, dmg: 10, xp: 2, ai: 'turret', shot: { n: 3, spread: .32, speed: 4.5 }, every: 2.4, model: mShroom },
  bee: { hp: 22, dmg: 10, xp: 2, ai: 'dasher', fly: true, speed: 1.4, dash: 8.5, model: mBee },
  bigslime: { name: 'Big Blue Slime', hp: 330, dmg: 16, speed: 1.3, xp: 14, ai: 'hopper', ring: 8, model: () => mSlime(0x48b8f0, 1.8), big: true },
  slimeking: { name: 'Slime King', hp: 900, dmg: 20, speed: 1.1, xp: 30, ai: 'boss', acts: ['jump', 'spray', 'jump', 'summon'], minion: 'slime', model: () => mSlime(0xb07cff, 2.5, true), boss: true },
  scorp: { hp: 40, dmg: 14, speed: 2.5, xp: 3, ai: 'chaser', model: mScorp },
  cactus: { hp: 44, dmg: 12, xp: 3, ai: 'turret', shot: { ring: 8, speed: 4 }, every: 2.7, model: mCactus },
  bat: { hp: 28, dmg: 12, speed: 1.7, xp: 3, ai: 'flyer', fly: true, shot: { n: 1, speed: 5.5 }, every: 2.2, model: () => mBat(0x7a4a3a) },
  bigscorp: { name: 'Giant Scorpion', hp: 420, dmg: 18, speed: 1.4, xp: 16, ai: 'dasher', dash: 10, ring: 10, scale: 1.8, model: mScorp, big: true },
  golem: { name: 'Sand Golem', hp: 1300, dmg: 22, speed: 1.0, xp: 34, ai: 'boss', acts: ['boulders', 'stomp', 'charge', 'boulders', 'summon'], minion: 'scorp', model: () => mBrute('golem'), boss: true },
  snowball: { hp: 46, dmg: 16, speed: 2.8, xp: 3, ai: 'chaser', model: mSnow },
  wizard: { hp: 40, dmg: 14, speed: 1.2, xp: 3, ai: 'turret', wander: true, shot: { n: 3, spread: .2, speed: 6 }, every: 2.1, model: () => mWizard(0x3a7bd5) },
  icebat: { hp: 34, dmg: 13, speed: 1.5, xp: 3, ai: 'dasher', fly: true, dash: 10, model: () => mBat(0x8fd0ff) },
  bigwizard: { name: 'Frost Wizard', hp: 520, dmg: 18, speed: 1.2, xp: 18, ai: 'turret', wander: true, shot: { n: 5, spread: .25, speed: 6 }, every: 1.7, ring2: 12, scale: 1.6, model: () => mWizard(0x6a4fd0), big: true },
  yeti: { name: 'Big Yeti', hp: 1700, dmg: 24, speed: 1.3, xp: 40, ai: 'boss', acts: ['charge', 'spiral', 'spray', 'charge', 'ring', 'summon'], minion: 'snowball', model: () => mBrute('yeti'), boss: true },
};

const ISLES = [
  { name: 'Clover Isle', need: 0, sky: 0xa8e0ff, skyTop: '#3f8fe8', hemi: [0xbfe4ff, 0x5a6a2a], sunCol: 0xfff0c8, tops: [0xe0ff9a, 0x9fe8a8], patch: '#d8ff6a', motes: 0xf6ff9a, paint: ['#64b04e', '#8ccc6c', '#4a9642'], land: [0x6cc450, 0x96d868, 0xc4986a, 0xe8d898], cliff2: 0xa88a74, hedge: [0x4fc040, 0x5fd04a, 0x46b23a, 0x6ad855], floor: ['#6cbf4b', '#63b545'], ground: 'grass', side: 'grassSide', wall: ['leaves', 'leaves'], blocks: [['cobble'], ['logTop', 'log'], ['planks']], tree: 'oak', bullet: 0xff4a3a,
    enemies: ['slime', 'shroom', 'bee'], mini: 'bigslime', boss: 'slimeking', hp: 1, dmg: 1, mult: 1, sub: 'Slimes, mushrooms and bees' },
  { name: 'Sunsand Isle', need: 25, sky: 0xffe0b0, skyTop: '#ff9a5a', hemi: [0xffe0c0, 0x8a6a3a], sunCol: 0xffe0a8, tops: [0xfff0b0, 0xffc890], patch: '#ffd27a', motes: 0xffc070, paint: ['#f4d690', '#ffe8b0', '#e0b870'], land: [0xf6d98e, 0xffe6a8, 0xe0a060, 0xf0dca0], cliff2: 0xc87a4a, hedge: [0xe8c088, 0xdcae74, 0xf0cc94], floor: ['#ecd391', '#e3c884'], ground: 'sand', side: 'sandstone', wall: ['sandstone', 'sandstone'], blocks: [['sandstone'], ['sandstone'], ['crate']], tree: 'palm', bullet: 0xff8a1a,
    enemies: ['scorp', 'cactus', 'bat'], mini: 'bigscorp', boss: 'golem', hp: 1.9, dmg: 1.35, mult: 2, sub: 'Scorpions, cacti and bats' },
  { name: 'Frostpeak Isle', need: 80, sky: 0xd0e4ff, skyTop: '#5a7ae8', hemi: [0xd8e8ff, 0x6a7a9a], sunCol: 0xfff4f0, tops: [0xffffff, 0xc8dcff], patch: '#bcd4ff', motes: 0xffffff, paint: ['#eef4ff', '#ffffff', '#c8d8f0'], land: [0xf4f8ff, 0xe0ecff, 0x9aa8c4, 0xd8e8ff], cliff2: 0x7a88a8, hedge: [0xe8f2ff, 0xd8e8f8, 0xf6faff], floor: ['#eef4ff', '#e2ebf9'], ground: 'snow', side: 'snowSide', wall: ['ice', 'ice'], blocks: [['ice'], ['stone'], ['snow', 'snowSide']], tree: 'pine', bullet: 0x2fd2ff,
    enemies: ['snowball', 'wizard', 'icebat'], mini: 'bigwizard', boss: 'yeti', hp: 3.1, dmg: 1.75, mult: 3, sub: 'Snowballs, ice wizards and frost bats' },
];
const unlocked = (i) => save.trophies >= ISLES[i].need;

/* ---------- icons (made in ChatGPT: Foxino/Arrow Isles/Icons → icons/) ---------- */
const TRO = '<img class="tro" src="icons/trophy.png" alt="🏆">';
const skillIcon = (s) => `<img src="icons/${s.id}.png" alt="" onerror="this.replaceWith('${s.ic}')">`;
const PERK_ICON = { foxino: 'perk_captain', stella: 'perk_navigator', pix: 'perk_engineer', rob: 'perk_robot', gummy: 'perk_lookout', charlie: 'perk_ghost' };
const perkIcon = (id) => `<img src="icons/${PERK_ICON[id]}.png" alt="" onerror="this.remove()">`;

/* ---------- skills you can pick when you level up ---------- */
const SKILLS = [
  { id: 'multi', ic: '🏹', name: 'Double Shot', txt: '+1 arrow straight ahead', max: 3, f: () => { P.front++; } },
  { id: 'diag', ic: '🔱', name: 'Fan Shot', txt: '+2 arrows at an angle', max: 2, f: () => { P.diag++; } },
  { id: 'side', ic: '↔️', name: 'Side Shot', txt: '+2 arrows left and right', max: 1, f: () => { P.side++; } },
  { id: 'back', ic: '↩️', name: 'Back Shot', txt: '+1 arrow behind you', max: 2, f: () => { P.back++; } },
  { id: 'bounce', ic: '🏓', name: 'Bouncy Arrows', txt: 'arrows bounce off walls', max: 2, f: () => { P.bounce++; } },
  { id: 'pierce', ic: '📌', name: 'Piercing Arrows', txt: 'arrows fly through 1 more enemy', max: 2, f: () => { P.pierce++; } },
  { id: 'fire', ic: '🔥', name: 'Fire Arrows', txt: 'enemies burn for 2 seconds', max: 1, f: () => { P.fire = 1; } },
  { id: 'ice', ic: '❄️', name: 'Ice Arrows', txt: 'enemies slow down', max: 1, f: () => { P.ice = 1; } },
  { id: 'speed', ic: '⚡', name: 'Quick Bow', txt: 'shoot 20% faster', max: 4, f: () => { P.atkInt *= .82; } },
  { id: 'power', ic: '💪', name: 'Strong Bow', txt: '+25% damage', max: 5, f: () => { P.dmg *= 1.25; } },
  { id: 'feet', ic: '👟', name: 'Swift Feet', txt: 'move 15% faster', max: 2, f: () => { P.speed *= 1.15; } },
  { id: 'heart', ic: '❤️', name: 'Big Heart', txt: '+25% max HP', max: 4, f: () => { const a = Math.round(P.maxHp * .25); P.maxHp += a; P.hp += a; } },
  { id: 'snack', ic: '🍎', name: 'Snack Time', txt: 'heal 40% of your HP', max: 99, f: () => { P.hp = Math.min(P.maxHp, P.hp + Math.round(P.maxHp * .4)); } },
  { id: 'orb', ic: '🟦', name: 'Buddy Block', txt: 'a block circles you and hits enemies', max: 3, f: () => addOrb() },
  { id: 'dodge', ic: '🍀', name: 'Lucky Dodge', txt: '12% chance to dodge a hit', max: 2, f: () => { P.dodge += .12; } },
  { id: 'vamp', ic: '💚', name: 'Hearty Hunter', txt: 'heal a little for every enemy you beat', max: 2, f: () => { P.vamp += .03; } },
];

/* ---------- English questions: the A0–A2 gap-fill packages (same as Odyssey and Hop Rush) ---------- */
const PACKS = window.FugioPacks ? FugioPacks.sort(window.GUMMY_PACKAGES || []) : (window.GUMMY_PACKAGES || []);
save.packs = (save.packs || []).filter((id) => PACKS.some((p) => p.id === id));
if (!save.packs.length && PACKS.length) save.packs = [PACKS[0].id];
const packNow = () => (window.FugioPacks ? FugioPacks.merge(PACKS, save.packs) : PACKS[0]) || PACKS[0];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SLOT = new Set(['do', 'does', "don't", "doesn't", 'did', "didn't", 'was', 'were', "wasn't", "weren't", 'is', 'are', 'am',
  "isn't", "aren't", 'a', 'an', 'the', 'more', 'most', 'less', 'least', 'because', 'so', 'and', 'but', 'or', 'have', 'has', 'not']);
const slotKey = (t) => t.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean).map((w) => SLOT.has(w) ? w : '_').join(' ');
function mixComparisons(q) {
  const m = q.match(/^(.*)\[([^|\]]+)\|(the [^|\]]+)\]( \([^)]*\)) than [^.?!]*([.?!])$/);
  return m && R() < .5 ? `${m[1]}[${m[3]}|${m[2]}]${m[4]} of all${m[5]}` : q;
}
function fillChoices(q) {
  const m = q.match(/\[([^\]]+)\]/);
  const [right, ...wrong] = m[1].split('|');
  const words = [{ text: right, ok: true }, ...shuffle(wrong).slice(0, 2).map((t) => ({ text: t, ok: false }))];
  words.sort((x, y) => slotKey(x.text).localeCompare(slotKey(y.text)) || x.text.localeCompare(y.text));
  words.before = q.slice(0, m.index); words.after = q.slice(m.index + m[0].length); words.right = right;
  return words;
}
const usedQ = new Set();
// island 1 asks the package's easy third, island 2 the middle third, island 3 the hardest
function pickSentence() {
  const pk = packNow(); if (!pk) return null;
  const r = clamp(run.isle, 0, 2), mine = pk.rounds[r] || [], rest = pk.rounds.filter((_, i) => i !== r).flat();
  const free = (l) => l.filter((q) => !usedQ.has(q));
  let pool = free(mine); if (!pool.length) pool = free(rest);
  if (!pool.length) { usedQ.clear(); pool = mine.length ? mine : rest; }
  const q = pick(pool); usedQ.add(q); return mixComparisons(q);
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
// shows one question; resolves true for a right answer. A wrong answer shows the right one and waits for OK.
function ask(kicker, given, noRecord) {
  return new Promise((done) => {
    const q = given || pickSentence(); if (!q) return done(true);
    const w = fillChoices(q), prev = state; state = 'quiz'; endJoy(); $('quizCard').dataset.right = w.right;
    $('quizKick').textContent = kicker; $('quizWhy').textContent = ''; $('quizGo').hidden = true;
    const card = $('quizCard'), full = (cls) => card.innerHTML = `${hints(w.before)}<span class="gap ${cls || ''}">${cls ? esc(w.right) : '&nbsp;'}</span>${hints(w.after)}`;
    full('');
    const box = $('opts'); box.innerHTML = '';
    w.forEach((o) => {
      const b = document.createElement('button'); b.textContent = o.text;
      b.onclick = () => {
        if (box.dataset.done) return; box.dataset.done = 1;
        const kids = [...box.children]; kids.forEach((k, i) => { k.classList.add(w[i].ok ? 'ok' : 'dim'); }); full('ok');
        const sentence = (w.before + w.right + w.after).replace(/\s*\([^)]*\)/g, '').trim();
        if (!noRecord) run.answers.push({ ok: o.ok, sentence, right: w.right, chose: o.text, q });
        const end = (ok) => { $('quiz').hidden = true; delete box.dataset.done; state = prev === 'quiz' ? 'play' : prev; done(ok); };
        if (o.ok) { b.classList.replace('dim', 'ok'); $('quizWhy').textContent = pick(['Right!', 'Great!', 'Well done!', 'Correct!']); seq([659, 880, 1175], 70, .14); setTimeout(() => end(true), 900); }
        else { b.classList.replace('dim', 'no'); $('quizWhy').innerHTML = `The answer is <b>${esc(w.right)}</b>.`; tone(160, .3, 'square', .04, .6); const go = $('quizGo'); go.hidden = false; go.onclick = () => { sfx.click(); end(false); }; }
      };
      box.appendChild(b);
    });
    $('quiz').hidden = false;
  });
}

/* ---------- renderer, cameras ---------- */
const stage = $('stage'), cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
// if the phone's graphics reset, start again cleanly instead of freezing
cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }); cv.addEventListener('webglcontextrestored', () => location.reload());
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), menuScene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(45, 1, .5, 140), mcam = new THREE.PerspectiveCamera(40, 1, .5, 260);
function lights(sc, size) {
  const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x5a6a2a, 1.15); sc.add(hemi); sc.userData.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff0c8, 3.1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 70 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; sc.add(sun, sun.target); return sun;
}
const sun = lights(scene, 13), msun = lights(menuScene, 12), hemi = scene.userData.hemi;
let VW = 1, VH = 1, camDist = 25, menuDist = 26;

/* ---------- the "shader" look: glow (bloom), film colours, vignette ---------- */
// The scene is drawn into an HDR picture; bright parts (portal, lanterns, gems, shots, rims) are blurred into a glow,
// then everything is tone-mapped (ACES), made a bit more colourful, warmed in the light and cooled in the shadows.
const stats = { calls: 0, tris: 0 };
const post = (() => {
  const gl2 = renderer.capabilities.isWebGL2;
  const hdr = gl2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const mk = (samples) => new THREE.WebGLRenderTarget(4, 4, { type, samples, depthBuffer: !!samples || samples === 0 });
  let main = new THREE.WebGLRenderTarget(4, 4, { type, samples: gl2 ? 4 : 0 });
  const a = mk(), b = mk(), c = mk(), d = mk();
  for (const t of [a, b, c, d]) t.depthBuffer = false;
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); sc.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const sm = (u, fs) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  const bright = sm({ t: { value: null }, th: { value: hdr ? 1.0 : .82 } }, `uniform sampler2D t; uniform float th; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .7, l), 1.); }`);
  const blur = sm({ t: { value: null }, dir: { value: new THREE.Vector2() } }, `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * .227;
      c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * .316;
      c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * .070;
      gl_FragColor = vec4(c, 1.); }`);
  const final = sm({ t: { value: null }, b1: { value: null }, b2: { value: null }, glow: { value: .8 }, expo: { value: .97 }, res: { value: new THREE.Vector2() } }, `
    uniform sampler2D t, b1, b2; uniform float glow, expo; uniform vec2 res; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec3 c = texture2D(t, vUv).rgb + (texture2D(b1, vUv).rgb * .9 + texture2D(b2, vUv).rgb * .7) * glow;
      c = aces(c * expo);
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, 1.1);                                   // more colourful
      c = (c - .5) * 1.06 + .5;                                     // a little more contrast
      c *= mix(vec3(.93, .98, 1.1), vec3(1.06, 1.0, .9), smoothstep(.15, .75, l)); // cool shadows, warm light
      vec2 q = vUv - .5; c *= 1. - dot(q, q) * .55;                // vignette
      c = toSRGB(clamp(c, 0., 1.));
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
      gl_FragColor = vec4(c, 1.); }`);
  let on = true, W = 4, H = 4;
  function size(w, h) {
    W = w; H = h; main.setSize(w, h);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    a.setSize(hw, hh); b.setSize(hw, hh); c.setSize(qw, qh); d.setSize(qw, qh);
    final.uniforms.res.value.set(w, h);
  }
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam2); };
  function render(scene_, camera) {
    if (!on) { renderer.setRenderTarget(null); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.render(scene_, camera); return; }
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(main); renderer.render(scene_, camera); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    bright.uniforms.t.value = main.texture; pass(bright, a);
    blur.uniforms.t.value = a.texture; blur.uniforms.dir.value.set(1 / a.width, 0); pass(blur, b);
    blur.uniforms.t.value = b.texture; blur.uniforms.dir.value.set(0, 1 / a.height); pass(blur, a);
    blur.uniforms.t.value = a.texture; blur.uniforms.dir.value.set(1 / c.width, 0); pass(blur, c);
    blur.uniforms.t.value = c.texture; blur.uniforms.dir.value.set(0, 1 / c.height); pass(blur, d);
    final.uniforms.t.value = main.texture; final.uniforms.b1.value = a.texture; final.uniforms.b2.value = d.texture;
    pass(final, null);
  }
  // slower phones: fewer pixels first, then no edge smoothing, then no post at all
  function lower(level) {
    if (level === 1) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4)); }
    if (level === 2) { main.dispose(); main = new THREE.WebGLRenderTarget(4, 4, { type, samples: 0 }); renderer.setPixelRatio(1.15); }
    if (level === 3) { on = false; renderer.setPixelRatio(1); }
    fit();
  }
  return { size, render, lower, get on() { return on; } };
})();
let quality = 0, slowT = 0;
function watchSpeed(rawDt) {
  if (quality >= 3) return;
  slowT = rawDt > 1 / 38 ? slowT + rawDt : Math.max(0, slowT - rawDt * .5);
  if (slowT > 2.5) { quality++; slowT = 0; post.lower(quality); }
}
function fit() {
  VH = window.innerHeight;
  // The play area used to be capped at 0.62 x the height — a phone shape — so on a laptop or a classroom
  // screen the game sat in a narrow strip with empty bars either side, using about 40% of the width.
  // It now fills the window up to 1.6 x the height, which is the whole screen on anything up to 16:10 and
  // still keeps an ultra-wide monitor from stretching the view.
  VW = Math.min(window.innerWidth, Math.round(VH * 1.6));
  stage.style.width = VW + 'px';
  renderer.setSize(VW, VH);
  const pr = renderer.getPixelRatio(); post.size(Math.round(VW * pr), Math.round(VH * pr));
  cam.aspect = mcam.aspect = VW / VH; cam.updateProjectionMatrix(); mcam.updateProjectionMatrix();
  const hw = (c) => Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) * c.aspect;
  camDist = clamp(4.85 / hw(cam), 13, 40);
  menuDist = clamp(5.6 / hw(mcam), 12, 48);
  camRange();
}
addEventListener('resize', fit);

/* ---------- player ---------- */
const P = { rig: null, x: 0, z: 6, face: Math.PI, orbs: [] };
function newPlayer() {
  for (const o of P.orbs) scene.remove(o);
  Object.assign(P, { x: 0, z: 6, face: Math.PI, hp: 120, maxHp: 120, dmg: 22, atkInt: .7, atkT: .3, speed: 4.2, front: 1, diag: 0, side: 0, back: 0, bounce: 0, pierce: 0, fire: 0, ice: 0, dodge: 0, vamp: 0,
    orbs: [], inv: 0, lvl: 1, xp: 0, pend: 0, taken: {}, dead: false, shootAnim: 0, moving: false, deadT: 0 });
  HEROES[save.hero].mod(P);
  if (P.rig) scene.remove(P.rig.g);
  P.rig = mHero(save.hero); scene.add(P.rig.g);
}
const ORB_M = new THREE.MeshLambertMaterial({ color: 0x4fd8ff, emissive: 0x4fd8ff, emissiveIntensity: 2 });
function addOrb() { const m = new THREE.Mesh(SPH, ORB_M); m.scale.setScalar(.2); m.castShadow = true; scene.add(m); P.orbs.push(m); }

/* ---------- input: drag anywhere to move, keyboard too ---------- */
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = 1; if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); } });
addEventListener('keyup', (e) => { keys[e.code] = 0; });
const joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, joyEl = $('joy'), knob = $('joyK');
function endJoy() { joy.on = false; joy.x = joy.y = 0; joyEl.style.display = 'none'; }
const swipe = { x: null };
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const r = stage.getBoundingClientRect();
  if (state === 'menu') { swipe.x = e.clientX; return; }
  if (state !== 'play') return;
  Object.assign(joy, { on: true, id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: 0, y: 0 });
  joyEl.style.display = 'block'; joyEl.style.left = joy.ox + 'px'; joyEl.style.top = joy.oy + 'px'; knob.style.transform = '';
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  $('hint').style.opacity = 0;
});
stage.addEventListener('pointermove', (e) => {
  if (!joy.on || e.pointerId !== joy.id) return;
  const r = stage.getBoundingClientRect(); let dx = e.clientX - r.left - joy.ox, dy = e.clientY - r.top - joy.oy;
  const d = Math.hypot(dx, dy), m = 48; if (d > m) { dx *= m / d; dy *= m / d; }
  joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const up = (e) => {
  if (state === 'menu' && swipe.x !== null) { const dx = e.clientX - swipe.x; if (Math.abs(dx) > 45) showIsle(menu.cur + (dx < 0 ? 1 : -1)); swipe.x = null; }
  if (e.pointerId === joy.id) endJoy();
};
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);

/* ---------- the room ---------- */
// inside: x −4…4 (9 blocks), z −7…7 (15 blocks). Walls at x ±5 and z ±8; the gate is in the top wall at x −1…1.
const run = { isle: 0, room: 0, tro: 0, bonus: 0, answers: [], trial: [0, 0], fixed: 0 };
let env = null, room = null, state = 'menu', T = 0, camZ = 0, shakeT = 0;
const enemies = [], arrows = [], bullets = [], gems = [], parts = [], temps = [];
const cellAt = (x, z) => { const ix = Math.round(x + 4), iz = Math.round(z + 7); return ix < 0 || ix > 8 || iz < 0 || iz > 14 ? 0 : room.grid[ix][iz]; };
function blocked(x, z, r, fly, player) {
  if (x - r < -4.5 || x + r > 4.5 || z + r > 7.5) return true;
  if (z - r < -7.5 && !(player && room.open && Math.abs(x) < 1.5 - r)) return true;
  if (fly) return false;
  for (let ix = Math.round(x - r + 4); ix <= Math.round(x + r + 4); ix++)
    for (let iz = Math.round(z - r + 7); iz <= Math.round(z + r + 7); iz++)
      if (ix >= 0 && ix <= 8 && iz >= 0 && iz <= 14 && room.grid[ix][iz]) return true;
  return false;
}
function moveBody(o, dx, dz, r, fly, player) {
  if (!blocked(o.x + dx, o.z, r, fly, player)) o.x += dx;
  if (!blocked(o.x, o.z + dz, r, fly, player)) o.z += dz;
}

/* ---------- the world: smooth, bright cartoon shapes (only the heroes stay blocky) ---------- */
const smoothMats = {};
const S = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return smoothMats[k] || (smoothMats[k] = new THREE.MeshLambertMaterial({ color: c, ...o })); };
const SPH = new THREE.SphereGeometry(1, 14, 10), BUSH = new THREE.IcosahedronGeometry(1, 1), ROCK = new THREE.IcosahedronGeometry(1, 1);
// small things (flowers, leaves, stems) use simpler shapes: they look the same at their size and keep phones fast
const SPH_LO = new THREE.SphereGeometry(1, 8, 6), CYL_LO = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18), CONE = new THREE.ConeGeometry(1, 1, 18), OCT = new THREE.OctahedronGeometry(1, 0);
function roundBox(r = .18, seg = 5) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3(), inner = .5 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(clamp(v.x, -inner, inner), clamp(v.y, -inner, inner), clamp(v.z, -inner, inner));
    const d = v.clone().sub(c); if (d.lengthSq() > 0) { d.setLength(r); v.copy(c).add(d); } p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
const RBOX = roundBox();
// one part: geometry, material, size (radius for spheres), position, turn
function part(p, geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, sh = true) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = sh; p.add(m); return m;
}
// big cartoon eyes: white, a dark pupil and a little shine
function eyes(p, x, y, z, s, gap, col = 0x1a1030) {
  for (const k of [-1, 1]) {
    part(p, SPH, S(0xffffff), s, s * 1.12, s * .6, x + k * gap, y, z, 0, 0, 0, false);
    part(p, SPH, S(col), s * .58, s * .66, s * .4, x + k * gap, y - s * .1, z + s * .36, 0, 0, 0, false);
    part(p, SPH, S(0xffffff, { emissive: 0xffffff }), s * .2, s * .2, s * .1, x + k * gap + s * .16, y + s * .14, z + s * .52, 0, 0, 0, false);
  }
}
// geometries with a colour per part, glued into one (arrows, little props)
function mergeColored(list) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [geo, hex, m4] of list) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); if (m4) g.applyMatrix4(m4); c.set(hex);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const MX = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const VCS = new THREE.MeshLambertMaterial({ vertexColors: true });

// instanced copies: each entry [x, y, z, sx, sy, sz, turnY, colour, tiltX, tiltZ]
function inst(geo, mat, list, g, trash, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), c = new THREE.Color();
  list.forEach((o, i) => { P3.set(o[0], o[1], o[2]); S3.set(o[3] ?? 1, o[4] ?? 1, o[5] ?? 1); q.setFromEuler(e.set(o[8] || 0, o[6] || 0, o[9] || 0)); m4.compose(P3, q, S3); im.setMatrixAt(i, m4); if (o[7] != null) im.setColorAt(i, c.set(o[7])); });
  im.castShadow = shadow; im.receiveShadow = true; g.add(im); if (trash) trash.push(im); return im;
}
const WHITE = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
// 3D grass: tufts of five blades, dark at the root and light at the tip, swaying in the wind
const TUFT = (() => {
  const pos = [], col = [], c0 = new THREE.Color('#2f7d28'), c1 = new THREE.Color('#a6ec66');
  for (let b = 0; b < 5; b++) {
    const a = b / 5 * Math.PI + rand(-.3, .3), w = .07, h = rand(.7, 1), lean = rand(-.25, .25), ox = rand(-.12, .12), oz = rand(-.12, .12);
    const dx = Math.cos(a) * w, dz = Math.sin(a) * w, tx = ox + Math.sin(a) * lean, tz = oz + Math.cos(a) * lean;
    pos.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, tx, h, tz);
    col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
})();
let BLADE_M = null;
const bladeMat = () => BLADE_M || (BLADE_M = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), .16, 0));
function grassField(list, x0, x1, z0, z1, y, per, skip, tint) {
  const n = Math.round((x1 - x0) * (z1 - z0) * per);
  for (let k = 0; k < n; k++) {
    const x = rand(x0, x1), z = rand(z0, z1); if (skip && skip(x, z)) continue;
    const s = rand(.3, .5), c = new THREE.Color(tint ?? 0xffffff).multiply(new THREE.Color(rand(.85, 1.1), rand(.9, 1.1), rand(.8, 1.05)));
    list.push([x, typeof y === 'function' ? y(x, z) : y, z, s * rand(.8, 1.2), s, s * rand(.8, 1.2), R() * TAU, c.getHex()]);
  }
}
const hnoise = (x, z, s) => Math.sin(x * .45 + s) * Math.cos(z * .38 + s * 2) + Math.sin((x + z) * .21 + s) * .6;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// nature lists, drawn as a few instanced meshes
function nature() { return { trunk: [], ball: [], cone: [], leaf: [], rock: [], stem: [], bloom: [], cap: [], tuft: [], cact: [], crys: [] }; }
const LEAVES = { oak: [0x5fd04a, 0x6ad855, 0x4fc040, 0xff9ccb, 0xffb0d8, 0xffb24a], palm: [0x6cd84a, 0x58c43c], pine: [0x2f9a55, 0x3aa862] };
function tree(N, kind, x, y, z, s = 1) {
  if (kind === 'oak') {
    const h = rand(1.6, 2.2) * s, col = pick(LEAVES.oak);
    N.trunk.push([x, y + h / 2, z, .2 * s, h, .2 * s, 0, 0x9a6438]);
    const top = y + h + .5 * s;
    [[0, 0, 0, 1.15], [.6, -.25, .3, .8], [-.55, -.2, -.35, .85], [.1, .55, -.2, .75], [-.3, .1, .55, .7]].forEach(([dx, dy, dz, r]) =>
      N.ball.push([x + dx * s, top + dy * s, z + dz * s, r * s, r * s * .9, r * s, R() * TAU, new THREE.Color(col).multiplyScalar(rand(.9, 1.08)).getHex()]));
    if (col > 0xff0000) for (let k = 0; k < 6; k++) N.bloom.push([x + rand(-1.6, 1.6), y + .03, z + rand(-1.6, 1.6), .08, .02, .08, 0, pick([0xffc8e0, 0xff9ccb])]);
  } else if (kind === 'palm') {
    const h = rand(2.4, 3.2) * s, lean = rand(-.3, .3); let px = x;
    for (let k = 0; k < 6; k++) { N.trunk.push([px, y + (k + .5) * h / 6, z, .16 * s, h / 6 + .02, .16 * s, 0, k % 2 ? 0xc49060 : 0xb07a48, 0, -lean * .4]); px += lean * .12; }
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; N.leaf.push([px + Math.cos(a) * .75 * s, y + h + .05, z + Math.sin(a) * .75 * s, .9 * s, .07 * s, .26 * s, -a, pick(LEAVES.palm), 0, -.35]); }
    N.ball.push([px + .15, y + h - .12, z + .12, .14, .14, .14, 0, 0x7a4a24], [px - .12, y + h - .14, z - .1, .14, .14, .14, 0, 0x7a4a24]);
  } else {
    const h = rand(.5, .8) * s; N.trunk.push([x, y + h / 2, z, .18 * s, h, .18 * s, 0, 0x7a5234]);
    [[1.25, 1.2, 0], [1.0, 1.05, .8], [.72, .95, 1.5], [.42, .8, 2.1]].forEach(([r, hh, dy]) => {
      N.cone.push([x, y + h + dy * s + hh * s / 2, z, r * s, hh * s, r * s, R() * TAU, pick(LEAVES.pine)]);
      if (kind === 'pine') N.cone.push([x, y + h + dy * s + hh * s * .78, z, r * s * .55, hh * s * .42, r * s * .55, 0, 0xf4f8ff]);
    });
  }
}
function flowers(N, x, y, z, n = 3) {
  for (let k = 0; k < n; k++) {
    const fx = x + rand(-.4, .4), fz = z + rand(-.4, .4), h = rand(.18, .3);
    N.stem.push([fx, y + h / 2, fz, .018, h, .018, 0, 0x3f9a2f]);
    N.bloom.push([fx, y + h + .02, fz, .08, .06, .08, 0, pick([0xff4a5a, 0xffd23a, 0xffffff, 0xb07aff, 0xff8ad0, 0x4ab4ff])]);
  }
}
function decoAt(N, I, x, y, z) {
  const r = R();
  if (I.ground === 'grass') {
    if (r < .45) flowers(N, x, y, z, 2 + (R() * 3 | 0));
    else if (r < .6) { N.stem.push([x, y + .1, z, .05, .2, .05, 0, 0xf4ead6]); N.cap.push([x, y + .2, z, .14, .1, .14, 0, 0xe8403a]); }
    else if (r < .75) N.rock.push([x, y + .1, z, rand(.2, .4), rand(.15, .3), rand(.2, .4), R() * TAU, 0xb4b0a8]);
  } else if (I.ground === 'sand') {
    if (r < .35) { const h = rand(.6, 1.2); N.cact.push([x, y + h / 2, z, .2, h, .2, 0, 0x4fb04a]); if (R() < .6) N.cact.push([x + .22, y + h * .55, z, .09, .35, .09, 0, 0x4fb04a, 0, -.5]); }
    else if (r < .65) N.rock.push([x, y + .12, z, rand(.25, .5), rand(.2, .35), rand(.25, .5), R() * TAU, 0xe0b878]);
    else if (r < .75) flowers(N, x, y, z, 2);
  } else {
    if (r < .3) { const h = rand(.6, 1.4); N.crys.push([x, y + h / 2, z, .22, h, .22, R() * TAU, 0xa8e4ff, rand(-.2, .2), rand(-.2, .2)]); }
    else if (r < .6) N.rock.push([x, y + .12, z, rand(.25, .5), rand(.2, .35), rand(.25, .5), R() * TAU, 0xdfe8f4]);
  }
}
function flushNature(N, g, trash) {
  inst(CYL, WHITE(), N.trunk, g, trash);
  inst(BUSH, windy(WHITE(), .03, .9), N.ball, g, trash);
  inst(CONE, windy(WHITE(), .02, .5), N.cone, g, trash);
  inst(SPH_LO, windy(WHITE(), .05, .3), N.leaf, g, trash);
  inst(ROCK, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), N.rock, g, trash);
  inst(CYL_LO, windy(WHITE(), .1, .5), N.stem, g, trash, false);
  inst(SPH_LO, windy(WHITE(), .1, 4), N.bloom, g, trash, false);
  inst(SPH_LO, WHITE(), N.cap, g, trash);
  inst(TUFT, bladeMat(), N.tuft, g, trash, false);
  inst(CapsuleGeo(), WHITE(), N.cact, g, trash);
  inst(OCT, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .85, emissive: 0x2a5a7a }), N.crys, g, trash);
}
let CAPS = null;
const CapsuleGeo = () => CAPS || (CAPS = new THREE.CapsuleGeometry(1, 1, 3, 10).scale(1, .5, 1));

// painted ground for the room: soft colour patches, little strokes, shade along the walls
function paintFloor(I) {
  const W = 360, H = 600, P = I.paint;
  const t = tex(W, H, (x) => {
    x.fillStyle = P[0]; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 46; k++) {
      const gx = rand(0, W), gy = rand(0, H), r = rand(30, 90), gr = x.createRadialGradient(gx, gy, 0, gx, gy, r), c = R() < .55 ? P[1] : P[2];
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .45; x.fillStyle = gr; x.fillRect(0, 0, W, H);
    }
    x.globalAlpha = 1;
    if (I.ground === 'grass') for (let k = 0; k < 1400; k++) { const gx = rand(0, W), gy = rand(0, H), l = rand(3, 7); x.strokeStyle = R() < .5 ? 'rgba(40,110,30,.35)' : 'rgba(190,255,130,.35)'; x.lineWidth = rand(1, 2); x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + rand(-2, 2), gy - l); x.stroke(); }
    if (I.ground === 'sand') for (let y = 10; y < H; y += rand(16, 26)) { x.strokeStyle = 'rgba(190,140,70,.22)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= W; i += 10) x.lineTo(i, y + Math.sin(i * .05 + y) * 4); x.stroke(); }
    if (I.ground === 'snow') for (let k = 0; k < 260; k++) { x.fillStyle = `rgba(255,255,255,${rand(.4, .9)})`; x.beginPath(); x.arc(rand(0, W), rand(0, H), rand(.8, 1.8), 0, TAU); x.fill(); }
    { // the path: a soft bed and rows of rounded stones, wider at the gate
      const pc = { grass: ['#b4ab95', '#a39883', '#c2b9a3', 'rgba(60,50,30,.22)'], sand: ['#e3a46e', '#cf8d5a', '#f0b884', 'rgba(110,60,20,.25)'], snow: ['#a9c3e6', '#93b1da', '#c6dbf5', 'rgba(40,60,110,.22)'] }[I.ground];
      const cx = W / 2; x.fillStyle = pc[3];
      for (let y = 0; y < H; y += 4) { const w = 44 + (y < 60 ? (60 - y) * .7 : 0) + Math.sin(y * .05) * 3; x.fillRect(cx - w, y, w * 2, 4); }
      for (let y = 4, row = 0; y < H - 2; y += 21, row++) {
        const w = 38 + (y < 60 ? (60 - y) * .6 : 0); let px = cx - w + (row % 2 ? 9 : 0);
        while (px < cx + w - 8) {
          const sw = rand(15, 22), sh = rand(13, 17), c = pick([pc[0], pc[1], pc[2]]);
          x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(px + sw / 2 + 1, y + sh / 2 + 2, sw / 2, sh / 2, 0, 0, TAU); x.fill();
          x.fillStyle = c; x.beginPath(); x.ellipse(px + sw / 2, y + sh / 2, sw / 2, sh / 2, rand(-.2, .2), 0, TAU); x.fill();
          x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(px + sw / 2 - 2, y + sh / 2 - 3, sw / 4, sh / 5, 0, 0, TAU); x.fill();
          px += sw + rand(3, 5);
        }
      }
    }
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 40, 0, 0, 0, 40, H], [W, 0, W - 40, 0, W - 40, 0, 40, H], [0, 0, 0, 44, 0, 0, W, 44], [0, H, 0, H - 24, 0, H - 24, W, 24]]) {
      const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(20,40,30,.32)'); gr.addColorStop(1, 'rgba(20,40,30,0)'); x.fillStyle = gr; x.fillRect(rx, ry, rw, rh);
    }
  });
  t.magFilter = THREE.LinearFilter; return t;
}
// soft water: a painted ripple texture that drifts
let WATER_T = null;
const waterTex = () => WATER_T || (WATER_T = (() => {
  const t = tex(128, 128, (x) => {
    x.fillStyle = '#3aa8f0'; x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(255,255,255,${rand(.15, .45)})`; x.lineWidth = rand(1.5, 3); const y = rand(0, 128), gx = rand(0, 128), l = rand(10, 30); x.beginPath(); x.moveTo(gx, y); x.quadraticCurveTo(gx + l / 2, y - 3, gx + l, y); x.stroke(); }
  }, [1, 1]);
  t.magFilter = THREE.LinearFilter; return t;
})());
const waterMat = (rep) => { const t = waterTex().clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return new THREE.MeshLambertMaterial({ map: t, color: 0xbfe6ff, emissive: 0x0a3a6a, transparent: true, opacity: .9 }); };

// the portal: an arch of white stone with moss, flowers and hanging vines; a purple swirl inside.
// Shut, a curtain of vines hangs in it; once the room is done the vines roll up and the swirl lights up.
const PORTAL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const PORTAL_FS = `uniform float uTime, uOpen; varying vec2 vUv;
  void main(){
    vec2 p = vUv - vec2(.5, .42); p.x *= 1.3; float r = length(p), a = atan(p.y, p.x);
    float sw = sin(a * 3. + r * 14. - uTime * 3.2 + 2. / (r + .25)) * .5 + .5;
    vec3 c = mix(vec3(.28, .05, .6), vec3(.95, .45, 1.), sw);
    c = mix(c, vec3(1., .85, 1.), smoothstep(.22, 0., r) * .8);
    c *= .5 + uOpen * .75;
    gl_FragColor = vec4(c, .45 + uOpen * .5);
  }`;
function makePortal(I, trash) {
  const gate = new THREE.Group(); gate.position.z = -8;
  const stone = S(0xf6f1e6), mossM = S(0x5fc848);
  for (const x of [-2, 2]) {
    part(gate, RBOX, stone, 1.15, .45, 1.15, x, .22, 0);
    part(gate, CYL, stone, .44, 2.7, .44, x, 1.7, 0);
    part(gate, RBOX, stone, 1.0, .3, 1.0, x, 3.05, 0);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2, .42, 14, 32, Math.PI), stone); arch.position.y = 3.2; arch.castShadow = true; gate.add(arch); trash.push(arch.geometry);
  part(gate, RBOX, S(0xe8e0d0), .7, .7, .9, 0, 5.15, 0, 0, 0, Math.PI / 4);
  // moss, leaves and flowers on top
  const N = nature();
  for (let k = 0; k < 9; k++) { const a = rand(.15, Math.PI - .15); N.ball.push([Math.cos(a) * 2, 3.2 + Math.sin(a) * 2 + .3, rand(-.2, .3), rand(.28, .5), rand(.22, .4), rand(.3, .45), 0, pick([0x5fc848, 0x4fb840, 0x78d85a])]); }
  for (const x of [-2, 2]) N.ball.push([x, 3.35, .2, .4, .3, .45, 0, 0x5fc848]);
  for (let k = 0; k < 7; k++) { const a = rand(.2, Math.PI - .2); N.bloom.push([Math.cos(a) * 2.05, 3.2 + Math.sin(a) * 2.05 + .5, .35, .09, .07, .09, 0, pick([0xff6aa0, 0xffd23a, 0xffffff])]); }
  // vines hanging down the front
  for (const [x, top, len] of [[-2.3, 3.0, 1.6], [-1.75, 4.3, 1.4], [-.9, 5.0, 1.0], [.6, 5.1, .8], [1.4, 4.6, 1.5], [2.25, 3.0, 1.9]]) {
    N.stem.push([x, top - len / 2, .48, .03, len, .03, 0, 0x3f9a2f]);
    for (let y = top - .15; y > top - len; y -= .22) N.leaf.push([x + rand(-.08, .08), y, .52, .1, .05, .07, R() * TAU, pick([0x4fb840, 0x6ad855]), rand(-1, 1), rand(-1, 1)]);
  }
  for (const [x, z] of [[-2.8, .9], [2.7, 1], [-3.3, .3], [3.2, .4]]) flowers(N, x, 0, z, 3);
  flushNature(N, gate, trash);
  // the swirl, in the shape of the opening
  const sh = new THREE.Shape(); sh.moveTo(-1.58, 0); sh.lineTo(1.58, 0); sh.lineTo(1.58, 3.2); sh.absarc(0, 3.2, 1.58, 0, Math.PI, false); sh.lineTo(-1.58, 0);
  const pg = new THREE.ShapeGeometry(sh, 24), uv = pg.attributes.uv, pp = pg.attributes.position; trash.push(pg);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 1.58) / 3.16, pp.getY(i) / 4.8);
  const pm = new THREE.ShaderMaterial({ uniforms: { uTime: U.time, uOpen: { value: 0 } }, vertexShader: PORTAL_VS, fragmentShader: PORTAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }); trash.push(pm);
  const swirl = new THREE.Mesh(pg, pm); swirl.position.z = 0; gate.add(swirl);
  // the curtain of vines (pivot at the top so it can roll up)
  const curtain = new THREE.Group(); curtain.position.y = 4.7; gate.add(curtain);
  const CN = nature();
  for (let i = 0; i < 9; i++) {
    const x = -1.4 + i * .35, len = 4.6 - Math.abs(x) * .55;
    CN.stem.push([x, -len / 2, .1, .035, len, .035, 0, 0x3f8f2f]);
    for (let y = -.2; y > -len; y -= .2) CN.leaf.push([x + rand(-.09, .09), y, .14 + rand(0, .06), .12, .06, .09, R() * TAU, pick([0x4fb840, 0x6ad855, 0x3f9a35]), rand(-1, 1), rand(-1, 1)]);
  }
  flushNature(CN, curtain, trash);
  // lanterns on posts either side
  for (const x of [-3.1, 3.1]) {
    part(gate, CYL, S(0x6e4a2a), .07, 2.2, .07, x, 1.1, .3);
    part(gate, RBOX, S(0x3a3d46), .42, .08, .42, x, 2.4, .3);
    part(gate, SPH, S(0xffe0a0, { emissive: 0xffa040, emissiveIntensity: 2.2 }), .17, .2, .17, x, 2.22, .3, 0, 0, 0, false);
  }
  return { gate, curtain, swirl };
}
function setPortal(k) { // 0 = shut (vines down, dim), 1 = open
  env.curtain.scale.y = Math.max(.001, 1 - k); env.curtain.visible = k < 1;
  env.swirl.material.uniforms.uOpen.value = k; env.pl.intensity = .6 + k * 7;
}

// a cartoon cottage: cream walls with wooden beams, a red roof, a round lit window, a door, flowers and a smoking chimney
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
function makeHouse(I) {
  const g = new THREE.Group(), sand = I.ground === 'sand', snow = I.ground === 'snow';
  const wall = S(sand ? 0xf2d8a8 : snow ? 0xeef3fa : 0xfaeccc), beam = S(0x8a5a34), roof = S(sand ? 0xe8964a : 0xe0503a);
  part(g, RBOX, S(0xb8b0a4), 3.3, .35, 2.6, 0, .17, 0);
  part(g, RBOX, wall, 3, 1.9, 2.3, 0, 1.25, 0);
  for (const x of [-1.45, 1.45]) for (const z of [-1.1, 1.1]) part(g, RBOX, beam, .18, 1.95, .18, x, 1.25, z);
  part(g, RBOX, beam, 3.05, .16, 2.36, 0, 2.15, 0);
  part(g, ROOF, roof, 3.7, 1.25, 1.75, 0, 2.75, 0);
  if (snow) part(g, ROOF, S(0xffffff), 3.75, .5, .9, 0, 3.32, 0);
  part(g, RBOX, S(0x9a9088), .5, 1.2, .5, 1.0, 3.2, -.4);
  part(g, RBOX, S(0x8a5a34), .75, 1.25, .12, -.6, .95, 1.17); part(g, SPH, S(0xffcc33), .06, .06, .06, -.36, .95, 1.25);
  const win = part(g, CYL, S(0xffe7a0, { emissive: 0xffb040, emissiveIntensity: 1.4 }), .34, .08, .34, .7, 1.35, 1.16, Math.PI / 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.36, .06, 8, 24), beam); ring.position.set(.7, 1.35, 1.2); g.add(ring);
  part(g, RBOX, beam, .9, .18, .3, .7, .92, 1.28);
  const N = nature(); for (const [x, z] of [[.5, 1.3], [.9, 1.3]]) N.bloom.push([x, 1.08, z, .1, .08, .1, 0, pick([0xff4a5a, 0xffd23a, 0xff8ad0])]);
  flowers(N, -1.6, 0, 1.6, 3); flowers(N, 1.7, 0, 1.6, 3); flushNature(N, g);
  g.chimney = new THREE.Object3D(); g.chimney.position.set(1.0, 3.9, -.4); g.add(g.chimney);
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
// sheep, pigs and chickens: soft round animals that wander, stop to nibble and look around
function mAnimal(kind) {
  const g = new THREE.Group(), legs = [];
  const leg = (x, z, h, r, m) => { const v = new THREE.Group(); v.position.set(x, h, z); g.add(v); part(v, CYL, m, r, h, r, 0, -h / 2, 0); legs.push(v); };
  let head;
  if (kind === 'sheep') {
    const wool = S(0xffffff);
    for (const [x, y, z, r] of [[0, .62, 0, .36], [.18, .7, .2, .26], [-.18, .7, .2, .26], [.16, .7, -.22, .26], [-.16, .7, -.22, .26], [0, .86, 0, .26]]) part(g, BUSH, wool, r, r * .9, r, x, y, z);
    head = new THREE.Group(); head.position.set(0, .74, .42); g.add(head);
    part(head, SPH, S(0x3a3030), .17, .2, .2, 0, 0, .08); part(head, BUSH, wool, .14, .1, .12, 0, .16, .02);
    eyes(head, 0, .03, .22, .045, .07);
    for (const [x, z] of [[-.16, .2], [.16, .2], [-.16, -.2], [.16, -.2]]) leg(x, z, .42, .06, S(0x3a3030));
  } else if (kind === 'pig') {
    const pink = S(0xffb0c0);
    part(g, CapsuleGeo(), pink, .3, .7, .3, 0, .5, 0, Math.PI / 2);
    head = new THREE.Group(); head.position.set(0, .58, .42); g.add(head);
    part(head, SPH, pink, .25, .23, .22, 0, 0, .05); part(head, CYL, S(0xff8ea4), .1, .08, .1, 0, -.03, .26, Math.PI / 2);
    for (const x of [-1, 1]) part(head, CONE, pink, .07, .12, .05, x * .13, .2, 0, 0, 0, -x * .4);
    eyes(head, 0, .08, .2, .05, .08);
    for (const [x, z] of [[-.14, .22], [.14, .22], [-.14, -.22], [.14, -.22]]) leg(x, z, .3, .07, S(0xff9ab0));
  } else {
    part(g, SPH, S(0xffffff), .22, .21, .26, 0, .38, 0);
    for (const k of [-1, 1]) part(g, SPH, S(0xf2f2f2), .06, .14, .18, k * .2, .4, -.02);
    part(g, SPH, S(0xffffff), .1, .14, .08, 0, .5, -.24, -.4);
    head = new THREE.Group(); head.position.set(0, .62, .18); g.add(head);
    part(head, SPH, S(0xffffff), .13, .15, .13, 0, 0, 0); part(head, CONE, S(0xffb020), .05, .12, .05, 0, -.02, .15, Math.PI / 2);
    part(head, SPH, S(0xe82828), .04, .06, .03, 0, -.1, .12); part(head, SPH, S(0xe82828), .05, .06, .1, 0, .15, 0);
    eyes(head, 0, .04, .1, .035, .06);
    for (const x of [-.07, .07]) leg(x, 0, .22, .025, S(0xffb020));
  }
  g.scale.setScalar(.95); rimModel(g);
  return { g, legs, head, kind, sp: kind === 'chicken' ? 1.3 : .8 };
}
function animAnimals(dt) {
  for (const a of env.animals) {
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    if (a.wait > 0) { a.wait -= dt; a.head.rotation.x = Math.sin(T * 3 + a.x) > .4 ? .5 : 0; if (a.wait <= 0) { const s = pick(env.spots); if (Math.hypot(s[0] - a.x, s[1] - a.z) < 6) { a.tx = s[0]; a.tz = s[1]; } } }
    else if (d < .1) { a.wait = rand(1.5, 4); }
    else { a.x += dx / d * a.sp * dt; a.z += dz / d * a.sp * dt; a.face = turn(a.face, Math.atan2(dx, dz), dt * 6); a.head.rotation.x = 0; }
    const mv = a.wait > 0 ? 0 : 1, w = Math.sin(T * 10 + a.x) * .7 * mv;
    a.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? w : -w) * (a.kind === 'chicken' ? 1 : (i < 2 ? 1 : -1)); });
    a.g.position.set(a.x, env.H(a.x, a.z) + mv * Math.abs(Math.sin(T * 10 + a.x)) * .04, a.z); a.g.rotation.y = a.face;
  }
}

// the land: one smooth, gently rolling ground with a lake, steep rocky cliffs behind the portal and a waterfall
function buildEnv(I) {
  if (env) { scene.remove(env.g); env.dispose(); }
  const g = new THREE.Group(), trash = [];
  const sky = tex(2, 64, (x) => { const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, I.skyTop); gr.addColorStop(1, '#' + new THREE.Color(I.sky).getHexString()); x.fillStyle = gr; x.fillRect(0, 0, 2, 64); }); trash.push(sky);
  scene.background = sky; scene.fog = new THREE.Fog(I.sky, 32, 80);
  hemi.color.set(I.hemi[0]); hemi.groundColor.set(I.hemi[1]); sun.color.set(I.sunCol);
  // the room floor
  const floorTex = paintFloor(I); trash.push(floorTex);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 15.2), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = .01; floor.receiveShadow = true; g.add(floor); trash.push(floor.geometry, floor.material);
  // the land around it
  const seed = R() * 10, CZ = -12.5, side = R() < .5 ? -1 : 1, hx = side * 6.8, hz = -10.9, wfx = -side * (5.5 + R() * 1.5);
  const H = (x, z) => {
    const dist = Math.max(Math.abs(x) - 5.4, z - 8.4, -8.4 - z, 0);
    if (!dist) return 0;
    let h = (hnoise(x * .5, z * .5, seed) * .8 + .5) * sstep(.5, 5, dist);
    if (z > 7.5) h *= .25;                                                    // low in front, so nothing hides the hero
    h *= 1 - sstep(3.4, 1.8, Math.hypot(x - hx, z - hz));                    // flat for the cottage
    if (z < CZ) h += clamp((CZ - z) * 1.5, 0, 6) + hnoise(x, z, seed + 2) * .5; // cliffs
    if (Math.abs(x - wfx) < 1.4 && z < CZ) h -= sstep(1.4, 0, Math.abs(x - wfx)) * 1.2; // the stream's notch
    const lake = hnoise(x * .3, z * .3, seed + 5);
    if (lake < -.7 && dist > 2.5 && z > CZ + 1 && z < 7) h -= (-.7 - lake) * 3;
    if (Math.abs(x - wfx) < 2 && z > CZ - .5 && z < CZ + 2) h = Math.min(h, -.55); // the pool below the waterfall
    return h;
  };
  const GW = 64, GD = 70, gg = new THREE.PlaneGeometry(GW, GD, 88, 96).rotateX(-Math.PI / 2); gg.translate(0, 0, -8);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, H(gp.getX(i), gp.getZ(i)) - .02);
  gg.computeVertexNormals();
  const gn = gg.attributes.normal, gc = [], C = new THREE.Color(), CA = new THREE.Color(I.land[0]), CB = new THREE.Color(I.land[1]), CR = new THREE.Color(I.land[2]), CS = new THREE.Color(I.land[3]);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), y = gp.getY(i), steep = 1 - gn.getY(i);
    C.copy(CA).lerp(CB, clamp(hnoise(x * .35, z * .35, seed + 3) * .5 + .5, 0, 1));
    if (y < -.15) C.lerp(CS, clamp((-.15 - y) * 3, 0, 1));
    C.lerp(CR.clone().lerp(new THREE.Color(I.cliff2), Math.sin(y * 2.4) * .5 + .5), sstep(.18, .4, steep)); // cliffs in warm bands
    gc.push(C.r, C.g, C.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; g.add(ground); trash.push(gg, ground.material);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD).rotateX(-Math.PI / 2), waterMat(14)); water.position.set(0, -.3, -8); g.add(water); trash.push(water.geometry, water.material, water.material.map);
  // trees, flowers, rocks and grass
  const N = nature(), trees = [], spots = [];
  for (let k = 0; k < 900; k++) {
    const x = rand(-22, 22), z = rand(-30, 14), h = H(x, z);
    const dist = Math.max(Math.abs(x) - 5.4, z - 8.4, -8.4 - z, 0);
    if (dist < .8 || h < -.15 || Math.hypot(x - hx, z - hz) < 3.2 || (Math.abs(x) < 3 && z < -8 && z > CZ - 1) || (Math.abs(x - wfx) < 2.2 && z < CZ + 2)) continue;
    const r = R();
    if (z < 7.5 && r < .06 && !trees.some(([a, b]) => Math.hypot(a - x, b - z) < 3.2)) { trees.push([x, z]); tree(N, I.tree, x, h, z, rand(.85, 1.25)); }
    else if (r < .32) decoAt(N, I, x, h, z);
    if (I.ground !== 'snow' && dist < 9 && R() < .9) for (let t = 0; t < 4; t++) { const tx = x + rand(-.6, .6), tz = z + rand(-.6, .6), th = H(tx, tz); if (th > -.1) N.tuft.push([tx, th, tz, .4, rand(.3, .5), .4, R() * TAU, I.ground === 'sand' ? 0xd8c070 : 0xffffff]); }
    if (dist >= 1 && dist <= 4 && h > -.1 && h < .6) spots.push([x, z]);
  }
  flushNature(N, g, trash);
  // the border: an uneven hedge of round bushes (rocks on Sunsand, snowy bushes on Frostpeak)
  const B = [], bc = () => new THREE.Color(pick(I.hedge)).multiplyScalar(rand(.9, 1.08)).getHex();
  const bush = (x, z, r, up) => { B.push([x, r * .62 + (up || 0), z, r, r * rand(.8, 1), r, R() * TAU, bc()]); };
  for (let z = -8.2; z <= 8.2; z += .55) for (const sx of [-1, 1]) {
    const r = rand(.48, .78), x = sx * (5.05 + rand(0, .25)); bush(x, z, r);
    if (R() < .45) bush(x + sx * rand(.1, .3), z + rand(-.2, .2), r * rand(.6, .8), r * .9);
    if (R() < .3) bush(x + sx * (r + rand(.2, .5)), z, rand(.4, .7));
  }
  for (let x = -5.2; x <= 5.2; x += .55) { if (Math.abs(x) < 2.6) continue; const r = rand(.6, .9); bush(x, -8.25 - rand(0, .2), r); if (R() < .6) bush(x + rand(-.2, .2), -8.4, r * .7, r * .95); }
  for (let x = -5; x <= 5; x += .6) if (R() < .7) bush(x, 8.45 + rand(0, .15), rand(.2, .3));
  if (I.ground === 'sand') inst(ROCK, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), B, g, trash);
  else inst(BUSH, windy(WHITE(), .015, .9), B, g, trash);
  // flowers at the foot of the border, inside
  const FN = nature();
  for (let k = 0; k < 16; k++) { const s = R() < .5 ? -1 : 1, z = rand(-7, 7); if (I.ground !== 'snow') flowers(FN, s * 4.35, 0, z, 2); }
  flushNature(FN, g, trash);
  // the portal, the cottage, the waterfall
  const portal = makePortal(I, trash); g.add(portal.gate);
  const house = makeHouse(I); house.position.set(hx, 0, hz); house.rotation.y = -side * .5; g.add(house);
  const fallTop = H(wfx, CZ - 4) + .3, fallT = tex(64, 256, (x) => { const gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#8fd6ff'); gr.addColorStop(.5, '#e8f8ff'); gr.addColorStop(1, '#8fd6ff'); x.fillStyle = gr; x.fillRect(0, 0, 64, 256); for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(255,255,255,${rand(.3, .8)})`; x.fillRect(rand(0, 64), rand(0, 256), rand(2, 5), rand(20, 60)); } }, [1, 2]);
  fallT.magFilter = THREE.LinearFilter; trash.push(fallT);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.2, fallTop + .6), new THREE.MeshLambertMaterial({ map: fallT, emissive: 0x2a6aa0, transparent: true, opacity: .92 }));
  fall.position.set(wfx, (fallTop + .6) / 2 - .6, CZ - .1); fall.rotation.x = -.12; g.add(fall); trash.push(fall.geometry, fall.material);
  // light from the portal and the lanterns
  const pl = new THREE.PointLight(0xb46cff, 0, 9, 1.6); pl.position.set(0, 1.6, -7.2); g.add(pl);
  const lan = [-3.1, 3.1].map((x) => { const l = new THREE.PointLight(0xffa040, 2.2, 6, 1.6); l.position.set(x, 2.2, -7.5); g.add(l); return l; });
  // floating bits
  const NP = 70, pos = new Float32Array(NP * 3), vel = [];
  for (let i = 0; i < NP; i++) { pos.set([rand(-6, 6), rand(.2, 4), rand(-9, 9)], i * 3); vel.push([rand(-.3, .3), I.ground === 'snow' ? rand(-.9, -.4) : rand(.05, .3), rand(-.2, .2)]); }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pmat = new THREE.PointsMaterial({ map: DOT, color: new THREE.Color(I.motes).multiplyScalar(2.2), size: I.ground === 'snow' ? .22 : .14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(pgeo, pmat); g.add(motes); trash.push(pgeo, pmat);
  // animals
  const animals = [];
  for (let k = 0; k < 6 && spots.length; k++) {
    const [x, z] = pick(spots), kind = pick(I.ground === 'snow' ? ['sheep', 'sheep', 'chicken'] : I.ground === 'sand' ? ['chicken', 'pig', 'chicken'] : ['sheep', 'pig', 'chicken']);
    const a = mAnimal(kind); a.g.position.set(x, H(x, z), z); g.add(a.g); animals.push({ ...a, x, z, tx: x, tz: z, face: R() * TAU, wait: rand(0, 3) });
  }
  scene.add(g);
  env = { g, ...portal, I, H, pl, lan, motes, vel, water, fall, wfx, CZ, chimney: house.chimney, animals, spots, dispose: () => trash.forEach((t) => t.dispose && t.dispose()) };
  bulletMat.color.set(I.bullet); bulletMat.emissive.set(I.bullet);
}
const DOT = tex(32, 32, (x) => { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); });
function animEnv(dt) {
  const a = env.motes.geometry.attributes.position, snow = env.I.ground === 'snow';
  for (let i = 0; i < a.count; i++) {
    const v = env.vel[i]; let x = a.getX(i) + (v[0] + Math.sin(T * .8 + i) * .25) * dt, y = a.getY(i) + v[1] * dt, z = a.getZ(i) + v[2] * dt;
    if (y > 4.5 || y < 0) { y = snow ? 4.5 : .2; x = rand(-6, 6); z = rand(-9, 9); }
    a.setXYZ(i, x, y, z);
  }
  a.needsUpdate = true;
  env.lan.forEach((l, i) => { l.intensity = 2 + Math.sin(T * 9 + i * 2) * .25 + Math.sin(T * 23 + i) * .15; });
  env.water.material.map.offset.set(T * .02, T * .012);
  env.fall.material.map.offset.y = T * 1.4;
  if (R() < dt * 10 && parts.length < 200) { const m = new THREE.Mesh(SPH, S(0xffffff, { emissive: 0x9fc8ff, transparent: true, opacity: .85 })); const sz = rand(.08, .18); m.scale.setScalar(sz); m.position.set(env.wfx + rand(-1, 1), -.2, env.CZ + .6 + rand(0, .6)); scene.add(m); parts.push({ m, s: sz, vx: rand(-.6, .6), vy: rand(1, 2.2), vz: rand(0, .8), t: rand(.4, .7) }); }
  if (R() < dt * 4 && parts.length < 200) { const c = env.chimney, w = new THREE.Vector3(); c.getWorldPosition(w); const m = new THREE.Mesh(SPH, S(0xf0f0f0, { transparent: true, opacity: .7 })); const sz = rand(.16, .26); m.scale.setScalar(sz); m.position.set(w.x, w.y, w.z); scene.add(m); parts.push({ m, s: sz, vx: rand(.1, .4), vy: rand(.6, 1), vz: rand(-.1, .1), t: rand(1.4, 2.2), float: true, grow: true }); }
  animAnimals(dt);
}

// the room's things: obstacles stay mirrored (the middle column is always free); water is one or two little ponds by a side wall
function layout(boss) {
  const grid = Array.from({ length: 9 }, () => new Uint8Array(15));
  if (boss) return grid;
  const put = (ix, iz, v) => { if (iz < 2 || iz > 10 || ix < 0 || ix > 3) return; grid[ix][iz] = v; grid[8 - ix][iz] = v; };
  const t = pick(['pillars', 'scatter', 'rows', 'scatter']);
  if (t === 'pillars') { for (const [ix, iz] of [[1, 3], [1, 8], [3, 5], [3, 10]]) put(ix, iz, 1); }
  else if (t === 'rows') { const iz = pick([4, 5, 6]); for (let ix = 0; ix < 3; ix++) put(ix, iz, 1); put(2, iz + 4, 1); }
  else { const n = 3 + (R() * 3 | 0); for (let k = 0; k < n; k++) put(R() * 4 | 0, 2 + (R() * 9 | 0), 1); }
  const SHAPES = [[[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [0, 1]]];
  const ponds = R() < .8 ? 1 + (R() < .45 ? 1 : 0) : 0;
  for (let k = 0; k < ponds; k++) {
    const left = R() < .5, iz0 = 2 + (R() * 8 | 0);
    for (const [dx, dz] of pick(SHAPES)) { const ix = left ? dx : 8 - dx, iz = iz0 + dz; if (iz <= 10 && !grid[ix][iz]) grid[ix][iz] = 2; }
  }
  return grid;
}
// obstacles in the cartoon style
function obstacle(kind, tall) {
  const g = new THREE.Group(), s = tall ? 1.35 : 1;
  if (kind === 'rock' || kind === 'sandrock' || kind === 'snowrock') {
    const col = kind === 'sandrock' ? 0xe2b97a : kind === 'snowrock' ? 0xa8b4c8 : 0xa8a49c, rm = S(col, { flatShading: true });
    part(g, ROCK, rm, .5, .42 * s, .48, 0, .38 * s, 0, 0, R() * 3); part(g, ROCK, rm, .32, .3, .3, .28, .22, .22, 0, R() * 3);
    if (kind === 'rock') part(g, BUSH, S(0x5fc848), .36, .12, .32, 0, .74 * s, 0);
    if (kind === 'snowrock') part(g, BUSH, S(0xffffff), .42, .14, .4, 0, .76 * s, 0);
  } else if (kind === 'stump' || kind === 'snowstump') {
    part(g, CYL, S(0x8a5a34), .4, .62 * s, .4, 0, .31 * s, 0); part(g, CYL, S(0xf0c890), .36, .04, .36, 0, .63 * s, 0, 0, 0, 0, false);
    const ringM = S(0xc89a60); for (const r of [.12, .24]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .015, 6, 24), ringM); t.rotation.x = -Math.PI / 2; t.position.y = .655 * s; g.add(t); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; part(g, CYL, S(0x7a4e2c), .09, .4, .09, Math.cos(a) * .38, .08, Math.sin(a) * .38, 0, 0, 0).rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); }
    if (kind === 'snowstump') part(g, BUSH, S(0xffffff), .38, .1, .38, 0, .66 * s, 0);
  } else if (kind === 'crate' || kind === 'pot') {
    if (kind === 'crate') { part(g, RBOX, S(0xd09050), .82, .82 * s, .82, 0, .41 * s, 0); for (const y of [.18, .64]) part(g, RBOX, S(0x9a6432), .86, .1, .86, 0, y * s, 0); part(g, RBOX, S(0x9a6432), .1, .82 * s, .86, 0, .41 * s, 0); }
    else { const pg = new THREE.LatheGeometry([[.0, 0], [.3, 0], [.42, .2], [.44, .45], [.32, .7], [.22, .78], [.26, .86], [0, .86]].map(([a, b]) => new THREE.Vector2(a, b * s)), 20); const m = new THREE.Mesh(pg, S(0xd0784a)); m.castShadow = true; g.add(m); part(g, CYL, S(0xf0c890), .43, .08, .43, 0, .42 * s, 0); }
  } else if (kind === 'cactusBlock') {
    const c = S(0x4fb04a); part(g, CapsuleGeo(), c, .3, .9 * s, .3, 0, .6 * s, 0);
    part(g, CapsuleGeo(), c, .13, .4, .13, -.3, .65, 0, 0, 0, .9); part(g, CapsuleGeo(), c, .13, .32, .13, .3, .5, 0, 0, 0, -.9);
    part(g, SPH, S(0xff6aa0), .1, .07, .1, 0, 1.12 * s, 0);
  } else { // crystal
    const cm = new THREE.MeshLambertMaterial({ color: 0xa8e4ff, emissive: 0x2a6a8a, transparent: true, opacity: .88 });
    for (const [x, z, h, rz] of [[0, 0, 1.1, 0], [.25, .12, .7, -.35], [-.24, -.1, .8, .3], [.05, -.25, .55, .15]]) part(g, OCT, cm, .2, h * s / 2, .2, x, h * s / 2, z, 0, R(), rz);
  }
  return g;
}
const OBST = { grass: ['rock', 'stump', 'crate'], sand: ['sandrock', 'pot', 'cactusBlock'], snow: ['crystal', 'snowrock', 'snowstump'] };
function buildRoom() {
  if (room) { clearPlates(); scene.remove(room.g); if (room.chest) scene.remove(room.chest); room.trash.forEach((t) => t.dispose && t.dispose()); }
  const I = ISLES[run.isle], boss = run.room === 10 || run.room === 5;
  const grid = layout(boss), g = new THREE.Group(), trash = [], kinds = OBST[I.ground], water = [];
  for (let ix = 0; ix < 9; ix++) for (let iz = 0; iz < 15; iz++) {
    const x = ix - 4, z = iz - 7;
    if (grid[ix][iz] === 1) { const o = obstacle(kinds[(ix * 7 + iz * 3 + run.room) % kinds.length], (ix + iz + run.room) % 4 === 0); o.position.set(x, 0, z); o.rotation.y = (ix * 1.7 + iz) % TAU; g.add(o); }
    else if (grid[ix][iz] === 2) water.push([x, z]);
  }
  if (water.length) {
    // ponds: soft round water with a light shore, lily pads and reeds
    const shore = [], pool = [], N = nature(), wm = waterMat(1); trash.push(wm, wm.map);
    for (const [x, z] of water) { shore.push([x, .02, z, .86, 1, .86, 0, I.ground === 'snow' ? 0xffffff : I.ground === 'sand' ? 0xf4dca0 : 0xbfe88a]); pool.push([x, .035, z, .72, 1, .72]); }
    const disc = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2); trash.push(disc);
    inst(disc, WHITE(), shore, g, trash, false); inst(disc, wm, pool, g, trash, false);
    for (const [x, z] of water) {
      if (R() < .5) N.leaf.push([x + rand(-.3, .3), .05, z + rand(-.3, .3), .2, .015, .2, R() * TAU, 0x5fc848]);
      if (R() < .25) N.bloom.push([x + rand(-.2, .2), .08, z + rand(-.2, .2), .07, .05, .07, 0, 0xff9ccb]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ix = x + dx + 4, iz = z + dz + 7;
        if (ix >= 0 && ix <= 8 && iz >= 0 && iz <= 14 && !grid[ix][iz] && R() < .35) { const rx = x + dx * .7, rz = z + dz * .7; N.stem.push([rx, .25, rz, .025, .5, .025, 0, 0x4f9a2f]); N.cap.push([rx, .52, rz, .04, .1, .04, 0, 0x8a5a34]); }
      }
    }
    flushNature(N, g, trash);
  }
  if (I.ground !== 'snow') {
    const tufts = [];
    grassField(tufts, -4.5, 4.5, -7.5, 7.5, 0, I.ground === 'grass' ? 7 : 1.5, (x, z) => { const ix = Math.round(x + 4), iz = Math.round(z + 7); return ix < 0 || ix > 8 || iz < 0 || iz > 14 || grid[ix][iz] || (Math.abs(x) < 1.6 && z > 4.5); }, I.ground === 'sand' ? 0xd8c070 : null);
    inst(TUFT, bladeMat(), tufts, g, trash, false);
  }
  scene.add(g);
  room = { g, grid, trash, open: false, cleared: false, openT: 0 };
  setPortal(0);
}

/* ---------- arrows, bullets, gems, bits ---------- */
const ARROW_GEO = mergeColored([[new THREE.CylinderGeometry(.025, .025, .62, 8), '#a8743c', MX(0, 0, 0, 1, 1, 1, Math.PI / 2)], [new THREE.ConeGeometry(.06, .16, 10), '#e8eef6', MX(0, 0, .38, 1, 1, 1, Math.PI / 2)], [new THREE.BoxGeometry(.16, .015, .14), '#ff4a5a', MX(0, 0, -.25)], [new THREE.BoxGeometry(.015, .16, .14), '#ff4a5a', MX(0, 0, -.25)]]);
const arrowPool = [];
const TRAIL_M = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.1), transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false });
function spawnArrow(x, z, a) {
  const m = arrowPool.pop() || (() => { const a = new THREE.Mesh(ARROW_GEO, VCS); const tr = new THREE.Mesh(BOX, TRAIL_M); tr.scale.set(.05, .05, 1.1); tr.position.z = -.75; a.add(tr); return a; })();
  m.position.set(x, .75, z); m.rotation.y = a; m.scale.setScalar(1.25); scene.add(m);
  arrows.push({ m, x, z, vx: Math.sin(a) * 16, vz: Math.cos(a) * 16, life: 1.4, b: P.bounce, p: P.pierce, hit: new Set() });
}
function shoot(t) {
  const a = Math.atan2(t.x - P.x, t.z - P.z); P.face = a; P.shootAnim = .2; sfx.shoot();
  spark(P.x + Math.sin(a) * .45, .8, P.z + Math.cos(a) * .45, 0xfff0b0, .5);
  const dirs = [], n = P.front;
  for (let i = 0; i < n; i++) dirs.push([a, (i - (n - 1) / 2) * .3]);
  for (let i = 1; i <= P.diag; i++) dirs.push([a + .45 * i, 0], [a - .45 * i, 0]);
  if (P.side) dirs.push([a + Math.PI / 2, 0], [a - Math.PI / 2, 0]);
  for (let i = 0; i < P.back; i++) dirs.push([a + Math.PI + (i - (P.back - 1) / 2) * .3, 0]);
  for (const [ang, off] of dirs) spawnArrow(P.x + Math.sin(ang) * .3 + Math.cos(ang) * off, P.z + Math.cos(ang) * .3 - Math.sin(ang) * off, ang);
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const A = arrows[i]; A.life -= dt;
    let nx = A.x + A.vx * dt, nz = A.z + A.vz * dt, dead = A.life <= 0, bounced = false;
    if (nx < -4.45 || nx > 4.45) { if (A.b-- > 0) { A.vx = -A.vx; nx = A.x; bounced = true; } else dead = true; }
    if (nz < -7.45 || nz > 7.45) { if (A.b-- > 0) { A.vz = -A.vz; nz = A.z; bounced = true; } else dead = true; }
    if (!dead && cellAt(nx, nz) === 1) {
      if (A.b-- > 0) { if (cellAt(nx, A.z) === 1) A.vx = -A.vx; else A.vz = -A.vz; nx = A.x; nz = A.z; bounced = true; } else dead = true;
    }
    if (bounced) { A.hit.clear(); A.m.rotation.y = Math.atan2(A.vx, A.vz); }
    if (!dead) for (const e of enemies) {
      if (e.spawnT > 0 || e.dead || A.hit.has(e)) continue;
      const dx = e.x - nx, dz = e.z - nz;
      if (dx * dx + dz * dz < (e.r + .15) ** 2 && e.y < 1.6) {
        A.hit.add(e); const sp = Math.hypot(A.vx, A.vz) || 1; e.kx = A.vx / sp; e.kz = A.vz / sp;
        spark(nx, .8, nz, 0xffffff, .9); hurtEnemy(e, P.dmg); if (A.p-- > 0) continue; dead = true; break; }
    }
    if (dead) { if (A.life > 0) burst(nx, .75, nz, 0xb08050, 3, 2); scene.remove(A.m); arrowPool.push(A.m); arrows.splice(i, 1); continue; }
    A.x = nx; A.z = nz; A.m.position.set(nx, .75, nz);
  }
}
const bulletMat = new THREE.MeshLambertMaterial({ color: 0xff4a3a, emissive: 0xff4a3a, emissiveIntensity: 2.4 });
const bulletPool = [];
function bullet(e, a, speed, big) {
  const m = bulletPool.pop() || new THREE.Mesh(SPH, bulletMat);
  const s = big ? .3 : .16; m.scale.setScalar(s);
  const x = e.x + Math.sin(a) * e.r * .7, z = e.z + Math.cos(a) * e.r * .7;
  m.position.set(x, .6, z); scene.add(m);
  bullets.push({ m, x, z, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, r: s * 1.05, dmg: e.dmg * (big ? 1.1 : .8), life: 6 });
}
const fan = (e, a, n, spread, speed, big) => { for (let i = 0; i < n; i++) bullet(e, a + (i - (n - 1) / 2) * spread, speed, big); };
const ring = (e, n, speed, off = 0) => { for (let i = 0; i < n; i++) bullet(e, off + i / n * TAU, speed); };
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    let dead = b.life <= 0 || Math.abs(b.x) > 4.6 || Math.abs(b.z) > 7.6 || cellAt(b.x, b.z) === 1;
    if (!dead && !P.dead && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < (b.r + .28) ** 2) { hurtPlayer(b.dmg); dead = true; }
    if (dead) { burst(b.x, .6, b.z, bulletMat.color.getHex(), 3, 2); scene.remove(b.m); bulletPool.push(b.m); bullets.splice(i, 1); continue; }
    b.m.position.set(b.x, .6, b.z); b.m.rotation.set(T * 6, T * 8, 0);
  }
}
const GEM_M = new THREE.MeshLambertMaterial({ color: 0x3dff7a, emissive: 0x3dff7a, emissiveIntensity: 1.8 });
function dropGems(e) {
  const n = Math.min(e.def.xp, e.def.boss ? 14 : e.def.big ? 8 : 4), v = e.def.xp / n;
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(OCT, GEM_M); m.scale.set(.12, .17, .12); scene.add(m);
    gems.push({ m, x: e.x, z: e.z, y: .5, vx: rand(-2.6, 2.6), vz: rand(-2.6, 2.6), vy: rand(3, 5), v, fly: false });
  }
}
function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i], dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz);
    if (!g.fly && (room.cleared || d < 1.7) && g.vy === 0 && !P.dead) g.fly = true;
    if (g.fly) {
      const sp = Math.min(18, 6 + (g.flyT = (g.flyT || 0) + dt) * 20);
      g.x += dx / d * sp * dt; g.z += dz / d * sp * dt; g.y += (.9 - g.y) * dt * 6;
      if (d < .45) { addXp(g.v); sfx.gem(); scene.remove(g.m); gems.splice(i, 1); continue; }
    } else if (g.vy !== 0) {
      g.vy -= 16 * dt; g.y += g.vy * dt; const nx = clamp(g.x + g.vx * dt, -4.3, 4.3), nz = clamp(g.z + g.vz * dt, -7.3, 7.3); g.x = nx; g.z = nz;
      if (g.y < .2) { g.y = .2; if (Math.abs(g.vy) < 2) { g.vy = 0; g.vx = g.vz = 0; } else { g.vy *= -.4; g.vx *= .5; g.vz *= .5; } }
    }
    g.m.position.set(g.x, g.y + (g.vy === 0 && !g.fly ? Math.sin(T * 5 + i) * .06 : 0), g.z); g.m.rotation.y += dt * 3;
  }
}
function burst(x, y, z, col, n, spd = 4) {
  for (let i = 0; i < n && parts.length < 220; i++) {
    const m = new THREE.Mesh(ROCK, S(col, { emissive: col, emissiveIntensity: .35 })); const s = rand(.05, .11); m.scale.setScalar(s); m.position.set(x, y, z); scene.add(m);
    parts.push({ m, s, vx: rand(-1, 1) * spd, vy: rand(1.5, 5), vz: rand(-1, 1) * spd, t: rand(.45, .85) });
  }
}
function puff(x, z) {
  if (parts.length > 200) return;
  const col = env && env.I.ground === 'snow' ? 0xffffff : env && env.I.ground === 'sand' ? 0xf0d8a0 : 0xd8e8b0;
  const m = new THREE.Mesh(SPH, S(col, { transparent: true, opacity: .7 })); const sz = rand(.05, .09); m.scale.setScalar(sz); m.position.set(x + rand(-.15, .15), .06, z + rand(-.15, .15)); scene.add(m);
  parts.push({ m, s: sz, vx: rand(-.4, .4), vy: rand(.3, .8), vz: rand(-.4, .4), t: rand(.3, .5), float: true });
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], m = p.m; p.t -= dt; p.vy -= (p.float ? -.5 : 14) * dt;
    m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    if (p.grow) m.scale.setScalar(p.s * (1 + (2 - p.t) * .8));
    if (m.position.y < p.s / 2 && !p.float) { m.position.y = p.s / 2; p.vy *= -.35; p.vx *= .6; p.vz *= .6; }
    m.rotation.x += dt * 6; if (p.t < .2) m.scale.multiplyScalar(Math.max(.01, p.t / .2) ** .2);
    if (p.t <= 0) { scene.remove(m); parts.splice(i, 1); }
  }
}
// red warnings on the floor: a ring where a boss lands, a stripe where something dashes
const RING_GEO = new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2), LINE_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5);
const WARN_M = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: .45, depthWrite: false });
function marker(x, z, r) { const m = new THREE.Mesh(RING_GEO, WARN_M); m.scale.setScalar(r); m.position.set(x, .05, z); scene.add(m); temps.push(m); return m; }
function stripe(e, a, w) { const m = new THREE.Mesh(LINE_GEO, WARN_M); m.scale.set(w, 1, 9); m.position.set(e.x, .05, e.z); m.rotation.y = a; scene.add(m); temps.push(m); return m; }
function rmTemp(m) { scene.remove(m); const i = temps.indexOf(m); if (i >= 0) temps.splice(i, 1); }

/* ---------- enemies: spawning, brains, damage ---------- */
const BAR = new THREE.PlaneGeometry(1, 1), BARF = new THREE.PlaneGeometry(1, 1).translate(.5, 0, 0);
const BAR_BG = new THREE.MeshBasicMaterial({ color: 0x151515, depthTest: false }), BAR_FG = new THREE.MeshBasicMaterial({ color: 0xff4444, depthTest: false });
function makeBar(w) {
  const g = new THREE.Group(), bg = new THREE.Mesh(BAR, BAR_BG), fg = new THREE.Mesh(BARF, BAR_FG);
  bg.scale.set(w + .08, .17, 1); fg.scale.set(w, .1, 1); fg.position.set(-w / 2, 0, .001);
  bg.renderOrder = 10; fg.renderOrder = 11; g.add(bg, fg); g.fill = fg; g.w = w; return g;
}
const aim = (e) => Math.atan2(P.x - e.x, P.z - e.z);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
function freeSpot(minD = 4) {
  for (let k = 0; k < 60; k++) {
    const ix = R() * 9 | 0, iz = R() * 10 | 0;
    if (room.grid[ix][iz]) continue;
    const x = ix - 4, z = iz - 7;
    if ((x - P.x) ** 2 + (z - P.z) ** 2 < minD * minD) continue;
    if (enemies.some((e) => (e.x - x) ** 2 + (e.z - z) ** 2 < 1.2)) continue;
    return { x, z };
  }
  return { x: rand(-3, 3), z: rand(-6, -2) };
}
function spawnEnemy(type, x, z) {
  const def = E[type], I = ISLES[run.isle], mod = def.model(), s = def.scale || 1;
  const k = 1 + (run.room - 1) * .1;
  const e = { type, def, x, z, y: 0, m: mod, s, r: mod.r * s, h: mod.h * s, maxHp: Math.round(def.hp * I.hp * k), dmg: def.dmg * I.dmg * (1 + (run.room - 1) * .04),
    vx: 0, vz: 0, face: 0, spawnT: .6, wait: 0, mode: null, tele: 0, flash: 0, burn: 0, slow: 0, orbCd: 0, seed: R() * 10, roll: 0 };
  e.hp = e.maxHp; e.face = aim(e); e.brain = BRAIN[def.ai](e);
  mod.g.scale.setScalar(.01); mod.g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); rimModel(mod.g);
  scene.add(mod.g);
  if (!def.boss && !def.big) { e.bar = makeBar(clamp(e.r * 1.7, .7, 1.6)); scene.add(e.bar); }
  enemies.push(e); burst(x, .3, z, 0xffffff, 6, 2);
  return e;
}
const BRAIN = {
  *hopper(e) {
    yield rand(.3, .8);
    for (;;) {
      const a = aim(e), d = Math.min(Math.sqrt(dist2(e, P)), 3); e.face = a;
      e.vx = Math.sin(a) * d / .55; e.vz = Math.cos(a) * d / .55; e.hop = .55; e.hopT = 0;
      yield .55;
      e.vx = e.vz = 0; e.hop = 0;
      if (e.def.ring) { ring(e, e.def.ring, 4.2, R()); sfx.boom(); }
      yield rand(.5, .9);
    }
  },
  *chaser(e) { yield .3; for (;;) { e.mode = 'chase'; yield rand(2, 3.2); e.mode = null; e.vx = e.vz = 0; yield .45; } },
  *turret(e) {
    yield rand(.6, 1.6);
    for (;;) {
      if (e.def.wander) { e.mode = 'wander'; yield rand(.8, 1.4); e.mode = null; e.vx = e.vz = 0; }
      e.tele = .45; yield .45; volley(e); yield e.def.every;
    }
  },
  *dasher(e) {
    yield rand(.3, 1);
    for (;;) {
      e.mode = 'wander'; yield rand(1, 1.8); e.mode = null; e.vx = e.vz = 0;
      const a = aim(e); e.face = a; e.L = stripe(e, a, e.r * 1.6); e.tele = .6; yield .6; rmTemp(e.L); e.L = null;
      e.vx = Math.sin(a) * e.def.dash; e.vz = Math.cos(a) * e.def.dash; e.dashing = true; yield .45;
      e.vx = e.vz = 0; e.dashing = false; if (e.def.ring) { ring(e, e.def.ring, 4, R()); sfx.boom(); }
    }
  },
  *flyer(e) { yield rand(.3, 1); for (;;) { e.mode = 'wander'; yield e.def.every; e.mode = null; e.vx = e.vz = 0; e.tele = .35; yield .35; volley(e); } },
  *boss(e) {
    yield 1.2; let i = 0;
    for (;;) { yield* ACT[e.def.acts[i++ % e.def.acts.length]](e); e.mode = 'wander'; yield rand(.7, 1.2); e.mode = null; e.vx = e.vz = 0; }
  },
};
const ACT = {
  *jump(e) {
    const tx = clamp(P.x, -3.3, 3.3), tz = clamp(P.z, -6.3, 6.3), mk = marker(tx, tz, e.r + .5);
    e.tele = .7; yield .7;
    e.jump = { x0: e.x, z0: e.z, x1: tx, z1: tz, t: 0, d: .7 }; yield .7;
    e.jump = null; e.x = tx; e.z = tz; e.y = 0; rmTemp(mk); ring(e, 14, 4.4, R()); shake(.4); sfx.boom(); yield .3;
  },
  *spray(e) { for (let k = 0; k < 3; k++) { e.tele = .3; yield .35; fan(e, aim(e), 5, .2, 5.5); } },
  *summon(e) {
    const n = enemies.filter((x) => x.minion && !x.dead).length;
    for (let k = 0; k < Math.min(2, 4 - n); k++) { const s = spawnEnemy(e.def.minion, clamp(e.x + rand(-2.2, 2.2), -4, 4), clamp(e.z + rand(-.5, 2), -6.5, 5)); s.minion = true; }
    e.tele = .5; yield .8;
  },
  *boulders(e) { for (let k = 0; k < 3; k++) { e.tele = .35; yield .4; fan(e, aim(e), 3, .35, 4.2, true); } },
  *stomp(e) { for (let k = 0; k < 2; k++) { e.tele = .45; yield .5; ring(e, 16, 4, k * .2); shake(.3); sfx.boom(); } yield .2; },
  *charge(e) {
    for (let k = 0; k < 2; k++) {
      const a = aim(e); e.face = a; const L = stripe(e, a, e.r * 2); e.tele = .65; yield .65; rmTemp(L);
      e.vx = Math.sin(a) * 11; e.vz = Math.cos(a) * 11; e.dashing = true; yield .55;
      e.vx = e.vz = 0; e.dashing = false; ring(e, 8, 3.8, R()); shake(.25); yield .3;
    }
  },
  *spiral(e) { e.tele = .4; yield .4; for (let k = 0; k < 26; k++) { const a = k * .42; bullet(e, a, 4.4); bullet(e, a + Math.PI, 4.4); yield .09; } },
  *ring(e) { for (let k = 0; k < 3; k++) { e.tele = .3; yield .35; ring(e, 18, 4, k * .17); } },
};
function volley(e) {
  const s = e.def.shot;
  if (s.ring) ring(e, s.ring, s.speed, R() * .5); else fan(e, aim(e), s.n, s.spread || 0, s.speed);
  if (e.def.ring2) ring(e, e.def.ring2, 3.5, R());
}
function updateEnemy(e, dt) {
  const g = e.m.g;
  if (e.spawnT > 0) { e.spawnT -= dt; g.scale.setScalar(e.s * Math.max(.01, ease(clamp(1 - e.spawnT / .6, 0, 1)))); g.position.set(e.x, 0, e.z); g.rotation.y = e.face; placeBar(e); return; }
  let sp = 1;
  if (e.slow > 0) { e.slow -= dt; sp = .5; }
  if (e.orbCd > 0) e.orbCd -= dt;
  if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = .5; hurtEnemy(e, P.dmg * .15, '#ff9a3a', true); burst(e.x, e.h * .6, e.z, 0xff8a1e, 2, 1.5); if (e.dead) return; } }
  e.wait -= dt * sp;
  while (e.wait <= 0 && !e.dead) { const r = e.brain.next(); if (r.done) { e.wait = 99; break; } e.wait += r.value; }
  if (e.dead) return;
  if (e.tele > 0) e.tele -= dt;
  const spd = e.def.speed || 1;
  if (e.mode === 'chase') { const a = aim(e); e.vx = Math.sin(a) * spd; e.vz = Math.cos(a) * spd; e.face = a; }
  else if (e.mode === 'wander') {
    if (!e.wt || dist2(e, e.wt) < .3 || (e.stuck || 0) > .4) { e.wt = { x: rand(-3.8, 3.8), z: rand(-6.8, 4) }; e.stuck = 0; }
    const a = Math.atan2(e.wt.x - e.x, e.wt.z - e.z); e.vx = Math.sin(a) * spd * .7; e.vz = Math.cos(a) * spd * .7; e.face = a;
  }
  if (e.kb > 0 && !e.jump) { const k = Math.min(e.kb, dt * 2.2); e.kb -= k; moveBody(e, e.kx * k * 5, e.kz * k * 5, e.r * .8, e.def.fly); }
  if (e.jump) {
    const j = e.jump; j.t += dt; const k = Math.min(1, j.t / j.d);
    e.x = j.x0 + (j.x1 - j.x0) * k; e.z = j.z0 + (j.z1 - j.z0) * k; e.y = Math.sin(Math.PI * k) * 3.2;
  } else if (e.vx || e.vz) {
    const ox = e.x, oz = e.z;
    moveBody(e, e.vx * dt * sp, e.vz * dt * sp, e.r * .8, e.def.fly || e.def.boss);
    const moved = Math.abs(e.x - ox) + Math.abs(e.z - oz);
    if (moved < 1e-4) { e.stuck = (e.stuck || 0) + dt; if (e.dashing) e.vx = e.vz = 0; }
    if (e.m.roll) e.roll += moved * 2.6;
  }
  if (!e.vx && !e.vz && !e.jump) { const a = aim(e), d = ((a - e.face + Math.PI * 3) % TAU) - Math.PI; e.face += clamp(d, -dt * 5, dt * 5); }
  if (!P.dead && e.y < 1 && dist2(e, P) < (e.r + .3) ** 2) hurtPlayer(e.dmg);
  // looks
  const hopY = e.hop ? Math.sin(Math.PI * Math.min(1, (e.hopT = (e.hopT || 0) + dt) / e.hop)) * .9 : 0;
  g.position.set(e.x, e.y + hopY + (e.def.fly ? Math.sin(T * 4 + e.seed) * .12 : 0), e.z);
  g.rotation.y = e.face;
  let sc = e.s * (1 + e.flash * 1.4 + (e.tele > 0 ? Math.sin(T * 40) * .04 : 0));
  if (e.flash > 0) e.flash -= dt;
  g.scale.setScalar(sc);
  if (e.flash > 0) { const q = e.flash * 2.2; g.scale.set(sc * (1 + q), sc * (1 - q), sc * (1 + q)); } // squash on a hit
  if (e.white > 0 && (e.white -= dt) <= 0) whiteFlash(e, 0);
  if (e.m.body) {
    const q = e.hop ? -Math.sin(Math.PI * Math.min(1, e.hopT / e.hop)) * .12 : e.def.ai === 'hopper' ? Math.sin(T * 6 + e.seed) * .05 : 0;
    e.m.body.scale.set(1 - q, 1 + q, 1 - q);
    if (e.m.roll) e.m.body.rotation.x = e.roll;
  }
  if (e.m.anim) e.m.anim(T + e.seed, e);
  placeBar(e);
}
function placeBar(e) {
  if (!e.bar) return;
  e.bar.position.set(e.x, e.y + e.h * (e.spawnT > 0 ? 0 : 1) + .3, e.z); e.bar.quaternion.copy(cam.quaternion);
  e.bar.fill.scale.x = e.bar.w * Math.max(0, e.hp / e.maxHp); e.bar.visible = e.spawnT <= 0;
}
function hurtEnemy(e, d, col = '#ffffff', quiet) {
  if (e.dead) return;
  let crit = false; if (!quiet && R() < .1) { d *= 2; crit = true; }
  d = Math.max(1, Math.round(d)); e.hp -= d;
  if (!quiet) {
    e.flash = .1; burst(e.x, Math.min(e.h * .6, 1.2), e.z, 0xfff4c0, 3, 2.2); whiteFlash(e, .07);
    if (!e.def.boss && !e.def.big && e.kx !== undefined) e.kb = .14;
    if (crit) { hitStop(.05); shake(.12); sfx.crit(); }
  }
  num(e.x, e.y + e.h + .1, e.z, crit ? d + '!' : d, crit ? '#ffd23a' : col, crit);
  if (!quiet) { if (P.fire) e.burn = 2; if (P.ice) e.slow = 1.6; sfx.hit(); }
  if (e.def.boss || e.def.big) bossHud(e);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return; e.dead = true;
  if (e.bar) scene.remove(e.bar); if (e.L) rmTemp(e.L);
  { // the body squashes flat in a white blink, then bursts
    const g = e.m.g, s0 = g.scale.x; whiteFlash(e, 1);
    FX.list.push({ m: g, t: 0, d: .09, f: (k) => g.scale.set(s0 * (1 + k * .7), s0 * Math.max(.05, 1 - k * .9), s0 * (1 + k * .7)) });
  }
  burst(e.x, Math.max(.4, e.h * .5), e.z, e.m.col, e.def.boss ? 40 : e.def.big ? 24 : 12, e.def.boss ? 6 : 4);
  // a soft puff of smoke where it stood
  for (let k = 0; k < (e.def.boss ? 14 : 6); k++) { if (parts.length > 210) break; const m = new THREE.Mesh(SPH, S(0xffffff, { transparent: true, opacity: .75 })); const sz = rand(.14, .28) * (e.def.boss ? 2 : 1); m.scale.setScalar(sz); m.position.set(e.x + rand(-.3, .3), rand(.2, .7), e.z + rand(-.3, .3)); scene.add(m); parts.push({ m, s: sz, vx: rand(-.8, .8), vy: rand(.4, 1.2), vz: rand(-.8, .8), t: rand(.4, .7), float: true, grow: true }); }
  dropGems(e); sfx.pop();
  const big = e.def.boss || e.def.big, now = performance.now();
  FEEL.streak = now - (FEEL.lastKill || 0) < 1400 ? (FEEL.streak || 0) + 1 : 0; FEEL.lastKill = now;
  if (FEEL.streak > 0 && !e.minionKill) { sfx.streak(FEEL.streak); streakText(e, FEEL.streak); }
  if (!e.minionKill) { hitStop(e.def.boss ? .16 : big ? .1 : .045); buzz(e.def.boss ? [60, 40, 90] : big ? 40 : 12); }
  shock(e.x, e.z, big ? 2.4 : 1.2, e.m.col);
  if (P.vamp) P.hp = Math.min(P.maxHp, P.hp + Math.round(P.maxHp * P.vamp));
  enemies.splice(enemies.indexOf(e), 1);
  if (e.def.boss || e.def.big) {
    $('bossBar').hidden = true; shake(.6);
    for (const m of enemies.slice()) if (m.minion) { m.minionKill = true; killEnemy(m); }
    for (const t of temps.slice()) rmTemp(t);
  }
  if (!room.cleared && !enemies.length) { FEEL.slow = .55; roomClear(); }
}
function bossHud(e) { $('bossBar').hidden = false; $('bossName').textContent = e.def.name; $('bossFill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%'; }

/* ---------- the player getting hit, levelling up ---------- */
function hurtPlayer(d) {
  if (P.inv > 0 || P.dead || state !== 'play') return;
  if (R() < P.dodge) { P.inv = .4; num(P.x, 1.9, P.z, 'Dodge!', '#9fe8ff'); return; }
  d = Math.round(d); P.hp -= d; P.inv = .8; P.hurtT = .25;
  num(P.x, 1.9, P.z, '-' + d, '#ff5a5a', true); sfx.hurt(); shake(.3); hitStop(.07); buzz(45);
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = ''; h.style.opacity = 0; });
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadT = 0; endJoy(); sfx.lose(); setTimeout(() => finish(false), 1400); }
}
const need = (l) => 8 + l * 5;
function addXp(v) { P.xp += v; while (P.xp >= need(P.lvl)) { P.xp -= need(P.lvl); P.lvl++; P.pend++; } }
async function openLevelUp() {
  state = 'choose'; P.pend--; endJoy(); sfx.lvl(); buzz(30);
  pillar(P.x, P.z); shock(P.x, P.z, 3, 0xffd23a); flashScreen('rgba(255,236,150,.55)');
  await new Promise((r) => setTimeout(r, 520));
  const ok = await ask(`LEVEL ${P.lvl - P.pend}! Answer right to choose from 3 skills`);
  showSkills(ok ? 3 : 2, 'LEVEL UP!', ok ? 'Right answer: choose 1 of 3 skills' : 'Choose 1 of 2 skills');
}
function showSkills(n, title, sub) {
  state = 'choose'; endJoy();
  $('lvlTitle').textContent = title; $('lvlSub').textContent = sub;
  const pool = shuffle(SKILLS.filter((s) => (P.taken[s.id] || 0) < s.max && (s.id !== 'snack' || P.hp < P.maxHp * .8)));
  const box = $('skills'); box.innerHTML = '';
  for (const s of pool.slice(0, n)) {
    const b = document.createElement('button'); b.className = 'skill';
    const lv = P.taken[s.id] ? `<small>Lv ${P.taken[s.id] + 1}</small>` : '';
    b.innerHTML = `<span class="ico">${skillIcon(s)}</span><span><b>${s.name}${lv}</b><span>${s.txt}</span></span>`;
    b.onclick = () => { s.f(); P.taken[s.id] = (P.taken[s.id] || 0) + 1; sfx.click(); $('levelup').hidden = true; state = 'play'; hotbar(); };
    box.appendChild(b);
  }
  $('levelup').hidden = false;
}
function hotbar() {
  const got = SKILLS.filter((s) => P.taken && P.taken[s.id]);
  $('hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => { const s = got[i]; return s ? `<i>${skillIcon(s)}${P.taken[s.id] > 1 ? `<b>${P.taken[s.id]}</b>` : ''}</i>` : ''; }).join('');
}

/* ---------- the learning round at the end of every room ---------- */
// Three quick tasks, answered by walking onto a stone plate: fill the gap (3 words), "is this sentence right?" (right / wrong)
// and "which sentence is right?" (A / B / C). Every right answer drops XP gems; the score decides the chest.
const TRIAL_N = 3;
function startTrial() {
  room.trial = { kinds: shuffle(['gap', 'right', 'pick']), i: 0, score: 0, plates: [], busy: false };
  $('trial').hidden = false; nextTask();
}

function makePlate() {
  const g = new THREE.Group();
  part(g, CYL, S(0xf6f1e6), .78, .22, .78, 0, .11, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.78, .06, 8, 32), S(0x5fc848)); rim.rotation.x = -Math.PI / 2; rim.position.y = .2; g.add(rim);
  const pad = new THREE.Mesh(CYL, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9a4cf0) })); pad.scale.set(.6, .05, .6); pad.position.y = .24; g.add(pad); g.pad = pad;
  const N = nature(); flowers(N, -.8, 0, .6, 2); flowers(N, .75, 0, -.7, 2); flushNature(N, g);
  return g;
}
function clearPlates() {
  const tr = room && room.trial; if (!tr) return;
  for (const p of tr.plates) { scene.remove(p.g); p.g.pad.material.dispose(); p.el.remove(); }
  tr.plates = [];
}
function nextTask() {
  const tr = room.trial; clearPlates();
  if (tr.i >= TRIAL_N) return endTrial();
  const q = pickSentence(); if (!q) return endTrial();
  const w = fillChoices(q), kind = tr.kinds[tr.i], plain = (t) => esc(t.replace(/\s*\([^)]*\)/g, ''));
  let opts, html, kick;
  if (kind === 'gap') {
    kick = 'Walk onto the missing word'; html = `${hints(w.before)}<span class="gap">&nbsp;</span>${hints(w.after)}`;
    opts = w.map((o) => ({ label: o.text, ok: o.ok, word: o.text }));
  } else if (kind === 'right') {
    const good = R() < .5, word = good ? w.right : w.find((o) => !o.ok).text;
    kick = 'Is this sentence right?'; html = `${plain(w.before)}<u>${esc(word)}</u>${plain(w.after)}`;
    opts = [{ label: '✔ RIGHT', ok: good, word }, { label: '✘ WRONG', ok: !good, word }];
  } else {
    kick = 'Which sentence is right?'; const order = shuffle(w);
    html = order.map((o, i) => `<div class="opt"><b>${'ABC'[i]}</b>${plain(w.before)}${esc(o.text)}${plain(w.after)}</div>`).join('');
    opts = order.map((o, i) => ({ label: 'ABC'[i], ok: o.ok, word: o.text }));
  }
  tr.cur = { w, kind, q };
  $('trialKick').textContent = `${kick} · ${tr.i + 1}/${TRIAL_N}`; $('trialCard').innerHTML = html; $('trialCard').className = 'tc ' + kind;
  const xs = opts.length === 3 ? [-2.7, 0, 2.7] : [-1.8, 1.8];
  // measure where the hero stands, then put the row of plates a few steps away from them, towards the middle of the
  // room, on free ground (no block, pool, or tall block just in front)
  const free = (z) => xs.every((x) => [-.7, 0, .7].every((a) => [-.7, 0, .7, 1.5].every((b) => !cellAt(x + a, z + b))));
  const rows = []; for (let z = -6; z <= 5; z += .5) if (free(z)) rows.push(z);
  const want = P.z > 0 ? P.z - 3.6 : P.z + 3.6, pz = rows.length ? rows.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) && Math.abs(b - P.z) > 2.2 ? b : a), rows.find((z) => Math.abs(z - P.z) > 2.2) ?? rows[0]) : -2.4;
  tr.plates = opts.map((o, i) => {
    const g = makePlate(); g.position.set(xs[i], 0, pz); scene.add(g); burst(xs[i], .3, pz, 0xb46cff, 5, 2);
    const el = document.createElement('div'); el.className = 'tag' + (o.label.length < 2 ? ' big' : ''); el.textContent = o.label; $('plateTags').appendChild(el);
    return { ...o, g, el, x: xs[i], z: pz, armed: (P.x - xs[i]) ** 2 + (P.z - pz) ** 2 > 1.6 };
  });
  tr.busy = false; sfx.click();
}
function answerPlate(p) {
  const tr = room.trial, { w, kind, q } = tr.cur; tr.busy = true;
  const sentence = (w.before + w.right + w.after).replace(/\s*\([^)]*\)/g, '').trim();
  const chose = kind === 'right' ? (p.label.includes('RIGHT') ? p.word : 'said “wrong”') : p.word;
  run.answers.push({ ok: p.ok, sentence, right: w.right, chose, q });
  for (const o of tr.plates) o.g.pad.material.color.set(o.ok ? 0x3ddc5a : o === p ? 0xff4040 : 0x555555);
  $('trialCard').innerHTML = `${p.ok ? '' : '<small>The right sentence:</small>'}${hints(w.before)}<span class="gap ok">${esc(w.right)}</span>${hints(w.after)}`;
  if (p.ok) {
    tr.score++; seq([659, 880, 1175], 70, .14); toast(pick(['Right!', 'Great!', 'Well done!', 'Correct!']));
    burst(p.x, .5, p.z, 0x3ddc5a, 14, 3);
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(OCT, GEM_M); m.scale.set(.12, .17, .12); scene.add(m); gems.push({ m, x: p.x, z: p.z, y: .5, vx: rand(-2, 2), vz: rand(1, 2.5), vy: rand(3, 5), v: 1.5, fly: false }); }
  } else { tone(160, .3, 'square', .04, .6); shake(.15); }
  setTimeout(() => { if (room && room.trial === tr) { tr.i++; nextTask(); } }, p.ok ? 1200 : 2800);
}
function endTrial() {
  const tr = room.trial; clearPlates(); room.trial = null; $('trial').hidden = true;
  const tier = tr.score >= TRIAL_N ? 2 : tr.score >= 2 ? 1 : 0;
  room.chest = makeChest(tier); room.chest.tier = tier; room.chest.position.set(0, 0, -2.6); scene.add(room.chest);
  run.trial[0] += tr.score; run.trial[1] += TRIAL_N;
  toast(tier === 2 ? 'Perfect! Golden chest!' : `${tr.score}/${TRIAL_N} right: a ${tier ? '' : 'small '}chest`);
}

/* ---------- a run: 10 rooms ---------- */
function startRun(i) {
  run.isle = i; run.room = 0; run.tro = 0; run.bonus = 0; run.answers = []; run.trial = [0, 0]; run.fixed = 0; $('trial').hidden = true;
  clearThings(); buildEnv(ISLES[i]); newPlayer(); hotbar();
  $('menu').hidden = true; $('hud').hidden = false; $('hpTag').style.display = 'block'; $('hint').style.opacity = 1;
  $('runTro').textContent = 0; state = 'door';
  nextRoom(true);
}
function clearThings() {
  for (const e of enemies) { scene.remove(e.m.g); if (e.bar) scene.remove(e.bar); }
  for (const list of [arrows, bullets, gems, parts]) { for (const o of list) scene.remove(o.m); list.length = 0; }
  for (const t of temps.slice()) rmTemp(t);
  for (const o of FX.list) { scene.remove(o.m); if (o.mat) o.mat.dispose(); } FX.list.length = 0;
  enemies.length = 0; $('bossBar').hidden = true;
}
function nextRoom(first) {
  state = 'door'; endJoy();
  const fade = $('fade'); if (!first) { fade.classList.add('on', 'purple'); sfx.door(); }
  setTimeout(() => {
    run.room++;
    if (run.room > 10) return finish(true);
    clearThings(); buildRoom();
    Object.assign(P, { x: 0, z: 6, face: Math.PI, atkT: .4, inv: .5 });
    if (run.room === 6) { const h = Math.round(P.maxHp * .25); P.hp = Math.min(P.maxHp, P.hp + h); setTimeout(() => toast('Campfire rest: +' + h + ' HP'), 400); }
    const I = ISLES[run.isle], n = run.room;
    $('roomTxt').textContent = `Room ${n}/10`;
    if (n === 10) { const b = spawnEnemy(I.boss, 0, -3.5); bossHud(b); toast('BOSS: ' + b.def.name); }
    else if (n === 5) { const b = spawnEnemy(I.mini, 0, -3); bossHud(b); for (const x of [-3, 3]) spawnEnemy(I.enemies[0], x, -5.5); toast(b.def.name + '!'); }
    else {
      const count = Math.min(8, 2 + Math.floor(n * .75) + run.isle), types = I.enemies.slice(0, n === 1 ? 1 : n === 2 ? 2 : 3);
      for (let k = 0; k < count; k++) { const s = freeSpot(); spawnEnemy(types[k % types.length], s.x, s.z); }
      if (n !== 6) toast('Room ' + n);
    }
    camZ = camTarget();
    fade.classList.remove('on'); setTimeout(() => fade.classList.remove('purple'), 300);
    setTimeout(() => { if (state === 'door') state = 'play'; }, first ? 50 : 250);
  }, first ? 0 : 320);
}
function roomClear() {
  room.cleared = true;
  const n = run.room, I = ISLES[run.isle], t = (n === 10 ? 6 : n === 5 ? 3 : 1) * I.mult;
  run.tro += t; $('runTro').textContent = run.tro;
  if (n === 10) { banner('ISLAND CLEARED!', `+${t} ${TRO}`); sfx.win(); buzz([80, 60, 120]); setTimeout(() => finish(true), 1800); return; }
  banner('ROOM CLEAR!', `+${t} ${TRO}`); sfx.clear();
  setTimeout(() => { if (room && room.cleared && !room.trial && !room.chest && !room.open) startTrial(); }, 1100);
}
function makeChest(tier) {
  const g = new THREE.Group(), body = S(tier === 2 ? 0xffcc33 : 0xc8844a, tier === 2 ? { emissive: 0x6a4a00 } : undefined), band = S(tier === 2 ? 0xfff3a0 : 0xffcc33, { emissive: 0x554000 });
  part(g, RBOX, body, .9, .5, .62, 0, .25, 0);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .9, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), body); lid.position.y = .5; lid.castShadow = true; g.add(lid);
  for (const x of [-.3, .3]) part(g, RBOX, band, .1, .55, .66, x, .27, 0);
  part(g, RBOX, band, .16, .2, .08, 0, .45, .32);
  if (!tier) g.scale.setScalar(.75);
  const glow = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: tier === 2 ? 0xffe066 : 0xb46cff, transparent: true, opacity: .6, depthWrite: false })); glow.scale.setScalar(.8); glow.position.y = .04; g.add(glow);
  g.glow = glow; rimModel(g); return g;
}
// walking into the chest: trophies and HP by how well the learning round went; a golden chest also gives a free skill
function openChest() {
  const c = room.chest, tier = c.tier; room.chest = null; scene.remove(c); burst(c.position.x, .6, c.position.z, tier === 2 ? 0xffd23a : 0xb07c45, 18, 3.5);
  const I = ISLES[run.isle], t = [0, 1, 2][tier] * I.mult, h = Math.round(P.maxHp * [.05, .1, .2][tier]);
  if (t) { run.tro += t; run.bonus += t; $('runTro').textContent = run.tro; }
  P.hp = Math.min(P.maxHp, P.hp + h); toast((t ? `+${t} ${TRO}  ` : '') + `+${h} HP`); sfx.win();
  if (tier === 2) P.free = (P.free || 0) + 1;
  room.open = true; room.openT = 0; burst(0, 2, -7.6, 0x4caf3f, 20, 3);
}
let finishing = false;
async function finish(won) {
  if (state === 'result' || state === 'menu' || finishing) return;
  finishing = true; endJoy(); state = 'fix'; $('trial').hidden = true; clearPlates();
  // fix your mistakes: every wrong answer of this run once more (up to 5), a trophy for each one put right
  const seen = new Set(), wrong = run.answers.filter((a) => !a.ok && a.q && !seen.has(a.q) && seen.add(a.q)).slice(0, 5);
  let fixed = 0;
  for (let i = 0; i < wrong.length; i++) if (await ask(`FIX YOUR MISTAKES ${i + 1}/${wrong.length} · +1 🏆 each`, wrong[i].q, true)) fixed++;
  run.tro += fixed; run.fixed = fixed;
  finishing = false; state = 'result';
  const I = ISLES[run.isle], before = save.trophies;
  let bonus = 0;
  if (won && !save.cleared[run.isle]) { bonus = 10 * I.mult; save.cleared[run.isle] = 1; }
  const done = won ? 10 : run.room - 1;
  save.best[run.isle] = Math.max(save.best[run.isle], done);
  save.trophies += run.tro + bonus; store();
  const fresh = ISLES.map((x, i) => i).filter((i) => before < ISLES[i].need && save.trophies >= ISLES[i].need);
  if (fresh.length) save.isle = fresh[fresh.length - 1], store();
  $('resTitle').textContent = won ? 'ISLAND CLEARED!' : 'KNOCKED OUT!';
  $('resSub').textContent = won ? `${HEROES[save.hero].name} beat the ${E[I.boss].name}!` : `${HEROES[save.hero].name} made it to room ${run.room} of ${I.name}.`;
  $('resRows').innerHTML = [
    `<div><span>Rooms cleared</span><span>${done}/10</span></div>`,
    `<div><span>Trophies won</span><span>+${run.tro} ${TRO}</span></div>`,
    run.answers.length ? `<div><span>English answers</span><span>${run.answers.filter((a) => a.ok).length}/${run.answers.length} right</span></div>` : '',
    run.trial[1] ? `<div><span>Learning rounds</span><span>${run.trial[0]}/${run.trial[1]} right</span></div>` : '',
    run.fixed ? `<div><span>Mistakes fixed</span><span>+${run.fixed} ${TRO}</span></div>` : '',
    bonus ? `<div><span>First clear bonus</span><span>+${bonus} ${TRO}</span></div>` : '',
    `<div class="tot"><span>Trophies</span><span>${save.trophies} ${TRO}</span></div>`,
    ...fresh.map((i) => `<div class="new">🔓 ${ISLES[i].name} unlocked!</div>`),
    ...run.answers.filter((a) => !a.ok).slice(0, 8).map((a, k) => `<div class="rev">${k ? '' : 'Learn these:<br>'}✗ ${esc(a.chose)} → ${esc(a.sentence).replace(esc(a.right), '<b>' + esc(a.right) + '</b>')}</div>`),
  ].join('');
  if (won) sfx.win();
  $('result').hidden = false;
}
function toMenu() {
  clearThings(); clearPlates(); if (room) room.trial = null; $('trial').hidden = true; state = 'menu';
  for (const id of ['hud', 'result', 'pause', 'levelup']) $(id).hidden = true;
  $('menu').hidden = false; $('hpTag').style.display = 'none'; $('nums').innerHTML = ''; nums.length = 0;
  showIsle(save.isle, true); refreshHeroes();
}
function pauseGame() {
  if (state !== 'play') return; state = 'pause'; endJoy();
  const list = SKILLS.filter((s) => P.taken[s.id]).map((s) => `<span>${skillIcon(s)} ${s.name}${P.taken[s.id] > 1 ? ' ×' + P.taken[s.id] : ''}</span>`);
  $('mySkills').innerHTML = list.length ? list.join('') : '<span>No skills yet: level up by collecting green gems</span>';
  $('pause').hidden = false;
}
function resumeGame() { $('pause').hidden = true; state = 'play'; }
$('pauseBtn').onclick = pauseGame; $('resume').onclick = resumeGame;
$('quit').onclick = () => { $('pause').hidden = true; state = 'play'; finish(false); };
$('resBtn').onclick = () => { sfx.click(); toMenu(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
let toastT = 0;
function toast(t) { const el = $('toast'); el.innerHTML = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1500); }
const shake = (s) => { shakeT = Math.max(shakeT, s); };

/* ---------- game feel: sparks, shock rings, a light pillar, banners, the ring at your feet and the target mark ---------- */
const FX = { list: [], ring: null, target: null, mats: new Map() };
const GLOW_T = (() => { const c = canvas(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const glowMat = (col) => FX.mats.get(col) || FX.mats.set(col, new THREE.SpriteMaterial({ map: GLOW_T, color: new THREE.Color(col).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })).get(col);
function spark(x, y, z, col, s) {
  if (FX.list.length > 60) return;
  const m = new THREE.Sprite(glowMat(col)); m.position.set(x, y, z); m.scale.setScalar(s * .3); scene.add(m);
  FX.list.push({ m, t: 0, d: .13, f: (k) => m.scale.setScalar(s * (.3 + k * .9) * (1 - k * k)) });
}
function shock(x, z, r, col) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(RING_GEO, mat); m.position.set(x, .08, z); m.scale.setScalar(.2); scene.add(m);
  FX.list.push({ m, t: 0, d: .38, mat, f: (k) => { m.scale.setScalar(.2 + (r - .2) * (1 - (1 - k) ** 3)); mat.opacity = .8 * (1 - k); } });
}
const PILLAR_G = new THREE.CylinderGeometry(.55, .75, 7, 24, 1, true).translate(0, 3.5, 0);
function pillar(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd860).multiplyScalar(1.8), transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(PILLAR_G, mat); m.position.set(x, 0, z); scene.add(m);
  FX.list.push({ m, t: 0, d: .8, mat, f: (k) => { m.scale.set(1 - k * .6, Math.min(1, k * 5), 1 - k * .6); mat.opacity = .7 * (1 - k); m.position.set(P.x, 0, P.z); } });
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; spark(x + Math.sin(a) * .6, rand(.3, 2.5), z + Math.cos(a) * .6, 0xffe080, rand(.4, .8)); }
}
// a white silhouette for a blink when an enemy is hit (Archero style); materials come back afterwards
const FLASH_M = new THREE.MeshBasicMaterial({ color: 0xffffff });
function whiteFlash(e, d) {
  const g = e.m && e.m.g; if (!g) return;
  if (d > 0) { g.traverse((n) => { if (n.isMesh) { if (!n.userData.m0) n.userData.m0 = n.material; n.material = FLASH_M; } }); e.white = d; }
  else g.traverse((n) => { if (n.isMesh && n.userData.m0) { n.material = n.userData.m0; n.userData.m0 = null; } });
}
const STREAK = ['', 'DOUBLE!', 'TRIPLE!', 'QUADRA!'];
const streakText = (e, n) => num(e.x, e.y + e.h + .7, e.z, STREAK[n] || `x${n + 1} COMBO!`, n >= 3 ? '#ff7ad8' : '#ffb03a', true);
function banner(big, small) {
  let el = $('banner');
  if (!el) { el = document.createElement('div'); el.id = 'banner'; $('toast').parentNode.appendChild(el); }
  el.innerHTML = `<b>${big}</b>${small ? `<small>${small}</small>` : ''}`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(banner.t); banner.t = setTimeout(() => el.classList.remove('on'), 1600);
}
function flashScreen(col) {
  let el = $('flashFx'); if (!el) { el = document.createElement('div'); el.id = 'flashFx'; $('hurt').parentNode.appendChild(el); }
  el.style.transition = 'none'; el.style.background = col; el.style.opacity = 1; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'opacity .45s'; el.style.opacity = 0; }));
}
function feelFrame(dt) {
  for (let i = FX.list.length - 1; i >= 0; i--) {
    const o = FX.list[i]; o.t += dt; const k = Math.min(1, o.t / o.d); o.f(k);
    if (k >= 1) { scene.remove(o.m); if (o.mat) o.mat.dispose(); FX.list.splice(i, 1); }
  }
  if (!FX.ring) {
    FX.ring = new THREE.Mesh(new THREE.RingGeometry(.44, .54, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6fe0ff).multiplyScalar(1.4), transparent: true, opacity: .75, depthWrite: false }));
    const arc = (a) => new THREE.RingGeometry(.62, .76, 10, 1, a - .45, .9).rotateX(-Math.PI / 2);
    FX.target = new THREE.Group(); const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b4a).multiplyScalar(1.5), transparent: true, opacity: .9, depthWrite: false });
    for (let q = 0; q < 4; q++) FX.target.add(new THREE.Mesh(arc(q * Math.PI / 2), tm));
    FX.ring.renderOrder = FX.target.renderOrder = 2; scene.add(FX.ring, FX.target);
  }
  const live = state === 'play' && P.rig && !P.dead;
  FX.ring.visible = live && !P.moving; FX.ring.position.set(P.x, .06, P.z);
  FX.ring.scale.setScalar(1 + Math.sin(T * 6) * .05); FX.ring.material.opacity = .45 + P.draw * .4;
  const t = live && P.aim ? nearest() : null; FX.target.visible = !!t;
  if (t) { FX.target.position.set(t.x, .07, t.z); FX.target.rotation.y = T * 2.4; FX.target.scale.setScalar(Math.max(.75, t.r * 1.5) * (1 + Math.sin(T * 9) * .06)); }
}

/* ---------- floating numbers and the HP tag ---------- */
const nums = [], numBox = $('nums'), V = new THREE.Vector3();
function num(x, y, z, txt, col, big) {
  const el = document.createElement('div'); el.textContent = txt; el.style.color = col; if (big) el.style.fontSize = '24px';
  if (big) el.style.fontWeight = '900';
  numBox.appendChild(el); nums.push({ el, x: x + rand(-.2, .2), y, z, t: 0, big });
  if (nums.length > 40) nums.shift().el.remove();
}
const toScreen = (x, y, z) => { V.set(x, y, z).project(cam); return [(V.x + 1) / 2 * VW, (1 - V.y) / 2 * VH]; };
function updateNums(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt; n.y += dt * 1.3;
    if (n.t > .8) { n.el.remove(); nums.splice(i, 1); continue; }
    const [sx, sy] = toScreen(n.x, n.y, n.z);
    const pop = n.t < .14 ? .5 + ease(n.t / .14) * (n.big ? 1.25 : 1) : n.big ? 1.25 - Math.min(.25, (n.t - .14) * 2) : 1;
    n.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%) scale(${pop})`;
    n.el.style.opacity = n.t > .55 ? (.8 - n.t) / .25 : 1;
  }
}

/* ---------- each frame of a run ---------- */
const turn = (a, b, k) => { const d = ((b - a + Math.PI * 3) % TAU) - Math.PI; return a + clamp(d, -k, k); };
function nearest() { let best = null, bd = 1e9; for (const e of enemies) { if (e.spawnT > 0 || e.y > 1.5) continue; const d = dist2(e, P); if (d < bd) { bd = d; best = e; } } return best; }
function step(dt) {
  if (!P.dead) {
    let mx = joy.x, mz = joy.y;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1;
    const m = Math.hypot(mx, mz); P.moving = m > .22;
    if (P.moving) {
      const k = Math.min(1, m) / m * P.speed * dt; moveBody(P, mx * k, mz * k, .3, false, true);
      P.face = turn(P.face, Math.atan2(mx, mz), dt * 14); P.atkT = Math.max(P.atkT - dt, .12); P.aim = false; P.draw = 0;
      if ((P.dustT = (P.dustT || 0) - dt) <= 0) { P.dustT = .16; puff(P.x, P.z); }
    } else {
      const t = nearest(); P.aim = !!t;
      if (t) { P.face = turn(P.face, Math.atan2(t.x - P.x, t.z - P.z), dt * 20); P.atkT -= dt; if (P.atkT <= 0) { shoot(t); P.atkT = P.atkInt; P.rel = .35; } }
      P.draw = t ? clamp(1 - P.atkT / Math.min(P.atkInt, .5), 0, 1) : 0;
    }
    if (room.chest && (P.x - room.chest.position.x) ** 2 + (P.z - room.chest.position.z) ** 2 < .8 && state === 'play') openChest();
    const tr = room.trial;
    if (tr && !tr.busy) for (const p of tr.plates) {
      const d2 = (P.x - p.x) ** 2 + (P.z - p.z) ** 2;
      if (!p.armed) { if (d2 > 1.6) p.armed = true; } else if (d2 < .5) { answerPlate(p); break; }
    }
    if (room.open && P.z < -7.7 && state === 'play') { nextRoom(); }
  } else P.deadT += dt;
  updateArrows(dt);
  for (const e of enemies.slice()) if (!e.dead) updateEnemy(e, dt);
  updateBullets(dt); updateGems(dt); updateParts(dt);
  // buddy blocks
  P.orbs.forEach((o, i) => {
    const a = T * 3.2 + i / P.orbs.length * TAU; o.position.set(P.x + Math.sin(a) * 1.4, .8, P.z + Math.cos(a) * 1.4); o.rotation.set(T * 4, T * 5, 0);
    for (const e of enemies) if (e.spawnT <= 0 && e.orbCd <= 0 && (e.x - o.position.x) ** 2 + (e.z - o.position.z) ** 2 < (e.r + .3) ** 2) { e.orbCd = .5; hurtEnemy(e, P.dmg * .6, '#9ff4ff', true); }
  });
  if (P.inv > 0) P.inv -= dt;
  if (P.shootAnim > 0) P.shootAnim -= dt;
  if (P.rel > 0) P.rel -= dt; if (P.hurtT > 0) P.hurtT -= dt;
  // the gate opens once the room is clear
  if (room.chest) { const c = room.chest; c.position.y = Math.abs(Math.sin(T * 3)) * .15; c.rotation.y = Math.sin(T * 2) * .3; c.glow.material.opacity = .4 + Math.sin(T * 6) * .25; }
  if (room.open) {
    room.openT += dt; setPortal(Math.min(1, room.openT / .9));
    if (R() < dt * 14) { const m = new THREE.Mesh(SPH, S(pick([0xb46cff, 0xe070ff, 0x7a2fe0]), { emissive: 0x9a40e0, emissiveIntensity: 1.5 })); const sz = rand(.04, .08); m.scale.setScalar(sz); m.position.set(rand(-1.4, 1.4), rand(.2, 3.5), -7.6); scene.add(m); parts.push({ m, s: sz, vx: rand(-.3, .3), vy: rand(.4, 1.2), vz: rand(.2, .8), t: rand(.8, 1.4), float: true }); }
  }
  env.curtain.rotation.z = Math.sin(T * 1.3) * .015;
  if (P.free > 0 && !P.dead && state === 'play') { P.free--; showSkills(3, 'FREE SKILL!', 'Golden chest: choose 1 of 3 skills'); }
  if (P.pend > 0 && !P.dead && state === 'play' && !(run.room === 10 && room.cleared) && !gems.some((g) => g.fly) && !(room.chest && (P.x - room.chest.position.x) ** 2 + (P.z - room.chest.position.z) ** 2 < 1.2)) openLevelUp();
}
function drawPlayer() {
  const g = P.rig.g;
  g.position.set(P.x, 0, P.z);
  if (P.dead) { g.rotation.set(0, P.face, 0); g.rotateX(-Math.min(1, P.deadT * 3) * 1.45); g.visible = true; return; }
  g.rotation.set(0, P.face, 0);
  g.visible = !(P.inv > 0 && P.inv < .75 && Math.sin(T * 40) > 0);
  animHero(P.rig, T, { moving: P.moving, aim: P.aim, draw: P.draw, rel: P.rel, hurt: Math.max(0, P.hurtT || 0) });
}
function updateHud() {
  $('xpFill').style.width = (P.xp / need(P.lvl) * 100) + '%'; $('lvl').textContent = P.lvl;
  const [sx, sy] = toScreen(P.x, P.rig.top + .85, P.z);
  const tag = $('hpTag'); tag.style.transform = `translate(${sx - 32}px,${sy - 22}px)`;
  if (room && room.trial) for (const p of room.trial.plates) { const [x, y] = toScreen(p.x, .75, p.z); p.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; }
  $('hpNum').textContent = Math.max(0, Math.ceil(P.hp)); $('hpFill').style.width = Math.max(0, P.hp / P.maxHp * 100) + '%';
}
// the camera frames the room for each screen: the gate stays below the top bar, the bottom wall above the screen's edge.
// If the whole room fits it stays still; on a short screen it scrolls with the hero.
const EL = THREE.MathUtils.degToRad(46);
let camG = 0, camB = 0;
function camAt(cz, sx = 0, sy = 0) { cam.position.set(sx, camDist * Math.sin(EL) + sy, cz + camDist * Math.cos(EL)); cam.lookAt(sx, 0, cz - .4); cam.updateMatrixWorld(); }
function camRange() {
  camG = -6; camB = 6;
  for (let cz = -6; cz <= 6; cz += .1) { camAt(cz); if (toScreen(0, 4.4, -8.5)[1] >= 96) camG = cz; }
  for (let cz = 6; cz >= -6; cz -= .1) { camAt(cz); if (toScreen(0, 0, 8.5)[1] <= VH - 24) camB = cz; }
}
// when the room fits, sit it low on the screen so the land beyond the portal shows above it
const camTarget = () => camB <= camG ? camB + (camG - camB) * .1 : camG + (camB - camG) * clamp((P.z + 6.5) / 13, 0, 1);
function placeCamera(dt) {
  camZ += (camTarget() - camZ) * Math.min(1, dt * 4);
  let sx = 0, sy = 0; if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); const k = Math.min(1, shakeT * 2.2) * .35; sx = Math.sin(T * 61) * k; sy = Math.cos(T * 53) * k; }
  camAt(camZ, sx, sy);
  sun.position.set(7, 18, camZ + 9); sun.target.position.set(0, 0, camZ);
}

/* ---------- the island menu ---------- */
const menu = { isles: [], locks: [], hero: null, cur: 0, camX: 0, sea: null };
// a floating island: a soft grassy (sandy, snowy) top on a rocky cone, with trees, flowers, two animals and a golden trophy
function isleModel(I, seed) {
  const g = new THREE.Group(), N = nature();
  const topG = new THREE.CylinderGeometry(4.6, 4.3, .7, 40, 2); const tp = topG.attributes.position;
  for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 3 + seed) * .07 + Math.cos(a * 5 + seed) * .05; tp.setX(i, x * k); tp.setZ(i, z * k); if (tp.getY(i) > 0) tp.setY(i, .35 + hnoise(x, z, seed) * .08); }
  topG.computeVertexNormals();
  const top = new THREE.Mesh(topG, S(I.land[0])); top.position.y = -.35; top.receiveShadow = true; top.castShadow = true; g.add(top);
  const coneG = new THREE.ConeGeometry(4.4, 4.2, 20, 4); const cp = coneG.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < 2 && y > -2) { cp.setX(i, cp.getX(i) * rand(.85, 1.1)); cp.setZ(i, cp.getZ(i) * rand(.85, 1.1)); } }
  coneG.rotateX(Math.PI); coneG.computeVertexNormals();
  const cone = new THREE.Mesh(coneG, S(I.land[2], { flatShading: true })); cone.position.y = -2.75; g.add(cone);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.45, .14, 8, 48), S(I.land[1])); rim.rotation.x = Math.PI / 2; rim.position.y = -.02; g.add(rim);
  tree(N, I.tree, -2.4, 0, -1.8, .9); tree(N, I.tree, 2.6, 0, -2.2, .75);
  for (let k = 0; k < 22; k++) { const a = rand(0, TAU), r = rand(1.2, 3.9), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 1.2 && z > -1 && z < 2.5) continue; decoAt(N, I, x, 0, z); }
  if (I.ground !== 'snow') grassField(N.tuft, -4, 4, -4, 4, 0, 4, (x, z) => Math.hypot(x, z) > 4.1 || (Math.abs(x) < .9 && z > -.8 && z < 1.4), I.ground === 'sand' ? 0xd8c070 : null);
  flushNature(N, g);
  // two animals grazing
  g.animals = [];
  for (const [x, z, k] of [[-2.2, 1.6, I.ground === 'sand' ? 'pig' : 'sheep'], [1.3, 2.5, 'chicken']]) { const a = mAnimal(k); a.g.position.set(x, 0, z); a.g.rotation.y = rand(-1, 1); g.add(a.g); g.animals.push(a); }
  // a golden trophy on a white stand
  const gold = S(0xffcc33, { emissive: 0x6a4a00 });
  part(g, CYL, S(0xf6f1e6), .45, .4, .45, 2.4, .2, 1.4);
  const cup = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.18, 0], [.06, .12], [.06, .3], [.3, .45], [.34, .8], [0, .8]].map(([a, b]) => new THREE.Vector2(a, b)), 22), gold); cup.position.set(2.4, .4, 1.4); cup.castShadow = true; g.add(cup);
  for (const x of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(.13, .035, 8, 16), gold); h.position.set(2.4 + x * .36, 1.0, 1.4); h.rotation.y = Math.PI / 2; g.add(h); }
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
function buildMenu() {
  menuScene.background = tex(2, 64, (x) => { const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#3f8fe8'); gr.addColorStop(1, '#bfe8ff'); x.fillStyle = gr; x.fillRect(0, 0, 2, 64); });
  menuScene.fog = new THREE.Fog(0xbfe8ff, 45, 130);
  // a gently rolling sea
  const sg = new THREE.PlaneGeometry(400, 400, 80, 80).rotateX(-Math.PI / 2);
  const sm = new THREE.MeshLambertMaterial({ map: waterTex().clone(), color: 0x9fd8ff, emissive: 0x0a3a6a });
  sm.map.needsUpdate = true; sm.map.repeat.set(60, 60);
  sm.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.time; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += sin(position.x * .25 + uTime * 1.2) * .25 + cos(position.z * .2 + uTime) * .25;'); };
  sm.customProgramCacheKey = () => 'sea';
  menu.sea = new THREE.Mesh(sg, sm); menu.sea.position.y = -1.6; menu.sea.receiveShadow = true; menuScene.add(menu.sea);
  ISLES.forEach((I, i) => {
    const g = isleModel(I, i * 3.1); g.position.set(i * 18, 0, -i * 2); menuScene.add(g); menu.isles.push(g);
    // a golden padlock floats over locked islands
    const lock = new THREE.Group(); lock.position.set(i * 18, 3.6, -i * 2); menuScene.add(lock);
    const gold = S(0xffcc33, { emissive: 0x6a4a00 });
    part(lock, RBOX, gold, 1.1, .9, .45, 0, 0, 0);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(.34, .09, 10, 24, Math.PI), S(0xc8ccd4)); sh.position.y = .45; lock.add(sh);
    for (const x of [-.34, .34]) part(lock, CYL, S(0xc8ccd4), .09, .25, .09, x, .45, 0);
    part(lock, SPH, S(0x3a2a10), .09, .09, .05, 0, .05, .23); part(lock, RBOX, S(0x3a2a10), .06, .18, .05, 0, -.1, .23);
    menu.locks.push(lock);
  });
  // soft round clouds and a warm sun
  const CN = nature();
  for (let k = 0; k < 14; k++) { const x = rand(-25, 65), y = rand(9, 14), z = rand(-50, -14); for (let a = 0; a < 5; a++) CN.ball.push([x + rand(-2.4, 2.4), y + rand(-.3, .6), z + rand(-1, 1), rand(1, 1.8), rand(.8, 1.2), rand(1, 1.6), 0, 0xffffff]); }
  const clouds = new THREE.Group(); inst(BUSH, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a9aaa }), CN.ball, clouds, null, false); menu.clouds = clouds; menuScene.add(clouds);
  menu.sun = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2a0).multiplyScalar(2), fog: false })); menu.sun.position.set(-30, 30, -110); menuScene.add(menu.sun);
}
function showIsle(i, instant) {
  i = clamp(i, 0, ISLES.length - 1); menu.cur = i; if (unlocked(i)) { save.isle = i; store(); }
  if (instant) menu.camX = i * 18;
  const I = ISLES[i], ok = unlocked(i);
  $('isleName').textContent = I.name;
  $('isleSub').textContent = ok ? (save.cleared[i] ? `✔ Cleared · ${I.sub}` : save.best[i] ? `Best: room ${save.best[i] + 1}/10 · ${I.sub}` : I.sub) : `🔒 Needs ${I.need} 🏆 · ${I.sub}`;
  const next = ISLES.find((x) => x.need > save.trophies);
  $('roadFill').style.width = next ? (save.trophies / next.need * 100) + '%' : '100%';
  $('roadTxt').innerHTML = next ? `${save.trophies} / ${next.need} ${TRO} to unlock ${next.name}` : 'All three islands unlocked!';
  $('trophies').textContent = save.trophies;
  $('prevIsle').disabled = i === 0; $('nextIsle').disabled = i === ISLES.length - 1;
  const play = $('play'); play.innerHTML = ok ? 'PLAY' : `🔒 ${I.need} ${TRO}`; play.classList.toggle('off', !ok);
  placeMenuHero();
}
function placeMenuHero() {
  if (menu.hero) menuScene.remove(menu.hero.g);
  menu.hero = mHero(save.hero); menu.hero.g.scale.setScalar(1.6);
  const p = menu.isles[menu.cur].position; menu.hero.g.position.set(p.x, 0, p.z + .6); menuScene.add(menu.hero.g);
}
function refreshHeroes() {
  for (const b of document.querySelectorAll('.hero')) b.classList.toggle('on', b.dataset.id === save.hero);
  $('perk').innerHTML = perkIcon(save.hero) + esc(HEROES[save.hero].perk);
}
function menuFrame(dt) {
  const p = menu.isles[menu.cur].position;
  menu.camX += (p.x - menu.camX) * Math.min(1, dt * 5);
  const el = THREE.MathUtils.degToRad(24);
  const md = menu.icon ? 7.5 : menuDist;
  mcam.position.set(menu.camX, md * Math.sin(el) + 1, p.z + md * Math.cos(el)); mcam.lookAt(menu.camX, menu.icon ? .9 : -2.6, p.z);
  msun.position.set(menu.camX + 8, 16, p.z + 10); msun.target.position.set(menu.camX, 0, p.z);
  menu.sea.material.map.offset.set(T * .01, T * .015);
  menu.locks.forEach((l, i) => { l.visible = !unlocked(i); l.position.y = 3.6 + Math.sin(T * 2 + i) * .2; l.rotation.y = Math.sin(T * 1.3 + i) * .4; });
  menu.isles.forEach((g, i) => { g.position.y = Math.sin(T * 1.1 + i * 2) * .12; g.animals.forEach((a, k) => { a.head.rotation.x = Math.sin(T * 2 + k * 3) > .3 ? .5 : 0; a.g.rotation.y += Math.sin(T * .5 + k) * .004; }); });
  menu.clouds.position.x = Math.sin(T * .05) * 6; menu.sun.position.x = menu.camX - 30; menu.sun.lookAt(mcam.position);
  const h = menu.hero; h.g.position.y = menu.isles[menu.cur].position.y; h.g.rotation.y = Math.sin(T * .7) * .5;
  const c = T % 3.4; animHero(h, T, { aim: c > 1.6, draw: clamp((c - 1.7) / 1.1, 0, 1), rel: c < 2.0 && T > 3.4 ? clamp(2.0 - c, 0, .4) : 0 });
}
// small pictures of each hero for the buttons, drawn once with the 3D models
function heroThumbs() {
  const S = 160, rt = new THREE.WebGLRenderTarget(S, S); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 4); sc.add(dl);
  const c = new THREE.PerspectiveCamera(30, 1, .1, 20), px = new Uint8Array(S * S * 4);
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S; const ctx = cnv.getContext('2d'), out = {};
  renderer.setClearColor(0x000000, 0);
  for (const id of Object.keys(HEROES)) {
    const h = mHero(id); animHero(h, 0, {}); h.g.rotation.y = .35; sc.add(h.g);
    const y = h.top - .3; c.position.set(.55, y + .25, 2.3); c.lookAt(0, y - .05, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, c); renderer.toneMapping = THREE.NoToneMapping;
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    const img = ctx.createImageData(S, S);
    for (let r = 0; r < S; r++) img.data.set(px.subarray((S - 1 - r) * S * 4, (S - r) * S * 4), r * S * 4);
    ctx.putImageData(img, 0, 0); out[id] = cnv.toDataURL(); sc.remove(h.g);
  }
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); rt.dispose();
  return out;
}

/* ---------- start ---------- */
fit();
buildMenu();
const thumbs = heroThumbs();
for (const id of Object.keys(HEROES)) {
  const b = document.createElement('button'); b.className = 'hero'; b.dataset.id = id;
  b.innerHTML = `<img class="face" src="${thumbs[id]}" alt="">${perkIcon(id).replace('<img', '<img class="pk"')}${HEROES[id].name}`;
  b.onclick = () => { save.hero = id; store(); sfx.click(); refreshHeroes(); placeMenuHero(); };
  $('heroes').appendChild(b);
}
$('prevIsle').onclick = () => { sfx.click(); showIsle(menu.cur - 1); };
$('nextIsle').onclick = () => { sfx.click(); showIsle(menu.cur + 1); };
$('play').onclick = () => { if (!unlocked(menu.cur)) { toastMenu(); return; } sfx.click(); startRun(menu.cur); };
function toastMenu() { const b = $('play'); b.animate([{ transform: 'translateX(-50%)' }, { transform: 'translateX(calc(-50% - 8px))' }, { transform: 'translateX(calc(-50% + 8px))' }, { transform: 'translateX(-50%)' }], { duration: 300 }); tone(150, .15, 'square', .04); }
function showPack() {
  const sum = window.FugioPacks ? FugioPacks.summary(PACKS, save.packs) : { title: 'Questions', level: '–' };
  const LVC = { A0: '#7fe0a0', A1: '#8cc8ff', A2: '#c9a3ff' };
  $('qLv').textContent = sum.level; $('qLv').style.setProperty('--c', LVC[sum.level] || '#ffc76b'); $('qTitle').textContent = sum.title;
}
$('qbtn').onclick = async () => {
  if (!window.FugioPacks) return; sfx.click();
  const ids = await FugioPacks.open(PACKS, save.packs, { theme: 'gummy', kicker: 'CHOOSE THE QUESTIONS' });
  if (ids && ids.length) { save.packs = ids; store(); usedQ.clear(); showPack(); }
};
showPack();
showIsle(save.isle, true); refreshHeroes();
$('loading').remove();

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; let dt = Math.min(.033, raw); last = now;
  if (raw < .5) watchSpeed(raw);
  if (state === 'menu') { T += dt; U.time.value = T; menuFrame(dt); post.render(menuScene, mcam); return; }
  if (FEEL.stop > 0) { FEEL.stop -= Math.min(raw, .1); dt = 0; } else if (FEEL.slow > 0) { FEEL.slow -= dt; dt *= .3; }
  T += dt; U.time.value = T;
  if (state === 'play' && dt > 0) step(dt);
  feelFrame(dt);
  drawPlayer(); placeCamera(dt); updateNums(dt); updateHud();
  if (state !== 'play') for (const e of enemies) placeBar(e);
  if (env) animEnv(dt);
  post.render(scene, cam);
}
requestAnimationFrame(frame);

const fillAnswer = () => $('quizCard').dataset.right;
// hooks for automatic tests
window.AI = {
  get state() { return state; }, get room() { return room; }, P, run, enemies, save, ISLES,
  start: (i = 0) => startRun(i), menu: toMenu,
  killAll: () => { for (const e of enemies.slice()) hurtEnemy(e, 1e6, '#fff', true); },
  pick: (k = 0) => document.querySelectorAll('#skills .skill')[k]?.click(),
  god: () => { P.maxHp = P.hp = 1e6; },
  door: () => { if (room.open) nextRoom(); },
  plate: (right = true) => { const tr = room.trial; if (!tr || tr.busy) return; const p = tr.plates.find((o) => o.ok === right) || tr.plates[0]; P.x = p.x; P.z = p.z; p.armed = true; },
  answer: (right = true) => { const b = [...document.querySelectorAll('#opts button')]; const i = b.findIndex((x) => (x.textContent === fillAnswer()) === right); b[Math.max(0, i)]?.click(); setTimeout(() => $('quizGo').hidden || $('quizGo').click(), 50); },
  screen: (x, y, z) => toScreen(x, y, z),
  info: () => ({ ...stats, quality }),
  spawn: (t, x, z) => { const e = spawnEnemy(t, x, z); e.wait = 999; e.spawnT = .01; return true; },
  icon: () => { menu.icon = true; $('menu').hidden = true; },
  feel: () => ({ ...FEEL, rings: !!FX.ring }),
  chest: () => { if (room.chest) { P.x = room.chest.position.x; P.z = room.chest.position.z; } },
};
