import { NextResponse } from "next/server";
import { createTextResponse } from "@/lib/openai";

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
    const { content, focus = "tópicos com lacunas", difficulty = "intermediário" } = await request.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Adicione conteúdo antes de gerar a revisão." }, { status: 400 });
    }
    const output = await createTextResponse({
      schema: revisionSchema,
      schemaName: "active_revision",
      instructions:
        "Crie material de revisão ativo em português do Brasil. Gere exatamente 5 questões de múltipla escolha, cada uma com 4 alternativas, e 8 flashcards. A resposta do quiz é o índice de 0 a 3. Baseie tudo apenas no conteúdo fornecido.",
      input: `Dificuldade: ${difficulty}\nFoco: ${focus}\n\nConteúdo:\n${content.slice(0, 60000)}`,
    });
    return NextResponse.json(JSON.parse(output));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a revisão." },
      { status: 500 },
    );
  }
}
