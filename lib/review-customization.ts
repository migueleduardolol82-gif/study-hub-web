import type { LearningExercise, PathProgress } from "./learning.ts";

export type CardEdit = { prompt: string; answer: string; explanation: string; essentialCriteria: string[] };
export function updateCardEdit(progress: PathProgress, exerciseId: string, edit: CardEdit | null): PathProgress {
  const cardEdits = { ...progress.cardEdits };
  if (!edit) delete cardEdits[exerciseId];
  else {
    const clean = { prompt: edit.prompt.trim(), answer: edit.answer.trim(), explanation: edit.explanation.trim(), essentialCriteria: edit.essentialCriteria.map(point => point.trim()).filter(Boolean) };
    if (!clean.prompt || clean.prompt.length > 1200 || !clean.answer || clean.answer.length > 3000 || clean.explanation.length > 3000 || !clean.essentialCriteria.length || clean.essentialCriteria.length > 12 || clean.essentialCriteria.some(point => point.length > 1000)) throw new Error("Preencha pergunta, resposta e de 1 a 12 pontos essenciais dentro dos limites indicados.");
    cardEdits[exerciseId] = clean;
  }
  return { ...progress, cardEdits };
}
export function customizedExercise(exercise: LearningExercise, progress: PathProgress): LearningExercise {
  const edit = progress.cardEdits?.[exercise.id];
  if (!edit || exercise.type !== "flashcard") return exercise;
  return { ...exercise, ...edit, teaching: edit.explanation || edit.answer, sourceReference: `Edição pessoal · fonte original: ${exercise.sourceReference || "não informada"}` };
}
export function toggleFavorite(progress: PathProgress, exerciseId: string): PathProgress {
  const ids = new Set(progress.favoriteExerciseIds || []);
  if (!ids.delete(exerciseId)) ids.add(exerciseId);
  return { ...progress, favoriteExerciseIds: [...ids] };
}
