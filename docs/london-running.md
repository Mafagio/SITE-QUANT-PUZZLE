# Lancer et examiner Londres

Depuis la racine du projet, sans installation ni étape de compilation :

```sh
python3 scripts/serve-london.py
```

Ouvrir **http://127.0.0.1:8877/london-code-demo.html**. Arrêter le serveur avec
Ctrl+C. Un autre port peut être choisi avec `--port 8878`.
La scène utilise des modules JavaScript : ouvrir directement le fichier en
`file://` ne remplace pas le serveur local.

`canal-code-demo.html` reste l’entrée du prototype d’origine. Londres dispose de
sa propre entrée et de ses sources dans `src/london/`. Aucun service distant,
framework, compte ou ressource PNG n’est nécessaire pour dessiner le paysage.
Les PNG de `LONDON/` chargent uniquement à l’ouverture du panneau Référence.

## Commandes

- Flèches gauche/droite ou boutons maintenus : marcher.
- Marche auto : démarrer ou arrêter la marche continue.
- Espace ou Pause : figer/reprendre tous les mouvements, eau et ciel compris.
- R ou Retour au départ : revenir à la composition initiale.
- Curseur et noms des quartiers : explorer directement le parcours.
- Bouton de téléchargement : enregistrer le Canvas en PNG 1536 × 1024.
- Vitesse du personnage : 0,25× à 3×, pas de 0,25× ; raccourcis 0,5×, 1× et 2×.
- Embarquer, au pied de la passerelle : rejoindre l'aéroport et monter dans l'avion.
- Rejouer le trajet : revenir au départ en conservant la vitesse choisie.

La marche automatique enchaîne l'embarquement à l'arrivée à la passerelle.
L'exploration par caméra ne le déclenche pas. Pendant la traversée et la montée,
Pause et Vitesse restent disponibles ; les commandes de promenade sont
neutralisées. La vitesse agit sur le personnage, jamais sur l'ambiance.

Après l'entrée complète du passager, la porte se ferme, l'escalier mobile se
retire et l'avion accélère avant de se cabrer et de monter. La caméra élargit
progressivement la vue. Pause fige aussi le décollage ; la vitesse du personnage
ne change pas la vitesse du vol. Rejouer remet également l'avion, sa porte et
l'escalier dans leur état initial.

Les boutons acceptent les interactions tactiles. La préférence système de
réduction des animations fige la scène au démarrage ; une commande explicite
permet ensuite de l’animer.

## Vérification dans Chrome/Chromium

Garder le serveur lancé, puis dans un autre terminal :

```sh
node scripts/test-london-v2.mjs
```

Le script cherche Playwright dans le projet puis dans le cache npm existant.
Il ne télécharge rien et n’installe rien. Il utilise le Chrome de macOS s’il est
présent, sinon le Chromium de Playwright. Un autre exécutable peut être indiqué
par la variable `CHROME_PATH`.

Si Playwright n’est pas disponible, cette commande peut fournir l’outil de test :

```sh
npm exec --yes --package=playwright -- node scripts/test-london-v2.mjs
```

Sur une machine sans Chrome, le navigateur de test doit aussi être installé
avec `npx playwright install chromium`. Ces outils servent uniquement à la
vérification ; ils ne sont pas nécessaires pour lancer la scène.

Pour changer l’adresse ou le dossier des résultats :

```sh
LONDON_URL=http://127.0.0.1:8878/london-code-demo.html node scripts/test-london-v2.mjs --output artifacts/london-v2/another-run
```

Le script vérifie le démarrage, les commandes, la pause intégrale, les retours
au départ, les déplacements dans les deux sens, les raccords, les évictions et
la limite du cache, la reproductibilité des pixels, la comparaison séparée,
le téléchargement PNG, le tactile et la réduction des animations. Il conserve
les erreurs JavaScript et réseau dans `test-report.json` et renvoie un code de
sortie non nul en cas d’échec.

## Résultats des tests

Les captures, vidéos et rapports sont générés localement dans `artifacts/`,
ignoré par Git. Ils ne sont pas nécessaires pour lancer les démos et ne sont
pas livrés avec le dépôt. Les notes de revue locales sont également exclues.

En complément de la suite V2 :

- `scripts/test-london-motion.mjs` : marche lente, arrêts, demi-tours et appuis.
- `scripts/test-london-grounding.mjs` : ancrages des bâtiments, pause et rivière.
- `scripts/test-london-departure.mjs` : repères des reflets, phases du départ,
  indépendance de la vitesse du personnage, pause et parcours jusqu'au vol.

Ces trois scripts utilisent une installation Playwright existante. La variable
`PLAYWRIGHT_MODULE` doit pointer vers son fichier `index.mjs` ; ils utilisent le
Chrome local de macOS. Ils ne démarrent pas de serveur et n'installent rien.
Leur premier argument peut définir le dossier de résultats. La suite V2 ci-dessus
recherche automatiquement Playwright et accepte `CHROME_PATH` pour un autre
navigateur compatible.

Les tests techniques ne mesurent pas la fidélité artistique. Les mesures de
cadence et de coût JavaScript sont locales et ne garantissent pas les
performances sur toutes les machines.

## API de revue

Dans la console du navigateur :

```js
await window.worldlab.ready;
await window.worldlab.renderAt(5, 0);
await window.worldlab.setState({ time: 5, camera: 1700, paused: true });
window.worldlab.getState();
window.worldlab.stats();
window.worldlab.pixelHash();
window.worldlab.route();
```

`renderAt` et `setState` sont asynchrones : attendre leur résolution avant une
capture. Les repères caméra utilisés pour la revue sont 0 (monuments), 768
(raccord), 1700 (entrepôts), 2700 (grue), 4100 (terminal) et 4608 (fin du parcours).
Les captures générées par le test sont des résultats de revue, pas des images
de référence approuvées ni des baselines à remplacer.

Pour une revue déterministe, `simulate(secondes, { direction: 1 })` avance
la même simulation en petits pas puis rend l'état. Cet outil de revue peut
avancer une scène en pause ; `advance(secondes)` respecte la pause générale.
Sans direction explicite, la marche automatique et le trajet en cours sont
utilisés. `startBoarding()` vérifie la proximité de l'entrée. `getState()` expose
l'étape, la distance du trajet, l'ancre du personnage au sol, l'échelle et le zoom.
