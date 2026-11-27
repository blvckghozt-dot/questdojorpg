/* Procedural 16-bit scene backdrops (160×90, scaled up with pixelated rendering) */
var Scenes = (function () {
  var W = 160, H = 90, cache = {};
  function mk() { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'); x.imageSmoothingEnabled = false; return { c: c, x: x }; }
  function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
  function grad(x, stops) { var g = x.createLinearGradient(0, 0, 0, H); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  function stars(x, r, n, maxY) { for (var i = 0; i < n; i++) { x.fillStyle = r() < 0.2 ? '#fff6c0' : '#c8d0ff'; x.fillRect(Math.floor(r() * W), Math.floor(r() * maxY), 1, 1); } }
  function rect(x, a, b, w, h, c) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function bricks(x, a, b, w, h, c1, c2) { rect(x, a, b, w, h, c1); x.fillStyle = c2; for (var yy = b; yy < b + h; yy += 4) { x.fillRect(a, yy, w, 1); for (var xx = a + ((yy / 4) % 2 ? 0 : 3); xx < a + w; xx += 6) x.fillRect(xx, yy, 1, 4); } }
  function tree(x, a, b, s, c1, c2) { rect(x, a + 3 * s, b + 8 * s, 2 * s, 8 * s, '#3a2418'); x.fillStyle = c1; x.beginPath(); x.moveTo(a + 4 * s, b); x.lineTo(a + 9 * s, b + 10 * s); x.lineTo(a - 1 * s, b + 10 * s); x.fill(); x.fillStyle = c2; x.beginPath(); x.moveTo(a + 4 * s, b + 3 * s); x.lineTo(a + 8 * s, b + 12 * s); x.lineTo(a, b + 12 * s); x.fill(); }
  function banner(x, a, b, c, e) { rect(x, a, b, 7, 14, c); rect(x, a, b + 14, 3, 2, c); rect(x, a + 4, b + 14, 3, 2, c); rect(x, a + 2, b + 5, 3, 3, e); rect(x, a - 1, b - 1, 9, 1, '#c9a24a'); }
  function torch(x, a, b) { rect(x, a, b, 2, 5, '#5a3a22'); rect(x, a - 1, b - 3, 4, 3, '#ff9a3a'); rect(x, a, b - 4, 2, 2, '#ffe07a'); }

  var DRAW = {
    attendance: function (x, r) { // castle gate at dusk
      grad(x, [[0, '#1a1840'], [0.55, '#4a3060'], [0.75, '#b0605a'], [1, '#2a1a28']]); stars(x, r, 40, 40);
      rect(x, 0, 70, W, 20, '#2a2a36'); for (var i = 0; i < W; i += 8) rect(x, i, 70, 7, 1, '#3a3a4a');
      bricks(x, 20, 26, 120, 46, '#4a4658', '#3a3648');
      for (var t = 20; t < 140; t += 8) rect(x, t, 22, 5, 4, '#4a4658');
      bricks(x, 8, 14, 22, 58, '#524e62', '#3e3a4e'); bricks(x, 130, 14, 22, 58, '#524e62', '#3e3a4e');
      [[8, 14], [130, 14]].forEach(function (p) { for (var k = 0; k < 22; k += 6) rect(x, p[0] + k, p[1] - 4, 4, 4, '#524e62'); rect(x, p[0] + 8, p[1] + 10, 6, 9, '#ffd27a'); });
      rect(x, 62, 40, 36, 32, '#1a1420'); x.fillStyle = '#1a1420'; x.beginPath(); x.arc(80, 40, 18, Math.PI, 0); x.fill();
      for (var g = 64; g < 98; g += 4) rect(x, g, 30, 1, 42, '#6a5a44'); for (var h = 36; h < 72; h += 6) rect(x, 62, h, 36, 1, '#6a5a44');
      banner(x, 44, 32, '#8b2a3a', '#e8bc58'); banner(x, 110, 32, '#2a3a8b', '#e8bc58'); torch(x, 56, 48); torch(x, 102, 48);
    },
    live: function (x, r) { // adventurers' training hall
      grad(x, [[0, '#2a1e18'], [1, '#3a2a20']]);
      for (var y = 0; y < 58; y += 6) rect(x, 0, y, W, 1, '#24180f'); for (var p = 0; p < W; p += 24) rect(x, p, 0, 3, 58, '#1c130c');
      rect(x, 58, 58, 0, 0, '#000'); for (var f = 58; f < H; f += 4) rect(x, 0, f, W, 4, f % 8 ? '#5a3c24' : '#4e3420');
      for (var b = 0; b < W; b += 16) rect(x, b, 58, 1, 32, '#3e2a18');
      [[20, 34], [134, 34]].forEach(function (d) { rect(x, d[0] + 3, d[1] + 4, 2, 20, '#8a6a3a'); rect(x, d[0], d[1] + 8, 8, 2, '#8a6a3a'); rect(x, d[0] + 1, d[1], 6, 6, '#c9a26a'); rect(x, d[0] + 2, d[1] + 10, 4, 8, '#b08a50'); });
      rect(x, 50, 10, 60, 28, '#1e3a2a'); rect(x, 49, 9, 62, 1, '#8a6a3a'); rect(x, 49, 38, 62, 1, '#8a6a3a');
      x.fillStyle = '#e8f0e0'; [[56, 16, '2+3'], [80, 16, '×'], [60, 26, 'x=?']].forEach(function () { }); for (var k = 0; k < 8; k++) rect(x, 55 + k * 6, 16 + (k % 2) * 8, 4, 1, '#d8e8d0');
      for (var w = 0; w < 4; w++) { rect(x, 8 + w * 6, 12, 2, 22, '#9aa4b2'); } rect(x, 6, 34, 26, 2, '#5a3a22');
      torch(x, 40, 22); torch(x, 118, 22);
    },
    game: function (x, r) { // cave mouth in the forest
      grad(x, [[0, '#0e1a24'], [0.6, '#1a3a34'], [1, '#0e1c16']]); stars(x, r, 25, 30);
      for (var i = 0; i < 12; i++) tree(x, i * 14 - 4, 18 + (i % 3) * 4, 2, '#123a28', '#0e2e20');
      x.fillStyle = '#3a3a40'; x.beginPath(); x.moveTo(30, 90); x.lineTo(50, 30); x.lineTo(80, 18); x.lineTo(112, 30); x.lineTo(132, 90); x.fill();
      x.fillStyle = '#2a2a30'; x.beginPath(); x.moveTo(40, 90); x.lineTo(56, 40); x.lineTo(80, 30); x.lineTo(104, 40); x.lineTo(120, 90); x.fill();
      x.fillStyle = '#07060a'; x.beginPath(); x.moveTo(58, 90); x.lineTo(62, 56); x.lineTo(80, 44); x.lineTo(98, 56); x.lineTo(102, 90); x.fill();
      for (var e = 0; e < 5; e++) rect(x, 72 + e * 4, 60 + (e % 2) * 3, 1, 1, '#ff4a4a');
      rect(x, 0, 80, W, 10, '#1a2a1a'); for (var g = 0; g < W; g += 3) rect(x, g, 78 + (g % 2), 1, 2, '#2a4a2a');
      for (var t = 0; t < 4; t++) tree(x, [2, 18, 128, 146][t], 50, 3, '#1a4a30', '#143a26');
      for (var m = 0; m < 14; m++) rect(x, Math.floor(r() * W), 60 + Math.floor(r() * 20), 1, 1, '#b8ff8a');
    },
    avatars: function (x, r) { // castle hall interior
      grad(x, [[0, '#1a1428'], [1, '#2a1e30']]);
      for (var p = 10; p < W; p += 28) { rect(x, p, 0, 8, 70, '#4a4058'); rect(x, p + 1, 0, 2, 70, '#5e5470'); rect(x, p - 2, 66, 12, 4, '#3a3048'); }
      rect(x, 0, 70, W, 20, '#3a2a30'); for (var i = 0; i < W; i += 10) for (var j = 70; j < H; j += 5) rect(x, i + ((j / 5) % 2 ? 5 : 0), j, 1, 5, '#2e2026');
      x.fillStyle = '#8b2a3a'; x.beginPath(); x.moveTo(70, 70); x.lineTo(90, 70); x.lineTo(110, 90); x.lineTo(50, 90); x.fill(); rect(x, 70, 70, 20, 1, '#e8bc58');
      [24, 52, 108, 136].forEach(function (b) { banner(x, b, 10, b < 80 ? '#5a2a8b' : '#8b2a3a', '#e8bc58'); });
      rect(x, 64, 8, 32, 26, '#2a2040'); for (var w = 0; w < 4; w++) rect(x, 66 + w * 8, 10, 6, 22, ['#6a4aa0', '#4a8ac0', '#c04a6a', '#e8bc58'][w]);
      rect(x, 76, 40, 8, 6, '#e8bc58'); for (var c = 0; c < 6; c++) { rect(x, 20 + c * 24, 30, 1, 3, '#ffe890'); }
    },
    tasks: function (x, r) { // guild quest board
      grad(x, [[0, '#2a1e16'], [1, '#1e140e']]);
      for (var y = 0; y < H; y += 5) rect(x, 0, y, W, 1, '#24180f'); for (var v = 0; v < W; v += 20) rect(x, v, 0, 1, H, '#1a110a');
      rect(x, 20, 10, 120, 58, '#6a4a2e'); rect(x, 22, 12, 116, 54, '#8a6440'); rect(x, 18, 8, 124, 3, '#4a3020'); rect(x, 18, 66, 124, 3, '#4a3020');
      for (var n = 0; n < 11; n++) { var a = 26 + (n % 6) * 18 + Math.floor(r() * 4), b = 16 + Math.floor(n / 6) * 24 + Math.floor(r() * 5); rect(x, a, b, 14, 16, n % 4 ? '#efe2c0' : '#e8c890'); rect(x, a + 6, b, 2, 2, '#c0392b'); for (var l = 0; l < 4; l++) rect(x, a + 2, b + 5 + l * 3, 10 - (l % 2) * 3, 1, '#8a7a5a'); }
      rect(x, 0, 74, W, 16, '#3a2618'); torch(x, 8, 30); torch(x, 150, 30);
      rect(x, 60, 76, 40, 6, '#5a3a22'); rect(x, 64, 72, 6, 4, '#c9a24a'); rect(x, 84, 71, 8, 5, '#9aa4b2');
    },
    groups: function (x, r) { // castle courtyard
      grad(x, [[0, '#5a8ad0'], [0.5, '#a8c8f0'], [0.62, '#d8e8f0'], [1, '#8a8478']]);
      for (var c = 0; c < 4; c++) { var cx = 10 + c * 40 + Math.floor(r() * 10); rect(x, cx, 10 + (c % 2) * 6, 18, 3, '#f4f8ff'); rect(x, cx + 3, 8 + (c % 2) * 6, 10, 2, '#f4f8ff'); }
      bricks(x, 0, 30, W, 30, '#8a8494', '#6e687a'); for (var t = 0; t < W; t += 8) rect(x, t, 26, 5, 4, '#8a8494');
      bricks(x, 64, 12, 32, 48, '#948ea0', '#78728a'); rect(x, 74, 40, 12, 20, '#2a2030'); for (var k = 64; k < 96; k += 6) rect(x, k, 8, 4, 4, '#948ea0'); rect(x, 79, 0, 1, 8, '#4a3a2a'); rect(x, 80, 0, 8, 5, '#c0392b');
      rect(x, 0, 60, W, 30, '#9a9280'); for (var i = 0; i < W; i += 12) for (var j = 60; j < H; j += 6) rect(x, i + ((j / 6) % 2 ? 6 : 0), j, 1, 6, '#86806e');
      for (var f = 0; f < 5; f++) { rect(x, 12 + f * 34, 44, 1, 16, '#5a3a22'); rect(x, 13 + f * 34, 44, 7, 5, ['#c0392b', '#2a6fc0', '#e8bc58', '#55a06a', '#8b6ee8'][f]); }
    },
    arena: function (x, r) { // colosseum
      grad(x, [[0, '#f0a060'], [0.35, '#f8d090'], [1, '#6a5030']]);
      x.fillStyle = '#8a6a50'; x.fillRect(0, 22, W, 30); for (var tier = 0; tier < 3; tier++) { rect(x, 0, 24 + tier * 9, W, 2, '#6a5040'); for (var a = 0; a < W; a += 10) rect(x, a + tier * 3, 26 + tier * 9, 6, 6, '#5a4030'); }
      for (var p = 0; p < 60; p++) rect(x, Math.floor(r() * W), 26 + Math.floor(r() * 24), 1, 2, ['#c0392b', '#2a6fc0', '#e8bc58', '#f3f0e7', '#55a06a'][p % 5]);
      rect(x, 0, 52, W, 38, '#c8a46a'); x.fillStyle = '#b8945a'; x.beginPath(); x.ellipse(80, 72, 70, 14, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#e8d0a0'; x.beginPath(); x.ellipse(80, 72, 70, 14, 0, 0, Math.PI * 2); x.stroke();
      [[6, 30], [150, 30]].forEach(function (f) { rect(x, f[0], f[1], 1, 22, '#5a3a22'); rect(x, f[0] + 1, f[1], 6, 4, '#c0392b'); });
    },
    students: function (x, r) { DRAW.avatars(x, r); x.fillStyle = 'rgba(20,10,30,.35)'; x.fillRect(0, 0, W, H); },
    reports: function (x, r) { // oracle tower
      grad(x, [[0, '#0c0a24'], [1, '#1e1640']]); stars(x, r, 70, 60);
      x.fillStyle = '#d8d0ff'; x.beginPath(); x.arc(128, 18, 8, 0, Math.PI * 2); x.fill(); x.fillStyle = '#0c0a24'; x.beginPath(); x.arc(125, 16, 7, 0, Math.PI * 2); x.fill();
      bricks(x, 56, 20, 48, 70, '#3a3458', '#2a2448'); x.fillStyle = '#2a2448'; x.beginPath(); x.moveTo(52, 20); x.lineTo(80, 2); x.lineTo(108, 20); x.fill();
      rect(x, 72, 36, 16, 20, '#ffe890'); rect(x, 79, 36, 2, 20, '#3a3458'); rect(x, 72, 45, 16, 2, '#3a3458');
      x.strokeStyle = 'rgba(200,190,255,.5)'; x.beginPath(); x.arc(80, 46, 30, 0, Math.PI * 2); x.stroke();
      rect(x, 0, 84, W, 6, '#141030');
    }
  };
  // castle great hall with a stage for Master Max (240×140)
  function hall() {
    var W2 = 240, H2 = 140, c = document.createElement('canvas'); c.width = W2; c.height = H2; var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    var r = rng(4242);
    var g = x.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, '#120e22'); g.addColorStop(1, '#2a2036'); x.fillStyle = g; x.fillRect(0, 0, W2, 60);
    // back wall stones
    for (var yy = 0; yy < 58; yy += 5) { rect(x, 0, yy, W2, 1, '#1a1428'); for (var xx = (yy / 5) % 2 ? 0 : 6; xx < W2; xx += 12) rect(x, xx, yy, 1, 5, '#1a1428'); }
    // tall windows
    [18, 58, 170, 210].forEach(function (wx) { rect(x, wx, 6, 14, 34, '#0c0a18'); x.fillStyle = '#0c0a18'; x.beginPath(); x.arc(wx + 7, 6, 7, Math.PI, 0); x.fill();
      ['#3a5ab0', '#6a4aa0', '#c04a6a', '#e8bc58'].forEach(function (col, k) { rect(x, wx + 2 + (k % 2) * 5, 4 + Math.floor(k / 2) * 14, 4, 12, col); }); rect(x, wx + 6, 2, 2, 36, '#0c0a18'); rect(x, wx, 20, 14, 1, '#0c0a18');
      x.fillStyle = 'rgba(160,170,255,.07)'; x.beginPath(); x.moveTo(wx, 40); x.lineTo(wx + 14, 40); x.lineTo(wx + 30, 120); x.lineTo(wx - 12, 120); x.fill(); });
    // pillars
    [4, 42, 80, 152, 190, 228].forEach(function (px) { rect(x, px, 0, 8, 62, '#4a4058'); rect(x, px + 1, 0, 2, 62, '#6a6080'); rect(x, px + 6, 0, 2, 62, '#342c44'); rect(x, px - 2, 58, 12, 4, '#3a3048'); rect(x, px - 1, 0, 10, 3, '#5a5070'); });
    // banners
    [[30, '#5a2a8b'], [70, '#8b2a3a'], [162, '#8b2a3a'], [200, '#5a2a8b']].forEach(function (b) { banner(x, b[0], 8, b[1], '#e8bc58'); });
    // stage backdrop arch + curtains
    rect(x, 88, 4, 64, 40, '#231a36'); x.fillStyle = '#231a36'; x.beginPath(); x.arc(120, 6, 32, Math.PI, 0); x.fill();
    x.strokeStyle = '#c9a24a'; x.lineWidth = 1; x.beginPath(); x.arc(120, 8, 30, Math.PI, 0); x.stroke();
    for (var k = 0; k < 10; k++) { rect(x, 88 + k * 1.6, 2, 2, 44, k % 2 ? '#7a1e2e' : '#962a3c'); rect(x, 150 - k * 1.6, 2, 2, 44, k % 2 ? '#7a1e2e' : '#962a3c'); }
    rect(x, 86, 0, 68, 4, '#962a3c'); for (var q = 86; q < 154; q += 4) rect(x, q, 4, 2, 2, '#e8bc58');
    // crest
    rect(x, 114, 12, 12, 14, '#e8bc58'); rect(x, 116, 14, 8, 10, '#5a2a8b'); rect(x, 119, 16, 2, 6, '#fff3c4'); rect(x, 117, 18, 6, 2, '#fff3c4');
    // stage platform
    rect(x, 78, 44, 84, 10, '#5a3a2a'); rect(x, 78, 44, 84, 2, '#c9a24a'); for (var sx = 80; sx < 160; sx += 8) rect(x, sx, 46, 1, 8, '#4a2e20');
    rect(x, 74, 54, 92, 5, '#4a3024'); rect(x, 74, 54, 92, 1, '#a88438'); rect(x, 70, 59, 100, 5, '#3e281e'); rect(x, 70, 59, 100, 1, '#8a6a30');
    // floor
    rect(x, 0, 62, W2, H2 - 62, '#2e2430');
    for (var row = 0, fy = 62; fy < H2; row++) { var th = 5 + row * 1.4; for (var fx = -20 + (row % 2) * 10; fx < W2 + 20; fx += 20) { x.fillStyle = ((fx / 20 + row) % 2 === 0) ? '#3a2e3c' : '#2a2030'; x.fillRect(fx, fy, 20, th); } fy += th; }
    // carpet from the stage steps to the front
    x.fillStyle = '#7a1e2e'; x.beginPath(); x.moveTo(108, 64); x.lineTo(132, 64); x.lineTo(150, H2); x.lineTo(90, H2); x.fill();
    x.fillStyle = '#e8bc58'; x.beginPath(); x.moveTo(108, 64); x.lineTo(109.5, 64); x.lineTo(92, H2); x.lineTo(90, H2); x.fill(); x.beginPath(); x.moveTo(130.5, 64); x.lineTo(132, 64); x.lineTo(150, H2); x.lineTo(148, H2); x.fill();
    // braziers
    [[20, 92], [220, 92], [56, 120], [184, 120]].forEach(function (b) { rect(x, b[0] - 3, b[1], 6, 8, '#4a4050'); rect(x, b[0] - 5, b[1] - 2, 10, 3, '#6a6070'); rect(x, b[0] - 3, b[1] - 6, 6, 4, '#ff8a2a'); rect(x, b[0] - 1, b[1] - 9, 3, 4, '#ffd060'); x.fillStyle = 'rgba(255,170,80,.08)'; x.beginPath(); x.arc(b[0], b[1], 22, 0, Math.PI * 2); x.fill(); });
    // stage candles and sparkles
    [82, 96, 144, 158].forEach(function (cx) { rect(x, cx, 38, 2, 6, '#efe2c0'); rect(x, cx, 36, 2, 2, '#ffd060'); });
    for (var sp = 0; sp < 30; sp++) rect(x, Math.floor(r() * W2), Math.floor(r() * 60), 1, 1, r() < 0.5 ? '#fff6c0' : '#b8c0ff');
    // vignette
    var v = x.createRadialGradient(120, 70, 30, 120, 70, 150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = v; x.fillRect(0, 0, W2, H2);
    return c.toDataURL('image/png');
  }
  // painted backgrounds (published next to the page under bg/); procedural scenes stay as the fallback
  var BG = { attendance: 'attendance', live: 'training', game: 'dungeon-gate', arena: 'arena', avatars: 'hall', hall: 'hall', groups: 'guild', tasks: 'questboard', students: 'kingdom', reports: 'oracle',
    slime: 'battle-slime', wolf: 'battle-wolf', undead: 'battle-undead', golem: 'battle-golem', demon: 'battle-demon', dragon: 'battle-dragon', mimic: 'boss-mimic', astaroth: 'boss-astaroth' };
  var MODE_BG = { 'natural-add': 'slime', 'natural-mul': 'wolf', 'integer-mixed': 'undead', 'real-mixed': 'golem', 'natural-3': 'demon', 'integer-3': 'dragon' };
  function art(key) { return BG[key] ? new URL('bg/bg-' + BG[key] + '.png', document.baseURI).href : null; } // absolute: used inside CSS variables that resolve against the stylesheet
  function bg(key) { return 'url(' + (art(key) || url(key)) + ')'; }
  function battle(mode) { return bg(MODE_BG[mode] || 'slime'); }
  function url(page) {
    if (!DRAW[page] && page !== 'hall') page = 'avatars';
    if (page === 'hall') return cache.hall || (cache.hall = hall());
    if (cache[page]) return cache[page];
    var d = DRAW[page] || DRAW.avatars, c = mk(); d(c.x, rng(page.length * 97 + 13));
    cache[page] = c.c.toDataURL('image/png'); return cache[page];
  }
  return { url: url, bg: bg, battle: battle, art: art };
})();

