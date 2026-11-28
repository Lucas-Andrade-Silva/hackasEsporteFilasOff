// Catálogo do app: esportes, grupos de exercícios, perguntas do onboarding,
// divisões da liga e conquistas. Pontuações de referência são metas internas
// do MOVA para motivar, não recordes de atletas reais.

export type Sport = "volleyball" | "basketball";
export type SportChoice = Sport | "both";
export type Motion =
  | "jump" | "block" | "approach" | "lateral" | "sprint" | "dribble"
  | "shot" | "set" | "bump" | "serve" | "squat";
export type Space = "small" | "large";

export type Exercise = {
  id: string;
  sport: Sport;
  group: string;
  title: string;
  summary: string;
  steps: string[];
  measures: string;
  motion: Motion;
  minutes: number;
  minScore: number;
  referenceScore: number;
  coins: number;
  space: Space;
  skill: string;
};

export type ExerciseGroup = { id: string; sport: Sport; title: string; tagline: string; motion: Motion };

export const SPORT_LABEL: Record<Sport, string> = { volleyball: "Vôlei", basketball: "Basquete" };

export const ATTEMPTS_PER_DAY = 3;

export const GROUPS: ExerciseGroup[] = [
  { id: "v-impulsao", sport: "volleyball", title: "Impulsão", tagline: "Bloqueio, ataque e alcance", motion: "block" },
  { id: "v-agilidade", sport: "volleyball", title: "Agilidade", tagline: "Deslocamento de rede e defesa", motion: "lateral" },
  { id: "v-fundamentos", sport: "volleyball", title: "Fundamentos", tagline: "Toque, manchete e saque", motion: "set" },
  { id: "v-explosao", sport: "volleyball", title: "Explosão", tagline: "Força que vira salto", motion: "squat" },
  { id: "b-impulsao", sport: "basketball", title: "Impulsão", tagline: "Rebote, bandeja e alcance", motion: "jump" },
  { id: "b-agilidade", sport: "basketball", title: "Agilidade", tagline: "Defesa e mudança de direção", motion: "lateral" },
  { id: "b-drible", sport: "basketball", title: "Controle de bola", tagline: "Drible com as duas mãos", motion: "dribble" },
  { id: "b-arremesso", sport: "basketball", title: "Arremesso", tagline: "Mecânica e acerto", motion: "shot" },
];

