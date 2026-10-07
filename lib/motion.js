// ---------------------------------------------------------------------------
// Moteur commun des vidéos TikTok (9:16) : image = fonction pure du temps.
// Une page charge ce fichier, déclare ses scènes avec S(début, fin, build),
// puis appelle start(). tools/render.mjs pilote window.renderAt(t).
// Contrat avec render.mjs : <svg id="stage" viewBox="0 0 W H">, ?render dans l'URL,
// window.renderAt(t), window.DURATION, window.ready = true.
// ---------------------------------------------------------------------------
(() => {
const NS = 'http://www.w3.org/2000/svg';

// --- maths et easing ---------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  in: t => t * t * t,
  back: t => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
};
const p = (t, a, b, ease = E.inOut) => ease(clamp((t - a) / (b - a)));   // progression 0→1 entre a et b
const pop = (t, t0, d = .35) => E.back(clamp((t - t0) / d));             // apparition avec rebond
const fmt = n => (+n).toFixed(1);
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function mix(c1, c2, k) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, k));
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}
function blink(t, off = 0, period = 3.1) { const ph = (t + off) % period; return ph < .18 ? Math.sin(ph / .18 * Math.PI) : 0; }

// --- SVG ---------------------------------------------------------------------
function el(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function set(e, attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }
const show = (e, v) => e.setAttribute('display', v ? '' : 'none');
const tf = (e, x, y, s = 1, r = 0) => e.setAttribute('transform', `translate(${fmt(x)},${fmt(y)}) rotate(${fmt(r)}) scale(${Math.max(+s, .001).toFixed(3)})`);
let uid = 0;
const newId = pre => `${pre}${uid++}`;

// --- configuration (remplie par setup) ---------------------------------------
const M = {
  W: 1080, H: 1920, DUR: 10, FPS: 30,
  C: { GREEN: '#2ECC71', RED: '#E74C3C', CREAM: '#FFF4E0', INK: '#1A1A1A', WHITE: '#FFFFFF' },
  SAFE: { top: 160, bottom: 250, right: 120 },
  CX: 510,                                            // centre utile (la marge droite reste libre)
  WORDS: [], svg: null, defs: null, RENDER: false,
};

const CSS = `
  @font-face { font-family: 'Montserrat'; font-weight: 700; src: url(assets/fonts/montserrat-latin-700-normal.woff2) format('woff2'); }
  @font-face { font-family: 'Montserrat'; font-weight: 800; src: url(assets/fonts/montserrat-latin-800-normal.woff2) format('woff2'); }
  @font-face { font-family: 'Montserrat'; font-weight: 900; src: url(assets/fonts/montserrat-latin-900-normal.woff2) format('woff2'); }
  html, body { margin: 0; height: 100%; background: #111; overflow: hidden; }
  #wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  #stage { height: 100vh; width: 56.25vh; max-width: 100vw; max-height: 177.78vw; display: block; }
  text { font-family: Montserrat, 'Noto Color Emoji', sans-serif; font-weight: 900; }
  .mono { font-family: 'DejaVu Sans Mono', monospace; font-weight: 700; }
  .emoji { font-family: 'Noto Color Emoji', sans-serif; font-weight: 400; }
  #ui { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 12px; align-items: center;
        background: rgba(26, 26, 26, .8); padding: 8px 14px; border-radius: 999px; font: 14px sans-serif; color: #fff; }
  #ui button { background: #2ECC71; border: 0; border-radius: 999px; padding: 6px 14px; font-weight: 700; cursor: pointer; }
  #ui input[type=range] { width: min(40vw, 320px); }
  body.render #ui { display: none; }
`;

// setup({ duration, palette?, safe?, words?, audio?, emojis? }) : à appeler (avec await) avant de construire les scènes.
async function setup(o) {
  M.DUR = o.duration;
  Object.assign(M.C, o.palette || {});
  Object.assign(M.SAFE, o.safe || {});
  M.CX = o.cx ?? M.CX;
  M.WORDS = o.words || [];
  M.audio = o.audio || null;
  M.RENDER = new URLSearchParams(location.search).has('render');
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  if (M.RENDER) document.body.classList.add('render');
  const wrap = Object.assign(document.createElement('div'), { id: 'wrap' });
  document.body.appendChild(wrap);
  M.svg = el('svg', { id: 'stage', viewBox: `0 0 ${M.W} ${M.H}` }, wrap);
  M.defs = el('defs', {}, M.svg);
  M.sceneLayer = el('g', {}, M.svg);
  await Promise.all(['700', '800', '900'].map(w => document.fonts.load(`${w} 80px Montserrat`))
    .concat(o.emojis ? [document.fonts.load('80px "Noto Color Emoji"', o.emojis)] : []));
  return M;
}

// --- voix-off : temps des mots (fichier assets/<nom>_words.js) ---------------
const keyOf = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%$]/g, '');
function Wt(word, n = 1, from = 0) {           // début du n-ième mot correspondant (après le temps `from`)
  const k = keyOf(word); let c = 0;
  for (const w of M.WORDS) if (w.t0 >= from && keyOf(w.w) === k && ++c === n) return w.t0;
  throw new Error('mot introuvable : ' + word);
}

