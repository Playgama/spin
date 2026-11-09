// Playgama Boost slot machine: conference TV screen.
// Figma: Marketing / Confa / TV - 1 (6421:4871), 1920×1080. All sizes are the mockup's pixels.

import { qr } from './qr.js';

const STAGE_W = 1920;
const STAGE_H = 1080;
const COVER = 572; // cover side
const CORNER = 72; // cover corner radius
const GAP = 14; // gap between covers
const PITCH = COVER + GAP;
const REEL_X = [88, 674, 1259].map((x) => x + COVER / 2); // reel centres
const REEL_Y = 198 + COVER / 2; // the reel axis
const VIEW_H = 800; // = height of .reels, centred on the reel axis

// The machine is three drums on one shaft, seen by one camera in front of the middle drum.
// The front of the drums is drawn 1:1, so on the reel axis a cover is exactly where the mockup has it.
const DRUM_R = 470; // drum radius: a cover wraps COVER / DRUM_R radians of it
const CAM_K = 3.2; // camera distance from the reel axis, in drum radii
const DRUM_HALF = 290; // half width of a drum: the cover plus a 4px rim
const SHAFT_HALF = 870; // half length of the shaft that shows between the drums
const FADE_END = 0.35; // a drum is gone where it faces the camera by less than this (cosine)
// Where the faded-out edge of a drum lands on the screen: its scale and its height above the axis.
const EDGE_SCALE = (CAM_K - 1) / (CAM_K - FADE_END);
const EDGE_Y = DRUM_R * Math.sqrt(1 - FADE_END * FADE_END) * EDGE_SCALE;

const SLOTS = 9; // covers on a reel's belt: 3 on show + the 6 games of the coming spin
const BELT = SLOTS * PITCH;
const GAMES_PER_SPIN = 6;
const TEX = 800; // cover texture side; the covers are 800×800

// Spin choreography, in seconds and belt pixels. Each reel travels a fixed number of covers,
// so the timing never changes; the randomness is in which games sit on the belt.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TRAVEL = [12, 21, 30]; // every one lands LAND slots ahead of the cover it started on
const LAND = 3;
const STAGGER = 0.08;
const T_WIND = 0.2;
const T_ACCEL = 0.3;
const T_DECEL = 0.26;
const T_SETTLE = 0.7;
const SPEED = (9 * PITCH) / 0.55; // a reel stops 0.55 s after the one before it
const WIND = calm ? 0 : 0.1 * PITCH; // pull back before the launch
const OVERSHOOT = calm ? 0 : 0.11 * PITCH; // run past the stop, then spring back
const SPRING_W = 2 * Math.PI * 3.1;
const SPRING_Z = 0.4;
const SHUTTER = 0.85 / 60; // motion blur: the belt travel of 85% of a 60 Hz frame
const cruise = (i) => (TRAVEL[i] * PITCH + OVERSHOOT + WIND) / SPEED - (T_ACCEL + T_DECEL) / 2;
const STOP = TRAVEL.map((_, i) => i * STAGGER + T_WIND + T_ACCEL + cruise(i) + T_DECEL);
const REVEAL = STOP[2] + 0.18;
const SETTLE = STOP[2] + T_SETTLE;

const PRIZE = { 3: 100, 2: 50 }; // matching reels → players
const HOLD = { 0: 0, 50: 1.1, 100: 2 }; // seconds before the next spin may start
const PARTY = { 0: 0, 50: 1.4, 100: 3.6 }; // seconds the win animation runs
const FORCE = { jackpot: [0, 0, 0], pair: [0, 0, 1], none: [0, 1, 2] }; // test hook only

// The words under the reels: a headline and the line under it. A win's are made from its prize and game.
const WORDS = {
  idle: ['Spin the reels', 'to send players to a random game'],
  none: ['No match', 'Some game gets lucky next spin'],
};
const SAY_NONE = 4; // seconds "No match" stays before the invitation returns
const SAY_WIN = 60; // seconds a win and its QR code stay if nobody spins

// The QR code of a win leads a phone to share.html, which lies next to this page. A phone cannot
// open "localhost": if the slot is not served from a public address, put the public address of
// this folder here, like 'https://playgama.com/boost-slot/'.
const SHARE_BASE = '';

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

const shuffle = (list) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

// A library token as [r, g, b] in 0..1, whatever notation the token uses.
function tokenColor(name) {
  const probe = document.createElement('i');
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = getComputedStyle(probe).color;
  probe.remove();
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((byte) => byte / 255);
}

// ---------- Reel motion ----------