export const EXERCISES: Exercise[] = [
  // Vôlei · Impulsão
  { id: "v-bloqueio", sport: "volleyball", group: "v-impulsao", title: "Bloqueio parado",
    summary: "Salte o mais alto que puder com os braços estendidos, como num bloqueio na rede.",
    steps: ["Pés paralelos, na largura do quadril", "Flexione os joelhos e suba com os braços estendidos", "Aterrisse no mesmo lugar, com os joelhos macios"],
    measures: "Altura do salto pelo tempo de voo", motion: "block", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "impulsao" },
  { id: "v-ataque", sport: "volleyball", group: "v-impulsao", title: "Salto de ataque",
    summary: "Faça a passada de ataque em três passos e salte como se fosse cortar a bola.",
    steps: ["Comece dois metros atrás da marca", "Passada esquerda, direita, esquerda (canhotos invertem)", "Braços para trás no penúltimo passo e explosão para cima"],
    measures: "Altura do salto com aproximação", motion: "approach", minutes: 2, minScore: 50, referenceScore: 150, coins: 40, space: "large", skill: "impulsao" },
  { id: "v-alcance", sport: "volleyball", group: "v-impulsao", title: "Alcance de bloqueio",
    summary: "Mostre onde sua mão chega: primeiro em pé, depois no ponto mais alto do salto.",
    steps: ["Em pé, estenda o braço o mais alto possível", "Salte e toque o ponto mais alto que alcançar", "Mantenha a mão visível na câmera"],
    measures: "Altura máxima da mão", motion: "block", minutes: 1, minScore: 40, referenceScore: 130, coins: 30, space: "small", skill: "impulsao" },
  // Vôlei · Agilidade
  { id: "v-deslocamento", sport: "volleyball", group: "v-agilidade", title: "Deslocamento de bloqueio",
    summary: "Desloque-se de lado entre duas marcas, sem cruzar as pernas, como na rede.",
    steps: ["Marque duas linhas a três metros", "Passos laterais rápidos, mãos na altura dos ombros", "Toque cada linha e volte, por 20 segundos"],
    measures: "Idas e voltas em 20 segundos", motion: "lateral", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "large", skill: "agilidade" },
  { id: "v-sprint", sport: "volleyball", group: "v-agilidade", title: "Sprint de defesa",
    summary: "Saia da posição de defesa e chegue o mais rápido possível à marca de três metros.",
    steps: ["Base baixa, peso na ponta dos pés", "Ao sinal, arranque para a frente", "Freie na marca com o corpo equilibrado"],
    measures: "Tempo de reação e chegada", motion: "sprint", minutes: 1, minScore: 40, referenceScore: 110, coins: 30, space: "large", skill: "agilidade" },
  // Vôlei · Fundamentos
  { id: "v-toque", sport: "volleyball", group: "v-fundamentos", title: "Toque contínuo",
    summary: "Mantenha a bola no ar só com toques, acima da testa, sem deixar cair.",
    steps: ["Mãos em concha acima da testa", "Empurre com dedos e punhos, junto com as pernas", "Conte quantos toques seguidos consegue"],
    measures: "Toques seguidos e altura da bola", motion: "set", minutes: 2, minScore: 30, referenceScore: 100, coins: 35, space: "small", skill: "toque" },
  { id: "v-manchete", sport: "volleyball", group: "v-fundamentos", title: "Manchete contínua",
    summary: "Faça manchetes seguidas com a bola subindo sempre na mesma altura.",
    steps: ["Braços estendidos e unidos, polegares juntos", "Joelhos flexionados, a força vem das pernas", "Mantenha a bola à sua frente"],
    measures: "Manchetes seguidas e estabilidade", motion: "bump", minutes: 2, minScore: 30, referenceScore: 100, coins: 35, space: "small", skill: "manchete" },
  { id: "v-saque", sport: "volleyball", group: "v-fundamentos", title: "Saque na zona",
    summary: "Saque por cima e acerte a zona marcada na quadra.",
    steps: ["Lançamento à frente do ombro de ataque", "Braço em arco, contato com a mão firme", "Dez saques por tentativa"],
    measures: "Acertos na zona", motion: "serve", minutes: 3, minScore: 30, referenceScore: 100, coins: 40, space: "large", skill: "saque" },
  // Vôlei · Explosão
  { id: "v-agachamento", sport: "volleyball", group: "v-explosao", title: "Agachamento com salto",
    summary: "Agache e salte em sequência, sem pausa, mantendo a técnica.",
    steps: ["Pés na largura dos ombros", "Desça até a coxa ficar paralela ao chão", "Exploda para cima e repita por 20 segundos"],
    measures: "Repetições válidas e altura média", motion: "squat", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "explosao" },
  { id: "v-saltos", sport: "volleyball", group: "v-explosao", title: "Saltos contínuos",
    summary: "Dez saltos seguidos com o menor tempo possível no chão.",
    steps: ["Braços ajudam no impulso", "Contato curto com o chão", "Aterrisse sempre no mesmo lugar"],
    measures: "Altura e tempo de contato", motion: "jump", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "explosao" },
  // Basquete · Impulsão
  { id: "b-rebote", sport: "basketball", group: "b-impulsao", title: "Rebote parado",
    summary: "Salte com as duas mãos para cima, como se fosse pegar o rebote no ponto mais alto.",
    steps: ["Pés paralelos, braços prontos", "Flexione e suba estendendo as duas mãos", "Aterrisse equilibrado, no mesmo lugar"],
    measures: "Altura do salto pelo tempo de voo", motion: "jump", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "impulsao" },
  { id: "b-bandeja", sport: "basketball", group: "b-impulsao", title: "Bandeja sem bola",
    summary: "Faça os dois passos da bandeja e suba com o joelho, no ritmo do jogo.",
    steps: ["Dois passos, direita e esquerda", "Joelho do lado da mão sobe junto", "Estenda o braço no ponto mais alto"],
    measures: "Altura do salto com aproximação", motion: "approach", minutes: 2, minScore: 50, referenceScore: 150, coins: 40, space: "large", skill: "finalizacao" },
  { id: "b-alcance", sport: "basketball", group: "b-impulsao", title: "Alcance no aro",
    summary: "Mostre até onde sua mão chega no salto, em direção ao aro.",
    steps: ["Braço estendido em pé, depois salte", "Toque o ponto mais alto que alcançar", "Mão sempre visível na câmera"],
    measures: "Altura máxima da mão", motion: "block", minutes: 1, minScore: 40, referenceScore: 130, coins: 30, space: "small", skill: "impulsao" },
  // Basquete · Agilidade
  { id: "b-deslize", sport: "basketball", group: "b-agilidade", title: "Deslize defensivo",
    summary: "Deslize de lado entre duas marcas, base baixa, sem cruzar os pés.",
    steps: ["Marque duas linhas a três metros", "Base baixa, braços abertos", "Toque cada linha por 20 segundos"],
    measures: "Idas e voltas em 20 segundos", motion: "lateral", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "large", skill: "agilidade" },
  { id: "b-5105", sport: "basketball", group: "b-agilidade", title: "Sprint 5-10-5",
    summary: "Corra cinco metros, volte dez e termine com mais cinco, mudando de direção rápido.",
    steps: ["Comece no meio, entre dois cones", "Toque a linha com a mão a cada troca", "Cruze o meio na volta final"],
    measures: "Tempo total e mudança de direção", motion: "sprint", minutes: 1, minScore: 40, referenceScore: 110, coins: 30, space: "large", skill: "agilidade" },
  // Basquete · Controle de bola
  { id: "b-drible-alternado", sport: "basketball", group: "b-drible", title: "Drible alternado",
    summary: "Alterne a mão a cada quique, com a bola abaixo da cintura e o olhar para a frente.",
    steps: ["Base baixa, bola ao lado do corpo", "Troque de mão a cada quique", "Mantenha o ritmo por 20 segundos"],
    measures: "Dribles por segundo e troca de mão", motion: "dribble", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "drible" },
  { id: "b-drible-baixo", sport: "basketball", group: "b-drible", title: "Drible baixo",
    summary: "Drible o mais rápido possível com a bola abaixo do joelho.",
    steps: ["Joelhos flexionados", "Use só os dedos, não a palma", "Uma mão por vez, 15 segundos cada"],
    measures: "Dribles por segundo e altura do quique", motion: "dribble", minutes: 1, minScore: 40, referenceScore: 120, coins: 30, space: "small", skill: "drible" },
  // Basquete · Arremesso
  { id: "b-lance-livre", sport: "basketball", group: "b-arremesso", title: "Lance livre",
    summary: "Dez lances livres com a mesma rotina antes de cada arremesso.",
    steps: ["Pés atrás da linha, alinhados com o aro", "Cotovelo embaixo da bola", "Siga o movimento com o punho"],
    measures: "Acertos e consistência do movimento", motion: "shot", minutes: 3, minScore: 30, referenceScore: 100, coins: 40, space: "large", skill: "arremesso" },
  { id: "b-arremesso-salto", sport: "basketball", group: "b-arremesso", title: "Arremesso com salto",
    summary: "Arremesse no ponto mais alto do salto, da meia distância.",
    steps: ["Receba a bola já em base", "Suba reto, solte no topo", "Aterrisse no mesmo lugar"],
    measures: "Acertos, altura e tempo de soltura", motion: "shot", minutes: 3, minScore: 30, referenceScore: 100, coins: 40, space: "large", skill: "arremesso" },
];

