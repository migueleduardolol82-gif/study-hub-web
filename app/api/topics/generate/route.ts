import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { createStructuredResponse, OpenAIRequestError } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";

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
    let body: {
      request?: string;
      courseName?: string;
      studyGoal?: string;
      existingTopics?: string[];
    };
    try { body = await request.json(); } catch { return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 }); }
    if (!body.request?.trim()) {
      return NextResponse.json(failure("INVALID_REQUEST", "Descreva o que você quer aprender."), { status: 400 });
    }

    const output = await createStructuredResponse({
      schema,
      schemaName: "generated_study_topics",
      validate(value) {
        if (!isRecord(value) || !Array.isArray(value.topics)) throw new Error("Lista de tópicos ausente.");
        const topics = value.topics.map((topic) => {
          if (!isRecord(topic) || typeof topic.title !== "string" || typeof topic.module !== "string" || !["high", "medium", "low"].includes(String(topic.priority))) {
            throw new Error("Tópico gerado em formato inválido.");
          }
          return { title: topic.title.trim(), module: topic.module.trim(), priority: topic.priority as "high" | "medium" | "low" };
        }).filter((topic) => topic.title);
        if (topics.length < 4 || topics.length > 20) throw new Error("Quantidade de tópicos inválida.");
        return { topics };
      },
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
    return NextResponse.json(success(output));
  } catch (error) {
    console.error("POST /api/topics/generate", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    return NextResponse.json(failure("CURRICULUM_GENERATION_FAILED", "Não foi possível gerar os tópicos.", true), { status: 500 });
  }
}
