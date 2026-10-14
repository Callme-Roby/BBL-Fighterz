/**
 * ROSTER — edit this file to add your friends!
 *
 * Each fighter needs a face photo in `public/faces/` (a tight crop of the face,
 * portrait 3:4, hairline to chin — see public/faces/README.md). Everything else
 * is optional. Custom fighters can also be created in-game ("LABO").
 *
 * Fighters without a photo (`face: ''`) get a procedural pixel face built from
 * `faceGen` (eyes, brows, beard, sunglasses...).
 */

export type HairStyle =
  | 'spiky'
  | 'short'
  | 'buzz'
  | 'bald'
  | 'afro'
  | 'long'
  | 'mohawk'
  | 'ponytail'
  | 'bun'
  /** backwards baseball cap (colour: `accessories.cap`, else hair colour) */
  | 'cap'
  /** bandana tied on the head, knot at the back (colour: `accessories.cap`, else hair colour) */
  | 'bandana'
  /** straight hair down to the chin / neck, covering the sides and back, open in front of the face */
  | 'midlong'
  /** voluminous curly / wavy mid-length cut: curls on top, over the ears, down to the jaw */
  | 'curlymid'
  /** huge, tall, spiky palm-tree mass of hair */
  | 'tahiti'
  /** long locks down to the belly (lower part drapes with the chest / spine) */
  | 'dreads'
  /** very voluminous afro */
  | 'bigafro';

/** Every hair style, in the order shown by the lab (also used to validate network data). */
export const HAIR_STYLES: readonly HairStyle[] = [
  'short',
  'spiky',
  'buzz',
  'afro',
  'bigafro',
  'midlong',
  'curlymid',
  'long',
  'dreads',
  'mohawk',
  'tahiti',
  'ponytail',
  'bun',
  'cap',
  'bandana',
  'bald',
];

export type TopStyle = 'tank' | 'tshirt' | 'tracksuit' | 'shirtless' | 'hoodie';

/** Silhouette: 'standard' (default) or 'fine' (narrower shoulders/chest, slimmer limbs, slightly wider hips). */
export type BodyType = 'standard' | 'fine';

export interface Outfit {
  top: TopStyle;
  topColor: string;
  /** stripe / trim colour (tracksuit stripes, tank-top hem...) */
  trimColor: string;
  pantsColor: string;
  shoesColor: string;
  beltColor?: string;
  /** colour of the wrist bands / gloves (optional) */
  wristColor?: string;
  /** colour of a few stains on the top (barbecue sauce...) */
  stains?: string;
  /** wide, baggy trousers piling up on the sneakers */
  baggy?: boolean;
}

export interface Accessories {
  /** gold chain around the neck (with a small medallion) */
  chain?: boolean;
  /** hang a whistle on the chain instead of the medallion */
  whistle?: boolean;
  /**
   * headwear colour (hex) for the 'cap' and 'bandana' hair styles. When set,
   * `hair.color` shows under it (sides / back); otherwise the headwear uses `hair.color`.
   */
  cap?: string;
}

/** Procedural pixel face options (only used when `face` is empty). */
export interface FaceGen {
  /** iris colour */
  eyes?: string;
  /** eyebrow colour */
  brows?: string;
  /** eyebrow thickness, 0.5 (thin) .. 2 (bushy), default 1 */
  browSize?: number;
  /** full short beard (jaw + chin + moustache) */
  beard?: boolean;
  /** chin beard */
  goatee?: boolean;
  moustache?: boolean;
  /** three-day shadow */
  stubble?: boolean;
  /** beard / moustache colour (defaults to the brow colour) */
  beardColor?: string;
  glasses?: boolean;
  sunglasses?: boolean;
  lips?: string;
  wrinkles?: boolean;
  freckles?: boolean;
  /** small scar across the left eyebrow */
  scar?: boolean;
  /** rosy cheeks */
  blush?: boolean;
  mouth?: 'neutral' | 'smile' | 'smirk' | 'frown' | 'grin';
}

