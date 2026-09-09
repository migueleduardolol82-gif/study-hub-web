import { exerciseKinds, type ExerciseKind, type LearningExercise, type LearningPath, type ThemeDifficulty } from "./learning.ts";
import { isRecord } from "./safe-json.ts";

const string = { type: "string" };
const difficulty = { type: "string", enum: ["iniciante", "intermediario", "avancado"] };
export const outlineSchema = {
  type: "object", additionalProperties: false, required: ["title", "units"],
  properties: { title: string, units: { type: "array", minItems: 3, maxItems: 5, items: {
    type: "object", additionalProperties: false, required: ["title", "description", "lessons"],
    properties: { title: string, description: string, lessons: { type: "array", minItems: 2, maxItems: 4, items: {
      type: "object", additionalProperties: false, required: ["title", "description", "difficulty"],
      properties: { title: string, description: string, difficulty },
    } } },
  } } },
};

export const lessonContentSchema = {
  type: "object", additionalProperties: false, required: ["studyNotes", "exercises"],
  properties: { studyNotes: string, exercises: { type: "array", minItems: 4, maxItems: 6, items: {
    type: "object", additionalProperties: false, required: ["type", "prompt", "options", "answer", "explanation"],
    properties: { type: { type: "string", enum: exerciseKinds }, prompt: string, options: { type: "array", items: string, maxItems: 8 }, answer: string, explanation: string },
  } } },
};

function field(record: Record<string, unknown>, name: string, max = 2000) {
  const value = record[name];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Campo inválido: ${name}`);
  return value.trim();
}

export function validateOutline(value: unknown): LearningPath {
  if (!isRecord(value) || !Array.isArray(value.units) || value.units.length < 3 || value.units.length > 5) throw new Error("Unidades inválidas.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return { id: `path-${id}`, title: field(value, "title", 300), createdAt: now, updatedAt: now, units: value.units.map((unit, u) => {
    if (!isRecord(unit) || !Array.isArray(unit.lessons) || unit.lessons.length < 2 || unit.lessons.length > 4) throw new Error("Lições inválidas.");
    return { id: `unit-${id}-${u}`, title: field(unit, "title", 200), description: field(unit, "description"), lessons: unit.lessons.map((lesson, l) => {
      if (!isRecord(lesson) || !difficulty.enum.includes(String(lesson.difficulty))) throw new Error("Dificuldade inválida.");
      return { id: `lesson-${id}-${u}-${l}`, title: field(lesson, "title", 200), description: field(lesson, "description"), difficulty: lesson.difficulty as ThemeDifficulty, xp: 60, exercises: [] };
    }) };
  }) };
}

export function validateLessonContent(value: unknown): { studyNotes: string; exercises: LearningExercise[] } {
  if (!isRecord(value) || !Array.isArray(value.exercises) || value.exercises.length < 4 || value.exercises.length > 6) throw new Error("Quantidade de exercícios inválida.");
  const exercises = value.exercises.map((exercise) => {
    if (!isRecord(exercise) || !exerciseKinds.includes(exercise.type as ExerciseKind) || !Array.isArray(exercise.options) || exercise.options.length > 8) throw new Error("Exercício inválido.");
    const type = exercise.type as ExerciseKind;
    const options = exercise.options.map((option) => { if (typeof option !== "string" || !option.trim()) throw new Error("Alternativa vazia."); return option.trim(); });
    if (new Set(options).size !== options.length) throw new Error("Alternativas duplicadas.");
    const answer = field(exercise, "answer");
    if (type === "multiple_choice" && options.length !== 4) throw new Error("Questão precisa de quatro alternativas.");
    if (type === "true_false" && (options.length !== 2 || !options.includes("Verdadeiro") || !options.includes("Falso"))) throw new Error("Verdadeiro/falso inválido.");
    if (options.length && !["ordering", "matching"].includes(type) && !options.includes(answer)) throw new Error("Resposta ausente das alternativas.");
    if (type === "ordering") {
      const steps = answer.split("|").map((step) => step.trim());
      if (options.length < 3 || steps.length !== options.length || new Set(steps).size !== options.length || steps.some((step) => !options.includes(step))) throw new Error("Ordem inválida.");
    }
    if (type === "matching") {
      const pairs = answer.split("|").map((pair) => pair.split("=>").map((part) => part.trim()));
      if (options.length !== 0 || pairs.length < 3 || pairs.length > 5 || pairs.some((pair) => pair.length !== 2 || !pair[0] || !pair[1]) || new Set(pairs.map((p) => p[0])).size !== pairs.length || new Set(pairs.map((p) => p[1])).size !== pairs.length) throw new Error("Pares inválidos.");
    }
    return { id: `exercise-${crypto.randomUUID()}`, type, options, answer, prompt: field(exercise, "prompt"), explanation: field(exercise, "explanation", 3000) };
  });
  return { studyNotes: field(value, "studyNotes", 6000), exercises };
}
