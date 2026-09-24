import test from "node:test";
import assert from "node:assert/strict";
import { emptyPathProgress, type LearningPath, type LearningExercise } from "../lib/learning.ts";
import { chooseItems, completeSession, memorizeOptions, mergeQuestionBank, newReviewSession, recordAttempt, sessionStats, sessionXp, syncKnowledgeBase, type ReviewAttempt } from "../lib/review-engine.ts";
import { validateSemanticGrade } from "../lib/semantic-grading.ts";
import { validateTutorAnswer } from "../lib/learning-tutor.ts";
import { validateQuestionBatch } from "../lib/learning-generation.ts";

const exercise: LearningExercise = { id: "e1", type: "typed", prompt: "Explique o conceito.", answer: "Referência", explanation: "Explicação", options: [], essentialCriteria: ["Reavaliar", "Mercado"], concept: "Conceito" };
const path: LearningPath = { id: "p1", title: "Trilha", createdAt: "2026-09-12", updatedAt: "2026-09-12", unlockAll: true, units: [{ id: "u1", title: "Unidade", description: "Descrição", lessons: [{ id: "l1", title: "Lição", description: "Descrição", difficulty: "iniciante", xp: 60, exercises: [exercise, { ...exercise, id: "e2", type: "multiple_choice", options: ["A", "B", "C", "D"], answer: "B", difficulty: "avancado" }] }] }] };
const grade = { correct: true, missingPoints: [], feedback: "Você explicou os elementos essenciais.", referenceAnswer: "Referência" };
const attempt: ReviewAttempt = { id: "s1:e1", sessionId: "s1", exerciseId: "e1", lessonId: "l1", concept: "l1:conceito", mode: "estudar", selected: "Uma paráfrase.", grade, answeredAt: "2026-09-12T12:00:00Z", elapsedMs: 4000 };