export interface FighterDef {
  id: string;
  name: string;
  /** short line under the name on the select screen */
  title: string;
  /** face photo url (relative, no leading slash) or data URL */
  face: string;
  /** true while the friend's photo hasn't arrived yet (a procedural placeholder face is used) */
  photoPending?: boolean;
  /** skin colour override (hex). When omitted it is sampled from the photo. */
  skin?: string;
  hair: { style: HairStyle; color: string };
  outfit: Outfit;
  /** body build: 1 = normal, 1.15 = beefy (CJ after the gym) */
  build?: number;
  /** silhouette, see BodyType (default 'standard') */
  body?: BodyType;
  /** round belly, 0 (none) .. 1 (barbecue king) */
  belly?: number;
  /** 3D beard volume around the jaw / chin / lower cheeks (below the mouth, never over the face) */
  beard3d?: { color: string; /** 0.5 (short) .. 1.6 (huge), default 1 */ size?: number };
  accessories?: Accessories;
  /** head size multiplier (bigger heads = more recognisable faces) */
  headScale?: number;
  height?: number;
  /** lines said during the intro (one is picked at random) */
  introLines: string[];
  winLines: string[];
  /** big line shouted during the BBL MAX (ultimate) close-up */
  superLines?: string[];
  /** BBL MAX cinematic script id (src/sim/ultimates.ts) — built-in fighters use src/data/ultimates.ts */
  ultimate?: string;
  /** title shown when the BBL MAX starts (custom fighters) */
  ultimateName?: string;
  voice?: {
    lang?: string;
    pitch?: number;
    rate?: number;
    /** optional recorded files (relative urls), e.g. 'audio/voices/dylan_intro.mp3' */
    introFile?: string;
    winFile?: string;
  };
  /** procedural pixel face used when `face` is empty */
  faceGen?: FaceGen;
  /** true for fighters created in the in-game lab */
  custom?: boolean;
}

