"""Horodatage mot à mot de la voix-off : aligne le texte de référence sur la sortie d'un modèle ASR
(sherpa-onnx zipformer FR) puis compense la latence du modèle segment par segment (segments = silences)."""
import json, sys, re, unicodedata
from difflib import SequenceMatcher

SCRIPT = """Aux États-Unis, ne pas laisser 20_%[vingt pourcent] de pourboire, c'est presque une insulte.
Au Japon, en laisser un peut vexer.
Alors_? Qui a raison_?
En France, depuis 1987,[mille neuf cent quatre vingt sept] le service est déjà inclus dans le prix.
Le pourboire, c'est un bonus.
Aux États-Unis, c'est l'inverse.
Certains serveurs touchent à peine 2_$[deux dollars] de l'heure.
Sans pourboire, ils ne vivent pas.
Et depuis quelques années, ça dérape.
Un café à emporter_? Pourboire suggéré.
Une caisse automatique_? Pourboire suggéré.
15,[quinze] 20,[vingt] 25_%.[vingt cinq pourcent]
On appelle ça la tipflation.
Pour certains, il faut tout arrêter.
C'est au patron de bien payer ses employés, pas aux clients de culpabiliser.
Pour d'autres, le pourboire récompense un vrai bon service.
Et le supprimer du jour au lendemain, ce sont les serveurs qui trinqueraient.
Alors toi, tu laisses un pourboire ou pas_?
Dis-le en commentaire."""

def norm(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r"[^a-z0-9]", '', s)

res = json.load(open(sys.argv[1]))
z = res['zip']; zw = []
new = True
for tok, t in zip(z['tokens'], z['ts']):
    if tok.startswith(' '): new = True
    if not tok.strip(): continue
    if new or not zw: zw.append([tok.strip(), t]); new = False
    else: zw[-1][0] += tok
segs = [(s['start'] + .06, s['end'] - .06) for s in res['segments']]

# mots affichés + forme parlée
disp, spoken = [], []   # spoken: (token normalisé, index du mot affiché)
for m in re.finditer(r"(\S+?)\[([^\]]+)\]|(\S+)", SCRIPT):
    d = (m.group(1) or m.group(3)).replace('_', ' ')
    sp = m.group(2) or d
    disp.append(d)
    for piece in re.split(r"[-'’ ]", sp):
        if norm(piece): spoken.append((norm(piece), len(disp) - 1))

# alignement (programmation dynamique, coût = dissimilarité des mots)
zn = [norm(w) for w, _ in zw]
A, B = len(spoken), len(zn)
INF = 1e9; cost = [[INF] * (B + 1) for _ in range(A + 1)]; back = [[None] * (B + 1) for _ in range(A + 1)]
cost[0][0] = 0
for i in range(A + 1):
    for j in range(B + 1):
        c = cost[i][j]
        if c >= INF: continue
        if i < A and j < B:
            r = SequenceMatcher(None, spoken[i][0], zn[j]).ratio()
            nc = c + (1 - r) * 2
            if nc < cost[i + 1][j + 1]: cost[i + 1][j + 1] = nc; back[i + 1][j + 1] = (i, j, 'm', r)
        if i < A and c + 1 < cost[i + 1][j]: cost[i + 1][j] = c + 1; back[i + 1][j] = (i, j, 'd', 0)
        if j < B and c + 1 < cost[i][j + 1]: cost[i][j + 1] = c + 1; back[i][j + 1] = (i, j, 'i', 0)
i, j = A, B; match = {}
while (i, j) != (0, 0):
    pi, pj, op, r = back[i][j]
    if op == 'm' and r >= .5: match[pi] = pj
    i, j = pi, pj

# latence du modèle : par segment, écart entre le 1er mot reconnu et le début de la parole
def seg_of(t):
    best = min(range(len(segs)), key=lambda k: 0 if segs[k][0] <= t <= segs[k][1] else min(abs(t - segs[k][0]), abs(t - segs[k][1])))
    return best
lat = .3
zt = []
for k, (w, t) in enumerate(zw): zt.append(t - lat)
first_in_seg = {}
for k, t in enumerate(zt):
    s = seg_of(t)
    first_in_seg.setdefault(s, k)
offs = {s: zt[k] - segs[s][0] for s, k in first_in_seg.items()}

start = [None] * len(disp)
for si, (nw, di) in enumerate(spoken):
    if si in match and start[di] is None:
        k = match[si]; t = zt[k]; s = seg_of(t)
        t = t - offs.get(s, 0)
        start[di] = max(segs[s][0], min(t, segs[s][1] - .12))
# interpolation des mots non retrouvés
n = len(disp)
for d in range(n):
    if start[d] is None:
        a = d - 1
        while a >= 0 and start[a] is None: a -= 1
        b = d + 1
        while b < n and start[b] is None: b += 1
        ta = start[a] if a >= 0 else 0; tb = start[b] if b < n else segs[-1][1]
        span = (b - a) if a >= 0 else b + 1
        start[d] = ta + (tb - ta) * (d - a) / span
# un mot interpolé ne doit pas tomber dans un silence : on le recale au début du segment suivant
for d in range(n):
    t = start[d]
    if not any(a0 - .02 <= t <= a1 for a0, a1 in segs):
        nxt = [a0 for a0, a1 in segs if a0 > t]
        if nxt and (d + 1 >= n or start[d + 1] >= nxt[0]): start[d] = nxt[0]
# fin = début du mot suivant, coupé aux silences
out = []
for d in range(n):
    t0 = start[d]; t1 = start[d + 1] if d + 1 < n else segs[-1][1]
    s = seg_of(t0)
    t1 = min(t1, segs[s][1]) if t1 > segs[s][1] + .05 else t1
    out.append({'w': disp[d], 't0': round(t0, 3), 't1': round(max(t1, t0 + .12), 3)})
for k in range(1, n):
    out[k]['t0'] = max(out[k]['t0'], out[k - 1]['t0'] + .05)
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
if len(sys.argv) > 3: open(sys.argv[3], 'w').write('window.WORDS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(' '.join(f"{o['w']}@{o['t0']:.2f}" for o in out))
print(len(out), 'mots,', len(match), 'tokens appariés sur', len(spoken))
