Je te confie ce projet de paysage animé horizontal. Les références visuelles sont
dans reference/. Commence par le canal ; les autres villes viendront ensuite.

Lis AGENTS.md, ART_DIRECTION.md et reviews/001-initial-review.md. Ouvre réellement
reference/amsterdam.jpg et artifacts/day-start.png, puis compare-les.

L'objectif n'est pas de faire glisser l'image, ni de copier ses pixels dans une
énorme liste de rectangles. Reconstruis son style par des composants dessinés en
code : silhouettes de façades, pignons, ouvertures, feuillages, eau et reflets.
Les textures générées par le code et mises en cache sont autorisées.

Pour cette première itération, améliore uniquement les façades et les pignons :
proportions, corniches, profondeur des fenêtres et variété maîtrisée des briques.
Préserve le reste de la scène, les commandes et l'API de test.

Avant de coder, liste les trois différences les plus importantes observées.
Après modification :
- Exécute les tests techniques ; annonce exactement lesquels ont été exécutés.
- Capture le rendu à t=5, caméra=0, palette=day, viewport=1440×1100.
- Capture aussi le raccord caméra=1368 et l'écran mobile 390×844.
- Ouvre les captures et compare-les à la référence, sans inventer de score.
- Corrige une éventuelle régression, puis décris ce qui reste imparfait.
- Rédige une petite revue dans reviews/ avec les captures en preuve.

N'écrase pas les captures de référence approuvées simplement pour faire passer les
tests. N'ajoute pas encore de nouvelle ville et ne migre pas tout le moteur.
Termine avec un résultat vérifiable et une seule proposition de prochain travail.