// --- éléments graphiques communs (flat design, ombre portée décalée) ----------
function txt(parent, str, o = {}) {
  const { INK } = M.C;
  const g = el('g', {}, parent);
  const a = { x: 0, y: 0, 'text-anchor': o.anchor || 'middle', 'font-size': o.size || 80, 'font-weight': o.weight || 900, fill: o.fill || INK, 'letter-spacing': o.ls ?? 0 };
  if (o.cls) a.class = o.cls;
  if (o.shadow) { const s = el('text', { ...a, x: o.shadow, y: o.shadow, fill: INK, stroke: INK, 'stroke-width': o.sw || 0, 'stroke-linejoin': 'round' }, g); s.textContent = str; }
  const m = el('text', { ...a, ...(o.sw ? { stroke: o.stroke || INK, 'stroke-width': o.sw, 'paint-order': 'stroke', 'stroke-linejoin': 'round' } : {}) }, g);
  m.textContent = str;
  return { g, t: m, w: m.getComputedTextLength() };
}
// Titre sur une ou plusieurs lignes, centré verticalement sur (0,0). lines : ['QUI A', ['RAISON', GREEN]]
function title(parent, lines, o = {}) {
  const size = o.size || 170, lh = size * (o.lh || 1.12), g = el('g', {}, parent);
  lines.forEach((l, i) => {
    const [s, fill] = Array.isArray(l) ? l : [l, M.C.INK];
    const r = txt(g, s, { size, fill, sw: fill === M.C.INK ? 0 : o.sw ?? 14, shadow: o.shadow ?? 12, ls: o.ls ?? 0 });
    r.g.setAttribute('transform', `translate(0,${fmt((i - (lines.length - 1) / 2) * lh + size * .36)})`);
  });
  return g;
}
function card(parent, x, y, w, h, fill, r = 26, sh = 12, sw = 7) {
  el('rect', { x: x + sh, y: y + sh, width: w, height: h, rx: r, fill: M.C.INK }, parent);
  return el('rect', { x, y, width: w, height: h, rx: r, fill, stroke: M.C.INK, 'stroke-width': sw }, parent);
}
function chip(parent, str, fill = M.C.INK, color = M.C.CREAM, size = 46) {
  const { INK } = M.C;
  const g = el('g', {}, parent), inner = el('g', {}, g);
  const t = txt(inner, str, { size, fill: color });
  t.t.setAttribute('y', size * .36);
  const w = t.w + size * 1.4, h = size * 1.8;
  inner.insertBefore(el('rect', { x: -w / 2 + 8, y: -h / 2 + 8, width: w, height: h, rx: h / 2, fill: INK }), t.g);
  inner.insertBefore(el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill, stroke: INK, 'stroke-width': 6 }), t.g);
  return { g, inner, w, update(x, y, k, r = 0) { show(g, k > .001); tf(g, x, y, 1, r); tf(inner, 0, 0, k); } };
}
function bubble(parent, str, fill = M.C.RED, color = M.C.CREAM, size = 54) {
  const { INK } = M.C;
  const g = el('g', {}, parent), inner = el('g', {}, g);
  const probe = txt(inner, str, { size, fill: color });
  const w = probe.w + 80, h = size * 2;
  const d = (dx, dy) => `M${-w / 2 + dx},${-h / 2 + dy} h${w} v${h} h${-w * .55} l-46,52 l6,-52 h${-w * .45 - 6} Z`;
  inner.insertBefore(el('path', { d: d(10, 10), fill: INK, 'stroke-linejoin': 'round' }), probe.g);
  inner.insertBefore(el('path', { d: d(0, 0), fill, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }), probe.g);
  probe.t.setAttribute('y', size * .36);
  return { g, update(x, y, k, r = 0) { show(g, k > .001); tf(g, x, y, 1, r); tf(inner, 0, 0, k); } };
}
function emoji(parent, ch, size) { const t = el('text', { class: 'emoji', 'font-size': size, 'text-anchor': 'middle', y: size * .35 }, parent); t.textContent = ch; return t; }
function starPath(r1, r2, n = 5) { let d = ''; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = Math.PI * i / n - Math.PI / 2; d += (i ? 'L' : 'M') + fmt(Math.cos(a) * r) + ',' + fmt(Math.sin(a) * r); } return d + 'Z'; }
function sparkles(parent, n, seed, rad = 160) {
  const R = rng(seed), s = [];
  for (let i = 0; i < n; i++) s.push({ e: el('path', { d: starPath(22, 7, 4), fill: M.C.CREAM, stroke: M.C.INK, 'stroke-width': 4 }, parent), a: R() * 6.28, r: rad * (.8 + R() * .5), ph: R() * 6 });
  return { update(x, y, k, t) { s.forEach(o => { const kk = k * (.5 + .5 * Math.abs(Math.sin(t * 4 + o.ph))); tf(o.e, x + Math.cos(o.a) * o.r * (.6 + .4 * k), y + Math.sin(o.a) * o.r * (.6 + .4 * k), kk, t * 60); }); } };
}
function burst(parent, n = 14, col = M.C.INK) {
  const g = el('g', {}, parent);
  const ls = []; for (let i = 0; i < n; i++) ls.push(el('line', { stroke: col, 'stroke-width': 10, 'stroke-linecap': 'round', transform: `rotate(${i * 360 / n})` }, g));
  return { update(x, y, u) { show(g, u > 0 && u < 1); g.setAttribute('transform', `translate(${fmt(x)},${fmt(y)})`); const r0 = 120 + 220 * E.out(u), r1 = r0 + 70 * (1 - u); ls.forEach(l => set(l, { x1: 0, y1: -r0, x2: 0, y2: -r1, opacity: fmt(1 - u) })); } };
}
function bg(parent, fill = M.C.CREAM, dots = true) {          // fond uni + trame de points discrète
  el('rect', { width: M.W, height: M.H, fill }, parent);
  if (!dots) return;
  const g = el('g', { opacity: .08 }, parent);
  for (let y = 160; y < M.H - 220; y += 60) for (let x = 40; x < M.W - 80; x += 60) el('circle', { cx: x + (y / 60 % 2) * 30, cy: y, r: 5, fill: M.C.INK }, g);
}

