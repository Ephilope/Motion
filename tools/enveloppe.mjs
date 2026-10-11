// Enveloppe de volume de la voix-off, pour animer la bouche du personnage (lib/sarah.js).
//
//   node tools/enveloppe.mjs <nom>    lit assets/voix_<nom>.mp3, écrit assets/<nom>_env.js (window.ENV)
//
// Volume RMS par tranche de 1/60 s, ramené entre 0 et 1 (1 = 95e centile de la parole). Il faut ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nom = process.argv[2];
if (!nom) { console.error('usage : node tools/enveloppe.mjs <nom>'); process.exit(1); }
const mp3 = path.join(ROOT, 'assets', `voix_${nom}.mp3`);
if (!fs.existsSync(mp3)) { console.error(`voix introuvable : assets/voix_${nom}.mp3`); process.exit(1); }

const RATE = 12000, FPS = 60, N = RATE / FPS;   // 200 échantillons par tranche
const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
if (r.status !== 0) { console.error(r.stderr.toString()); process.exit(1); }
const s = new Float32Array(Uint8Array.from(r.stdout).buffer);
const rms = [];
for (let i = 0; i + N <= s.length; i += N) { let a = 0; for (let j = i; j < i + N; j++) a += s[j] * s[j]; rms.push(Math.sqrt(a / N)); }
const loud = rms.filter(v => v > 0.01).sort((a, b) => a - b);
const ref = loud[Math.floor(loud.length * .95)] || 1;
const v = rms.map(x => Math.round(Math.min(1, x / ref) * 100) / 100);
const out = path.join(ROOT, 'assets', `${nom}_env.js`);
fs.writeFileSync(out, `// généré par tools/enveloppe.mjs depuis assets/voix_${nom}.mp3, ne pas modifier à la main\nwindow.ENV = { fps: ${FPS}, v: [${v.join(',')}] };\n`);
console.log(`${path.relative(ROOT, out)} : ${v.length} valeurs (${(v.length / FPS).toFixed(1)} s)`);
