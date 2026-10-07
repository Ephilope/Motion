"""Bande-son épique « film de super-héros » pour depression.html (synthèse additive, numpy seul)."""
import sys, wave
import numpy as np

SR, DUR = 44100, 88.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, t0, gain=1.0, pan=.5):
    i0 = int(t0 * SR); n = min(len(sig), N - i0)
    if n <= 0: return
    L[i0:i0 + n] += sig[:n] * gain * (1 - pan) * 2 ** .5
    R[i0:i0 + n] += sig[:n] * gain * pan * 2 ** .5
def smooth(x, k):
    k = max(1, int(k)); return np.convolve(x, np.ones(k) / k, 'same')
def saw(f, n, bright=8, nh=14, det=0.0):
    tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * (1 + det) * k * tt + k) / k * np.exp(-k / bright) for k in range(1, nh + 1))
def adsr(n, a, r, s=1.0):
    e = np.full(n, s); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, s, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

CH = {'Dm': [50, 53, 57], 'Bb': [46, 50, 53], 'F': [53, 57, 60], 'C': [48, 52, 55], 'Gm': [43, 50, 55, 58],
      'A': [45, 49, 52], 'D': [50, 54, 57], 'Am': [45, 48, 52]}

def strings(chord, t0, t1, gain=.05, att=.6):
    n = int((t1 - t0 + .8) * SR)
    for m in CH[chord] + [CH[chord][0] - 12]:
        for d, pan in ((-.003, .3), (.003, .7)):
            add(saw(hz(m), n, bright=3, nh=8, det=d) * adsr(n, att, .8), t0, gain, pan)
def brass(chord, t0, t1, gain=.06):
    n = int((t1 - t0 + .3) * SR); tt = np.arange(n) / SR
    for m in CH[chord] + [CH[chord][0] + 12]:
        sig = saw(hz(m), n, bright=2.5, nh=12) * .5 + saw(hz(m), n, bright=9, nh=12) * .5 * np.clip(tt / .4, 0, 1)
        add(sig * adsr(n, .12, .3), t0, gain, .5)
def ostinato(root, t0, t1, step, gain=.05):
    k = 0; t = t0
    while t < t1 - .01:
        n = int(step * SR * .9); tt = np.arange(n) / SR
        m = root - 12 + (12 if k % 4 == 2 else 0)
        add(saw(hz(m), n, bright=4, nh=10) * np.exp(-tt * 14), t, gain, .5 + .15 * np.sin(k))
        t += step; k += 1
def taiko(t0, gain=.5):
    n = int(.7 * SR); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(48 + 70 * np.exp(-tt * 25)) / SR
    body = np.sin(ph) * np.exp(-tt * 7)
    skin = smooth(rng.standard_normal(n), 12) * np.exp(-tt * 30) * .6
    add((body + skin), t0, gain)
def boom(t0, gain=.9):
    n = int(3.2 * SR); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(30 + 60 * np.exp(-tt * 6)) / SR
    sub = np.sin(ph) * np.exp(-tt * 1.5)
    nz = smooth(rng.standard_normal(n), 30) * np.exp(-tt * 4) * 1.2
    add(sub + nz, t0, gain * .5)
def crash(t0, gain=.12):
    n = int(3 * SR); tt = np.arange(n) / SR
    nz = np.diff(rng.standard_normal(n + 1)) * np.exp(-tt * 1.6)
    add(nz, t0, gain, .4); add(np.roll(nz, 300), t0, gain, .6)
def piano(m, t0, gain=.12):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    f = hz(m); sig = np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt) + .1 * np.sin(6 * np.pi * f * tt)
    add(sig * np.exp(-tt * 2.2) * np.clip(tt / .005, 0, 1), t0, gain, .5 + .2 * np.sin(m))
def riser(t0, t1, gain=.25):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR; u = tt / (t1 - t0)
    nz = smooth(rng.standard_normal(n), 6) * u ** 2
    tone = np.sin(2 * np.pi * np.cumsum(150 + 900 * u ** 2) / SR) * u ** 2 * .3
    add(nz + tone, t0, gain)
