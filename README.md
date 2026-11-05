# SITE-QUANT-PUZZLE

Prototypes Pixel World Lab dessinés et animés en code.

## Ouvrir les démos

Depuis la racine du dépôt, avec Python 3 :

```sh
python3 scripts/serve-london.py
```

Puis ouvrir :

- [Londres](http://127.0.0.1:8877/london-code-demo.html) : promenade, embarquement et décollage.
- [Zurich](http://127.0.0.1:8877/cointzurich.html) : démo COINT, Zürich to Amsterdam.
- [Canal](http://127.0.0.1:8877/canal-code-demo.html) : prototype d'origine.

Londres ne demande aucune installation npm ni compilation. Utiliser le serveur
local : ses modules JavaScript ne se lancent pas correctement en ouvrant le HTML
directement en `file://`. Arrêter le serveur avec Ctrl+C.

## Londres

Les sources complètes sont dans `src/london/`, avec l'entrée
`london-code-demo.html`. La scène est dessinée en Canvas 2D à **1536 × 1024**.
Les images de `LONDON/` servent au panneau de comparaison ; le paysage est
construit par le code.

- Flèches ou boutons gauche/droite : marcher.
- Marche auto : parcourir la rive puis embarquer ; le décollage suit automatiquement.
- Vitesse du personnage : de 0,25× à 3×.
- Espace / Pause : figer ou reprendre toute la scène.
- R / Rejouer : recommencer en conservant la vitesse choisie.

Voir [le guide de lancement et de vérification](docs/london-running.md) et
[la direction artistique](docs/london-art-direction.md).

Les scripts de test sont dans `scripts/`. Leurs captures, vidéos et rapports
sont générés localement dans `artifacts/` et ne sont pas versionnés. Les notes
de revue locales dans `reviews/` ne font pas partie du livrable.
