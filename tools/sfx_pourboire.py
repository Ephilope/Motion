"""Bruitages discrets pour pourboire.html, calés sur les mots de la voix-off (assets/pourboire_words.json)."""
import json, sys, wave, unicodedata, re
import numpy as np

SR, DUR = 44100, 54.0
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(11)
WORDS = json.load(open('assets/pourboire_words.json'))

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

# transitions entre scènes + swipes internes
for b in [9.62, 16.36, 22.75, 34.3, 40.03, 46.42]: whoosh(b, .34, .4)
tJap = Wt('Au') - .12; whoosh(tJap + .1, .3, .3)
# 1. accroche
pop(.1, 400, .25); thud(Wt('20 %'), 1.0); thud(Wt('insulte.'), .5)
tc = Wt('un', 1, tJap) - .25
for k in range(6): clink(tc + .35 + .32 * k, .35 * np.exp(-k * .7))
pop(Wt('vexer.'), 300, .4); pop(Wt('Alors ?') + .1, 700, .25); whoosh(Wt('Qui') + .1, .5, .3); thud(Wt('Qui') + .25, .4)
# 2. France
for k in range(int((Wt('1987,') + .25 - Wt('France,') + .2) / .045)): tick(Wt('France,') - .2 + k * .045, .06)
pop(Wt('1987,'), 500, .35); whoosh(Wt('service') + .1, .3, .2); ding(Wt('bonus.'), 1568, .3)
# 3. États-Unis
whoosh(16.5, .4, .25); thud(16.85, .35)
t0, t1 = Wt('Certains') - .1, Wt('2 $') + .05
for k in range(int((t1 - t0) / .07)): tick(t0 + k * .07, .1)
buzz(t1, .35, 120, .2); pop(Wt('Sans') + .1, 450, .3)
# 4. dérive
slide(22.9, 200, 700, 1.0, .08)
tD = Wt('ça', 1, 23)
for k in range(8): add(rng.standard_normal(int(.04 * SR)) * .5, tD + k * .055 + rng.random() * .02, .25)
pop(Wt('Un', 1, 24.5), 500, .3); pop(Wt('Pourboire', 1, 25), 800, .3)
whoosh(Wt('Une', 1, 27) - .05, .3, .3); pop(Wt('Pourboire', 1, 28), 800, .3)
whoosh(Wt('15,') - .25, .3, .3)
for i, w in enumerate(['15,', '20,', '25 %.']): beep(Wt(w), 880 * 1.26 ** i, .18 + .06 * i)
slide(Wt('On', 1, 31), 180, 520, Wt('tipflation.') + .7 - Wt('On', 1, 31), .12, vib=25)
# 5 & 6. les deux camps
pop(34.45, 300, .3); whoosh(Wt("C'est", 1, 36) - .45, .35, .3); slide(Wt('payer') - .1, 400, 900, .5, .12); pop(Wt('culpabiliser.'), 350, .3)
pop(40.2, 700, .3); whoosh(Wt('le', 1, 40.5) - .15, .35, .3)
tR = Wt('récompense')
for i, w in enumerate(['récompense', 'un', 'vrai', 'bon', 'service.']): ding(Wt(w, 1, tR) if i else tR, 880 * 2 ** (i * 2 / 12 * 1.5), .16, .5)
pop(Wt('supprimer'), 500, .25); slide(Wt('serveurs', 1, 44), 700, 160, .9, .14)
# 7. call to action
pop(Wt('laisses'), 500, .25); pop(Wt('pourboire', 1, 47.5), 650, .3); pop(Wt('pas ?'), 400, .3)
tDis = Wt('Dis-le'); pop(tDis - .1, 700, .35); ding(Wt('commentaire.') + .3, 1046, .2)

peak = np.abs(out).max(); out = out / peak * .7
data = (np.stack([out, out], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok')
