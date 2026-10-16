// ---------------------------------------------------------------------------
// Séléné : petit personnage en pied, à tête de lune (mers, cratères, halo, étoiles), qui « dit » la voix-off.
// À charger après lib/motion.js. Usage dans une page :
//   <script src="assets/<nom>_env.js"></script>   (node tools/enveloppe.mjs <nom>)
//   <script src="lib/selene.js"></script>
//   Motion.selene({ env: window.ENV });            options : x, y (position des pieds), size, pos(t) → {x, y, k}
// La bouche suit le volume de la voix (window.ENV) ; sans enveloppe, elle bat sur les mots.
// Les gestes et expressions viennent du texte (M.WORDS) :
//   mot finissant par « ? »  → haussement d'épaules paumes en l'air, tête penchée, sourcil levé
//   mot finissant par « … »  → mains jointes, elle se penche, yeux plissés ; puis bras en l'air
//                              et petit saut de surprise sur le mot suivant
//   chiffre ou %             → index levé, sourcils hauts
//   « attention »            → index levé, air sérieux
//   dernier mot              → grand sourire, clin d'œil, coucou de la main
//   « Séléné » dans la voix  → carte « MOI C'EST SÉLÉNÉ » à sa droite, puis bouton « ABONNE-TOI »
//                              sur le mot « abonne… », qu'elle montre du doigt (fin type : docs/MODELE.md)
//   le reste du temps        → une main accompagne la parole, elle respire et se balance
// Option mood: 'sad' (sujet triste) : bouche tombante, sourcils relevés au centre, paupières lourdes,
// tête basse, gestes plus lents et plus petits, pas de bras en l'air ni de saut, une larme de temps en temps.
// Appeler Motion.selene() après captions() et avant start() : le calque passe au-dessus
// des scènes et des sous-titres, sous les bandes de transition.
// ---------------------------------------------------------------------------
(() => {
const { M, el, set, show, tf, fmt, clamp, lerp, E, blink, hash, starPath, pop, txt } = Motion;
const keyOf = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const MOON = '#ECE8DC', MOON_D = '#A9A390', MARE = '#CFC9B8', CRATER = '#D9D4C5', GLOW = '#FFF3B0', SKIN = '#ECE8DC', CHEEK = '#F5937E', LEG = '#1A1A1A';
const rad = d => d * Math.PI / 180;

function selene(o = {}) {
  const { INK, GREEN, RED, CREAM, WHITE } = M.C;
  const X = o.x ?? 165, Y = o.y ?? 1660, SIZE = o.size ?? .92;
  const ENV = o.env || null;
  const SAD = o.mood === 'sad' ? 1 : 0;

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
  // fin type « Moi, c'est Séléné. Abonne-toi… » : le « abonne » compté est celui qui suit son nom
  const nameW = W.find(w => keyOf(w.w) === 'selene'), subW = nameW && W.find(w => w.t0 > nameW.t0 && /^abonne/.test(keyOf(w.w)));
  if (subW) cues.push({ k: 'sub', a: subW.t0 - .1, b: subW.t1 + 1.1 });
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

  // tête de lune : halo, disque gris clair, mers sombres, cratères, ombre en croissant
  const head = el('g', {}, upper);
  const HR = 78, HY = -312;
  const halo = el('g', {}, head);
  el('circle', { cx: 0, cy: HY, r: HR + 40, fill: GLOW, opacity: .22 }, halo);
  el('circle', { cx: 0, cy: HY, r: HR + 20, fill: GLOW, opacity: .45 }, halo);
  upper.insertBefore(halo, upper.firstChild);                                                 // derrière la robe et les bras
  el('circle', { cx: 8, cy: HY + 8, r: HR, fill: INK }, head);                                   // ombre portée
  el('circle', { cx: 0, cy: HY, r: HR, fill: MOON }, head);
  const moonClip = Motion.newId('selenemoon');
  el('circle', { cx: 0, cy: HY, r: HR }, el('clipPath', { id: moonClip }, M.defs));
  const surf = el('g', { 'clip-path': `url(#${moonClip})` }, head);
  // mers lunaires (taches sombres irrégulières)
  [
    `M-70,-30 C-62,-62 -24,-74 -6,-56 C6,-44 -12,-30 -30,-30 C-44,-30 -52,-14 -64,-10 Z`,
    `M40,-22 C56,-34 82,-26 84,-4 C86,16 70,22 58,14 C46,8 30,-10 40,-22 Z`,
    `M-74,30 C-60,22 -46,34 -50,50 C-54,66 -70,72 -80,60 Z`,
    `M10,-80 C26,-82 40,-72 34,-62 C28,-54 12,-60 6,-68 Z`,
  ].forEach(d => el('path', { d, fill: MARE, transform: `translate(0,${HY})` }, surf));
  // cratères : creux plus sombre, bord éclairé en bas à droite
  [[-40, -48, 13], [30, -58, 8], [56, -16, 8], [-60, -10, 6], [-40, 56, 9], [46, 52, 7], [-12, -70, 5], [64, 26, 5], [8, 66, 6]].forEach(([x, y, r]) => {
    el('circle', { cx: x, cy: HY + y, r, fill: CRATER, stroke: MOON_D, 'stroke-width': 3 }, surf);
    el('path', { d: `M${fmt(x + r * .95)},${fmt(HY + y - r * .3)} A${r},${r} 0 0 1 ${fmt(x - r * .3)},${fmt(HY + y + r * .95)}`, fill: 'none', stroke: WHITE, 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: .8 }, surf);
  });
  // ombre en croissant sur le côté droit (comme une lune presque pleine)
  el('path', { d: `M0,${HY - HR} A${HR},${HR} 0 0 1 0,${HY + HR} A${HR * .72},${HR} 0 0 0 0,${HY - HR} Z`, fill: MOON_D, opacity: .45 }, surf);
  // reflet
  el('path', { d: `M${-54},${HY - 26} A60,60 0 0 1 ${-20},${HY - 62}`, fill: 'none', stroke: WHITE, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: .7 }, surf);
  el('circle', { cx: 0, cy: HY, r: HR, fill: 'none', stroke: INK, 'stroke-width': 7 }, head);
  // petites étoiles qui scintillent autour de la tête
  const stars = [[-104, -58, 13], [96, -84, 11], [108, 6, 8]].map(([x, y, r], i) => ({ e: el('path', { d: starPath(r, r * .42, 4), fill: GLOW, stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, upper), x, y: HY + y, ph: i * 2.1 }));
  const cheeks = [-1, 1].map(s => el('ellipse', { cx: s * 40, cy: HY + 24, rx: 13, ry: 8, fill: CHEEK, opacity: .5 }, head));
  const tear = el('path', { d: 'M0,-11 C5,-3 8,2 8,6 A8,8 0 0 1 -8,6 C-8,2 -5,-3 0,-11 Z', fill: '#8FD3FF', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, head);
  show(tear, false);

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
  const mouthClip = Motion.newId('selenemouth');
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
    show:  [70, 78],       // bras tendu vers la carte « abonne-toi »
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

  // --- carte de fin : son nom, puis le bouton « abonne-toi » ---------------------
  // Dans le repère de la page (pas du personnage), à droite de Séléné, hors zones TikTok.
  let outro = null;
  if (nameW) {
    const { INK, RED, CREAM, WHITE } = M.C;
    const g = el('g', {}, layer), nameG = el('g', {}, g), subG = el('g', {}, g);
    el('rect', { x: -240, y: -104, width: 480, height: 208, rx: 36, fill: INK, transform: 'translate(12,12)' }, nameG);
    el('rect', { x: -240, y: -104, width: 480, height: 208, rx: 36, fill: CREAM, stroke: INK, 'stroke-width': 8 }, nameG);
    const l1 = txt(nameG, "MOI C'EST", { size: 40 }); l1.g.setAttribute('transform', 'translate(0,-34)');
    const l2 = txt(nameG, 'SÉLÉNÉ', { size: 86, fill: RED, sw: 10 }); l2.g.setAttribute('transform', 'translate(0,62)');
    el('rect', { x: -210, y: -46, width: 420, height: 92, rx: 46, fill: INK, transform: 'translate(9,9)' }, subG);
    el('rect', { x: -210, y: -46, width: 420, height: 92, rx: 46, fill: RED, stroke: INK, 'stroke-width': 7 }, subG);
    const plus = txt(subG, '+', { size: 60, fill: WHITE }); plus.g.setAttribute('transform', 'translate(-160,21)');
    const st = txt(subG, 'ABONNE-TOI', { size: 46, fill: WHITE }); st.g.setAttribute('transform', 'translate(22,17)');
    const X0 = o.cardX ?? 590, Y0 = o.cardY ?? 1420;
    outro = t => {
      const k1 = pop(t, nameW.t0 - .15, .35), k2 = subW ? pop(t, subW.t0 - .1, .35) : 0;
      show(g, k1 > .001);
      tf(nameG, X0, Y0, k1, -3 + Math.sin(t * 2.4) * 1.5);
      show(subG, k2 > .001);
      tf(subG, X0 + 10, Y0 + 176, k2 * (1 + .06 * Math.sin(t * 8) * (t > (subW?.t1 ?? 0))), 2);
    };
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
    const q = level(t, 'q'), lean = level(t, 'lean', .2, .05), wow = level(t, 'wow', .06, .35) * (1 - SAD * .85);
    const num = level(t, 'num', .08, .25), warn = level(t, 'warn', .15, .3), end = level(t, 'end', .3, .1), sub = level(t, 'sub', .15, .3);
    const smile = SAD ? -.75 + .55 * end - .15 * lean : .35 + .65 * end - .25 * warn - .2 * lean;

    // corps : respiration, balancement, saut de surprise, penché en avant pendant le suspens
    const jump = Math.sin(clamp(wow * 1.2) * Math.PI) * 26;
    const breathe = Math.sin(t * 2.1) * 1.5;
    tf(root, pos.x, pos.y, SIZE * k, 0);
    tf(body, 0, -jump, 1, Math.sin(t * (1.2 - SAD * .5)) * 1.5 + lean * 5 + SAD * 2);
    tf(ground, 0, 0, 1 - jump / 80, 0);
    tf(upper, 0, breathe - lean * 4 + SAD * 4, 1, 0);
    // jambes : petit piétinement de surprise
    legs.forEach((g, i) => tf(g, 0, -wow * 6 * Math.abs(Math.sin(t * 12 + i * 1.6)), 1, 0));

    // tête
    const bob = (speaking ? -open * 5 : 0) - num * 6 * Math.abs(Math.sin(t * 9));
    const tilt = Math.sin(t * (1.3 - SAD * .6)) * 3 + q * 10 - lean * 4 + end * Math.sin(t * 5) * 4 * (1 - SAD * .6) - SAD * 7;
    head.setAttribute('transform', `translate(0,${fmt(bob + SAD * 6)}) rotate(${fmt(tilt)},0,${HY + HR * .7}) translate(0,${HY}) scale(${(1 + wow * .06).toFixed(3)}) translate(0,${-HY})`);
    stars.forEach(o => tf(o.e, o.x, o.y + Math.sin(t * 1.7 + o.ph) * 4, .6 + .4 * Math.abs(Math.sin(t * 2.3 + o.ph)), t * 40 + o.ph * 30));
    halo.setAttribute('opacity', fmt((.8 + .2 * Math.sin(t * 2.6) + wow * .3) * (1 - SAD * .45)));

    // bras : chaque pose s'ajoute à la précédente selon son intensité
    const gest = speaking && wi >= 0 ? .6 + .4 * hash(wi * 3.1) : 0;   // la main droite parle
    const talkW = clamp(gest * .55 + open * .35) * (1 - Math.max(q, wow, num, warn, end, lean)) * (1 - SAD * .45);
    arms.forEach(a => {
      const right = a.s > 0;
      let ang = [...POSE.idle];
      ang[0] += Math.sin(t * 1.9 + a.s) * 3;
      if (right) ang = mixPose(ang, [POSE.talk[0], POSE.talk[1] + Math.sin(t * (7 - SAD * 3)) * 18 * (1 - SAD * .5) * open], talkW);
      ang = mixPose(ang, POSE.join, lean);
      ang = mixPose(ang, POSE.shrug, q * (1 - SAD * .4));
      ang = mixPose(ang, POSE.up, wow);
      if (right) ang = mixPose(ang, POSE.point, Math.max(num, warn));
      if (right) ang = mixPose(ang, [POSE.wave[0] - SAD * 35, POSE.wave[1] + Math.sin(t * (11 - SAD * 5)) * 22], end * (1 - sub));
      if (right) ang = mixPose(ang, POSE.show, sub);
      drawArm(a, ang, right && Math.max(num, warn, sub) > .5);
    });

    // yeux : clignement, surprise (grands), plissés pendant le suspens, clin d'œil final
    const bl = blink(t, .7, 3.4), wink = end * clamp(Math.sin((t - last.t0) * 3));
    eyes.forEach((e, i) => {
      const look = q * 3 + Math.sin(t * .7) * 1.5;
      let op = (1 - bl) * (1 + wow * .35) * (1 - lean * .45) * (1 - SAD * .3 * (1 - end));
      if (i === 1) op *= 1 - wink;
      tf(e.g, e.s * 27 + look, HY - 6 - wow * 2 + SAD * 3, 1, 0);
      e.g.firstChild.setAttribute('ry', fmt(Math.max(.6, 12 * op)));
      e.g.firstChild.setAttribute('rx', fmt(9 * (1 + wow * .15)));
      e.g.childNodes[1].setAttribute('opacity', op > .5 ? 1 : 0);
      e.lashes.setAttribute('opacity', op > .5 ? 1 : 0);
      lids[i].setAttribute('d', op < .25 ? `M${fmt(e.s * 27 - 11)},${HY - 6} Q${fmt(e.s * 27)},${HY + (i === 1 && wink > .5 ? -14 : 2)} ${fmt(e.s * 27 + 11)},${HY - 6}` : '');
    });
    brows.forEach((b, i) => {
      const s = i ? 1 : -1;
      const up = wow * 12 + num * 7 + (s > 0 ? q * 10 : -q * 2) - warn * 3 - lean * 2 + end * 4;
      const rot = s * (warn * 12 * (1 - SAD) + lean * 6 + SAD * 16 * (1 - end * .5)) + (s > 0 ? -q * 8 : 0);
      tf(b, s * 27, HY - 34 - up, 1, rot);
    });
    cheeks.forEach(c => c.setAttribute('opacity', fmt(.45 + .4 * end - SAD * .25)));
    // larme : coule de l'œil gauche sur la joue toutes les 7 s environ (hors fin)
    if (SAD) {
      const ph = (t + 3) % 7, k = clamp(ph / 2.2), on = ph < 2.2 && end < .5;
      show(tear, on);
      if (on) { tear.setAttribute('transform', `translate(${fmt(-30)},${fmt(HY + 6 + E.inOut(k) * 34)}) scale(${fmt(.6 + .4 * clamp(k * 4))})`); tear.setAttribute('opacity', fmt(1 - clamp((k - .8) * 5))); }
    }

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
  M.overlays.push(outro ? t => { update(t); outro(t); } : update);
  return { layer, update };
}

Motion.selene = selene;
Motion.sarah = selene;   // ancien nom (pages faites avant le renommage)
})();
