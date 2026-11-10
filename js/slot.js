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
// so the timing is the same every spin, but for the third reel's anticipation (below); the randomness
// is in which games sit on the belt.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TRAVEL = [21, 30, 39]; // every one lands LAND slots ahead of the cover it started on
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

// Anticipation. When the first two reels stop on the same game, the third does not stop on time: it
// makes one more turn of its belt and slows all the way, so its last covers pass one by one. The spin
// is a win either way: the pair is already there, and the third reel decides between +50 and +100.
const TEASE_AT = STOP[1] - 2 * STAGGER + 0.12; // on the third reel's own clock: a beat after the second has stopped
const TEASE_TRAVEL = TRAVEL[2] + SLOTS;
const TEASE_EASE = 2.5; // how hard it slows: its speed falls as (time left) ^ 1.5
const TEASE_FROM = -WIND + (SPEED * T_ACCEL) / 2 + SPEED * (TEASE_AT - T_WIND - T_ACCEL); // belt travel by then
const TEASE_RUN = TEASE_TRAVEL * PITCH + OVERSHOOT - TEASE_FROM;
const TEASE_TIME = (TEASE_EASE * TEASE_RUN) / SPEED; // so the slowing starts at the speed the reel has

const PRIZE = { 3: 100, 2: 50 }; // matching reels → players
const HOLD = { 0: 0, 50: 1.2, 100: 2 }; // seconds before the next spin may start: the prize has landed by then
const COUNT = { 50: 1, 100: 1.8 }; // seconds a prize counts up from zero before it lands
const STEPS = { 50: 16, 100: 30 }; // steps of that count; each has its own tick and its own light
const PARTY = { 0: 0, 50: 3, 100: 6.8 }; // seconds the win animation runs
const FORCE = { jackpot: [0, 0, 0], pair: [0, 0, 1], none: [0, 1, 2] }; // which of the six games each reel stops on; a real pair takes one of PAIRS

// The words under the reels: a headline and the line under it. A win's are made from its prize and game.
const WORDS = {
  idle: ['Spin the reels', 'to send players to a random game'],
  none: ['No match', 'Some game gets lucky next spin'],
};
const SAY_NONE = 4; // seconds "No match" stays before the invitation returns
const SAY_WIN = 60; // seconds a win and its QR code stay if nobody spins

// Attract mode. Once the invitation is back and nobody spins for LURE_EVERY seconds, the reels move by
// themselves, a cycle starting every LURE_EVERY seconds: a spin, then a scene (see SCENES), then a spin again.
// An attract spin is quieter, never to a match, and touches neither the prize count nor the outcome
// waiting for the next real spin. Soft beams turn behind the drums, a light runs
// across the reels, and each attract spin brings a new line of invitation.
const LURE_EVERY = 7;
const LURE_VOLUME = 0.35; // of an attract spin's sounds
const LURE_RAYS = 2.6; // the beams' strength, of a jackpot's: above 1 the light itself gets brighter
const LURES = [
  ['Feeling lucky?', 'Press the button and spin the reels'],
  ['Spin me!', 'Match two and a game gets +50 players'],
  ['Hit the jackpot', 'Three in a row: +100 players for a game'],
  ['Your turn', 'One press sends real players to a game'],
];

// While the reels turn, the line under them says something a web gamer would: one quip a spin, in
// the size of the game's name under a win. A second set is for the moment two reels have matched.
const QUIPS = [
  'Insert coin',
  "Let's gooo",
  'GG or no GG?',
  'RNG, be nice',
  'Any% speedrun',
  'Big brain time',
  'Achievement unlocked: spinning',
  'Respawning players…',
  'Loading… 99%',
  'Press F to boost',
  'Clutch or kick',
  'Combo incoming',
  'One more spin',
  'Not a bug, a feature',
  'Touch grass later',
  'Skill issue? Never.',
  'Rare drop loading',
  'No cap, pure luck',
  'Headshot! Wait, wrong game',
  'Rolling… please hold',
];
const TEASE_QUIPS = ['Two of a kind. One to go.', 'Hold your breath', 'Come on, third reel'];
let lastQuip = '';
function quip(list) {
  let pick = list[Math.floor(Math.random() * list.length)];
  if (pick === lastQuip) pick = list[(list.indexOf(pick) + 1) % list.length];
  lastQuip = pick;
  return pick;
}

// The QR code of a win leads a phone to share.html, which lies next to this page. A phone cannot
// open "localhost": if the slot is not served from a public address, put the public address of
// this folder here, like 'https://playgama.com/boost-slot/'.
const SHARE_BASE = 'https://playgama.github.io/spin/';

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

