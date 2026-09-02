import type { SkillLevels } from "@/lib/assessment";

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