// Belt travel and speed of reel `i`, `t` seconds after it was launched.
function motion(i, t) {
  if (t <= 0) return [0, 0];
  if (t < T_WIND) {
    const s = Math.sin((Math.PI / 2) * (t / T_WIND));
    return [-WIND * s * s, 0];
  }
  t -= T_WIND;
  if (t < T_ACCEL) return [-WIND + (SPEED * t * t) / (2 * T_ACCEL), (SPEED * t) / T_ACCEL];
  t -= T_ACCEL;
  let off = -WIND + (SPEED * T_ACCEL) / 2;
  if (t < cruise(i)) return [off + SPEED * t, SPEED];
  t -= cruise(i);
  off += SPEED * cruise(i);
  if (t < T_DECEL) return [off + SPEED * t - (SPEED * t * t) / (2 * T_DECEL), SPEED * (1 - t / T_DECEL)];
  t -= T_DECEL;
  const end = TRAVEL[i] * PITCH;
  if (t >= T_SETTLE) return [end, 0];
  const wd = SPRING_W * Math.sqrt(1 - SPRING_Z * SPRING_Z);
  const swing = Math.exp(-SPRING_Z * SPRING_W * t) * (Math.cos(wd * t) + ((SPRING_Z * SPRING_W) / wd) * Math.sin(wd * t));
  return [end + OVERSHOOT * swing, 0];
}

// ---------- WebGL: three drums with the covers bent around them ----------

const canvas = document.getElementById('reels');
const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
if (!gl) throw new Error('The slot machine needs WebGL 2');
canvas.addEventListener('webglcontextlost', () => location.reload());

