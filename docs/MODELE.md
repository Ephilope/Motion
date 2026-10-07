# Modèle pour les vidéos TikTok

Tiré de `pourboire.html`. Le moteur commun est dans `lib/motion.js`, la page de départ dans `modele.html` (démo de 12 s, sans voix).

## Charte (identique pour toutes les vidéos)

C'est la direction artistique de « Pourboire : qui a raison ? ». Le moteur l'applique par défaut ; seules les scènes changent d'une vidéo à l'autre.

- **Format :** 1080 × 1920 (9:16), 30 i/s, environ 55 s, export MP4 H.264.
- **Style :** flat design, couleurs vives, contours noirs épais et ombres portées décalées.
- **Couleurs :** vert dollar `#2ECC71`, rouge `#E74C3C`, crème `#FFF4E0`, noir `#1A1A1A`. Le vert sert au positif et au mot prononcé, le rouge au négatif et à l'alerte, le crème au fond.
- **Police :** Montserrat Black, en capitales.
- **Transitions :** rapides (glissement de 0,16 s avec une bande oblique verte ou rouge).
- **Sous-titres :** mot à mot, en bas du tiers central, synchronisés sur la voix-off (générée par ElevenLabs depuis le texte, ou fournie).
- **Zones de sécurité TikTok :** pas de texte important dans les 250 px du bas ni sur les 120 px de droite.
- **Procédés récurrents :** accroche choc dans les premières secondes (gros chiffre qui claque avec un tremblement, puis question en zoom), étiquette de section en haut, objets du quotidien stylisés (ticket, fiche de paie, terminal), personnages simples, écran coupé rouge / vert pour opposer deux camps, fin sur « DIS-LE EN COMMENTAIRE 👇 » avec une bulle 💬 qui pulse.

## Brief type pour une nouvelle vidéo

À copier et compléter. La voix-off est soit le texte (généré par ElevenLabs), soit un fichier audio joint :

```
Nouvelle vidéo Motion, avec la charte habituelle (docs/MODELE.md).
Sujet : …
Voix-off : texte ci-dessous (ou fichier joint)
Durée : ~55 s

SCÈNE 1 — ACCROCHE (0–6 s)
- …
SCÈNE 2 — … (6–12 s)
- …
…
SCÈNE N — CALL TO ACTION (dernières 7 s)
- Écran divisé rouge / vert : « … » vs « … »
- Bulle de commentaire 💬 qui pulse, texte « DIS-LE EN COMMENTAIRE 👇 »
```

## Démarrer une nouvelle vidéo

1. Copier `modele.html` en `<nom>.html`.
2. Voix-off : écrire le texte dans `scripts/<nom>.txt` puis lancer `node tools/voix.mjs <nom>` (voir « Voix-off » plus bas). Charger `assets/<nom>_words.js` dans la page et supprimer la liste de démo `window.WORDS`.
3. Régler `setup({ duration, audio, emojis })`.
4. Écrire les scènes, puis vérifier quelques images clés :
   `PAGE=<nom>.html node tools/render.mjs stills --stills 1,5,12`
5. Rendu complet (voir plus bas).

## Voix-off (ElevenLabs)

`tools/voix.mjs` produit la voix et l'horodatage de chaque mot en une commande, sans reconnaissance vocale. Il faut Node 18 ou plus et la clé ElevenLabs dans une variable d'environnement (jamais dans un fichier du dépôt) :

```bash
export ELEVENLABS_API_KEY=…                     # une fois par terminal, ou dans ~/.zshrc
node tools/voix.mjs <nom>                       # texte → assets/voix_<nom>.mp3 + assets/<nom>_words.js
node tools/voix.mjs <nom> --audio ma_voix.mp3   # voix déjà faite dans ElevenLabs : horodatage seul
```

