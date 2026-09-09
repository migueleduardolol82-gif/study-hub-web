import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, inputTopics, relevantMaterial, specialistInstructions } from "@/lib/ai-pedagogy";
import { createStructuredResponse } from "@/lib/openai";
import { isRecord } from "@/lib/safe-json";
export const runtime = "nodejs";
export const maxDuration = 120;
const string = { type: "string" };
const schema = { type: "object", additionalProperties: false, required: ["topics"], properties: { topics: { type: "array", minItems: 4, maxItems: 16, items: { type: "object", additionalProperties: false, required: ["title", "module", "priority", "objective", "practice"], properties: { title: string, module: string, priority: { type: "string", enum: ["high", "medium", "low"] }, objective: string, practice: string } } } } };
export async function POST(request: Request) {
  return aiRoute(request, "/api/topics/generate", async (body) => {
    const prompt = inputText(body.request, 3000);
    if (!prompt) throw new InvalidAIRequest("Descreva o que você quer aprender.");
    const existing = inputTopics(body.existingTopics);
    return createStructuredResponse({
      schema, schemaName: "generated_study_topics", timeoutMs: 105000, maxOutputTokens: 5000, signal: request.signal,
      instructions: `${specialistInstructions} Gere de 4 a 16 tópicos específicos em ordem de pré-requisitos. Agrupe em módulos coerentes. Dê prioridade de acordo com o objetivo. Para cada tópico forneça uma habilidade observável em objective e uma tarefa concreta em practice. Não repita tópicos existentes nem variações triviais deles. Evite uma lista genérica de introdução, conceitos e conclusão.`,
      input: JSON.stringify({ pedido: prompt, trilha: inputText(body.courseName, 200), objetivo: inputText(body.studyGoal, 2000), nivel: inputText(body.difficulty, 40), topicosExistentes: existing, material: relevantMaterial(inputText(body.content, 60000), prompt) }),
      validate(value) {
        if (!isRecord(value) || !Array.isArray(value.topics) || value.topics.length < 4 || value.topics.length > 16) throw new Error("Lista de tópicos inválida.");
        const seen = new Set(existing.map((title) => title.toLocaleLowerCase("pt-BR")));
        const topics = value.topics.map((topic) => {
          if (!isRecord(topic) || ["title", "module", "objective", "practice"].some((key) => typeof topic[key] !== "string" || !(topic[key] as string).trim()) || !["high", "medium", "low"].includes(String(topic.priority))) throw new Error("Tópico incompleto.");
          return { title: String(topic.title).trim(), module: String(topic.module).trim(), priority: topic.priority as "high" | "medium" | "low", objective: String(topic.objective).trim(), practice: String(topic.practice).trim() };
        }).filter((topic) => { const key = topic.title.toLocaleLowerCase("pt-BR"); if (seen.has(key)) return false; seen.add(key); return true; });
        if (!topics.length) throw new Error("A resposta repetiu os tópicos existentes.");
        return { topics };
      },
    });
  });
}
