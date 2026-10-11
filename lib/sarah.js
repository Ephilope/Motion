// ---------------------------------------------------------------------------
// Sarah : petit personnage en pied, à tête de lune, qui « dit » la voix-off.
// À charger après lib/motion.js. Usage dans une page :
//   <script src="assets/<nom>_env.js"></script>   (node tools/enveloppe.mjs <nom>)
//   <script src="lib/sarah.js"></script>
//   Motion.sarah({ env: window.ENV });            options : x, y (position des pieds), size, pos(t) → {x, y, k}
// La bouche suit le volume de la voix (window.ENV) ; sans enveloppe, elle bat sur les mots.
// Les gestes et expressions viennent du texte (M.WORDS) :
//   mot finissant par « ? »  → haussement d'épaules paumes en l'air, tête penchée, sourcil levé
//   mot finissant par « … »  → mains jointes, elle se penche, yeux plissés ; puis bras en l'air
//                              et petit saut de surprise sur le mot suivant
//   chiffre ou %             → index levé, sourcils hauts
//   « attention »            → index levé, air sérieux
//   dernier mot              → grand sourire, clin d'œil, coucou de la main
//   le reste du temps        → une main accompagne la parole, elle respire et se balance
// Appeler Motion.sarah() après captions() et avant start() : le calque passe au-dessus
// des scènes et des sous-titres, sous les bandes de transition.
// ---------------------------------------------------------------------------
(() => {
const { M, el, set, show, tf, fmt, clamp, lerp, E, blink, hash, starPath } = Motion;

const MOON = '#FFE48A', MOON_D = '#F2C94C', SKIN = '#FFE48A', CHEEK = '#F5937E', LEG = '#1A1A1A';
const rad = d => d * Math.PI / 180;

function sarah(o = {}) {
  const { INK, GREEN, RED, CREAM, WHITE } = M.C;
  const X = o.x ?? 165, Y = o.y ?? 1660, SIZE = o.size ?? .92;
  const ENV = o.env || null;

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
  const wordIdx = t => W.findIndex(w => t >= w.t0 - .03 && t < w.t1 + .03);
  const volume = t => {
    if (ENV) { const f = t * ENV.fps, i = Math.floor(f), a = ENV.v[i] || 0, b = ENV.v[i + 1] || 0; return lerp(a, b, f - i); }
    const i = wordIdx(t); if (i < 0) return 0;                  // repli : battement sur les syllabes
    return .35 + .5 * Math.abs(Math.sin((t - W[i].t0) * 17));
  };

  // --- dessin (origine : entre les pieds ; y vers le bas) -------------------------
  const layer = el('g', { 'pointer-events': 'none' }, M.svg);
  const root = el('g', {}, layer);
  const ground = el('ellipse', { cx: 0, cy: 4, rx: 62, ry: 11, fill: INK, opacity: .18 }, root);
  const body = el('g', {}, root);

  // jambes et chaussures
  const legs = [-1, 1].map(s => {
    const g = el('g', {}, body);
    el('rect', { x: s * 17 - 11, y: -104, width: 22, height: 96, rx: 11, fill: LEG }, g);
    el('rect', { x: s * 17 - 15 + s * 6, y: -14, width: 30, height: 17, rx: 8.5, fill: RED, stroke: INK, 'stroke-width': 5 }, g);
    return g;
  });

  const upper = el('g', {}, body);                // tout ce qui est au-dessus des hanches
  // bras derrière le buste : dessinés dans des groupes mis à jour à chaque image
  const mkArm = s => {
    const g = el('g', {}, upper);
    const outline = el('path', { fill: 'none', stroke: INK, 'stroke-width': 25, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const fill = el('path', { fill: 'none', stroke: RED, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const hand = el('g', {}, g);
    const finger = el('rect', { x: -5, y: -30, width: 11, height: 26, rx: 5.5, fill: SKIN, stroke: INK, 'stroke-width': 4.5 }, hand);
    el('circle', { r: 15, fill: SKIN, stroke: INK, 'stroke-width': 5 }, hand);
    return { s, g, outline, fill, hand, finger };
  };
  const arms = [mkArm(-1), mkArm(1)];
  // robe trapèze
  el('path', { d: 'M-40,-232 C-46,-232 -50,-226 -52,-218 L-72,-112 C-74,-102 -68,-96 -58,-96 L58,-96 C68,-96 74,-102 72,-112 L52,-218 C50,-226 46,-232 40,-232 Z', fill: RED, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, upper);
  el('path', { d: 'M-62,-122 L62,-122', stroke: INK, 'stroke-width': 5, opacity: .25 }, upper);
  el('path', { d: 'M-22,-232 Q0,-210 22,-232', fill: CREAM, stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, upper);
  // les bras passent devant la robe : on remonte leurs groupes
  arms.forEach(a => upper.appendChild(a.g));

  // tête de lune
  const head = el('g', {}, upper);
  const HR = 78, HY = -312;
  el('circle', { cx: 8, cy: HY + 8, r: HR, fill: INK }, head);                                   // ombre portée
  el('circle', { cx: 0, cy: HY, r: HR, fill: MOON, stroke: INK, 'stroke-width': 7 }, head);
  // cratères
  [[-44, -42, 13], [42, -48, 9], [52, 4, 7], [-56, 10, 6], [24, -64, 5]].forEach(([x, y, r]) => el('circle', { cx: x, cy: HY + y, r, fill: MOON_D, stroke: INK, 'stroke-width': 3, opacity: .9 }, head));
  // reflet
  el('path', { d: `M${-50},${HY - 30} A58,58 0 0 1 ${-14},${HY - 62}`, fill: 'none', stroke: WHITE, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: .55 }, head);
  // petite étoile en barrette
  const star = el('path', { d: starPath(19, 8, 5), fill: CREAM, stroke: INK, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, head);
  const cheeks = [-1, 1].map(s => el('ellipse', { cx: s * 40, cy: HY + 24, rx: 13, ry: 8, fill: CHEEK, opacity: .5 }, head));

  const eyes = [-1, 1].map(s => {
    const g = el('g', {}, head);
    el('ellipse', { rx: 9, ry: 12, fill: INK }, g);
    el('circle', { cx: 3, cy: -4, r: 3.2, fill: WHITE }, g);
    const lashes = el('path', { d: `M${s * 7},-9 l${s * 7},-6 M${s * 9},-3 l${s * 8},-2`, stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
    return { g, s, lashes };
  });
  const lids = [-1, 1].map(() => el('path', { d: '', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, head));
  const brows = [-1, 1].map(() => el('path', { d: 'M-13,0 Q0,-6 13,0', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, head));
  const mouthG = el('g', {}, head);
  const mouthClip = Motion.newId('sarahmouth');
  const mouthClipPath = el('path', {}, el('clipPath', { id: mouthClip }, M.defs));
  const mouth = el('path', { fill: '#7A1E22', stroke: INK, 'stroke-width': 5.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, mouthG);
  const inner = el('g', { 'clip-path': `url(#${mouthClip})` }, mouthG);
  const teeth = el('rect', { x: -30, width: 60, height: 10, fill: WHITE }, inner);
  const tongue = el('ellipse', { rx: 13, ry: 8, fill: '#E86A6A' }, inner);
  const mouthLine = el('path', { fill: 'none', stroke: INK, 'stroke-width': 5.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, mouthG);

  // --- poses des bras : angle du bras et de l'avant-bras depuis la verticale (vers le bas),
  // positif = vers l'extérieur du corps. Les poses se mélangent avec leur intensité.
  const SH = { x: 44, y: -218 }, L1 = 58, L2 = 54;
  const POSE = {
    idle:  [12, 6],
    talk:  [22, 95],       // avant-bras levé qui accompagne la parole
    shrug: [48, 118],      // paumes en l'air
    join:  [-8, -78],      // mains jointes devant la poitrine
    up:    [135, 150],     // bras en l'air
    point: [40, 172],      // index levé
    wave:  [125, 165],     // coucou
  };
  const mixPose = (base, pose, w) => [lerp(base[0], pose[0], w), lerp(base[1], pose[1], w)];
  function drawArm(a, ang, pointing) {
    const sx = a.s * SH.x, sy = SH.y;
    const ex = sx + a.s * Math.sin(rad(ang[0])) * L1, ey = sy + Math.cos(rad(ang[0])) * L1;
    const hx = ex + a.s * Math.sin(rad(ang[1])) * L2, hy = ey + Math.cos(rad(ang[1])) * L2;
    const d = `M${fmt(sx)},${fmt(sy)} L${fmt(ex)},${fmt(ey)} L${fmt(hx)},${fmt(hy)}`;
    a.outline.setAttribute('d', d); a.fill.setAttribute('d', d);
    // la main suit l'avant-bras ; l'index pointe dans son prolongement
    tf(a.hand, hx, hy, 1, a.s * -ang[1] + 180);
    show(a.finger, pointing);
  }

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
    const wi = wordIdx(t), round = wi >= 0 && /o|ou|u/i.test(W[wi].w) ? .45 : 0;
    const q = level(t, 'q'), lean = level(t, 'lean', .2, .05), wow = level(t, 'wow', .06, .35);
    const num = level(t, 'num', .08, .25), warn = level(t, 'warn', .15, .3), end = level(t, 'end', .3, .1);
    const smile = .35 + .65 * end - .25 * warn - .2 * lean;

    // corps : respiration, balancement, saut de surprise, penché en avant pendant le suspens
    const jump = Math.sin(clamp(wow * 1.2) * Math.PI) * 26;
    const breathe = Math.sin(t * 2.1) * 1.5;
    tf(root, pos.x, pos.y, SIZE * k, 0);
    tf(body, 0, -jump, 1, Math.sin(t * 1.2) * 1.5 + lean * 5);
    tf(ground, 0, 0, 1 - jump / 80, 0);
    tf(upper, 0, breathe - lean * 4, 1, 0);
    // jambes : petit piétinement de surprise
    legs.forEach((g, i) => tf(g, 0, -wow * 6 * Math.abs(Math.sin(t * 12 + i * 1.6)), 1, 0));

    // tête
    const bob = (speaking ? -open * 5 : 0) - num * 6 * Math.abs(Math.sin(t * 9));
    const tilt = Math.sin(t * 1.3) * 3 + q * 10 - lean * 4 + end * Math.sin(t * 5) * 4;
    head.setAttribute('transform', `translate(0,${fmt(bob)}) rotate(${fmt(tilt)},0,${HY + HR * .7}) translate(0,${HY}) scale(${(1 + wow * .06).toFixed(3)}) translate(0,${-HY})`);
    tf(star, -50, HY - 52, 1, 15 + Math.sin(t * 3) * 10);

    // bras : chaque pose s'ajoute à la précédente selon son intensité
    const gest = speaking && wi >= 0 ? .6 + .4 * hash(wi * 3.1) : 0;   // la main droite parle
    const talkW = clamp(gest * .55 + open * .35) * (1 - Math.max(q, wow, num, warn, end, lean));
    arms.forEach(a => {
      const right = a.s > 0;
      let ang = [...POSE.idle];
      ang[0] += Math.sin(t * 1.9 + a.s) * 3;
      if (right) ang = mixPose(ang, [POSE.talk[0], POSE.talk[1] + Math.sin(t * 7) * 18 * open], talkW);
      ang = mixPose(ang, POSE.join, lean);
      ang = mixPose(ang, POSE.shrug, q);
      ang = mixPose(ang, POSE.up, wow);
      if (right) ang = mixPose(ang, POSE.point, Math.max(num, warn));
      if (right) ang = mixPose(ang, [POSE.wave[0], POSE.wave[1] + Math.sin(t * 11) * 22], end);
      drawArm(a, ang, right && Math.max(num, warn) > .5);
    });

    // yeux : clignement, surprise (grands), plissés pendant le suspens, clin d'œil final
    const bl = blink(t, .7, 3.4), wink = end * clamp(Math.sin((t - last.t0) * 3));
    eyes.forEach((e, i) => {
      const look = q * 3 + Math.sin(t * .7) * 1.5;
      let op = (1 - bl) * (1 + wow * .35) * (1 - lean * .45);
      if (i === 1) op *= 1 - wink;
      tf(e.g, e.s * 27 + look, HY - 6 - wow * 2, 1, 0);
      e.g.firstChild.setAttribute('ry', fmt(Math.max(.6, 12 * op)));
      e.g.firstChild.setAttribute('rx', fmt(9 * (1 + wow * .15)));
      e.g.childNodes[1].setAttribute('opacity', op > .5 ? 1 : 0);
      e.lashes.setAttribute('opacity', op > .5 ? 1 : 0);
      lids[i].setAttribute('d', op < .25 ? `M${fmt(e.s * 27 - 11)},${HY - 6} Q${fmt(e.s * 27)},${HY + (i === 1 && wink > .5 ? -14 : 2)} ${fmt(e.s * 27 + 11)},${HY - 6}` : '');
    });
    brows.forEach((b, i) => {
      const s = i ? 1 : -1;
      const up = wow * 12 + num * 7 + (s > 0 ? q * 10 : -q * 2) - warn * 3 - lean * 2 + end * 4;
      const rot = s * (warn * 12 + lean * 6) + (s > 0 ? -q * 8 : 0);
      tf(b, s * 27, HY - 34 - up, 1, rot);
    });
    cheeks.forEach(c => c.setAttribute('opacity', fmt(.45 + .4 * end)));

    // bouche
    const mw = lerp(17, 27, open) * (1 - round * open * .5) + smile * 6, mh = open * (24 + wow * 10);
    const curve = smile * 9, y0 = HY + 32;
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
  }
  M.overlays.push(update);
  return { layer, update };
}

Motion.sarah = sarah;
})();