// Belt travel and speed of reel `i`, `t` seconds after it was launched. `teased` is the third reel
// of a spin with anticipation; `skip` is the seconds of full speed it leaves out (see slam).
function motion(i, t, teased = false, skip = 0) {
  if (t <= 0) return [0, 0];
  let end = TRAVEL[i] * PITCH;
  if (teased && t >= TEASE_AT) {
    t -= TEASE_AT;
    if (t < TEASE_TIME) {
      const left = 1 - t / TEASE_TIME;
      return [TEASE_FROM + TEASE_RUN * (1 - left ** TEASE_EASE), SPEED * left ** (TEASE_EASE - 1)];
    }
    t -= TEASE_TIME;
    end = TEASE_TRAVEL * PITCH;
  } else {
    if (t < T_WIND) {
      const s = Math.sin((Math.PI / 2) * (t / T_WIND));
      return [-WIND * s * s, 0];
    }
    t -= T_WIND;
    if (t < T_ACCEL) return [-WIND + (SPEED * t * t) / (2 * T_ACCEL), (SPEED * t) / T_ACCEL];
    t -= T_ACCEL;
    let off = -WIND + (SPEED * T_ACCEL) / 2;
    const run = cruise(i) - skip;
    if (t < run) return [off + SPEED * t, SPEED];
    t -= run;
    off += SPEED * run;
    if (t < T_DECEL) return [off + SPEED * t - (SPEED * t * t) / (2 * T_DECEL), SPEED * (1 - t / T_DECEL)];
    t -= T_DECEL;
  }
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
uniform float u_zoom;     // the drum's size: above 1 it leans out at the viewer, below 1 it steps back
uniform float u_pos;      // belt position under the reel axis, px
uniform float u_blur;     // motion smear along the belt, px
uniform float u_dim;      // brightness: below 1 for a reel that did not match
uniform float u_body;     // 1: the drum under the covers is there; 0: only the covers are
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
  vec2 s = (vec2(u_cx, 0.0) + (v_pos - vec2(u_cx, 0.0)) / u_zoom) / R;
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
  float solid = mix(cover.a, 1.0, u_body); // without its drum a reel is only as solid as its covers
  vec3 color = mix((drum * (1.0 - cover.a) * u_body + lit) * gloss.x, vec3(solid), gloss.y); // the gloss veils, it never burns out

  // The winning cover itself, the one on the reel axis, gets a frame of light and a glow around it.
  float centre = floor(u_pos / PITCH + 0.5);
  vec2 qc = abs(vec2(x, u_pos + belt - centre * PITCH)) - (W * 0.5 - RAD);
  float dc = length(max(qc, 0.0)) + min(max(qc.x, qc.y), 0.0) - RAD;
  float frame = smoothstep(-FRAME - 1.5, -FRAME + 1.5, dc) * (1.0 - smoothstep(-1.5, 1.5, dc));
  float aura = 0.8 * exp(-max(dc, 0.0) / 16.0) * step(0.0, dc);
  color = mix(color, u_hot, u_glow * max(frame, aura));

  o_color = vec4(color * u_dim, solid) * fade * body;
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
for (const name of ['half', 'belt', 'shaftPass', 'cx', 'zoom', 'pos', 'blur', 'dim', 'body', 'glow', 'shine', 'seed', 'drum', 'shaft', 'hot']) {
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
let result = null; // { prize, reels, game, shown } of the current spin; a win adds { beats, lights, landed, rain }
let tease = false; // this spin has anticipation: the first two reels match
let teased = false; // the anticipation's quip is up
let plan = { stop: STOP, reveal: REVEAL, settle: SETTLE }; // when this spin's reels stop, in seconds
let skip = [0, 0, 0]; // seconds of full speed each reel leaves out this spin (see slam)
let pending = null; // { outcome, game, force } of the coming spin: drawn once, laid on the belts again after an attract spin
let luring = false; // attract mode is on
let lureTimer = 0;
let lureCount = 0; // attract cycles so far: spin, scene, spin, scene…
let sceneBag = []; // the scenes still to come
let lureLight = 0; // attract mode's light, fading in and out: 0…1
let antic = null; // the attract scene on stage: { scene, start, sounds }
let carry = null; // { at, pose }: the pose a press cut a scene at; it melts away under the spin
let spinStart = 0;
let revealAt = 0;
let idleAt = 0;
let frame = 0;
let lastFrame = 0;
let stepping = false; // test hook: the clock is driven by hand

// `skip`: a game already on this spin (its winner), not to be dealt twice.
function deal(count, skip = -1) {
  deck = deck.filter((game) => game !== skip);
  if (deck.length < count) deck = shuffle([...covers.keys()].filter((game) => game !== skip));
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

// How often a spin wins: out of every 12 spins, one gives +100, three give +50, eight give nothing.
// The outcomes are drawn from a shuffled bag of those 12, not rolled one by one, so there are no long
// droughts and no runs; and two wins never come one right after the other.
const BAG = { jackpot: 1, pair: 3, none: 8 };
const PAIRS = [[0, 0, 1], [1, 0, 0], [0, 1, 0]]; // which two reels match, with one of the six games each
const PRIZE_OF = { jackpot: 100, pair: 50 };

// No game gets more than CAP players. So that every game reaches it exactly, each one has a plan of
// prizes from the start: 60% of the games get +100 and +50, the others +50 three times. With one
// jackpot to three pairs in the bag that uses every prize: 100 games × 150 players = 15,000 players,
// given out in 60 bags = 720 spins. After that a spin gives nothing.
// The plan, the players given so far and the bag are kept in the browser, so a reload of the page
// does not start them over. Open the page with ?reset to start over (before the event, say).
const CAP = 150;
const STORE = 'boost-slot';
let ledger = null; // { games, plan: { id: [prizes still to come] }, given: { id: players }, bag, lastWon, lastGame }

function keep() {
  try { localStorage.setItem(STORE, JSON.stringify(ledger)); } catch { /* private mode: it lasts until a reload */ }
}

function openLedger() {
  const games = covers.map((cover) => cover.id).join(' ');
  try {
    if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(STORE);
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved?.games === games) ledger = saved; // a different set of games starts over
  } catch { /* no storage: start over */ }
  if (ledger) return;
  // n games get +100 +50 and the other N − n get +50 three times: n jackpots and 3N − 2n pairs, one to three when n = 0.6 N.
  const big = Math.round(covers.length * 0.6);
  const plan = {};
  shuffle(covers.map((cover) => cover.id)).forEach((id, i) => { plan[id] = i < big ? [100, 50] : [50, 50, 50]; });
  ledger = { games, plan, given: {}, bag: [], lastWon: false, lastGame: '' };
  keep();
}

function draw() {
  const win = (outcome) => outcome !== 'none';
  while (!ledger.bag.length) {
    const deck = shuffle(Object.entries(BAG).flatMap(([outcome, count]) => Array(count).fill(outcome)));
    // Drawn from the end: no two wins side by side, nor a win first after a win.
    if (deck.every((outcome, i) => !(win(outcome) && win(deck[i + 1] ?? 'none'))) && !(ledger.lastWon && win(deck.at(-1)))) ledger.bag = deck;
  }
  const outcome = ledger.bag.pop();
  ledger.lastWon = win(outcome);
  keep();
  return outcome;
}

// Which game a win goes to: one whose plan still has that prize, not the last winner if another can
// take it. A jackpot no game can take becomes a pair; a pair no game can take, nothing.
function award(outcome) {
  for (const take of outcome === 'jackpot' ? ['jackpot', 'pair'] : outcome === 'pair' ? ['pair'] : []) {
    const can = covers.flatMap((cover, game) => (ledger.plan[cover.id].includes(PRIZE_OF[take]) ? [game] : []));
    const fresh = can.filter((game) => covers[game].id !== ledger.lastGame);
    const pool = fresh.length ? fresh : can;
    if (pool.length) return { outcome: take, game: pool[Math.floor(Math.random() * pool.length)] };
  }
  return { outcome: 'none', game: -1 };
}

// A win is given when it is shown.
function credit(game, prize) {
  const id = covers[game].id;
  const plan = ledger.plan[id];
  plan.splice(plan.indexOf(prize), 1);
  ledger.given[id] = (ledger.given[id] || 0) + prize;
  ledger.lastGame = id;
  keep();
}

// Draw the outcome of the coming spin from the bag (or the test hook), then lay it on the belts.
async function prepare(force) {
  ready = false;
  pending = { ...award(force || draw()), force };
  return lay();
}

// Pick the six games of the coming spin and where each reel will stop, then put them on the belts.
// Which of the six games the outcome falls on is random. The three covers on show stay; the six slots
// behind the drum get the new games.
async function lay() {
  ready = false;
  const { outcome, game, force } = pending;
  // The winner comes first among the six: every pattern stops its matching reels on six[0].
  const six = game < 0 ? deal(GAMES_PER_SPIN) : [game, ...deal(GAMES_PER_SPIN - 1, game)];
  const pattern = outcome === 'pair' && !force ? PAIRS[Math.floor(Math.random() * PAIRS.length)] : FORCE[outcome];
  const targets = pattern.map((n) => six[n]);
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
    return prepare(outcome); // the same outcome, on other games (for a win, maybe another game too)
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
  volume.gain.value = gain * (result?.lure ? LURE_VOLUME : 1);
  source.connect(volume).connect(audio.destination);
  source.start(audio.currentTime + delay);
  return { source, volume };
}

// One tick of the prize count: a short note. The count climbs a major pentatonic scale, so any run of
// ticks sounds like a tune; the pitch wavers a little so a long run does not tire the ear.
const SCALE = [0, 2, 4, 7, 9];
function blip(delay, step, steps) {
  if (muted) return;
  const degree = Math.floor((step * (steps > 20 ? 14 : 9)) / steps);
  const note = SCALE[degree % 5] + 12 * Math.floor(degree / 5);
  const at = audio.currentTime + Math.max(delay, 0);
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'triangle';
  tone.frequency.value = 392 * 2 ** (note / 12) * (1 + (Math.random() - 0.5) * 0.03);
  volume.gain.setValueAtTime(0, at);
  volume.gain.linearRampToValueAtTime(0.16, at + 0.006);
  volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  tone.connect(volume).connect(audio.destination);
  tone.start(at);
  tone.stop(at + 0.14);
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
let view = { zoom: 1, left: 0, top: 0, right: STAGE_W, bottom: STAGE_H }; // the window, in the stage's pixels
const FLIGHT = 0.42; // seconds a light flies from a cover to the number

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
  prizeEl.style.transform = '';
  prizeEl.removeAttribute('aria-busy');
  noteEl.textContent = note;
  noteEl.classList.toggle('is-on', Boolean(note));
  noteEl.classList.toggle('is-quip', mood === 'is-quip');
  qrEl.classList.toggle('is-on', mood.includes('is-win'));
}

// Back to the invitation. The light of the last win goes out with its words. Attract mode follows if nobody spins.
function invite() {
  if (phase === 'idle' && result) {
    result = null;
    kick();
  }
  say(...WORDS.idle);
  clearTimeout(lureTimer);
  lureTimer = setTimeout(lure, (show === null ? LURE_EVERY : 2) * 1000);
}

// An attract spin. The slot each reel will stop on gets a new cover, three different games; after the spin
// the waiting outcome is laid on the belts again (land → lay).
async function lure() {
  clearTimeout(lureTimer); // one chain of attract spins, however lure() was called
  settle();
  if (phase !== 'idle' || !ready) {
    lureTimer = setTimeout(lure, 1000);
    return;
  }
  // Every other attract cycle is a scene; every scene plays before any comes again.
  if (!calm && (show !== null || lureCount % 2)) {
    if (!sceneBag.length) sceneBag = show === null ? shuffle(Object.keys(SCENES)) : Object.keys(SCENES).reverse();
    lureCount++;
    act(SCENES[show] ? show : sceneBag.pop());
    return;
  }
  luring = true;
  ready = false;
  kick();
  const shown = deal(3);
  const places = new Map();
  reels.forEach((reel, r) => {
    const slot = (reel.center + LAND) % SLOTS;
    reel.games[slot] = shown[r];
    places.set(shown[r], [[r, slot]]);
  });
  try {
    await paint(places);
  } catch {
    return lay();
  }
  if (!luring || queued || phase !== 'idle') return lay(); // somebody pressed meanwhile
  spin(shown);
}

function endLure() {
  luring = false;
  clearTimeout(lureTimer);
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
// until the next spin. In a pair the odd reel goes dark. The jackpot runs the same along all three, longer.
// Everything happens twice: when the reels show the win, and harder when the counted prize lands.
function celebrate(i, t) {
  if (!result?.shown || !result.prize || t < 0) return [1, 0, 9, 0];
  if (!result.reels.includes(i)) return [1 - 0.78 * clamp01(t / 0.25), 0, 9, 0];
  if (calm) return [1, 0.6, 9, 0];
  const jackpot = result.prize === 100;
  const lag = jackpot ? i * 0.09 : 0;
  const landed = t - COUNT[result.prize] - lag;
  const pulse = landed < 0 ? beat(t - 0.05 - lag, 0.4, 5) : beat(landed, 0.625, jackpot ? 7 : 2);
  const glow = (tease ? 1 : clamp01(t / 0.12)) * (0.55 + 0.45 * pulse); // after anticipation the light is on already
  const sweep = landed < 0 ? t - lag : jackpot && t < PARTY[100] ? landed % 1.2 : landed;
  const shine = sweep >= 0 && sweep < 0.6 ? -1.3 + (sweep / 0.6) * 2.6 : 9;
  const jolt = (since) => (since < 0 ? 0 : 10 * Math.sin(2 * Math.PI * 3 * since) * Math.exp(-3 * since));
  return [1, glow, shine, jolt(t) + 1.4 * jolt(landed)];
}

// Lay out the count of a win. `beats` are the moments, seconds after the reels showed it, the number
// takes a step up: quick at first, slower towards the end. Before each beat a light leaves a winning
// cover and lands on the number with it.
function score() {
  const span = COUNT[result.prize];
  const steps = STEPS[result.prize];
  fx.font = '400 156px CalSans';
  const whole = fx.measureText(`+${result.prize} players`).width;
  const number = fx.measureText(`+${result.prize}`).width;
  const middle = STAGE_W / 2 - whole / 2 + number / 2; // where the number will stand
  result.beats = Array.from({ length: steps }, (_, k) => 0.25 + (span - 0.25) * (1 - Math.sqrt(1 - (k + 1) / steps)));
  result.lights = result.beats.map((at, k) => ({
    at,
    x: REEL_X[result.reels[k % result.reels.length]] + (Math.random() - 0.5) * COVER * 0.6,
    y: REEL_Y + COVER * 0.42,
    bend: (Math.random() - 0.5) * 360,
    tx: middle + (Math.random() - 0.5) * number * 0.7,
    ty: 934,
  }));
  result.landed = false;
  result.rain = 0;
}

// The prize counts up and then lands. The landing is the loudest moment of a win: by then nobody
// has to watch the reels.
function tally(party) {
  if (result.landed) return;
  const jackpot = result.prize === 100;
  if (!calm && party < COUNT[result.prize]) {
    const passed = result.beats.filter((at) => at <= party).length;
    const text = `+${Math.round((result.prize * passed) / result.beats.length)} players`;
    if (prizeEl.textContent !== text) prizeEl.textContent = text;
    const since = passed ? party - result.beats[passed - 1] : 1;
    prizeEl.style.transform = `scale(${(1 + 0.05 * Math.exp(-since / 0.07)).toFixed(3)})`; // a bump on every step
    return;
  }
  result.landed = true;
  prizeEl.textContent = `+${result.prize} players`;
  prizeEl.style.transform = '';
  prizeEl.classList.add('is-landed');
  prizeEl.removeAttribute('aria-busy');
  if (calm) return;
  for (const i of result.reels) burstSparks(i, jackpot ? 40 : 18);
  if (jackpot) burstConfetti();
}

function burstConfetti() {
  const css = getComputedStyle(document.documentElement);
  const colors = ['--color-electric-lime', '--color-golden-400', '--slot-yellow', '--color-white'].map((name) => css.getPropertyValue(name).trim());
  for (let n = 0; n < 160; n++) {
    const side = n % 2 ? 1 : -1; // two cannons, one in each bottom corner
    const angle = 0.2 + Math.random() * 0.75;
    const speed = 1500 + Math.random() * 1300;
    confetti.push({
      x: side > 0 ? view.right + 20 : view.left - 20,
      y: view.bottom + 20,
      vx: -side * Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      fall: 1900,
      drag: 0.6,
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

// After the cannons, confetti drifts down from above the window: slow, so the party lasts.
function rainConfetti() {
  const css = getComputedStyle(document.documentElement);
  const colors = ['--color-electric-lime', '--color-golden-400', '--slot-yellow', '--color-white'].map((name) => css.getPropertyValue(name).trim());
  for (let n = 0; n < 70; n++) {
    confetti.push({
      x: view.left + Math.random() * (view.right - view.left),
      y: view.top - 20 - Math.random() * 900, // a deep cloud of it, so it rains on and does not come down as a stripe
      vx: (Math.random() - 0.5) * 260,
      vy: 120 + Math.random() * 200,
      fall: 520 + Math.random() * 380,
      drag: 1.6,
      w: 12 + Math.random() * 12,
      h: 7 + Math.random() * 6,
      turn: Math.random() * 6.28,
      turnSpeed: (Math.random() - 0.5) * 12,
      flip: Math.random() * 6.28,
      flipSpeed: 5 + Math.random() * 6,
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

// Sparks, confetti and the lights of the count: over the whole window, in the stage's pixels.
function drawFx(dt, party) {
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.clearRect(0, 0, fx.canvas.width, fx.canvas.height);
  fx.setTransform(view.zoom, 0, 0, view.zoom, -view.left * view.zoom, -view.top * view.zoom);
  // A light of the count: it leaves its cover slowly and speeds up into the number, a short tail behind it.
  if (result?.shown && result.prize && !calm && party < COUNT[result.prize] + FLIGHT) {
    fx.lineCap = 'round';
    for (const light of result.lights) {
      const u = (party - light.at + FLIGHT) / FLIGHT;
      if (u <= 0 || u >= 1) continue;
      const at = (e) => {
        const bx = (light.x + light.tx) / 2 + light.bend;
        const by = (light.y + light.ty) / 2;
        return [(1 - e) ** 2 * light.x + 2 * e * (1 - e) * bx + e * e * light.tx, (1 - e) ** 2 * light.y + 2 * e * (1 - e) * by + e * e * light.ty];
      };
      const head = at(u * u);
      const tail = at(Math.max(u * u - 0.16, 0));
      fx.globalAlpha = Math.min(1, 4 * u);
      fx.strokeStyle = yellow;
      fx.lineWidth = 12 - 5 * u;
      fx.beginPath();
      fx.moveTo(...tail);
      fx.lineTo(...head);
      fx.stroke();
      fx.fillStyle = white;
      fx.beginPath();
      fx.arc(...head, 7 - 2 * u, 0, 6.2832);
      fx.fill();
    }
    fx.globalAlpha = 1;
  }
  confetti = confetti.filter((bit) => bit.y < view.bottom + 60 || bit.vy < 0);
  for (const bit of confetti) {
    bit.vy += bit.fall * dt;
    bit.vx *= Math.exp(-1.2 * dt);
    bit.vy *= Math.exp(-bit.drag * dt);
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

// Jackpot: soft beams of light turn slowly behind the drums and run off past the edges of the window.
// They are half lit while the prize counts and bloom when it lands; the page behind the drums flashes
// once at each of the two moments. `t` is the time since the jackpot was shown, Infinity outside one.
// Attract mode lights the same beams at `lure` strength, turning by the clock (`clock`, seconds).
function drawRays(t, lure = 0, clock = 0) {
  const landed = t - COUNT[100];
  const lit = landed < 0 ? 0.55 : 1 + 0.5 * Math.exp(-landed / 0.5);
  const strength = Math.max(clamp01(t / 0.3) * clamp01((PARTY[100] - t) / 0.8) * lit, lure);
  const bright = Math.max(1, lure); // a beam's opacity stops at 1: stronger attract beams carry brighter light instead
  const turned = Number.isFinite(t) ? t : clock;
  if (strength <= 0 && !raysOn) return;
  raysOn = strength > 0;
  const { width, height } = rays.canvas;
  rays.globalAlpha = 1;
  rays.clearRect(0, 0, width, height);
  if (!raysOn) return;
  const flash = 0.26 * Math.exp(-t / 0.12) + (landed < 0 ? 0 : 0.34 * Math.exp(-landed / 0.16));
  if (flash > 0.01) {
    rays.fillStyle = `rgb(255 255 255 / ${flash.toFixed(3)})`;
    rays.fillRect(0, 0, width, height);
  }
  const x = width / 2;
  const y = height / 2 + (REEL_Y - STAGE_H / 2) * stageScale * RAYS_RES; // the reels' axis, in the canvas's pixels
  const reach = 1.2 * Math.hypot(x, Math.max(y, height - y)); // past the farthest corner of the window
  const light = rays.createRadialGradient(x, y, 0, x, y, reach);
  light.addColorStop(0, `rgb(${warm} / ${0.05 * bright})`); // warm at the drums, white and gone far away
  light.addColorStop(0.4, `rgb(255 255 255 / ${0.025 * bright})`);
  light.addColorStop(1, 'rgb(255 255 255 / 0)');
  rays.fillStyle = light;
  for (const beams of BEAMS) {
    const between = (2 * Math.PI) / beams.count;
    for (let n = 0; n < beams.count; n++) {
      const middle = turned * beams.turn + n * between;
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

// ---------- Attract mode's scenes ----------

// An attract cycle can be a scene instead of a spin: the reels move a little by themselves and come back
// to where they were. A scene says what it does to reel `i`, `t` seconds in: `off` (belt travel, px),
// `dx` (shift along the shaft, px), `zoom`, `dim`, `glow`, `shine` and `bare` (1: the drum under the covers is gone). No scene turns a belt by more than
// two thirds of a cover, so the coming spin stays hidden and no new cover comes to rest on the reel
// axis. A press cuts a scene at once: the spin starts, and the scene's pose melts away under it.
// To look at them alone, open the page with ?scenes (one after another, with each one's number under
// the headline; keys 1 to 7 start one) or ?scenes=wave (that one only).
const REST = { off: 0, dx: 0, zoom: 1, dim: 1, glow: 0, shine: 9, bare: 0 };
const show = new URLSearchParams(location.search).get('scenes'); // null: no scenes, the attract spin only

const smooth = (u) => {
  u = clamp01(u);
  return u * u * (3 - 2 * u);
};

// A value led through `keys` ([second, value], in order), eased between them.
function lead(t, keys) {
  for (let n = 1; n < keys.length; n++) {
    const [t0, v0] = keys[n - 1];
    const [t1, v1] = keys[n];
    if (t < t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return keys.at(-1)[1];
}

// A fall from `from` to rest in `time` seconds: it speeds up, lands and bounces like a reel at its stop.
function fall(t, from, time) {
  if (t < time) return from * (1 - clamp01(t / time) ** 2);
  t -= time;
  if (t > 1) return 0;
  const wd = SPRING_W * Math.sqrt(1 - SPRING_Z * SPRING_Z);
  return ((-2 * from) / time / wd) * Math.exp(-SPRING_Z * SPRING_W * t) * Math.sin(wd * t);
}

// The shuffle: pairs of drums change places, each pair quicker than the one before. [from, to (seconds), two places]
const SWAPS = [[0.2, 0.8, 0, 1], [0.9, 1.4, 1, 2], [1.5, 1.92, 0, 2], [2, 2.36, 0, 1]];
// Newton's cradle: the first knock, the time of one swing, the draw-back, and how much a knock keeps.
const CRADLE = { hit: 1.05, swing: 0.5, draw: 0.36 * PITCH, keep: 0.8, swings: 5 };

const SCENES = {
  // The reels creep one way and drop back, then the other way: they can't wait.
  tease: {
    span: 3.8,
    words: ['Psst…', 'These reels are itching to spin'],
    at(i, t) {
      t -= i * 0.14;
      if (t < 1) return { off: lead(t, [[0.1, 0], [0.85, 0.34 * PITCH]]) };
      if (t < 1.9) return { off: fall(t - 1, 0.34 * PITCH, 0.22) };
      if (t < 2.5) return { off: lead(t, [[1.9, 0], [2.35, -0.22 * PITCH]]) };
      return { off: fall(t - 2.5, -0.22 * PITCH, 0.2) };
    },
  },
  // A false start: the reels wind up and lunge as for a spin, hang there, and think better of it.
  bluff: {
    span: 2.7,
    words: ['Just kidding', 'They only spin for real when you press'],
    sounds: [[0, 'lever-start', { gain: 0.7 }], [1.25, 'reel-stop', { gain: 0.6 }]],
    at(i, t) {
      t -= i * STAGGER;
      if (t < 0.95) return { off: lead(t, [[0, 0], [T_WIND, -0.1 * PITCH], [0.42, 0.62 * PITCH], [0.95, 0.62 * PITCH]]) };
      return { off: fall(t - 0.95, 0.62 * PITCH, 0.3) };
    },
  },
  // A wave runs along the three reels, and the light with it.
  wave: {
    span: 3.4,
    words: ['Wave back!', 'Press the button and spin the reels'],
    at(i, t) {
      const on = smooth(t / 0.5) * smooth((3.2 - t) / 0.7);
      const turn = t / 0.85 - i / 3;
      return { off: 0.2 * PITCH * on * Math.sin(2 * Math.PI * turn), glow: 0.7 * on * Math.sin(Math.PI * turn) ** 2 };
    },
  },
  // Newton's cradle: the left reel is drawn back and let go. It stops dead on the knock and the right
  // one swings out; back it comes, and the left one swings out, a little less every time.
  cradle: {
    span: 3.7,
    words: ['Tick, tock', 'Players are waiting for your spin'],
    sounds: Array.from({ length: CRADLE.swings + 1 }, (_, k) => [CRADLE.hit + k * CRADLE.swing, 'reel-stop', { gain: 0.8 * CRADLE.keep ** k, rate: 1.3 }]),
    at(i, t) {
      const { hit, swing, draw, keep, swings } = CRADLE;
      const k = Math.floor((t - hit) / swing); // which swing is on
      const since = t - hit - k * swing;
      if (i === 1) {
        // The middle reel takes every knock and hardly moves.
        if (t < hit) return REST;
        const last = Math.min(k, swings);
        const after = t - hit - last * swing;
        return { off: (last % 2 ? -8 : 8) * keep ** last * Math.exp(-12 * after) * Math.sin(2 * Math.PI * 7 * after) };
      }
      if (t < hit) {
        if (i === 2) return REST;
        return { off: t < 0.8 ? lead(t, [[0.15, 0], [0.65, -draw]]) : -draw * Math.cos((Math.PI / 2) * ((t - 0.8) / (hit - 0.8))) };
      }
      if (k >= swings || (k % 2 ? 0 : 2) !== i) return REST;
      return { off: (i ? 1 : -1) * draw * keep ** (k + 1) * Math.sin((Math.PI * since) / swing), glow: 0.6 * Math.exp(-5 * since) };
    },
  },
  // Glints run over the covers one after another while the frames breathe; then all three flash together, twice, like a heartbeat.
  shimmer: {
    span: 3.7,
    words: ['Shiny, huh?', 'Three in a row: +100 players for a game'],
    at(i, t) {
      const run = t - 0.2 - i * 0.2;
      const glint = run % 0.95;
      const on = smooth(t / 0.4) * smooth((2.95 - t) / 0.4);
      const thump = beat(t - 3, 0.32, 2);
      return {
        shine: run >= 0 && run < 2.85 && glint < 0.5 ? -1.3 + (glint / 0.5) * 2.6 : 9,
        glow: Math.max(0.55 * on * Math.sin(Math.PI * (t / 0.95 - i / 3)) ** 2, 0.9 * thump),
        zoom: 1 + 0.035 * thump,
      };
    },
  },
  // The shell game: the reels change places, one passing in front of the other, and stay where they end up.
  // While they do, their drums are gone: only the covers fly, over the shaft.
  shuffle: {
    span: 2.5,
    words: ['Shuffled!', 'Press and see where the luck lands'],
    sounds: SWAPS.map(([, to]) => [to - 0.04, 'reel-stop', { gain: 0.6, rate: 1.5 }]),
    at(i, t) {
      const bare = smooth(t / 0.2) * smooth((2.5 - t) / 0.14);
      let place = i;
      for (const [from, to, a, b] of SWAPS) {
        if (place !== a && place !== b) continue;
        const other = place === a ? b : a;
        if (t >= to) {
          place = other;
          continue;
        }
        if (t <= from) break;
        const u = smooth((t - from) / (to - from));
        const arc = Math.sin(Math.PI * u) * (place === a ? 1 : -1); // one comes forward, the other steps back
        return { dx: REEL_X[place] + (REEL_X[other] - REEL_X[place]) * u - REEL_X[i], zoom: 1 + 0.13 * arc, dim: 1 + Math.min(0, 0.3 * arc), bare };
      }
      return { dx: REEL_X[place] - REEL_X[i], bare };
    },
    // The reels take their new places for good, each with its stop of the coming spin.
    end() {
      const place = (i) => SWAPS.reduce((at, [, , a, b]) => (at === a ? b : at === b ? a : at), i);
      const was = [...reels];
      const aim = [...next.targets];
      was.forEach((reel, i) => {
        reels[place(i)] = reel;
        next.targets[place(i)] = aim[i];
      });
    },
  },
  // Knock, knock: the middle drum leans out at the viewer twice, then all three lean in to look.
  knock: {
    span: 3.2,
    words: ['Knock, knock', 'Anybody here to spin?'],
    sounds: [[0.36, 'reel-stop', { gain: 1, rate: 0.6 }], [0.7, 'reel-stop', { gain: 1, rate: 0.6 }]],
    at(i, t) {
      const rap = (at) => {
        const u = (t - at) / 0.3;
        return u <= 0 || u >= 1 ? 0 : u < 0.25 ? smooth(u / 0.25) : 1 - smooth((u - 0.25) / 0.75);
      };
      const raps = i === 1 ? rap(0.3) + rap(0.64) : 0;
      const look = smooth((t - 1.35 - i * 0.1) / 0.35) * smooth((2.75 - t) / 0.35);
      return { zoom: 1 + 0.15 * raps + 0.07 * look, glow: Math.max(0.7 * raps, 0.4 * look) };
    },
  },
};

// Put a scene on stage, if the reels are at rest and hold the coming spin.
function act(name) {
  if (phase !== 'idle' || !ready) return;
  clearTimeout(lureTimer);
  settle();
  const scene = SCENES[name];
  result = null; // the attract spin before it is over: the scene's sounds set their own volume
  luring = true;
  antic = {
    scene,
    start: performance.now(),
    sounds: (scene.sounds || []).map(([delay, sound, options]) => play(sound, { ...options, gain: options.gain * LURE_VOLUME, delay })),
  };
  say(scene.words[0], show === null ? scene.words[1] : `Scene ${Object.keys(SCENES).indexOf(name) + 1}: ${name}`);
  lureTimer = setTimeout(lure, (show === null ? LURE_EVERY : scene.span + 1.5) * 1000);
  kick();
}

// A scene has run its time: the reels are at rest again (after a shuffle, in their new places).
function settle() {
  antic?.scene.end?.();
  antic = null;
}

// ---------- Spin ----------

// `lured`: the three games an attract spin stops on.
function spin(lured) {
  if (phase !== 'idle') return;
  if (!lured) {
    endLure();
    if (!ready) {
      queued = true;
      return;
    }
  }
  if (antic) {
    // The pose the viewer saw last; from here it melts away.
    const t = (lastFrame - antic.start) / 1000;
    carry = { at: performance.now(), pose: reels.map((_, i) => ({ ...REST, ...antic.scene.at(i, t) })) };
    for (const sound of antic.sounds) sound?.source.stop();
    antic = null;
  }
  audio.resume();
  ready = false;
  const targets = lured || next.targets;
  result = { ...judge(targets), lure: Boolean(lured) };
  tease = !calm && targets[0] === targets[1];
  const last = tease ? 2 * STAGGER + TEASE_AT + TEASE_TIME : STOP[2];
  plan = { stop: [STOP[0], STOP[1], last], reveal: last + 0.18, settle: last + T_SETTLE };
  skip = [0, 0, 0];
  for (const reel of reels) reel.hit = false;
  if (lured) {
    say(...LURES[(lureCount++ >> 1) % LURES.length]); // a spin is every other cycle
    lureTimer = setTimeout(lure, LURE_EVERY * 1000); // the next attract spin
  }
  else say('', quip(QUIPS), 'is-quip'); // the quip under the turning reels
  teased = false;
  if (boosted) marqueeRate(1);
  phase = 'spinning';
  spinStart = performance.now();
  play('lever-start', { gain: 0.7 });
  whirr = play('spin-loop', { gain: 0.5, loop: true, delay: T_WIND });
  kick();
}

// A second press while the reels turn stops them early, `t` seconds into the spin. Each reel leaves out
// the whole turns of its belt it has left at full speed, so it lands on the same cover and still slows
// down and springs back as always; they stop in order, a stagger apart. Pressed early, a reel first
// reaches full speed. Once the anticipation has begun, the third reel plays it out; pressed before,
// there is none.
const TURN = BELT / SPEED; // one turn of a belt at full speed
function slam(t = (performance.now() - spinStart) / 1000) {
  if (phase !== 'spinning' || (tease && t > STOP[1])) return;
  tease = false;
  let prev = -Infinity;
  STOP.forEach((stop, i) => {
    const full = i * STAGGER + T_WIND + T_ACCEL; // when the reel reaches full speed
    let turns = Math.max(0, Math.floor((full + cruise(i) - skip[i] - Math.max(t, full)) / TURN));
    while (turns > 0 && stop - skip[i] - turns * TURN < prev + STAGGER - 1e-6) turns--;
    skip[i] += turns * TURN;
    plan.stop[i] = prev = stop - skip[i];
  });
  plan.reveal = plan.stop[2] + 0.18;
  plan.settle = plan.stop[2] + T_SETTLE;
}

// The sound of anticipation, `wait` seconds from now: a tone that climbs until the third reel stops,
// and a click for each of its last covers as it passes the middle, further and further apart.
function teaseSound(wait) {
  if (muted) return;
  const at = audio.currentTime + Math.max(wait, 0);
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(196, at);
  tone.frequency.exponentialRampToValueAtTime(523.25, at + TEASE_TIME);
  volume.gain.setValueAtTime(0, at);
  volume.gain.linearRampToValueAtTime(0.09, at + TEASE_TIME);
  volume.gain.linearRampToValueAtTime(0, at + TEASE_TIME + 0.08);
  tone.connect(volume).connect(audio.destination);
  tone.start(at);
  tone.stop(at + TEASE_TIME + 0.1);
  for (let cover = TEASE_TRAVEL - 8; cover < TEASE_TRAVEL; cover++) {
    const passed = 1 - (1 - (cover * PITCH - TEASE_FROM) / TEASE_RUN) ** (1 / TEASE_EASE);
    play('reel-stop', { gain: 0.3, rate: 1.7, delay: Math.max(wait, 0) + TEASE_TIME * passed });
  }
  whirr?.source.playbackRate.setTargetAtTime(0.55, at, TEASE_TIME / 3); // the whirr winds down with the reel
}

// Reel `i` hit its stop `late` seconds ago.
function onStop(i, late) {
  if (late < 0.25) play('reel-stop', { gain: 0.8, rate: 1 + i * 0.05 + (Math.random() - 0.5) * 0.04 });
  if (i === 1 && tease && late < 0.25) teaseSound(2 * STAGGER + TEASE_AT - STOP[1] - late);
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
  if (result.lure) return;
  if (!result.prize) {
    say(...WORDS.none);
    sayTimer = setTimeout(invite, SAY_NONE * 1000);
    return;
  }
  credit(result.game, result.prize);
  const jackpot = result.prize === 100;
  const span = calm ? 0 : COUNT[result.prize];
  score();
  share(result.game, result.prize);
  say('+0 players', `for ${covers[result.game].title}`, jackpot ? 'is-win is-jackpot' : 'is-win'); // tally() counts it up
  prizeEl.setAttribute('aria-busy', 'true'); // a screen reader hears the prize once, when it has landed
  sayTimer = setTimeout(invite, SAY_WIN * 1000);
  if (late < 0.25) {
    // Ticks climb while the prize counts, coins pour under them, and the fanfare comes when it lands.
    if (!calm) result.beats.forEach((at, step) => blip(at - late, step, result.beats.length));
    play('coins', { gain: jackpot ? 0.4 : 0.28, delay: 0.1 });
    play(jackpot ? 'win-jackpot' : 'win-small', { gain: jackpot ? 0.95 : 0.8, delay: Math.max(span - late, 0) });
    if (jackpot) {
      play('coins', { gain: 0.5, delay: span + 0.35 });
      play('coins', { gain: 0.35, rate: 1.12, delay: span + 2.6 });
    }
  }
  if (calm) return;
  for (const i of result.reels) burstSparks(i, jackpot ? 34 : 22);
  if (jackpot) marqueeRate(3);
}

function land() {
  reels.forEach((reel, i) => { reel.center = (reel.center + TRAVEL[i]) % SLOTS; });
  if (result.lure) {
    phase = 'idle';
    lay(); // the waiting outcome, on the slots behind the drum again
    return;
  }
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
  gl.uniform1f(U.zoom, 1);
  box(-SHAFT_HALF, SHAFT_HALF);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.uniform1f(U.shaftPass, 0);
  // Attract mode's scene, or what a press left of it.
  let poses = null;
  if (antic) {
    const at = (now - antic.start) / 1000;
    poses = reels.map((_, i) => {
      const pose = { ...REST, ...antic.scene.at(i, at) };
      pose.speed = (pose.off - (antic.scene.at(i, at - 1 / 120).off || 0)) * 120;
      return pose;
    });
  } else if (carry) {
    const left = 1 - smooth((now - carry.at) / 300);
    if (left <= 0) carry = null;
    else poses = carry.pose.map((pose) => ({ off: pose.off * left, dx: pose.dx * left, zoom: 1 + (pose.zoom - 1) * left, dim: 1 + (pose.dim - 1) * left, glow: pose.glow * left, shine: 9, bare: pose.bare * left }));
  }
  // The drum that leans out furthest is drawn last, over the others.
  const order = poses ? [0, 1, 2].sort((a, b) => poses[a].zoom - poses[b].zoom) : [0, 1, 2];
  order.forEach((i) => {
    const reel = reels[i];
    const pose = poses ? poses[i] : REST;
    const [off, speed] = phase === 'spinning' ? motion(i, t - i * STAGGER, tease && i === 2, skip[i]) : [0, 0];
    let [dim, glow, shine, nudge] = celebrate(i, party);
    // Anticipation: the two reels that match light up, and the frame of the third one pulses while it slows.
    if (tease && phase === 'spinning' && !result.shown && t > STOP[1]) {
      const on = clamp01((t - STOP[1] - 0.1) / 0.25);
      glow = on * (i === 2 ? 0.3 + 0.3 * Math.sin(Math.PI * 2.5 * (t - STOP[1])) ** 2 : 0.5);
    }
    // Attract mode: a light runs across the reels, left to right.
    if (lureLight > 0.01 && !result?.prize) glow = Math.max(glow, 0.6 * lureLight * Math.sin(Math.PI * (now / 900 - i / 3)) ** 2);
    glow = Math.max(glow, pose.glow);
    if (pose.shine !== 9) shine = pose.shine;
    const pos = (((reel.center * PITCH + off + nudge + pose.off) % BELT) + BELT) % BELT;
    // The drum's far edges sit closer to the stage centre than its front ones.
    const left = REEL_X[i] - STAGE_W / 2 - DRUM_HALF;
    const right = left + 2 * DRUM_HALF;
    if (pose.dx || pose.zoom !== 1) gl.scissor(0, 0, canvas.width, canvas.height); // a drum out of its place: the whole canvas
    else box(Math.min(left, left * EDGE_SCALE), Math.max(right, right * EDGE_SCALE));
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, reel.texture);
    gl.uniform1f(U.cx, REEL_X[i] + pose.dx - STAGE_W / 2);
    gl.uniform1f(U.zoom, pose.zoom);
    gl.uniform1f(U.pos, pos);
    gl.uniform1f(U.blur, Math.min(Math.abs(speed + (pose.speed || 0)) * SHUTTER, 0.55 * PITCH));
    gl.uniform1f(U.dim, dim * pose.dim);
    gl.uniform1f(U.body, 1 - pose.bare);
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
      if (reel.hit || t < plan.stop[i]) return;
      reel.hit = true;
      onStop(i, t - plan.stop[i]);
    });
    if (!result.shown && t >= plan.reveal) reveal(now, t - plan.reveal);
    if (t >= plan.settle) land();
  }
  if (phase === 'result' && now >= idleAt) phase = 'idle';
  const party = result?.shown ? (now - revealAt) / 1000 : Infinity;
  const jackpot = result?.shown && result.prize === 100 && !calm;
  if (tease && !teased && phase === 'spinning' && !result.shown && (now - spinStart) / 1000 > STOP[1] + 0.1) {
    teased = true;
    say('', quip(TEASE_QUIPS), 'is-quip');
  }
  if (result?.shown && result.prize) tally(party);
  if (boosted && party > PARTY[100] - 0.4) marqueeRate(1);
  // The jackpot shakes the whole stage twice: when the reels show it, and harder when the prize lands.
  const jolt = (since, size) => (since >= 0 && since < 0.5 ? size * Math.exp(-7 * since) : 0);
  const shake = jackpot ? jolt(party, 0.6) + jolt(party - COUNT[100], 1.2) : 0;
  // Outside a win `party` is infinite and its sine is not a number: such a value would switch the stage's whole transform off.
  stage.style.setProperty('--shake-x', `${(shake ? 8 * shake * Math.sin(55 * party) : 0).toFixed(2)}px`);
  stage.style.setProperty('--shake-y', `${(shake ? 5 * shake * Math.cos(47 * party) : 0).toFixed(2)}px`);
  // After the cannons, three waves of confetti drift down.
  if (jackpot && result.landed) {
    for (const waves = Math.min(3, Math.floor((party - COUNT[100]) / 1.1)); result.rain < waves; result.rain++) rainConfetti();
  }
  if (antic && (now - antic.start) / 1000 >= antic.scene.span) settle();
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  lureLight += ((luring ? 1 : 0) - lureLight) * Math.min(1, dt * 1.5);
  render(now);
  drawRays(jackpot ? party : Infinity, LURE_RAYS * lureLight * (0.7 + 0.3 * Math.sin(now / 700)), now / 1000);
  drawFx(dt, party);
  lastFrame = now;
  const partying = result && party < PARTY[result.prize];
  if (phase === 'spinning' || phase === 'result' || confetti.length || sparks.length || partying || luring || lureLight > 0.002 || carry) kick();
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
  // Sparks and confetti get the whole window too, so they are not cut at the stage's edges.
  const sharp = Math.min(devicePixelRatio, 2);
  const side = (innerWidth / scale - STAGE_W) / 2;
  const above = (innerHeight / scale - STAGE_H) / 2;
  fx.canvas.width = Math.round(innerWidth * sharp);
  fx.canvas.height = Math.round(innerHeight * sharp);
  view = { zoom: scale * sharp, left: -side, top: -above, right: STAGE_W + side, bottom: STAGE_H + above };
  // A quip stands halfway between the bottom of the drums and the bottom of the window.
  stage.style.setProperty('--quip-y', `${((REEL_Y + EDGE_Y + view.bottom) / 2).toFixed(1)}px`);
  const k = Math.min(Math.max(scale * devicePixelRatio, 0.25), 2);
  canvas.width = Math.round(STAGE_W * k);
  canvas.height = Math.round(VIEW_H * k);
  render(performance.now());
}

addEventListener('resize', fit);
// A press spins the reels; pressed again while they turn, it stops them early. During an attract spin
// it stops that one early and spins for real right after.
function press() {
  if (phase !== 'spinning') return spin();
  if (result.lure) {
    endLure();
    queued = true;
  }
  slam();
}
addEventListener('pointerdown', (event) => {
  if (event.button === 0) press();
});
addEventListener('keydown', (event) => {
  const scene = show !== null && Object.keys(SCENES)[Number(event.key) - 1];
  if (scene) return antic || calm ? undefined : act(scene); // one scene at a time
  if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return;
  event.preventDefault();
  press();
});

async function start() {
  fit();
  // In a folder of a site the library's own address of the font is empty (see slot.css): that miss is expected.
  document.fonts.load('400 156px CalSans').catch(() => {});
  // Never a remembered copy of the list: after the set of games changes, an old list names files that are gone.
  covers = await (await fetch('assets/covers/covers.json', { cache: 'no-cache' })).json();
  openLedger();
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
      ledger,
      confetti: confetti.length,
      sparks: sparks.length,
      audio: audio.state,
      muted,
      sounds: Object.keys(sounds).length,
      luring,
      lureLight,
      antic: antic ? Object.keys(SCENES).find((name) => SCENES[name] === antic.scene) : '',
      carry: Boolean(carry),
    };
  },
  get timing() {
    return { STOP: plan.stop, REVEAL: plan.reveal, SETTLE: plan.settle, TEASE: tease ? TEASE_TIME : 0 }; // of the current spin
  },
  motion,
  prepare,
  spin,
  slam, // at a given second of the spin
  lure, // an attract spin now
  scenes: SCENES,
  act(name) {
    act(name); // step() then drives the scene: its clock starts where a spin's would
    if (antic) spinStart = antic.start;
  },
  press,
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
