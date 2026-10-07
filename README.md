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
