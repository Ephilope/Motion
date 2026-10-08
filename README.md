# Le réchauffement climatique — motion design

Une vidéo d'animation d'environ 1 minute (1920×1080, 30 i/s) qui explique le réchauffement climatique, avec des personnages : la Terre, le Soleil à lunettes, les molécules de CO₂, un ours polaire, des humains.

- **Vidéo finale :** `rechauffement_climatique.mp4`
- **Source de l'animation :** `animation.html` (SVG + JavaScript). Ouvrez le fichier dans un navigateur pour la regarder en direct, avec un bouton lecture/pause et une barre de défilement.

## Découpage

| Temps | Scène |
|-------|-------|
| 0–7 s | Intro : la Terre et la Lune, titre |
| 7–15 s | Le Soleil chauffe la Terre, une partie de la chaleur repart vers l'espace |
| 15–26 s | La ville : usines et voitures rejettent du CO₂ |
| 26–35 s | Effet de serre : la chaleur est piégée, la Terre a de la fièvre (+1,3 °C) |
| 35–46 s | Conséquences : la banquise fond, montée des eaux, canicules, tempêtes |
| 46–56 s | Solutions : solaire, éolien, vélo, arbres |
| 56–61 s | « Chaque geste compte ! » |

## Refaire le rendu

Il faut Node, Playwright (avec Chromium), Python 3 avec numpy, et ffmpeg.

```bash
node tools/render.mjs frames 30            # rend les 1830 images en JPEG
python3 tools/music.py music.wav           # génère la bande-son
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i music.wav \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -af loudnorm=I=-16:TP=-1.5 -shortest rechauffement_climatique.mp4
```

Toute l'animation est une fonction du temps (`renderAt(t)`), donc le rendu est déterministe. Pour changer un texte ou un timing, modifiez les sous-titres (`CAPS`) ou les scènes (`S(début, fin, …)`) dans `animation.html`.

---

# Les 9 signes du trouble dépressif caractérisé (format vertical)

Une vidéo verticale (1080×1920, 9:16, 88 s) dans un style « film de super-héros » : pages de BD, titres en métal, transitions en bandes obliques, musique épique. Le héros, Alex, vit les 9 symptômes du DSM‑5 l'un après l'autre. Le noyau lumineux sur sa poitrine faiblit à chaque symptôme.

- **Vidéo :** `les_9_signes_depression_vertical.mp4`
- **Source :** `depression.html` (à ouvrir dans un navigateur pour la regarder en direct)
- **Musique :** `tools/music_hero.py`

| Temps | Séquence |
|-------|----------|
| 0–7 s | Pages de BD, titre « Les 9 signes du trouble dépressif caractérisé » |
| 7–13 s | Alex atterrit, puis l'ombre de la dépression apparaît |
| 13–67 s | Les 9 symptômes : humeur dépressive, perte d'intérêt, appétit et poids, sommeil, agitation ou lenteur, fatigue, dévalorisation et culpabilité, concentration, idées noires |
| 67–74 s | Les critères du diagnostic (au moins 5 signes sur 9 pendant 2 semaines…) |
| 74–81 s | « Même les héros ont besoin d'aide » : l'équipe se rassemble |
| 81–88 s | Où trouver de l'aide : 3114, 15, 112 |

Rendu :

```bash
PAGE=depression.html node tools/render.mjs frames 30
python3 tools/music_hero.py music_hero.wav
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i music_hero.wav -c:v libx264 -crf 20 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -af loudnorm=I=-15:TP=-1.5 -shortest les_9_signes_depression_vertical.mp4
```

---

# Pourboire : qui a raison ? (TikTok, 9:16)

Une vidéo verticale de 54 s (1080×1920, 30 i/s, H.264) en flat design, calée sur la voix-off ElevenLabs `assets/voix_pourboire.mp3`.

- **Vidéo :** `pourboire_tiktok.mp4` (voix + bruitages discrets) et `pourboire_tiktok_voix_seule.mp4` (voix seule, si vous ajoutez une musique sur TikTok)
- **Source :** `pourboire.html`, à ouvrir dans un navigateur pour la lire avec la voix. La case « zones TikTok » affiche les zones à garder libres.
- **Palette :** vert dollar `#2ECC71`, rouge `#E74C3C`, crème `#FFF4E0`, noir `#1A1A1A`. Police : Montserrat Black (`assets/fonts`, licence OFL).
- **Sous-titres :** mot à mot, en bas du tiers central. Le mot prononcé passe en vert.
- **Zones de sécurité :** rien d'important dans les 250 px du bas ni dans les 120 px de droite.

## Synchronisation sur la voix

Chaque animation est déclenchée par un mot de la voix-off (fonction `Wt('mot')` dans `pourboire.html`). Les horodatages sont dans `assets/pourboire_words.js`, le texte dans `scripts/pourboire.txt`.

Si la voix change : `node tools/voix.mjs pourboire --audio nouvelle_voix.mp3` (ou sans `--audio` pour la générer avec ElevenLabs), voir `docs/MODELE.md`, section « Voix-off ». Les animations se recalent toutes seules.

