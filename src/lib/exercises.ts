// Built-in exercise catalog. Ships with the app so it works offline and needs
// no table. Ids are stable slugs: workout history stores them, so never
// rename an id (changing the display name is fine).

export const MUSCLE_GROUPS = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraço",
  quads: "Quadríceps",
  hamstrings: "Posterior de coxa",
  glutes: "Glúteos e adutores",
  calves: "Panturrilha",
  abs: "Abdômen",
  cardio: "Cardio",
} as const;

export type MuscleGroup = keyof typeof MUSCLE_GROUPS;

export const EQUIPMENT = {
  barbell: "Barra",
  ez_bar: "Barra W",
  dumbbell: "Halter",
  machine: "Máquina",
  cable: "Polia",
  smith: "Smith",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Elástico",
  other: "Outro",
} as const;

export type Equipment = keyof typeof EQUIPMENT;

export interface ExerciseInfo {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment | null;
  /** True for exercises the user created. */
  custom?: boolean;
}

type Entry = readonly [id: string, name: string, group: MuscleGroup, equipment: Equipment];

const ENTRIES = [
  // Peito
  ["supino-reto-barra", "Supino reto com barra", "chest", "barbell"],
  ["supino-inclinado-barra", "Supino inclinado com barra", "chest", "barbell"],
  ["supino-declinado-barra", "Supino declinado com barra", "chest", "barbell"],
  ["supino-reto-halter", "Supino reto com halteres", "chest", "dumbbell"],
  ["supino-inclinado-halter", "Supino inclinado com halteres", "chest", "dumbbell"],
  ["supino-declinado-halter", "Supino declinado com halteres", "chest", "dumbbell"],
  ["supino-maquina", "Supino reto na máquina", "chest", "machine"],
  ["supino-inclinado-maquina", "Supino inclinado na máquina", "chest", "machine"],
  ["supino-articulado", "Supino articulado", "chest", "machine"],
  ["supino-smith", "Supino reto no Smith", "chest", "smith"],
  ["supino-inclinado-smith", "Supino inclinado no Smith", "chest", "smith"],
  ["crucifixo-reto-halter", "Crucifixo reto com halteres", "chest", "dumbbell"],
  ["crucifixo-inclinado-halter", "Crucifixo inclinado com halteres", "chest", "dumbbell"],
  ["crucifixo-maquina", "Crucifixo na máquina (peck deck)", "chest", "machine"],
  ["crucifixo-polia", "Crucifixo deitado na polia", "chest", "cable"],
  ["crossover-polia-alta", "Crossover (polia alta)", "chest", "cable"],
  ["crossover-polia-baixa", "Crossover (polia baixa)", "chest", "cable"],
  ["flexao", "Flexão de braço", "chest", "bodyweight"],
  ["paralelas-peito", "Paralelas (foco no peito)", "chest", "bodyweight"],
  ["pullover-halter", "Pullover com halter", "chest", "dumbbell"],

  // Costas
  ["barra-fixa", "Barra fixa pronada", "back", "bodyweight"],
  ["barra-fixa-supinada", "Barra fixa supinada", "back", "bodyweight"],
  ["barra-fixa-assistida", "Barra fixa assistida", "back", "machine"],
  ["puxada-frente", "Puxada frontal aberta", "back", "cable"],
  ["puxada-triangulo", "Puxada com triângulo", "back", "cable"],
  ["puxada-supinada", "Puxada frontal supinada", "back", "cable"],
  ["puxada-articulada", "Puxada articulada", "back", "machine"],
  ["pulldown-bracos-estendidos", "Pulldown com braços estendidos", "back", "cable"],
  ["remada-curvada-barra", "Remada curvada com barra", "back", "barbell"],
  ["remada-curvada-supinada", "Remada curvada supinada", "back", "barbell"],
  ["remada-unilateral-halter", "Remada unilateral com halter (serrote)", "back", "dumbbell"],
  ["remada-baixa-triangulo", "Remada baixa com triângulo", "back", "cable"],
  ["remada-baixa-aberta", "Remada baixa pegada aberta", "back", "cable"],
  ["remada-maquina", "Remada na máquina", "back", "machine"],
  ["remada-cavalinho", "Remada cavalinho (T-bar)", "back", "barbell"],
  ["remada-smith", "Remada curvada no Smith", "back", "smith"],
  ["remada-invertida", "Remada invertida", "back", "bodyweight"],
  ["levantamento-terra", "Levantamento terra", "back", "barbell"],
  ["encolhimento-barra", "Encolhimento com barra", "back", "barbell"],
  ["encolhimento-halter", "Encolhimento com halteres", "back", "dumbbell"],
  ["hiperextensao", "Hiperextensão lombar (banco romano)", "back", "bodyweight"],

  // Ombros
  ["desenvolvimento-barra", "Desenvolvimento militar com barra", "shoulders", "barbell"],
  ["desenvolvimento-halter", "Desenvolvimento com halteres", "shoulders", "dumbbell"],
  ["desenvolvimento-maquina", "Desenvolvimento na máquina", "shoulders", "machine"],
  ["desenvolvimento-smith", "Desenvolvimento no Smith", "shoulders", "smith"],
  ["desenvolvimento-arnold", "Desenvolvimento Arnold", "shoulders", "dumbbell"],
  ["elevacao-lateral-halter", "Elevação lateral com halteres", "shoulders", "dumbbell"],
  ["elevacao-lateral-polia", "Elevação lateral na polia", "shoulders", "cable"],
  ["elevacao-lateral-maquina", "Elevação lateral na máquina", "shoulders", "machine"],
  ["elevacao-frontal-halter", "Elevação frontal com halteres", "shoulders", "dumbbell"],
  ["elevacao-frontal-polia", "Elevação frontal na polia", "shoulders", "cable"],
  ["crucifixo-inverso-halter", "Crucifixo inverso com halteres", "shoulders", "dumbbell"],
  ["crucifixo-inverso-maquina", "Crucifixo inverso na máquina", "shoulders", "machine"],
  ["face-pull", "Face pull", "shoulders", "cable"],
  ["remada-alta-barra", "Remada alta com barra", "shoulders", "barbell"],
  ["remada-alta-polia", "Remada alta na polia", "shoulders", "cable"],

  // Bíceps
  ["rosca-direta-barra", "Rosca direta com barra", "biceps", "barbell"],
  ["rosca-direta-barra-w", "Rosca direta com barra W", "biceps", "ez_bar"],
  ["rosca-alternada", "Rosca alternada com halteres", "biceps", "dumbbell"],
  ["rosca-martelo", "Rosca martelo", "biceps", "dumbbell"],
  ["rosca-concentrada", "Rosca concentrada", "biceps", "dumbbell"],
  ["rosca-inclinada", "Rosca inclinada com halteres", "biceps", "dumbbell"],
  ["rosca-scott-barra-w", "Rosca Scott com barra W", "biceps", "ez_bar"],
  ["rosca-scott-maquina", "Rosca Scott na máquina", "biceps", "machine"],
  ["rosca-spider", "Rosca spider", "biceps", "ez_bar"],
  ["rosca-21", "Rosca 21", "biceps", "ez_bar"],
  ["rosca-polia-baixa", "Rosca na polia baixa", "biceps", "cable"],
  ["rosca-polia-alta", "Rosca na polia alta", "biceps", "cable"],
  ["rosca-martelo-corda", "Rosca martelo na corda", "biceps", "cable"],

  // Tríceps
  ["triceps-pulley-barra", "Tríceps pulley com barra", "triceps", "cable"],
  ["triceps-corda", "Tríceps na corda", "triceps", "cable"],
  ["triceps-pulley-invertido", "Tríceps pulley pegada invertida", "triceps", "cable"],
  ["triceps-unilateral-polia", "Tríceps unilateral na polia", "triceps", "cable"],
  ["triceps-testa-barra-w", "Tríceps testa com barra W", "triceps", "ez_bar"],
  ["triceps-testa-halter", "Tríceps testa com halteres", "triceps", "dumbbell"],
  ["triceps-frances-halter", "Tríceps francês com halter", "triceps", "dumbbell"],
  ["triceps-frances-corda", "Tríceps francês na corda", "triceps", "cable"],
  ["triceps-coice-halter", "Tríceps coice com halter", "triceps", "dumbbell"],
  ["triceps-coice-polia", "Tríceps coice na polia", "triceps", "cable"],
  ["triceps-maquina", "Tríceps na máquina", "triceps", "machine"],
  ["supino-fechado", "Supino fechado", "triceps", "barbell"],
  ["mergulho-banco", "Mergulho no banco", "triceps", "bodyweight"],
  ["paralelas-triceps", "Paralelas (foco no tríceps)", "triceps", "bodyweight"],

  // Antebraço
  ["rosca-punho", "Rosca de punho", "forearms", "barbell"],
  ["rosca-punho-inversa", "Rosca de punho inversa", "forearms", "barbell"],
  ["rosca-inversa", "Rosca inversa com barra W", "forearms", "ez_bar"],
  ["caminhada-fazendeiro", "Caminhada do fazendeiro", "forearms", "dumbbell"],

  // Quadríceps
  ["agachamento-livre", "Agachamento livre com barra", "quads", "barbell"],
  ["agachamento-frontal", "Agachamento frontal", "quads", "barbell"],
  ["agachamento-box", "Agachamento no banco (box squat)", "quads", "barbell"],
  ["agachamento-smith", "Agachamento no Smith", "quads", "smith"],
  ["agachamento-goblet", "Agachamento goblet", "quads", "dumbbell"],
  ["agachamento-hack", "Agachamento hack", "quads", "machine"],
  ["agachamento-peso-corporal", "Agachamento com peso corporal", "quads", "bodyweight"],
  ["agachamento-bulgaro", "Agachamento búlgaro", "quads", "dumbbell"],
  ["agachamento-sumo", "Agachamento sumô", "quads", "dumbbell"],
  ["leg-press-45", "Leg press 45°", "quads", "machine"],
  ["leg-press-horizontal", "Leg press horizontal", "quads", "machine"],
  ["leg-press-unilateral", "Leg press unilateral", "quads", "machine"],
  ["cadeira-extensora", "Cadeira extensora", "quads", "machine"],
  ["afundo-halter", "Afundo com halteres", "quads", "dumbbell"],
  ["avanco-caminhando", "Avanço caminhando (passada)", "quads", "dumbbell"],
  ["step-up", "Subida no banco (step-up)", "quads", "dumbbell"],
  ["sissy-squat", "Sissy squat", "quads", "bodyweight"],

  // Posterior de coxa
  ["mesa-flexora", "Mesa flexora", "hamstrings", "machine"],
  ["cadeira-flexora", "Cadeira flexora", "hamstrings", "machine"],
  ["flexora-em-pe", "Flexora em pé (unilateral)", "hamstrings", "machine"],
  ["stiff-barra", "Stiff com barra", "hamstrings", "barbell"],
  ["stiff-halter", "Stiff com halteres", "hamstrings", "dumbbell"],
  ["stiff-unilateral", "Stiff unilateral com halter", "hamstrings", "dumbbell"],
  ["terra-romeno", "Levantamento terra romeno", "hamstrings", "barbell"],
  ["terra-sumo", "Levantamento terra sumô", "hamstrings", "barbell"],
  ["good-morning", "Bom dia (good morning)", "hamstrings", "barbell"],
  ["flexao-nordica", "Flexão nórdica", "hamstrings", "bodyweight"],

  // Glúteos e adutores
  ["elevacao-pelvica-barra", "Elevação pélvica com barra (hip thrust)", "glutes", "barbell"],
  ["elevacao-pelvica-maquina", "Elevação pélvica na máquina", "glutes", "machine"],
  ["elevacao-pelvica-unilateral", "Elevação pélvica unilateral", "glutes", "bodyweight"],
  ["ponte-gluteo", "Ponte de glúteo", "glutes", "bodyweight"],
  ["gluteo-polia", "Glúteo coice na polia", "glutes", "cable"],
  ["gluteo-maquina", "Glúteo coice na máquina", "glutes", "machine"],
  ["gluteo-quatro-apoios", "Glúteo em quatro apoios", "glutes", "bodyweight"],
  ["cadeira-abdutora", "Cadeira abdutora", "glutes", "machine"],
  ["cadeira-adutora", "Cadeira adutora", "glutes", "machine"],
  ["abducao-polia", "Abdução de quadril na polia", "glutes", "cable"],
  ["abducao-elastico", "Abdução com elástico", "glutes", "band"],
  ["kettlebell-swing", "Kettlebell swing", "glutes", "kettlebell"],

  // Panturrilha
  ["panturrilha-em-pe", "Panturrilha em pé", "calves", "machine"],
  ["panturrilha-sentado", "Panturrilha sentado", "calves", "machine"],
  ["panturrilha-leg-press", "Panturrilha no leg press", "calves", "machine"],
  ["panturrilha-smith", "Panturrilha no Smith", "calves", "smith"],
  ["panturrilha-unilateral", "Panturrilha unilateral com halter", "calves", "dumbbell"],

  // Abdômen
  ["abdominal-supra", "Abdominal supra (crunch)", "abs", "bodyweight"],
  ["abdominal-infra", "Abdominal infra", "abs", "bodyweight"],
  ["abdominal-declinado", "Abdominal declinado", "abs", "bodyweight"],
  ["abdominal-obliquo", "Abdominal oblíquo", "abs", "bodyweight"],
  ["abdominal-bicicleta", "Abdominal bicicleta", "abs", "bodyweight"],
  ["abdominal-polia", "Abdominal na polia (ajoelhado)", "abs", "cable"],
  ["abdominal-maquina", "Abdominal na máquina", "abs", "machine"],
  ["abdominal-roda", "Abdominal com roda", "abs", "other"],
  ["elevacao-pernas-barra", "Elevação de pernas na barra fixa", "abs", "bodyweight"],
  ["elevacao-pernas-deitado", "Elevação de pernas deitado", "abs", "bodyweight"],
  ["prancha", "Prancha", "abs", "bodyweight"],
  ["prancha-lateral", "Prancha lateral", "abs", "bodyweight"],
  ["rotacao-russa", "Rotação russa (russian twist)", "abs", "bodyweight"],

  // Cardio
  ["esteira", "Esteira", "cardio", "machine"],
  ["bicicleta-ergometrica", "Bicicleta ergométrica", "cardio", "machine"],
  ["eliptico", "Elíptico (transport)", "cardio", "machine"],
  ["remo-ergometro", "Remo ergômetro", "cardio", "machine"],
  ["escada", "Escada (simulador)", "cardio", "machine"],
  ["pular-corda", "Pular corda", "cardio", "other"],
  ["burpee", "Burpee", "cardio", "bodyweight"],
] as const satisfies readonly Entry[];

export type CatalogExerciseId = (typeof ENTRIES)[number][0];

export const CATALOG: readonly ExerciseInfo[] = ENTRIES.map(([id, name, muscle_group, equipment]) => ({
  id,
  name,
  muscle_group,
  equipment,
}));

/** Lowercase and strip accents, for search. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
