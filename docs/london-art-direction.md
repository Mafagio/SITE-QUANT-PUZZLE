# Londres — direction artistique

Références examinées : les neuf PNG présents dans `LONDON/`, en planche-contact,
puis `frame01.png`, `frame06.png` et `frame11_pont_aeroport.png` en grand.
Les images sont des cadrages qui se recouvrent, et non les poses d'une animation.

La première composition reprend la hiérarchie de `frame01` : Tower Bridge à
gauche, Westminster et sa tour centrale, Elizabeth Tower comme verticale
dominante, puis le Gherkin et le Shard. Il s'agit du Londres imaginaire des
références, pas d'une reconstitution géographique. La rive se poursuit par les
entrepôts, une grue unique, puis le terminal et sa passerelle traversable.

Grille : **1536 × 1024**, ratio **3:2**, accents de 1–2 pixels, matières de
3–12 pixels. Eau à y=704, promenade à y=912, sol du personnage à y=958.
Ces niveaux restent communs aux 6144 pixels du parcours. Les monuments, les
docks et leurs quais partagent le même déplacement ; seule la ville lointaine
et le ciel ont une parallaxe plus lente.

Palette : violet pervenche et rose corail dans le ciel, nuages mauves aux
crêtes saumon et or, ardoise bleue, grès ocre et brique rouge. La lumière vient
du soleil unique à gauche. Les fenêtres sont chaudes, leurs embrasures sombres,
les pierres s'organisent en assises. Pas de halo flou sur l'architecture.

Priorités : silhouette et proportions ; étagement et ombres ; assises de pierre,
briques et vitres ; baies gothiques et ornements ; mouvements discrets.
Après la reprise des ancrages et des reflets, l'eau utilise les volumes et couleurs
du calque de ville dessiné par code, comprimés, atténués et fragmentés par bandes.
Des nappes lumineuses liées aux sources, au soleil et au ciel rose/mauve complètent
ce volume sans laisser une façade inversée intacte. La phase de marche dépend de
la distance parcourue ; le réglage de vitesse ne change pas le temps de l'eau.

Le décor n'importe aucun PNG. Les références sont visibles uniquement dans le
panneau de comparaison. Les textures Canvas générées sont mises en cache ;
leur mémoire et leurs temps de construction sont exposés par l'API de revue.

La V2 approfondit les retours bleu-violet, les ombres sous les corniches et le
toit du terminal, les embrasures et la distinction intérieur/reflet extérieur.
Les nuages ont des silhouettes composées et des déchirures attachées aux masses.
Il ne s'agit pas d'un filtre de saturation ou d'une augmentation de définition.

L'embarquement remplace la passerelle décorative de la V1. Les ancres de dessin
et de trajet sont communes dans `airport-geometry.js`. L'échelle décroît jusqu'à
0,42 sur la rive distante. Dix girons et dix contremarches relient physiquement
le parvis au seuil de l'avion. Le rapprochement de caméra est progressif ;
l'entrée s'occulte par la porte et le fuselage, sans fondu de disparition.

Les pinacles du palais et les tourelles de l'horloge ont des massifs de pierre
continus jusqu'à leur toiture ou corniche porteuse. Le Gherkin et le Shard
descendent jusqu'au quai. Trois plans urbains continus et des façades riveraines
occupent les intervalles sans déplacer les monuments ni le parcours.

Les motifs de la surface de l'eau partagent désormais le repère du monde :
une seule soustraction de caméra, y compris pour les nappes roses et les découpes
des reflets. Les ombres et biseaux du quai et des pavés restent dans les textures
stables. La résolution 1536 × 1024 est conservée.

Après l'embarquement, un avion dynamique unique ferme sa porte, laisse retirer
l'escalier puis roule, se cabre et monte. Les phases suivent le temps de simulation
commun ; la vitesse du personnage ne les accélère pas. La caméra ouvre le cadre
avant le départ, et l'ombre de l'appareil reste au sol pendant la montée.

Les détails de `cointzurich.html` servent de référence complémentaire pour les
petites façades habitées : rideaux, vitrines, ferronneries, menuiseries et coiffes
de toit. Des maisons peintes et des lumières ponctuelles tempèrent le tout-or.
Le mobilier du quai, les drapeaux, les navettes et les cygnes restent des accents
discrets. Le layout et le crépuscule de Londres sont conservés.
