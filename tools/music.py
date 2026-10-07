"""Bande-son synthétisée (pad + arpèges + basse + whooshs + pops) calée sur l'animation."""
import sys, wave
import numpy as np

SR, DUR = 44100, 61.0
N = int(SR * DUR)
t_all = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

NOTES = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def chord(name):
    root, q = name.split(':')
    r = 48 + NOTES[root]
    iv = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'min7': [0, 3, 7, 10], 'sus': [0, 5, 7]}[q]
    return r, [r + i for i in iv]

# (début, fin, accord, énergie)
PROG = [
    (0, 3.5, 'C:maj7', 0), (3.5, 7, 'F:maj7', 0),
    (7, 9, 'A:min7', 1), (9, 11, 'F:maj7', 1), (11, 13, 'C:maj', 1), (13, 15, 'G:sus', 1),
    (15, 17.5, 'A:min', 2), (17.5, 20, 'F:maj', 2), (20, 22.5, 'C:maj', 2), (22.5, 26, 'G:maj', 2),
    (26, 28.5, 'D:min', 2), (28.5, 31, 'Bb:maj', 2), (31, 33, 'F:maj', 2), (33, 35, 'A:maj', 2),
    (35, 37.5, 'A:min', 1), (37.5, 40, 'F:min', 1), (40, 43, 'D:min', 1), (43, 46, 'E:maj', 1),
    (46, 48.5, 'C:maj', 3), (48.5, 51, 'G:maj', 3), (51, 53.5, 'A:min', 3), (53.5, 56, 'F:maj', 3),
    (56, 58, 'F:maj7', 3), (58, 61, 'C:maj', 0),
]
BEAT = 60 / 96

def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

for (t0, t1, name, energy) in PROG:
    root, notes = chord(name)
    i0, i1 = int(t0 * SR), min(N, int((t1 + .6) * SR))
    tt = t_all[i0:i1] - t0
    e = env(i1 - i0, .35, .6)
    # pad chaud (harmoniques douces + léger désaccord stéréo)
    for m in notes + [notes[0] + 12]:
        f = hz(m)
        for det, ch in ((1.0, L), (1.004, R)):
            sig = sum(a * np.sin(2 * np.pi * f * det * h * tt + h) for h, a in ((1, 1), (2, .35), (3, .12)))
            ch[i0:i1] += .045 * sig * e * (1 + .15 * np.sin(2 * np.pi * .3 * tt))
    # basse
    if energy >= 1:
        f = hz(root - 12)
        for k in range(int((t1 - t0) / BEAT)):
            s0 = i0 + int(k * BEAT * SR); n = int(BEAT * SR * .9)
            if s0 + n > N: break
            tb = np.arange(n) / SR
            b = np.sin(2 * np.pi * f * tb) * np.exp(-tb * 3.5) * .16
            L[s0:s0 + n] += b; R[s0:s0 + n] += b
    # arpèges (croches)
    if energy >= 1:
        arp = [m + 24 for m in notes] + [notes[1] + 36]
        step = BEAT / 2
        for k in range(int((t1 - t0) / step)):
            s0 = i0 + int(k * step * SR); n = int(.5 * SR)
            if s0 + n > N: break
            tb = np.arange(n) / SR
            f = hz(arp[k % len(arp)] if energy != 1 or k % 2 == 0 else arp[(k * 3) % len(arp)])
            tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * tb))
            pl = tri * np.exp(-tb * 9) * (.07 if energy == 3 else .05)
            pan = .5 + .35 * np.sin(k * 1.3)
            L[s0:s0 + n] += pl * (1 - pan) * 1.4; R[s0:s0 + n] += pl * pan * 1.4
    # kick + clap (sections dynamiques)
    if energy >= 2:
        for k in range(int((t1 - t0) / BEAT)):
            s0 = i0 + int(k * BEAT * SR); n = int(.3 * SR)
            if s0 + n > N: break
            tb = np.arange(n) / SR
            ph = 2 * np.pi * np.cumsum(45 + 90 * np.exp(-tb * 30)) / SR
            kick = np.sin(ph) * np.exp(-tb * 12) * (.32 if energy == 3 else .22)
            L[s0:s0 + n] += kick; R[s0:s0 + n] += kick
            if energy == 3 and k % 2 == 1:
                nz = rng.standard_normal(n) * np.exp(-tb * 28) * .035
                nz = np.diff(nz, prepend=0)
                L[s0:s0 + n] += nz; R[s0:s0 + n] += nz

def lowpass(x, cut):
    y = np.zeros_like(x); acc = 0.0
    a = 1 - np.exp(-2 * np.pi * cut / SR)
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y

# whooshs aux transitions
for b in [7, 15, 26, 35, 46, 56]:
    s0 = int((b - .6) * SR); n = int(1.2 * SR)
    tb = np.arange(n) / SR
    shape = np.exp(-((tb - .6) / .22) ** 2)
    cut = 300 + 5000 * shape
    nz = lowpass(rng.standard_normal(n), cut) * shape * .12
    L[s0:s0 + n] += nz * (.6 + .4 * np.sin(tb * 4)); R[s0:s0 + n] += nz * (.6 - .4 * np.sin(tb * 4))

# petits "pops" quand les éléments apparaissent
POPS = [0.4, 1.0, 1.8, 8.2, 8.5, 8.8, 9.0, 9.9, 12.4, 22.3, 27.7, 30.5, 36.3, 37.7, 39.1, 40.3, 41.7, 42.0, 42.4,
        48.3, 48.8, 49.4, 49.8, 50.3, 50.7, 51.3, 56.2, 57.3]
POPS += [17 + i * .3 for i in range(26)]
for i, pt in enumerate(POPS):
    s0 = int(pt * SR); n = int(.12 * SR)
    tb = np.arange(n) / SR
    f0 = 500 + (i * 137) % 500
    ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.2 * (1 - np.exp(-tb * 40)))) / SR
    pop = np.sin(ph) * np.exp(-tb * 45) * (.05 if 17 <= pt < 25 else .1)
    pan = .5 + .3 * np.sin(i)
    L[s0:s0 + n] += pop * (1 - pan) * 2; R[s0:s0 + n] += pop * pan * 2

# fondu final + normalisation
fade = np.clip((DUR - t_all) / 1.2, 0, 1); fadein = np.clip(t_all / .3, 0, 1)
L *= fade * fadein; R *= fade * fadein
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * .89, R / peak * .89
data = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
