import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { createStructuredResponse } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";

export const runtime = "nodejs";
export const maxDuration = 90;

const schema = {
  type: "object", additionalProperties: false, required: ["title", "explanation", "keyPoints", "flashcards"],
  properties: {
    title: { type: "string" }, explanation: { type: "string" },
    keyPoints: { type: "array", minItems: 0, maxItems: 5, items: { type: "string" } },
    flashcards: { type: "array", minItems: 0, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["front", "back", "topic"], properties: { front: { type: "string" }, back: { type: "string" }, topic: { type: "string" } } } },
  },
} as const;

export async function POST(request: Request) {
  return aiRoute(request, "live-class/analyze", async (body) => {
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript || transcript.length > 20_000) throw new InvalidAIRequest("O trecho da transcrição é inválido.");
    const context = typeof body.context === "string" ? body.context.trim().slice(-6_000) : "";
    return createStructuredResponse({
      schema, schemaName: "live_class_segment", timeoutMs: 75_000, maxOutputTokens: 2400, signal: request.signal,
      instructions: "Você é um professor especialista no assunto identificado. Analise somente o trecho fornecido, em português do Brasil. Explique com clareza e profundidade proporcional ao conteúdo, sem inventar fatos. Crie de zero a quatro flashcards apenas quando houver conteúdo estudável. Perguntas devem ser específicas e respostas autocontidas. Se o trecho for apenas saudação, silêncio ou logística, use título descritivo, explicação curta e listas vazias.",
      input: `${context ? `Contexto dos trechos anteriores (use apenas para manter continuidade):\n${context}\n\n` : ""}Trecho atual da aula:\n${transcript}`,
      validate(value) {
        if (!isRecord(value) || typeof value.title !== "string" || typeof value.explanation !== "string" || !Array.isArray(value.keyPoints) || !Array.isArray(value.flashcards)) throw new Error("Análise incompleta.");
        const keyPoints = value.keyPoints.map(String).map(item => item.trim()).filter(Boolean).slice(0, 5);
        const flashcards = value.flashcards.map(item => {
          if (!isRecord(item) || typeof item.front !== "string" || typeof item.back !== "string" || typeof item.topic !== "string") throw new Error("Flashcard inválido.");
          return { front: item.front.trim(), back: item.back.trim(), topic: item.topic.trim() };
        }).filter(item => item.front && item.back && item.topic).slice(0, 4);
        return { title: value.title.trim() || "Trecho da aula", explanation: value.explanation.trim(), keyPoints, flashcards };
      },
    });
  });
}
