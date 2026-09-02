import { NextResponse } from "next/server";
import { createTextResponse } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      type: "array",
      minItems: 4,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "module", "priority"],
        properties: {
          title: { type: "string" },
          module: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      request?: string;
      courseName?: string;
      studyGoal?: string;
      existingTopics?: string[];
    };
    if (!body.request?.trim()) {
      return NextResponse.json({ error: "Descreva o que você quer aprender." }, { status: 400 });
    }

    const output = await createTextResponse({
      schema,
      schemaName: "generated_study_topics",
      instructions: [
        "Você é um arquiteto de currículos.",
        "Gere uma sequência personalizada, progressiva e prática de tópicos de estudo.",
        "Não repita tópicos já existentes.",
        "Use títulos específicos, módulos claros e prioridade coerente.",
        "Não invente referências de páginas ou livros.",
        "Responda em português do Brasil.",
      ].join(" "),
      input: JSON.stringify({
        pedido: body.request,
        trilha: body.courseName || "não definida",
        objetivo: body.studyGoal || "não definido",
        topicosExistentes: body.existingTopics || [],
      }),
    });
    return NextResponse.json(JSON.parse(output));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar os tópicos." },
      { status: 500 },
    );
  }
}