const VERTEX = `#version 300 es
layout(location = 0) in vec2 a_corner;
uniform vec2 u_half;
out vec2 v_pos;
void main() {
  v_pos = a_corner * u_half;
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec2 v_pos;            // stage px from the centre of the reel axis, y up
out vec4 o_color;

uniform sampler2DArray u_belt;
uniform float u_shaftPass; // 1: draw the shaft between the drums; 0: draw one drum
uniform float u_cx;       // drum centre, px from the stage centre
uniform float u_pos;      // belt position under the reel axis, px
uniform float u_blur;     // motion smear along the belt, px
uniform float u_dim;      // brightness: below 1 for a reel that did not match
uniform float u_glow;     // 0..1: win light of this reel
uniform float u_shine;    // where the light sweep is on the cover, in cover widths from its centre
uniform float u_seed;
uniform vec3 u_drum;
uniform vec3 u_shaft;
uniform vec3 u_hot;

const float R = ${DRUM_R.toFixed(1)};
const float K = ${CAM_K.toFixed(2)};
const float W = ${COVER.toFixed(1)};
const float PITCH = ${PITCH.toFixed(1)};
const float RAD = ${CORNER.toFixed(1)};
const float SLOTS = ${SLOTS.toFixed(1)};
const float DRUM_HALF = ${DRUM_HALF.toFixed(1)};
const float SHAFT_HALF = ${SHAFT_HALF.toFixed(1)};
const float FADE_END = ${FADE_END.toFixed(2)};
const float FRAME = 10.0;  // width of the light frame on a winning cover
const int TAPS = 12;

float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Glossy plastic, as a matcap: the look of a ball of it, read where the ball's surface tilts the way
// the drum's does. A drum turns one way only, so the ball's vertical cut is enough:
// m is -1 on the lower rim, 0 facing the viewer, 1 on the upper rim.
// x: the light on the colour underneath; y: the white gloss on top of it.
vec2 plastic(float m) {
  // Lit from above. No deeper than this: a drum has to stay lighter than the page all the way down.
  float light = 1.0 - 0.1 * smoothstep(0.5, 1.0, m) - 0.15 * (1.0 - smoothstep(-1.0, 0.1, m));
  // No lamp line: a sharp white strip across the covers read as a stripe, not as gloss.
  float sheen = exp(-12.0 * (m - 0.55) * (m - 0.55)); // the lamp overhead, as a wide soft glow with no edge
  float bounce = exp(-40.0 * (m + 0.7) * (m + 0.7));  // a fainter one off the floor
  float rim = m * m * m * m;                          // edge-on, plastic mirrors the room
  return vec2(light, 0.14 * sheen + 0.04 * bounce + 0.05 * rim);
}

void main() {
  // Ray from the camera through this pixel, hit against a cylinder along x. Lengths are in drum radii.
  float rho = mix(1.0, 0.975, u_shaftPass);
  vec2 s = v_pos / R;
  float f = K - 1.0;
  float a = s.y * s.y + f * f;
  float disc = K * K * f * f - a * (K * K - rho * rho);
  float t = (K * f - sqrt(max(disc, 0.0))) / a;
  vec3 p = vec3(s * t, K - f * t);

  // The drum turns away at its top and bottom: it fades into the background
  // well before its edge, so nothing is cut off.
  float facing = p.z / rho;
  float fade = smoothstep(FADE_END, 0.8, facing) * step(0.0, disc);

  // The same glossy plastic over the drums, the covers and the shaft. It follows the surface, not
  // the belt: how far the surface tilts up or down from the line of sight.
  vec2 sight = normalize(vec2(-p.y, K - p.z));
  vec2 gloss = plastic((p.y * sight.y - p.z * sight.x) / rho);

  float x = p.x * R - u_cx;             // across the drum, from its centre
  float ax = max(length(vec2(dFdx(x), dFdy(x))), 0.001);

  if (u_shaftPass > 0.5) {
    float body = clamp(0.5 - (abs(p.x * R) - SHAFT_HALF) / ax, 0.0, 1.0);
    o_color = vec4(mix(u_shaft * gloss.x, vec3(1.0), gloss.y), 1.0) * fade * body;
    return;
  }

  float belt = R * atan(p.y, p.z);      // along the belt: 0 on the reel axis, up is positive
  float ay = clamp(abs(dFdy(belt)), 0.001, 48.0);
  float body = clamp(0.5 - (abs(x) - DRUM_HALF) / ax, 0.0, 1.0);
  if (body * fade <= 0.0) {
    o_color = vec4(0.0);
    return;
  }

  int taps = u_blur > 1.5 ? TAPS : 1;
  float stride = u_blur / float(taps);
  float jitter = noise(gl_FragCoord.xy + u_seed) - 0.5;
  vec2 gx = vec2(0.75 * dFdx(x), 0.0) / W;
  vec2 gy = vec2(0.75 * dFdy(x), -max(0.75 * ay, stride)) / W;

  vec4 cover = vec4(0.0);  // premultiplied
  float sweep = 0.0;        // the light sweep's place on the cover under this pixel
  for (int i = 0; i < TAPS; i++) {
    if (i >= taps) break;
    float off = taps == 1 ? 0.0 : ((float(i) + 0.5 + jitter) / float(taps) - 0.5) * u_blur;
    float c = u_pos + belt + off;
    float slot = floor(c / PITCH + 0.5);
    float y = c - slot * PITCH;
    // Rounded rectangle of the cover, in belt space, so the corners bend with the drum.
    vec2 q = abs(vec2(x, y)) - (W * 0.5 - RAD);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - RAD;
    vec2 n = q.x > 0.0 && q.y > 0.0 ? normalize(q) : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
    float inside = clamp(0.5 - d / max(length(n * vec2(ax, ay)), 0.001), 0.0, 1.0);
    vec2 uv = vec2(x / W + 0.5, 0.5 - y / W);
    cover += textureGrad(u_belt, vec3(uv, mod(slot, SLOTS)), gx, gy) * inside;
    sweep += (x + 0.4 * y) / W;
  }
  cover /= float(taps);
  sweep /= float(taps);

  // A winning reel: the drum warms up, the cover brightens and a light sweeps across it.
  vec3 drum = mix(u_drum, u_hot, 0.5 * u_glow);
  float shine = 0.5 * exp(-60.0 * (sweep - u_shine) * (sweep - u_shine));
  vec3 lit = cover.rgb * (1.0 + 0.1 * u_glow) + cover.a * shine;
  vec3 color = mix((drum * (1.0 - cover.a) + lit) * gloss.x, vec3(1.0), gloss.y); // the gloss veils, it never burns out

  // The winning cover itself, the one on the reel axis, gets a frame of light and a glow around it.
  float centre = floor(u_pos / PITCH + 0.5);
  vec2 qc = abs(vec2(x, u_pos + belt - centre * PITCH)) - (W * 0.5 - RAD);
  float dc = length(max(qc, 0.0)) + min(max(qc.x, qc.y), 0.0) - RAD;
  float frame = smoothstep(-FRAME - 1.5, -FRAME + 1.5, dc) * (1.0 - smoothstep(-1.5, 1.5, dc));
  float aura = 0.8 * exp(-max(dc, 0.0) / 16.0) * step(0.0, dc);
  color = mix(color, u_hot, u_glow * max(frame, aura));

  o_color = vec4(color * u_dim, 1.0) * fade * body;
}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

const U = {};
for (const name of ['half', 'belt', 'shaftPass', 'cx', 'pos', 'blur', 'dim', 'glow', 'shine', 'seed', 'drum', 'shaft', 'hot']) {
  U[name] = gl.getUniformLocation(program, `u_${name}`);
}
gl.uniform2f(U.half, STAGE_W / 2, VIEW_H / 2);
gl.uniform1i(U.belt, 0);
// One step lighter than the page (purple-400) in the dark theme.
gl.uniform3fv(U.drum, tokenColor('--color-purple-500'));
gl.uniform3fv(U.shaft, tokenColor('--color-purple-100'));
gl.uniform3fv(U.hot, tokenColor('--slot-yellow'));

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0, 0, 0, 0);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

// One texture array per reel: layer n is the cover in belt slot n.
function beltTexture() {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(TEX)) + 1, gl.RGBA8, TEX, TEX, SLOTS);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (anisotropy) {
    const max = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, max));
  }
  return texture;
}

// `center` is the belt slot on the reel axis while the reel rests; `games` is the game in each slot.
const reels = REEL_X.map(() => ({ texture: beltTexture(), center: 1, games: new Array(SLOTS).fill(-1), hit: false }));

// ---------- Game state ----------

let covers = []; // manifest: the sandbox's top 100 by total time spent
let deck = []; // shuffled bag of cover indices, so every game shows up before any repeats
let phase = 'loading'; // loading → idle → spinning → result → idle
let ready = false; // the belts hold the games of the coming spin
let queued = false; // a spin was asked for before the belts were ready
let next = null; // { targets }: the game each reel will stop on
let result = null; // { prize, reels, game, shown } of the current spin
let spinStart = 0;
let revealAt = 0;
let idleAt = 0;
let frame = 0;
let lastFrame = 0;
let stepping = false; // test hook: the clock is driven by hand

function deal(count) {
  if (deck.length < count) deck = shuffle([...covers.keys()]);
  return deck.splice(0, count);
}

function judge(targets) {
  const same = [[0, 1, 2], [0, 1], [1, 2], [0, 2]].find((group) => group.every((i) => targets[i] === targets[group[0]]));
  return { prize: same ? PRIZE[same.length] : 0, reels: same || [], game: same ? targets[same[0]] : -1, shown: false };
}

// ---------- Covers → textures ----------

const scratch = document.createElement('canvas');
scratch.width = scratch.height = TEX;
const scratchCtx = scratch.getContext('2d');

// Let the browser draw a frame. A message, not a timer: timers slow to one a second in a background tab.
const nextTask = () => new Promise((done) => {
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = done;
  port2.postMessage(0);
});

// `places` maps a game to the [reel, slot] pairs that show it.
// The covers decode together; the uploads go one per task, so a running animation keeps its frames.
async function paint(places) {
  // createImageBitmap, not Image.decode(): decode() waits for the page to be on screen.
  const images = [...places.keys()].map((game) =>
    fetch(`assets/covers/${covers[game].file}`)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
      .catch(() => null),
  );
  let n = 0;
  for (const list of places.values()) {
    const image = await images[n++];
    if (!image) throw new Error('A cover did not load');
    await nextTask();
    const side = Math.min(image.width, image.height);
    scratchCtx.clearRect(0, 0, TEX, TEX);
    scratchCtx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, TEX, TEX);
    image.close();
    for (const [reel, slot] of list) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, reels[reel].texture);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slot, TEX, TEX, 1, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    }
  }
  for (const reel of reels) {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, reel.texture);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }
}

// Pick the six games of the coming spin and where each reel will stop, then put them on the belts.
// Every reel stops on one of the six with equal chance, independently of the others.
// The three covers on show stay; the six slots behind the drum get the new games.
async function prepare(force) {
  ready = false;
  const six = deal(GAMES_PER_SPIN);
  const targets = force ? FORCE[force].map((n) => six[n]) : reels.map(() => six[Math.floor(Math.random() * six.length)]);
  const places = new Map(six.map((game) => [game, []]));
  reels.forEach((reel, r) => {
    const others = shuffle(six.filter((game) => game !== targets[r]));
    for (let step = 2; step <= 7; step++) {
      const slot = (reel.center + step) % SLOTS;
      const game = step === LAND ? targets[r] : others.pop();
      reel.games[slot] = game;
      places.get(game).push([r, slot]);
    }
  });
  try {
    await paint(places);
  } catch {
    // A cover did not load or decode: deal other games instead of leaving the machine stuck.
    await new Promise((done) => setTimeout(done, 1000));
    return prepare(force);
  }
  next = { targets };
  ready = true;
  if (queued) {
    queued = false;
    spin();
  }
}

// ---------- Sound (generated with ElevenLabs) ----------

const audio = new (window.AudioContext || window.webkitAudioContext)();
const muted = new URLSearchParams(location.search).has('mute'); // open the page with ?mute for a silent test run
const sounds = {};
let whirr = null;

for (const name of ['lever-start', 'spin-loop', 'reel-stop', 'win-small', 'win-jackpot', 'coins']) {
  fetch(`assets/sounds/${name}.mp3`)
    .then((response) => response.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .then((buffer) => { sounds[name] = buffer; });
}

function play(name, { gain = 1, rate = 1, loop = false, delay = 0 } = {}) {
  if (muted || !sounds[name]) return null;
  const source = audio.createBufferSource();
  const volume = audio.createGain();
  source.buffer = sounds[name];
  source.loop = loop;
  source.playbackRate.value = rate;
  volume.gain.value = gain;
  source.connect(volume).connect(audio.destination);
  source.start(audio.currentTime + delay);
  return { source, volume };
}

// ---------- Win animation ----------

const stage = document.getElementById('stage');
const prizeEl = document.getElementById('prize');
const marquee = document.getElementById('marquee');
const rays = document.getElementById('rays').getContext('2d');
const fx = document.getElementById('fx').getContext('2d');
const white = getComputedStyle(document.documentElement).getPropertyValue('--color-white').trim();
const yellow = getComputedStyle(document.documentElement).getPropertyValue('--slot-yellow').trim();
let confetti = [];
let sparks = [];
let boosted = false;
let raysOn = false;
let stageScale = 1;

// A jackpot's beams of light: two sets that turn against each other, wide and thin. `turn` is in
// radians a second, `width` is half a beam's width as a share of the angle between two beams, and
// `lights` are the beams' brightnesses in turn. The canvas is a quarter of the window's size and the
// browser stretches it: that is what makes the beams soft.
const RAYS_RES = 0.25;
const BEAMS = [
  { count: 7, turn: 0.1, width: 0.16, lights: [1, 0.55, 0.8] },
  { count: 11, turn: -0.07, width: 0.07, lights: [0.7, 1, 0.45, 0.85] },
];
const warm = tokenColor('--slot-yellow').map((part) => Math.round(part * 255)).join(' ');

for (let n = 0; n < 20; n++) {
  marquee.insertAdjacentHTML(
    'beforeend',
    '<img class="marquee__boost" src="assets/strip/boost.svg" alt=""><img class="marquee__logo" src="assets/strip/playgama-pill.svg" alt="">',
  );
}

function marqueeRate(rate) {
  boosted = rate !== 1;
  marquee.getAnimations()[0]?.updatePlaybackRate(rate);
}

const beat = (t, period, count) => (t < 0 || t >= period * count ? 0 : Math.sin((Math.PI * (t % period)) / period) ** 2);

// ---------- Words under the reels ----------

const noteEl = document.getElementById('note');
const qrEl = document.getElementById('qr');
let sayTimer = 0;
let shareUrl = '';

// Put up a headline and the line under it, or nothing. `mood` is "is-win" (with "is-jackpot")
// for a prize: only a prize gets the pop and the QR code.
function say(headline = '', note = '', mood = '') {
  clearTimeout(sayTimer);
  prizeEl.textContent = headline;
  prizeEl.className = headline ? `prize is-on ${mood}` : 'prize';
  noteEl.textContent = note;
  noteEl.classList.toggle('is-on', Boolean(note));
  qrEl.classList.toggle('is-on', Boolean(mood));
}

// Back to the invitation. The light of the last win goes out with its words.
function invite() {
  if (phase === 'idle' && result) {
    result = null;
    kick();
  }
  say(...WORDS.idle);
}

// Draw the QR code of the page where the winner shares a ready post: which game got players, and how many.
function share(game, prize) {
  const url = new URL('share.html', SHARE_BASE || location.href);
  url.search = new URLSearchParams({ g: covers[game].id, p: prize });
  shareUrl = url.href;
  const code = qr(shareUrl);
  let path = '';
  code.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  }));
  qrEl.setAttribute('viewBox', `0 0 ${code.length + 8} ${code.length + 8}`);
  qrEl.firstElementChild.setAttribute('d', path);
}

// What the win does to reel `i`, `t` seconds after the result was shown: [brightness, glow, shine, nudge].
// A matching reel lights up, pulses, gets a light sweep and rocks on its axis; the light then stays on
// until the next spin. In a pair the odd reel goes dim. The jackpot runs the same along all three, longer.
function celebrate(i, t) {
  if (!result?.shown || !result.prize || t < 0) return [1, 0, 9, 0];
  if (!result.reels.includes(i)) return [1 - 0.5 * clamp01(t / 0.25), 0, 9, 0];
  if (calm) return [1, 0.6, 9, 0];
  const jackpot = result.prize === 100;
  const lag = jackpot ? i * 0.09 : 0;
  const pulse = jackpot ? beat(t - 0.05 - lag, 0.625, 5) : beat(t - 0.05, 0.45, 2);
  const glow = clamp01(t / 0.12) * (0.55 + 0.45 * pulse);
  const sweep = jackpot && t < PARTY[100] ? (t - lag) % 1.2 : t - lag;
  const shine = sweep >= 0 && sweep < 0.6 ? -1.3 + (sweep / 0.6) * 2.6 : 9;
  const nudge = 10 * Math.sin(2 * Math.PI * 3 * t) * Math.exp(-3 * t);
  return [1, glow, shine, nudge];
}

function burstConfetti() {
  const css = getComputedStyle(document.documentElement);
  const colors = ['--color-electric-lime', '--color-golden-400', '--slot-yellow', '--color-white'].map((name) => css.getPropertyValue(name).trim());
  for (let n = 0; n < 160; n++) {
    const side = n % 2 ? 1 : -1; // two cannons, one in each bottom corner
    const angle = 0.2 + Math.random() * 0.75;
    const speed = 1500 + Math.random() * 1300;
    confetti.push({
      x: STAGE_W / 2 + side * (STAGE_W / 2 + 20),
      y: STAGE_H + 20,
      vx: -side * Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      w: 12 + Math.random() * 12,
      h: 7 + Math.random() * 6,
      turn: Math.random() * 6.28,
      turnSpeed: (Math.random() - 0.5) * 16,
      flip: Math.random() * 6.28,
      flipSpeed: 6 + Math.random() * 8,
      color: colors[n % colors.length],
    });
  }
}

// Sparks fly off the edge of a winning cover.
function burstSparks(i, count) {
  for (let n = 0; n < count; n++) {
    const angle = Math.random() * 6.28;
    const speed = 260 + Math.random() * 620;
    sparks.push({
      x: REEL_X[i] + Math.cos(angle) * COVER * 0.46,
      y: REEL_Y + Math.sin(angle) * COVER * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120,
      size: 7 + Math.random() * 13,
      life: 0,
      span: 0.55 + Math.random() * 0.6,
      color: n % 3 ? yellow : white,
    });
  }
}

function drawFx(dt) {
  fx.clearRect(0, 0, STAGE_W, STAGE_H);
  confetti = confetti.filter((bit) => bit.y < STAGE_H + 60 || bit.vy < 0);
  for (const bit of confetti) {
    bit.vy += 1900 * dt;
    bit.vx *= Math.exp(-1.2 * dt);
    bit.vy *= Math.exp(-0.6 * dt);
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.turn += bit.turnSpeed * dt;
    bit.flip += bit.flipSpeed * dt;
    fx.save();
    fx.translate(bit.x, bit.y);
    fx.rotate(bit.turn);
    fx.scale(1, Math.cos(bit.flip));
    fx.fillStyle = bit.color;
    fx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
    fx.restore();
  }
  sparks = sparks.filter((spark) => spark.life < spark.span);
  for (const spark of sparks) {
    spark.life += dt;
    spark.vx *= Math.exp(-2.2 * dt);
    spark.vy = spark.vy * Math.exp(-2.2 * dt) + 260 * dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    const size = spark.size * Math.sin(Math.PI * clamp01(spark.life / spark.span)); // a four-point star that swells and dies
    fx.fillStyle = spark.color;
    fx.beginPath();
    fx.moveTo(spark.x, spark.y - size);
    fx.quadraticCurveTo(spark.x, spark.y, spark.x + size, spark.y);
    fx.quadraticCurveTo(spark.x, spark.y, spark.x, spark.y + size);
    fx.quadraticCurveTo(spark.x, spark.y, spark.x - size, spark.y);
    fx.quadraticCurveTo(spark.x, spark.y, spark.x, spark.y - size);
    fx.fill();
  }
}

// Jackpot only: soft beams of light turn slowly behind the drums and run off past the edges of the window.
function drawRays(t) {
  const strength = clamp01(t / 0.3) * clamp01((PARTY[100] - t) / 0.6);
  if (strength <= 0 && !raysOn) return;
  raysOn = strength > 0;
  const { width, height } = rays.canvas;
  rays.clearRect(0, 0, width, height);
  if (!raysOn) return;
  const x = width / 2;
  const y = height / 2 + (REEL_Y - STAGE_H / 2) * stageScale * RAYS_RES; // the reels' axis, in the canvas's pixels
  const reach = 1.2 * Math.hypot(x, Math.max(y, height - y)); // past the farthest corner of the window
  const light = rays.createRadialGradient(x, y, 0, x, y, reach);
  light.addColorStop(0, `rgb(${warm} / 0.05)`); // warm at the drums, white and gone far away
  light.addColorStop(0.4, 'rgb(255 255 255 / 0.025)');
  light.addColorStop(1, 'rgb(255 255 255 / 0)');
  rays.fillStyle = light;
  for (const beams of BEAMS) {
    const between = (2 * Math.PI) / beams.count;
    for (let n = 0; n < beams.count; n++) {
      const middle = t * beams.turn + n * between;
      rays.globalAlpha = strength * beams.lights[n % beams.lights.length];
      // Five wedges, one inside another: bright along the middle of the beam, fading to its sides.
      for (let layer = 1; layer <= 5; layer++) {
        const half = (beams.width * between * layer) / 5;
        rays.beginPath();
        rays.moveTo(x, y);
        rays.arc(x, y, reach, middle - half, middle + half);
        rays.fill();
      }
    }
  }
}

// ---------- Spin ----------

function spin() {
  if (phase !== 'idle') return;
  if (!ready) {
    queued = true;
    return;
  }
  audio.resume();
  ready = false;
  result = judge(next.targets);
  for (const reel of reels) reel.hit = false;
  say();
  if (boosted) marqueeRate(1);
  phase = 'spinning';
  spinStart = performance.now();
  play('lever-start', { gain: 0.7 });
  whirr = play('spin-loop', { gain: 0.5, loop: true, delay: T_WIND });
  kick();
}

// Reel `i` hit its stop `late` seconds ago.
function onStop(i, late) {
  if (late < 0.25) play('reel-stop', { gain: 0.8, rate: 1 + i * 0.05 + (Math.random() - 0.5) * 0.04 });
  if (!whirr) return;
  if (i < 2) {
    whirr.volume.gain.setTargetAtTime([0.36, 0.22][i], audio.currentTime, 0.04);
  } else {
    whirr.volume.gain.setTargetAtTime(0, audio.currentTime, 0.03);
    whirr.source.stop(audio.currentTime + 0.2);
    whirr = null;
  }
}

// Only a real win is celebrated: a spin with no match gets a plain line and no sound.
function reveal(now, late) {
  result.shown = true;
  revealAt = now - late * 1000;
  if (!result.prize) {
    say(...WORDS.none);
    sayTimer = setTimeout(invite, SAY_NONE * 1000);
    return;
  }
  const jackpot = result.prize === 100;
  share(result.game, result.prize);
  say(`+${result.prize} players`, `for ${covers[result.game].title}`, jackpot ? 'is-win is-jackpot' : 'is-win');
  sayTimer = setTimeout(invite, SAY_WIN * 1000);
  if (late < 0.25) {
    if (jackpot) {
      play('win-jackpot', { gain: 0.9 });
      play('coins', { gain: 0.5, delay: 0.35 });
    } else {
      play('win-small', { gain: 0.8 });
    }
  }
  if (calm) return;
  for (const i of result.reels) burstSparks(i, jackpot ? 34 : 22);
  if (jackpot) {
    burstConfetti();
    marqueeRate(3);
  }
}

function land() {
  reels.forEach((reel, i) => { reel.center = (reel.center + TRAVEL[i]) % SLOTS; });
  phase = 'result';
  idleAt = revealAt + HOLD[result.prize] * 1000;
  prepare();
}

function render(now) {
  const t = (now - spinStart) / 1000;
  const party = (now - revealAt) / 1000;
  const k = canvas.width / STAGE_W;
  // Draw only the box a drum can reach: from `left` to `right`, px from the stage centre.
  const box = (left, right) => {
    const y = Math.floor(canvas.height / 2 - (EDGE_Y + 2) * k);
    gl.scissor(Math.floor((STAGE_W / 2 + left - 2) * k), y, Math.ceil((right - left + 4) * k), canvas.height - 2 * y);
  };
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.SCISSOR_TEST);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, reels[0].texture);
  gl.uniform1f(U.shaftPass, 1);
  box(-SHAFT_HALF, SHAFT_HALF);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.uniform1f(U.shaftPass, 0);
  reels.forEach((reel, i) => {
    const [off, speed] = phase === 'spinning' ? motion(i, t - i * STAGGER) : [0, 0];
    const [dim, glow, shine, nudge] = celebrate(i, party);
    const pos = (((reel.center * PITCH + off + nudge) % BELT) + BELT) % BELT;
    // The drum's far edges sit closer to the stage centre than its front ones.
    const left = REEL_X[i] - STAGE_W / 2 - DRUM_HALF;
    const right = left + 2 * DRUM_HALF;
    box(Math.min(left, left * EDGE_SCALE), Math.max(right, right * EDGE_SCALE));
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, reel.texture);
    gl.uniform1f(U.cx, REEL_X[i] - STAGE_W / 2);
    gl.uniform1f(U.pos, pos);
    gl.uniform1f(U.blur, Math.min(Math.abs(speed) * SHUTTER, 0.55 * PITCH));
    gl.uniform1f(U.dim, dim);
    gl.uniform1f(U.glow, glow);
    gl.uniform1f(U.shine, shine);
    gl.uniform1f(U.seed, (now % 1000) * 0.618);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });
}

function tick(now) {
  frame = 0;
  if (phase === 'spinning') {
    const t = (now - spinStart) / 1000;
    reels.forEach((reel, i) => {
      if (reel.hit || t < STOP[i]) return;
      reel.hit = true;
      onStop(i, t - STOP[i]);
    });
    if (!result.shown && t >= REVEAL) reveal(now, t - REVEAL);
    if (t >= SETTLE) land();
  }
  if (phase === 'result' && now >= idleAt) phase = 'idle';
  const party = result?.shown ? (now - revealAt) / 1000 : Infinity;
  const jackpot = result?.shown && result.prize === 100 && !calm;
  if (boosted && party > 3.2) marqueeRate(1);
  // The jackpot lands with a short shake of the whole stage.
  const shaking = jackpot && party >= 0 && party < 0.5;
  const shake = shaking ? Math.exp(-7 * party) : 0;
  stage.style.setProperty('--shake-x', `${(shaking ? 8 * shake * Math.sin(55 * party) : 0).toFixed(2)}px`);
  stage.style.setProperty('--shake-y', `${(shaking ? 5 * shake * Math.cos(47 * party) : 0).toFixed(2)}px`);
  render(now);
  drawRays(jackpot ? party : Infinity);
  drawFx(Math.min((now - lastFrame) / 1000, 1 / 30));
  lastFrame = now;
  const partying = result && party < PARTY[result.prize];
  if (phase === 'spinning' || phase === 'result' || confetti.length || sparks.length || partying) kick();
}

function kick() {
  if (!frame && !stepping) frame = requestAnimationFrame(tick);
}

// ---------- Stage ----------

function fit() {
  const scale = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  document.documentElement.style.setProperty('--slot-scale', scale);
  stageScale = scale;
  rays.canvas.width = Math.ceil(innerWidth * RAYS_RES);
  rays.canvas.height = Math.ceil(innerHeight * RAYS_RES);
  const k = Math.min(Math.max(scale * devicePixelRatio, 0.25), 2);
  canvas.width = Math.round(STAGE_W * k);
  canvas.height = Math.round(VIEW_H * k);
  render(performance.now());
}

addEventListener('resize', fit);
addEventListener('pointerdown', (event) => {
  if (event.button === 0) spin();
});
addEventListener('keydown', (event) => {
  if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return;
  event.preventDefault();
  spin();
});

async function start() {
  fit();
  // In a folder of a site the library's own address of the font is empty (see slot.css): that miss is expected.
  document.fonts.load('400 156px CalSans').catch(() => {});
  // Never a remembered copy of the list: after the set of games changes, an old list names files that are gone.
  covers = await (await fetch('assets/covers/covers.json', { cache: 'no-cache' })).json();
  const places = new Map();
  reels.forEach((reel, r) => {
    deal(3).forEach((game, slot) => {
      reel.games[slot] = game;
      places.set(game, [[r, slot]]);
    });
  });
  await paint(places);
  await prepare();
  render(performance.now());
  canvas.hidden = false; // shown only now, so the drums never appear without their covers
  phase = 'idle';
  invite();
}

start();

// Test hook: read the state, fix the next outcome, and step the clock by hand.
window.__slot = {
  get state() {
    return {
      phase,
      ready,
      result,
      next,
      titles: reels.map((reel) => covers[reel.games[reel.center]]?.title),
      words: [prizeEl.textContent, noteEl.textContent],
      share: qrEl.classList.contains('is-on') ? shareUrl : '',
      audio: audio.state,
      muted,
      sounds: Object.keys(sounds).length,
    };
  },
  timing: { STOP, REVEAL, SETTLE },
  prepare,
  spin,
  step(seconds) {
    stepping = true;
    cancelAnimationFrame(frame);
    frame = 0;
    tick(spinStart + seconds * 1000);
  },
  resume() {
    stepping = false;
    kick();
  },
};
