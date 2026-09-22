import { test } from "node:test";
import assert from "node:assert/strict";
import { customizedExercise, toggleFavorite, updateCardEdit } from "../lib/review-customization.ts";
import { emptyPathProgress, type LearningExercise, type LearningPath } from "../lib/learning.ts";
import { chooseItems } from "../lib/review-engine.ts";

const card: LearningExercise = { id: "c1", type: "flashcard", prompt: "Original?", answer: "Original", explanation: "Original", options: [], essentialCriteria: ["Original"], sourceReference: "Manual p.2" };
test("edição pessoal é persistente, reversível e preserva original e histórico", () => {
  const before = { ...emptyPathProgress, xp: 140, mastery: { c1: 2 } };
  const edit = { prompt: "Pergunta editada?", answer: "Resposta revisada", explanation: "Explicação revisada", essentialCriteria: ["Resposta revisada"] };
  const saved = JSON.parse(JSON.stringify(updateCardEdit(before, "c1", edit)));
  const edited = customizedExercise(card, saved);
  assert.equal(edited.answer, edit.answer);
  assert.deepEqual(edited.essentialCriteria, edit.essentialCriteria);
  assert.match(edited.sourceReference!, /Edição pessoal/);
  assert.equal(card.answer, "Original");
  assert.equal(saved.xp, 140);
  assert.deepEqual(saved.mastery, before.mastery);
  assert.equal(customizedExercise(card, updateCardEdit(saved, "c1", null)), card);
});
test("favoritos filtram o banco e podem ser removidos sem alterar cartões ou XP", () => {
  const path: LearningPath = { id: "p", title: "P", createdAt: "now", updatedAt: "now", units: [{ id: "u", title: "U", description: "U", lessons: [{ id: "l", title: "L", description: "L", difficulty: "iniciante", xp: 10, exercises: [card, { ...card, id: "c2" }] }] }] };
  const saved = toggleFavorite(emptyPathProgress, "c2");
  assert.deepEqual(chooseItems(path, saved, "flashcards", "favorites").map(item => item.exerciseId), ["c2"]);
  assert.equal(chooseItems(path, toggleFavorite(saved, "c2"), "flashcards", "favorites").length, 0);
  assert.equal(chooseItems(path, emptyPathProgress, "flashcards").length, 2);
  assert.equal(saved.xp, 0);
});
test("não salva edição sem critérios nem muda questões com alternativas", () => {
  assert.throws(() => updateCardEdit(emptyPathProgress, "c1", { prompt: "P", answer: "R", explanation: "", essentialCriteria: [] }));
  const progress = updateCardEdit(emptyPathProgress, "c1", { prompt: "P", answer: "R", explanation: "", essentialCriteria: ["R"] });
  const choice = { ...card, type: "multiple_choice" as const, options: ["Original", "B", "C", "D"] };
  assert.equal(customizedExercise(choice, progress), choice);
});
