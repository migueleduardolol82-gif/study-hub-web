"use client";

import { requestAI } from "./ai-client";
import { readApiResponse } from "./api-contract";
import { loadLocalChunks, saveLocalChunks, type DocumentChunk, type StudyDocument } from "./study-documents";
import { cardSources } from "./flashcard-production";
import { runFlashcardProduction } from "./flashcard-production-runner";
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

export async function produceFlashcards(initial: LearningPath, save: (path: LearningPath) => void, report: (message: string) => void, signal: AbortSignal) {
  return runFlashcardProduction(initial, save, report, signal, requestAI);
}