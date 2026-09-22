"use client";

import { requestAI } from "./ai-client";
import { readApiResponse } from "./api-contract";
import { loadLocalChunks, saveLocalChunks, type DocumentChunk, type StudyDocument } from "./study-documents";
import { applyDetailedCards, cardSources, productionProgress, type CardFact, type ProducedCard } from "./flashcard-production";
import { syncKnowledgeBase } from "./review-engine";
import type { LearningPath } from "./learning";

export async function loadCardSources(documents: StudyDocument[], extraText: string, signal?: AbortSignal) {
  const inputs: { reference: string; text: string }[] = [];
  for (const document of documents) {
    let chunks = await loadLocalChunks([document.id]);
    if (!chunks.length && !document.localOnly) {
      const response = await fetch(`/api/documents?id=${encodeURIComponent(document.id)}`, { cache: "no-store", signal });
      const data = await readApiResponse<{ chunks: DocumentChunk[] }>(response);
      chunks = data.chunks;
      await saveLocalChunks(chunks);
    }
    if (!chunks.length) throw new Error(`O texto de “${document.name}” não está disponível. Adicione esse arquivo novamente.`);
    inputs.push(...chunks.sort((a, b) => a.order - b.order).map(chunk => ({ reference: `${document.name} · ${chunk.locator}`, text: chunk.text })));
  }
  if (extraText.trim()) inputs.push({ reference: "Texto fornecido", text: extraText });
  const sources = cardSources(inputs);
  if (!sources.length) throw new Error("Adicione um arquivo ou cole o material para gerar flashcards detalhados.");
  return sources;
}

// Each successful inventory and card batch is checkpointed before another request starts.
// Closing the page aborts the current request; a restart uses these checkpoints and server cache.
export async function produceFlashcards(initial: LearningPath, save: (path: LearningPath) => void, report: (message: string) => void, signal: AbortSignal) {
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
          if (source.audited) break;
          report(`Verificando detalhes omitidos · trecho ${index + 1}/${path.cardProduction!.sources.length}`);
          const audit = await requestAI<{ facts: CardFact[] }>("/api/learning/flashcards", { stage: "audit", text: source.text, reference: source.reference, existingObjectives: source.facts!.map(fact => fact.objective), categories: path.units.map(unit => ({ category: unit.title, topics: unit.lessons.map(lesson => lesson.title) })).slice(-80) }, signal);
          const known = new Set(source.facts!.map(fact => fact.objective.toLocaleLowerCase("pt-BR").trim()));
          source = { ...source, audited: true, facts: [...source.facts!, ...audit.facts.filter(fact => !known.has(fact.objective.toLocaleLowerCase("pt-BR").trim()))] };
          path = { ...path, cardProduction: { ...path.cardProduction!, sources: path.cardProduction!.sources.map((item, i) => i === index ? source : item) } };
          checkpoint();
          continue;
        }
        report(`Gerando cartões · trecho ${index + 1}/${path.cardProduction!.sources.length} · ${productionProgress(path.cardProduction!).covered} prontos`);
        const result = await requestAI<{ cards: ProducedCard[] }>("/api/learning/flashcards", { stage: "cards", text: source.text, reference: source.reference, facts: pending }, signal);
        path = applyDetailedCards(path, source.id, result.cards);
        checkpoint();
      }
    }
    path = { ...path, cardProduction: { ...path.cardProduction!, status: "complete" } };
    checkpoint();
  } catch (error) {
    path = { ...path, cardProduction: { ...path.cardProduction!, status: signal.aborted ? "paused" : "error", error: signal.aborted ? undefined : error instanceof Error ? error.message : "Não foi possível concluir este lote." } };
    checkpoint();
    if (!signal.aborted) throw error;
  }
}
