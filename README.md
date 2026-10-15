# BBL FIGHTERZ 🥊

Jeu de combat 3D façon **Tekken 3 / PS1** (low-poly, textures pixelisées, polygones qui tremblent,
tramage 15 bits) avec des persos style **CJ de GTA San Andreas**… et **les têtes de tes potes** :
leurs photos sont plaquées sur le visage des combattants par un shader.

- **ARCADE** : contre l'ordinateur (3 niveaux de difficulté)
- **VERSUS** : 2 joueurs sur le même écran (clavier partagé et/ou manettes)
- **EN LIGNE** : tu crées une partie, tu envoies le lien, ton pote clique et vous vous battez
  (pair-à-pair WebRTC + netcode *rollback* comme les vrais jeux de baston)
- **TOURNOI** : élimination directe jusqu'à 16 participants (humains ou CPU), avec tableau, demi-finales,
  finale et champion. Deux façons de jouer :
  - **sur ce navigateur** : tout le monde joue sur le même écran (clavier / manettes) ;
  - **en ligne** : l'organisateur crée le tournoi et envoie le lien, chacun le rejoint depuis chez soi,
    met son nom et choisit son perso. L'organisateur lance les combats un par un : les deux joueurs
    concernés s'affrontent en ligne, **tous les autres regardent le combat en direct**. Un joueur qui
    recharge sa page retrouve sa place ; si quelqu'un est déconnecté, l'organisateur peut lui donner
    le combat perdu par forfait ou le remplacer par le CPU. L'organisateur doit garder sa page ouverte.
- **ASSISTS** : avant le combat, chacun choisit aussi un pote en **assist** ; en plein combat, la touche
  ASSIST l'appelle : il débarque, place son attaque signature (ruée, lanceur, projectile ou distraction)
  et repart, puis il faut attendre qu'il recharge
- **LABO** : crée un perso dans le navigateur avec une photo (recadrage, cheveux, fringues, voix, répliques)
- Sélection des persos avec aperçu 3D, choix de l'arène, écran VS, intro de chaque perso
  (« Je vais te tuer. »), ROUND 1… FIGHT !, K.O. au ralenti, poses de victoire
- 3 arènes : **Sunset Hood** (cul-de-sac de Los Santos au coucher du soleil), **Sky Dojo**
  (plateforme au-dessus des nuages, hommage à Tekken 3), **Neon Parking** (toit de parking la nuit)
- Musiques et bruitages rétro générés en temps réel (G-funk pour le quartier !), annonceur et
  voix des persos en synthèse vocale — remplaçables par tes propres fichiers

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de prod dans dist/
```

## Mettre en ligne (GitHub + Vercel)

1. Pousse ce dépôt sur GitHub (c'est déjà fait si tu lis ça sur GitHub).
2. Sur [vercel.com](https://vercel.com) → **Add New… → Project** → importe le dépôt `BBL-Fighterz`.
3. Vercel détecte Vite tout seul (`npm run build`, dossier `dist`, déjà configuré dans `vercel.json`).
   Clique **Deploy**.
4. Chaque `git push` redéploie automatiquement. Partage l'URL `https://<ton-projet>.vercel.app` !

Rien d'autre à configurer : pas de serveur, pas de base de données.

## Commandes

| Action | 1 joueur | J1 (versus) | J2 (versus) | Manette |
|---|---|---|---|---|
| Bouger / sauter / s'accroupir | ZQSD (AZERTY) / WASD ou flèches | ZQSD / WASD | Flèches | Croix / stick |
| Poing gauche | U | R | I (ou Num4) | □ / X |
| Poing droit | I | T | O (ou Num5) | △ / Y |
| Pied gauche | J | F | K (ou Num1) | ✕ / A |
| Pied droit | K | G | L (ou Num2) | ○ / B |
| **BBL MAX** (jauge pleine) | E (ou O) | E | P (ou Num6) | R1 / RB |
| **Assist** (ton pote) | Y (ou Num7) | Y | , en AZERTY / M en QWERTY (ou Num7) | R2 / RT (ou R3) |
| **Garde / parade** | Maj gauche (ou L) | Maj gauche | Maj droite (ou Num0) | L2 |
| **Saisie** | A en AZERTY / Q en QWERTY (ou H) | A / Q | ! en AZERTY, / en QWERTY (ou Num3) | L1 |
| Pause | Échap | Échap | Échap | Start |

