import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, inputTopics, relevantMaterial, specialistInstructions } from "@/lib/ai-pedagogy";
import { lessonContentSchema, outlineSchema, validateLessonContent, validateOutline } from "@/lib/learning-generation";
import { createStructuredResponse } from "@/lib/openai";
import type { ThemeDifficulty } from "@/lib/learning";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return aiRoute(request, "/api/learning/generate", async (body) => {
    const theme = inputText(body.theme, 300);
    if (!theme) throw new InvalidAIRequest("Informe o assunto que deseja aprender.");
    if (body.mode && body.mode !== "outline" && body.mode !== "lesson") throw new InvalidAIRequest("Etapa de geração inválida.");
    const goal = inputText(body.goal, 2000) || `Dominar os fundamentos e aplicações de ${theme}.`;
    const difficulty = (["iniciante", "intermediario", "avancado"].includes(String(body.difficulty)) ? body.difficulty : "iniciante") as ThemeDifficulty;
    const topics = inputTopics(body.topics);
    const content = inputText(body.content, 100000);
    const requestedUnits = Math.max(0, Math.min(20, Number(body.requestedUnits) || 0));
    const depth = inputText(body.depth, 40) || "equilibrado";
    if (body.mode === "lesson") {
      const title = inputText(body.lessonTitle, 200);
      if (!title) throw new InvalidAIRequest("Selecione a lição que deseja preparar.");
      return createStructuredResponse({
        schema: lessonContentSchema, schemaName: "learning_lesson", validate: validateLessonContent,
        timeoutMs: 105000, maxOutputTokens: 10000, signal: request.signal,
        instructions: `${specialistInstructions} Prepare SOMENTE a lição indicada. Escreva studyNotes aprofundado com teoria, definições, fórmulas e resolução passo a passo quando existirem. Preencha resumo, conceitos, exemplos, erros comuns e referências. Gere 4 a 10 exercícios focados e variados conforme o modo solicitado. Não expanda para outras lições. Em multiple_choice forneça 4 alternativas plausíveis e apenas uma correta. Em true_false use [Verdadeiro,Falso]. Para cada alternativa inclua optionExplanations na mesma ordem explicando por que está certa ou errada; quando não houver opções use []. sourceReference deve apontar documento e página/slide/seção ou declarar 'Complementação externa'. Se houver alternativas, answer deve ser exatamente uma delas, exceto ordering: opções embaralhadas e answer com todos os passos separados por |. Em matching: options vazio e answer com 3 a 5 pares únicos no formato termo=>definição|termo=>definição. Em typed, cálculo e fill_blank: resposta objetiva. Em flashcard: options vazio. Não use error_review sem erros reais fornecidos. No modo hard use casos complexos e alternativas próximas; no speed use enunciados curtos; no memorizar priorize flashcards e recuperação ativa; no estudar priorize explicação antes da prática; no desafio misture a unidade.`,
        input: JSON.stringify({ tema: theme, objetivo: goal, nivel: difficulty, modo: inputText(body.learningMode, 40), unidade: inputText(body.unitTitle, 200), licao: title, habilidade: inputText(body.lessonDescription, 2000), referenciasDaLicao: inputTopics(body.lessonReferences), preRequisitos: inputTopics(body.previousLessons), topicos: topics, material: relevantMaterial(content, `${theme} ${title}`, 50000) }),
      });
    }
    const path = await createStructuredResponse({
      schema: outlineSchema, schemaName: "learning_outline", validate: validateOutline,
      timeoutMs: 105000, maxOutputTokens: 12000, signal: request.signal,
      instructions: `${specialistInstructions} Crie somente o planejamento detalhado da trilha, com 2 a 20 unidades e 1 a 8 lições por unidade. Use a quantidade solicitada quando informada; no automático, estime pela densidade, capítulos e variedade do material, sem reduzir documentos extensos a poucas unidades genéricas. Cada unidade deve ter objetivo verificável, conteúdos, conceitos e referências exatas. Comece no nível informado e avance gradualmente, incluindo revisões e desafio final. Una repetições entre documentos, preserve complementos e sinalize contradições na descrição. Não gere exercícios nem aulas completas nesta etapa. Não crie conteúdo ausente das fontes; qualquer complementação externa deve estar claramente identificada.`,
      input: JSON.stringify({ tema: theme, objetivo: goal, nivelInicial: difficulty, profundidade: depth, quantidadeAproximadaDeUnidades: requestedUnits || "automática pela densidade", topicos: topics, materialAnalisadoIntegralmenteEmEtapas: content }),
    });
    return { ...path, source: { theme, goal, topics, content, difficulty } };
  });
}
