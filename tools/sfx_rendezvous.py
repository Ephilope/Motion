"""Bruitages discrets pour rendezvous.html, calés sur les mots de la voix-off (assets/rendezvous_words.json)."""
import json, sys, wave, unicodedata, re
import numpy as np

SR, DUR = 44100, 27
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(11)
WORDS = json.load(open('assets/rendezvous_words.json'))

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

# transitions entre scènes (mêmes instants que rendezvous.html)
for b in (Wt('Camp') - .25, Wt('Camp', 2) - .25, Wt('Alors') - .25, Wt('Prochain') - .25): whoosh(b, .34, .4)
# 1. accroche : le ticket coupé en deux, puis le red flag
pop(.05, 600, .3)
t0, t1 = Wt('partager') - .15, Wt("l'addition,")
for k in range(int((t1 - t0) / .07)): tick(t0 + k * .07, .12)
whoosh(Wt("l'addition,"), .3, .3); clink(Wt("l'addition,") + .2, .3); clink(Wt("l'addition,") + .3, .3)
thud(Wt('red') - .05, 1.0); buzz(Wt('red'), .3, 110, .15)
# 2. camp 1
pop(Wt('invite') - .3, 500, .3); slide(Wt('paie.') - .3, 900, 300, .35, .12); ding(Wt('paie.') + .05, 1568, .22)
pop(Wt('élégant,') - .1, 600, .3); pop(Wt('effort.') - .2, 700, .3)
# 3. camp 2
pop(Wt('chacun') - .3, 500, .3); whoosh(Wt('part.') - .1, .3, .3); thud(Wt('part.'), .4)
pop(Wt("l'égalité,") - .1, 600, .3); pop(Wt('redevable.') - .5, 700, .3)
# 4. débat
pop(Wt('toi ?') - .25, 600, .3); pop(Wt('paies,') - .15, 500, .3); pop(Wt('ou', 1, 17) - .05, 450, .25)
pop(Wt('partages ?') - .15, 700, .3)
tDis = Wt('Dis-le'); pop(tDis - .1, 700, .35); ding(Wt('commentaire.') + .3, 1046, .2)
# 5. la suite
pop(Wt("l'addition", 1, 21) - .25, 500, .3); pop(Wt('potes.') - .1, 600, .25); pop(Wt('potes.'), 750, .25)
thud(Wt('Abonne-toi'), .4); ding(Wt('Abonne-toi') + .05, 1320, .22)
for i in range(3): tick(Wt('Abonne-toi') + .5 + i * .785, .2)

peak = np.abs(out).max(); out = out / peak * .7
data = (np.stack([out, out], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok')
