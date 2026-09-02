import { NextResponse } from "next/server";
import { createTextResponse } from "@/lib/openai";

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
    const { transcript, syllabus, studyPath } = await request.json();
    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "É necessário ter a transcrição da aula." },
        { status: 400 },
      );
    }
    if (!Array.isArray(studyPath?.topics) || !studyPath.topics.length) {
      return NextResponse.json(
        { error: "Defina pelo menos um tópico no seu mapa personalizado." },
        { status: 400 },
      );
    }

    const output = await createTextResponse({
      schema: mappingSchema,
      schemaName: "content_mapping",
      instructions:
        "Você é um tutor acadêmico rigoroso. Analise somente os tópicos definidos pelo aluno no MAPA PESSOAL. Retorne exatamente os mesmos tópicos, na mesma ordem e com o mesmo título; nunca acrescente, remova ou renomeie tópicos. Classifique cada um como covered, partial ou gap conforme a evidência da aula. Use a apostila quando enviada, sem inventar páginas ou referências. Escreva em português do Brasil, de forma curta e útil.",
      input: `MAPA PESSOAL DO ALUNO:\n${JSON.stringify(studyPath).slice(0, 18000)}\n\nTRANSCRIÇÃO DA AULA:\n${transcript.slice(0, 45000)}\n\nAPOSTILA (PODE NÃO TER SIDO ENVIADA):\n${syllabus?.trim() ? syllabus.slice(0, 45000) : "Não enviada. Use as referências cadastradas pelo aluno."}`,
    });
    return NextResponse.json(JSON.parse(output));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível mapear o conteúdo." },
      { status: 500 },
    );
  }
}
