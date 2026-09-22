import { emptyPathProgress, type LearningConcept, type LearningExercise, type LearningLesson, type LearningPath, type PathProgress } from "./learning.ts";
import type { SemanticGrade } from "./semantic-grading.ts";

export const reviewModes = ["estudar", "memorizar", "flashcards", "revisao", "speed", "hard", "dominio", "desafio"] as const;
export type ReviewMode = typeof reviewModes[number];
export const modeLabels: Record<ReviewMode, string> = { estudar: "Estudar", memorizar: "Memorizar", flashcards: "Flashcards", revisao: "Revisão", speed: "Speed Run", hard: "Hard Mode", dominio: "Domínio", desafio: "Desafio" };
export type ReviewItem = { lessonId: string; exerciseId: string; optionOrder: number[] };
export type ReviewAttempt = { id: string; sessionId: string; exerciseId: string; lessonId: string; concept: string; mode: ReviewMode; selected: string; selectedOptionId?: string; grade: SemanticGrade; answeredAt: string; elapsedMs: number };
export type ReviewSession = {
  id: string; mode: ReviewMode; scope: string; items: ReviewItem[]; index: number;
  draft: string; revealed: boolean; taught: boolean; answers: ReviewAttempt[]; skipped: string[];
  startedAt: string; deadline?: number; remainingSeconds?: number; finished: boolean;
};
export function shuffle<T>(values: T[], random = Math.random): T[] {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
export function conceptKey(lesson: LearningLesson, exercise: LearningExercise) {
  return `${lesson.id}:${(exercise.concept || lesson.title).trim().toLocaleLowerCase("pt-BR")}`;
}
export function bank(path: LearningPath) { return path.units.flatMap(unit => unit.lessons.flatMap(lesson => lesson.exercises.map(exercise => ({ unit, lesson, exercise })))); }
export function syncKnowledgeBase(path: LearningPath, now = new Date().toISOString()): LearningPath {
  const previous = new Map((path.knowledgeBase?.concepts || []).map(concept => [`${concept.unitId}:${concept.topic}:${concept.title}`.toLocaleLowerCase("pt-BR"), concept]));
  const concepts = new Map<string, LearningConcept>();
  for (const unit of path.units) for (const lesson of unit.lessons) {
    const declared = lesson.keyConcepts?.length ? lesson.keyConcepts : unit.concepts?.length ? unit.concepts : [lesson.title];
    for (const title of declared) {
      const key = `${unit.id}:${lesson.title}:${title}`.toLocaleLowerCase("pt-BR");
      const old = previous.get(key);
      concepts.set(key, { id: old?.id || `concept-${crypto.randomUUID()}`, unitId: unit.id, topic: lesson.title, title, essentialCriteria: old?.essentialCriteria || [], exerciseIds: old?.exerciseIds || [], flashcardIds: old?.flashcardIds || [], sourceReferences: old?.sourceReferences || [] });
    }
    for (const exercise of lesson.exercises) {
      const title = exercise.concept || lesson.title;
      const key = `${unit.id}:${lesson.title}:${title}`.toLocaleLowerCase("pt-BR");
      const old = concepts.get(key) || previous.get(key);
      const criteria = [...new Set([...(old?.essentialCriteria || []), ...(exercise.essentialCriteria || [])])];
      const references = [...new Set([...(old?.sourceReferences || []), ...(exercise.sourceReference ? [exercise.sourceReference] : [])])];
      concepts.set(key, { id: old?.id || `concept-${crypto.randomUUID()}`, unitId: unit.id, topic: lesson.title, title, essentialCriteria: criteria, exerciseIds: [...new Set([...(old?.exerciseIds || []), exercise.id])], flashcardIds: [...new Set([...(old?.flashcardIds || []), ...(exercise.type === "flashcard" ? [exercise.id] : [])])], sourceReferences: references });
    }
  }
  return { ...path, knowledgeBase: { version: 1, concepts: [...concepts.values()], updatedAt: now } };
}
export function mergeQuestionBank(existing: LearningExercise[], incoming: LearningExercise[]) {
  const key = (exercise: LearningExercise) => exercise.prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const seen = new Set(existing.map(key));
  return [...existing, ...incoming.filter(exercise => { const k = key(exercise); if (seen.has(k)) return false; seen.add(k); return true; })];
}
export function chooseItems(path: LearningPath, progress: PathProgress, mode: ReviewMode, scope = "all", now = Date.now()) {
  const history = progress.reviewHistory || [];
  const latest = new Map<string, ReviewAttempt>();
  const counts = new Map<string, number>();
  history.forEach(a => { latest.set(a.exerciseId, a); counts.set(a.exerciseId, (counts.get(a.exerciseId) || 0) + 1); });
  const lessons = path.units.flatMap(u => u.lessons);
  const unlocked = new Set(lessons.filter((lesson, i) => path.cardProduction || path.unlockAll || !i || progress.completedLessonIds.includes(lesson.id) || progress.completedLessonIds.includes(lessons[i - 1].id)).map(l => l.id));
  let source = bank(path).filter(({ unit, lesson, exercise }) => unlocked.has(lesson.id) && (["all", "errors", "weak", "today"].includes(scope) || scope === unit.id || scope === lesson.id || scope === conceptKey(lesson, exercise)));
  const last = (id: string) => latest.get(id);
  const legacyErrors = new Set(Object.values(progress.lessonResults).flatMap(r => r.wrongExerciseIds));
  if (scope === "errors") source = source.filter(({ exercise }) => legacyErrors.has(exercise.id) || last(exercise.id)?.grade.correct === false);
  if (scope === "weak") source = source.filter(({ lesson, exercise }) => (progress.conceptMastery?.[conceptKey(lesson, exercise)]?.mastery || 0) < 60);
  if (scope === "today") source = source.filter(({ lesson, exercise }) => { const mastery = progress.conceptMastery?.[conceptKey(lesson, exercise)]; return Boolean(mastery && Date.parse(mastery.dueAt) <= now); });
  let chosen = source.filter(({ lesson, exercise }) => {
    if (mode === "hard") return exercise.difficulty === "avancado" && ["case_study", "calculation", "open_question", "error_identification", "cumulative_review", "multiple_choice"].includes(exercise.type);
    if (mode === "speed") return exercise.options.length > 0 && !["matching", "ordering"].includes(exercise.type);
    if (mode === "revisao") {
      const attempt = last(exercise.id);
      const concept = progress.conceptMastery?.[conceptKey(lesson, exercise)];
      const studied = Boolean(attempt || progress.lessonResults[lesson.id]?.answers?.[exercise.id]);
      return legacyErrors.has(exercise.id) && (progress.mastery?.[exercise.id] || 0) < 2 || studied && (!attempt?.grade.correct || Boolean(concept && Date.parse(concept.dueAt) <= now));
    }
    return true;
  });
  if (mode !== "estudar") chosen = shuffle(chosen);
  chosen.sort((a, b) => {
    if (["revisao", "memorizar"].includes(mode)) {
      const urgency = (row: typeof a) => { const c = progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]; return c ? c.correct / Math.max(1, c.answered) + (Date.parse(c.dueAt) > now ? 2 : 0) : 1; };
      return urgency(a) - urgency(b);
    }
    if (["dominio", "hard", "estudar"].includes(mode)) return (counts.get(a.exercise.id) || 0) - (counts.get(b.exercise.id) || 0);
    return 0;
  });
  return chosen.map(({ lesson, exercise }) => ({ lessonId: lesson.id, exerciseId: exercise.id, optionOrder: shuffle(exercise.options.map((_, i) => i)) }));
}
export function newReviewSession(path: LearningPath, progress: PathProgress, mode: ReviewMode, scope: string, now = Date.now(), speedSeconds = 60): ReviewSession {
  return { id: crypto.randomUUID(), mode, scope, items: chooseItems(path, progress, mode, scope, now), index: 0, draft: "", revealed: false, taught: false, answers: [], skipped: [], startedAt: new Date(now).toISOString(), ...(mode === "speed" ? { deadline: now + Math.max(30, Math.min(300, speedSeconds)) * 1000 } : {}), finished: false };
}
export function sessionStats(session: ReviewSession) {
  let streak = 0, bestStreak = 0, points = 0;
  for (const a of session.answers) { streak = a.grade.correct ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak); if (a.grade.correct) points += 100 + (session.mode === "speed" ? Math.max(0, 50 - Math.floor(a.elapsedMs / 200)) : 0); }
  const answered = session.answers.length, correct = session.answers.filter(a => a.grade.correct).length;
  return { answered, correct, wrong: answered - correct, accuracy: answered ? Math.round(correct / answered * 100) : 0, bestStreak, points, unanswered: session.items.length - answered };
}
export function sessionXp(session: ReviewSession) {
  const stats = sessionStats(session);
  const multiplier = session.mode === "dominio" ? 1.5 : session.mode === "hard" ? 1.3 : session.mode === "speed" ? 1.15 : 1;
  return Math.round(stats.correct * 10 * multiplier);
}
// Pure, idempotent reducer. Skips and interrupted correction calls never reach this function.
export function recordAttempt(progress: PathProgress, attempt: ReviewAttempt): PathProgress {
  if (progress.reviewHistory?.some(a => a.id === attempt.id)) return progress;
  const old = progress.conceptMastery?.[attempt.concept] || { correct: 0, answered: 0, streak: 0, dueAt: attempt.answeredAt, mastery: 0 };
  const streak = attempt.grade.correct ? old.streak + 1 : 0;
  const intervalDays = attempt.grade.correct ? Math.min(60, 2 ** Math.min(streak - 1, 6)) : 0;
  const dueAt = new Date(Date.parse(attempt.answeredAt) + (intervalDays ? intervalDays * 86400000 : 600000)).toISOString();
  const previous = progress.lessonResults[attempt.lessonId];
  const answers = { ...previous?.answers, [attempt.exerciseId]: { selected: attempt.selected, correct: attempt.grade.referenceAnswer, wasCorrect: attempt.grade.correct } };
  const wrong = new Set(previous?.wrongExerciseIds || []);
  if (!attempt.grade.correct) wrong.add(attempt.exerciseId);
  const mastery = { ...progress.mastery, [attempt.exerciseId]: attempt.grade.correct ? (progress.mastery?.[attempt.exerciseId] || 0) + 1 : 0 };
  if ((mastery[attempt.exerciseId] || 0) >= 2) wrong.delete(attempt.exerciseId);
  const history = [...(progress.reviewHistory || []), attempt];
  const related = history.filter(item => item.concept === attempt.concept).slice(-12);
  const weighted = related.reduce((sum, item) => sum + Number(item.grade.correct) * (item.mode === "dominio" ? 1.5 : item.mode === "hard" ? 1.3 : 1), 0);
  const possible = related.reduce((sum, item) => sum + (item.mode === "dominio" ? 1.5 : item.mode === "hard" ? 1.3 : 1), 0);
  const confidence = Math.min(1, related.length / 5);
  const masteryScore = Math.round((possible ? weighted / possible : 0) * (0.4 + 0.6 * confidence) * 100);
  return { ...progress, mastery, reviewHistory: history, conceptMastery: { ...progress.conceptMastery, [attempt.concept]: { correct: old.correct + Number(attempt.grade.correct), answered: old.answered + 1, streak, dueAt, lastReviewedAt: attempt.answeredAt, mastery: masteryScore } }, lessonResults: { ...progress.lessonResults, [attempt.lessonId]: { correct: previous?.correct || 0, total: previous?.total || 0, completedAt: previous?.completedAt || "", answers, wrongExerciseIds: [...wrong] } } };
}
export function completeSession(progress: PathProgress = emptyPathProgress, session: ReviewSession, path: LearningPath): PathProgress {
  if (progress.reviewSession?.id === session.id && progress.reviewSession.finished) return progress;
  const stats = sessionStats(session);
  const completed = new Set(progress.completedLessonIds);
  const results = { ...progress.lessonResults };
  let extraXp = 0;
  for (const lesson of path.units.flatMap(u => u.lessons)) {
    const answered = session.answers.filter(a => a.lessonId === lesson.id);
    if (!answered.length) continue;
    const correct = answered.filter(a => a.grade.correct).length;
    if (session.mode !== "speed" && lesson.exercises.length && lesson.exercises.every(e => answered.some(a => a.exerciseId === e.id)) && correct / lesson.exercises.length >= .7) {
      if (!completed.has(lesson.id)) extraXp += lesson.xp;
      completed.add(lesson.id);
      results[lesson.id] = { ...results[lesson.id], correct: Math.max(results[lesson.id]?.correct || 0, correct), total: lesson.exercises.length, completedAt: new Date().toISOString(), wrongExerciseIds: results[lesson.id]?.wrongExerciseIds || [] };
    }
  }
  const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return { ...progress, xp: progress.xp + extraXp + sessionXp(session), completedLessonIds: [...completed], lessonResults: results,
    streak: !stats.answered || progress.lastStudyDate === today ? progress.streak : progress.lastStudyDate === yesterday ? progress.streak + 1 : 1,
    lastStudyDate: stats.answered ? today : progress.lastStudyDate,
    achievements: stats.answered ? [...new Set([...progress.achievements, "Primeira sessão"])] : progress.achievements,
    speedRecords: session.mode === "speed" ? { ...progress.speedRecords, [session.scope]: Math.max(stats.points, progress.speedRecords?.[session.scope] || 0) } : progress.speedRecords,
    reviewSession: { ...session, finished: true } };
}
