# Soie et Venin — lecteur web

Lecteur plein écran du jeu Rive, avec rendu WebGL2 pour les shaders et VFX.

## Démarrage

Place le build web `soie-et-venin.riv` à côté de `index.html`, puis sers simplement ce dossier avec ton hébergeur statique.

Pour tester en local avec Python, ouvre un terminal dans ce dossier et lance `python -m http.server 8000`, puis visite `http://localhost:8000`. Tu peux aussi sélectionner un `.riv` depuis l’écran d’accueil.

Le fichier Rive n’est volontairement pas inclus. Le runtime WebGL2 officiel est chargé depuis un CDN (connexion Internet requise) et attend l’artboard `Soie et Venin` ainsi que la machine d’état `Entrees et pause`. Exporte un build compatible avec le runtime web afin que ses scripts, shaders et contrôles puissent s’exécuter.

## Commandes

Les touches et boutons de la manette reprennent le mapping déclaré dans `input.luau` : stick gauche / croix directionnelle pour marcher ; A pour sauter ; B, Y, LB, RB, LT et RT pour les six compétences ; X pour attaquer ; R3 pour le rig ; Start pour pause ; L3 pour dash ; Select pour soin. Les boutons de la manette sont traduits vers les touches existantes du jeu, sans modifier le projet Rive.

Clavier : flèches ou A/D pour bouger, Espace pour sauter, J pour attaquer, K/U/I/O/P/N pour les compétences, L pour dash, H pour soin, Échap pour pause et Tab pour le rig.

Les gestes clavier et manette sont envoyés au canvas Rive quand le jeu est démarré et qu’il a le focus. Le navigateur exige une interaction utilisateur avant le démarrage, notamment pour autoriser l’audio.
