import { test } from "node:test";
import assert from "node:assert/strict";
import { runFlashcardProduction, type CardRequester } from "../lib/flashcard-production-runner.ts";
import { appendCardSources, cardSources, productionProgress, type CardFact } from "../lib/flashcard-production.ts";
import type { LearningPath } from "../lib/learning.ts";
import { ApiClientError } from "../lib/api-contract.ts";

const fact = (id: string): CardFact => ({ id, category: "Ciência", topic: "Conceitos", objective: `Conceito ${id}`, quote: `Fato ${id}` });
const cards = (facts: CardFact[]) => ({ cards: facts.map(item => ({ factId: item.id, front: `Explique ${item.objective}`, back: item.quote, explanation: item.quote, essentialCriteria: [item.quote] })) });
function initial(): LearningPath { return { id: "p", title: "Ciência", units: [], createdAt: "now", updatedAt: "now", cardProduction: { version: 1, status: "paused", sources: [{ id: "s", reference: "p.1", text: "Fato A. Fato B. Fato C.", completedFactIds: [] }] } }; }
type Payload = { stage: string; facts: CardFact[]; existingObjectives?: string[] };
function requester(handler: (body: Payload) => unknown | Promise<unknown>): CardRequester {
  return async <T>(_url: string, body: unknown) => await handler(body as Payload) as T;
}

test("audita novamente depois de preencher cada lacuna até não haver omissões identificadas", async () => {
  let saved = initial();
  const stages: string[] = [];
  let audits = 0;
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    stages.push(body.stage);
    if (body.stage === "inventory") return { facts: [fact("A")] };
    if (body.stage === "cards") return cards(body.facts);
    audits++;
    if (audits < 3) return { facts: [fact(audits === 1 ? "B" : "C")] };
    assert.equal(body.existingObjectives?.length, 3);
    return { facts: [] };
  }));
  assert.deepEqual(stages, ["inventory", "cards", "audit", "cards", "audit", "cards", "audit"]);
  assert.equal(saved.cardProduction!.status, "complete");
  assert.equal(productionProgress(saved.cardProduction!).covered, 3);
});

test("falha no segundo lote preserva o primeiro; retomada não refaz inventário ou cartões prontos", async () => {
  let saved = initial();
  let calls = 0;
  const facts = Array.from({ length: 25 }, (_, i) => fact(String(i)));
  await assert.rejects(runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    if (body.stage === "inventory") return { facts };
    if (++calls === 2) throw new Error("Falha temporária");
    return cards(body.facts);
  })), /Falha temporária/);
  assert.equal(productionProgress(saved.cardProduction!).covered, 10);
  assert.equal(saved.cardProduction!.status, "error");
  const resumed: string[] = [];
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    assert.notEqual(body.stage, "inventory");
    if (body.stage === "audit") return { facts: [] };
    resumed.push(...body.facts.map(item => item.id));
    return cards(body.facts);
  }));
  assert.deepEqual(resumed, facts.slice(10).map(item => item.id));
  assert.equal(productionProgress(saved.cardProduction!).complete, true);
});

test("resposta incompatível reduz o lote e conclui sem perder cartões", async () => {
  let saved = initial();
  const sizes: number[] = [];
  const facts = Array.from({ length: 12 }, (_, i) => fact(String(i)));
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    if (body.stage === "inventory") return { facts };
    if (body.stage === "audit") return { facts: [] };
    sizes.push(body.facts.length);
    if (body.facts.length > 2) throw new ApiClientError("Formato incompatível", "MALFORMED_AI_RESPONSE", 502, true);
    return cards(body.facts);
  }));
  assert.deepEqual(sizes.slice(0, 3), [10, 5, 2]);
  assert.equal(saved.cardProduction?.status, "complete");
  assert.equal(productionProgress(saved.cardProduction!).covered, 12);
});

test("pausa depois do inventário não consome outro lote e pode ser retomada", async () => {
  let saved = initial();
  const controller = new AbortController();
  let requests = 0;
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); if (path.cardProduction?.sources[0].facts) controller.abort(); }, () => {}, controller.signal, requester(() => { requests++; return { facts: [fact("A")] }; }));
  assert.equal(requests, 1);
  assert.equal(saved.cardProduction!.status, "paused");
  assert.equal(saved.cardProduction!.sources[0].facts?.length, 1);
});

test("resposta incompleta não avança a cobertura nem entra em loop", async () => {
  let saved = initial();
  await assert.rejects(runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => body.stage === "inventory" ? { facts: [fact("A")] } : { cards: [] })), /não cobre/);
  assert.equal(productionProgress(saved.cardProduction!).covered, 0);
  assert.equal(saved.cardProduction!.status, "error");
});

test("conclusão antiga recebe nova auditoria sem regenerar cartões", async () => {
  let saved = initial();
  saved.cardProduction!.status = "complete";
  saved.cardProduction!.sources[0] = { ...saved.cardProduction!.sources[0], audited: true, facts: [], completedFactIds: [] };
  assert.equal(productionProgress(saved.cardProduction!).complete, false);
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => { assert.equal(body.stage, "audit"); return { facts: [] }; }));
  assert.equal(productionProgress(saved.cardProduction!).complete, true);
});

test("novo material amplia baralho concluído sem refazer cartões e retoma após falha", async () => {
  let saved = initial();
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => body.stage === "inventory" ? { facts: [fact("A")] } : body.stage === "audit" ? { facts: [] } : cards(body.facts)));
  assert.equal(saved.cardProduction?.status, "complete");
  saved = appendCardSources(saved, cardSources([{ reference: "Material novo", text: "Fato D." }]));
  assert.equal(productionProgress(saved.cardProduction!).covered, 1);
  assert.equal(productionProgress(saved.cardProduction!).complete, false);
  assert.throws(() => appendCardSources(saved, cardSources([{ reference: "Repetição", text: "Fato D." }])), /já foi adicionado/);
  let failed = false;
  await assert.rejects(runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    if (body.stage === "inventory") return { facts: [fact("D")] };
    if (body.stage === "audit") return { facts: [] };
    if (!failed) { failed = true; throw new Error("Falha transitória"); }
    return cards(body.facts);
  })), /Falha transitória/);
  assert.equal(productionProgress(saved.cardProduction!).covered, 1);
  await runFlashcardProduction(saved, path => { saved = structuredClone(path); }, () => {}, new AbortController().signal, requester(body => {
    assert.notEqual(body.stage, "inventory");
    return body.stage === "audit" ? { facts: [] } : cards(body.facts);
  }));
  assert.equal(productionProgress(saved.cardProduction!).covered, 2);
  assert.equal(saved.units.flatMap(unit => unit.lessons.flatMap(lesson => lesson.exercises)).length, 2);
});
