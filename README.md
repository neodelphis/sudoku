# 📸 Sudoku Photo

Photographie une grille de sudoku (journal, magazine, écran) avec ton téléphone et obtiens **la correction instantanément**, directement dans le navigateur. Aucune installation, aucun compte, tout se passe sur l'appareil.

## Utilisation

Ouvre l'application en ligne (hébergement statique, ex. GitHub Pages) ou sers-la localement :

```bash
npx serve .
# puis ouvre http://localhost:3000
```

Puis clique sur **📷 Prendre une photo**, cadre bien les 4 coins de la grille, et appuie sur **✅ Voir la correction**. Les chiffres reconnus sont en noir, la solution en vert.

## Installer sur le téléphone (Android / iPhone)

L'application est une **PWA** : ouvre-la dans le navigateur, puis
- **Android (Chrome)** : menu ⋮ → « Ajouter à l'écran d'accueil »
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »

Elle fonctionne ensuite hors-ligne comme une vraie appli.

## Comment ça marche

Tout le traitement se fait **localement, dans le navigateur** (rien n'est envoyé sur un serveur) :

1. **Prétraitement** (`js/vision.js`) : conversion en niveaux de gris, seuillage adaptatif (robuste à la luminosité du journal).
2. **Détection de la grille** (`js/grid.js`) : projections horizontale/verticale des pixels sombres, recherche par grille régulière des 10 lignes dans chaque direction, puis **homographie** pour redresser la grille en perspective (photo de travers) en 450×450.
3. **Reconnaissance des chiffres** (`js/ocr.js`) : chaque cellule est extraite en 28×28, normalisée (centrage sur la boîte englobante, comme MNIST) et classée par le modèle Hugging Face **[onnxmodelzoo/mnist-8](https://huggingface.co/onnxmodelzoo/mnist-8)** (CNN, 26 kB, ~99 % de précision sur MNIST), exécuté dans le navigateur via [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/) — le modèle est téléchargé une fois depuis Hugging Face puis mis en cache.
4. **Résolution** (`js/solver.js`) : backtracking MRV en pur JS, instantané.

## Structure

```
index.html          page unique
styles.css          UI mobile first
js/solver.js        solveur de sudoku (backtracking MRV)
js/grid.js          détection des lignes + homographie (perspective)
js/vision.js        prétraitement image, extraction des 81 cellules 28×28
js/ocr.js           inférence ONNX du modèle MNIST dans le navigateur
js/app.js           orchestration UI
manifest.webmanifest / sw.js   PWA (installable, hors-ligne)
test/               tests Node (aucun framework)
assets/demo-photo.png   image de démo pour tester sans appareil photo
```

## Tests

```bash
node test/solver.test.js   # solveur
node test/grid.test.js     # détection de grille (image synthétique)
node test/vision.test.js   # prétraitement + extraction cellules
node test/ocr.test.js      # pipeline OCR (session factice)
node test/e2e.test.js      # bout en bout réel : photo de démo -> grille résolue
                           # (nécessite onnxruntime-node + le modèle mnist-8.onnx)
```

## Limites connues & pistes

- Le modèle MNIST est entraîné sur des chiffres manuscrits ; les chiffres **imprimés** du journal fonctionnent bien mais peuvent être confondus (1/7, 3/8) sur des photos floues. Piste : fine-tuner un petit CNN sur des chiffres imprimés, ou passer à un modèle plus récent entraîné sur des grilles réelles.
- La détection de grille suppose que la grille domine la photo. Cadre bien la grille.
- **Prochaine étape (mobile natif)** : empaqueter la même logique JS dans une WebView (Capacitor / Cordova) pour publier sur le Play Store et l'App Store, le modèle ONNX tournant toujours localement via onnxruntime-mobile.

## Licence

MIT