Les touches sont lues par position physique : ZQSD sur AZERTY = WASD sur QWERTY (et Y = Z sur
un clavier allemand QWERTZ : les écrans d'aide affichent la lettre de ton clavier).
Sur téléphone / tablette, un joystick et des boutons tactiles apparaissent : LP RP LK RK, BBL MAX,
GARDE, SAISIE et **ASSIST** (avec le visage de ton pote, grisé pendant la recharge). Téléphone en
hauteur : l'écran se partage entre le combat (en haut) et une manette (en bas).

**Mécaniques** : garde en maintenant la touche *GARDE* ou *arrière* (debout = bloque hauts et moyens,
accroupi = bloque les bas, les coups hauts passent au-dessus des accroupis) · **PARADE** : taper GARDE
juste avant l'impact dévie le coup et laisse l'attaquant sans défense · dash avant/arrière (double tape) ·
**saisie** (touche SAISIE, ou Poing G + Pied G) qui passe la garde, avec échappement (SAISIE ou un poing
juste après) · **enchaînements
libres** : tout coup qui touche (ou est bloqué) peut s'annuler dans n'importe quel autre, jusqu'à
6 coups · launchers (bas + Poing D, avant + Pied G) et **juggles** · coups contre (*counter hit*) ·
jauge **BBL** qui se remplit en tapant/encaissant : pleine, la touche **BBL MAX** déclenche l'ultime
(gros plan sur le visage + réplique, puis ruée : si elle touche, cinématique propre à chaque perso),
utilisable aussi en fin de combo.

**Combos façon FighterZ** : **auto-combo** en martelant Poing G (sans direction) : poings, pied,
uppercut, super saut et smash s'enchaînent tout seuls · **combos aériens** : après un lanceur, HAUT =
super saut à la poursuite de l'adversaire, puis poings / pieds en l'air, avant-avant = dash aérien,
bas + pied = smash qui l'écrase au sol · rebonds sur le mur et au sol pour prolonger · dégâts et
étourdissement dégressifs dans les longs combos (pas d'infini) · **finish DESTRUCTION** : le coup du
K.O. envoie l'adversaire à travers le décor, au ralenti.

### Les assists

Sur l'écran de sélection, après avoir validé ton perso, tu choisis ton **assist** dans la même grille
(pas toi-même ; « ? » = au hasard ; RETOUR revient d'une étape). Le CPU tire le sien au hasard, en
tournoi chaque participant a le sien (en ligne : « HASARD » est tiré au début du tournoi). Pendant le
combat, le HUD montre son visage et sa jauge de recharge à côté de la jauge BBL : « ASSIST ! » quand
il est prêt.

| Pote | Assist | Type |
|---|---|---|
| Dylan | CHARGE DU BIDON | ruée (gros coup qui fait tomber) |
| Thomas | COUP EN TRAÎTRE | ruée |
| Rayan | CROCHET PACIFISTE | ruée |
| Isis | UPPERCUT MUSCLÉ | lanceur (enchaîne en combo aérien) |
| Elies | RETOUR À L'ENVOYEUR | lanceur |
| Mihaï | COUP DE PIED SAYAN | lanceur |
| Clément | GRENADE BARBUE | projectile |
| Enola | TOILE DE POTE | projectile |
| Billel | MOT-CLÉ MÉTA | projectile |
| Alex | VIENS LÀ MON MIGNON | distraction (l'adversaire reste figé un instant) |
| Benji | C'EST QUOI TA CONFIG ? | distraction |
| Zia | PUNCHLINE | distraction |

Les persos du LABO ont aussi un assist (type tiré de leur identifiant). Données : `src/data/assists.ts`.

### Les BBL MAX

| Perso | BBL MAX | |
|---|---|---|
| Elies | RETOUR EN ENFANCE | Baby Elies prend sa place (0 dégât), puis Elies revient et met tout en un coup de poing |
| Thomas | REGARDE DERRIÈRE TOI ! | la feinte, les coups dans le dos, puis il s'enfuit à l'autre bout de l'arène |
| Dylan | JAMBES DE FEU | combo de jambes… puis son genou lâche (il se blesse et râle) |
| Mihaï | SUPER SAYAN BBL | transformation, pose avec lunettes, puis il s'acharne sur les bijoux de famille |
| Benji | C'EST QUOI TA CONFIG ? | la question qui déstabilise, puis l'uppercut |
| Alex | VIENS LÀ MON MIGNON | écran noir, bagarre de dessin animé (BIM ! BAM ! POW !), l'adversaire K.O. avec des étoiles |
| Isis | MUSCLES XXL | se transforme en bodybuildeuse puis enchaîne |
| Zia | RAP CONTENDERS | battle de rap, punchlines en gros plan, pas un seul coup |
| Clément | ARSENAL BARBU | mitraillette, grenades, bazooka |
| Enola | SPIDER-POTE | son pote masqué débarque et ils enchaînent à deux |
| Rayan | PACIFISTE… OU PAS | « moi je suis pacifiste »… puis l'adversaire devient Dylan : gants, casque, combo de boxe anglaise et uppercut |
| Billel | LA MÉTA | face caméra, un tunnel derrière lui, il explique la méta de League of Legends jusqu'à ce que l'adversaire s'effondre |

Les cinématiques sont des données (`src/sim/ultimates.ts`, `src/sim/ults/`) : coups, positions,
caméras et une timeline de présentation (persos invités, accessoires, répliques, textes BD,
fondus, musique) jouée par `src/game/cinematic.ts`.

## Ajouter tes potes

1. Mets la photo du visage dans `public/faces/` (voir `public/faces/README.md` pour le cadrage).
2. Ajoute une entrée dans `src/data/roster.ts` :

```ts
{
  id: 'kevin',
  name: 'KÉVIN',
  title: 'Le boss du kebab',
  face: 'faces/kevin.jpg',
  hair: { style: 'short', color: '#2a1a10' },          // spiky | short | buzz | bald | afro | long | mohawk
  outfit: { top: 'tank', topColor: '#ffffff', trimColor: '#dddddd',
            pantsColor: '#3b5a8c', shoesColor: '#111111' }, // tank | tshirt | tracksuit | hoodie | shirtless
  build: 1.1,       // carrure
  headScale: 1.18,  // grosse tête = visage plus reconnaissable
  introLines: ['Je vais te tuer.'],
  winLines: ['Trop facile.'],
  voice: { lang: 'fr-FR', pitch: 0.9, introFile: 'audio/voices/kevin_intro.mp3' },
}
```

Sans fichier audio, la réplique est lue en synthèse vocale par le navigateur.
Les musiques, bruitages et l'annonceur peuvent aussi être remplacés : voir `public/audio/README.md`.

Les persos créés dans le **LABO** sont stockés dans le navigateur (localStorage) et sont envoyés
automatiquement à l'adversaire en ligne.

## En ligne : comment ça marche

- La mise en relation passe par le serveur public gratuit de [PeerJS](https://peerjs.com) ;
  ensuite les deux navigateurs communiquent **directement** (WebRTC).
- Le combat utilise un netcode **rollback** (style GGPO) : chaque joueur voit ses propres
  coups sans délai, les entrées de l'adversaire sont prédites puis corrigées.
  La simulation est 100 % déterministe (60 images/s, mêmes calculs des deux côtés).
- Si la connexion échoue derrière certains réseaux d'entreprise / 4G très filtrés, réessaie sur
  un autre réseau (les relais TURN publics de PeerJS sont utilisés en secours).
- Option : ton propre serveur PeerJS (`npx peerjs --port 9000`) via les variables d'environnement
  Vercel `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`.

### Tournoi en ligne

Réseau en étoile : la page de l'organisateur est le point central (`src/game/onlineTournament.ts`).
Les deux joueurs d'un combat ouvrent leur propre salle pair-à-pair (même netcode rollback qu'en
mode EN LIGNE). Le navigateur qui fait tourner le combat envoie les entrées définitives de chaque
image à l'organisateur, qui les relaie aux spectateurs : la simulation étant déterministe, ils
rejouent exactement le même combat, avec environ une demi-seconde de décalage.

## Structure

```
src/
  sim/        simulation déterministe : frame data, combos, juggles, rounds, IA
  net/        PeerJS + session rollback
  render/     shader PS1, persos procéduraux skinnés (vrai squelette 19 os), animations,
              photo → texture de visage, effets, arènes
  game/       monde 3D du combat (caméra cinématique, sons), réglages
  screens/    titre, sélection, arène, combat, en ligne, labo, options
  audio/      moteur WebAudio : séquenceur, synthés, bruitages, voix
  ui/         HUD, menus, contrôles tactiles
dev/          bancs de test visuels (persos / arènes) : /dev/model-preview.html
```

Fait avec [three.js](https://threejs.org), [Vite](https://vite.dev), TypeScript et [PeerJS](https://peerjs.com).
Aucun asset de jeu commercial n'est utilisé : persos, arènes, musiques et sons sont générés par le code.
