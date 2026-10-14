/**
 * ROSTER — edit this file to add your friends!
 *
 * Each fighter needs a face photo in `public/faces/` (a tight crop of the face,
 * portrait 3:4, hairline to chin — see public/faces/README.md). Everything else
 * is optional. Custom fighters can also be created in-game ("LABO").
 */

export type HairStyle = 'spiky' | 'short' | 'buzz' | 'bald' | 'afro' | 'long' | 'mohawk';
export type TopStyle = 'tank' | 'tshirt' | 'tracksuit' | 'shirtless' | 'hoodie';

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
}

export interface FighterDef {
  id: string;
  name: string;
  /** short line under the name on the select screen */
  title: string;
  /** face photo url (relative, no leading slash) or data URL */
  face: string;
  /** skin colour override (hex). When omitted it is sampled from the photo. */
  skin?: string;
  hair: { style: HairStyle; color: string };
  outfit: Outfit;
  /** body build: 1 = normal, 1.15 = beefy (CJ after the gym) */
  build?: number;
  /** head size multiplier (bigger heads = more recognisable faces) */
  headScale?: number;
  height?: number;
  /** lines said during the intro (one is picked at random) */
  introLines: string[];
  winLines: string[];
  voice?: {
    lang?: string;
    pitch?: number;
    rate?: number;
    /** optional recorded files (relative urls), e.g. 'audio/voices/blaze_intro.mp3' */
    introFile?: string;
    winFile?: string;
  };
  /** procedural pixel face used when `face` is empty */
  faceGen?: { eyes?: string; brows?: string; beard?: boolean; glasses?: boolean; lips?: string; wrinkles?: boolean };
  /** true for fighters created in the in-game lab */
  custom?: boolean;
}

export const ROSTER: FighterDef[] = [
  {
    id: 'blaze',
    name: 'BLAZE',
    title: 'Le roux de Grove Street',
    face: 'faces/blaze.jpg',
    hair: { style: 'spiky', color: '#e0893a' },
    outfit: {
      top: 'tank',
      topColor: '#f2f0e8',
      trimColor: '#d8d4c8',
      pantsColor: '#3b5a8c',
      shoesColor: '#1d1d1f',
      beltColor: '#4a2f1c',
    },
    build: 1.1,
    headScale: 1.18,
    introLines: ['Je vais te tuer.', 'Viens par là, toi !', "T'es mort, mon pote."],
    winLines: ['Trop facile.', 'Retourne chez ta mère !', 'Grove Street, baby.'],
    voice: { lang: 'fr-FR', pitch: 0.9, rate: 1 },
  },
  {
    id: 'tacchini',
    name: 'TACCHINI',
    title: 'Le survêt de la mort',
    face: 'faces/tacchini.jpg',
    hair: { style: 'short', color: '#3a2618' },
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
    voice: { lang: 'fr-FR', pitch: 0.75, rate: 0.95 },
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
    faceGen: { beard: true, brows: '#1a120c' },
    build: 1.2,
    headScale: 1.12,
    introLines: ['Ah merde, on y retourne.', 'Je vais te tuer, homie.'],
    winLines: ['Grove Street pour la vie.', 'Respect, mec.'],
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
    faceGen: { glasses: true, wrinkles: true, lips: '#b04060', brows: '#c8c8d0' },
    build: 0.92,
    headScale: 1.15,
    introLines: ['Je vais te tuer, mon chéri.', "Range ta chambre d'abord !"],
    winLines: ['Et maintenant, une bonne soupe.', 'Respecte tes aînés.'],
    voice: { lang: 'fr-FR', pitch: 1.5, rate: 0.9 },
  },
];
