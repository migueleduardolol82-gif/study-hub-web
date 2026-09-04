import { isRecord } from "@/lib/safe-json";

export type TopicStatus = "planned" | "covered" | "partial" | "gap";
export type TopicPriority = "high" | "medium" | "low";

export type LearningTopic = {
  id?: string;
  parentId?: string;
  title: string;
  module?: string;
  priority?: TopicPriority;
  status: TopicStatus;
  confidence: number;
  videoEvidence: string;
  syllabusReference: string;
  action: string;
};

export type ContentMapping = {
  summary: string;
  coverage: number;
  topics: LearningTopic[];
  nextSteps: string[];
};

export type ThemeDifficulty = "iniciante" | "intermediario" | "avancado";
export type ThemeRecord = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  imageUrl?: string;
  category: string;
  difficulty: ThemeDifficulty;
  objective: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  mapIds: string[];
};

export type StudyMapStatus = "active" | "paused" | "completed" | "archived";
export type StudyMapRecord = {
  id: string;
  name: string;
  description: string;
  objective: string;
  deadline?: string;
  status: StudyMapStatus;
  isPrimary: boolean;
  themeIds: string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  mapping: ContentMapping;
};

export const exerciseKinds = [
  "multiple_choice", "true_false", "fill_blank", "matching", "ordering",
  "flashcard", "typed", "case_study", "ai_question", "error_review", "mock_exam",
] as const;
export type ExerciseKind = (typeof exerciseKinds)[number];

export type LearningExercise = {
  id: string;
  type: ExerciseKind;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type LearningLesson = {
  id: string;
  title: string;
  description: string;
  difficulty: ThemeDifficulty;
  xp: number;
  exercises: LearningExercise[];
};

export type LearningUnit = {
  id: string;
  title: string;
  description: string;
  lessons: LearningLesson[];
};

export type LearningPath = {
  id: string;
  title: string;
  themeId?: string;
  mapId?: string;
  createdAt: string;
  updatedAt: string;
  units: LearningUnit[];
};

export type LessonResult = { correct: number; total: number; wrongExerciseIds: string[]; completedAt: string };
export type PathProgress = {
  xp: number;
  streak: number;
  lastStudyDate: string;
  completedLessonIds: string[];
  lessonResults: Record<string, LessonResult>;
  achievements: string[];
};

export const emptyPathProgress: PathProgress = {
  xp: 0,
  streak: 0,
  lastStudyDate: "",
  completedLessonIds: [],
  lessonResults: {},
  achievements: [],
};

export const curriculumSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "units"],
  properties: {
    title: { type: "string" },
    units: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["title", "description", "lessons"],
        properties: {
          title: { type: "string" }, description: { type: "string" },
          lessons: {
            type: "array", minItems: 2, maxItems: 4,
            items: {
              type: "object", additionalProperties: false,
              required: ["title", "description", "difficulty", "xp", "exercises"],
              properties: {
                title: { type: "string" }, description: { type: "string" },
                difficulty: { type: "string", enum: ["iniciante", "intermediario", "avancado"] },
                xp: { type: "integer", minimum: 20, maximum: 100 },
                exercises: {
                  type: "array", minItems: 4, maxItems: 6,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["type", "prompt", "options", "answer", "explanation"],
                    properties: {
                      type: { type: "string", enum: exerciseKinds }, prompt: { type: "string" },
                      options: { type: "array", items: { type: "string" }, maxItems: 8 },
                      answer: { type: "string" }, explanation: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

function requiredString(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== "string" || !record[key].trim()) throw new Error(`Campo inválido: ${key}.`);
  return record[key].trim();
}

export function validateCurriculum(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.units) || value.units.length < 3 || value.units.length > 5) throw new Error("Estrutura de unidades inválida.");
  const units = value.units.map((unit) => {
    if (!isRecord(unit) || !Array.isArray(unit.lessons) || unit.lessons.length < 2 || unit.lessons.length > 4) throw new Error("Estrutura de lições inválida.");
    return {
      title: requiredString(unit, "title"), description: requiredString(unit, "description"),
      lessons: unit.lessons.map((lesson) => {
        if (!isRecord(lesson) || !Array.isArray(lesson.exercises) || lesson.exercises.length < 4 || lesson.exercises.length > 6) throw new Error("Estrutura de exercícios inválida.");
        const difficulty = requiredString(lesson, "difficulty") as ThemeDifficulty;
        if (!["iniciante", "intermediario", "avancado"].includes(difficulty)) throw new Error("Dificuldade inválida.");
        const xp = Number(lesson.xp);
        if (!Number.isInteger(xp) || xp < 20 || xp > 100) throw new Error("XP da lição inválido.");
        return {
          title: requiredString(lesson, "title"), description: requiredString(lesson, "description"), difficulty, xp,
          exercises: lesson.exercises.map((exercise) => {
            if (!isRecord(exercise) || !exerciseKinds.includes(exercise.type as ExerciseKind) || !Array.isArray(exercise.options) || exercise.options.some((option) => typeof option !== "string")) throw new Error("Exercício inválido.");
            return { type: exercise.type as ExerciseKind, prompt: requiredString(exercise, "prompt"), options: exercise.options as string[], answer: requiredString(exercise, "answer"), explanation: requiredString(exercise, "explanation") };
          }),
        };
      }),
    };
  });
  return { title: requiredString(value, "title"), units };
}

export function attachCurriculumIds(value: ReturnType<typeof validateCurriculum>, prefix = Date.now().toString(36)): LearningPath {
  return {
    id: `path-${prefix}`, title: value.title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    units: value.units.map((unit, unitIndex) => ({
      ...unit, id: `unit-${prefix}-${unitIndex}`,
      lessons: unit.lessons.map((lesson, lessonIndex) => ({
        ...lesson, id: `lesson-${prefix}-${unitIndex}-${lessonIndex}`,
        exercises: lesson.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `exercise-${prefix}-${unitIndex}-${lessonIndex}-${exerciseIndex}` })),
      })),
    })),
  };
}