def click(t0, gain=.08):
    n = int(.03 * SR); add(np.diff(rng.standard_normal(n + 1)) * np.exp(-np.arange(n) / SR * 150), t0, gain, .5)

BEAT = .6
# --- intro
riser(0, 2.6)
for k in range(13): click(k * .2, .06 + k * .005)
boom(2.58, 1.0); crash(2.58, .1)
brass('Dm', 2.6, 7, .05); strings('Dm', 2.6, 7, .04)
# --- Alex
for i, c in enumerate(['Dm', 'Bb', 'F', 'C']):
    strings(c, 7 + i * 1.5, 8.5 + i * 1.5, .04, .2)
ostinato(50, 7, 13, .15, .045)
boom(7.6, .9)
for k in range(10): taiko(7.6 + k * BEAT, .32 if k % 2 == 0 else .2)
brass('Dm', 9.6, 10.8, .05)
n = int(2.4 * SR); add(saw(hz(26), n, bright=2, nh=6) * adsr(n, 1.2, .3), 10.6, .25)
# --- 9 symptômes
PAIRS = [('Dm', 'Bb'), ('Gm', 'A'), ('Dm', 'F'), ('Bb', 'A'), ('Dm', 'Bb'), ('Gm', 'A'), ('Dm', 'C'), ('Bb', 'A')]
for i, (c1, c2) in enumerate(PAIRS):
    t0 = 13 + i * 6
    boom(t0, .35); taiko(t0, .4)
    strings(c1, t0, t0 + 3, .035, .3); strings(c2, t0 + 3, t0 + 6, .035, .3)
    ostinato(CH[c1][0] if CH[c1][0] > 45 else CH[c1][0] + 12, t0 + .3, t0 + 3, .3, .035)
    ostinato(CH[c2][0] if CH[c2][0] > 45 else CH[c2][0] + 12, t0 + 3, t0 + 6, .3, .035)
    for k in range(5): taiko(t0 + 1.2 + k * 1.2, .16)
# symptôme 9 : très doux
strings('Dm', 61, 67.5, .03, 1.2)
for k, m in enumerate([74, 69, 65, 69, 74, 72, 69, 62]): piano(m, 61.4 + k * .75, .09)
# --- diagnostic : ça remonte
for i, c in enumerate(['Bb', 'F', 'C', 'A']):
    strings(c, 67.5 + i * 1.62, 69.12 + i * 1.62, .04, .2)
ostinato(46, 67.5, 74, .15, .04)
for k in range(10): taiko(67.5 + k * .6, .15 + k * .02)
for k in range(8): taiko(72.8 + k * .15, .12 + k * .03)
# --- l'équipe : héroïque
boom(74, .7)
for i, c in enumerate(['Bb', 'F', 'C']):
    brass(c, 74 + i * 1.47, 75.47 + i * 1.47, .055); strings(c, 74 + i * 1.47, 75.47 + i * 1.47, .04, .15)
ostinato(46, 74, 78.4, .15, .045)
boom(78.4, 1.0); crash(78.4, .14)
brass('D', 78.4, 81, .065); strings('D', 78.4, 81.5, .05, .1)
for k in range(12): taiko(74 + k * BEAT, .3 if k % 2 == 0 else .18)
for k in range(4): taiko(78.4 + k * BEAT, .35)
# --- fin
strings('D', 81, 84.5, .035, .8); strings('Bb', 84.5, 88, .03, .8)
for k, m in enumerate([74, 78, 81, 78, 74, 70]): piano(m, 81.6 + k * .9, .08)

t = np.arange(N) / SR
fade = np.clip((DUR - t) / 1.6, 0, 1)
L *= fade; R *= fade
ref = np.percentile(np.abs(np.concatenate([L, R])), 99.7)
L, R = np.tanh(L / ref * .9), np.tanh(R / ref * .9)
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * .89, R / peak * .89
data = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'music_hero.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