export const SKILLS: Record<Sport, { id: string; label: string }[]> = {
  volleyball: [
    { id: "impulsao", label: "Impulsão" }, { id: "agilidade", label: "Agilidade" },
    { id: "toque", label: "Toque" }, { id: "manchete", label: "Manchete" },
    { id: "saque", label: "Saque" }, { id: "explosao", label: "Explosão" },
  ],
  basketball: [
    { id: "impulsao", label: "Impulsão" }, { id: "agilidade", label: "Agilidade" },
    { id: "drible", label: "Drible" }, { id: "arremesso", label: "Arremesso" },
    { id: "finalizacao", label: "Finalização" }, { id: "explosao", label: "Explosão" },
  ],
};

export const LEAGUE_TIERS = [
  { name: "Bronze", min: 0, color: "#B87333" },
  { name: "Prata", min: 100, color: "#9CA3AF" },
  { name: "Ouro", min: 300, color: "#E0B300" },
  { name: "Platina", min: 600, color: "#5AC8C8" },
  { name: "Diamante", min: 1000, color: "#7B3FF2" },
  { name: "Elite", min: 1500, color: "#0B0B0F" },
];

export function tierFor(coins: number) {
  let tier = 0;
  LEAGUE_TIERS.forEach((t, i) => { if (coins >= t.min) tier = i; });
  return tier;
}

