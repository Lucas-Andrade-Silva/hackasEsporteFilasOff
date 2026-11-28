// Cortes de vídeos do YouTube incorporados pelo player oficial (modo de
// privacidade youtube-nocookie). Nenhum arquivo é copiado para o projeto: o
// vídeo continua no canal de origem, com o crédito dele. Uso temporário no MVP,
// até o time gravar os próprios vídeos.

export type Clip = { id: string; start: number; end: number; channel: string; title: string };

export const CLIPS: Record<string, Clip> = {
  "v-bloqueio": { id: "fadS1Cjg58k", start: 9, end: 17, channel: "Elevate Yourself", title: "Blocking Fundamentals for Volleyball Beginners" },
  "v-ataque": { id: "w6IevIgUfxY", start: 7, end: 47, channel: "TORQVB", title: "The Approach" },
  "v-alcance": { id: "ARas7CcMNhU", start: 4, end: 30, channel: "The Female Elite", title: "How to Measure Your Vertical Jump and Jump Reach" },
  "v-deslocamento": { id: "Pb3eZwTJwKw", start: 12, end: 40, channel: "Four Athletes", title: "All of the Blocking Footwork You Need" },
  "v-sprint": { id: "rLAAYYie32U", start: 53, end: 88, channel: "Wave Volleyball Online", title: "First Step Quickness Drill - Volleyball Defense" },
  "v-toque": { id: "sFxs0EPD68Q", start: 77, end: 100, channel: "Olympic Games", title: "How to become a better volleyball setter ft. Rachael Adams" },
  "v-manchete": { id: "siDVtYyRG_M", start: 10, end: 30, channel: "SIKANA English", title: "Forearm pass | Volleyball" },
  "v-saque": { id: "g5sX0LCitgs", start: 3, end: 38, channel: "Get The Pancake", title: "Volleyball Overhand Serving Progressions" },
  "v-agachamento": { id: "dkS9j0GJw5E", start: 2, end: 22, channel: "FitFx Training", title: "Jump Squats Tutorial" },
  "v-saltos": { id: "j0nl5dWuqN4", start: 2, end: 26, channel: "Runna", title: "Pogo Jumps Tutorial" },
  "b-rebote": { id: "9flg84QWaK4", start: 13, end: 24, channel: "Howcast", title: "How to Do a Rebounding Drill" },
  "b-bandeja": { id: "44xA0RNZ7ys", start: 10, end: 40, channel: "Bill Ivey", title: "Basic Layup Footwork" },
  "b-alcance": { id: "xnLVj73NRSg", start: 0, end: 20, channel: "Dre Baldwin", title: "Rim Touches" },
  "b-deslize": { id: "rTsnVx1I6so", start: 13, end: 40, channel: "Paul Easton Basketball", title: "Defensive Drill - Defensive Slides" },
  "b-5105": { id: "XSc-g5o2qhY", start: 0, end: 15, channel: "IYCA", title: "5-10-5 Agility Drill" },
  "b-drible-alternado": { id: "M3yD-gwjoRE", start: 35, end: 60, channel: "SIKANA English", title: "The Crossover Dribble | Basketball" },
  "b-drible-baixo": { id: "YuK1JHuq_aE", start: 15, end: 45, channel: "CoachUp", title: "Pound Dribbling" },
  "b-lance-livre": { id: "iW2VFzBiaQo", start: 20, end: 60, channel: "SIKANA English", title: "The Free Throw | Basketball" },
  "b-arremesso-salto": { id: "qhgs5ZODc4A", start: 37, end: 70, channel: "SIKANA English", title: "The Jump Shot | Basketball" },
};

/** Exercício que representa cada grupo nos cards. */
export const GROUP_CLIP: Record<string, string> = {
  "v-impulsao": "v-bloqueio", "v-agilidade": "v-deslocamento", "v-fundamentos": "v-toque", "v-explosao": "v-agachamento",
  "b-impulsao": "b-alcance", "b-agilidade": "b-deslize", "b-drible": "b-drible-alternado", "b-arremesso": "b-lance-livre",
};

export const thumb = (c: Clip) => `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`;
/** Quadro real do meio do vídeo (gerado pelo YouTube), sem os letreiros da capa. */
export const frame = (c: Clip) => `https://i.ytimg.com/vi/${c.id}/hq2.jpg`;
export const clipFor = (exerciseId: string) => CLIPS[exerciseId];
export const groupClip = (groupId: string) => CLIPS[GROUP_CLIP[groupId]];
export const watchUrl = (c: Clip) => `https://www.youtube.com/watch?v=${c.id}&t=${c.start}s`;
