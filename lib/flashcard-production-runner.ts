import { applyDetailedCards, pruneLayoutCards, productionProgress, validateDetailedCards, type CardFact, type CardSource, type ProducedCard } from "./flashcard-production.ts";
import { syncKnowledgeBase } from "./review-engine.ts";
import { ApiClientError } from "./api-contract.ts";
import type { LearningPath } from "./learning.ts";
export type CardRequester = <T>(url: string, body: unknown, signal?: AbortSignal) => Promise<T>;
const recoverable = (error: unknown) => error instanceof ApiClientError && error.retryable
  && ["MALFORMED_AI_RESPONSE", "EMPTY_AI_RESPONSE", "AI_OUTPUT_LIMIT", "OPENAI_TIMEOUT", "OPENAI_UNAVAILABLE", "NETWORK_ERROR"].includes(error.code);
function splitSource(source: CardSource): [CardSource, CardSource] | null {
  if (source.text.length < 650 || source.facts !== undefined) return null;
  const midpoint = Math.floor(source.text.length / 2);
  const boundary = source.text.indexOf(" ", midpoint);
  const cut = boundary > midpoint && boundary < midpoint + 120 ? boundary + 1 : midpoint;
  return [
    { id: crypto.randomUUID(), reference: `${source.reference} · parte 1`, text: source.text.slice(0, cut), completedFactIds: [] },
    { id: crypto.randomUUID(), reference: `${source.reference} · parte 2`, text: source.text.slice(cut), completedFactIds: [] },
  ];
}
// Each successful inventory and card batch is checkpointed before another request starts.
// Closing the page aborts the current request; a restart uses these checkpoints and server cache.
export async function runFlashcardProduction(initial: LearningPath, save: (path: LearningPath) => void, report: (message: string) => void, signal: AbortSignal, requestAI: CardRequester) {
  let path = pruneLayoutCards(initial);
  if (!path.cardProduction) throw new Error("Material de origem ausente.");
  const checkpoint = () => { path = syncKnowledgeBase(path); save(path); };
  let cardBatchSize = 10;
  const requestWithRecovery = async <T>(body: Record<string, unknown>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      if (signal.aborted) throw new DOMException("Geração pausada.", "AbortError");
      try { return await requestAI<T>("/api/learning/flashcards", { ...body, recoveryAttempt: attempt }, signal); }
      catch (error) {
        if (!recoverable(error) || attempt >= 2) throw error;
        report(`Corrigindo resposta da IA · tentativa ${attempt + 2}/3`);
      }
    }
  };
  path = { ...path, cardProduction: { ...path.cardProduction, status: "running", error: undefined } };
  checkpoint();
  try {
    sourceLoop: for (let index = 0; index < path.cardProduction!.sources.length; index++) {
      if (signal.aborted) throw new DOMException("Geração pausada.", "AbortError");
      let source = path.cardProduction!.sources[index];
      if (source.facts === undefined) {
        report(`Identificando todos os detalhes · trecho ${index + 1}/${path.cardProduction!.sources.length}`);
        let result: { facts: CardFact[] };
        try { result = await requestWithRecovery<{ facts: CardFact[] }>({ stage: "inventory", text: source.text, reference: source.reference, categories: path.units.map(unit => ({ category: unit.title, topics: unit.lessons.map(lesson => lesson.title) })).slice(-80) }); }
        catch (error) {
          const pieces = recoverable(error) ? splitSource(source) : null;
          if (!pieces) throw error;
          path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.flatMap((item, i) => i === index ? pieces : [item]) } };
          checkpoint();
          report(`Dividindo trecho difícil em partes menores · ${index + 1}/${path.cardProduction!.sources.length}`);
          index--;
          continue sourceLoop;
        }
        source = { ...source, facts: result.facts };
        path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.map((item, i) => i === index ? source : item) } };
        checkpoint();
      }
      while (true) {
        if (signal.aborted) throw new DOMException("Geração pausada.", "AbortError");
        source = path.cardProduction!.sources[index];
        const pending = source.facts!.filter(fact => !source.completedFactIds.includes(fact.id)).slice(0, cardBatchSize);
        if (!pending.length) {
          if (source.audited && source.auditVersion === 2) break;
          report(`Verificando detalhes omitidos · trecho ${index + 1}/${path.cardProduction!.sources.length}`);
          const audit = await requestWithRecovery<{ facts: CardFact[] }>({ stage: "audit", text: source.text, reference: source.reference, existingObjectives: source.facts!.map(fact => fact.objective), categories: path.units.map(unit => ({ category: unit.title, topics: unit.lessons.map(lesson => lesson.title) })).slice(-80) });
          const known = new Set(source.facts!.map(fact => fact.objective.toLocaleLowerCase("pt-BR").trim()));
          const additional = audit.facts.filter(fact => !known.has(fact.objective.toLocaleLowerCase("pt-BR").trim()));
          if (audit.facts.length && !additional.length) throw new Error("A verificação retornou apenas conceitos repetidos. Os cartões foram preservados; retome para verificar este trecho novamente.");
          source = { ...source, audited: audit.facts.length === 0, auditVersion: 2, facts: [...source.facts!, ...additional] };
          path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.map((item, i) => i === index ? source : item) } };
          checkpoint();
          continue;
        }
        report(`Gerando cartões · trecho ${index + 1}/${path.cardProduction!.sources.length} · ${productionProgress(path.cardProduction!).covered} prontos`);
        let result: { cards: ProducedCard[] };
        try {
          const body = { stage: "cards", text: source.text, reference: source.reference, facts: pending };
          if (pending.length === 1) {
            result = await requestWithRecovery<{ cards: ProducedCard[] }>(body);
            validateDetailedCards(result, pending);
          } else {
            result = await requestAI<{ cards: ProducedCard[] }>("/api/learning/flashcards", body, signal);
            validateDetailedCards(result, pending);
          }
        } catch (error) {
          if (pending.length > 1 && (recoverable(error) || error instanceof Error && /lote não cobre|pergunta duplicada|formatação/.test(error.message))) {
            cardBatchSize = Math.max(1, Math.floor(pending.length / 2));
            report(`Ajustando o lote para ${cardBatchSize} cartão${cardBatchSize === 1 ? "" : "ões"} por vez`);
            continue;
          }
          throw error;
        }
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
