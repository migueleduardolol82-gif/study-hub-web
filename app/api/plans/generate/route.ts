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
    const material = inputText(body.material, 100000);
    if (!goal && !topics.length) throw new InvalidAIRequest("Descreva seu objetivo ou selecione tópicos para o plano.");
    if (!validMinutes(minutes)) throw new InvalidAIRequest("Informe de 1 a 1440 minutos por sessão.");
    return createStructuredResponse({
      schema: planBlueprintSchema, schemaName: "study_plan_blueprint", validate: validatePlanBlueprint, timeoutMs: 105000, maxOutputTokens: 5000, signal: request.signal,
      instructions: `${specialistInstructions} Prepare 4 a 20 etapas pedagógicas específicas para o plano, proporcionais ao conteúdo e ao perfil escolhido. Cada etapa precisa de estudo guiado, prática verificável e revisão sem consulta. Cada tarefa deve caber em UMA sessão na duração informada. Distribua teoria, exercícios, revisão espaçada e simulados quando fizer sentido. Em references cite exatamente documento e página/slide/seção recebidos. Preserve todo o conteúdo relevante das fontes; una repetições e sinalize limites do prazo no summary. Não garanta domínio completo se o tempo for insuficiente.`,
      input: JSON.stringify({ objetivo: goal, plano: inputText(body.name, 200), perfil: inputText(body.profile, 40), topicos: topics, nivelAtual: inputText(body.difficulty, 40), nivelDesejado: inputText(body.desiredLevel, 80), inicio: inputText(body.startDate, 20), prazo: inputText(body.deadline, 20), diasDeDescanso: inputTopics(body.restDays), pomodoro: Boolean(body.pomodoro), semanas: body.weeks, diasPorSemana: body.days, minutosPorSessao: minutes, minutosPorDia: body.dayMinutes, materialAnalisadoIntegralmenteEmEtapas: material }),
    });
  });
}
