"""Bruitages discrets pour electrique.html, calés sur les mots de la voix-off (assets/electrique_words.json)."""
import json, sys, wave, unicodedata, re
import numpy as np

SR, DUR = 44100, 60.5
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(11)
WORDS = json.load(open('assets/electrique_words.json'))

def key(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9%$]', '', s)
def Wt(word, n=1, frm=0):
    k = key(word); c = 0
    for w in WORDS:
        if w['t0'] >= frm and key(w['w']) == k:
            c += 1
            if c == n: return w['t0']
    raise KeyError(word)

def add(sig, t, g=1.0):
    i = int(t * SR); n = min(len(sig), N - i)
    if n > 0 and i >= 0: out[i:i + n] += sig[:n] * g
def tt(d): return np.arange(int(d * SR)) / SR
def smooth(x, k): return np.convolve(x, np.ones(k) / k, 'same')
def whoosh(t, d=.32, g=.35):
    x = tt(d); env = np.sin(np.pi * x / d) ** 2
    add(smooth(rng.standard_normal(len(x)), 6) * env, t - d / 2, g)
def thud(t, g=.9):
    x = tt(.45); ph = 2 * np.pi * np.cumsum(45 + 110 * np.exp(-x * 30)) / SR
    add(np.sin(ph) * np.exp(-x * 9) + smooth(rng.standard_normal(len(x)), 3) * np.exp(-x * 60) * .6, t, g)
def pop(t, f=600, g=.35):
    x = tt(.11); ph = 2 * np.pi * np.cumsum(f * (1 + 1.4 * (1 - np.exp(-x * 45)))) / SR
    add(np.sin(ph) * np.exp(-x * 40), t, g)
def ding(t, f=1320, g=.25, d=.9):
    x = tt(d); add(sum(a * np.sin(2 * np.pi * f * m * x) for m, a in ((1, 1), (2.01, .4), (3.03, .2))) * np.exp(-x * 5), t, g)
def clink(t, g=.3):
    x = tt(.25); add(sum(np.sin(2 * np.pi * f * x) for f in (2100, 3170, 4420)) / 3 * np.exp(-x * 28), t, g)
def beep(t, f, g=.22, d=.12):
    x = tt(d); add(np.sign(np.sin(2 * np.pi * f * x)) * .4 * np.minimum(1, (d - x) * 60) * np.minimum(1, x * 400), t, g)
def tick(t, g=.12):
    x = tt(.02); add(rng.standard_normal(len(x)) * np.exp(-x * 300), t, g)
def buzz(t, d=.3, f=140, g=.18):
    x = tt(d); add(np.sign(np.sin(2 * np.pi * f * x)) * np.minimum(1, (d - x) * 30), t, g)
def slide(t, f0, f1, d, g=.2, vib=0):
    x = tt(d); f = f0 + (f1 - f0) * (x / d) + vib * np.sin(2 * np.pi * 7 * x)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / d) ** .5, t, g)

# transitions entre scènes (mêmes instants que electrique.html)
T = [Wt("D'abord,") - .25, Wt('Ensuite,') - .25, Wt('Plus', 1, 18) - .25, Wt('Résultat') - .25, Wt('Et', 1, 30) - .2,
     Wt('Et', 1, 38) - .2, Wt('Mais') - .2, Wt('Rechargée') - .25, Wt('Et', 1, 48) - .2, Wt('Alors') - .25]
for b in T: whoosh(b, .34, .4)
# 1. accroche
whoosh(.15, .45, .3); pop(Wt('électrique') - .2, 500, .3)
ding(Wt('propre.'), 1568, .25); thud(Wt('arnaque') - .05, 1.0); buzz(Wt('arnaque'), .3, 110, .15)
# 2. prix
pop(Wt("l'achat,"), 500, .3); slide(Wt('cher') - .25, 300, 900, .45, .14); thud(Wt('cher'), .5)
for i in range(3): clink(Wt('cher') + .05 + i * .12, .3)
# 3. batterie
thud(Wt('batterie.') + .15, 1.0)
t0, t1 = Wt('batterie.') + .2, Wt('400 kilos,') + .3
for k in range(int((t1 - t0) / .05)): tick(t0 + k * .05, .08)
pop(Wt('400 kilos,') + .2, 400, .35)
for i, w in enumerate(['lithium,', 'nickel', 'cobalt.']): pop(Wt(w) - .05, 500 + 150 * i, .3)
# 4. cobalt
slide(Wt('70 %') - .1, 300, 800, .7, .12); pop(Wt('Congo,'), 450, .3)
for k in range(4): clink(Wt('main,') + k * .18, .25)
thud(Wt('enfants.'), .6)
# 5. usine
whoosh(Wt('sort'), .4, .3); pop(Wt('dette') - .1, 250, .4); thud(Wt('thermique.') - .1, .7)
# 6. autoroute
pop(Wt('plein,') - .2, 500, .3); ding(Wt('5 minutes.') + .2, 1320, .2)
pop(Wt('recharge') - .2, 400, .3)
t0, t1 = Wt('recharge'), Wt('30 minutes,') + .3
for k in range(int((t1 - t0) / .06)): tick(t0 + k * .06, .1)
buzz(Wt('marche.') - .1, .4, 100, .22); thud(Wt('marche.') - .1, .6)
# 7. revente
pop(Wt('revente,') - .25, 500, .3); slide(Wt('perd') - .1, 700, 150, 1.1, .14); thud(Wt('vite.') + .1, .4)
# 8-10. l'autre camp
pop(Wt('Mais') + .1, 700, .3)
for i in range(4): ding(Wt('fans,') + i * .09, 880 * 2 ** (i * 4 / 12), .12, .5)
pop(Wt("l'inverse."), 600, .3)
whoosh(Wt('Rechargée'), .4, .25); pop(Wt('maison,'), 500, .3); thud(Wt('trois'), .5); ding(Wt('trois') + .05, 1568, .2)
pop(Wt('France,') - .1, 500, .3); slide(Wt('vie,'), 200, 500, .5, .1); slide(Wt('deux'), 600, 250, .8, .1); ding(Wt('thermique.', 2) - .2, 1320, .2)
# 11. call to action
pop(Wt('Progrès') - .1, 700, .3); pop(Wt('ou', 1, 55), 500, .25); thud(Wt('arnaque', 2), .5)
tDis = Wt('Dis-le'); pop(tDis - .1, 700, .35); ding(Wt('commentaire.') + .3, 1046, .2)

peak = np.abs(out).max(); out = out / peak * .7
data = (np.stack([out, out], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok')
