import { NextResponse } from "next/server";
import { createTextResponse } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const { message, context = "" } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Escreva uma pergunta." }, { status: 400 });
    }
    const answer = await createTextResponse({
      instructions:
        "Você é o tutor do aluno dentro de um ambiente de estudos. Responda em português do Brasil, com clareza, exemplos curtos e fidelidade ao material. Quando o material não for suficiente, diga isso explicitamente.",
      input: `MATERIAL DISPONÍVEL:\n${context.slice(0, 50000)}\n\nPERGUNTA DO ALUNO:\n${message}`,
    });
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "O tutor não conseguiu responder." },
      { status: 500 },
    );
  }
}
