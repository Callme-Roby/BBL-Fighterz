# BBL FIGHTERZ 🥊

Jeu de combat 3D façon **Tekken 3 / PS1** (low-poly, textures pixelisées, polygones qui tremblent,
tramage 15 bits) avec des persos style **CJ de GTA San Andreas**… et **les têtes de tes potes** :
leurs photos sont plaquées sur le visage des combattants par un shader.

- **ARCADE** : contre l'ordinateur (3 niveaux de difficulté)
- **VERSUS** : 2 joueurs sur le même écran (clavier partagé et/ou manettes)
- **EN LIGNE** : tu crées une partie, tu envoies le lien, ton pote clique et vous vous battez
  (pair-à-pair WebRTC + netcode *rollback* comme les vrais jeux de baston)
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
| Pause | Échap | Échap | Échap | Start |

Les touches sont lues par position physique : ZQSD sur AZERTY = WASD sur QWERTY.
Sur téléphone / tablette, un joystick et 4 boutons tactiles apparaissent.

**Mécaniques** : garde en maintenant *arrière* (debout = bloque hauts et moyens, accroupi = bloque les bas,
les coups hauts passent au-dessus des accroupis) · dash avant/arrière (double tape) · choppe
(Poing G + Pied G, ou L1) avec échappement (appuyer sur un poing juste après) · chaînes
(Poing G → Poing D → Pied D…) · launchers (bas + Poing D, avant + Pied G) et **juggles** ·
coups contre (*counter hit*) · jauge **BBL** qui se remplit en tapant/encaissant :
pleine, **↓ ↘ → + Poing** déclenche le super **BBL BUSTER**.

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
