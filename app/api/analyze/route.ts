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
    const { transcript, syllabus } = await request.json();
    if (!transcript?.trim() || !syllabus?.trim()) {
      return NextResponse.json(
        { error: "É necessário ter a transcrição e o texto da apostila." },
        { status: 400 },
      );
    }

    const output = await createTextResponse({
      schema: mappingSchema,
      schemaName: "content_mapping",
      instructions:
        "Você é um tutor acadêmico rigoroso. Compare a aula transcrita com a apostila. Não invente tópicos nem referências. Escreva em português do Brasil, de forma curta e útil.",
      input: `TRANSCRIÇÃO DA AULA:\n${transcript.slice(0, 45000)}\n\nAPOSTILA:\n${syllabus.slice(0, 45000)}`,
    });
    return NextResponse.json(JSON.parse(output));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível mapear o conteúdo." },
      { status: 500 },
    );
  }
}
