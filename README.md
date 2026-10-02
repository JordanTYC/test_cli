# Soie et Venin — site statique

Le jeu se télécharge automatiquement dès l’arrivée sur la page. Une fois prêt, « Entrer dans l’arène » lance le jeu et sa musique avec un seul clic. Seul `soie-et-venin.riv`, placé à côté de `index.html`, est chargé. Aucun sélecteur de fichier n’est proposé.

Le pourcentage correspond aux octets du jeu reçus lorsque le serveur fournit sa taille. Ensuite, « Préparation de l’arène » couvre le décodage des ressources et l’initialisation du rendu : cette étape n’a pas de pourcentage mesurable. L’écran disparaît uniquement après avoir vérifié que le contrôleur du jeu avance réellement.

## Export Rive compatible navigateur

Ce jeu contient des scripts Luau et des shaders. Le build doit être signé avec `rive . --publish=local` depuis le projet Rive, puis le fichier signé `build/soie-et-venin.riv` doit remplacer celui du site. Les builds issus de `--once` ou de la fenêtre CLI ne sont pas signés : ils affichent le décor dans le navigateur, mais leurs scripts ne s’exécutent pas.

Le site utilise le runtime WebGL2 officiel 2.44.0 depuis un CDN, l’artboard `Soie et Venin`, la machine d’état `Entrees et pause`, les données de jeu auto-liées et GPU Canvas. Connexion Internet requise pour le runtime.

## Hébergement et lancement

Publie directement ce dossier sur un hébergeur statique (GitHub Pages : branche du dépôt, dossier racine). Pour tester en local : `python -m http.server 8000` depuis ce dossier, puis `http://localhost:8000`.

Le combat reste en pause sur l’écran d’entrée. Le clic sur « Entrer dans l’arène » déverrouille la musique intégrée au `.riv` et démarre le combat ; le plein écran reste facultatif. Ce clic initial est nécessaire, car la manette seule ne déverrouille pas l’audio du navigateur.

## Commandes

Manette standard navigateur : stick gauche/croix pour marcher et orienter les attaques ; A pour sauter, X pour attaquer, B/Y/LB/RB/LT/RT pour les six compétences ; Start pour pause ; L3 pour dash ; R3 pour soin ; Back pour le rig. Ces boutons sont traduits en touches du jeu.

Clavier : flèches ou A/D pour marcher, Haut/Bas ou W/S pour viser, Espace pour sauter, J pour attaquer, K/U/I/O/P/N pour les compétences, L pour dash, H pour soin, Échap pour pause, Tab pour le rig.
