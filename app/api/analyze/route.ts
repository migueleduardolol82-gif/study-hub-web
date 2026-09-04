import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { createStructuredResponse, OpenAIRequestError } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";

const mappingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    coverage: { type: "number" },
    topics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          status: { type: "string", enum: ["covered", "partial", "gap"] },
          confidence: { type: "number" },
          videoEvidence: { type: "string" },
          syllabusReference: { type: "string" },
          action: { type: "string" },
        },
        required: ["title", "status", "confidence", "videoEvidence", "syllabusReference", "action"],
      },
    },
    nextSteps: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "coverage", "topics", "nextSteps"],
};

export async function POST(request: Request) {
  try {
    let body: { transcript?: string; syllabus?: string; studyPath?: { topics?: unknown[] } };
    try { body = await request.json(); } catch { return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 }); }
    const { transcript, syllabus, studyPath } = body;
    if (!transcript?.trim()) {
      return NextResponse.json(failure("INVALID_REQUEST", "É necessário ter a transcrição da aula."), { status: 400 });
    }
    if (!Array.isArray(studyPath?.topics) || !studyPath.topics.length) {
      return NextResponse.json(failure("INVALID_REQUEST", "Defina pelo menos um tópico no seu mapa personalizado."), { status: 400 });
    }

    const output = await createStructuredResponse({
      schema: mappingSchema,
      schemaName: "content_mapping",
      validate(value) {
        if (!isRecord(value) || typeof value.summary !== "string" || !Array.isArray(value.topics) || !Array.isArray(value.nextSteps)) throw new Error("Mapeamento incompleto.");
        const topics = value.topics.map((topic) => {
          if (!isRecord(topic) || typeof topic.title !== "string" || !["covered", "partial", "gap"].includes(String(topic.status)) || typeof topic.videoEvidence !== "string" || typeof topic.syllabusReference !== "string" || typeof topic.action !== "string") throw new Error("Tópico analisado inválido.");
          const confidence = Number(topic.confidence);
          if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error("Confiança inválida.");
          return { title: topic.title, status: topic.status as "covered" | "partial" | "gap", confidence, videoEvidence: topic.videoEvidence, syllabusReference: topic.syllabusReference, action: topic.action };
        });
        if (value.nextSteps.some((step) => typeof step !== "string")) throw new Error("Próximos passos inválidos.");
        return { summary: value.summary, coverage: Number(value.coverage) || 0, topics, nextSteps: value.nextSteps as string[] };
      },
      instructions:
        "Você é um tutor acadêmico rigoroso. Analise somente os tópicos definidos pelo aluno no MAPA PESSOAL. Retorne exatamente os mesmos tópicos, na mesma ordem e com o mesmo título; nunca acrescente, remova ou renomeie tópicos. Classifique cada um como covered, partial ou gap conforme a evidência da aula. Use a apostila quando enviada, sem inventar páginas ou referências. Escreva em português do Brasil, de forma curta e útil.",
      input: `MAPA PESSOAL DO ALUNO:\n${JSON.stringify(studyPath).slice(0, 18000)}\n\nTRANSCRIÇÃO DA AULA:\n${transcript.slice(0, 45000)}\n\nAPOSTILA (PODE NÃO TER SIDO ENVIADA):\n${syllabus?.trim() ? syllabus.slice(0, 45000) : "Não enviada. Use as referências cadastradas pelo aluno."}`,
    });
    return NextResponse.json(success(output));
  } catch (error) {
    console.error("POST /api/analyze", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    return NextResponse.json(failure("UNKNOWN_ERROR", "Não foi possível mapear o conteúdo.", true), { status: 500 });
  }
}
