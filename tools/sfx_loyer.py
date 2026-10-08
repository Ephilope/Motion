"""Bruitages discrets pour loyer.html, calés sur les mots de la voix-off (assets/loyer_words.json)."""
import json, sys, wave, unicodedata, re
import numpy as np

SR, DUR = 44100, 66.5
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(11)
WORDS = json.load(open('assets/loyer_words.json'))

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

# transitions entre scènes (mêmes instants que loyer.html)
for b in (Wt('En') - .25, Wt('Camp') - .25, Wt('Un', 1, 15) - .25, Wt('Deux') - .25, Wt('Trois') - .25, Wt('Camp', 2) - .25,
          Wt('Un', 1, 37) - .25, Wt('Deux', 1, 45) - .25, Wt('Trois', 2) - .25, Wt('Et', 1, 59) - .25):
    whoosh(b, .34, .4)
# 1. accroche
pop(.05, 600, .3); pop(Wt('Il') - .1, 700, .3); pop(Wt('loyer') - .25, 500, .3)
whoosh(Wt('moitié-moitié.'), .3, .3); thud(Wt('moitié-moitié.') + .45, .8)
# 2. le chiffre
pop(Wt('femmes') - .3, 500, .25)
t0, t1 = Wt('22 %') - .2, Wt('22 %') + .5
for k in range(int((t1 - t0) / .05)): tick(t0 + k * .05, .1)
thud(Wt('22 %') + .4, .7); thud(Wt('Alors') + .3, .5); buzz(Wt('Alors') + .3, .25, 110, .12)
# camp 1
thud(Wt('moitié-moitié.', 2) + .1, .5); clink(Wt('moitié-moitié.', 2) + .1, .3)
ding(Wt('simple.'), 1568, .22); pop(Wt('calculs,') - .25, 500, .3); pop(Wt('disputes.') - .25, 600, .3)
whoosh(Wt('indépendant.') - .1, .3, .25); clink(Wt('indépendant.') + .2, .25); pop(Wt('problème.') - .3, 600, .3)
pop(Wt('égal,') - .2, 500, .3); slide(Wt('4 %.') - .6, 700, 250, .7, .12); thud(Wt('4 %.'), .6)
pop(Wt('métiers') - .2, 500, .3); pop(Wt('partiel.') - .3, 600, .3)
# camp 2
pop(Wt('Camp', 2) + .3, 500, .3); whoosh(Wt('salaire.', 1, 34) - .1, .3, .25); clink(Wt('salaire.', 1, 34) + .1, .3)
slide(Wt('40 %') - .3, 300, 800, .6, .12); thud(Wt('40 %') + .2, .4); slide(Wt('15 %.') - .3, 300, 500, .6, .1)
slide(Wt('22 %', 2) - .3, 300, 650, .6, .12); ding(Wt('effort'), 1320, .2)
pop(Wt('enfants') - .1, 700, .3); pop(Wt('partiel.', 2) - .2, 500, .3); thud(Wt('équipe.'), .4); ding(Wt('équipe.') + .05, 1568, .2)
# débat
pop(Wt('toi ?') - .2, 600, .3); pop(Wt('moitié-moitié,') - .15, 500, .3); pop(Wt('ou', 1, 62) - .05, 450, .25); pop(Wt('prorata ?') - .15, 700, .3)
tDis = Wt('Dis-le'); pop(tDis - .1, 700, .35); ding(Wt('commentaire.') + .3, 1046, .2)

peak = np.abs(out).max(); out = out / peak * .7
data = (np.stack([out, out], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok')
