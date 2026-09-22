import type { LearningPath, LearningExercise } from "./learning.ts";
import { isRecord } from "./safe-json.ts";

export type CardFact = { id: string; category: string; topic: string; objective: string; quote: string };
export type CardSource = { id: string; reference: string; text: string; facts?: CardFact[]; audited?: boolean; completedFactIds: string[] };
export type CardProduction = { version: 1; sources: CardSource[]; status: "paused" | "running" | "complete" | "error"; error?: string };
export type ProducedCard = { factId: string; front: string; back: string; explanation: string; essentialCriteria: string[] };

// Every character is assigned to a source segment. No summarization or document truncation.
export function cardSources(inputs: { reference: string; text: string }[]): CardSource[] {
  return inputs.flatMap(input => {
    const sources: CardSource[] = [];
    for (let start = 0; start < input.text.length;) {
      let end = Math.min(start + 2400, input.text.length);
      if (end < input.text.length) {
        const boundary = input.text.lastIndexOf(" ", end);
        if (boundary > start + 1200) end = boundary + 1;
      }
      const text = input.text.slice(start, end);
      if (text.trim()) sources.push({ id: crypto.randomUUID(), reference: `${input.reference} · caracteres ${start + 1}–${end}`, text, completedFactIds: [] });
      start = end;
    }
    return sources;
  });
}

export function productionProgress(job: CardProduction) {
  const analyzed = job.sources.filter(source => source.facts !== undefined).length;
  const facts = job.sources.reduce((sum, source) => sum + (source.facts?.length || 0), 0);
  const covered = job.sources.reduce((sum, source) => sum + (source.facts || []).filter(fact => source.completedFactIds.includes(fact.id)).length, 0);
  return { analyzed, total: job.sources.length, facts, covered, complete: job.sources.length > 0 && analyzed === job.sources.length && covered === facts && job.sources.every(source => source.audited) };
}

const string = { type: "string" };
export const cardFactSchema = { type: "object", additionalProperties: false, required: ["facts"], properties: { facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["category", "topic", "objective", "quote"], properties: { category: string, topic: string, objective: string, quote: string } } } } };
export const detailedCardSchema = { type: "object", additionalProperties: false, required: ["cards"], properties: { cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["factId", "front", "back", "explanation", "essentialCriteria"], properties: { factId: string, front: string, back: string, explanation: string, essentialCriteria: { type: "array", items: string } } } } } };
function textField(value: Record<string, unknown>, key: string, max = 3000) {
  const text = value[key];
  if (typeof text !== "string" || !text.trim() || text.length > max) throw new Error(`Campo inválido: ${key}`);
  return text.trim();
}
const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
export function validateCardFacts(value: unknown, source: string): CardFact[] {
  if (!isRecord(value) || !Array.isArray(value.facts)) throw new Error("Inventário de conceitos inválido.");
  const seen = new Set<string>();
  return value.facts.map((item) => {
    if (!isRecord(item)) throw new Error("Conceito inválido.");
    const quote = textField(item, "quote");
    if (!normalize(source).includes(normalize(quote))) throw new Error("A referência do conceito não está no material original.");
    const objective = textField(item, "objective", 800);
    const key = normalize(objective);
    if (seen.has(key)) throw new Error("Conceito duplicado no inventário.");
    seen.add(key);
    return { id: crypto.randomUUID(), category: textField(item, "category", 160), topic: textField(item, "topic", 160), objective, quote };
  });
}
export function validateDetailedCards(value: unknown, facts: CardFact[]): ProducedCard[] {
  if (!isRecord(value) || !Array.isArray(value.cards) || value.cards.length !== facts.length) throw new Error("O lote não cobre todos os conceitos solicitados.");
  const pending = new Set(facts.map(fact => fact.id));
  const fronts = new Set<string>();
  return value.cards.map(item => {
    if (!isRecord(item)) throw new Error("Cartão inválido.");
    const factId = textField(item, "factId", 100);
    if (!pending.delete(factId)) throw new Error("Conceito repetido ou desconhecido.");
    const front = textField(item, "front", 1200);
    if (fronts.has(normalize(front))) throw new Error("Pergunta duplicada no lote.");
    fronts.add(normalize(front));
    if (!Array.isArray(item.essentialCriteria) || !item.essentialCriteria.length || item.essentialCriteria.some(s => typeof s !== "string" || !s.trim() || s.length > 1000)) throw new Error("Critérios essenciais ausentes.");
    return { factId, front, back: textField(item, "back"), explanation: textField(item, "explanation"), essentialCriteria: item.essentialCriteria as string[] };
  });
}

// Stable fact IDs make retries idempotent, including a response recovered from the server cache.
export function applyDetailedCards(path: LearningPath, sourceId: string, cards: ProducedCard[]): LearningPath {
  const job = path.cardProduction;
  const source = job?.sources.find(source => source.id === sourceId);
  if (!job || !source?.facts) throw new Error("Etapa de origem ausente.");
  if (cards.every(card => source.completedFactIds.includes(card.factId))) return path;
  const units = path.units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => ({ ...lesson, exercises: [...lesson.exercises] })) }));
  const covered = new Set(source.completedFactIds);
  for (const card of cards) {
    const fact = source.facts.find(fact => fact.id === card.factId);
    if (!fact) throw new Error("Cartão sem conceito de origem.");
    if (covered.has(fact.id)) continue;
    let unit = units.find(unit => normalize(unit.title) === normalize(fact.category));
    if (!unit) { unit = { id: `deck-${crypto.randomUUID()}`, title: fact.category, description: "Deck organizado a partir do material original.", lessons: [] }; units.push(unit); }
    let lesson = unit.lessons.find(lesson => normalize(lesson.title) === normalize(fact.topic));
    if (!lesson) { lesson = { id: `subdeck-${crypto.randomUUID()}`, title: fact.topic, description: fact.objective, difficulty: path.source?.difficulty || "iniciante", xp: 20, exercises: [], preparation: "ready" }; unit.lessons.push(lesson); }
    const exercise: LearningExercise = { id: `card-${fact.id}`, type: "flashcard", prompt: card.front, answer: card.back, explanation: card.explanation, options: [], essentialCriteria: card.essentialCriteria, concept: fact.objective, sourceReference: source.reference, teaching: card.explanation, difficulty: lesson.difficulty };
    lesson.exercises.push(exercise);
    covered.add(fact.id);
  }
  const nextJob = { ...job, sources: job.sources.map(item => item.id === sourceId ? { ...item, completedFactIds: [...covered] } : item) };
  if (productionProgress(nextJob).complete) nextJob.status = "complete";
  return { ...path, units, cardProduction: nextJob, updatedAt: new Date().toISOString() };
}