export const POSITIONS: Record<Sport, string[]> = {
  volleyball: ["Levantador(a)", "Ponteiro(a)", "Oposto(a)", "Central", "Líbero"],
  basketball: ["Armador(a)", "Ala", "Ala-pivô", "Pivô"],
};

export type Answers = {
  sport?: SportChoice;
  position?: string;
  years_playing?: "lt1" | "1to3" | "gt3";
  weekly_sessions?: "0to1" | "2to3" | "4plus";
  goal?: "jump" | "agility" | "skills" | "friends" | "visibility";
  recording_space?: Space;
  adult_confirmed?: boolean;
};

export const YEARS_LABEL = { lt1: "Menos de 1 ano", "1to3": "1 a 3 anos", gt3: "Mais de 3 anos" } as const;
export const WEEKLY_LABEL = { "0to1": "0 a 1 treino", "2to3": "2 a 3 treinos", "4plus": "4 ou mais" } as const;
export const GOAL_LABEL = {
  jump: "Saltar mais alto", agility: "Ganhar agilidade", skills: "Melhorar fundamentos",
  friends: "Competir com amigos", visibility: "Ser visto",
} as const;
export const SPACE_LABEL = { small: "Espaço pequeno, em casa", large: "Quadra ou espaço amplo" } as const;

export function sportsOf(choice: SportChoice | undefined): Sport[] {
  if (choice === "both") return ["volleyball", "basketball"];
  return [choice ?? "volleyball"];
}

const GOAL_SKILLS: Record<string, string[]> = {
  jump: ["impulsao", "explosao"], agility: ["agilidade"],
  skills: ["toque", "manchete", "saque", "drible", "arremesso", "finalizacao"],
  friends: [], visibility: [],
};

/** Grupos na ordem do objetivo da pessoa. */
export function groupsFor(sport: Sport, goal?: string) {
  const wanted = GOAL_SKILLS[goal ?? ""] ?? [];
  const score = (g: ExerciseGroup) =>
    EXERCISES.some(e => e.group === g.id && wanted.includes(e.skill)) ? 0 : 1;
  return GROUPS.filter(g => g.sport === sport).sort((a, b) => score(a) - score(b));
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Missão do dia: sorteio estável por pessoa e por dia, puxado pelo objetivo. */
export function dailyMission(userId: string, choice: SportChoice | undefined, space: Space | undefined, goal: string | undefined, date = new Date()) {
  const sports = sportsOf(choice);
  let pool = EXERCISES.filter(e => sports.includes(e.sport) && (space !== "small" || e.space === "small"));
  const wanted = GOAL_SKILLS[goal ?? ""] ?? [];
  const preferred = pool.filter(e => wanted.includes(e.skill));
  if (preferred.length) pool = [...pool, ...preferred, ...preferred];
  const day = date.toISOString().slice(0, 10);
  return pool[hash(userId + day) % pool.length];
}

export const MISSION_BONUS = 1.5;

export function findExercise(id: string) { return EXERCISES.find(e => e.id === id); }
export function findGroup(id: string) { return GROUPS.find(g => g.id === id); }

export const BADGES = [
  { id: "first", title: "Primeiro treino", hint: "Complete um exercício" },
  { id: "streak3", title: "3 dias seguidos", hint: "Treine três dias seguidos" },
  { id: "streak7", title: "Semana cheia", hint: "Treine sete dias seguidos" },
  { id: "coins100", title: "100 moedas", hint: "Acumule 100 moedas" },
  { id: "mission", title: "Missão cumprida", hint: "Complete a missão do dia" },
  { id: "allgroups", title: "Atleta completo", hint: "Treine em todos os grupos do seu esporte" },
];