## Rendu

```bash
PAGE=pourboire.html node tools/render.mjs frames 30
python3 tools/sfx_pourboire.py sfx.wav
ffmpeg -i assets/voix_pourboire.mp3 -i sfx.wav -filter_complex \
  "[0:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=54[v];[1:a]volume=0.32[s];[v][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
  -map "[a]" -t 54 mix.wav
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest pourboire_tiktok.mp4
```

---

# Voiture électrique : arnaque ou progrès ? (TikTok, 9:16)

Une vidéo verticale de 60 s (1080×1920, 30 i/s, H.264) avec la charte habituelle (`docs/MODELE.md`). Six reproches à la voiture électrique (prix, batterie de 400 kg, cobalt du Congo, dette carbone à l'usine, recharge sur l'autoroute, revente), puis la parole à ses défenseurs (3 fois moins cher à rouler à la maison, 2 à 3 fois moins de CO2 sur sa vie en France), et un appel au débat « arnaque ou progrès ? ».

- **Vidéo :** `electrique_tiktok.mp4` (voix + bruitages)
- **Source :** `electrique.html`, voix-off `scripts/electrique.txt` → `assets/voix_electrique.mp3`, bruitages `tools/sfx_electrique.py`

```bash
node tools/voix.mjs electrique
PAGE=electrique.html node tools/render.mjs frames 30
python3 tools/sfx_electrique.py sfx.wav
ffmpeg -i assets/voix_electrique.mp3 -i sfx.wav -filter_complex \
  "[0:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=60.5[v];[1:a]volume=0.32[s];[v][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
  -map "[a]" -t 60.5 mix.wav
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest electrique_tiktok.mp4
```

---

# Qui paie au premier rendez-vous ? (TikTok, 9:16)

Épisode 1 de la série « Qui a raison ? ». Une vidéo verticale de 27 s (1080×1920, 30 i/s, H.264) avec la charte habituelle (`docs/MODELE.md`). Accroche affichée dès la première image (« Partager l'addition ? » puis tampon « RED FLAG ? »), un argument juste pour chaque camp (celui qui invite paie / chacun sa part), le débat « tu paies ou tu partages ? » et une fin qui annonce l'épisode suivant (l'addition entre potes) avec un bouton « Abonne-toi ».

- **Vidéo :** `rendezvous_tiktok.mp4` (voix + bruitages)
- **Source :** `rendezvous.html`, voix-off `scripts/rendezvous.txt` → `assets/voix_rendezvous.mp3`, bruitages `tools/sfx_rendezvous.py`

```bash
node tools/voix.mjs rendezvous
PAGE=rendezvous.html node tools/render.mjs frames 30
python3 tools/sfx_rendezvous.py sfx.wav
ffmpeg -i assets/voix_rendezvous.mp3 -i sfx.wav -filter_complex \
  "[0:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=27[v];[1:a]volume=0.32[s];[v][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
  -map "[a]" -t 27 mix.wav
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest rendezvous_tiktok.mp4
```

## Version couple : l'homme doit-il payer ? (57 s)

Même épisode, recentré sur le couple (un homme et une femme à table, projecteur sur lui quand l'addition arrive) et plus long : trois arguments par camp. Camp 1, « oui, c'est à lui » : galanterie, tradition, la calculette casse la magie. Camp 2, « non, on partage » : d'égal à égal, personne ne doit rien, un premier test pour parler d'argent.

- **Vidéo :** `rendezvous_couple_tiktok.mp4`
- **Source :** `rendezvous_couple.html`, voix-off `scripts/rendezvous_couple.txt`, bruitages `tools/sfx_rendezvous_couple.py`. Mêmes commandes que ci-dessus en remplaçant `rendezvous` par `rendezvous_couple` et 27 par 57.

---

# Loyer en couple : 50/50 ou au prorata ? (TikTok, 9:16)

69 s, série « Qui a raison ? ». Elle gagne 1 500 €, lui 4 000 €, et ils paient le loyer moitié-moitié. Le chiffre de l'Insee (les femmes gagnent en moyenne 22 % de moins dans le privé), puis trois arguments par camp. Camp 1, « 50/50 » : c'est simple, chacun reste indépendant, à poste égal l'écart tombe sous 4 %. Camp 2, « au prorata » : 40 % de son salaire contre 15 %, 22 % chacun pour le même effort, le temps partiel quand les enfants arrivent.

Chiffres : [Insee Focus n° 349](https://www.insee.fr/fr/statistiques/8381248) (mars 2025), secteur privé en 2023 : revenu salarial −22,2 %, à temps de travail égal −14,2 %, à emploi comparable −3,8 %.

- **Vidéo :** `loyer_tiktok.mp4`
- **Source :** `loyer.html`, voix-off `scripts/loyer.txt`, bruitages `tools/sfx_loyer.py`. Mêmes commandes que pour `rendezvous`, avec une durée de 69 s.
