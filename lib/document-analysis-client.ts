"use client";

import { requestAI } from "./ai-client";
import { analysisAsSource, validateDocumentAnalysis, type DocumentAnalysis } from "./document-analysis";
import { loadLocalChunks, saveLocalChunks, type DocumentChunk, type StudyDocument } from "./study-documents";
import { readApiResponse } from "./api-contract";
import { parseJsonSafely } from "./safe-json";

const BATCH_CHARS = 24000;
const FINAL_CHARS = 85000;

function cacheKey(document: StudyDocument, index: number) { return `nexo-analysis-v1:${document.hash}:${index}`; }

export async function analyzeStudyDocuments(documents: StudyDocument[], progress: (message: string) => void, signal?: AbortSignal) {
  const ordered = [...documents].filter((item) => item.selected && item.status === "ready").sort((a, b) => a.priority - b.priority);
  if (!ordered.length) return "";
  let chunks = await loadLocalChunks(ordered.map((item) => item.id));
  const localIds = new Set(chunks.map((chunk) => chunk.documentId));
  for (const document of ordered.filter((item) => !localIds.has(item.id) && !item.localOnly)) {
    const response = await fetch(`/api/documents?id=${encodeURIComponent(document.id)}`, { cache: "no-store", signal });
    const payload = await readApiResponse<{ chunks: DocumentChunk[] }>(response);
    await saveLocalChunks(payload.chunks);
    chunks = [...chunks, ...payload.chunks];
  }
  if (!chunks.length) throw new Error("O texto dos arquivos não está mais disponível neste aparelho. Adicione os arquivos novamente.");
  const analyses: string[] = [];
  let completed = 0;
  const batchesByDocument = ordered.map((document) => {
    const items = chunks.filter((chunk) => chunk.documentId === document.id);
    const batches: typeof items[] = [];
    let current: typeof items = [];
    let size = 0;
    for (const item of items) {
      if (current.length && size + item.text.length > BATCH_CHARS) { batches.push(current); current = []; size = 0; }
      current.push(item); size += item.text.length;
    }
    if (current.length) batches.push(current);
    return { document, batches };
  });
  const total = batchesByDocument.reduce((sum, item) => sum + item.batches.length, 0);
  for (const { document, batches } of batchesByDocument) {
    for (let index = 0; index < batches.length; index += 1) {
      if (signal?.aborted) throw new DOMException("Operação interrompida.", "AbortError");
      const batch = batches[index];
      const key = cacheKey(document, index);
      let analysis: DocumentAnalysis | null = null;
      try {
        const cached = localStorage.getItem(key);
        analysis = cached ? validateDocumentAnalysis(parseJsonSafely(cached)) : null;
      } catch { analysis = null; }
      progress(`Lendo documento ${ordered.indexOf(document) + 1} de ${ordered.length} · parte ${index + 1} de ${batches.length} (${completed}/${total})`);
      if (!analysis) {
        analysis = await requestAI<DocumentAnalysis>("/api/documents/analyze", { documentName: document.name, locator: batch.map((item) => item.locator).join(", "), content: batch.map((item) => `[${document.name} — ${item.locator}]\n${item.text}`).join("\n\n") }, signal);
        localStorage.setItem(key, JSON.stringify(analysis));
      }
      analyses.push(analysisAsSource(document.name, batch.map((item) => item.locator).join(", "), analysis));
      completed += 1;
    }
  }
  progress("Combinando assuntos repetidos e verificando contradições");
  let level = analyses;
  let round = 1;
  while (level.join("\n\n").length > FINAL_CHARS) {
    const next: string[] = [];
    for (let start = 0; start < level.length; start += 18) {
      const content = level.slice(start, start + 18).join("\n\n");
      const merged = await requestAI<DocumentAnalysis>("/api/documents/analyze", { documentName: "Conjunto de fontes preservadas", locator: `síntese ${round}.${Math.floor(start / 18) + 1}`, content }, signal);
      next.push(analysisAsSource("Conjunto de fontes preservadas", `síntese ${round}.${Math.floor(start / 18) + 1}`, merged));
    }
    level = next; round += 1;
  }
  return level.join("\n\n");
}
