// Voix-off ElevenLabs + horodatage mot à mot, en une commande.
//
//   node tools/voix.mjs <nom>                    génère la voix depuis scripts/<nom>.txt
//   node tools/voix.mjs <nom> --audio voix.mp3   garde une voix existante, aligne seulement le texte
//
// Écrit assets/voix_<nom>.mp3 (sauf avec --audio), assets/<nom>_words.json et assets/<nom>_words.js
// (window.WORDS, lu par lib/motion.js). La clé est lue dans ELEVENLABS_API_KEY ; sans elle, la requête part
// sans clé, pour un proxy qui l'ajoute lui-même (environnement cloud).
// Options : --voice <id>, --model <id>, --force (régénère même si le texte n'a pas changé).
// Réglages par défaut (voix, modèle, stabilité…) : voix.config.json à la racine.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// fetch() de Node ignore HTTPS_PROXY : on se relance avec NODE_USE_ENV_PROXY pour passer par le proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' };
  process.exit(spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env }).status ?? 1);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const API = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io';

// --- arguments ------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const flag = k => { const i = args.indexOf(k); return i >= 0 ? (args.splice(i, 1), true) : false; };
const audioIn = opt('--audio'), voiceArg = opt('--voice'), modelArg = opt('--model'), force = flag('--force');
const nom = args[0];
if (!nom) die('usage : node tools/voix.mjs <nom> [--audio fichier.mp3] [--voice id] [--model id] [--force]');

const cfgFile = path.join(ROOT, 'voix.config.json');
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
const voice = voiceArg || process.env.ELEVENLABS_VOICE_ID || cfg.voice_id;
const model = modelArg || cfg.model_id || 'eleven_multilingual_v2';

const scriptFile = path.join(ROOT, 'scripts', nom + '.txt');
if (!fs.existsSync(scriptFile)) die(`texte introuvable : scripts/${nom}.txt`);
const out = {
  mp3: path.join(ROOT, 'assets', `voix_${nom}.mp3`),
  json: path.join(ROOT, 'assets', `${nom}_words.json`),
  js: path.join(ROOT, 'assets', `${nom}_words.js`),
};

// --- texte : mots affichés et forme parlée ----------------------------------------
// Une ligne = une phrase, les lignes en « # » sont des commentaires.
// « mot[forme parlée] » : affiché « mot », prononcé « forme parlée » (chiffres, symboles).
// « _ » dans un mot affiché devient une espace insécable de sous-titre (« 20_% » → « 20 % »).
const { spoken, words } = parseScript(fs.readFileSync(scriptFile, 'utf8'));

function parseScript(src) {
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let spoken = '';
  const words = [];                                  // { w, a, b } : mot affiché et sa plage dans `spoken`
  lines.forEach((line, li) => {
    if (li) spoken += '\n';
    const toks = [...line.matchAll(/(\S+?)\[([^\]]+)\]|(\S+)/g)];
    toks.forEach((m, ti) => {
      if (ti) spoken += ' ';
      const w = (m[1] ?? m[3]).replace(/_/g, ' ');
      let sp = m[2] ?? w;
      if (m[2]) sp += (w.match(/[.,;:!?…]+$/) || [''])[0];   // garde la ponctuation pour l'intonation
      words.push({ w, a: spoken.length, b: spoken.length + sp.length });
      spoken += sp;
    });
  });
  return { spoken, words };
}

// --- appel à l'API -------------------------------------------------------------------
const key = process.env.ELEVENLABS_API_KEY;

const settings = { model, voice, voice_settings: cfg.voice_settings, language_code: cfg.language_code, audio: audioIn && hashFile(audioIn) };
const stamp = crypto.createHash('sha1').update(JSON.stringify({ spoken, settings })).digest('hex').slice(0, 12);
if (!force && fs.existsSync(out.js) && fs.readFileSync(out.js, 'utf8').startsWith(`// voix ${stamp}`)
    && (audioIn || fs.existsSync(out.mp3))) {
  console.log(`assets/${nom}_words.js est à jour (texte et réglages inchangés), rien à refaire. --force pour régénérer.`);
  process.exit(0);
}