test("contrato binário rejeita booleano textual, resposta parcial e contradições", () => {
  assert.deepEqual(validateSemanticGrade(grade), grade);
  for (const invalid of [{ ...grade, correct: "true" }, { ...grade, feedback: "Parcialmente correto" }, { ...grade, missingPoints: ["Mercado"] }, { ...grade, feedback: "" }]) assert.throws(() => validateSemanticGrade(invalid));
  assert.equal(validateSemanticGrade({ ...grade, correct: false, missingPoints: ["Mercado"], feedback: "Faltou relacionar a atualização ao mercado." }).correct, false);
});
test("trocar modo não altera a trilha e mantém identidades do banco", () => {
  const original = JSON.stringify(path);
  for (const mode of ["estudar", "flashcards", "dominio"] as const) assert.equal(chooseItems(path, emptyPathProgress, mode).length, 2);
  assert.equal(chooseItems(path, emptyPathProgress, "memorizar").length, 0);
  assert.equal(JSON.stringify(path), original);
  assert.equal(chooseItems(path, emptyPathProgress, "hard")[0].exerciseId, "e2");
  assert.equal(chooseItems(path, emptyPathProgress, "speed")[0].exerciseId, "e2");
});
test("memorizar usa cartões e oferece alternativas distintas sem revelar a resposta", () => {
  const cards = [
    { ...exercise, id: "f1", type: "flashcard" as const, answer: "Água" },
    { ...exercise, id: "f2", type: "flashcard" as const, answer: "Açúcares" },
    { ...exercise, id: "f3", type: "flashcard" as const, answer: "Luz" },
    { ...exercise, id: "f4", type: "flashcard" as const, answer: "Oxigênio" },
  ];
  const deck = { ...path, units: path.units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => ({ ...lesson, exercises: [...cards, exercise] })) })) };
  assert.equal(chooseItems(deck, emptyPathProgress, "memorizar").length, 4);
  const options = memorizeOptions(deck, cards[0]);
  assert.equal(options.length, 4);
  assert.equal(new Set(options).size, 4);
  assert.ok(options.includes("Água"));
  assert.deepEqual(memorizeOptions(deck, cards[0]), options);
  const single = { ...deck, units: deck.units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => ({ ...lesson, exercises: [cards[0]] })) })) };
  assert.deepEqual(new Set(memorizeOptions(single, cards[0])), new Set(["Água", "Ainda não sei"]));
});
test("escopo por unidade e conceito", () => {
  assert.equal(chooseItems(path, emptyPathProgress, "flashcards", "u1").length, 2);
  assert.equal(chooseItems(path, emptyPathProgress, "flashcards", "l1:conceito").length, 2);
  assert.equal(chooseItems(path, emptyPathProgress, "flashcards", "inexistente").length, 0);
});
test("sessão serializada preserva questão, modo, resposta e ordem das opções", () => {
  const s = newReviewSession(path, emptyPathProgress, "flashcards", "all");
  s.index = 1; s.draft = "Minha resposta";
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  const choice = s.items.find(i => i.exerciseId === "e2")!;
  assert.deepEqual([...choice.optionOrder].sort(), [0,1,2,3]);
});
test("correção idempotente e separada de XP", () => {
  const p = recordAttempt(emptyPathProgress, attempt);
  assert.equal(recordAttempt(p, attempt), p);
  assert.equal(p.xp, 0);
  assert.equal(p.conceptMastery?.[attempt.concept].answered, 1);
  assert.equal(p.conceptMastery?.[attempt.concept].correct, 1);
});
test("só respostas erradas entram nos erros; duas recuperações mantêm histórico", () => {
  const wrong = { ...attempt, grade: { ...grade, correct: false } };
  let p = recordAttempt(emptyPathProgress, wrong);
  assert.deepEqual(p.lessonResults.l1.wrongExerciseIds, ["e1"]);
  p = recordAttempt(p, { ...attempt, id: "s2:e1" });
  assert.deepEqual(p.lessonResults.l1.wrongExerciseIds, ["e1"]);
  p = recordAttempt(p, { ...attempt, id: "s3:e1" });
  assert.deepEqual(p.lessonResults.l1.wrongExerciseIds, []);
  assert.equal(p.reviewHistory?.length, 3);
});
test("revisão vazia não inventa erros para questões nunca respondidas", () => {
  assert.equal(chooseItems(path, emptyPathProgress, "revisao").length, 0);
  const p = recordAttempt(emptyPathProgress, { ...attempt, grade: { ...grade, correct: false } });
  assert.deepEqual(chooseItems(path, p, "revisao", "all", Date.parse(attempt.answeredAt)).map(i => i.exerciseId), ["e1"]);
});
test("sessão pulada ou expirada não conclui lição nem concede XP", () => {
  const s = newReviewSession(path, emptyPathProgress, "speed", "all");
  const p = completeSession(emptyPathProgress, s, path);
  assert.deepEqual(p.completedLessonIds, []);
  assert.deepEqual(p.lessonResults, {});
  assert.equal(p.xp, 0); assert.equal(p.streak, 0);
  assert.equal(sessionStats(s).wrong, 0);
});
test("precisão usa respondidas e não as perguntas não alcançadas", () => {
  const s = newReviewSession(path, emptyPathProgress, "estudar", "all");
  s.answers = [attempt];
  assert.equal(sessionStats(s).accuracy, 100);
  assert.equal(sessionStats(s).unanswered, 1);
  assert.equal(sessionStats(s).bestStreak, 1);
  assert.equal(sessionXp(s), 10);
});
test("mesclar lotes preserva questões antigas e remove duplicatas de enunciado", () => {
  const merged = mergeQuestionBank([exercise], [{ ...exercise, id: "new" }, { ...exercise, id: "other", prompt: "Aplique em outro cenário" }]);
  assert.equal(merged.length, 2); assert.equal(merged[0], exercise);
});
test("validação de lote exige critérios bem formados quando fornecidos", () => {
  const q = { ...exercise, sourceReference: "Material, página 1", optionExplanations: [], difficulty: "iniciante", teaching: "Teoria", example: "Exemplo" };
  assert.equal(validateQuestionBatch({ exercises: Array.from({ length: 4 }, () => q) }).exercises.length, 4);
  assert.throws(() => validateQuestionBatch({ exercises: Array.from({ length: 4 }, () => ({ ...q, essentialCriteria: [] })) }));
});
test("base central reúne conceitos sem duplicar ao sincronizar novamente", () => {
  const once = syncKnowledgeBase(path, "2026-09-12T12:00:00Z");
  const twice = syncKnowledgeBase(once, "2026-09-12T13:00:00Z");
  assert.equal(once.knowledgeBase?.concepts.length, 2);
  assert.equal(twice.knowledgeBase?.concepts.length, once.knowledgeBase?.concepts.length);
  assert.deepEqual(twice.knowledgeBase?.concepts.map(item => item.id).sort(), once.knowledgeBase?.concepts.map(item => item.id).sort());
  const explicit = twice.knowledgeBase?.concepts.find(item => item.title === "Conceito");
  assert.deepEqual(explicit?.exerciseIds.sort(), ["e1", "e2"]);
});
test("tutor separa material e complemento e rejeita resposta vazia", () => {
  const value = { fromMaterial: "O material define o conceito.", complement: "Uma analogia externa.", caveat: "", suggestedQuestion: "Como aplicar?" };
  assert.deepEqual(validateTutorAnswer(value), value);
  assert.throws(() => validateTutorAnswer({ ...value, fromMaterial: "", complement: "" }));
});
