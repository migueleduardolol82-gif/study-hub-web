import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, relevantMaterial, specialistInstructions } from "@/lib/ai-pedagogy";
import { createTextResponse } from "@/lib/openai";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return aiRoute(request, "/api/chat", async (body) => {
    const message = inputText(body.message, 6000);
    if (!message) throw new InvalidAIRequest("Escreva uma pergunta.");
    const answer = await createTextResponse({
      instructions: `${specialistInstructions} Responda à pergunta diretamente, explicando o raciocínio e os erros comuns. Use exemplos pertinentes ao assunto e ao nível do aluno. Se o aluno mudar de assunto, acompanhe o novo assunto. Se pedir algo amplo demais, proponha um recorte inicial útil e pergunte o necessário. Use conhecimento geral quando não houver material, identificando complementos ao material quando houver.`,
      input: JSON.stringify({ pergunta: message, material: relevantMaterial(inputText(body.context, 60000), message) }),
      timeoutMs: 105000, maxOutputTokens: 5000, signal: request.signal,
    });
    return { answer };
  });
}
