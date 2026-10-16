import type { CatalogExerciseId } from "./exercises";

// Ready-made routine templates. Applying one creates editable routines.
// Exercise ids are type-checked against the catalog.

type TemplateExercise = readonly [
  id: CatalogExerciseId,
  sets: number,
  reps: string,
  restSeconds: number,
];

export interface TemplateRoutine {
  name: string;
  exercises: readonly TemplateExercise[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  daysPerWeek: string;
  level: string;
  routines: readonly TemplateRoutine[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "full-body",
    name: "Full Body",
    description: "Corpo inteiro em cada treino, alternando A e B.",
    daysPerWeek: "2–3 dias",
    level: "Iniciante",
    routines: [
      {
        name: "Full Body A",
        exercises: [
          ["agachamento-livre", 3, "8-10", 120],
          ["supino-reto-barra", 3, "8-10", 120],
          ["remada-curvada-barra", 3, "8-10", 90],
          ["desenvolvimento-halter", 3, "10-12", 90],
          ["rosca-direta-barra", 2, "10-12", 60],
          ["prancha", 3, "30-45s", 60],
        ],
      },
      {
        name: "Full Body B",
        exercises: [
          ["leg-press-45", 3, "10-12", 120],
          ["supino-inclinado-halter", 3, "10-12", 90],
          ["puxada-frente", 3, "10-12", 90],
          ["stiff-barra", 3, "10-12", 90],
          ["elevacao-lateral-halter", 3, "12-15", 60],
          ["triceps-corda", 2, "10-12", 60],
        ],
      },
    ],
  },
  {
    id: "abc",
    name: "ABC",
    description: "A: peito, ombro e tríceps. B: costas e bíceps. C: pernas.",
    daysPerWeek: "3 ou 6 dias",
    level: "Iniciante a intermediário",
    routines: [
      {
        name: "A — Peito, ombro e tríceps",
        exercises: [
          ["supino-reto-barra", 4, "8-10", 120],
          ["supino-inclinado-halter", 3, "10-12", 90],
          ["crucifixo-maquina", 3, "12-15", 60],
          ["desenvolvimento-halter", 3, "10-12", 90],
          ["elevacao-lateral-halter", 3, "12-15", 60],
          ["triceps-corda", 3, "10-12", 60],
          ["triceps-frances-halter", 3, "10-12", 60],
        ],
      },
      {
        name: "B — Costas e bíceps",
        exercises: [
          ["puxada-frente", 4, "8-10", 90],
          ["remada-curvada-barra", 3, "8-10", 90],
          ["remada-baixa-triangulo", 3, "10-12", 90],
          ["pulldown-bracos-estendidos", 3, "12-15", 60],
          ["rosca-direta-barra-w", 3, "10-12", 60],
          ["rosca-martelo", 3, "10-12", 60],
        ],
      },
      {
        name: "C — Pernas",
        exercises: [
          ["agachamento-livre", 4, "8-10", 120],
          ["leg-press-45", 3, "10-12", 120],
          ["cadeira-extensora", 3, "12-15", 60],
          ["mesa-flexora", 3, "10-12", 60],
          ["stiff-barra", 3, "10-12", 90],
          ["panturrilha-em-pe", 4, "12-15", 60],
        ],
      },
    ],
  },
  {
    id: "abcd",
    name: "ABCD",
    description: "A: peito e tríceps. B: costas e bíceps. C: pernas. D: ombros e abdômen.",
    daysPerWeek: "4 dias",
    level: "Intermediário",
    routines: [
      {
        name: "A — Peito e tríceps",
        exercises: [
          ["supino-reto-barra", 4, "6-8", 120],
          ["supino-inclinado-halter", 3, "8-10", 90],
          ["crossover-polia-alta", 3, "12-15", 60],
          ["paralelas-peito", 3, "8-12", 90],
          ["triceps-testa-barra-w", 3, "8-10", 90],
          ["triceps-corda", 3, "10-12", 60],
        ],
      },
      {
        name: "B — Costas e bíceps",
        exercises: [
          ["barra-fixa", 4, "6-10", 120],
          ["remada-curvada-barra", 4, "8-10", 90],
          ["remada-unilateral-halter", 3, "10-12", 60],
          ["puxada-triangulo", 3, "10-12", 60],
          ["rosca-direta-barra", 3, "8-10", 60],
          ["rosca-inclinada", 3, "10-12", 60],
        ],
      },
      {
        name: "C — Pernas",
        exercises: [
          ["agachamento-livre", 4, "6-8", 150],
          ["terra-romeno", 3, "8-10", 120],
          ["leg-press-45", 3, "10-12", 90],
          ["afundo-halter", 3, "10-12", 90],
          ["cadeira-flexora", 3, "10-12", 60],
          ["panturrilha-sentado", 4, "12-15", 60],
        ],
      },
      {
        name: "D — Ombros e abdômen",
        exercises: [
          ["desenvolvimento-barra", 4, "6-8", 120],
          ["elevacao-lateral-halter", 4, "12-15", 60],
          ["crucifixo-inverso-maquina", 3, "12-15", 60],
          ["face-pull", 3, "12-15", 60],
          ["encolhimento-halter", 3, "10-12", 60],
          ["abdominal-polia", 3, "12-15", 60],
          ["elevacao-pernas-barra", 3, "10-12", 60],
        ],
      },
    ],
  },
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    description: "Empurrar, puxar e pernas. Pode repetir a sequência duas vezes na semana.",
    daysPerWeek: "3 ou 6 dias",
    level: "Intermediário a avançado",
    routines: [
      {
        name: "Push — Empurrar",
        exercises: [
          ["supino-reto-barra", 4, "6-8", 150],
          ["desenvolvimento-halter", 3, "8-10", 120],
          ["supino-inclinado-halter", 3, "8-10", 90],
          ["elevacao-lateral-polia", 3, "12-15", 60],
          ["crossover-polia-baixa", 3, "12-15", 60],
          ["triceps-corda", 3, "10-12", 60],
          ["triceps-frances-corda", 3, "10-12", 60],
        ],
      },
      {
        name: "Pull — Puxar",
        exercises: [
          ["levantamento-terra", 3, "5", 180],
          ["barra-fixa", 4, "6-10", 120],
          ["remada-curvada-barra", 3, "8-10", 90],
          ["remada-baixa-triangulo", 3, "10-12", 90],
          ["face-pull", 3, "12-15", 60],
          ["rosca-direta-barra-w", 3, "8-10", 60],
          ["rosca-martelo", 3, "10-12", 60],
        ],
      },
      {
        name: "Legs — Pernas",
        exercises: [
          ["agachamento-livre", 4, "6-8", 180],
          ["terra-romeno", 3, "8-10", 120],
          ["leg-press-45", 3, "10-12", 120],
          ["cadeira-extensora", 3, "12-15", 60],
          ["mesa-flexora", 3, "10-12", 60],
          ["elevacao-pelvica-barra", 3, "8-12", 90],
          ["panturrilha-em-pe", 4, "10-15", 60],
        ],
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    description: "Superiores e inferiores alternados, cada grupo duas vezes na semana.",
    daysPerWeek: "4 dias",
    level: "Intermediário",
    routines: [
      {
        name: "Superior A",
        exercises: [
          ["supino-reto-barra", 4, "6-8", 150],
          ["remada-curvada-barra", 4, "6-8", 120],
          ["desenvolvimento-halter", 3, "8-10", 90],
          ["puxada-frente", 3, "8-10", 90],
          ["rosca-direta-barra", 2, "10-12", 60],
          ["triceps-pulley-barra", 2, "10-12", 60],
        ],
      },
      {
        name: "Inferior A",
        exercises: [
          ["agachamento-livre", 4, "6-8", 180],
          ["terra-romeno", 3, "8-10", 120],
          ["leg-press-45", 3, "10-12", 90],
          ["mesa-flexora", 3, "10-12", 60],
          ["panturrilha-em-pe", 4, "10-15", 60],
          ["prancha", 3, "30-60s", 60],
        ],
      },
      {
        name: "Superior B",
        exercises: [
          ["desenvolvimento-barra", 4, "6-8", 150],
          ["barra-fixa", 4, "6-10", 120],
          ["supino-inclinado-halter", 3, "8-10", 90],
          ["remada-unilateral-halter", 3, "8-10", 90],
          ["elevacao-lateral-halter", 3, "12-15", 60],
          ["rosca-martelo", 2, "10-12", 60],
          ["triceps-corda", 2, "10-12", 60],
        ],
      },
      {
        name: "Inferior B",
        exercises: [
          ["levantamento-terra", 3, "5", 180],
          ["agachamento-bulgaro", 3, "8-10", 90],
          ["cadeira-extensora", 3, "12-15", 60],
          ["cadeira-flexora", 3, "10-12", 60],
          ["elevacao-pelvica-barra", 3, "8-12", 90],
          ["panturrilha-sentado", 4, "12-15", 60],
        ],
      },
    ],
  },
];
