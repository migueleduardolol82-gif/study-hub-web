import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { attachCurriculumIds, curriculumSchema, validateCurriculum } from "@/lib/learning";
import { createStructuredResponse, OpenAIRequestError } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";

export const runtime = "nodejs";
export const maxDuration = 60;

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!isRecord(parsed)) throw new Error("invalid body");
      body = parsed;
    } catch {
      return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 });
    }
    const theme = text(body.theme, 160);
    const goal = text(body.goal, 1200);
    const content = text(body.content, 60_000);
    const topics = Array.isArray(body.topics) ? body.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 80) : [];
    if (!theme || (!goal && !content && !topics.length)) {
      return NextResponse.json(failure("INVALID_REQUEST", "Informe um tema e uma fonte de conteúdo para gerar a trilha."), { status: 400 });
    }

    const curriculum = await createStructuredResponse({
      schema: curriculumSchema as unknown as Record<string, unknown>,
      schemaName: "learning_path",
      validate: validateCurriculum,
      instructions: [
        "Você é um designer instrucional rigoroso. Crie uma trilha progressiva em português do Brasil para o tema solicitado.",
        "Produza de 3 a 5 unidades, cada uma com 2 a 4 lições e cada lição com 4 a 6 exercícios.",
        "Distribua os tipos multiple_choice, true_false, fill_blank, matching, ordering, flashcard, typed, case_study, ai_question, error_review e mock_exam ao longo da trilha.",
        "Para múltipla escolha, options deve ter 4 itens e answer deve ser exatamente o texto correto. Para verdadeiro/falso use options [Verdadeiro,Falso].",
        "Para ordenar, options contém os passos embaralhados e answer contém a ordem correta separada por |. Para relacionar, answer contém pares separados por |.",
        "Para respostas abertas, use uma resposta-modelo curta e objetiva. Dê feedback didático em explanation.",
        "Baseie fatos somente no conteúdo fornecido. Se a fonte for apenas um objetivo, ensine fundamentos gerais sem inventar citações, páginas ou estatísticas.",
        "A dificuldade deve avançar de iniciante para intermediário e avançado.",
      ].join(" "),
      input: JSON.stringify({ tema: theme, objetivo: goal, topicos: topics, conteudo: content }),
    });
    return NextResponse.json(success(attachCurriculumIds(curriculum)));
  } catch (error) {
    console.error("POST /api/learning/generate", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    return NextResponse.json(failure("CURRICULUM_GENERATION_FAILED", "Não foi possível gerar a trilha de aprendizado.", true), { status: 500 });
  }
}