- **Texte** (`scripts/<nom>.txt`) : une phrase par ligne, les lignes en `#` sont ignorées. `mot[forme parlée]` affiche `mot` en sous-titre et fait prononcer la forme parlée, utile pour les chiffres et symboles : `20_%[vingt pourcent]`, `1987,[mille neuf cent quatre-vingt-sept]`. Un `_` dans le mot affiché devient une espace (`Alors_?` → « Alors ? »). Exemple complet : `scripts/pourboire.txt`.
- **Réglages** (`voix.config.json`) : `voice_id` (identifiant de la voix, visible dans la bibliothèque de voix ElevenLabs), `model_id`, `output_format`, et si besoin `voice_settings` (`stability`, `similarity_boost`, `style`, `speed`) et `language_code`. `--voice <id>` ou `ELEVENLABS_VOICE_ID` remplacent la voix pour une vidéo.
- **Environnement cloud** : si la clé est ajoutée par le proxy du réseau (en-tête `xi-api-key`), laisser `ELEVENLABS_API_KEY` vide ; le script passe alors par le proxy sans envoyer de clé.
- **Crédits** : si le texte, la voix et les réglages n'ont pas changé, la commande ne refait rien. `--force` régénère quand même (pour une autre prise de la même voix).
- **Mode `--audio`** : l'API d'alignement forcé cale le texte sur un MP3 existant ; le fichier n'est pas modifié, à copier soi-même en `assets/voix_<nom>.mp3`.
- Le texte est envoyé en une seule requête, ce qui couvre largement 60 s de voix.

## Format

| | |
|---|---|
| Image | 1080 × 1920 (9:16), 30 i/s, H.264, `yuv420p` |
| Zones à garder libres | 250 px en bas, 120 px à droite, 160 px en haut (case « zones TikTok » dans l'aperçu) |
| Centre utile | `CX = 510` (la marge de droite reste libre) |
| Durée | Celle de la voix-off, arrondie à la seconde |

## Mise en page verticale

| Hauteur (y) | Usage |
|---|---|
| ~250 | Étiquette de section (`chip`), ex. « EN FRANCE » |
| 450 à 1000 | Visuel principal : personnage, objet, carte, chiffre |
| 1230 | Sous-titres mot à mot |
| 1300 à 1500 | Appel à l'action de fin (carte crème) |
| > 1670 | Rien d'important (interface TikTok) |

## Typographie et couleurs

- Police unique : Montserrat (700, 800, 900) dans `assets/fonts`, licence OFL. Tout en capitales, 900 par défaut.
- Tailles : accroche 150 à 300 px, titre de scène 110 à 170 px, étiquette 46 px, sous-titres 72 px, chiffres de carte 120 à 150 px.
- Style flat : contour noir de 6 à 8 px, ombre portée noire décalée de 10 à 14 px (`card`, `chip`, `txt({ shadow })`).
- Palette par défaut : vert `#2ECC71`, rouge `#E74C3C`, crème `#FFF4E0`, encre `#1A1A1A`. On la change par vidéo avec `setup({ palette })`.
- Sous-titres : crème avec contour noir, le mot prononcé passe en vert et grossit légèrement.

## Rythme et timing

- Toute l'image est une fonction du temps : chaque scène renvoie `update(t)`, sans état ni `setTimeout`. C'est ce qui rend le rendu image par image déterministe.
- Les instants viennent de la voix : `Wt('mot')` donne le début d'un mot, `Wt('mot', 2)` le deuxième, `Wt('mot', 1, depuis)` le premier après un temps donné. Si la voix change, tout se recale.
- Outils d'animation : `p(t, a, b, E.out)` pour une progression 0→1, `pop(t, t0)` pour une apparition avec rebond, `addShake(v)` pour secouer l'image sur un impact.
- Structure type de 45 à 60 s : accroche choc en 0 à 3 s, 3 à 5 scènes d'environ 6 à 10 s, appel à l'action final (« Dis-le en commentaire »).
- Transitions : glissement horizontal de 0,16 s avec une bande oblique de couleur, automatiques entre deux scènes (`S(a, b, build, { swipe: RED })` pour choisir la couleur).

## Briques disponibles (`lib/motion.js`)

`bg` (fond crème à points), `title` (titre multi-lignes), `txt`, `card`, `chip`, `bubble`, `emoji`, `burst`, `sparkles`, `starPath`, plus `el`, `tf`, `show`, `mix`, `rng`, `hash`. Les personnages (`makeChar`), drapeaux et pièces de `pourboire.html` peuvent y être ajoutés quand une deuxième vidéo en a besoin.

## Rendu

```bash
PAGE=<nom>.html node tools/render.mjs frames 30
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i assets/voix_<nom>.mp3 -c:v libx264 -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -af "apad,loudnorm=I=-14:TP=-1.5" -shortest <nom>_tiktok.mp4
```

`tools/render.mjs` marche tel quel : la page respecte son contrat (`#stage` avec `viewBox`, `?render`, `window.renderAt`, `window.DURATION`, `window.ready`).
