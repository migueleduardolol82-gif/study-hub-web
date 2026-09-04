import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { createTextResponse, OpenAIRequestError } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    let body: { message?: string; context?: string };
    try { body = await request.json(); } catch { return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 }); }
    const { message, context = "" } = body;
    if (!message?.trim()) {
      return NextResponse.json(failure("INVALID_REQUEST", "Escreva uma pergunta."), { status: 400 });
    }
    const answer = await createTextResponse({
      instructions:
        "Você é o tutor do aluno dentro de um ambiente de estudos. Responda em português do Brasil, com clareza, exemplos curtos e fidelidade ao material. Quando o material não for suficiente, diga isso explicitamente.",
      input: `MATERIAL DISPONÍVEL:\n${context.slice(0, 50000)}\n\nPERGUNTA DO ALUNO:\n${message}`,
    });
    return NextResponse.json(success({ answer }));
  } catch (error) {
    console.error("POST /api/chat", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    }
    return NextResponse.json(
      failure("UNKNOWN_ERROR", "O tutor não conseguiu responder agora. Tente novamente.", true),
      { status: 500 },
    );
  }
}