// --- scènes et transitions ----------------------------------------------------
// S(a, b, build, { swipe }) : build(cam, a, b) construit la scène une fois et renvoie update(t).
// Entre deux scènes : glissement horizontal + bande oblique de la couleur `swipe` de la scène suivante.
const scenes = [];
let shake = 0;
const TR = .16;
function S(a, b, build, o = {}) {
  const root = el('g', {}, M.sceneLayer), cam = el('g', {}, root);
  const upd = build(cam, a, b);
  scenes.push({ a, b, root, upd, swipe: o.swipe || (scenes.length % 2 ? M.C.RED : M.C.GREEN) });
}
const addShake = v => { shake = Math.max(shake, v); };      // à appeler depuis update(t), v ∈ [0,1]

// --- sous-titres mot à mot ----------------------------------------------------
// captions({ y, size, max, until, active }) : groupes de 4 mots max, coupés à la ponctuation et aux silences.
// active : couleur du mot prononcé, ou fonction du temps (utile quand le fond devient vert).
let capEls = [], CAP = null;
function captions(o = {}) {
  CAP = { y: 1230, size: 72, max: 840, until: M.DUR, words: 4, color: M.C.CREAM, active: M.C.GREEN, ...o };
  M.capLayer = el('g', {}, M.svg);
  const probe = el('text', { 'font-size': CAP.size, 'font-weight': 900 }, M.svg);
  const measure = s => { probe.textContent = s; return probe.getComputedTextLength(); };
  const chunks = []; let cur = [];
  M.WORDS.filter(w => w.t0 < CAP.until - .01).forEach(w => {
    const up = w.w.toUpperCase(), prev = cur[cur.length - 1];
    const width = measure([...cur.map(c => c.up), up].join(' '));
    if (cur.length && (width > CAP.max || cur.length >= CAP.words || /[.?!,]$/.test(prev.w) || w.t0 - prev.t1 > .35)) { chunks.push(cur); cur = []; }
    cur.push({ ...w, up });
  });
  if (cur.length) chunks.push(cur);
  capEls = chunks.map((c, ci) => {
    const g = el('g', {}, M.capLayer);
    const widths = c.map(w => measure(w.up));
    const gap = CAP.size * .47, total = widths.reduce((a, b) => a + b, 0) + gap * (c.length - 1);
    let x = -total / 2;
    const items = c.map((w, i) => {
      const wg = el('g', {}, g);
      const tt = el('text', { 'text-anchor': 'middle', 'font-size': CAP.size, y: CAP.size * .36, fill: CAP.color, stroke: M.C.INK, 'stroke-width': CAP.size * .18, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, wg);
      tt.textContent = w.up;
      const cx = x + widths[i] / 2; x += widths[i] + gap;
      return { wg, tt, cx, ...w };
    });
    const next = chunks[ci + 1];
    const end = Math.min(next ? next[0].t0 - .02 : CAP.until - .15, c[c.length - 1].t1 + .45);
    return { g, items, start: c[0].t0 - .02, end };
  });
  probe.remove();
}

// --- rendu ---------------------------------------------------------------------
let swipe, swipe2, safe;
function renderAt(t) {
  const { W, H, DUR } = M;
  t = clamp(t, 0, DUR - 1e-6);
  shake = 0;
  for (const s of scenes) {
    const on = t >= s.a - TR && (t < s.b + TR && s.b < DUR || t < s.b);
    show(s.root, on);
    if (!on) continue;
    let dx = 0;
    if (t < s.a + TR && s.a > 0) dx = W * (1 - E.out(clamp((t - (s.a - TR)) / (2 * TR))));
    if (t > s.b - TR && s.b < DUR) dx = -W * E.in(clamp((t - (s.b - TR)) / (2 * TR)));
    s.root.setAttribute('transform', `translate(${fmt(dx)},0)`);
    s.upd(t);
  }
  M.sceneLayer.setAttribute('transform', shake > 0 ? `translate(${fmt((hash(Math.floor(t * 30)) - .5) * 40 * shake)},${fmt((hash(Math.floor(t * 30) + 9) - .5) * 30 * shake)}) translate(${W / 2},${H / 2}) scale(${(1 + .05 * Math.min(1, shake * 2)).toFixed(3)}) translate(${-W / 2},${-H / 2})` : '');
  // bande de transition
  const nx = scenes.find(s => s.a > 0 && Math.abs(t - s.a) < TR + .04);
  if (nx) {
    const u = (t - nx.a + TR + .04) / (2 * TR + .08), x = lerp(W + 220, -500, E.inOut(u));
    swipe.setAttribute('d', `M${fmt(x)},0 h140 l-260,${H} h-140Z`); swipe.setAttribute('fill', nx.swipe);
    swipe2.setAttribute('d', `M${fmt(x + 170)},0 h40 l-260,${H} h-40Z`);
  } else { swipe.setAttribute('d', ''); swipe2.setAttribute('d', ''); }
  // sous-titres
  for (const c of capEls) {
    const vis = t >= c.start && t < c.end;
    show(c.g, vis);
    if (!vis) continue;
    tf(c.g, M.CX, CAP.y, 1, 0);
    c.items.forEach(w => {
      const on = t >= w.t0;
      show(w.wg, on);
      if (!on) return;
      const k = E.back(clamp((t - w.t0) / .14)), active = t >= w.t0 && t < w.t1 + .02;
      tf(w.wg, w.cx, (1 - k) * 18, lerp(.55, 1, k) * (active ? 1.08 : 1), 0);
      w.tt.setAttribute('fill', active ? (typeof CAP.active === 'function' ? CAP.active(t) : CAP.active) : CAP.color);
    });
  }
}

// start() : à appeler une fois toutes les scènes déclarées.
function start() {
  const { W, H, SAFE, svg } = M;
  const trLayer = el('g', {}, svg);
  swipe = el('path', {}, trLayer); swipe2 = el('path', { fill: M.C.INK }, trLayer);
  safe = el('g', { 'pointer-events': 'none' }, svg);
  el('rect', { width: W, height: SAFE.top, fill: M.C.RED, opacity: .25 }, safe);
  el('rect', { y: H - SAFE.bottom, width: W, height: SAFE.bottom, fill: M.C.RED, opacity: .25 }, safe);
  el('rect', { x: W - SAFE.right, width: SAFE.right, height: H, fill: M.C.RED, opacity: .25 }, safe);
  show(safe, false);
  window.renderAt = renderAt;
  window.shakeAt = t => { renderAt(t); return shake; };
  window.DURATION = M.DUR;
  window.ready = true;
  renderAt(0);
  if (!M.RENDER) player();
}

// --- lecteur (aperçu navigateur, avec la voix si fournie) ----------------------
function player() {
  const ui = Object.assign(document.createElement('div'), { id: 'ui' });
  ui.innerHTML = `<button>Lecture</button><label><input type="checkbox"> zones TikTok</label><input type="range" min="0" max="${M.DUR}" step="0.01" value="0"><span>0.0s</span>`;
  document.body.appendChild(ui);
  const [btn, chk, seek, tl] = [ui.querySelector('button'), ui.querySelector('[type=checkbox]'), ui.querySelector('[type=range]'), ui.querySelector('span')];
  const au = M.audio ? new Audio(M.audio) : null;
  chk.onchange = () => show(safe, chk.checked);
  let playing = false, t0 = 0, cur = 0;
  const syncAudio = () => { if (!au) return; au.currentTime = Math.min(cur, au.duration || cur); if (playing && cur < (au.duration || Infinity)) au.play(); else au.pause(); };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Lecture'; t0 = performance.now() - cur * 1000; syncAudio(); };
  seek.oninput = () => { cur = +seek.value; t0 = performance.now() - cur * 1000; syncAudio(); renderAt(cur); tl.textContent = cur.toFixed(1) + 's'; };
  (function loop(now) {
    if (playing) { cur = (now - t0) / 1000; if (cur >= M.DUR) { cur = 0; t0 = now; syncAudio(); } seek.value = cur; renderAt(cur); tl.textContent = cur.toFixed(1) + 's'; }
    requestAnimationFrame(loop);
  })(performance.now());
}

window.Motion = {
  M, setup, start, S, Wt, captions, addShake,
  clamp, lerp, E, p, pop, fmt, rng, hash, mix, blink,
  el, set, show, tf, newId,
  txt, title, card, chip, bubble, emoji, starPath, sparkles, burst, bg,
};
})();
