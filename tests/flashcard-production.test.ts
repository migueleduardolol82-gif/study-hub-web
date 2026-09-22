import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDetailedCards, cardSources, productionProgress, validateCardFacts, validateDetailedCards } from "../lib/flashcard-production.ts";
import { emptyPathProgress, type LearningPath } from "../lib/learning.ts";
import { chooseItems } from "../lib/review-engine.ts";

test("segmentação preserva todo o texto de um documento grande, inclusive o final", () => {
  const text = "Uma regra com uma exceção importante. ".repeat(8000) + "FIM ÚNICO";
  const sources = cardSources([{ reference: "Manual", text }]);
  assert.equal(sources.map(source => source.text).join(""), text);
  assert.ok(sources.every(source => source.text.length <= 2400));
  assert.ok(sources.at(-1)?.text.endsWith("FIM ÚNICO"));
});

test("inventário exige evidência literal e rejeita fatos duplicados", () => {
  const item = { category: "Regras", topic: "Prazos", objective: "Prazo de resposta", quote: "até 30 dias" };
  assert.equal(validateCardFacts({ facts: [item] }, "A resposta ocorre até 30 dias.").length, 1);
  assert.throws(() => validateCardFacts({ facts: [item] }, "A resposta é imediata."));
  assert.throws(() => validateCardFacts({ facts: [item, item] }, "até 30 dias"));
});

for (const count of [80, 250, 310]) test(`${count} cartões em lotes, retomada idempotente e subdecks estudáveis`, () => {
  const facts = Array.from({ length: count }, (_, i) => ({ id: `f-${i}`, category: `Categoria ${i % 3}`, topic: `Tema ${i % 7}`, objective: `Regra ${i}`, quote: `Fato ${i}` }));
  let path: LearningPath = { id: "p", title: "Material", createdAt: "now", updatedAt: "now", units: [], cardProduction: { version: 1, status: "running", sources: [{ id: "s", reference: "Manual p.1", text: facts.map(f => f.quote).join(";"), facts, completedFactIds: [] }] } };
  for (let i = 0; i < count; i += 10) {
    const batch = facts.slice(i, i + 10);
    const cards = validateDetailedCards({ cards: batch.map(f => ({ factId: f.id, front: `Qual é a ${f.objective}?`, back: f.quote, explanation: f.quote, essentialCriteria: [f.quote] })) }, batch);
    path = applyDetailedCards(path, "s", cards);
    const serialized = JSON.stringify(path);
    path = applyDetailedCards(JSON.parse(serialized), "s", cards);
    assert.equal(JSON.stringify(path), serialized);
  }
  assert.equal(productionProgress(path.cardProduction!).complete, false, "auditoria de lacunas ainda pendente");
  path.cardProduction!.sources[0].audited = true;
  path.cardProduction!.sources[0].auditVersion = 2;
  assert.equal(productionProgress(path.cardProduction!).covered, count);
  assert.equal(productionProgress(path.cardProduction!).complete, true);
  assert.equal(path.units.length, 3);
  assert.equal(chooseItems(path, emptyPathProgress, "flashcards").length, count);
  assert.ok(path.units.every(unit => unit.lessons.length > 1));
  assert.equal(emptyPathProgress.xp, 0);
});

test("lote incompleto ou com IDs duplicados não pode marcar cobertura", () => {
  const facts = [{ id: "a", category: "A", topic: "B", objective: "C", quote: "D" }, { id: "b", category: "A", topic: "B", objective: "E", quote: "F" }];
  const card = { factId: "a", front: "Pergunta", back: "Resposta", explanation: "Detalhe", essentialCriteria: ["Resposta"] };
  assert.throws(() => validateDetailedCards({ cards: [card] }, facts));
  assert.throws(() => validateDetailedCards({ cards: [card, card] }, facts));
});
