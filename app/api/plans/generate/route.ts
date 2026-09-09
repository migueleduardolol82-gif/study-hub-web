import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, inputTopics, specialistInstructions } from "@/lib/ai-pedagogy";
import { createStructuredResponse } from "@/lib/openai";
import { planBlueprintSchema, validatePlanBlueprint, validMinutes } from "@/lib/study-planning";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return aiRoute(request, "/api/plans/generate", async (body) => {
    const goal = inputText(body.goal, 3000);
    const topics = inputTopics(body.topics);
    const minutes = Number(body.minutes);
    if (!goal && !topics.length) throw new InvalidAIRequest("Descreva seu objetivo ou selecione tópicos para o plano.");
    if (!validMinutes(minutes)) throw new InvalidAIRequest("Informe de 1 a 1440 minutos por sessão.");
    return createStructuredResponse({
      schema: planBlueprintSchema, schemaName: "study_plan_blueprint", validate: validatePlanBlueprint, timeoutMs: 105000, maxOutputTokens: 5000, signal: request.signal,
      instructions: `${specialistInstructions} Prepare 4 a 10 etapas pedagógicas específicas para o plano. Cada etapa precisa de estudo guiado (study), tarefa prática com entrega verificável (practice) e revisão sem consulta com critério de domínio (review). Cada tarefa deve caber em UMA sessão na duração informada; reduza escopo para sessões curtas. O sistema distribui essas etapas no calendário, intercalando estudo, prática e revisão espaçada. Não gere o calendário inteiro. Escreva summary com a estratégia, pré-requisitos e limites realistas do prazo. Não garanta domínio completo se o tempo for insuficiente.`,
      input: JSON.stringify({ objetivo: goal, plano: inputText(body.name, 200), topicos: topics, nivel: inputText(body.difficulty, 40), semanas: body.weeks, diasPorSemana: body.days, minutosPorSessao: minutes, minutosPorDia: body.dayMinutes }),
    });
  });
}