export const ROSTER: FighterDef[] = [
  // ---------------------------------------------------------------- the crew
  {
    id: 'dylan',
    name: 'DYLAN',
    title: 'La tornade rousse',
    face: 'faces/dylan.jpg',
    hair: { style: 'spiky', color: '#e0893a' },
    outfit: {
      top: 'tank',
      topColor: '#f2f0e8',
      trimColor: '#d8d4c8',
      pantsColor: '#3b5a8c',
      shoesColor: '#1d1d1f',
      beltColor: '#4a2f1c',
    },
    build: 1.3,
    belly: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Viens par là, toi !', "T'es mort, mon pote."],
    winLines: ['Trop facile.', 'Retourne chez ta mère !', 'Grove Street, baby.'],
    superLines: ['Prends ça… BBL BUSTER !', 'Tornade rousse, puissance MAX !'],
    voice: { lang: 'fr-FR', pitch: 0.9, rate: 1 },
  },
  {
    id: 'clement',
    name: 'CLÉMENT',
    title: 'Calme, barbu, dangereux',
    face: 'faces/clement.jpg',
    hair: { style: 'buzz', color: '#1e1610' },
    beard3d: { color: '#2a1a10', size: 1.35 },
    outfit: {
      top: 'tracksuit',
      topColor: '#16171c',
      trimColor: '#c9a646',
      pantsColor: '#16171c',
      shoesColor: '#f0f0f0',
    },
    build: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Tu vas finir au sol.', "Regarde-moi bien, c'est la dernière fois."],
    winLines: ['Même pas transpiré.', 'Le survêt est resté propre.', 'Au suivant !'],
    superLines: ["C'est fini pour toi !", 'Zéro émotion… BBL MAX !'],
    voice: { lang: 'fr-FR', pitch: 0.75, rate: 0.95 },
  },
  {
    id: 'alex',
    name: 'ALEX',
    title: 'Boucles et uppercuts',
    face: 'faces/alex.jpg',
    // the sampled tone comes out greyer than the photo: explicit body tone
    skin: '#a87a60',
    hair: { style: 'curlymid', color: '#9a7448' },
    outfit: {
      top: 'hoodie',
      topColor: '#e0742a',
      trimColor: '#f4d8b0',
      pantsColor: '#2b2f3a',
      shoesColor: '#f0f0f0',
    },
    build: 0.9,
    body: 'fine',
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Approche, si tu oses.', 'Mes boucles sont prêtes, et toi ?'],
    winLines: ['Trop facile.', 'Même pas décoiffé.', 'Au suivant !'],
    superLines: ['Prends ça… BBL BUSTER !', 'Tornade de boucles !'],
    voice: { lang: 'fr-FR', pitch: 1, rate: 1.05 },
  },
  {
    id: 'benji',
    name: 'BENJI',
    title: 'Brushing tropical',
    face: 'faces/benji.jpg',
    hair: { style: 'tahiti', color: '#1c140e' },
    outfit: {
      top: 'tshirt',
      topColor: '#2c64c8',
      trimColor: '#f2f2ea',
      pantsColor: '#3a3a40',
      shoesColor: '#e8e2d0',
      beltColor: '#1a1a1c',
    },
    build: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Admire la coupe, après tu dors.', 'Attention, ça décoiffe !'],
    winLines: ['Pas un cheveu de travers.', 'Retourne chez le coiffeur !', 'Trop facile, mon pote.'],
    superLines: ['Palmier… BBL BUSTER !', 'Coup de brushing tropical !'],
    voice: { lang: 'fr-FR', pitch: 1.1, rate: 1.1 },
  },
  {
    id: 'isis',
    name: 'ISIS',
    title: 'Afro XXL, coups XXL',
    face: 'faces/isis.jpg',
    // the photo has purple-ish highlights on the cheeks: explicit body tone
    skin: '#8c5e48',
    hair: { style: 'bigafro', color: '#151010' },
    outfit: {
      top: 'tracksuit',
      topColor: '#178a8a',
      trimColor: '#f2f2ea',
      pantsColor: '#178a8a',
      shoesColor: '#1a1a1e',
    },
    build: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Tu vas regretter ce combat.', 'Échauffement terminé.'],
    winLines: ['Au tapis, sans discuter.', "C'était même pas sérieux.", 'Suivant !'],
    superLines: ["C'est fini pour toi !", 'Afro power… BBL MAX !'],
    voice: { lang: 'fr-FR', pitch: 1.1, rate: 1 },
  },
  {
    id: 'enola',
    name: 'ENOLA',
    title: 'Lunettes noires, sang-froid',
    face: 'faces/enola.jpg',
    hair: { style: 'midlong', color: '#a4452a' },
    outfit: {
      top: 'tshirt',
      topColor: '#c8323a',
      trimColor: '#f0e0e0',
      pantsColor: '#1e1e24',
      shoesColor: '#f2f2f2',
      beltColor: '#101012',
    },
    build: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Tu trembles déjà, non ?', 'On danse ?'],
    winLines: ['Trop lent, trop tard.', "Respire, c'est fini.", "Je t'avais dit de partir."],
    superLines: ['Tempête… BBL MAX !', 'Tu ne verras rien venir !'],
    voice: { lang: 'fr-FR', pitch: 0.95, rate: 0.95 },
  },
  {
    id: 'zia',
    name: 'ZIA',
    title: 'Reine des dreads',
    face: 'faces/zia.jpg',
    hair: { style: 'dreads', color: '#3b3631' },
    outfit: {
      top: 'tank',
      topColor: '#f0c030',
      trimColor: '#d8a820',
      pantsColor: '#4a5a32',
      shoesColor: '#2a2a2e',
      beltColor: '#2a1e14',
      wristColor: '#1a1a1e',
    },
    build: 1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Prépare tes excuses.', 'Ça va piquer.'],
    winLines: ['Bisous, au revoir.', 'Pas de quartier !', 'Une revanche ? Non merci.'],
    superLines: ['Prends ça en pleine face !', 'Z comme… ZÉRO PITIÉ !'],
    voice: { lang: 'fr-FR', pitch: 1.2, rate: 1.1 },
  },
  // ---------------------------------------------------------- the neighbourhood
  {
    id: 'jacky',
    name: 'TONTON JACKY',
    title: 'Le roi du barbecue',
    face: '',
    skin: '#dca282',
    hair: { style: 'buzz', color: '#9c9a96' },
    outfit: {
      top: 'tank',
      topColor: '#ece6d2',
      trimColor: '#d6ccb0',
      pantsColor: '#8a7a56',
      shoesColor: '#5a3a22',
      beltColor: '#3a2614',
      stains: '#a8783c',
    },
    faceGen: { moustache: true, beardColor: '#6e6a66', brows: '#6a6662', browSize: 1.4, blush: true, wrinkles: true, mouth: 'smile', eyes: '#4a5a6a' },
    build: 1.2,
    belly: 0.8,
    headScale: 1.12,
    height: 0.98,
    introLines: ['Je vais te tuer, et après on mange.', 'Viens goûter mes grillades !', 'Tonton est chaud comme la braise.'],
    winLines: ['À table, tout le monde !', 'Bien cuit, comme je les aime.', "Ça, c'est du travail de tonton."],
    superLines: ['Tu vas finir en brochette !', 'Barbecue… PARTY !'],
    voice: { lang: 'fr-FR', pitch: 0.7, rate: 0.92 },
  },
  {
    id: 'secu',
    name: 'SÉCU',
    title: 'Personne ne passe',
    face: '',
    skin: '#5c3a28',
    hair: { style: 'bald', color: '#141010' },
    outfit: {
      top: 'tshirt',
      topColor: '#16161a',
      trimColor: '#26262c',
      pantsColor: '#121216',
      shoesColor: '#0a0a0c',
      beltColor: '#222226',
    },
    faceGen: { sunglasses: true, stubble: true, brows: '#140e0a', browSize: 1.6, mouth: 'frown', beardColor: '#140e0a' },
    build: 1.16,
    headScale: 1.1,
    height: 1.06,
    introLines: ["Je vais te tuer. Et tu n'entres pas.", "T'es pas sur la liste.", "Pas de baskets, pas d'entrée."],
    winLines: ["Ce soir, c'est complet.", 'Raccompagné vers la sortie.', 'Au suivant dans la file.'],
    superLines: ['Personne ne passe !', 'Sécurité… ÉVACUATION !', 'DEHORS !'],
    voice: { lang: 'fr-FR', pitch: 0.5, rate: 0.85 },
  },
  {
    id: 'kevin',
    name: 'KÉVIN',
    title: 'Livreur à scooter',
    face: '',
    skin: '#e8bf9c',
    hair: { style: 'cap', color: '#8a5a2a' },
    accessories: { cap: '#d23a2a' },
    outfit: {
      top: 'hoodie',
      topColor: '#2f9a48',
      trimColor: '#e8e8e0',
      pantsColor: '#7a7c84',
      shoesColor: '#f2f2f2',
    },
    faceGen: { freckles: true, eyes: '#4a6a9a', brows: '#6a4220', browSize: 0.8, mouth: 'smirk' },
    build: 0.92,
    headScale: 1.16,
    introLines: ['Je vais te tuer, livré en dix minutes.', 'Ta commande est arrivée !', 'Attends, je gare le scooter.'],
    winLines: ['Livré, signé, KO.', 'Pense au pourboire !', 'Cinq étoiles, merci.'],
    superLines: ['Livraison EXPRESS !', 'Colis piégé… BBL BUSTER !'],
    voice: { lang: 'fr-FR', pitch: 1.2, rate: 1.2 },
  },
  {
    id: 'papy',
    name: 'PAPY BOXE',
    title: '40 ans de ring',
    face: '',
    skin: '#d2a07c',
    hair: { style: 'short', color: '#cfcfca' },
    outfit: {
      top: 'tracksuit',
      topColor: '#c02828',
      trimColor: '#f4f4f4',
      pantsColor: '#c02828',
      shoesColor: '#f4f4f4',
    },
    faceGen: { moustache: true, beardColor: '#f0f0ec', brows: '#dcdcd8', browSize: 1.8, wrinkles: true, scar: true, mouth: 'frown', eyes: '#3a4a5a' },
    build: 1.02,
    headScale: 1.14,
    height: 0.97,
    introLines: ['Je vais te tuer, petit.', "À ton âge, j'étais champion.", 'Garde ta garde haute, gamin.'],
    winLines: ["Ça, c'est la vieille école.", "Retourne t'entraîner.", 'Toujours debout, le papy !'],
    superLines: ['Uppercut… de 1985 !', 'Quarante ans de ring… DANS TA FACE !'],
    voice: { lang: 'fr-FR', pitch: 0.65, rate: 0.85 },
  },
  {
    id: 'mcgrove',
    name: 'MC GROVE',
    title: 'Roi du micro',
    face: '',
    skin: '#7a4c32',
    hair: { style: 'bandana', color: '#14100c' },
    accessories: { cap: '#2a8a3a', chain: true },
    outfit: {
      top: 'tank',
      topColor: '#f4f4f0',
      trimColor: '#dcdcd6',
      pantsColor: '#5a80b4',
      shoesColor: '#f0f0f0',
      beltColor: '#18181a',
      baggy: true,
    },
    faceGen: { goatee: true, moustache: true, beardColor: '#14100c', brows: '#14100c', mouth: 'smirk' },
    build: 1.08,
    headScale: 1.16,
    introLines: ['Je vais te tuer en rimes.', 'Micro check, un, deux… KO.', "Le quartier m'écoute, toi aussi."],
    winLines: ['Mic drop.', 'Applaudissez, Grove Street !', 'Couplet final, rideau.'],
    superLines: ['Micro… BBL BUSTER !', 'Écoute bien ce refrain !'],
    voice: { lang: 'fr-FR', pitch: 0.85, rate: 1.1 },
  },
  {
    id: 'bruno',
    name: 'COACH BRUNO',
    title: 'Allez, encore une série !',
    face: '',
    skin: '#c48a62',
    hair: { style: 'short', color: '#2e2016' },
    accessories: { chain: true, whistle: true },
    outfit: {
      top: 'tracksuit',
      topColor: '#6a2f9a',
      trimColor: '#f2f2f2',
      pantsColor: '#6a2f9a',
      shoesColor: '#f4f4f4',
    },
    faceGen: { stubble: true, beardColor: '#2e2016', brows: '#2e2016', browSize: 1.2, mouth: 'grin', eyes: '#3a2614' },
    build: 1.08,
    headScale: 1.14,
    height: 1.02,
    introLines: ["Je vais te tuer… à l'entraînement !", "Allez, on s'échauffe !", 'Dix pompes, et on commence.'],
    winLines: ['Et on étire, maintenant !', 'Bonne séance !', 'Pense à bien boire de l’eau.'],
    superLines: ['Allez, ENCORE UNE SÉRIE !', 'Coup de sifflet final !', 'Cent burpees… MAINTENANT !'],
    voice: { lang: 'fr-FR', pitch: 1.05, rate: 1.25 },
  },
  {
    id: 'bigmo',
    name: 'BIG MO',
    title: 'Le grand du quartier',
    face: '',
    skin: '#6b4430',
    hair: { style: 'buzz', color: '#1a120c' },
    outfit: {
      top: 'tank',
      topColor: '#f4f4f0',
      trimColor: '#e0e0da',
      pantsColor: '#41618f',
      shoesColor: '#101012',
      beltColor: '#2b1a10',
    },
    faceGen: { beard: true, brows: '#1a120c', browSize: 1.3, beardColor: '#1a120c' },
    build: 1.2,
    belly: 0.35,
    headScale: 1.12,
    introLines: ['Ah merde, on y retourne.', 'Je vais te tuer, homie.'],
    winLines: ['Grove Street pour la vie.', 'Respect, mec.'],
    superLines: ['Grove Street… POUR LA VIE !', 'Dors bien, homie !'],
    voice: { lang: 'fr-FR', pitch: 0.6, rate: 0.95 },
  },
  {
    id: 'mamie',
    name: 'MAMIE GIGI',
    title: 'Ceinture noire de tricot',
    face: '',
    skin: '#e8c4a8',
    hair: { style: 'afro', color: '#d9d9e0' },
    outfit: {
      top: 'hoodie',
      topColor: '#b0407a',
      trimColor: '#f0d040',
      pantsColor: '#5a3a6a',
      shoesColor: '#f0f0f0',
    },
    faceGen: { glasses: true, wrinkles: true, blush: true, lips: '#b04060', brows: '#c8c8d0', mouth: 'smile', eyes: '#5a6a8a' },
    build: 0.92,
    body: 'fine',
    headScale: 1.15,
    introLines: ['Je vais te tuer, mon chéri.', "Range ta chambre d'abord !"],
    winLines: ['Et maintenant, une bonne soupe.', 'Respecte tes aînés.'],
    superLines: ['Coup de sac à main !', 'Mamie… MODE FURIE !', 'Au lit, sans dessert !'],
    voice: { lang: 'fr-FR', pitch: 1.5, rate: 0.9 },
  },
];
