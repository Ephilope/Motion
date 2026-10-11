// ---------------------------------------------------------------------------
// Sarah : petit personnage qui « dit » la voix-off, en pastille ronde façon facecam.
// À charger après lib/motion.js. Usage dans une page (après setup, avant start) :
//   <script src="assets/<nom>_env.js"></script>   (node tools/enveloppe.mjs <nom>)
//   <script src="lib/sarah.js"></script>
//   Motion.sarah({ env: window.ENV });            options : x, y, size, pos(t) → {x, y, k}
// La bouche suit le volume de la voix (window.ENV) ; sans enveloppe, elle bat sur les mots.
// Les expressions viennent du texte (M.WORDS) :
//   mot finissant par « ? »  → sourcils asymétriques, tête penchée (elle interroge)
//   mot finissant par « … »  → elle se penche, yeux plissés, puis surprise sur le mot suivant
//   chiffre ou %             → sourcils levés, hochement, index levé
//   « attention »            → index levé, air sérieux
//   dernier mot              → grand sourire et clin d'œil
// Le calque est posé au-dessus des scènes et des sous-titres, sous les bandes de transition :
// appeler Motion.sarah() après captions() et avant start().
// ---------------------------------------------------------------------------
(() => {
const { M, el, set, show, tf, fmt, clamp, lerp, E, blink } = Motion;

const SKIN = '#F2C9A0', SKIN_D = '#E2AE80', HAIR = '#5A3426', HAIR_D = '#43251B', CHEEK = '#F08C7A';

function sarah(o = {}) {
  const { INK, GREEN, RED, CREAM, WHITE } = M.C;
  const X = o.x ?? 205, Y = o.y ?? 1515, SIZE = o.size ?? 1;
  const ENV = o.env || null;
  const R = 140;

  // --- repères tirés du texte ----------------------------------------------------
  const W = M.WORDS, cues = [];
  W.forEach((w, i) => {
    const s = w.w.replace(/_/g, ' ').trim(), next = W[i + 1];
    if (/\?\s*$/.test(s)) cues.push({ k: 'q', a: w.t0 - .45, b: w.t1 + .55 });
    if (/…\s*$/.test(s) && next) { cues.push({ k: 'lean', a: w.t0, b: next.t0 }); cues.push({ k: 'wow', a: next.t0 - .05, b: next.t0 + .75 }); }
    if (/\d|%/.test(s)) cues.push({ k: 'num', a: w.t0 - .1, b: w.t1 + .35 });
    if (/^attention/i.test(s)) cues.push({ k: 'warn', a: w.t0 - .1, b: w.t1 + 1.2 });
  });
  const last = W[W.length - 1];
  if (last) cues.push({ k: 'end', a: last.t0, b: 1e9 });
  // trapèze : monte en `up` s, tient, redescend en `dn` s
  const level = (t, k, up = .15, dn = .3) => {
    let v = 0;
    for (const c of cues) if (c.k === k && t > c.a - up && t < c.b + dn)
      v = Math.max(v, Math.min(E.out(clamp((t - c.a + up) / up)), 1 - E.inOut(clamp((t - c.b) / dn))));
    return v;
  };
  const wordAt = t => W.find(w => t >= w.t0 - .03 && t < w.t1 + .03);
  const volume = t => {
    if (ENV) { const f = t * ENV.fps, i = Math.floor(f), a = ENV.v[i] || 0, b = ENV.v[i + 1] || 0; return lerp(a, b, f - i); }
    const w = wordAt(t); if (!w) return 0;                       // repli : battement sur les syllabes
    return .35 + .5 * Math.abs(Math.sin((t - w.t0) * 17));
  };

  // --- dessin ---------------------------------------------------------------------
  const layer = el('g', { 'pointer-events': 'none' }, M.svg);
  const root = el('g', {}, layer), badge = el('g', {}, root);
  const clipId = Motion.newId('sarahclip');
  el('circle', { r: R }, el('clipPath', { id: clipId }, M.defs));
  el('circle', { cx: 10, cy: 10, r: R, fill: INK }, badge);                       // ombre portée
  el('circle', { r: R, fill: GREEN }, badge);
  const inside = el('g', { 'clip-path': `url(#${clipId})` }, badge);
  // rayons de fond qui tournent doucement
  const rays = el('g', { opacity: .18 }, inside);
  for (let i = 0; i < 12; i++) el('path', { d: `M0,0 L${fmt(Math.cos(i * .5236) * 220)},${fmt(Math.sin(i * .5236) * 220)} L${fmt(Math.cos(i * .5236 + .26) * 220)},${fmt(Math.sin(i * .5236 + .26) * 220)}Z`, fill: CREAM }, rays);

  const body = el('g', {}, inside);
  el('path', { d: 'M-130,190 C-128,120 -95,92 -45,86 L45,86 C95,92 128,120 130,190 Z', fill: RED, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, body);
  el('path', { d: 'M-24,84 L0,112 L24,84', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, body);

  const head = el('g', {}, body);
  el('rect', { x: -18, y: 50, width: 36, height: 42, rx: 12, fill: SKIN_D, stroke: INK, 'stroke-width': 6 }, head);    // cou
  el('path', { d: 'M-80,-30 C-92,-90 -40,-118 0,-116 C40,-118 92,-90 80,-30 C86,10 84,48 66,64 L-66,64 C-84,48 -86,10 -80,-30 Z', fill: HAIR, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, head);
  el('ellipse', { cx: 0, cy: -4, rx: 60, ry: 70, fill: SKIN, stroke: INK, 'stroke-width': 7 }, head);
  // boucles d'oreilles
  [-1, 1].forEach(s => el('circle', { cx: s * 62, cy: 26, r: 7, fill: CREAM, stroke: INK, 'stroke-width': 4 }, head));
  // frange
  el('path', { d: 'M-64,-26 C-66,-72 -30,-92 6,-88 C44,-86 68,-62 64,-22 C44,-44 18,-52 -6,-56 C-26,-46 -44,-34 -64,-26 Z', fill: HAIR }, head);
  el('path', { d: 'M64,-22 C44,-44 18,-52 -6,-56 C-26,-46 -44,-34 -64,-26', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, head);
  el('path', { d: 'M-30,-74 C-14,-82 10,-82 24,-76', fill: 'none', stroke: HAIR_D, 'stroke-width': 6, 'stroke-linecap': 'round' }, head);
  const cheeks = [-1, 1].map(s => el('ellipse', { cx: s * 36, cy: 24, rx: 13, ry: 8, fill: CHEEK, opacity: .45 }, head));

  const eyes = [-1, 1].map(s => {
    const g = el('g', {}, head);
    el('ellipse', { rx: 9, ry: 12, fill: INK }, g);
    el('circle', { cx: 3, cy: -4, r: 3.2, fill: WHITE }, g);
    return { g, s };
  });
  const lids = [-1, 1].map(s => el('path', { d: '', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, head));
  const brows = [-1, 1].map(s => el('path', { d: 'M-14,0 Q0,-6 14,0', fill: 'none', stroke: HAIR_D, 'stroke-width': 7, 'stroke-linecap': 'round' }, head));
  const mouthG = el('g', {}, head);
  const mouthClip = Motion.newId('sarahmouth');
  const mouthClipPath = el('path', {}, el('clipPath', { id: mouthClip }, M.defs));
  const mouth = el('path', { fill: '#7A1E22', stroke: INK, 'stroke-width': 5.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, mouthG);
  const inner = el('g', { 'clip-path': `url(#${mouthClip})` }, mouthG);
  const teeth = el('rect', { x: -30, width: 60, height: 10, fill: WHITE }, inner);
  const tongue = el('ellipse', { rx: 13, ry: 8, fill: '#E86A6A' }, inner);
  const mouthLine = el('path', { fill: 'none', stroke: INK, 'stroke-width': 5.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, mouthG);

  // main (index levé), qui entre par le bas de la pastille
  const hand = el('g', {}, inside);
  el('rect', { x: -9, y: -70, width: 20, height: 52, rx: 10, fill: SKIN, stroke: INK, 'stroke-width': 6 }, hand);
  el('rect', { x: -26, y: -32, width: 52, height: 56, rx: 18, fill: SKIN, stroke: INK, 'stroke-width': 6 }, hand);
  el('path', { d: 'M-12,-10 h22 M-12,4 h22', stroke: SKIN_D, 'stroke-width': 4, 'stroke-linecap': 'round' }, hand);
  el('rect', { x: -32, y: 20, width: 64, height: 60, rx: 10, fill: RED, stroke: INK, 'stroke-width': 6 }, hand);

  el('circle', { r: R, fill: 'none', stroke: INK, 'stroke-width': 8 }, badge);

  // --- animation ------------------------------------------------------------------
  function update(t) {
    const pos = o.pos ? o.pos(t) : { x: X, y: Y, k: 1 };
    const k = pos.k ?? 1;
    show(layer, k > .001);
    if (k <= .001) return;
    const speaking = W.length && t >= W[0].t0 - .1 && t <= last.t1 + .1;

    // bouche : volume lissé sur ±25 ms, avec un léger temps d'avance sur le son
    let v = 0; for (let d = -1; d <= 1; d++) v += volume(t + .03 + d * .025); v /= 3;
    const open = clamp((v - .1) / .75);
    const w = wordAt(t), round = w && /o|ou|u/i.test(w.w) ? .45 : 0;
    const q = level(t, 'q'), lean = level(t, 'lean', .2, .05), wow = level(t, 'wow', .06, .35);
    const num = level(t, 'num', .08, .25), warn = level(t, 'warn', .15, .3), end = level(t, 'end', .3, .1);
    const smile = .35 + .65 * end - .25 * warn - .2 * lean;

    // tête : balancement de repos, hochement sur la voix et sur les chiffres
    const bob = Math.sin(t * 2.1) * 3 + (speaking ? -open * 6 : 0) - num * 8 * Math.abs(Math.sin((t) * 9));
    const tilt = Math.sin(t * 1.3) * 2.5 + q * 9 - lean * 4 + end * Math.sin(t * 5) * 4;
    const sc = 1 + wow * .07 + lean * .05;
    tf(head, lean * 6, bob - wow * 8 + 6, sc, tilt);
    tf(body, 0, Math.sin(t * 2.1 + .6) * 2, 1, tilt * .25);
    rays.setAttribute('transform', `rotate(${fmt(t * 12)})`);

    // yeux : clignement, surprise (grands), plissés quand elle se penche, clin d'œil final
    const bl = blink(t, .7, 3.4), wink = end * clamp(Math.sin((t - last.t0) * 3));
    eyes.forEach((e, i) => {
      const look = q * 3 + Math.sin(t * .7) * 1.5;
      let open_ = (1 - bl) * (1 + wow * .35) * (1 - lean * .45);
      if (i === 1) open_ *= 1 - wink;
      tf(e.g, e.s * 25 + look, -4 - wow * 2, 1, 0);
      e.g.firstChild.setAttribute('ry', fmt(Math.max(.6, 12 * open_)));
      e.g.firstChild.setAttribute('rx', fmt(9 * (1 + wow * .15)));
      e.g.lastChild.setAttribute('opacity', open_ > .5 ? 1 : 0);
      const closed = open_ < .25;
      lids[i].setAttribute('d', closed ? `M${fmt(e.s * 25 - 11)},-4 Q${fmt(e.s * 25)},${i === 1 && wink > .5 ? -12 : 4} ${fmt(e.s * 25 + 11)},-4` : '');
    });
    // sourcils
    brows.forEach((b, i) => {
      const s = i ? 1 : -1;
      const up = wow * 12 + num * 7 + (s > 0 ? q * 10 : -q * 2) - warn * 3 - lean * 2 + end * 4;
      const rot = s * (warn * 12 + lean * 6) + (s > 0 ? -q * 8 : 0);
      tf(b, s * 25, -30 - up, 1, rot);
    });
    cheeks.forEach(c => c.setAttribute('opacity', fmt(.4 + .4 * end)));

    // bouche
    const mw = lerp(18, 28, open) * (1 - round * open * .5) + smile * 6, mh = open * (24 + wow * 10);
    const curve = smile * 9;
    const y0 = 34;
    if (mh < 2.5) {
      show(mouth, false); show(inner, false); show(mouthLine, true);
      mouthLine.setAttribute('d', `M${fmt(-mw)},${fmt(y0 - curve * .4)} Q0,${fmt(y0 + curve)} ${fmt(mw)},${fmt(y0 - curve * .4)}`);
    } else {
      show(mouth, true); show(inner, true); show(mouthLine, false);
      const d = `M${fmt(-mw)},${fmt(y0 - curve * .4)} Q0,${fmt(y0 - mh * .25 + curve * .3)} ${fmt(mw)},${fmt(y0 - curve * .4)} Q${fmt(mw * .8)},${fmt(y0 + mh)} 0,${fmt(y0 + mh)} Q${fmt(-mw * .8)},${fmt(y0 + mh)} ${fmt(-mw)},${fmt(y0 - curve * .4)} Z`;
      mouth.setAttribute('d', d); mouthClipPath.setAttribute('d', d);
      teeth.setAttribute('y', fmt(y0 - mh * .25 - 4));
      set(tongue, { cy: fmt(y0 + mh * .9), rx: fmt(mw * .55) });
    }

    // main : index levé sur les chiffres et sur « attention »
    const hk = Math.max(num, warn);
    tf(hand, 78, lerp(210, 108, E.back(hk)) + Math.sin(t * 8) * 3 * hk, 1, -12 + Math.sin(t * 6) * 4 * hk);

    // pastille : entrée en rebond, petit sursaut sur la surprise
    tf(root, pos.x, pos.y - wow * 10, SIZE * k * (1 + wow * .04), Math.sin(t * 1.1) * 1.5);
  }
  M.overlays.push(update);
  return { layer, update };
}

Motion.sarah = sarah;
})();
