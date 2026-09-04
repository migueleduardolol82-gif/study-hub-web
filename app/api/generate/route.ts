import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { createStructuredResponse, OpenAIRequestError } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";

const revisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    quiz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "number" },
          explanation: { type: "string" },
        },
        required: ["question", "options", "answer", "explanation"],
      },
    },
    flashcards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          topic: { type: "string" },
        },
        required: ["front", "back", "topic"],
      },
    },
  },
  required: ["quiz", "flashcards"],
};

export async function POST(request: Request) {
  try {
    let body: { content?: string; focus?: string; difficulty?: string };
    try { body = await request.json(); } catch { return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 }); }
    const { content, focus = "tópicos com lacunas", difficulty = "intermediário" } = body;
    if (!content?.trim()) {
      return NextResponse.json(failure("INVALID_REQUEST", "Adicione conteúdo antes de gerar a revisão."), { status: 400 });
    }
    const output = await createStructuredResponse({
      schema: revisionSchema,
      schemaName: "active_revision",
      validate(value) {
        if (!isRecord(value) || !Array.isArray(value.quiz) || !Array.isArray(value.flashcards)) throw new Error("Revisão incompleta.");
        const quiz = value.quiz.map((item) => {
          if (!isRecord(item) || typeof item.question !== "string" || !Array.isArray(item.options) || item.options.some((option) => typeof option !== "string") || !Number.isInteger(item.answer) || typeof item.explanation !== "string") throw new Error("Questão inválida.");
          const answer = Number(item.answer);
          if (item.options.length !== 4 || answer < 0 || answer > 3) throw new Error("Alternativas inválidas.");
          return { question: item.question.trim(), options: item.options as string[], answer, explanation: item.explanation.trim() };
        });
        const flashcards = value.flashcards.map((item) => {
          if (!isRecord(item) || typeof item.front !== "string" || typeof item.back !== "string" || typeof item.topic !== "string") throw new Error("Flashcard inválido.");
          return { front: item.front.trim(), back: item.back.trim(), topic: item.topic.trim() };
        });
        if (quiz.length !== 5 || flashcards.length !== 8) throw new Error("Quantidade de exercícios inválida.");
        return { quiz, flashcards };
      },
      instructions:
        "Crie material de revisão ativo em português do Brasil. Gere exatamente 5 questões de múltipla escolha, cada uma com 4 alternativas, e 8 flashcards. A resposta do quiz é o índice de 0 a 3. Baseie tudo apenas no conteúdo fornecido.",
      input: `Dificuldade: ${difficulty}\nFoco: ${focus}\n\nConteúdo:\n${content.slice(0, 60000)}`,
    });
    return NextResponse.json(success(output));
  } catch (error) {
    console.error("POST /api/generate", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    return NextResponse.json(failure("CURRICULUM_GENERATION_FAILED", "Não foi possível gerar a revisão.", true), { status: 500 });
  }
}
