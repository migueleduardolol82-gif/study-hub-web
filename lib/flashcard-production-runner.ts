import { applyDetailedCards, productionProgress, validateDetailedCards, type CardFact, type ProducedCard } from "./flashcard-production.ts";
import { syncKnowledgeBase } from "./review-engine.ts";
import type { LearningPath } from "./learning.ts";
export type CardRequester = <T>(url: string, body: unknown, signal?: AbortSignal) => Promise<T>;
// Each successful inventory and card batch is checkpointed before another request starts.
// Closing the page aborts the current request; a restart uses these checkpoints and server cache.
export async function runFlashcardProduction(initial: LearningPath, save: (path: LearningPath) => void, report: (message: string) => void, signal: AbortSignal, requestAI: CardRequester) {
  let path = initial;
  if (!path.cardProduction) throw new Error("Material de origem ausente.");
  const checkpoint = () => { path = syncKnowledgeBase(path); save(path); };
  path = { ...path, cardProduction: { ...path.cardProduction, status: "running", error: undefined } };
  checkpoint();
  try {
    for (let index = 0; index < path.cardProduction!.sources.length; index++) {
      if (signal.aborted) throw new DOMException("Geração pausada.", "AbortError");
      let source = path.cardProduction!.sources[index];
      if (source.facts === undefined) {
        report(`Identificando todos os detalhes · trecho ${index + 1}/${path.cardProduction!.sources.length}`);
        const result = await requestAI<{ facts: CardFact[] }>("/api/learning/flashcards", { stage: "inventory", text: source.text, reference: source.reference, categories: path.units.map(unit => ({ category: unit.title, topics: unit.lessons.map(lesson => lesson.title) })).slice(-80) }, signal);
        source = { ...source, facts: result.facts };
        path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.map((item, i) => i === index ? source : item) } };
        checkpoint();
      }
      while (true) {
        if (signal.aborted) throw new DOMException("Geração pausada.", "AbortError");
        source = path.cardProduction!.sources[index];
        const pending = source.facts!.filter(fact => !source.completedFactIds.includes(fact.id)).slice(0, 10);
        if (!pending.length) {
          if (source.audited && source.auditVersion === 2) break;
          report(`Verificando detalhes omitidos · trecho ${index + 1}/${path.cardProduction!.sources.length}`);
          const audit = await requestAI<{ facts: CardFact[] }>("/api/learning/flashcards", { stage: "audit", text: source.text, reference: source.reference, existingObjectives: source.facts!.map(fact => fact.objective), categories: path.units.map(unit => ({ category: unit.title, topics: unit.lessons.map(lesson => lesson.title) })).slice(-80) }, signal);
          const known = new Set(source.facts!.map(fact => fact.objective.toLocaleLowerCase("pt-BR").trim()));
          const additional = audit.facts.filter(fact => !known.has(fact.objective.toLocaleLowerCase("pt-BR").trim()));
          if (audit.facts.length && !additional.length) throw new Error("A verificação retornou apenas conceitos repetidos. Os cartões foram preservados; retome para verificar este trecho novamente.");
          source = { ...source, audited: audit.facts.length === 0, auditVersion: 2, facts: [...source.facts!, ...additional] };
          path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.map((item, i) => i === index ? source : item) } };
          checkpoint();
          continue;
        }
        report(`Gerando cartões · trecho ${index + 1}/${path.cardProduction!.sources.length} · ${productionProgress(path.cardProduction!).covered} prontos`);
        const result = await requestAI<{ cards: ProducedCard[] }>("/api/learning/flashcards", { stage: "cards", text: source.text, reference: source.reference, facts: pending }, signal);
        path = applyDetailedCards(path, source.id, validateDetailedCards(result, pending));
        checkpoint();
      }
    }
    if (!productionProgress(path.cardProduction!).complete) throw new Error("Ainda existem trechos ou conceitos pendentes.");
    path = { ...path, cardProduction: { ...path.cardProduction!, status: "complete" } };
    checkpoint();
  } catch (error) {
    path = { ...path, cardProduction: { ...path.cardProduction!, status: signal.aborted ? "paused" : "error", error: signal.aborted ? undefined : error instanceof Error ? error.message : "Não foi possível concluir este lote." } };
    checkpoint();
    if (!signal.aborted) throw error;
  }
}
