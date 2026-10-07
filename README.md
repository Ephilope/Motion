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
