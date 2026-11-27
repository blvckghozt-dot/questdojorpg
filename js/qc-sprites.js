/* QuestClass RPG — procedural 16-bit sprite renderer.
   Every character (8 races × 8 elements × 6 stages = 384) and every monster (18 + 2) is drawn
   pixel-by-pixel from the art bible rules. Output is RGBA buffers: a base layer (outlined sprite)
   and a separate aura layer, so contexts can dim or drop the aura without touching the body. */
var SPR = (function () {
  'use strict';
  var W = 96, H = 96, CX = 48, FOOT = 86;

  // ---------- colour helpers ----------
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function toHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function dk(a, t) { return mix(a, '#0a0612', t); }
  function lt(a, t) { return mix(a, '#ffffff', t); }
  function ramp(base) { return [dk(base, 0.38), base, lt(base, 0.32)]; }

  // ---------- buffer ----------
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  Buf.prototype.put = function (x, y, col, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    var c = typeof col === 'string' ? hex(col) : col, al = a === undefined ? 1 : a;
    var i = (y * this.w + x) * 4, d = this.d;
    if (al >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    var da = d[i + 3] / 255, oa = al + da * (1 - al);
    if (oa <= 0) return;
    d[i] = (c[0] * al + d[i] * da * (1 - al)) / oa; d[i + 1] = (c[1] * al + d[i + 1] * da * (1 - al)) / oa; d[i + 2] = (c[2] * al + d[i + 2] * da * (1 - al)) / oa; d[i + 3] = oa * 255;
  };
  Buf.prototype.alpha = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; };
  Buf.prototype.get = function (x, y) { var i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; };
  Buf.prototype.clear = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; var i = (y * this.w + x) * 4; this.d[i + 3] = 0; };

  function rect(b, x, y, w, h, c, a) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) b.put(x + i, y + j, c, a); }
  function srect(b, x, y, w, h, r) { // shaded rect with ramp [dark, base, light]
    rect(b, x, y, w, h, r[1]);
    for (var i = 0; i < w; i++) { b.put(x + i, y, r[2]); b.put(x + i, y + h - 1, r[0]); }
    for (var j = 1; j < h - 1; j++) { b.put(x, y + j, r[2]); b.put(x + w - 1, y + j, r[0]); }
  }
  function ell(b, cx, cy, rx, ry, c, a) {
    for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) if ((x * x) / ((rx + 0.5) * (rx + 0.5)) + (y * y) / ((ry + 0.5) * (ry + 0.5)) <= 1) b.put(cx + x, cy + y, c, a);
  }
  function sell(b, cx, cy, rx, ry, r) { ell(b, cx, cy, rx, ry, r[0]); ell(b, cx - (rx > 1 ? 1 : 0), cy - (ry > 1 ? 1 : 0), Math.max(0, rx - 1), Math.max(0, ry - 1), r[1]); b.put(cx - Math.floor(rx / 2), cy - Math.floor(ry / 2), r[2]); if (rx > 2) b.put(cx - Math.floor(rx / 2) + 1, cy - Math.floor(ry / 2), r[2]); }
  function ring(b, cx, cy, rx, ry, c, a) {
    for (var t = 0; t < 360; t += 2) { var r = t * Math.PI / 180; b.put(cx + Math.cos(r) * rx, cy + Math.sin(r) * ry, c, a); }
  }
  function line(b, x0, y0, x1, y1, c, th, a) {
    th = th || 1; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, o = Math.floor((th - 1) / 2);
    for (var n = 0; n < 400; n++) {
      if (th === 1) b.put(x0, y0, c, a); else rect(b, x0 - o, y0 - o, th, th, c, a);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function poly(b, pts, c, a) {
    var minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var xs = [];
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], q = pts[(i + 1) % pts.length];
        if ((p[1] <= y + 0.5 && q[1] > y + 0.5) || (q[1] <= y + 0.5 && p[1] > y + 0.5)) xs.push(p[0] + (y + 0.5 - p[1]) * (q[0] - p[0]) / (q[1] - p[1]));
      }
      xs.sort(function (m, n) { return m - n; });
      for (var k = 0; k + 1 < xs.length; k += 2) for (var x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) b.put(x, y, c, a);
    }
  }
  function spark(b, x, y, c, s) { s = s || 1; b.put(x, y, '#ffffff'); for (var i = 1; i <= s; i++) { b.put(x - i, y, c, 0.8 / i); b.put(x + i, y, c, 0.8 / i); b.put(x, y - i, c, 0.8 / i); b.put(x, y + i, c, 0.8 / i); } }

  function outline(src, dst, dark) {
    var w = src.w, h = src.h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (src.alpha(x, y) > 40) continue;
      var nb = null;
      var n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var k = 0; k < 4; k++) { var xx = x + n4[k][0], yy = y + n4[k][1]; if (src.alpha(xx, yy) > 200) { nb = src.get(xx, yy); break; } }
      if (nb) dst.put(x, y, toHex([nb[0] * 0.22 + 8, nb[1] * 0.18 + 4, nb[2] * 0.25 + 14]), dark === undefined ? 1 : dark);
    }
  }
  function composite(layers, w, h) {
    var out = new Buf(w, h);
    layers.forEach(function (L) {
      if (!L) return;
      for (var i = 0; i < w * h; i++) { var a = L.d[i * 4 + 3]; if (a) out.put(i % w, Math.floor(i / w), [L.d[i * 4], L.d[i * 4 + 1], L.d[i * 4 + 2]], a / 255); }
    });
    return out;
  }
  // soft aura derived from a silhouette: dilated mask with falloff + particles
  function makeAura(silhouette, color, strength, seed) {
    var w = silhouette.w, h = silhouette.h, aura = new Buf(w, h);
    if (!strength) return aura;
    var radius = strength === 1 ? 3 : strength === 2 ? 4 : 6, peak = strength === 1 ? 0.32 : strength === 2 ? 0.45 : 0.55;
    var dist = new Float32Array(w * h).fill(99);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (silhouette.alpha(x, y) > 100) dist[y * w + x] = 0;
    for (var pass = 0; pass < radius; pass++) {
      var nd = dist.slice();
      for (var y2 = 1; y2 < h - 1; y2++) for (var x2 = 1; x2 < w - 1; x2++) {
        var i = y2 * w + x2, m = Math.min(dist[i - 1], dist[i + 1], dist[i - w], dist[i + w]) + 1;
        if (m < nd[i]) nd[i] = m;
      }
      dist = nd;
    }
    var c = hex(color);
    for (var j = 0; j < w * h; j++) { var dd = dist[j]; if (dd > 0 && dd <= radius) { aura.put(j % w, Math.floor(j / w), c, peak * (1 - (dd - 1) / radius)); } }
    var rng = mulberry(seed || 7), n = strength === 1 ? 6 : strength === 2 ? 14 : 26;
    for (var p = 0; p < n; p++) {
      var px = 8 + Math.floor(rng() * (w - 16)), py = 6 + Math.floor(rng() * (h - 12));
      var dpx = dist[py * w + px];
      if (dpx > 1 && dpx < radius + 8) spark(aura, px, py, color, rng() < 0.3 ? 2 : 1);
    }
    return aura;
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- element palettes ----------
  var ELEM = {
    earth: { r: ['#3a2419', '#624033', '#9b6b49'], glow: '#c98a4e', gem: '#b0703a' },
    water: { r: ['#3f9fb4', '#94e7f5', '#e3fbff'], glow: '#b6f3ff', gem: '#6fdcf0' },
    wind: { r: ['#1f8a55', '#48d58b', '#b6f7d2'], glow: '#8ff0bb', gem: '#35c77a' },
    fire: { r: ['#9a2419', '#ef4f3f', '#ffb08a'], glow: '#ff9a4a', gem: '#ff5a3a' },
    ice: { r: ['#18247a', '#2c46c8', '#8ea0ff'], glow: '#7f95ff', gem: '#4a66f0' },
    lightning: { r: ['#b0580a', '#ff9a1f', '#ffd08a'], glow: '#ffc56b', gem: '#ffb03a' },
    light: { r: ['#c9a800', '#ffe83a', '#fffbc0'], glow: '#fff59a', gem: '#fff27a' },
    dark: { r: ['#0e0714', '#2a1838', '#5e3a78'], glow: '#7a4a95', gem: '#4a2560' }
  };

  // ---------- race bodies ----------
  var BODY = {
    human: { h: 46, headW: 11, headH: 12, torsoW: 12, torsoH: 14, legW: 4, armW: 3, skin: '#f1c49a', hair: '#4a2b1b', eye: '#23324f', gender: 'm' },
    dwarf: { h: 35, headW: 12, headH: 12, torsoW: 16, torsoH: 12, legW: 5, armW: 4, skin: '#e8b48c', hair: '#a4521f', eye: '#2b1b12', gender: 'm', beard: true },
    machina: { h: 47, headW: 12, headH: 11, torsoW: 14, torsoH: 15, legW: 5, armW: 4, skin: null, hair: null, eye: '#ff3b30', gender: 'm', robot: true },
    demon: { h: 47, headW: 11, headH: 12, torsoW: 12, torsoH: 14, legW: 4, armW: 3, skin: '#c7b0c9', hair: '#1f1628', eye: '#ff3355', gender: 'm', horns: true },
    high_elf: { h: 46, headW: 10, headH: 12, torsoW: 10, torsoH: 13, legW: 3, armW: 2, skin: '#fde7d6', hair: '#f4de8c', eye: '#2f8a5c', gender: 'f', ears: 'elf' },
    beastkin: { h: 45, headW: 11, headH: 12, torsoW: 10, torsoH: 13, legW: 3, armW: 2, skin: '#f7d4b3', hair: '#e5833a', eye: '#6b3a12', gender: 'f', ears: 'fox' },
    celestial: { h: 46, headW: 10, headH: 12, torsoW: 10, torsoH: 13, legW: 3, armW: 2, skin: '#fdeadf', hair: '#fff0b8', eye: '#3a6fd0', gender: 'f' },
    fairy: { h: 31, headW: 10, headH: 10, torsoW: 8, torsoH: 9, legW: 2, armW: 2, skin: '#fde5dc', hair: '#8fd46a', eye: '#2a6f3a', gender: 'f', hover: 7 }
  };

  // outfit per race × stage index: torso style, colours, extras
  var OUTFIT = {
    human: [
      { top: 'vest', cloth: '#8a5a33', under: '#e9dcc0', pants: '#b39a6a', boots: '#5c3a22' },
      { top: 'plate', metal: '#9aa4b2', under: '#7a5231', pants: '#6d6f78', boots: '#8b939f', pauldron: 1 },
      { top: 'plate', metal: '#d6dde6', trim: '#e0b84c', pants: '#8e98a8', boots: '#c9d1dc', pauldron: 2, emblem: true },
      { top: 'plate', metal: '#f4f1e6', trim: '#e8bc58', pants: '#d9d2bf', boots: '#efe6cc', pauldron: 3, cape: '#c9302c', emblem: true },
      { top: 'scale', metal: '#e2b64a', trim: '#8fd0ff', pants: '#b98d2f', boots: '#d9ab3e', pauldron: 3, cape: '#7a1f2a', emblem: true, crest: true },
      { top: 'plate', metal: '#fbf7ea', trim: '#f0c860', pants: '#eee4c6', boots: '#fff6dc', pauldron: 3, cape: '#f0c860', emblem: true, circlet: true }
    ],
    dwarf: [
      { top: 'overall', cloth: '#6b4a2e', under: '#8c8c8c', pants: '#6b4a2e', boots: '#4a3322', soot: true },
      { top: 'plate', metal: '#7e8791', under: '#5a3b24', pants: '#5d5f66', boots: '#6f7680', pauldron: 1, toolbelt: true },
      { top: 'plate', metal: '#b9c2cc', trim: '#8fa0b0', pants: '#707886', boots: '#a3acb8', pauldron: 2, spikes: true },
      { top: 'lava', metal: '#4a4550', trim: '#ff7a1a', pants: '#3b3640', boots: '#4a4550', pauldron: 2, furnace: true },
      { top: 'plate', metal: '#8f98a6', trim: '#ff9a2e', pants: '#5b6270', boots: '#7b8492', pauldron: 3, pipes: true },
      { top: 'plate', metal: '#d8b04a', trim: '#8a6a3a', pants: '#6b5a44', boots: '#b58f3a', pauldron: 3, lions: true, runes: true }
    ],
    machina: [
      { robot: 'rust', metal: '#8a6e5a', trim: '#5e4b3f', wires: true },
      { robot: 'grey', metal: '#9ba3ad', trim: '#6b737d', led: '#ff3b30' },
      { robot: 'steel', metal: '#d5dde6', trim: '#8e9aa8', core: true },
      { robot: 'blackgold', metal: '#2e2c36', trim: '#e0b84c', core: true, jets: true },
      { robot: 'carbon', metal: '#23252c', trim: '#d9b24a', core: true, jets: true, neon: true, barrier: true },
      { robot: 'odin', metal: '#f1efe8', trim: '#e8bc58', core: true, jets: true, neon: true, jetArms: true, drones: true }
    ],
    demon: [
      { top: 'rags', cloth: '#6e6670', under: '#e6ddd0', pants: '#4d474f', boots: '#3a353c', bandage: true },
      { top: 'leather', cloth: '#2a2430', under: '#3d3545', pants: '#221d28', boots: '#1b1720', pauldron: 1, spikes: true },
      { top: 'plate', metal: '#3a3342', trim: '#8f4bc0', pants: '#2a2430', boots: '#332c3a', pauldron: 2, runes: true },
      { top: 'coat', cloth: '#17131d', metal: '#3a3342', trim: '#8f4bc0', pants: '#211b27', boots: '#2b2432', pauldron: 2, spikes: true, feathers: true },
      { top: 'plate', metal: '#141118', trim: '#b061ff', pants: '#17131c', boots: '#1d1822', pauldron: 3, skulls: true, runes: true },
      { top: 'plate', metal: '#0f0c12', trim: '#ff2a3d', pants: '#130f16', boots: '#1a141f', pauldron: 3, skulls: true, runes: true, smokeWings: true }
    ],
    high_elf: [
      { top: 'dress', cloth: '#a9d98f', under: '#e8f4d8', skirt: 'mid', boots: '#7a5534' },
      { top: 'robe', cloth: '#7ec3ef', under: '#dff2ff', skirt: 'long', boots: '#4e6f9a', beltOrb: true },
      { top: 'dress', cloth: '#2f7e62', trim: '#e8c35a', skirt: 'mid', boots: '#e8e2cf', embroid: true },
      { top: 'robe', cloth: '#fbf7ee', trim: '#e3bf5c', skirt: 'long', boots: '#fff', sheer: true },
      { top: 'lightplate', metal: '#d9e7f1', cloth: '#bfe5d5', trim: '#e3bf5c', skirt: 'mid', boots: '#cfdce8', crown: true },
      { top: 'robe', cloth: '#fffdf4', trim: '#f0c860', skirt: 'long', boots: '#fff', sheer: true, flowerRing: true, crown: true }
    ],
    beastkin: [
      { top: 'tank', cloth: '#8a5a33', under: '#8a5a33', pants: '#6a4428', shorts: true, boots: '#5a3a22' },
      { top: 'hunter', cloth: '#d9a23a', spots: true, pants: '#8a5a33', shorts: true, boots: '#6a4428', fangs: true },
      { top: 'leather', cloth: '#9c6a3f', trim: '#f2e3c6', pants: '#7b5230', boots: '#6a4428', fluffy: true },
      { top: 'ninja', cloth: '#1d1a22', trim: '#d8323a', pants: '#1d1a22', boots: '#2a2530', scarf: '#d8323a' },
      { top: 'leather', cloth: '#7a2e24', trim: '#ffb43a', pants: '#4f1f1a', boots: '#3b1713', phoenix: true, glowTail: true },
      { top: 'ninja', cloth: '#f5efe6', trim: '#e8bc58', pants: '#e9e0d0', boots: '#f5efe6', scarf: '#e8bc58', nineTails: true }
    ],
    celestial: [
      { top: 'dress', cloth: '#f7f5f0', under: '#ffffff', skirt: 'mid', boots: '#e8e2d4', wings: 1 },
      { top: 'breast', metal: '#cfd6de', cloth: '#bfe3ff', skirt: 'mid', boots: '#d9dee6', cape: '#a9d8ff', wings: 2 },
      { top: 'breast', metal: '#fbf5e3', cloth: '#ffffff', trim: '#e3bf5c', skirt: 'mid', boots: '#fff6dc', wings: 3 },
      { top: 'breast', metal: '#f6d56a', cloth: '#fff7df', trim: '#fff', skirt: 'long', boots: '#f6d56a', wings: 3, halo: true },
      { top: 'breast', metal: '#fff1c2', cloth: '#ffffff', trim: '#e3bf5c', skirt: 'long', boots: '#fff1c2', wings: 8, halo: true },
      { top: 'breast', metal: '#ffffff', cloth: '#fffdf4', trim: '#f0c860', skirt: 'long', boots: '#ffffff', wings: 12, halo: true, crownLight: true }
    ],
    fairy: [
      { top: 'leaf', cloth: '#6fbf4a', under: '#4e9a34', skirt: 'leaf', boots: '#d8c079' },
      { top: 'petal', cloth: '#ff9ccf', under: '#ffd3ea', skirt: 'petal', boots: '#ffd3ea', bfly: 1 },
      { top: 'petal', cloth: '#ffe07a', under: '#fff4c4', trim: '#e8bc58', skirt: 'petal', boots: '#fff4c4', bfly: 1, pollen: true },
      { top: 'petal', cloth: '#e0405e', under: '#ff9ab0', skirt: 'petal', boots: '#ffb3c2', bfly: 2, pollen: true },
      { top: 'petal', cloth: '#6ad0a0', under: '#d4fff0', trim: '#c9f2ff', skirt: 'petal', boots: '#d4fff0', bfly: 3, crystal: true },
      { top: 'petal', cloth: '#fff8ff', under: '#ffe9ff', trim: '#f0c860', skirt: 'petal', boots: '#fff', bfly: 4, crystal: true }
    ]
  };

  // ---------- geometry for a body ----------
  function geom(race) {
    var B = BODY[race], foot = FOOT - (B.hover || 0);
    var legH = B.h - B.headH - B.torsoH + 2;
    var legTop = foot - legH, torsoTop = legTop - B.torsoH, headTop = torsoTop - B.headH + 2;
    var tl = CX - Math.floor(B.torsoW / 2);
    return {
      B: B, foot: foot, legH: legH, legTop: legTop, torsoTop: torsoTop, headTop: headTop, tl: tl, tr: tl + B.torsoW - 1,
      hl: CX - Math.floor(B.headW / 2), shoulderY: torsoTop + 2,
      handR: { x: tl + B.torsoW + B.armW - 1, y: torsoTop + B.torsoH - 1 }, handL: { x: tl - B.armW, y: torsoTop + B.torsoH - 1 }
    };
  }

  // ---------- body parts ----------
  function drawLegs(b, g, o, E) {
    var B = g.B;
    if (B.robot) return;
    var lw = B.legW, gap = B.gender === 'f' ? 1 : 2, lx = CX - gap - lw + (B.gender === 'f' ? 0 : 0), rx = CX + gap - (B.gender === 'f' ? 0 : 0);
    if (B.gender === 'f') { lx = CX - lw - 1 + 1; rx = CX + 1; }
    var pants = o.pants || o.cloth, pr = ramp(pants), br = ramp(o.boots || '#5a3a22');
    var bootH = Math.max(3, Math.round(g.legH * 0.35));
    if (o.shorts) {
      srect(b, lx, g.legTop, lw, 4, pr); srect(b, rx, g.legTop, lw, 4, pr);
      rect(b, lx, g.legTop + 4, lw, g.legH - 4 - bootH, B.skin); rect(b, rx, g.legTop + 4, lw, g.legH - 4 - bootH, B.skin);
      b.put(lx, g.legTop + 4, dk(B.skin, 0.15)); b.put(rx + lw - 1, g.legTop + 5, dk(B.skin, 0.15));
    } else if (B.gender === 'f') {
      rect(b, lx, g.legTop, lw, g.legH - bootH, lt(B.skin, 0)); rect(b, rx, g.legTop, lw, g.legH - bootH, B.skin);
      for (var j = 0; j < g.legH - bootH; j++) b.put(rx + lw - 1, g.legTop + j, dk(B.skin, 0.12));
    } else {
      srect(b, lx, g.legTop, lw, g.legH - bootH + 1, pr); srect(b, rx, g.legTop, lw, g.legH - bootH + 1, pr);
    }
    srect(b, lx - (B.gender === 'f' ? 0 : 1), g.foot - bootH, lw + (B.gender === 'f' ? 0 : 1), bootH, br);
    srect(b, rx, g.foot - bootH, lw + (B.gender === 'f' ? 0 : 1), bootH, br);
    b.put(lx - 1, g.foot - 1, br[0]); b.put(rx + lw, g.foot - 1, br[0]);
    if (o.trim && B.gender !== 'f') { rect(b, lx - 1, g.foot - bootH, lw + 1, 1, o.trim); rect(b, rx, g.foot - bootH, lw + 1, 1, o.trim); }
  }

  function drawSkirt(b, g, o, E) {
    var B = g.B; if (B.gender !== 'f' || !o.skirt) return;
    var top = g.legTop - 1, len = o.skirt === 'long' ? g.legH - 3 : o.skirt === 'mid' ? Math.round(g.legH * 0.55) : Math.round(g.legH * 0.5);
    var r = ramp(o.cloth), w0 = B.torsoW - 2, w1 = B.torsoW + (o.skirt === 'long' ? 8 : 5);
    if (o.skirt === 'leaf' || o.skirt === 'petal') { w1 = B.torsoW + 6; len = Math.round(g.legH * 0.65); }
    for (var j = 0; j < len; j++) {
      var w = Math.round(w0 + (w1 - w0) * (j / Math.max(1, len - 1))), x0 = CX - Math.floor(w / 2);
      for (var i = 0; i < w; i++) {
        var c = i === 0 ? r[2] : i === w - 1 ? r[0] : (i % 4 === 0 && j > 1 ? dk(o.cloth, 0.12) : r[1]);
        b.put(x0 + i, top + j, c);
      }
    }
    // hem: zigzag petals / leaf points / trim
    var hy = top + len, wl = w1, xl = CX - Math.floor(wl / 2);
    if (o.skirt === 'leaf' || o.skirt === 'petal') {
      for (var k = 0; k < wl; k += 3) { b.put(xl + k + 1, hy, r[1]); b.put(xl + k + 1, hy + 1, r[0]); }
    } else if (o.trim) { for (var m = 0; m < wl; m++) b.put(xl + m, hy - 1, o.trim); }
    if (o.sheer) { // translucent outer layer that reaches the ground
      for (var s = 0; s < g.foot - top; s++) { var ww = Math.round(w0 + 12 * (s / (g.foot - top))), xs = CX - Math.floor(ww / 2); for (var q = 0; q < ww; q++) b.put(xs + q, top + s, '#ffffff', 0.28); b.put(xs, top + s, '#fff7da', 0.6); b.put(xs + ww - 1, top + s, '#e6dcc0', 0.6); }
    }
    if (o.embroid) { for (var e = 2; e < len; e += 3) { b.put(CX - 2, top + e, o.trim); b.put(CX + 2, top + e + 1, o.trim); } }
    if (o.spots) { }
  }

  function drawTorso(b, g, o, E) {
    var B = g.B, x = g.tl, y = g.torsoTop, w = B.torsoW, h = B.torsoH;
    if (B.gender === 'f') { // slight waist taper
      var top = o.top;
      var base = o.metal && (top === 'breast' || top === 'lightplate') ? o.metal : o.cloth;
      var r = ramp(base);
      for (var j = 0; j < h; j++) {
        var inset = j > h * 0.45 && j < h * 0.85 ? 1 : 0;
        for (var i = inset; i < w - inset; i++) b.put(x + i, y + j, i === inset ? r[2] : i === w - 1 - inset ? r[0] : r[1]);
      }
      if (top === 'breast') { // chest plate over cloth
        var cr = ramp(o.cloth);
        for (var jj = Math.round(h * 0.55); jj < h; jj++) for (var ii = 1; ii < w - 1; ii++) b.put(x + ii, y + jj, ii === 1 ? cr[2] : ii === w - 2 ? cr[0] : cr[1]);
        rect(b, x + 1, y + Math.round(h * 0.55) - 1, w - 2, 1, o.trim || dk(o.metal, 0.2));
        b.put(CX, y + 3, E.gem); b.put(CX - 1, y + 3, E.r[2]);
      }
      if (top === 'lightplate') { rect(b, x + 1, y + 1, w - 2, 1, lt(o.metal, 0.4)); rect(b, x, y + h - 3, w, 1, o.trim); b.put(CX, y + 4, E.gem); }
      if (top === 'robe' || top === 'dress') {
        rect(b, CX - 1, y + 1, 2, h - 2, o.under || lt(base, 0.3));
        if (o.trim) { rect(b, x, y + h - 2, w, 1, o.trim); b.put(CX - 2, y + 1, o.trim); b.put(CX + 1, y + 1, o.trim); }
        b.put(CX, y + 3, E.gem);
      }
      if (top === 'tank') { rect(b, x + 1, y, 2, 3, B.skin); rect(b, x + w - 3, y, 2, 3, B.skin); rect(b, x + 2, y + h - 4, w - 4, 3, B.skin); b.put(CX, y + h - 3, dk(B.skin, 0.2)); }
      if (top === 'hunter') { for (var s = 0; s < 7; s++) b.put(x + 1 + ((s * 5) % (w - 2)), y + 2 + ((s * 3) % (h - 3)), '#4a2c14'); rect(b, x + 1, y + h - 2, w - 2, 1, '#6a4428'); if (o.fangs) { for (var f = -2; f <= 2; f += 2) { b.put(CX + f, y + 1, '#fff6e0'); b.put(CX + f, y + 2, '#e8dcc0'); } } }
      if (top === 'leather') { rect(b, x, y + h - 3, w, 2, dk(o.cloth, 0.3)); if (o.trim) rect(b, x + 1, y + 1, w - 2, 1, o.trim); b.put(CX + 2, y + h - 3, E.gem); }
      if (top === 'ninja') { for (var n = 0; n < h; n++) b.put(x + 2 + Math.floor(n / 3), y + n, o.trim); rect(b, x, y + h - 3, w, 2, o.trim); b.put(CX, y + h - 3, E.gem); }
      if (top === 'leaf') { for (var l = 0; l < w; l += 2) b.put(x + l, y + (l % 4 ? 2 : 3), dk(o.cloth, 0.25)); rect(b, x, y + h - 1, w, 1, o.under); }
      if (top === 'petal') { for (var p = 0; p < w; p += 2) { b.put(x + p, y + h - 1, dk(o.cloth, 0.2)); } b.put(CX, y + 2, E.gem); if (o.trim) rect(b, x + 1, y + h - 2, w - 2, 1, o.trim); }
      if (o.phoenix) { for (var q = 0; q < 4; q++) { line(b, x - 1 - q, y + 2 + q * 2, x - 3 - q, y + 4 + q * 2, q % 2 ? '#ffb43a' : '#ff5a2a'); } }
      if (o.fluffy) { }
      return;
    }
    // male / robot handled elsewhere
    var t = o.top, mr = o.metal ? ramp(o.metal) : null, cr2 = o.cloth ? ramp(o.cloth) : null;
    if (t === 'vest') {
      srect(b, x, y, w, h, ramp(o.under));
      srect(b, x, y, 4, h, cr2); srect(b, x + w - 4, y, 4, h, cr2);
      rect(b, x, y + h - 3, w, 2, '#4a2e1a'); b.put(CX, y + h - 3, '#c9a24a');
      b.put(x + 1, y + 4, dk(o.cloth, 0.3)); b.put(x + w - 2, y + 7, lt(o.cloth, 0.2)); // patches
    } else if (t === 'overall') {
      srect(b, x, y, w, h, ramp(o.under));
      srect(b, x + 2, y + 3, w - 4, h - 3, cr2); rect(b, x + 3, y, 2, 3, o.cloth); rect(b, x + w - 5, y, 2, 3, o.cloth);
      if (o.soot) { b.put(x + 4, y + 6, '#3a2a20'); b.put(x + 9, y + 8, '#3a2a20'); b.put(x + 6, y + 9, '#2a1e18'); }
    } else if (t === 'rags') {
      srect(b, x, y, w, h, ramp(o.cloth));
      for (var r2 = 0; r2 < w; r2 += 2) b.put(x + r2, y + h, o.cloth);
      if (o.bandage) { line(b, x, y + 3, x + w - 1, y + 7, o.under); line(b, x, y + 8, x + w - 1, y + 5, dk(o.under, 0.1)); }
    } else if (t === 'leather') {
      srect(b, x, y, w, h, cr2); rect(b, x, y + h - 3, w, 2, dk(o.cloth, 0.4)); b.put(CX, y + h - 3, E.gem);
      line(b, CX - 3, y + 1, CX, y + 5, dk(o.cloth, 0.4)); line(b, CX + 3, y + 1, CX, y + 5, dk(o.cloth, 0.4));
    } else if (t === 'coat') {
      srect(b, x, y, w, h, cr2); srect(b, x + 2, y + 1, w - 4, h - 5, mr);
      for (var fx = -2; fx < w + 2; fx += 2) { b.put(x + fx, y + h + 1, o.cloth); b.put(x + fx + 1, y + h + 3, dk(o.cloth, 0.2)); }
      for (var ry = 0; ry < h + 3; ry++) { b.put(x - 2, y + 4 + ry, o.cloth); b.put(x + w + 1, y + 4 + ry, o.cloth); }
      b.put(CX, y + 5, E.gem); b.put(CX, y + 6, E.r[0]);
    } else if (t === 'lava') {
      srect(b, x, y, w, h, mr);
      for (var c3 = 0; c3 < 6; c3++) { var cx3 = x + 2 + (c3 * 5) % (w - 3), cy3 = y + 2 + (c3 * 3) % (h - 3); line(b, cx3, cy3, cx3 + 2, cy3 + 1, o.trim); b.put(cx3 + 1, cy3, '#ffd07a'); }
      b.put(CX, y + 4, E.gem); b.put(CX - 1, y + 4, E.r[2]);
    } else if (t === 'plate' || t === 'scale') {
      srect(b, x, y, w, h, mr);
      rect(b, x + 1, y + 1, w - 2, 1, lt(o.metal, 0.45));
      line(b, CX - 1, y + 2, CX - 1, y + h - 4, dk(o.metal, 0.2)); // center ridge
      rect(b, x, y + h - 3, w, 2, o.trim || dk(o.metal, 0.35));
      if (t === 'scale') for (var sy = 3; sy < h - 3; sy += 2) for (var sx = (sy % 4 === 1 ? 1 : 2); sx < w - 1; sx += 3) { b.put(x + sx, y + sy, dk(o.metal, 0.3)); b.put(x + sx + 1, y + sy, lt(o.metal, 0.3)); }
      if (o.emblem) { rect(b, CX - 2, y + 4, 4, 4, o.trim || '#e0b84c'); rect(b, CX - 1, y + 5, 2, 2, E.gem); b.put(CX - 1, y + 5, E.r[2]); }
      if (o.runes) { for (var rn = 0; rn < 4; rn++) b.put(x + 2 + rn * 3, y + 6 + (rn % 2) * 2, E.glow); }
      if (o.toolbelt) { rect(b, x, y + h - 3, w, 2, '#5a3b24'); rect(b, x + 2, y + h - 2, 2, 3, '#9aa4b2'); rect(b, x + w - 5, y + h - 2, 3, 2, '#c08a3a'); }
      if (o.under && t === 'plate' && !o.trim) { rect(b, x - 0, y + h - 1, w, 1, o.under); }
    }
    if (o.feathers) { for (var fz = 0; fz < 5; fz++) { line(b, x - 1, y + h - 2 + fz, x - 3, y + h + 2 + fz, '#1a1620'); line(b, x + w, y + h - 2 + fz, x + w + 2, y + h + 2 + fz, '#1a1620'); } }
  }

  function drawPauldrons(b, g, o, E) {
    var B = g.B, n = o.pauldron || 0; if (!n) return;
    var col = o.metal || o.cloth, r = ramp(col), s = 2 + n, y = g.torsoTop - 1;
    sell(b, g.tl - 1, y + 2, s, 2 + Math.floor(n / 2), r); sell(b, g.tr + 1, y + 2, s, 2 + Math.floor(n / 2), r);
    if (o.trim) { for (var i = -s; i <= s; i++) { b.put(g.tl - 1 + i, y + 4 + Math.floor(n / 2), o.trim); b.put(g.tr + 1 + i, y + 4 + Math.floor(n / 2), o.trim); } }
    if (o.spikes) { line(b, g.tl - 2, y, g.tl - 4, y - 3, '#d8d0e0'); line(b, g.tr + 2, y, g.tr + 4, y - 3, '#d8d0e0'); line(b, g.tl, y - 1, g.tl - 1, y - 3, '#bcb4c8'); line(b, g.tr, y - 1, g.tr + 1, y - 3, '#bcb4c8'); }
    if (o.skulls) {
      [g.tl - 1, g.tr + 1].forEach(function (px) { ell(b, px, y + 1, 3, 3, '#e8e2d6'); b.put(px - 1, y + 1, '#1a0f1f'); b.put(px + 1, y + 1, '#1a0f1f'); b.put(px, y + 3, '#1a0f1f'); b.put(px - 1, y + 1, E.glow, 0.9); b.put(px + 1, y + 1, E.glow, 0.9); });
    }
    if (o.lions) {
      [g.tl - 2, g.tr + 2].forEach(function (px) { ell(b, px, y + 1, 5, 4, '#b57a2a'); ell(b, px, y + 1, 3, 3, '#e6be5a'); b.put(px - 1, y, '#3a1f10'); b.put(px + 1, y, '#3a1f10'); b.put(px, y + 2, '#ff7a1a'); for (var k = -5; k <= 5; k += 2) b.put(px + k, y - 3, '#8a4f1a'); });
    }
    if (o.barrier) { ring(b, g.tl - 1, y + 1, 5, 2, E.glow, 0.9); ring(b, g.tr + 1, y + 1, 5, 2, E.glow, 0.9); }
  }

  function drawArm(b, g, o, E, side, raised) {
    var B = g.B, x = side < 0 ? g.tl - B.armW : g.tr + 1, y = g.torsoTop + 1, len = B.torsoH - 1;
    var sleeve = B.robot ? o.metal : (o.top === 'tank' || o.top === 'dress' && o.cloth && B.gender === 'f' && (o.skirt === 'mid') && !o.metal) ? null : (o.metal && o.top !== 'breast' && o.top !== 'lightplate' ? o.metal : o.cloth);
    if (o.top === 'overall' || o.top === 'vest') sleeve = o.under;
    if (o.top === 'rags') sleeve = o.cloth;
    var skin = B.robot ? o.trim : B.skin;
    for (var j = 0; j < len; j++) {
      var col = sleeve && j < len - 3 ? sleeve : skin;
      if (B.gender === 'f' && j < 4 && o.top !== 'tank') col = sleeve || skin;
      for (var i = 0; i < B.armW; i++) b.put(x + i, y + j, i === (side < 0 ? 0 : B.armW - 1) ? dk(col, 0.25) : col);
    }
    // hand
    var hx = side < 0 ? g.handL.x : g.handR.x - B.armW + 1, hy = y + len;
    rect(b, hx, hy, B.armW, 2, B.robot ? dk(o.metal, 0.2) : skin);
    if (o.fluffy) { ell(b, hx + Math.floor(B.armW / 2), hy, 2, 2, '#fff4e4'); }
    if (o.metal && (o.top === 'plate' || o.top === 'scale' || o.top === 'lava' || B.robot)) rect(b, x, y + len - 4, B.armW, 1, o.trim || dk(o.metal, 0.3));
  }

  function drawHead(b, g, o, E, race, si) {
    var B = g.B, x = g.hl, y = g.headTop, w = B.headW, h = B.headH;
    if (B.robot) { drawRobotHead(b, g, o, E, si); return; }
    var sk = ramp(B.skin);
    rect(b, x, y + 1, w, h - 2, sk[1]); rect(b, x + 1, y, w - 2, h, sk[1]);
    for (var j = 2; j < h - 1; j++) b.put(x + w - 1, y + j, sk[0]);
    rect(b, x + 1, y + h - 1, w - 2, 1, sk[0]);
    // ears
    if (B.ears === 'elf') { line(b, x - 1, y + 5, x - 3, y + 3, sk[1]); b.put(x - 1, y + 6, sk[0]); line(b, x + w, y + 5, x + w + 2, y + 3, sk[0]); }
    // eyes
    var ey = y + Math.round(h * 0.52), eye = B.eye;
    if (B.gender === 'f') { rect(b, x + 2, ey - 1, 2, 3, eye); rect(b, x + w - 4, ey - 1, 2, 3, eye); b.put(x + 2, ey - 1, '#ffffff'); b.put(x + w - 4, ey - 1, '#ffffff'); b.put(x + 1, ey + 2, '#ffb3a8'); b.put(x + w - 2, ey + 2, '#ffb3a8'); }
    else { rect(b, x + 2, ey, 2, 2, eye); rect(b, x + w - 4, ey, 2, 2, eye); b.put(x + 2, ey, lt(eye, 0.5)); b.put(x + w - 4, ey, lt(eye, 0.5)); }
    b.put(CX, y + h - 3, dk(B.skin, 0.25));
    // hair
    var hc = ramp(B.hair);
    if (race === 'human') { rect(b, x, y - 1, w, 4, hc[1]); rect(b, x - 1, y + 1, 2, 5, hc[1]); rect(b, x + w - 1, y + 1, 2, 5, hc[0]); b.put(x + 3, y - 1, hc[2]); b.put(x + 4, y, hc[2]); b.put(x + 6, y + 3, hc[1]); }
    else if (race === 'dwarf') { rect(b, x, y - 1, w, 3, hc[1]); rect(b, x - 1, y + 1, 2, 5, hc[0]); rect(b, x + w - 1, y + 1, 2, 5, hc[0]);
      // beard + moustache
      rect(b, x - 1, y + h - 5, w + 2, 6, hc[1]); rect(b, x, y + h + 1, w, 3, hc[1]); rect(b, x + 2, y + h + 4, w - 4, 2, hc[0]); rect(b, x + 2, y + h - 5, w - 4, 1, hc[0]);
      for (var bb = 0; bb < w; bb += 3) b.put(x + bb, y + h + 2, hc[2]);
    }
    else if (race === 'demon') { rect(b, x, y - 1, w, 4, hc[1]); rect(b, x - 1, y, 2, 7, hc[1]); rect(b, x + w - 1, y, 2, 7, hc[0]); b.put(x + 2, y + 3, hc[1]); b.put(x + 5, y + 3, hc[1]); b.put(x + 3, y, hc[2]); }
    else { // female top hair + fringe
      rect(b, x - 1, y - 1, w + 2, 4, hc[1]); rect(b, x - 1, y + 2, 2, 8, hc[1]); rect(b, x + w - 1, y + 2, 2, 8, hc[0]);
      b.put(x + 2, y + 3, hc[1]); b.put(x + 5, y + 3, hc[1]); b.put(x + 3, y - 1, hc[2]); b.put(x + 4, y - 1, hc[2]); b.put(x + 4, y, hc[2]);
    }
    if (B.ears === 'fox') {
      poly(b, [[x - 1, y + 1], [x + 1, y - 6], [x + 4, y]], hc[1]); poly(b, [[x + w - 4, y], [x + w - 1, y - 6], [x + w + 1, y + 1]], hc[1]);
      b.put(x + 1, y - 3, '#fff0e0'); b.put(x + 1, y - 2, '#fff0e0'); b.put(x + w - 2, y - 3, '#fff0e0'); b.put(x + w - 2, y - 2, '#fff0e0');
      b.put(x + 1, y - 6, '#3a1f10'); b.put(x + w - 1, y - 6, '#3a1f10');
    }
    if (B.horns) drawHorns(b, x, y, w, si, E);
    // headgear by stage
    if (race === 'human' && si >= 1 && si <= 4) { // helmet band / crest
      var hm = o.metal; rect(b, x - 1, y - 2, w + 2, 3, hm); rect(b, x - 1, y - 2, w + 2, 1, lt(hm, 0.4));
      if (si >= 2) b.put(CX, y - 1, E.gem);
      if (o.crest) { line(b, CX, y - 3, CX - 1, y - 8, '#8fd0ff'); line(b, CX + 1, y - 3, CX + 3, y - 7, lt('#8fd0ff', 0.3)); }
    }
    if (o.circlet) { rect(b, x, y + 1, w, 1, '#f0c860'); b.put(CX, y, E.gem); b.put(CX - 1, y, E.r[2]); line(b, CX - 3, y - 1, CX - 4, y - 4, '#ffe8a0'); line(b, CX + 3, y - 1, CX + 4, y - 4, '#ffe8a0'); }
    if (race === 'dwarf' && si >= 1) { var dh = o.metal; rect(b, x - 1, y - 2, w + 2, 4, dh); rect(b, x - 1, y - 2, w + 2, 1, lt(dh, 0.4)); if (si >= 2) { line(b, x - 2, y - 1, x - 4, y - 5, '#e8e0d0'); line(b, x + w + 1, y - 1, x + w + 3, y - 5, '#e8e0d0'); } b.put(CX, y, E.gem); }
    if (race === 'fairy' && si === 0) { ell(b, CX, y - 1, 5, 2, '#6fbf4a'); b.put(CX + 3, y - 3, '#4e9a34'); }
    if (race === 'fairy' && si >= 1) { b.put(x + 1, y, '#ff7ab8'); b.put(x + 2, y - 1, '#ffd3ea'); b.put(x, y - 1, '#ffd3ea'); b.put(x + 1, y - 2, '#ffd3ea'); }
    if (race === 'high_elf' && si >= 1 && si <= 3) { rect(b, x, y, w, 1, si >= 2 ? '#e8c35a' : '#dff2ff'); b.put(CX, y - 1, E.gem); }
    if (race === 'beastkin' && si === 3) { rect(b, x - 1, y + 2, w + 2, 2, o.trim); line(b, x + w, y + 3, x + w + 5, y + 6, o.trim); }
    if (race === 'celestial' && si >= 2 && !o.crownLight) { rect(b, x, y, w, 1, '#e3bf5c'); b.put(CX, y - 1, E.gem); }
  }
  function drawBackHair(b, g, race) {
    var B = g.B; if (B.gender !== 'f') return;
    var x = g.hl, y = g.headTop, w = B.headW, hr = ramp(B.hair), hairLen = race === 'fairy' ? 9 : race === 'beastkin' ? 14 : 18;
    rect(b, x - 2, y + 3, w + 4, hairLen, hr[0]); rect(b, x - 1, y + 3, w + 2, hairLen - 1, hr[1]);
    for (var t = 0; t < w + 4; t += 2) b.put(x - 2 + t, y + 3 + hairLen, hr[0]);
    for (var k = 0; k < hairLen - 2; k += 3) { b.put(x - 1, y + 4 + k, hr[2]); }
  }
  function drawHorns(b, x, y, w, si, E) {
    var len = [2, 3, 4, 6, 7, 9][si], col = si >= 5 ? '#ff2a3d' : si >= 3 ? '#3a2a44' : '#5d4c64', tip = si >= 5 ? '#ffd0d6' : '#cdbcd6';
    for (var s = -1; s <= 1; s += 2) {
      var bx = s < 0 ? x + 1 : x + w - 2;
      for (var i = 0; i < len; i++) {
        var px = bx + s * Math.round(i * (si >= 2 ? 0.7 : 0.3)), py = y - 1 - i;
        if (si >= 3 && i > len * 0.6) px += s * 1;
        b.put(px, py, i === len - 1 ? tip : col); if (i < len * 0.5 && si >= 2) b.put(px - s, py, col);
      }
    }
  }
  function drawRobotHead(b, g, o, E, si) {
    var x = g.hl, y = g.headTop, w = g.B.headW, h = g.B.headH, r = ramp(o.metal);
    srect(b, x, y, w, h, r);
    rect(b, x + 1, y + 4, w - 2, 3, '#101318');
    var eye = si === 0 ? '#c8a060' : si === 1 ? '#ff3b30' : E.glow;
    if (si === 0) { b.put(x + 3, y + 5, eye); b.put(x + w - 4, y + 5, '#6a5a4a'); }
    else { rect(b, x + 2, y + 5, 2, 1, eye); rect(b, x + w - 4, y + 5, 2, 1, eye); if (si >= 3) rect(b, x + 1, y + 5, w - 2, 1, eye, 0.5); }
    rect(b, x + 2, y + h - 3, w - 4, 1, dk(o.metal, 0.4));
    line(b, CX, y - 1, CX, y - 3, o.trim); b.put(CX, y - 4, si >= 1 ? eye : '#8a6e5a');
    if (si >= 3) { line(b, x, y + 1, x - 2, y - 2, o.trim); line(b, x + w - 1, y + 1, x + w + 1, y - 2, o.trim); }
    if (si === 5) { rect(b, x + 1, y - 2, w - 2, 2, '#e8bc58'); b.put(CX, y - 3, E.gem); }
    if (si === 0) { b.put(x + 2, y + 1, '#6a4a2a'); b.put(x + w - 3, y + 2, '#5a3a22'); }
  }

  function drawRobotBody(b, g, o, E, si) {
    var B = g.B, r = ramp(o.metal), tr = ramp(o.trim), x = g.tl, y = g.torsoTop;
    // legs
    var lx = CX - 1 - B.legW, rx = CX + 1;
    [lx, rx].forEach(function (px) {
      srect(b, px, g.legTop, B.legW, Math.round(g.legH * 0.5), r);
      srect(b, px, g.legTop + Math.round(g.legH * 0.5) - 1, B.legW, 2, tr);
      srect(b, px, g.legTop + Math.round(g.legH * 0.5) + 1, B.legW, g.legH - Math.round(g.legH * 0.5) - 1, r);
      srect(b, px - 1, g.foot - 3, B.legW + 2, 3, tr);
    });
    // torso
    srect(b, x, y, B.torsoW, B.torsoH, r);
    rect(b, x + 2, y + B.torsoH - 4, B.torsoW - 4, 1, dk(o.metal, 0.35));
    rect(b, x + 1, y + 1, B.torsoW - 2, 1, lt(o.metal, 0.35));
    srect(b, x + 2, y + B.torsoH - 3, B.torsoW - 4, 3, tr);
    if (o.core) { ell(b, CX, y + 5, 2, 2, E.r[1]); b.put(CX - 1, y + 4, '#ffffff'); }
    if (o.neon) { line(b, x + 1, y + 2, x + 1, y + B.torsoH - 2, E.glow); line(b, x + B.torsoW - 2, y + 2, x + B.torsoW - 2, y + B.torsoH - 2, E.glow); line(b, lx + 1, g.legTop + 2, lx + 1, g.foot - 4, E.glow); line(b, rx + B.legW - 2, g.legTop + 2, rx + B.legW - 2, g.foot - 4, E.glow); }
    if (o.wires) { line(b, x + 2, y + B.torsoH, x + 1, y + B.torsoH + 5, '#c0392b'); line(b, x + B.torsoW - 3, y + B.torsoH, x + B.torsoW - 1, y + B.torsoH + 4, '#2a6fc0'); b.put(x + 4, y + 3, '#6a4a2a'); b.put(x + 9, y + 7, '#5a3a22'); b.put(x + 6, y + 10, '#4a3020'); }
    if (si === 1) { rect(b, x + 3, y + 4, 2, 2, '#ff3b30'); }
    // shoulders
    sell(b, g.tl - 1, y + 2, 3, 3, tr); sell(b, g.tr + 1, y + 2, 3, 3, tr);
  }

  // low stages carry the element in a sash / scarf / paint stripe so all 8 variants read apart
  function elementAccent(b, g, o, E, race, si) {
    var B = g.B, y = g.torsoTop, x = g.tl, w = B.torsoW, h = B.torsoH;
    if (B.robot) { line(b, x + 1, y + 2, x + w - 3, y + h - 5, E.r[1], 2); b.put(x + 2, y + 2, E.r[2]); return; }
    // sash across the chest + belt band in element colour
    for (var i = 0; i < w; i++) { var yy = y + 1 + Math.round(i * (h - 5) / w); b.put(x + i, yy, E.r[1]); b.put(x + i, yy + 1, E.r[0]); }
    rect(b, x, y + h - 2, w, 1, E.r[1]);
    // neck scarf knot
    rect(b, CX - 2, y - 1, 4, 2, E.r[1]); b.put(CX - 2, y - 1, E.r[2]);
    if (si === 0) { line(b, CX + 1, y + 1, CX + 3, y + 5, E.r[0]); }
  }

  // ---------- back attachments ----------
  function featherWing(b, rx, ry, side, span, height, tilt, col, tip, alpha) {
    // fan of feathers from root (rx,ry) outward
    var n = Math.max(3, Math.round(span / 2.2));
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), ang = (-70 + t * 115 + tilt) * Math.PI / 180;
      var len = height * (0.55 + 0.45 * Math.sin(t * Math.PI * 0.9 + 0.2)) * (0.7 + 0.3 * (1 - t)) + span * 0.35 * t;
      var ex = rx + side * Math.cos(ang) * len, ey = ry + Math.sin(ang) * len * 0.8;
      line(b, rx, ry, ex, ey, i % 2 ? col : dk(col, 0.08), 2, alpha);
      b.put(ex, ey, tip, alpha); b.put(ex - side, ey, tip, alpha);
    }
    // covert (upper) feathers
    ell(b, rx + side * Math.round(span * 0.18), ry - 1, Math.max(1, Math.round(span * 0.2)), 2, lt(col, 0.3), alpha);
  }
  // one long, distinct feather wing pointing along an angle (used for multi-pair seraph wings)
  function bladeWing(b, glowB, rx, ry, side, deg, len, wid, col, edge, glowCol) {
    var a = deg * Math.PI / 180, dx = side * Math.cos(a), dy = Math.sin(a), px = -dy, py = dx; // perpendicular
    var pts = [], k, n = 6;
    for (k = 0; k <= n; k++) { var t = k / n, w = wid * (1 - t * 0.75) * (k === n ? 0 : 1); pts.push([rx + dx * len * t + px * w * 0.5, ry + dy * len * t + py * w * 0.5]); }
    for (k = n; k >= 0; k--) { var t2 = k / n, w2 = wid * (1 - t2 * 0.75); pts.push([rx + dx * len * t2 - px * w2 * 0.5 * 1.3, ry + dy * len * t2 - py * w2 * 0.5 * 1.3]); }
    poly(b, pts, col);
    // feather serration along the trailing edge + quill line
    for (var f = 3; f < len - 2; f += 3) { var fx = rx + dx * f - px * wid * 0.55 * (1 - f / len * 0.75), fy = ry + dy * f - py * wid * 0.55 * (1 - f / len * 0.75); b.put(fx, fy, edge); }
    line(b, rx, ry, rx + dx * (len - 2), ry + dy * (len - 2), lt(col, 0.6));
    if (glowB) { line(glowB, rx + dx * len * 0.5, ry + dy * len * 0.5, rx + dx * (len + 2), ry + dy * (len + 2), glowCol, 2, 0.55); spark(glowB, Math.round(rx + dx * (len + 1)), Math.round(ry + dy * (len + 1)), glowCol, 1); }
  }
  function energyWing(b, rx, ry, side, span, height, tilt, col, alpha) {
    var n = Math.max(3, Math.round(span / 3));
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), ang = (-75 + t * 110 + tilt) * Math.PI / 180, len = height * (0.6 + 0.4 * (1 - Math.abs(t - 0.35))) ;
      var ex = rx + side * Math.cos(ang) * len * (span / height), ey = ry + Math.sin(ang) * len * 0.75;
      line(b, rx, ry, ex, ey, col, 1, alpha);
      b.put(ex, ey, '#ffffff', alpha);
    }
  }
  function butterflyWing(b, rx, ry, side, size, col, edge, alpha) {
    ell(b, rx + side * size, ry - Math.round(size * 0.6), size, Math.round(size * 0.9), col, alpha);
    ell(b, rx + side * Math.round(size * 0.8), ry + Math.round(size * 0.55), Math.round(size * 0.7), Math.round(size * 0.6), col, alpha);
    ring(b, rx + side * size, ry - Math.round(size * 0.6), size, Math.round(size * 0.9), edge, Math.min(1, alpha + 0.4));
    ring(b, rx + side * Math.round(size * 0.8), ry + Math.round(size * 0.55), Math.round(size * 0.7), Math.round(size * 0.6), edge, Math.min(1, alpha + 0.4));
    line(b, rx, ry, rx + side * size * 1.6, ry - size * 1.2, edge, 1, alpha);
  }
  function foxTail(b, bx, by, ang, len, col, tip, alpha, thick) {
    thick = thick || 4;
    for (var i = 0; i <= len; i++) {
      var t = i / len, a = ang + Math.sin(t * Math.PI) * 0.35;
      var x = bx + Math.cos(a) * i, y = by + Math.sin(a) * i - Math.sin(t * Math.PI) * 3;
      var r = Math.max(1, Math.round(thick * Math.sin(Math.min(1, t * 1.6 + 0.2) * Math.PI * 0.9)));
      ell(b, x, y, r, r, t > 0.78 ? tip : col, alpha);
    }
  }

  function drawBack(b, glowB, g, o, E, race, si) {
    var sy = g.torsoTop + 3;
    if (o.cape) {
      var cr = ramp(o.cape);
      poly(b, [[g.tl - 1, g.torsoTop + 1], [g.tr + 1, g.torsoTop + 1], [g.tr + 5, g.foot - 2], [g.tl - 5, g.foot - 2]], cr[1]);
      for (var y = g.torsoTop + 4; y < g.foot - 2; y += 2) { b.put(g.tl - 3 - Math.floor((y - g.torsoTop) / 10), y, cr[0]); b.put(g.tr + 3 + Math.floor((y - g.torsoTop) / 10), y, cr[0]); }
      if (si >= 3) for (var p = 0; p < 6; p++) glowB.put(g.tl - 4 + p * 3, g.foot - 3 - (p % 3) * 4, E.glow, 0.7);
    }
    if (race === 'human' && si === 5) { // 4 light blades
      [[-1, -40, 26], [-1, -10, 22], [1, -40, 26], [1, -10, 22]].forEach(function (v) {
        var a = (v[1]) * Math.PI / 180, ex = CX + v[0] * (6 + Math.cos(a) * v[2]), ey = sy + Math.sin(a) * v[2];
        line(glowB, CX + v[0] * 4, sy, ex, ey, E.glow, 3, 0.55); line(glowB, CX + v[0] * 4, sy, ex, ey, '#ffffff', 1, 0.95);
      });
    }
    if (race === 'dwarf' && o.furnace) {
      srect(b, CX + 5, g.torsoTop - 2, 8, 10, ramp('#3b3640')); rect(b, CX + 7, g.torsoTop + 3, 4, 3, '#ff7a1a'); b.put(CX + 8, g.torsoTop + 4, '#ffe08a');
      rect(b, CX + 10, g.torsoTop - 7, 2, 5, '#5a5560');
      for (var s = 0; s < 5; s++) ell(glowB, CX + 12 + s * 2, g.torsoTop - 9 - s * 3, 2 + (s % 2), 2, '#9a95a0', 0.45);
    }
    if (race === 'dwarf' && o.pipes) {
      [[-9, 0], [9, 0]].forEach(function (v) { rect(b, CX + v[0] - 1, g.torsoTop - 6, 3, 9, '#6b737d'); rect(b, CX + v[0] - 1, g.torsoTop - 7, 3, 1, '#9aa4b2'); for (var s2 = 0; s2 < 4; s2++) ell(glowB, CX + v[0] + (v[0] > 0 ? s2 : -s2), g.torsoTop - 9 - s2 * 3, 2, 2, s2 < 2 ? '#ff9a2e' : '#ffcf7a', 0.6 - s2 * 0.1); });
    }
    if (race === 'dwarf' && o.runes) {
      var glyphs = [[-16, -2], [16, -4], [-12, -12], [13, -14], [0, -18]];
      glyphs.forEach(function (gp, i) { var gx = CX + gp[0], gy = g.torsoTop + gp[1]; ell(glowB, gx, gy, 3, 2, '#8a8490', 0.35); line(glowB, gx - 1, gy - 1, gx + 1, gy + 1, E.glow, 1, 0.9); line(glowB, gx + 1, gy - 1, gx - 1, gy + 1, E.glow, 1, 0.9); });
    }
    if (race === 'machina' && o.jets) {
      [-1, 1].forEach(function (s) { srect(b, CX + s * 7 - 2, g.torsoTop, 4, 8, ramp(o.trim)); ell(glowB, CX + s * 7, g.torsoTop + 10, 1, 3, E.glow, 0.85); b.put(CX + s * 7, g.torsoTop + 9, '#ffffff'); });
      [CX - 4, CX + 4].forEach(function (hx) { ell(glowB, hx, g.foot + 1, 2, 1, E.glow, 0.7); });
    }
    if (race === 'machina' && o.jetArms) {
      // six thruster arms (3 per side) + plasma wings
      [-1, 1].forEach(function (s) {
        [-30, 0, 30].forEach(function (deg, k) {
          var a = deg * Math.PI / 180, ex = CX + s * (8 + Math.cos(a) * 16), ey = sy + Math.sin(a) * 14 - 4;
          line(b, CX + s * 5, sy, ex, ey, o.trim, 2); srect(b, ex - 2, ey - 2, 4, 4, ramp('#8e9aa8'));
          energyWing(glowB, ex, ey, s, 12, 10, deg - 5, E.glow, 0.75);
        });
      });
    }
    if (race === 'demon' && o.smokeWings) {
      [-1, 1].forEach(function (s) {
        for (var i = 0; i < 26; i++) { var t = i / 25, x = CX + s * (6 + t * 30), y = sy - 12 + Math.pow(t - 0.4, 2) * 30 + Math.sin(i) * 2; ell(b, x, y, 3 - Math.round(t), 3 + Math.round(t * 2), i % 3 ? '#1c1422' : '#2b1f33', 0.9); }
        for (var j = 0; j < 7; j++) { var x2 = CX + s * (12 + j * 4), y2 = sy + 6 + j * 2; line(b, x2, y2 - 8, x2 + s, y2 + 6, '#130e18', 2, 0.85); }
        for (var k = 0; k < 8; k++) ell(glowB, CX + s * (10 + k * 4), sy - 14 + (k % 3) * 4, 2, 2, E.glow, 0.35);
      });
    }
    if (race === 'celestial' && o.wings) {
      var n = o.wings, wc = '#ffffff', tip = E.r[2];
      if (n === 1) { [-1, 1].forEach(function (s) { featherWing(b, CX + s * 4, sy, s, 5, 5, 5, wc, tip, 1); }); }
      else if (n === 2) { [-1, 1].forEach(function (s) { featherWing(b, CX + s * 4, sy, s, 10, 10, 0, wc, tip, 1); }); }
      else if (n === 3) { [-1, 1].forEach(function (s) { featherWing(b, CX + s * 4, sy, s, 16, 15, -5, wc, tip, 1); }); }
      else if (n === 8) { // 4 pairs = 8 wings, each separate
        [[-58, 22, 6], [-24, 27, 7], [10, 24, 6], [42, 18, 5]].forEach(function (v, i) {
          [-1, 1].forEach(function (s) { bladeWing(b, glowB, CX + s * 4, sy - 1, s, v[0], v[1], v[2], i % 2 ? lt(E.r[2], 0.55) : '#ffffff', dk(E.r[1], 0.25), E.glow); });
        });
      } else if (n === 12) { // 6 pairs = 12 light wings
        [[-78, 22, 5], [-52, 29, 6], [-24, 33, 6], [4, 31, 6], [32, 26, 5], [58, 19, 4]].forEach(function (v, i) {
          [-1, 1].forEach(function (s) { bladeWing(b, glowB, CX + s * 4, sy - 2, s, v[0], v[1], v[2], i % 2 ? lt(E.r[2], 0.65) : '#ffffff', dk(E.r[1], 0.2), E.glow); });
        });
      }
    }
    if (race === 'fairy' && o.bfly) {
      var fc = o.bfly >= 3 ? E.r[2] : '#e8f8ff', ed = o.bfly >= 3 ? E.glow : '#b8e4ff';
      var size = [0, 7, 8, 9, 11, 12][o.bfly];
      [-1, 1].forEach(function (s) {
        if (o.bfly === 4) { butterflyWing(glowB, CX + s * 2, sy, s, size, E.glow, '#ffffff', 0.5); for (var d = 0; d < 10; d++) spark(glowB, CX + s * (6 + d * 2), sy - 10 + (d * 7) % 18, E.glow, 1); }
        else butterflyWing(b, CX + s * 2, sy, s, size, fc, ed, o.bfly === 3 ? 0.6 : 0.45);
        if (o.bfly === 3) { for (var rr = 0; rr < 5; rr++) b.put(CX + s * (5 + rr * 2), sy - 6 + rr, ['#ff6b6b', '#ffd36b', '#6bff9e', '#6bb8ff', '#c46bff'][rr], 0.9); }
      });
    }
    if (race === 'beastkin') {
      var tailCol = BODY.beastkin.hair, tipCol = '#fff4e4';
      if (o.nineTails) {
        for (var t9 = 0; t9 < 9; t9++) { var a9 = (-172 + t9 * 20.5) * Math.PI / 180; foxTail(glowB, CX, g.legTop - 2, a9, 31, E.glow, '#ffffff', 0.4, 4); foxTail(b, CX, g.legTop - 2, a9, 28, t9 % 2 ? tailCol : lt(tailCol, 0.18), E.r[2], 1, 3); }
      } else {
        foxTail(b, CX + 3, g.legTop + 1, -0.35, 14, tailCol, tipCol, 1, 3);
        if (o.glowTail) foxTail(glowB, CX + 3, g.legTop + 1, -0.35, 16, E.glow, '#ffffff', 0.45, 5);
      }
      if (o.scarf) { line(b, CX - 4, g.torsoTop + 1, CX - 14, g.torsoTop + 8, o.scarf, 2); line(b, CX - 14, g.torsoTop + 8, CX - 19, g.torsoTop + 7, o.scarf, 2); }
    }
    if (race === 'high_elf' && o.flowerRing) {
      ring(glowB, CX, g.legTop - 2, 18, 5, E.glow, 0.8);
      for (var f = 0; f < 10; f++) { var fa = f / 10 * Math.PI * 2; if (Math.sin(fa) < 0) { var fx = CX + Math.cos(fa) * 18, fy = g.legTop - 2 + Math.sin(fa) * 5; ell(b, fx, fy, 1, 1, '#ffb3d9'); b.put(fx, fy, E.gem); } }
      ring(glowB, CX, g.torsoTop - 2, 22, 22, E.glow, 0.35);
    }
    if (race === 'machina' && o.drones) {
      for (var dI = 0; dI < 8; dI++) { var da = dI / 8 * Math.PI * 2 + 0.2; if (Math.sin(da) < 0) drone(b, glowB, CX + Math.cos(da) * 34, g.torsoTop + 6 + Math.sin(da) * 16, E); }
    }
  }
  function drone(b, glowB, x, y, E) { x = Math.round(x); y = Math.round(y); poly(b, [[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]], E.r[1]); line(b, x, y - 3, x - 2, y, E.r[2]); b.put(x, y, '#ffffff'); ell(glowB, x, y, 5, 5, E.glow, 0.28); }
  function drawFront(b, glowB, g, o, E, race, si) {
    if (race === 'machina' && o.drones) { for (var dI = 0; dI < 8; dI++) { var da = dI / 8 * Math.PI * 2 + 0.2; if (Math.sin(da) >= 0) drone(b, glowB, CX + Math.cos(da) * 34, g.torsoTop + 6 + Math.sin(da) * 16, E); } }
    if (race === 'high_elf' && o.flowerRing) { for (var f = 0; f < 10; f++) { var fa = f / 10 * Math.PI * 2; if (Math.sin(fa) >= 0) { var fx = CX + Math.cos(fa) * 18, fy = g.legTop - 2 + Math.sin(fa) * 5; ell(b, fx, fy, 1, 1, '#ffd3ea'); b.put(fx, fy, E.gem); } } }
    if (o.halo) ring(glowB, CX, g.headTop - 3, 6, 2, '#ffe890', 1);
    if (o.crown && race === 'high_elf') { var cy = g.headTop - 7; [[-4, 0], [-2, -2], [0, -4], [2, -2], [4, 0]].forEach(function (p) { line(b, CX + p[0], cy + 3, CX + p[0], cy + p[1], lt(E.r[2], 0.3)); }); rect(b, CX - 5, cy + 3, 11, 1, '#d9e7f1'); b.put(CX, cy - 4, E.gem); ell(glowB, CX, cy, 7, 4, E.glow, 0.3); }
    if (o.crownLight) { var cy2 = g.headTop - 8; ring(glowB, CX, cy2, 8, 3, '#fff3b0', 1); [[-6, -3], [-3, -5], [0, -7], [3, -5], [6, -3]].forEach(function (p) { line(glowB, CX + p[0], cy2, CX + p[0], cy2 + p[1], '#ffffff', 1, 0.95); }); }
    if (o.pollen) { for (var p = 0; p < 8; p++) glowB.put(CX - 12 + (p * 7) % 25, g.torsoTop - 4 + (p * 5) % 26, E.glow, 0.85); }
    if (o.crystal) { poly(b, [[CX - 3, g.headTop - 3], [CX, g.headTop - 9], [CX + 3, g.headTop - 3]], lt(E.r[2], 0.4)); b.put(CX, g.headTop - 6, '#ffffff'); }
    if (race === 'machina' && si === 0) { }
  }

  // ---------- weapons ----------
  function blade(b, x0, y0, x1, y1, col, edge, th) { line(b, x0, y0, x1, y1, col, th || 2); line(b, x0, y0 - 1, x1, y1 - 1, edge, 1); }
  function metalFor(si) { return si === 0 ? ['#6e5a4a', '#8c6e55', '#a88a6a'] : si === 1 ? ['#6b737d', '#b3bcc7', '#eef2f6'] : ['#8e98a6', '#dfe6ee', '#ffffff']; }
  function drawWeapon(b, glowB, g, o, E, race, si, kind) {
    var H = g.handR, L = g.handL, m = metalFor(si), wood = ['#5a3a22', '#8a5a33', '#b07a4c'], em = E.r[1], gl = E.glow, strong = si >= 3;
    var glowLine = function (x0, y0, x1, y1, th, a) { line(glowB, x0, y0, x1, y1, gl, th || 3, a === undefined ? 0.45 : a); };
    switch (kind) {
      case 'sword': {
        var len = si === 0 ? 11 : 14, x = H.x, y = H.y;
        rect(b, x - 1, y - 1, 3, 1, si === 0 ? '#6a4a2a' : '#8a6a3a'); // guard
        blade(b, x, y - 2, x + 3, y - 2 - len, si === 0 ? (race === 'celestial' ? wood[1] : '#8c7a6a') : m[1], si === 0 ? wood[2] : m[2]);
        if (si === 0 && race !== 'celestial') { b.put(x + 1, y - 6, '#8a4a2a'); b.put(x + 2, y - 9, '#7a3a1a'); }
        rect(b, x, y, 1, 3, wood[0]);
        break;
      }
      case 'dualsword': {
        [H, L].forEach(function (h, i) { var s = i ? -1 : 1; rect(b, h.x - 1, h.y - 1, 3, 1, '#e0b84c'); blade(b, h.x, h.y - 2, h.x + s * 5, h.y - 15, m[1], m[2]); line(b, h.x + s, h.y - 4, h.x + s * 4, h.y - 12, em); rect(b, h.x, h.y, 1, 3, '#3a2a1a'); });
        break;
      }
      case 'swordshield': {
        var sx = L.x - 3, sy2 = L.y - 7; srect(b, sx, sy2, 7, 10, ramp('#f1ead6')); rect(b, sx + 1, sy2 + 1, 5, 1, '#e8bc58'); ell(b, sx + 3, sy2 + 5, 1, 2, em); rect(b, sx, sy2 + 9, 7, 1, '#e8bc58'); ell(glowB, sx + 3, sy2 + 5, 5, 6, gl, 0.35);
        rect(b, H.x - 1, H.y - 1, 3, 1, '#e8bc58'); blade(b, H.x, H.y - 2, H.x + 4, H.y - 18, m[1], '#ffffff', 1); line(b, H.x + 1, H.y - 5, H.x + 3, H.y - 14, em); glowLine(H.x, H.y - 2, H.x + 4, H.y - 18, 3, 0.35);
        break;
      }
      case 'spear': {
        line(b, H.x - 3, H.y + 8, H.x + 6, H.y - 26, '#b98d2f', 2); poly(b, [[H.x + 6, H.y - 34], [H.x + 9, H.y - 25], [H.x + 3, H.y - 25]], '#f4d27a'); line(b, H.x + 6, H.y - 33, H.x + 6, H.y - 26, '#ffffff');
        rect(b, H.x + 3, H.y - 25, 7, 1, '#e8bc58');
        for (var z = 0; z < 5; z++) line(glowB, H.x + 6 + (z % 2 ? 2 : -2), H.y - 36 + z * 3, H.x + 6 + (z % 2 ? -2 : 2), H.y - 34 + z * 3, gl, 1, 0.9);
        glowLine(H.x + 6, H.y - 34, H.x + 6, H.y - 24, 4, 0.5);
        break;
      }
      case 'greatsword': {
        rect(b, H.x - 3, H.y - 2, 7, 2, '#f0c860'); line(b, H.x, H.y, H.x, H.y + 4, '#5a3a22', 2);
        poly(b, [[H.x - 2, H.y - 3], [H.x + 3, H.y - 3], [H.x + 3, H.y - 32], [H.x, H.y - 37], [H.x - 2, H.y - 32]], '#fffdf2');
        line(b, H.x + 2, H.y - 4, H.x + 2, H.y - 32, '#e8dcb0'); line(b, H.x, H.y - 5, H.x, H.y - 33, em);
        glowLine(H.x, H.y - 3, H.x, H.y - 37, 7, 0.4); glowLine(H.x, H.y - 3, H.x, H.y - 37, 3, 0.7);
        break;
      }
      case 'wrench': {
        line(b, H.x, H.y + 2, H.x + 3, H.y - 9, si === 0 ? '#7a6a5a' : m[1], 2);
        rect(b, H.x + 1, H.y - 13, 5, 3, si === 0 ? '#8a6a4a' : m[1]); b.clear(H.x + 3, H.y - 13); b.clear(H.x + 3, H.y - 12);
        if (si === 0) { b.put(H.x + 2, H.y - 5, '#9a4a2a'); b.put(H.x + 1, H.y - 2, '#8a3a1a'); }
        break;
      }
      case 'hammer': {
        line(b, H.x, H.y + 3, H.x + 2, H.y - 10, wood[1], 2); srect(b, H.x - 2, H.y - 15, 8, 5, ramp(m[1])); if (si >= 1) b.put(H.x + 2, H.y - 13, em);
        break;
      }
      case 'dualaxe': {
        [H, L].forEach(function (h, i) { var s = i ? -1 : 1; line(b, h.x, h.y + 3, h.x + s * 2, h.y - 11, wood[1], 2); poly(b, [[h.x + s * 2, h.y - 12], [h.x + s * 8, h.y - 15], [h.x + s * 8, h.y - 6], [h.x + s * 2, h.y - 8]], '#cfe3ee'); line(b, h.x + s * 8, h.y - 15, h.x + s * 8, h.y - 6, '#ffffff'); b.put(h.x + s * 5, h.y - 10, em); });
        break;
      }
      case 'blunderbuss': {
        line(b, H.x - 6, H.y + 1, H.x + 10, H.y - 5, '#6b4a2e', 3); line(b, H.x - 2, H.y - 1, H.x + 12, H.y - 6, '#3b3640', 2);
        poly(b, [[H.x + 11, H.y - 9], [H.x + 16, H.y - 11], [H.x + 16, H.y - 2], [H.x + 12, H.y - 4]], '#4a4550');
        line(b, H.x + 12, H.y - 8, H.x + 15, H.y - 9, '#ff7a1a'); line(b, H.x + 12, H.y - 5, H.x + 15, H.y - 4, '#ff7a1a');
        ell(glowB, H.x + 17, H.y - 6, 2, 3, gl, 0.6);
        break;
      }
      case 'warhammer': {
        line(b, H.x, H.y + 5, H.x + 3, H.y - 12, '#8a6a3a', 2); srect(b, H.x - 4, H.y - 21, 13, 9, ramp('#a7b0bb')); rect(b, H.x - 4, H.y - 17, 13, 1, '#e8bc58'); ell(b, H.x + 2, H.y - 17, 1, 1, em);
        for (var k = 0; k < 6; k++) { var ka = k * 1.05; line(glowB, H.x + 2 + Math.cos(ka) * 8, H.y - 17 + Math.sin(ka) * 7, H.x + 2 + Math.cos(ka) * 11, H.y - 17 + Math.sin(ka) * 9, gl, 1, 0.95); }
        break;
      }
      case 'towershield': {
        var tx = L.x - 9, ty = g.torsoTop - 6; srect(b, tx, ty, 14, 30, ramp('#b58f3a')); srect(b, tx + 2, ty + 2, 10, 26, ramp('#7a7480'));
        rect(b, tx + 6, ty + 3, 2, 24, '#e6be5a'); rect(b, tx + 3, ty + 12, 8, 2, '#e6be5a'); ell(b, tx + 7, ty + 13, 2, 2, em); b.put(tx + 6, ty + 12, '#ffffff');
        for (var d2 = 0; d2 < 4; d2++) b.put(tx + 3 + d2 * 2, ty + 5 + d2 * 5, '#a09aa8');
        ring(glowB, tx + 7, g.foot - 12, 22, 20, gl, 0.4); ring(glowB, tx + 7, g.foot - 12, 21, 19, '#ffe890', 0.25);
        break;
      }
      case 'piston': {
        line(b, H.x, H.y + 3, H.x + 3, H.y - 10, '#5b6270', 2); srect(b, H.x - 3, H.y - 18, 12, 8, ramp('#c9d1dc')); rect(b, H.x - 1, H.y - 16, 8, 1, '#6b737d'); rect(b, H.x + 8, H.y - 17, 3, 6, '#8e9aa8');
        ell(glowB, H.x + 12, H.y - 14, 2, 2, '#e8f2ff', 0.6); ell(glowB, H.x + 14, H.y - 17, 2, 2, '#e8f2ff', 0.4); b.put(H.x + 2, H.y - 14, em);
        break;
      }
      case 'plasmaaxe': {
        line(b, H.x, H.y + 4, H.x + 3, H.y - 14, '#2e2c36', 2); rect(b, H.x + 1, H.y - 16, 3, 3, '#e0b84c');
        poly(glowB, [[H.x + 4, H.y - 18], [H.x + 13, H.y - 22], [H.x + 14, H.y - 9], [H.x + 4, H.y - 12]], gl, 0.8); line(glowB, H.x + 13, H.y - 22, H.x + 14, H.y - 9, '#ffffff', 1, 1);
        break;
      }
      case 'armcannon': {
        // replaces right arm: erase hand, draw cannon mounted on shoulder
        var ax = g.tr + 1, ay = g.torsoTop + 2;
        for (var yy = ay - 1; yy < ay + 16; yy++) for (var xx = ax; xx < ax + 6; xx++) b.clear(xx, yy);
        srect(b, ax - 1, ay, 6, 6, ramp('#d9b24a')); srect(b, ax + 1, ay + 3, 13, 7, ramp('#2e3038')); rect(b, ax + 12, ay + 2, 4, 9, '#4a4c56');
        for (var bi = 0; bi < 3; bi++) rect(b, ax + 16, ay + 3 + bi * 3, 3, 1, '#9aa4b2');
        rect(b, ax + 3, ay + 5, 8, 1, E.glow); ell(glowB, ax + 19, ay + 6, 2, 4, gl, 0.8);
        break;
      }
      case 'drones': break; // drawn with back/front layers
      case 'dagger': {
        rect(b, H.x - 1, H.y - 1, 3, 1, si === 0 ? '#8a6a4a' : '#6b737d'); line(b, H.x + 1, H.y - 2, H.x + 3, H.y - 8, si === 0 ? (race === 'beastkin' ? wood[1] : '#8c7a6a') : m[1], 1); line(b, H.x + 2, H.y - 2, H.x + 4, H.y - 7, si === 0 ? wood[2] : m[2]);
        if (si === 0 && race === 'demon') b.put(H.x + 2, H.y - 5, '#7a3a1a');
        break;
      }
      case 'dualdagger': {
        [H, L].forEach(function (h, i) { var s = i ? -1 : 1; rect(b, h.x - 1, h.y - 1, 3, 1, '#3a2a44'); poly(b, [[h.x, h.y - 2], [h.x + s * 2, h.y - 2], [h.x + s * 5, h.y - 11]], '#e9e0d0'); line(glowB, h.x + s, h.y - 3, h.x + s * 5, h.y - 11, gl, 1, 0.9); });
        break;
      }
      case 'whip': {
        rect(b, H.x, H.y - 3, 2, 5, '#2a1f33');
        var px = H.x + 1, py = H.y - 3; for (var wI = 0; wI < 26; wI++) { var nx = H.x + 1 + wI * 0.9, ny = H.y - 3 - Math.sin(wI / 26 * Math.PI * 1.4) * 14 + wI * 0.3; line(b, px, py, nx, ny, '#3a2a44'); if (wI % 4 === 0) b.put(nx, ny - 1, '#e8e2d6'); px = nx; py = ny; }
        for (var fl = 0; fl < 5; fl++) ell(glowB, H.x + 20 + fl, H.y - 8 - fl * 2, 2, 2, gl, 0.6);
        break;
      }
      case 'flail': {
        rect(b, H.x - 1, H.y - 2, 3, 6, '#2a2430'); var cx0 = H.x + 1, cy0 = H.y - 3;
        for (var c = 0; c < 6; c++) b.put(cx0 + c * 1.6, cy0 - c * 1.8, c % 2 ? '#8f98a6' : '#c9d1dc');
        var bx = cx0 + 12, by = cy0 - 12; ell(b, bx, by, 4, 4, '#3a3342'); ell(b, bx - 1, by - 1, 2, 2, '#5a5064');
        [[0, -6], [6, 0], [0, 6], [-6, 0], [4, -4], [4, 4], [-4, 4], [-4, -4]].forEach(function (s) { line(b, bx + s[0] * 0.6, by + s[1] * 0.6, bx + s[0], by + s[1], '#d8d0e0'); });
        ell(glowB, bx, by, 7, 7, E.glow, 0.45); for (var ff = 0; ff < 4; ff++) ell(glowB, bx + 2 - ff, by - 6 - ff * 2, 2, 2, '#ff4a2a', 0.55);
        break;
      }
      case 'scythe': {
        line(b, H.x - 4, H.y + 10, H.x + 4, H.y - 30, '#2a2030', 2);
        var sx0 = H.x + 4, sy0 = H.y - 30;
        for (var s3 = 0; s3 < 20; s3++) { var a3 = -0.3 - s3 * 0.09, rr = 20 - s3 * 0.35; var ex = sx0 - Math.cos(a3) * rr * (s3 / 20) - s3 * 0.9, ey = sy0 + Math.sin(-a3) * 2 + s3 * 0.55 - Math.sin(s3 / 20 * Math.PI) * 4; line(b, sx0 - s3 * 1.1, sy0 + Math.sin(s3 / 20 * Math.PI) * -3 + s3 * 0.35, sx0 - s3 * 1.1, sy0 + Math.sin(s3 / 20 * Math.PI) * -3 + s3 * 0.35 + (s3 < 16 ? 3 : 2), '#d8d0e6'); }
        line(b, sx0, sy0 - 1, sx0 - 21, sy0 + 5, '#ffffff'); line(glowB, sx0, sy0, sx0 - 22, sy0 + 7, gl, 3, 0.6);
        for (var sp = 0; sp < 4; sp++) ell(glowB, sx0 - 6 - sp * 5, sy0 - 3 + sp, 1, 1, '#ff2a3d', 0.8);
        break;
      }
      case 'twigstaff': case 'staff': case 'greatstaff': {
        var top = kind === 'greatstaff' ? 34 : kind === 'staff' ? 24 : 20;
        line(b, H.x, H.y + 8, H.x + 2, H.y - top, kind === 'twigstaff' ? '#7a5534' : kind === 'staff' ? '#6b4a2e' : '#8a6a3a', 2);
        if (kind === 'twigstaff') { line(b, H.x + 2, H.y - top, H.x + 5, H.y - top - 3, '#7a5534'); b.put(H.x + 4, H.y - top + 1, '#6fbf4a'); b.put(H.x - 1, H.y - top + 4, '#6fbf4a'); }
        if (kind === 'staff') { srect(b, H.x, H.y - top - 3, 5, 4, ramp('#b3bcc7')); b.put(H.x + 2, H.y - top - 2, em); }
        if (kind === 'greatstaff') {
          for (var br = 0; br < 5; br++) line(b, H.x + 2, H.y - top, H.x + 2 + (br - 2) * 3, H.y - top - 5 - (br % 2) * 2, '#8a6a3a');
          for (var lf = 0; lf < 6; lf++) b.put(H.x + (lf - 3) * 3, H.y - top - 6 - (lf % 3), '#6fdc8a');
          ell(b, H.x + 2, H.y - top - 11, 3, 3, E.r[1]); b.put(H.x + 1, H.y - top - 12, '#ffffff'); ell(glowB, H.x + 2, H.y - top - 11, 7, 7, gl, 0.5);
        }
        break;
      }
      case 'rapier': {
        ring(b, H.x, H.y - 1, 2, 2, '#e8c35a'); line(b, H.x + 1, H.y - 2, H.x + 6, H.y - 20, race === 'celestial' ? '#ffffff' : '#e9eef3'); b.put(H.x + 6, H.y - 21, '#ffffff');
        if (race === 'celestial') glowLine(H.x + 1, H.y - 2, H.x + 6, H.y - 21, 3, 0.55); else line(b, H.x + 2, H.y - 6, H.x + 4, H.y - 12, em);
        break;
      }
      case 'longbow': {
        var bxx = L.x - 2; for (var bw = -16; bw <= 16; bw++) { var bx2 = bxx - Math.round(6 * Math.cos(bw / 16 * Math.PI / 2)); b.put(bx2, L.y - 4 + bw, bw % 5 === 0 ? '#e8c35a' : '#8a6a3a'); b.put(bx2 - 1, L.y - 4 + bw, '#5a3a22'); }
        line(b, bxx, L.y - 20, bxx, L.y + 12, '#e8f4ff'); line(b, bxx - 4, L.y - 4, H.x, L.y - 4, '#d8c79a');
        for (var wd = 0; wd < 4; wd++) line(glowB, bxx - 10 - wd * 3, L.y - 8 + wd * 3, bxx - 14 - wd * 3, L.y - 8 + wd * 3, gl, 1, 0.8);
        break;
      }
      case 'shortbow': {
        var sbx = L.x - 1; for (var sw = -9; sw <= 9; sw++) { b.put(sbx - Math.round(4 * Math.cos(sw / 9 * Math.PI / 2)), L.y - 3 + sw, si <= 1 ? '#8a5a33' : '#5a3a22'); }
        if (si === 1) { b.put(sbx - 4, L.y - 3, '#b3bcc7'); b.put(sbx - 1, L.y - 12, '#b3bcc7'); b.put(sbx - 1, L.y + 6, '#b3bcc7'); }
        line(b, sbx, L.y - 12, sbx, L.y + 6, '#f0e6d0'); if (si >= 2) { line(b, sbx - 8, L.y - 3, sbx + 2, L.y - 3, '#d8c79a'); b.put(sbx - 9, L.y - 3, em); }
        break;
      }
      case 'orb': {
        ell(b, H.x + 3, H.y - 8, 4, 4, E.r[1]); ell(b, H.x + 2, H.y - 9, 2, 2, E.r[2]); b.put(H.x + 1, H.y - 10, '#ffffff'); ring(glowB, H.x + 3, H.y - 8, 7, 7, gl, 0.6); ell(glowB, H.x + 3, H.y - 8, 6, 6, gl, 0.3);
        break;
      }
      case 'knuckles': {
        [H, L].forEach(function (h) { srect(b, h.x - 2, h.y - 1, 5, 4, ramp('#b3bcc7')); b.put(h.x, h.y, em); ell(glowB, h.x, h.y + 1, 4, 4, gl, 0.55); });
        break;
      }
      case 'chakram': {
        var chx = H.x + 5, chy = H.y - 9; ring(b, chx, chy, 5, 5, '#e9eef3'); ring(b, chx, chy, 4, 4, '#b3bcc7'); for (var ci = 0; ci < 8; ci++) { var ca = ci / 8 * Math.PI * 2; b.put(chx + Math.cos(ca) * 6, chy + Math.sin(ca) * 6, '#ffffff'); }
        b.put(chx, chy, em); ring(glowB, chx, chy, 8, 8, gl, 0.45); line(glowB, chx - 8, chy + 4, chx - 14, chy + 7, gl, 1, 0.6);
        break;
      }
      case 'claw': {
        [H, L].forEach(function (h, i) { var s = i ? -1 : 1; for (var cl = 0; cl < 3; cl++) { line(glowB, h.x - 1 + cl * s, h.y, h.x + s * (4 + cl * 2), h.y - 9 - cl, '#8fd8ff', 2, 0.9); line(b, h.x - 1 + cl * s, h.y, h.x + s * (3 + cl * 2), h.y - 7 - cl, '#e8f8ff'); } line(glowB, h.x - 1, h.y, h.x + s * 8, h.y - 12, gl, 3, 0.35); });
        break;
      }
      case 'orbflail': {
        rect(b, H.x - 1, H.y - 2, 3, 5, '#e8bc58'); for (var oc = 0; oc < 6; oc++) b.put(H.x + 1 + oc * 1.6, H.y - 3 - oc * 1.6, oc % 2 ? '#e8bc58' : '#fff0b0');
        var ox = H.x + 12, oy = H.y - 13; ell(b, ox, oy, 4, 4, '#ffe890'); ell(b, ox - 1, oy - 1, 2, 2, '#ffffff'); b.put(ox + 1, oy + 1, em); ell(glowB, ox, oy, 8, 8, gl, 0.45);
        for (var ray = 0; ray < 8; ray++) { var ra = ray / 8 * Math.PI * 2; line(glowB, ox + Math.cos(ra) * 6, oy + Math.sin(ra) * 6, ox + Math.cos(ra) * 9, oy + Math.sin(ra) * 9, '#fff3b0', 1, 0.9); }
        break;
      }
      case 'lyre': {
        var lx = H.x + 1, ly = H.y - 4; line(b, lx - 3, ly, lx - 5, ly - 12, '#e8bc58', 2); line(b, lx + 5, ly, lx + 7, ly - 12, '#e8bc58', 2); rect(b, lx - 4, ly - 13, 12, 2, '#f6d56a'); rect(b, lx - 3, ly, 9, 2, '#b58f3a');
        for (var st = 0; st < 4; st++) line(b, lx - 1 + st * 2, ly - 11, lx - 1 + st * 2, ly - 1, '#fffbe8');
        for (var wv = 0; wv < 3; wv++) ring(glowB, lx + 1, ly - 6, 9 + wv * 4, 7 + wv * 3, gl, 0.45 - wv * 0.12);
        break;
      }
      case 'scepter': {
        line(b, H.x, H.y + 6, H.x + 2, H.y - 26, '#f0c860', 2); rect(b, H.x - 3, H.y - 34, 9, 2, '#f6d56a'); rect(b, H.x + 1, H.y - 38, 2, 10, '#f6d56a'); b.put(H.x + 1, H.y - 33, em); b.put(H.x + 2, H.y - 33, em);
        ell(glowB, H.x + 2, H.y - 33, 9, 9, gl, 0.4); for (var sr = 0; sr < 12; sr++) { var sa = sr / 12 * Math.PI * 2; line(glowB, H.x + 2 + Math.cos(sa) * 5, H.y - 33 + Math.sin(sa) * 5, H.x + 2 + Math.cos(sa) * 11, H.y - 33 + Math.sin(sa) * 11, '#fffbe6', 1, 0.8); }
        break;
      }
      case 'wand': {
        line(b, H.x, H.y, H.x + 4, H.y - 9, '#7a5534'); b.put(H.x + 5, H.y - 10, '#b8f08a'); spark(glowB, H.x + 5, H.y - 11, '#d8ffb0', 1);
        break;
      }
      case 'needle': {
        line(b, H.x, H.y, H.x + 5, H.y - 11, '#dfe6ee'); b.put(H.x + 5, H.y - 12, '#ffffff'); ring(b, H.x, H.y - 1, 1, 1, '#b3bcc7');
        break;
      }
      case 'darts': {
        for (var dt = 0; dt < 4; dt++) { var dx = H.x + 4 + dt * 3, dy = H.y - 8 - (dt % 2) * 4; line(b, dx, dy, dx + 2, dy - 2, '#e9eef3'); b.put(dx - 1, dy + 1, em); }
        spark(b, H.x + 2, H.y - 3, '#ffe890', 1); spark(glowB, H.x + 14, H.y - 12, gl, 1);
        break;
      }
      case 'flute': {
        line(b, H.x - 6, H.y - 5, H.x + 6, H.y - 9, '#a07040', 2); for (var fh = 0; fh < 4; fh++) b.put(H.x - 3 + fh * 3, H.y - 7 - fh, '#3a2412');
        for (var nt = 0; nt < 3; nt++) { var nx2 = H.x + 9 + nt * 4, ny2 = H.y - 14 - nt * 3; rect(glowB, nx2, ny2, 1, 4, gl, 0.9); rect(glowB, nx2 - 2, ny2 + 3, 2, 2, gl, 0.9); }
        break;
      }
      case 'vinewand': {
        for (var vv = 0; vv < 18; vv++) b.put(H.x + Math.sin(vv / 2) * 1.5 + vv * 0.15, H.y - vv, vv % 3 ? '#4e9a34' : '#6fbf4a');
        ell(b, H.x + 3, H.y - 20, 3, 3, '#ff9ccf'); b.put(H.x + 3, H.y - 20, E.gem); for (var vt = 0; vt < 6; vt++) b.put(H.x - 2 - vt, g.foot - vt * 2, '#4e9a34');
        ell(glowB, H.x + 3, H.y - 20, 6, 6, gl, 0.4);
        break;
      }
      case 'grimoire': {
        var gx = H.x - 1, gy = H.y - 12; srect(b, gx, gy, 10, 8, ramp('#3f7a3a')); rect(b, gx + 1, gy + 1, 8, 6, '#f6ecd0'); rect(b, gx + 5, gy + 1, 1, 6, '#c8b890'); b.put(gx + 2, gy + 3, '#e8bc58'); b.put(gx + 7, gy + 4, '#e8bc58');
        for (var gl2 = 0; gl2 < 8; gl2++) { var ga = gl2 / 8 * Math.PI * 2; ell(glowB, gx + 5 + Math.cos(ga) * 11, gy + 2 + Math.sin(ga) * 8, 1, 1, gl2 % 2 ? '#8ff08a' : gl, 0.9); }
        ell(glowB, gx + 5, gy + 3, 9, 7, gl, 0.3);
        break;
      }
    }
  }

  // ---------- public: character ----------
  function renderCharacter(race, elem, stage) {
    var si = { 1: 0, 10: 1, 20: 2, 35: 2, 50: 3, 65: 3, 80: 4, 99: 5 }[stage]; if (si === undefined) si = 0;
    var o = OUTFIT[race] ? OUTFIT[race][si] : OUTFIT.human[0];
    var E = ELEM[elem] || ELEM.fire, g = geom(race);
    var kind = (typeof QC !== 'undefined' ? QC : require('./core.js')).weaponKindOf(race, stage);
    var back = new Buf(W, H), main = new Buf(W, H), glowBack = new Buf(W, H), glowFront = new Buf(W, H);
    drawBack(back, glowBack, g, o, E, race, si);
    if (g.B.robot) drawRobotBody(main, g, o, E, si);
    else { drawBackHair(main, g, race); drawLegs(main, g, o, E); drawSkirt(main, g, o, E); drawTorso(main, g, o, E); }
    drawArm(main, g, o, E, -1); drawArm(main, g, o, E, 1);
    if (si <= 2) elementAccent(main, g, o, E, race, si);
    drawPauldrons(main, g, o, E);
    drawHead(main, g, o, E, race, si);
    drawWeapon(main, glowFront, g, o, E, race, si, kind);
    drawFront(main, glowFront, g, o, E, race, si);
    // outline: back layer and main layer separately, then stack
    var ob = new Buf(W, H); outline(back, ob); var om = new Buf(W, H); outline(main, om);
    var base = composite([glowBack, ob, back, om, main, glowFront], W, H);
    var auraStrength = si >= 5 ? 3 : si >= 4 ? 2 : si >= 3 ? 1 : 0;
    var aura = makeAura(base, E.glow, auraStrength, hashStr(race + elem + stage));
    return { w: W, h: H, base: base.d, aura: aura.d, feetY: g.foot, headTop: g.headTop, anchor: { x: CX, y: FOOT }, nativeFacing: 'right' };
  }

  // ---------- teacher: Max, white wizard Lv.99 ----------
  function renderTeacher() {
    var main = new Buf(W, H), glow = new Buf(W, H), foot = FOOT;
    var robe = ramp('#f4f1ea'), gold = '#e8bc58';
    // robe
    poly(main, [[CX - 6, 44], [CX + 6, 44], [CX + 11, foot], [CX - 11, foot]], robe[1]);
    for (var y = 46; y < foot; y += 3) { main.put(CX - 7 - Math.floor((y - 44) / 8), y, robe[0]); main.put(CX + 7 + Math.floor((y - 44) / 8), y, robe[0]); }
    rect(main, CX - 11, foot - 2, 23, 2, gold); rect(main, CX - 1, 46, 2, foot - 48, '#d9d2bf'); rect(main, CX - 6, 58, 13, 2, gold);
    // sleeves
    poly(main, [[CX - 6, 45], [CX - 12, 58], [CX - 7, 59]], robe[2]); poly(main, [[CX + 6, 45], [CX + 12, 58], [CX + 7, 59]], robe[0]);
    rect(main, CX - 12, 58, 3, 2, '#f1c49a'); rect(main, CX + 10, 57, 3, 2, '#f1c49a');
    // head, beard
    rect(main, CX - 5, 33, 11, 11, '#f1c49a'); rect(main, CX - 3, 37, 2, 2, '#2a3a5a'); rect(main, CX + 2, 37, 2, 2, '#2a3a5a');
    rect(main, CX - 6, 39, 13, 6, '#f4f4f8'); poly(main, [[CX - 5, 44], [CX + 6, 44], [CX + 1, 58]], '#ececf2'); rect(main, CX - 3, 40, 7, 1, '#dcdce6');
    rect(main, CX - 6, 34, 2, 7, '#f4f4f8'); rect(main, CX + 5, 34, 2, 7, '#dcdce6');
    // hat
    poly(main, [[CX - 10, 34], [CX + 11, 34], [CX + 3, 14], [CX + 9, 9]], '#f8f6f0'); rect(main, CX - 11, 32, 23, 3, '#e6e2d6'); rect(main, CX - 8, 30, 17, 2, gold);
    main.put(CX + 1, 22, gold); main.put(CX + 1, 21, '#fff6c0'); main.put(CX, 22, gold); main.put(CX + 2, 22, gold); main.put(CX + 1, 23, gold);
    // staff
    line(main, CX + 12, foot, CX + 16, 26, '#8a6a3a', 2); ring(main, CX + 16, 22, 4, 4, gold); ell(main, CX + 16, 22, 2, 2, '#bfe9ff'); main.put(CX + 15, 21, '#ffffff');
    ell(glow, CX + 16, 22, 8, 8, '#fffbe6', 0.45);
    var om = new Buf(W, H); outline(main, om);
    var base = composite([om, main, glow], W, H);
    var aura = makeAura(base, '#fff6d8', 2, 99);
    return { w: W, h: H, base: base.d, aura: aura.d };
  }

  // ---------- monsters ----------
  var MONSTERS = [
    { id: 'green_slime', mode: 'natural-add', diff: 'easy', name: 'Green Slime', th: 'สไลม์เขียว' },
    { id: 'acid_red_slime', mode: 'natural-add', diff: 'medium', name: 'Acid Red Slime', th: 'สไลม์กรดแดง' },
    { id: 'king_iron_slime', mode: 'natural-add', diff: 'hard', name: 'King Iron Slime', th: 'ราชาสไลม์เหล็ก' },
    { id: 'forest_wolf', mode: 'natural-mul', diff: 'easy', name: 'Forest Wolf', th: 'หมาป่าพงไพร' },
    { id: 'dire_shadow_wolf', mode: 'natural-mul', diff: 'medium', name: 'Dire Shadow Wolf', th: 'หมาป่าเงาทมิฬ' },
    { id: 'hellhound_behemoth', mode: 'natural-mul', diff: 'hard', name: 'Hellhound Behemoth', th: 'สุนัขนรกสองหัว' },
    { id: 'skeletal_soldier', mode: 'integer-mixed', diff: 'easy', name: 'Skeletal Soldier', th: 'ทหารโครงกระดูก' },
    { id: 'armored_skeleton_berserker', mode: 'integer-mixed', diff: 'medium', name: 'Armored Skeleton Berserker', th: 'โครงกระดูกคลั่งเกราะเหล็ก' },
    { id: 'lich_necromancer', mode: 'integer-mixed', diff: 'hard', name: 'Lich Necromancer', th: 'ลิชจอมเวทมรณะ' },
    { id: 'stone_golem', mode: 'real-mixed', diff: 'easy', name: 'Stone Golem', th: 'โกเลมศิลา' },
    { id: 'rune_crystal_golem', mode: 'real-mixed', diff: 'medium', name: 'Rune Crystal Golem', th: 'โกเลมผลึกรูน' },
    { id: 'ancient_titan_golem', mode: 'real-mixed', diff: 'hard', name: 'Ancient Titan Golem', th: 'ไททันโกเลมโบราณ' },
    { id: 'lesser_demon_imp', mode: 'natural-3', diff: 'easy', name: 'Lesser Demon Imp', th: 'อิมป์ปีศาจน้อย' },
    { id: 'abyssal_demon_warrior', mode: 'natural-3', diff: 'medium', name: 'Abyssal Demon Warrior', th: 'นักรบปีศาจอเวจี' },
    { id: 'demon_commander_archon', mode: 'natural-3', diff: 'hard', name: 'Demon Commander Archon', th: 'อาร์คอนแม่ทัพปีศาจ' },
    { id: 'wyvern_drake', mode: 'integer-3', diff: 'easy', name: 'Wyvern / Drake', th: 'ไวเวิร์น' },
    { id: 'ancient_red_dragon', mode: 'integer-3', diff: 'medium', name: 'Ancient Red Dragon', th: 'มังกรแดงโบราณ' },
    { id: 'aurelius_void_dragon', mode: 'integer-3', diff: 'hard', name: 'Aurelius the Void Dragon', th: 'ออเรลิอุส มังกรสุญญตา' },
    { id: 'golden_treasure_mimic', special: 'daily', name: 'Golden Treasure Mimic', th: 'หีบสมบัติทองคำหัวขโมย' },
    { id: 'astaroth', special: 'exam', name: 'Astaroth, the Fallen Seraph', th: 'แอสทารอธ เทวทูตผู้แปดเปื้อน' }
  ];

  function eyes(b, x, y, c, gap) { gap = gap || 5; rect(b, x, y, 2, 2, c); rect(b, x + gap, y, 2, 2, c); b.put(x, y, '#ffffff'); b.put(x + gap, y, '#ffffff'); }

  function slime(b, glow, v) {
    var cfg = [
      { c: '#5fe07a', w: 16, h: 12 }, { c: '#e2433a', w: 20, h: 15 }, { c: '#8d9aa8', w: 28, h: 22 }
    ][v], r = ramp(cfg.c), cy = FOOT - cfg.h;
    ell(b, CX, cy, cfg.w, cfg.h, r[0]); ell(b, CX - 1, cy - 1, cfg.w - 1, cfg.h - 1, r[1]); rect(b, CX - cfg.w + 1, FOOT - 1, cfg.w * 2 - 1, 2, r[0]);
    ell(b, CX - Math.round(cfg.w * 0.45), cy - Math.round(cfg.h * 0.45), 3, 2, r[2]);
    if (v === 0) { ell(b, CX - 4, cy, 1, 2, '#1a2a1a'); ell(b, CX + 4, cy, 1, 2, '#1a2a1a'); b.put(CX - 4, cy - 1, '#fff'); b.put(CX + 4, cy - 1, '#fff'); for (var i = 0; i < 20; i++) b.put(CX - 14 + i * 1.4, cy + 4 + Math.sin(i) * 2, lt(cfg.c, 0.2), 0.5); }
    if (v === 1) { rect(b, CX - 7, cy - 2, 4, 2, '#ffe04a'); rect(b, CX + 3, cy - 2, 4, 2, '#ffe04a'); line(b, CX - 5, cy + 5, CX + 5, cy + 5, '#5a0f0a'); for (var k = 0; k < 6; k++) ell(glow, CX - 12 + k * 5, cy - cfg.h - 4 - (k % 2) * 4, 2, 3, '#b8ff5a', 0.45); for (var d = 0; d < 5; d++) b.put(CX - 16 + d * 8, FOOT - 1, '#b8ff5a'); }
    if (v === 2) { // helmet + armour shards
      poly(b, [[CX - 14, cy - 14], [CX + 14, cy - 14], [CX + 10, cy - 24], [CX - 10, cy - 24]], '#5b6270'); rect(b, CX - 14, cy - 15, 29, 2, '#9aa4b2'); rect(b, CX - 1, cy - 30, 3, 7, '#e8bc58'); ell(b, CX, cy - 32, 3, 2, '#e8bc58');
      for (var s = 0; s < 6; s++) { srect(b, CX - 22 + s * 8, cy + 2 + (s % 2) * 5, 5, 4, ramp('#6b737d')); }
      rect(b, CX - 9, cy - 6, 5, 3, '#ff3b30'); rect(b, CX + 4, cy - 6, 5, 3, '#ff3b30'); line(b, CX - 8, cy + 6, CX + 8, cy + 6, '#2a2e36', 2);
      ell(glow, CX - 7, cy - 5, 4, 3, '#ff6a50', 0.4); ell(glow, CX + 6, cy - 5, 4, 3, '#ff6a50', 0.4);
    }
  }
  function wolf(b, glow, v) {
    var fur = ['#8a5a33', '#1d1a24', '#3b1712'][v], r = ramp(fur), s = [1, 1.15, 1.45][v];
    var bx = CX - 4, by = FOOT - Math.round(16 * s), bw = Math.round(17 * s), bh = Math.round(8 * s);
    // tail
    line(b, bx - bw, by - 2, bx - bw - Math.round(9 * s), by - Math.round(7 * s), r[1], 3);
    // legs
    [[-bw + 3, 0], [-bw + 7, 1], [bw - 6, 0], [bw - 2, 1]].forEach(function (L) { srect(b, bx + L[0], by + bh - 2, 3, FOOT - (by + bh - 2), L[1] ? r : [r[0], dk(fur, 0.1), r[1]]); });
    ell(b, bx, by + 2, bw, bh, r[1]); ell(b, bx, by + 4, bw - 2, bh - 3, dk(fur, 0.08)); for (var i = -bw + 2; i < bw; i += 3) b.put(bx + i, by - bh + 2, r[2]);
    var heads = v === 2 ? [[bw - 6, -17], [bw + 4, -6]] : [[bw + 2, -7]];
    heads.forEach(function (hp, k) {
      var hx = bx + hp[0], hy = by + hp[1];
      ell(b, hx, hy, Math.round(6 * s), Math.round(5 * s), k ? r[0] : r[1]); poly(b, [[hx + 3, hy - 2], [hx + Math.round(12 * s), hy + 1], [hx + Math.round(11 * s), hy + 4], [hx + 3, hy + 4]], r[1]);
      poly(b, [[hx - 4, hy - 3], [hx - 2, hy - Math.round(10 * s)], [hx + 1, hy - 3]], r[0]); poly(b, [[hx, hy - 3], [hx + 3, hy - Math.round(9 * s)], [hx + 4, hy - 2]], r[1]);
      var eyeC = v === 0 ? '#ffe04a' : v === 1 ? '#c57aff' : '#ffb03a';
      rect(b, hx + 2, hy - 2, 2, 2, eyeC); glow.put(hx + 2, hy - 2, eyeC, 0.9);
      b.put(hx + Math.round(12 * s), hy + 1, '#1a1010'); for (var t = 0; t < 3; t++) b.put(hx + 5 + t * 2, hy + 4, '#fff6e0');
      if (v === 1) { line(b, hx - 1, hy - 5, hx - 3, hy - 9, '#bcb4c8'); }
      if (v === 2) { for (var f = 0; f < 5; f++) ell(glow, hx + Math.round(12 * s) + f * 3, hy + 2 - f, 2 + (f > 2), 2, f < 2 ? '#ffdd6a' : '#ff5a2a', 0.8 - f * 0.1); }
    });
    if (v === 2) { for (var c = 0; c < 10; c++) line(b, bx - bw + 4 + c * 3, by - 2 + (c % 3), bx - bw + 6 + c * 3, by + 2 + (c % 2), '#ff7a1a'); }
    if (v === 1) { for (var sm = 0; sm < 8; sm++) ell(glow, bx - bw + sm * 5, FOOT - 3, 3, 2, '#5a3a7a', 0.35); }
  }
  function skeleton(b, glow, v) {
    var bone = '#ece6d6', bd = '#b8b0a0', x = CX, top = v === 2 ? 22 : 34, foot = v === 2 ? FOOT - 10 : FOOT;
    if (v === 2) { // robe floating lich
      poly(b, [[x - 8, top + 12], [x + 8, top + 12], [x + 14, foot], [x - 14, foot]], '#2c2436'); for (var t = 0; t < 7; t++) line(b, x - 14 + t * 4, foot, x - 12 + t * 4, foot + 5, '#2c2436');
      poly(b, [[x - 10, top + 4], [x + 10, top + 4], [x + 8, top - 6], [x, top - 12], [x - 8, top - 6]], '#3a2f48');
      ell(b, x, top + 3, 5, 5, bone); rect(b, x - 3, top + 2, 2, 2, '#50ff7a'); rect(b, x + 2, top + 2, 2, 2, '#50ff7a'); rect(b, x - 2, top + 6, 5, 1, '#3a3a3a');
      ell(glow, x, top + 20, 20, 18, '#50ff7a', 0.18); line(b, x + 12, top + 40, x + 16, top - 4, '#4a3a2a', 2); ell(b, x + 16, top - 6, 3, 3, '#2a1a3a'); ell(glow, x + 16, top - 6, 5, 5, '#8a2aff', 0.6);
      // minion skulls + dark fireball
      [[-26, 70], [-20, 78], [24, 76]].forEach(function (m) { ell(b, CX + m[0], m[1], 3, 3, bone); b.put(CX + m[0] - 1, m[1], '#50ff7a'); b.put(CX + m[0] + 1, m[1], '#50ff7a'); });
      ell(glow, x - 18, top + 14, 5, 5, '#6a1aa0', 0.7); ell(glow, x - 18, top + 14, 2, 2, '#50ff7a', 0.9);
      for (var h = 0; h < 4; h++) rect(b, x - 10 + h * 6, top + 22, 2, 5, bone);
      return;
    }
    // skull
    ell(b, x, top, 6, 6, bone); rect(b, x - 3, top - 1, 2, 3, '#1a1414'); rect(b, x + 2, top - 1, 2, 3, '#1a1414'); rect(b, x - 3, top + 5, 7, 2, bone); for (var tt = 0; tt < 4; tt++) b.put(x - 2 + tt * 2, top + 5, '#6a6050');
    // ribs + spine
    rect(b, x, top + 7, 1, 20, bd); for (var rI = 0; rI < 4; rI++) { line(b, x - 6 + (rI > 2), top + 10 + rI * 3, x + 6 - (rI > 2), top + 10 + rI * 3, bone); }
    ell(b, x, top + 24, 5, 2, bone);
    line(b, x - 3, top + 26, x - 5, foot - 1, bone, 2); line(b, x + 3, top + 26, x + 5, foot - 1, bone, 2);
    line(b, x - 7, top + 10, x - 9, top + 22, bone, 2); line(b, x + 7, top + 10, x + 10, top + 22, bone, 2);
    if (v === 0) { srect(b, x - 16, top + 12, 7, 12, ramp('#8a5a33')); line(b, x + 10, top + 22, x + 14, top + 4, '#b3bcc7', 2); rect(b, x + 8, top + 21, 5, 1, '#6a4a2a'); }
    if (v === 1) {
      srect(b, x - 8, top + 8, 17, 12, ramp('#7a5a44')); for (var rs = 0; rs < 6; rs++) b.put(x - 6 + rs * 3, top + 10 + (rs % 3) * 3, '#a0582a');
      srect(b, x - 11, top + 7, 5, 4, ramp('#6b5a50')); srect(b, x + 7, top + 7, 5, 4, ramp('#6b5a50'));
      rect(b, x - 7, top - 7, 15, 3, '#6b5a50'); line(b, x - 6, top - 7, x - 9, top - 13, '#d8d0c0'); line(b, x + 6, top - 7, x + 9, top - 13, '#d8d0c0');
      [[-1, -12], [1, 12]].forEach(function (s) { var hx = x + s[1], hy = top + 22; line(b, hx, hy + 4, hx + s[0] * 3, hy - 10, '#5a3a22', 2); poly(b, [[hx + s[0] * 3, hy - 11], [hx + s[0] * 10, hy - 14], [hx + s[0] * 10, hy - 5], [hx + s[0] * 3, hy - 7]], '#b3bcc7'); });
      ell(glow, x - 3, top, 2, 2, '#ff3a3a', 0.8); ell(glow, x + 3, top, 2, 2, '#ff3a3a', 0.8);
    }
  }
  function golem(b, glow, v) {
    var stone = ['#8a8478', '#4a4550', '#6b6660'][v], r = ramp(stone), s = [1, 1.15, 1.35][v];
    var tw = Math.round(14 * s), th = Math.round(16 * s), top = FOOT - Math.round(40 * s);
    // legs
    srect(b, CX - tw + 3, top + th + 6, Math.round(8 * s), FOOT - (top + th + 6), r); srect(b, CX + tw - 3 - Math.round(8 * s), top + th + 6, Math.round(8 * s), FOOT - (top + th + 6), r);
    // torso
    srect(b, CX - tw, top + 6, tw * 2, th + 4, r);
    // arms
    srect(b, CX - tw - Math.round(9 * s), top + 5, Math.round(9 * s), Math.round(20 * s), r); srect(b, CX + tw, top + 5, Math.round(9 * s), Math.round(20 * s), r);
    srect(b, CX - tw - Math.round(11 * s), top + Math.round(22 * s), Math.round(12 * s), Math.round(8 * s), ramp(dk(stone, 0.1))); srect(b, CX + tw - 1, top + Math.round(22 * s), Math.round(12 * s), Math.round(8 * s), ramp(dk(stone, 0.1)));
    // head
    srect(b, CX - 6, top - 2, 12, 9, r); rect(b, CX - 4, top + 2, 8, 2, '#1a1616');
    var eyeC = v === 0 ? '#9adfff' : v === 1 ? '#ff8a2a' : '#ffe890';
    rect(b, CX - 3, top + 2, 2, 2, eyeC); rect(b, CX + 1, top + 2, 2, 2, eyeC); ell(glow, CX, top + 3, 6, 3, eyeC, 0.35);
    for (var c = 0; c < 8; c++) { var cx = CX - tw + 3 + (c * 7) % (tw * 2 - 6), cy = top + 9 + (c * 5) % th; line(b, cx, cy, cx + 3, cy + 2, dk(stone, 0.35)); }
    if (v === 0) { for (var m = 0; m < 5; m++) b.put(CX - tw + 2 + m * 5, top + 7, '#6fbf4a'); }
    if (v === 1) {
      for (var l = 0; l < 7; l++) { var lx = CX - tw + 4 + (l * 9) % (tw * 2 - 8), ly = top + 10 + (l * 4) % th; line(b, lx, ly, lx + 4, ly + 1, '#ff7a1a'); }
      [[-tw - 4, top + 2], [tw + 4, top + 2], [-4, top - 5], [5, top - 6], [0, top + 12]].forEach(function (p) { var px = CX + p[0], py = p[1]; poly(b, [[px - 2, py + 2], [px, py - 5], [px + 2, py + 2]], '#8fe8ff'); b.put(px, py - 3, '#ffffff'); ell(glow, px, py, 4, 5, '#8fe8ff', 0.45); });
      for (var sh = 0; sh < 3; sh++) ring(glow, CX, FOOT, 14 + sh * 7, 3, '#ff9a4a', 0.45 - sh * 0.1);
    }
    if (v === 2) {
      rect(b, CX - tw, top + 10, tw * 2, 3, '#d9b24a'); rect(b, CX - tw, top + th + 5, tw * 2, 2, '#d9b24a'); srect(b, CX - tw - 8, top + 3, 12, 6, ramp('#c9a24a')); srect(b, CX + tw - 4, top + 3, 12, 6, ramp('#c9a24a'));
      ring(glow, CX, top + 14, 34, 9, '#ffe890', 0.7); ring(glow, CX, top + 14, 30, 7, '#8fd0ff', 0.45);
      [[-30, 8], [28, 4], [-18, 2]].forEach(function (m) { ell(b, CX + m[0], m[1] + 6, 3, 3, '#6a4a3a'); ell(glow, CX + m[0] + 2, m[1] + 3, 4, 3, '#ff7a1a', 0.6); line(glow, CX + m[0] + 2, m[1] + 2, CX + m[0] + 8, m[1] - 4, '#ffcf7a', 2, 0.5); });
      ell(b, CX, top + 13, 3, 3, '#ffe890');
    }
  }
  function demonMon(b, glow, v) {
    if (v === 0) { // imp
      var y = 48; [-1, 1].forEach(function (s) { poly(b, [[CX + s * 4, y - 4], [CX + s * 20, y - 14], [CX + s * 17, y - 2], [CX + s * 21, y + 3], [CX + s * 6, y + 2]], '#3a1f40'); line(b, CX + s * 4, y - 4, CX + s * 20, y - 14, '#5a2f60'); });
      ell(b, CX, y + 4, 7, 8, '#c7433a'); ell(b, CX, y - 6, 6, 5, '#d6524a'); line(b, CX - 4, y - 10, CX - 6, y - 15, '#2a1a1a'); line(b, CX + 4, y - 10, CX + 6, y - 15, '#2a1a1a');
      rect(b, CX - 3, y - 7, 2, 2, '#ffe04a'); rect(b, CX + 2, y - 7, 2, 2, '#ffe04a'); line(b, CX, y + 12, CX + 6, y + 18, '#c7433a'); poly(b, [[CX + 6, y + 16], [CX + 9, y + 19], [CX + 5, y + 20]], '#c7433a');
      ell(b, CX + 14, y + 4, 3, 3, '#ff9a2a'); ell(glow, CX + 14, y + 4, 6, 6, '#ffcf5a', 0.6); line(b, CX + 6, y + 2, CX + 11, y + 4, '#d6524a');
      return;
    }
    var big = v === 2, s = big ? 1.3 : 1.15, top = FOOT - Math.round(52 * s), skin = big ? '#5a2a60' : '#b8322a', r = ramp(skin);
    if (big) { // 4 shadow wings: two distinct bat wings per side
      [-1, 1].forEach(function (sd) {
        [[-35, 34, 9], [10, 26, 7]].forEach(function (wg, k) {
          var rx = CX + sd * 8, ry = top + 18 + k * 8, a = wg[0] * Math.PI / 180, tx = rx + sd * Math.cos(a) * wg[1], ty = ry + Math.sin(a) * wg[1];
          poly(b, [[rx, ry], [tx, ty], [tx - sd * 3, ty + wg[2]], [rx + sd * wg[1] * 0.55, ry + wg[2] + 2], [rx + sd * wg[1] * 0.3, ry + wg[2] + 6], [rx + sd * 3, ry + wg[2]]], k ? '#3a2448' : '#2c1a38');
          line(b, rx, ry, tx, ty, '#6a4a80', 2); line(b, tx, ty, rx + sd * wg[1] * 0.55, ry + wg[2] + 2, '#4a3060'); line(glow, rx, ry, tx, ty, '#b27ad0', 1, 0.6);
        });
      });
    }
    // legs
    srect(b, CX - 9, top + Math.round(34 * s), 7, FOOT - top - Math.round(34 * s), ramp(big ? '#1a141f' : '#2a2430')); srect(b, CX + 2, top + Math.round(34 * s), 7, FOOT - top - Math.round(34 * s), ramp(big ? '#1a141f' : '#2a2430'));
    // torso w/ armour
    srect(b, CX - 12, top + 14, 24, Math.round(22 * s), r); srect(b, CX - 10, top + 16, 20, 10, ramp(big ? '#2a2034' : '#2a2430')); if (big) { rect(b, CX - 10, top + 16, 20, 1, '#b061ff'); ell(b, CX, top + 21, 2, 2, '#ff2a3d'); }
    for (var sp = 0; sp < 4; sp++) line(b, CX - 12 + sp * 8, top + 14, CX - 13 + sp * 8, top + 9, '#d8d0e0');
    srect(b, CX - 18, top + 14, 7, 18, r); srect(b, CX + 11, top + 14, 7, 18, r);
    // head
    ell(b, CX, top + 8, 6, 6, big ? '#3a2444' : '#c7433a'); rect(b, CX - 3, top + 7, 2, 2, big ? '#ff2a3d' : '#ffe04a'); rect(b, CX + 2, top + 7, 2, 2, big ? '#ff2a3d' : '#ffe04a');
    for (var h = 0; h < 10; h++) { b.put(CX - 5 - Math.round(h * 0.6), top + 3 - h + Math.round(h * h * 0.04), '#e8e0d0'); b.put(CX + 5 + Math.round(h * 0.6), top + 3 - h + Math.round(h * h * 0.04), '#e8e0d0'); }
    if (!big) { // giant purple-fire sword
      line(b, CX + 16, top + 34, CX + 30, top - 6, '#3a3342', 3); line(b, CX + 17, top + 32, CX + 30, top - 5, '#8f98a6', 1); rect(b, CX + 13, top + 32, 7, 2, '#5a4a60');
      for (var f = 0; f < 8; f++) ell(glow, CX + 18 + f * 1.7, top + 26 - f * 4, 2, 3, '#b061ff', 0.6);
    } else { // domain of darkness
      ring(glow, CX, FOOT - 2, 36, 6, '#b061ff', 0.55); ring(glow, CX, FOOT - 2, 30, 5, '#ff2a3d', 0.35); for (var d = 0; d < 10; d++) spark(glow, CX - 30 + d * 6, FOOT - 6 - (d % 3) * 3, '#ff2a3d', 1);
      ell(glow, CX, top + 8, 10, 8, '#ff2a3d', 0.2); rect(b, CX - 12, top + 13, 24, 2, '#8f4bc0');
    }
  }
  function dragon(b, glow, v) {
    var col = ['#4fae55', '#b8322a', '#15121c'][v], r = ramp(col), s = [0.85, 1.1, 1.35][v];
    var bx = CX - 2, by = FOOT - Math.round(20 * s);
    // wings (behind)
    [-1, 1].forEach(function (sd) {
      var rx = bx + sd * 3, ry = by - Math.round(10 * s), span = Math.round(28 * s);
      var memb = v === 2 ? '#2a2040' : dk(col, 0.25);
      poly(b, [[rx, ry], [rx + sd * span, ry - Math.round(22 * s)], [rx + sd * Math.round(span * 1.05), ry - Math.round(6 * s)], [rx + sd * Math.round(span * 0.7), ry + Math.round(4 * s)], [rx + sd * Math.round(span * 0.35), ry + Math.round(2 * s)]], memb);
      line(b, rx, ry, rx + sd * span, ry - Math.round(22 * s), r[0], 2); line(b, rx + sd * span, ry - Math.round(22 * s), rx + sd * Math.round(span * 0.7), ry + Math.round(4 * s), r[0]); line(b, rx + sd * span, ry - Math.round(22 * s), rx + sd * Math.round(span * 0.35), ry + Math.round(2 * s), r[0]);
      if (v === 2) for (var st = 0; st < 12; st++) glow.put(rx + sd * Math.round(span * (0.2 + (st % 6) * 0.13)), ry - Math.round(18 * s) + (st * 3) % Math.round(20 * s), st % 2 ? '#c7b8ff' : '#ffffff', 0.9);
    });
    // tail
    for (var t = 0; t < 18; t++) ell(b, bx - Math.round(12 * s) - t * 1.3 * s, by + 2 - Math.sin(t / 5) * 4, Math.max(1, Math.round((4 - t * 0.2) * s)), Math.max(1, Math.round((3 - t * 0.14) * s)), r[1]);
    // body
    ell(b, bx, by, Math.round(14 * s), Math.round(9 * s), r[1]); ell(b, bx + 2, by + 3, Math.round(10 * s), Math.round(5 * s), v === 2 ? '#3a2f55' : lt(col, 0.35));
    // legs: two hind legs + (drake) forelegs; wyvern variant keeps 2 hind legs + wing-arms
    var legs = v === 0 ? [[-8, 0], [6, 0]] : [[-9, 0], [-4, 1], [5, 0], [10, 1]];
    legs.forEach(function (L) { srect(b, bx + Math.round(L[0] * s), by + Math.round(5 * s), Math.round(4 * s), FOOT - by - Math.round(5 * s), L[1] ? r : [r[0], dk(col, 0.12), r[1]]); rect(b, bx + Math.round(L[0] * s) - 1, FOOT - 1, Math.round(4 * s) + 2, 1, '#e8e0d0'); });
    // neck + head
    for (var n = 0; n < 10; n++) ell(b, bx + Math.round(10 * s) + n * s, by - Math.round(4 * s) - n * 1.3 * s, Math.round(4 * s), Math.round(3 * s), r[1]);
    var hx = bx + Math.round(21 * s), hy = by - Math.round(18 * s);
    ell(b, hx, hy, Math.round(6 * s), Math.round(5 * s), r[1]); poly(b, [[hx + 2, hy - 3], [hx + Math.round(14 * s), hy], [hx + Math.round(13 * s), hy + Math.round(4 * s)], [hx + 2, hy + Math.round(4 * s)]], r[1]);
    line(b, hx - 2, hy - 3, hx - Math.round(8 * s), hy - Math.round(10 * s), '#e8e0d0', 2); line(b, hx + 1, hy - 4, hx - 2, hy - Math.round(11 * s), '#d8d0c0');
    var eyeC = v === 0 ? '#ffe04a' : v === 1 ? '#ffb03a' : '#c7b8ff'; rect(b, hx + 1, hy - 2, 2, 2, eyeC); glow.put(hx + 1, hy - 2, eyeC, 1);
    for (var sc = 0; sc < 10; sc++) b.put(bx - Math.round(12 * s) + sc * 3, by - Math.round(9 * s) + (sc % 2), v === 2 ? '#8a7ad0' : r[2]);
    var mx = hx + Math.round(14 * s), my = hy + 2;
    if (v === 0) for (var w = 0; w < 5; w++) ring(glow, mx + 4 + w * 3, my, 2 + w, 1 + w, '#b6f7d2', 0.6);
    if (v === 1) for (var f = 0; f < 7; f++) ell(glow, mx + 2 + f * 2, my + f, 2 + (f > 3), 2, f < 3 ? '#ffe06a' : '#ff5a2a', 0.8);
    if (v === 2) { line(glow, mx, my, mx + 12, my + 6, '#8a2aff', 5, 0.55); line(glow, mx, my, mx + 12, my + 6, '#ffffff', 1, 0.9); ell(glow, mx + 13, my + 6, 4, 4, '#000000', 0.8); ring(glow, mx + 13, my + 6, 5, 5, '#c7b8ff', 0.9); }
  }
  function mimic(b, glow) {
    var cx = CX, top = 50, w = 30, h = 20, gold = ramp('#e3b23c'), wood = ramp('#8a5a33');
    // bag on back
    ell(b, cx - 4, top - 12, 12, 10, '#a07a4a'); ell(b, cx - 6, top - 14, 8, 6, '#b89060'); line(b, cx - 8, top - 22, cx + 2, top - 20, '#6a4a2a', 2); rect(b, cx - 7, top - 13, 5, 5, '#e3b23c'); b.put(cx - 5, top - 11, '#8a5a1a');
    // six little legs (3 per side, all visible)
    [-13, -9, -5, 5, 9, 13].forEach(function (lx, i) { var side = lx < 0 ? -1 : 1; line(b, cx + lx, top + h, cx + lx + side * 2, FOOT - 1, '#6a4a2a', 2); rect(b, cx + lx + side * 2 - 1, FOOT - 1, 3, 1, '#e3b23c'); });
    // chest body
    srect(b, cx - w / 2, top, w, h, wood); rect(b, cx - w / 2, top, w, 3, gold[1]); rect(b, cx - w / 2, top + h - 3, w, 3, gold[1]); rect(b, cx - w / 2, top, 3, h, gold[1]); rect(b, cx + w / 2 - 3, top, 3, h, gold[1]);
    for (var p = 0; p < 4; p++) { b.put(cx - 10 + p * 7, top + 6, gold[2]); b.put(cx - 7 + p * 7, top + 13, gold[0]); }
    // lid open with mouth + teeth + tongue
    poly(b, [[cx - w / 2, top], [cx + w / 2, top], [cx + w / 2 - 2, top - 10], [cx - w / 2 + 2, top - 10]], gold[1]); rect(b, cx - w / 2 + 2, top - 10, w - 4, 2, gold[2]);
    rect(b, cx - w / 2 + 3, top - 1, w - 6, 3, '#3a0a14'); for (var t = 0; t < 8; t++) { b.put(cx - 12 + t * 3, top - 1, '#ffffff'); b.put(cx - 11 + t * 3, top + 1, '#f0ece0'); }
    line(b, cx + 4, top + 1, cx + 16, top + 8, '#ff5a7a', 2); ell(b, cx + 17, top + 9, 2, 2, '#ff5a7a');
    // big cute eyes on lid
    ell(b, cx - 6, top - 5, 3, 3, '#ffffff'); ell(b, cx + 6, top - 5, 3, 3, '#ffffff'); ell(b, cx - 6, top - 4, 2, 2, '#1a1a2a'); ell(b, cx + 6, top - 4, 2, 2, '#1a1a2a'); b.put(cx - 7, top - 6, '#ffffff'); b.put(cx + 5, top - 6, '#ffffff');
    rect(b, cx - 2, top + 5, 4, 5, gold[2]); b.put(cx, top + 7, '#3a2a1a');
    // coins being spat
    [[20, -14], [26, -8], [30, -18], [24, -22]].forEach(function (c) { ell(b, cx + c[0], top + c[1], 2, 2, '#ffd84a'); b.put(cx + c[0] - 1, top + c[1] - 1, '#fff6c0'); spark(glow, cx + c[0] + 2, top + c[1] - 3, '#fff3a0', 1); });
    ell(glow, cx, top + 8, 20, 14, '#ffd84a', 0.12);
  }
  function astaroth(b, glow) {
    var top = 20, cx = CX;
    // wings: left white feathered, right black demonic shadow — deliberate asymmetry, both full
    featherWing(b, cx - 5, top + 20, -1, 30, 28, -10, '#ffffff', '#e8dcb0', 1); featherWing(b, cx - 5, top + 24, -1, 22, 20, 15, '#f4f0e6', '#d8c890', 1);
    [[-15, 32], [10, 26]].forEach(function (wg) { var rx = cx + 5, ry = top + 20; poly(b, [[rx, ry], [rx + Math.cos(wg[0] * Math.PI / 180) * wg[1], ry + Math.sin(wg[0] * Math.PI / 180) * wg[1] - 14], [rx + wg[1] * 0.95, ry + 6], [rx + wg[1] * 0.55, ry + 16], [rx + 8, ry + 10]], '#1a1220'); line(b, rx, ry, rx + Math.cos(wg[0] * Math.PI / 180) * wg[1], ry + Math.sin(wg[0] * Math.PI / 180) * wg[1] - 14, '#3a2a44', 2); });
    for (var sm = 0; sm < 8; sm++) ell(glow, cx + 14 + sm * 3, top + 8 + (sm % 3) * 8, 3, 3, '#6a3a8a', 0.35);
    // legs + armour
    srect(b, cx - 6, top + 44, 5, FOOT - top - 44, ramp('#e8e2d0')); srect(b, cx + 1, top + 44, 5, FOOT - top - 44, ramp('#2a2430'));
    srect(b, cx - 9, top + 22, 18, 24, ramp('#f1ead6')); for (var y = top + 22; y < top + 46; y++) for (var x = cx; x < cx + 9; x++) b.put(x, y, '#2a2230', 0.75);
    line(b, cx - 3, top + 24, cx + 2, top + 34, '#6a5a70'); line(b, cx + 2, top + 34, cx - 1, top + 42, '#6a5a70'); rect(b, cx - 9, top + 34, 18, 2, '#e8bc58');
    srect(b, cx - 13, top + 21, 6, 5, ramp('#e8bc58')); srect(b, cx + 7, top + 21, 6, 5, ramp('#3a3342'));
    // arms
    srect(b, cx - 12, top + 26, 3, 14, ramp('#f1ead6')); srect(b, cx + 9, top + 26, 3, 14, ramp('#2a2430'));
    // head with half mask
    ell(b, cx, top + 14, 5, 6, '#f7dcc6'); rect(b, cx - 5, top + 7, 11, 4, '#f6f1e2'); rect(b, cx - 6, top + 9, 2, 10, '#f6f1e2'); rect(b, cx + 4, top + 7, 3, 12, '#1e1a24');
    rect(b, cx, top + 11, 6, 5, '#e8e2d0'); rect(b, cx + 2, top + 13, 2, 1, '#ff2a3d'); rect(b, cx - 3, top + 13, 2, 1, '#3a6fd0');
    // judgement greatsword
    line(b, cx + 12, top + 42, cx + 26, top - 2, '#fffdf2', 3); line(b, cx + 13, top + 40, cx + 26, top, '#c8c0a8'); rect(b, cx + 9, top + 40, 7, 2, '#e8bc58');
    line(glow, cx + 12, top + 42, cx + 26, top - 2, '#fff3b0', 5, 0.35);
    ring(glow, cx, top + 4, 7, 2, '#ffe890', 0.9); for (var k = 0; k < 4; k++) glow.clear(cx + 4 + k, top + 3 + (k % 2));
  }

  function renderMonster(id) {
    var main = new Buf(W, H), glow = new Buf(W, H);
    var idx = MONSTERS.map(function (m) { return m.id; }).indexOf(id);
    if (idx < 0) idx = 0;
    var fam = Math.floor(idx / 3), v = idx % 3;
    if (idx === 18) mimic(main, glow);
    else if (idx === 19) astaroth(main, glow);
    else if (fam === 0) slime(main, glow, v);
    else if (fam === 1) wolf(main, glow, v);
    else if (fam === 2) skeleton(main, glow, v);
    else if (fam === 3) golem(main, glow, v);
    else if (fam === 4) demonMon(main, glow, v);
    else dragon(main, glow, v);
    var om = new Buf(W, H); outline(main, om);
    var base = composite([om, main, glow], W, H);
    var auraColor = ['#9cf5c4', '#ff9a4a', '#c8d0ff', '#ffcf7a', '#c57aff', '#ff6a50', '#9cf5a4', '#ff6a50', '#50ff7a', '#d8e8ff', '#ff9a4a', '#ffe890', '#ffcf5a', '#b061ff', '#ff2a3d', '#b6f7d2', '#ff8a4a', '#c7b8ff', '#ffd84a', '#fff3b0'][idx];
    var aura = makeAura(base, auraColor, v === 2 || idx >= 18 ? 2 : v === 1 ? 1 : 0, 31 + idx);
    return { w: W, h: H, base: base.d, aura: aura.d };
  }

  return { W: W, H: H, renderCharacter: renderCharacter, renderMonster: renderMonster, renderTeacher: renderTeacher, MONSTERS: MONSTERS, ELEM: ELEM };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SPR;

