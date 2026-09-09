import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, specialistInstructions } from "@/lib/ai-pedagogy";
import { createStructuredResponse } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";
export const runtime = "nodejs";
export const maxDuration = 120;
const string = { type: "string" };
const schema = { type: "object", additionalProperties: false, required: ["name", "description", "category", "difficulty", "objective"], properties: { name: string, description: string, category: string, difficulty: { type: "string", enum: ["iniciante", "intermediario", "avancado"] }, objective: string } };
export async function POST(request: Request) {
  return aiRoute(request, "/api/themes/generate", async (body) => {
    const prompt = inputText(body.request, 3000);
    if (!prompt) throw new InvalidAIRequest("Descreva o assunto e o que deseja alcançar.");
    return createStructuredResponse({ schema, schemaName: "personalized_theme", timeoutMs: 105000, maxOutputTokens: 1800, signal: request.signal,
      instructions: `${specialistInstructions} Proponha um tema com nome específico, categoria, nível inicial, descrição do escopo e pré-requisitos, e um objetivo mensurável. O usuário revisará os campos antes de salvar. Não crie promessas irreais nem assuntos sem relação com o pedido.`,
      input: JSON.stringify({ pedido: prompt, nivel: inputText(body.difficulty, 40), contexto: inputText(body.context, 2000) }),
      validate(value) {
        if (!isRecord(value) || ["name", "description", "category", "objective"].some((key) => typeof value[key] !== "string" || !(value[key] as string).trim()) || !["iniciante", "intermediario", "avancado"].includes(String(value.difficulty))) throw new Error("Tema incompleto.");
        return { name: String(value.name), description: String(value.description), category: String(value.category), objective: String(value.objective), difficulty: value.difficulty };
      },
    });
  });
}