let chars;                                           // [{ c, t0, t1 }] dans l'ordre du texte envoyé
if (audioIn) {
  if (!fs.existsSync(audioIn)) die(`audio introuvable : ${audioIn}`);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(audioIn)]), path.basename(audioIn));
  form.append('text', spoken);
  const r = await call('/v1/forced-alignment', { method: 'POST', body: form });
  chars = r.characters.map(c => ({ c: c.text, t0: c.start, t1: c.end }));
  console.log(`alignement de ${path.relative(ROOT, path.resolve(audioIn))} (perte moyenne ${r.loss?.toFixed?.(3) ?? '?'})`);
} else {
  if (!voice) die('aucune voix : renseignez voice_id dans voix.config.json, ELEVENLABS_VOICE_ID ou --voice <id>.');
  const body = { text: spoken, model_id: model };
  if (cfg.language_code) body.language_code = cfg.language_code;
  if (cfg.voice_settings) body.voice_settings = cfg.voice_settings;
  const q = `output_format=${cfg.output_format || 'mp3_44100_128'}`;
  const r = await call(`/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  fs.writeFileSync(out.mp3, Buffer.from(r.audio_base64, 'base64'));
  const al = r.alignment;
  chars = al.characters.map((c, i) => ({ c, t0: al.character_start_times_seconds[i], t1: al.character_end_times_seconds[i] }));
  console.log(`voix écrite : assets/voix_${nom}.mp3`);
}

// --- caractères → mots affichés ------------------------------------------------------
const times = mapChars(spoken, chars);
const r3 = x => Math.round(x * 1000) / 1000;
const WORDS = [];
let last = 0;
for (const { w, a, b } of words) {
  const ts = times.slice(a, b).filter((t, i) => t && /\S/.test(spoken[a + i]));
  let t0 = ts.length ? Math.min(...ts.map(t => t.t0)) : last;
  let t1 = ts.length ? Math.max(...ts.map(t => t.t1)) : last;
  t0 = Math.max(t0, last); t1 = Math.max(t1, t0);    // toujours croissant, même si l'alignement hésite
  WORDS.push({ w, t0: r3(t0), t1: r3(t1) });
  last = t0;
}
const missing = words.filter((_, i) => times.slice(words[i].a, words[i].b).every(t => !t)).length;
if (missing) console.warn(`attention : ${missing} mot(s) sans horodatage, recalés sur le mot précédent.`);

fs.writeFileSync(out.json, JSON.stringify(WORDS, null, 1) + '\n');
fs.writeFileSync(out.js, `// voix ${stamp} — généré par tools/voix.mjs depuis scripts/${nom}.txt, ne pas modifier à la main\n`
  + `window.WORDS = ${JSON.stringify(WORDS)};\n`);
console.log(`${WORDS.length} mots, ${WORDS.at(-1).t1.toFixed(2)} s → assets/${nom}_words.js`);

// Fait correspondre chaque caractère du texte envoyé à un caractère horodaté renvoyé.
// En général les deux textes sont identiques ; sinon on avance en cherchant le prochain caractère égal.
function mapChars(text, chars) {
  const got = chars.map(c => c.c).join('');
  if (got === text && chars.every(c => c.c.length === 1)) return chars;
  const flat = chars.flatMap(c => [...c.c].map(ch => ({ c: ch, t0: c.t0, t1: c.t1 })));
  const low = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const res = new Array(text.length).fill(null);
  let j = 0;
  for (let i = 0; i < text.length && j < flat.length; i++) {
    if (!/\S/.test(text[i])) continue;
    for (let k = j; k < Math.min(flat.length, j + 40); k++)
      if (low(flat[k].c) === low(text[i])) { res[i] = flat[k]; j = k + 1; break; }
  }
  return res;
}

async function call(route, init) {
  const res = await fetch(API + route, { ...init, headers: key ? { ...init.headers, 'xi-api-key': key } : init.headers });
  if (res.status === 401 && !key) die('ELEVENLABS_API_KEY absente : exportez votre clé ElevenLabs dans cette variable.');
  if (!res.ok) die(`ElevenLabs ${res.status} sur ${route} : ${(await res.text()).slice(0, 400)}`);
  return res.json();
}
function hashFile(f) { return fs.existsSync(f) ? crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex') : f; }
function die(msg) { console.error(msg); process.exit(1); }
