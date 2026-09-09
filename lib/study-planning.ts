import { isRecord } from "./safe-json.ts";

export const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export type PlanStep = { title: string; study: string; practice: string; review: string; difficulty: "easy" | "medium" | "hard" };
export type PlanBlueprint = { summary: string; steps: PlanStep[] };
const text = { type: "string" };
export const planBlueprintSchema = { type: "object", additionalProperties: false, required: ["summary", "steps"], properties: {
  summary: text, steps: { type: "array", minItems: 4, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["title", "study", "practice", "review", "difficulty"], properties: { title: text, study: text, practice: text, review: text, difficulty: { type: "string", enum: ["easy", "medium", "hard"] } } } },
} };

export function validatePlanBlueprint(value: unknown): PlanBlueprint {
  if (!isRecord(value) || typeof value.summary !== "string" || !value.summary.trim() || !Array.isArray(value.steps) || value.steps.length < 4 || value.steps.length > 10) throw new Error("Estrutura do plano inválida.");
  const steps = value.steps.map((step) => {
    if (!isRecord(step) || ["title", "study", "practice", "review"].some((field) => typeof step[field] !== "string" || !(step[field] as string).trim()) || !["easy", "medium", "hard"].includes(String(step.difficulty))) throw new Error("Etapa do plano inválida.");
    return { title: String(step.title).trim(), study: String(step.study).trim(), practice: String(step.practice).trim(), review: String(step.review).trim(), difficulty: step.difficulty as PlanStep["difficulty"] };
  });
  return { summary: value.summary.trim(), steps };
}

export function validMinutes(value: number) { return Number.isInteger(value) && value >= 1 && value <= 1440; }

export function buildStudySchedule({ steps, weeks, days, minutes, dayMinutes, prefix }: {
  steps: PlanStep[]; weeks: number; days: number; minutes: number; dayMinutes?: number[]; prefix: string;
}) {
  if (!steps.length || !Number.isInteger(weeks) || weeks < 1 || weeks > 52 || !Number.isInteger(days) || days < 1 || days > 7 || !validMinutes(minutes) || (dayMinutes && (dayMinutes.length < days || dayMinutes.slice(0, days).some((time) => !validMinutes(time))))) throw new Error("Informe durações entre 1 e 1440 minutos e um prazo válido.");
  const count = weeks * days;
  return Array.from({ length: weeks }, (_, week) => ({ week: week + 1, theme: steps[Math.min(steps.length - 1, Math.floor(week * days / count * steps.length))].title, sessions: Array.from({ length: days }, (_, day) => {
    const index = week * days + day;
    const stepIndex = Math.min(steps.length - 1, Math.floor(index / count * steps.length));
    const isReview = index > 0 && index % 4 === 3;
    const step = steps[isReview ? Math.max(0, stepIndex - 1) : stepIndex];
    const category = isReview ? "revision" as const : index % 2 === 1 ? "exercise" as const : "study" as const;
    const duration = dayMinutes?.[day] ?? minutes;
    return { id: `${prefix}-${week}-${day}`, day: weekdays[day], topic: step.title, activity: category === "revision" ? step.review : category === "exercise" ? step.practice : step.study, minutes: duration, done: false, category, difficulty: step.difficulty, xp: duration * 3, recurrence: "weekly" as const };
  }) }));
}
