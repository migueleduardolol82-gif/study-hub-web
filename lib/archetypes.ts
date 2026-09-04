import type { SkillLevels } from "@/lib/assessment";
import { isRecord } from "@/lib/safe-json";

export type GeneratedArchetype = {
  id: string;
  name: string;
  subtitle: string;
  area: string;
  fitScore: number;
  horizon: string;
  rationale: string;
  successPattern: string;
  caseModels: { name: string; lesson: string }[];
  requirements: SkillLevels;
  milestones: string[];
  phases: { period: string; name: string; actions: string[] }[];
  dailyProtocol: string[];
  weeklyPath: { day: string; focus: string; actions: string[] }[];
};

export const archetypeResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "archetypes"],
  properties: {
    summary: { type: "string" },
    archetypes: {
      type: "array",
      minItems: 6,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "subtitle", "area", "fitScore", "horizon", "rationale", "successPattern", "caseModels", "requirements", "milestones", "phases", "dailyProtocol", "weeklyPath"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          subtitle: { type: "string" },
          area: { type: "string" },
          fitScore: { type: "integer", minimum: 0, maximum: 100 },
          horizon: { type: "string" },
          rationale: { type: "string" },
          successPattern: { type: "string" },
          caseModels: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "lesson"],
              properties: { name: { type: "string" }, lesson: { type: "string" } },
            },
          },
          requirements: {
            type: "object",
            additionalProperties: false,
            required: ["body", "knowledge", "discipline", "communication", "capital", "leadership"],
            properties: {
              body: { type: "integer", minimum: 20, maximum: 95 },
              knowledge: { type: "integer", minimum: 20, maximum: 95 },
              discipline: { type: "integer", minimum: 20, maximum: 95 },
              communication: { type: "integer", minimum: 20, maximum: 95 },
              capital: { type: "integer", minimum: 20, maximum: 95 },
              leadership: { type: "integer", minimum: 20, maximum: 95 },
            },
          },
          milestones: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } },
          phases: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["period", "name", "actions"],
              properties: {
                period: { type: "string" },
                name: { type: "string" },
                actions: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
              },
            },
          },
          dailyProtocol: { type: "array", minItems: 4, maxItems: 5, items: { type: "string" } },
          weeklyPath: {
            type: "array",
            minItems: 7,
            maxItems: 7,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["day", "focus", "actions"],
              properties: {
                day: { type: "string" },
                focus: { type: "string" },
                actions: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type ArchetypeResponse = { summary: string; archetypes: GeneratedArchetype[] };

function stringArray(value: unknown, minimum: number, maximum: number, field: string) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Campo inválido: ${field}.`);
  }
  return value.map((item) => String(item).trim());
}

export function validateArchetypeResponse(value: unknown): ArchetypeResponse {
  if (!isRecord(value) || typeof value.summary !== "string" || !Array.isArray(value.archetypes)) {
    throw new Error("Estrutura principal de arquétipos inválida.");
  }
  if (value.archetypes.length < 6 || value.archetypes.length > 8) {
    throw new Error("A IA precisa devolver de 6 a 8 arquétipos.");
  }

  const skills = ["body", "knowledge", "discipline", "communication", "capital", "leadership"] as const;
  const archetypes = value.archetypes.map((item, index): GeneratedArchetype => {
    if (!isRecord(item)) throw new Error(`Arquétipo ${index + 1} inválido.`);
    for (const field of ["id", "name", "subtitle", "area", "horizon", "rationale", "successPattern"] as const) {
      if (typeof item[field] !== "string" || !item[field].trim()) throw new Error(`Campo inválido: archetypes.${index}.${field}.`);
    }
    if (!Number.isInteger(item.fitScore) || Number(item.fitScore) < 0 || Number(item.fitScore) > 100) {
      throw new Error(`Pontuação inválida no arquétipo ${index + 1}.`);
    }
    if (!isRecord(item.requirements)) throw new Error(`Requisitos inválidos no arquétipo ${index + 1}.`);
    const requirements = {} as SkillLevels;
    for (const skill of skills) {
      const score = item.requirements[skill];
      if (!Number.isInteger(score) || Number(score) < 20 || Number(score) > 95) throw new Error(`Requisito inválido: ${skill}.`);
      requirements[skill] = Number(score);
    }
    if (!Array.isArray(item.caseModels) || item.caseModels.length < 2 || item.caseModels.length > 3) throw new Error("Casos-modelo inválidos.");
    const caseModels = item.caseModels.map((model) => {
      if (!isRecord(model) || typeof model.name !== "string" || typeof model.lesson !== "string" || !model.name.trim() || !model.lesson.trim()) {
        throw new Error("Caso-modelo inválido.");
      }
      return { name: model.name.trim(), lesson: model.lesson.trim() };
    });
    if (!Array.isArray(item.phases) || item.phases.length !== 4) throw new Error("Fases do arquétipo inválidas.");
    const phases = item.phases.map((phase) => {
      if (!isRecord(phase) || typeof phase.period !== "string" || typeof phase.name !== "string") throw new Error("Fase inválida.");
      return { period: phase.period.trim(), name: phase.name.trim(), actions: stringArray(phase.actions, 3, 4, "phases.actions") };
    });
    if (!Array.isArray(item.weeklyPath) || item.weeklyPath.length !== 7) throw new Error("Plano semanal inválido.");
    const weeklyPath = item.weeklyPath.map((day) => {
      if (!isRecord(day) || typeof day.day !== "string" || typeof day.focus !== "string") throw new Error("Dia do plano semanal inválido.");
      return { day: day.day.trim(), focus: day.focus.trim(), actions: stringArray(day.actions, 2, 3, "weeklyPath.actions") };
    });
    return {
      id: String(item.id).trim(), name: String(item.name).trim(), subtitle: String(item.subtitle).trim(), area: String(item.area).trim(),
      fitScore: Number(item.fitScore), horizon: String(item.horizon).trim(), rationale: String(item.rationale).trim(),
      successPattern: String(item.successPattern).trim(), caseModels, requirements,
      milestones: stringArray(item.milestones, 4, 6, "milestones"), phases,
      dailyProtocol: stringArray(item.dailyProtocol, 4, 5, "dailyProtocol"), weeklyPath,
    };
  });
  return { summary: value.summary.trim(), archetypes };
}
